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

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  deadline: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid ISO date" })
    .optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  status: z
    .enum([
      TaskStatus.ASSIGNED,
      TaskStatus.IN_PROGRESS,
      TaskStatus.COMPLETED,
      TaskStatus.OVERDUE,
      TaskStatus.CANCELLED,
    ])
    .optional(),
  specialPermission: z.boolean().optional(),
  specialPermNote: z.string().optional(),
  isWfhTask: z.boolean().optional(),
});

// ── helpers ──────────────────────────────────────────────────

function calculateSpeedScore(completedAt: Date, deadline: Date): number {
  const diffMs = completedAt.getTime() - deadline.getTime();
  if (diffMs <= 0) return 100; // completed before or on deadline
  const daysLate = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  return Math.max(0, 100 - daysLate * 10);
}

function calculateBacklogWeeks(deadline: Date): number {
  const diffMs = Date.now() - deadline.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
}

// ── GET  /api/tasks/[id] — Single task with full details ──────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            companyId: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        reviews: {
          include: {
            reviewer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      return errorResponse("Task not found", 404);
    }

    // Tenant isolation
    if (task.assignedTo.companyId !== session.user.companyId) {
      return errorResponse("Task not found", 404);
    }

    // STAFF can only view tasks assigned to them
    if (
      session.user.role === UserRole.STAFF &&
      task.assignedToId !== session.user.id
    ) {
      return errorResponse("You can only view tasks assigned to you", 403);
    }

    return successResponse(task);
  } catch (err) {
    console.error("[TASK-GET]", err);
    return errorResponse("Failed to fetch task", 500);
  }
}

// ── PUT  /api/tasks/[id] — Update task ────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { id } = await params;

    const body = await parseBody(req);
    if (!body) return errorResponse("Invalid request body");

    const parsed = updateTaskSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    // Fetch existing task for company check and status validation
    const existing = await prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: { id: true, companyId: true },
        },
      },
    });

    if (!existing) {
      return errorResponse("Task not found", 404);
    }

    // Tenant isolation
    if (existing.assignedTo.companyId !== session.user.companyId) {
      return errorResponse("Task not found", 404);
    }

    const {
      title,
      description,
      deadline: deadlineStr,
      priority,
      status,
      specialPermission,
      specialPermNote,
      isWfhTask,
    } = parsed.data;

    const updateData: Record<string, unknown> = {};

    // Basic field updates
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priority !== undefined) updateData.priority = priority;
    if (specialPermission !== undefined) updateData.specialPermission = specialPermission;
    if (specialPermNote !== undefined) updateData.specialPermNote = specialPermNote;
    if (isWfhTask !== undefined) updateData.isWfhTask = isWfhTask;

    // Handle deadline update
    if (deadlineStr !== undefined) {
      updateData.deadline = new Date(deadlineStr);
    }

    // Handle status transitions
    if (status !== undefined) {
      const reviewerRoles: string[] = [
        UserRole.REVIEWER,
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
      ];
      const isReviewerOrAbove = reviewerRoles.includes(session.user.role);

      switch (status) {
        case TaskStatus.IN_PROGRESS: {
          // ASSIGNED -> IN_PROGRESS: anyone (assignee or reviewer)
          if (existing.status !== TaskStatus.ASSIGNED) {
            return errorResponse(
              "Only ASSIGNED tasks can be moved to IN_PROGRESS"
            );
          }
          updateData.status = TaskStatus.IN_PROGRESS;
          break;
        }

        case TaskStatus.COMPLETED: {
          // IN_PROGRESS -> COMPLETED: set completedAt, calculate speedScore
          if (existing.status !== TaskStatus.IN_PROGRESS) {
            return errorResponse(
              "Only IN_PROGRESS tasks can be marked as COMPLETED"
            );
          }
          const completedAt = new Date();
          const deadline = deadlineStr
            ? new Date(deadlineStr)
            : existing.deadline;

          updateData.status = TaskStatus.COMPLETED;
          updateData.completedAt = completedAt;
          updateData.speedScore = calculateSpeedScore(completedAt, deadline);
          updateData.isOverdue = false;
          updateData.backlogWeeks = 0;
          break;
        }

        case TaskStatus.CANCELLED: {
          // Any -> CANCELLED: only reviewer/admin
          if (!isReviewerOrAbove) {
            return errorResponse(
              "Only reviewers and admins can cancel tasks",
              403
            );
          }
          updateData.status = TaskStatus.CANCELLED;
          updateData.backlogWeeks = 0;
          break;
        }

        case TaskStatus.OVERDUE: {
          // Any -> OVERDUE: system or reviewer
          if (!isReviewerOrAbove) {
            return errorResponse(
              "Only reviewers and admins can mark tasks as overdue",
              403
            );
          }
          updateData.status = TaskStatus.OVERDUE;
          updateData.isOverdue = true;
          break;
        }

        default:
          return errorResponse(`Invalid status transition to ${status}`);
      }
    }

    // Recalculate backlog weeks for non-terminal statuses
    const finalStatus = (updateData.status as TaskStatus) ?? existing.status;
    if (
      finalStatus !== TaskStatus.COMPLETED &&
      finalStatus !== TaskStatus.CANCELLED
    ) {
      const effectiveDeadline = updateData.deadline
        ? (updateData.deadline as Date)
        : existing.deadline;
      const backlog = calculateBacklogWeeks(effectiveDeadline);
      updateData.backlogWeeks = backlog;

      // Flag if overdue more than 7 days and no special permission yet
      if (backlog >= 1 && !existing.specialPermission && !specialPermission) {
        updateData.isOverdue = true;
      }
    }

    const updated = await prisma.task.update({
      where: { id },
      data: updateData,
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
            reviewerNotes: true,
          },
        },
      },
    });

    return successResponse(updated, "Task updated successfully");
  } catch (err) {
    console.error("[TASK-UPDATE]", err);
    return errorResponse("Failed to update task", 500);
  }
}

// ── DELETE  /api/tasks/[id] — Delete task (ADMIN/SUPER_ADMIN) ─

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { id } = await params;

    // Only ADMIN / SUPER_ADMIN can delete tasks
    const allowedRoles: string[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
    if (!allowedRoles.includes(session.user.role)) {
      return errorResponse("Only admins can delete tasks", 403);
    }

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: { companyId: true },
        },
      },
    });

    if (!task) {
      return errorResponse("Task not found", 404);
    }

    // Tenant isolation
    if (task.assignedTo.companyId !== session.user.companyId) {
      return errorResponse("Task not found", 404);
    }

    await prisma.task.delete({ where: { id } });

    return successResponse({ id }, "Task deleted successfully");
  } catch (err) {
    console.error("[TASK-DELETE]", err);
    return errorResponse("Failed to delete task", 500);
  }
}
