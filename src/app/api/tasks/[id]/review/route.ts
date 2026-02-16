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

const createReviewSchema = z.object({
  accuracyScore: z
    .number()
    .min(0, "Accuracy score must be 0-100")
    .max(100, "Accuracy score must be 0-100"),
  reviewerNotes: z.string().optional(),
});

const staffResponseSchema = z.object({
  staffAgreed: z.boolean(),
  staffComments: z.string().optional(),
});

// ── POST  /api/tasks/[id]/review — Submit review ──────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { id: taskId } = await params;

    // Only REVIEWER, ADMIN, SUPER_ADMIN can review
    const allowedRoles: string[] = [
      UserRole.REVIEWER,
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
    ];
    if (!allowedRoles.includes(session.user.role)) {
      return errorResponse("Only reviewers and admins can review tasks", 403);
    }

    const body = await parseBody(req);
    if (!body) return errorResponse("Invalid request body");

    const parsed = createReviewSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    const { accuracyScore, reviewerNotes } = parsed.data;

    // Verify task exists, is completed, and belongs to same company
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignedTo: {
          select: { companyId: true },
        },
      },
    });

    if (!task) {
      return errorResponse("Task not found", 404);
    }

    if (task.assignedTo.companyId !== session.user.companyId) {
      return errorResponse("Task not found", 404);
    }

    if (task.status !== TaskStatus.COMPLETED) {
      return errorResponse("Only completed tasks can be reviewed");
    }

    // Upsert review (unique constraint on taskId)
    const review = await prisma.taskReview.upsert({
      where: { taskId },
      create: {
        taskId,
        reviewerId: session.user.id,
        accuracyScore,
        reviewerNotes: reviewerNotes ?? null,
      },
      update: {
        reviewerId: session.user.id,
        accuracyScore,
        reviewerNotes: reviewerNotes ?? null,
        staffAgreed: false,
        staffComments: null,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            assignedToId: true,
          },
        },
      },
    });

    return successResponse(review, "Review submitted successfully");
  } catch (err) {
    console.error("[TASK-REVIEW-CREATE]", err);
    return errorResponse("Failed to submit review", 500);
  }
}

// ── PUT  /api/tasks/[id]/review — Staff agrees/disputes ───────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { id: taskId } = await params;

    const body = await parseBody(req);
    if (!body) return errorResponse("Invalid request body");

    const parsed = staffResponseSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    const { staffAgreed, staffComments } = parsed.data;

    // Verify the task exists and belongs to same company
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignedTo: {
          select: { id: true, companyId: true },
        },
      },
    });

    if (!task) {
      return errorResponse("Task not found", 404);
    }

    if (task.assignedTo.companyId !== session.user.companyId) {
      return errorResponse("Task not found", 404);
    }

    // Only the task assignee can respond to a review
    if (task.assignedToId !== session.user.id) {
      return errorResponse(
        "Only the task assignee can respond to reviews",
        403
      );
    }

    // Check that a review exists
    const existingReview = await prisma.taskReview.findUnique({
      where: { taskId },
    });

    if (!existingReview) {
      return errorResponse("No review exists for this task", 404);
    }

    const updated = await prisma.taskReview.update({
      where: { taskId },
      data: {
        staffAgreed,
        staffComments: staffComments ?? null,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            assignedToId: true,
          },
        },
      },
    });

    return successResponse(updated, "Review response submitted successfully");
  } catch (err) {
    console.error("[TASK-REVIEW-RESPOND]", err);
    return errorResponse("Failed to update review response", 500);
  }
}
