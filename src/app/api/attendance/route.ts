import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
} from "@/lib/api-utils";
import { UserRole } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { searchParams } = new URL(req.url);

    // Parse query params
    let userId = searchParams.get("userId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    // STAFF can only see their own records
    if (session.user.role === UserRole.STAFF) {
      userId = session.user.id;
    }

    // Build where clause with tenant isolation through user relation
    const where: Record<string, unknown> = {
      user: {
        companyId: session.user.companyId,
      },
    };

    if (userId) {
      where.userId = userId;
    }

    // Date range filter
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) {
        dateFilter.gte = new Date(from);
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setDate(toDate.getDate() + 1);
        dateFilter.lt = toDate;
      }
      where.date = dateFilter;
    }

    // Count total records
    const total = await prisma.attendance.count({ where });

    // Fetch paginated records
    const records = await prisma.attendance.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        geoFence: {
          select: {
            label: true,
          },
        },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return successResponse({
      records,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (err) {
    console.error("[ATTENDANCE-LIST]", err);
    return errorResponse("Failed to fetch attendance records", 500);
  }
}
