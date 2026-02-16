import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";
import { z } from "zod";
import { UserRole, TaskStatus } from "@/generated/prisma/client";

// ── validation ───────────────────────────────────────────────

const createTaskSchema = z.object({
  assignedToId: z.string().min(1, "Assignee is required"),
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().optional(),
  deadline: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "Invalid ISO date string",
  }),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

// ── GET  /api/tasks — List tasks with filters ─────────────────

export async function GET(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { searchParams } = new URL(req.url);

    let assignedToId = searchParams.get("assignedToId");
    const assignedById = searchParams.get("assignedById");
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );

    // STAFF can only see tasks assigned to them
    if (session.user.role === UserRole.STAFF) {
      assignedToId = session.user.id;
    }

    // Build where clause with tenant isolation via assignedTo relation
    const where: Record<string, unknown> = {
      assignedTo: { companyId: session.user.companyId },
    };

    if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    if (assignedById) {
      where.assignedById = assignedById;
    }

    if (status) {
      where.status = status as TaskStatus;
    }

    if (priority) {
      where.priority = priority;
    }

    // Fetch total + records in parallel
    const [total, records] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        include: {
          assignedTo: {
            select: {
              firstName: true,
              lastName: true,
              employeeCode: true,
            },
          },
          assignedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          reviews: {
            select: {
              accuracyScore: true,
              staffAgreed: true,
            },
          },
        },
        orderBy: [{ status: "asc" }, { deadline: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Kanban summary counts (scoped to the same company filter)
    const companyFilter = {
      assignedTo: { companyId: session.user.companyId },
      ...(session.user.role === UserRole.STAFF
        ? { assignedToId: session.user.id }
        : {}),
    };

    const [assigned, inProgress, completed, overdue] = await Promise.all([
      prisma.task.count({ where: { ...companyFilter, status: TaskStatus.ASSIGNED } }),
      prisma.task.count({ where: { ...companyFilter, status: TaskStatus.IN_PROGRESS } }),
      prisma.task.count({ where: { ...companyFilter, status: TaskStatus.COMPLETED } }),
      prisma.task.count({ where: { ...companyFilter, status: TaskStatus.OVERDUE } }),
    ]);

    return successResponse({
      records,
      total,
      page,
      limit,
      totalPages,
      counts: { assigned, inProgress, completed, overdue },
    });
  } catch (err) {
    console.error("[TASKS-LIST]", err);
    return errorResponse("Failed to fetch tasks", 500);
  }
}

// ── POST  /api/tasks — Create / assign a task ─────────────────

export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    // Only REVIEWER, ADMIN, SUPER_ADMIN can create tasks
    const allowedRoles: string[] = [
      UserRole.REVIEWER,
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
    ];
    if (!allowedRoles.includes(session.user.role)) {
      return errorResponse("Only reviewers and admins can assign tasks", 403);
    }

    const body = await parseBody(req);
    if (!body) return errorResponse("Invalid request body");

    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    const { assignedToId, title, description, deadline: deadlineStr, priority } =
      parsed.data;

    // Verify assignee exists and belongs to the same company
    const assignee = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { id: true, companyId: true },
    });

    if (!assignee) {
      return errorResponse("Assigned user not found", 404);
    }

    if (assignee.companyId !== session.user.companyId) {
      return errorResponse(
        "Cannot assign tasks to users in another company",
        403
      );
    }

    const deadline = new Date(deadlineStr);

    const task = await prisma.task.create({
      data: {
        assignedToId,
        assignedById: session.user.id,
        title,
        description: description ?? null,
        deadline,
        priority,
        status: TaskStatus.ASSIGNED,
      },
      include: {
        assignedTo: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        assignedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return successResponse(task, "Task assigned successfully");
  } catch (err) {
    console.error("[TASKS-CREATE]", err);
    return errorResponse("Failed to create task", 500);
  }
}
