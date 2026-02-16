import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
} from "@/lib/api-utils";
import { UserRole, TaskStatus } from "@/generated/prisma/client";

// ── GET  /api/tasks/stats — Task statistics for dashboard ─────

export async function GET(_req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    // Base filter: tenant isolation + role scoping
    const baseWhere: Record<string, unknown> = {
      assignedTo: { companyId: session.user.companyId },
    };

    // STAFF only sees their own stats
    if (session.user.role === UserRole.STAFF) {
      baseWhere.assignedToId = session.user.id;
    }

    // Count by status in parallel
    const [total, assigned, inProgress, completed, overdue, cancelled] =
      await Promise.all([
        prisma.task.count({ where: baseWhere }),
        prisma.task.count({
          where: { ...baseWhere, status: TaskStatus.ASSIGNED },
        }),
        prisma.task.count({
          where: { ...baseWhere, status: TaskStatus.IN_PROGRESS },
        }),
        prisma.task.count({
          where: { ...baseWhere, status: TaskStatus.COMPLETED },
        }),
        prisma.task.count({
          where: { ...baseWhere, status: TaskStatus.OVERDUE },
        }),
        prisma.task.count({
          where: { ...baseWhere, status: TaskStatus.CANCELLED },
        }),
      ]);

    // Average speed score for completed tasks
    const speedAgg = await prisma.task.aggregate({
      where: {
        ...baseWhere,
        status: TaskStatus.COMPLETED,
        speedScore: { not: null },
      },
      _avg: { speedScore: true },
    });

    // Average accuracy score from reviews
    const accuracyAgg = await prisma.taskReview.aggregate({
      where: {
        task: baseWhere,
      },
      _avg: { accuracyScore: true },
    });

    // Backlog count: overdue and not completed/cancelled
    const backlogCount = await prisma.task.count({
      where: {
        ...baseWhere,
        deadline: { lt: new Date() },
        status: {
          notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED],
        },
      },
    });

    return successResponse({
      total,
      assigned,
      inProgress,
      completed,
      overdue,
      cancelled,
      avgSpeedScore: speedAgg._avg.speedScore
        ? Math.round(speedAgg._avg.speedScore * 100) / 100
        : null,
      avgAccuracyScore: accuracyAgg._avg.accuracyScore
        ? Math.round(accuracyAgg._avg.accuracyScore * 100) / 100
        : null,
      backlogCount,
    });
  } catch (err) {
    console.error("[TASKS-STATS]", err);
    return errorResponse("Failed to fetch task statistics", 500);
  }
}
