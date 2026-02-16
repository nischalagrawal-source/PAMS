import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
} from "@/lib/api-utils";
import { NotificationStatus } from "@/generated/prisma/client";

// ── GET  /api/notifications — List notifications for current user ──

export async function GET(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const type = searchParams.get("type");

    const where: Record<string, unknown> = {
      userId: session!.user.id,
    };

    if (type) {
      where.type = type;
    }

    const [records, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: {
          userId: session!.user.id,
          status: NotificationStatus.PENDING,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return successResponse({ records, total, page, limit, totalPages, unreadCount });
  } catch (err) {
    console.error("[NOTIFICATIONS-LIST]", err);
    return errorResponse("Failed to fetch notifications", 500);
  }
}
