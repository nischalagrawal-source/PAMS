import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";
import { z } from "zod";
import {
  UserRole,
  LeaveType,
  LeaveStatus,
  ProofStatus,
} from "@/generated/prisma/client";

// ── helpers ──────────────────────────────────────────────────

function countWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

// ── validation ───────────────────────────────────────────────

const applyLeaveSchema = z.object({
  leaveType: z.enum([LeaveType.SICK, LeaveType.PERSONAL, LeaveType.EMERGENCY]),
  startDate: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "Invalid ISO date string",
  }),
  endDate: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "Invalid ISO date string",
  }),
  reason: z.string().optional(),
});

// ── GET  /api/leaves — List leave requests ───────────────────

export async function GET(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { searchParams } = new URL(req.url);

    let userId = searchParams.get("userId");
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );

    // STAFF can only see their own leave requests
    if (session.user.role === UserRole.STAFF) {
      userId = session.user.id;
    }

    // Build where clause with tenant isolation via user relation
    const where: Record<string, unknown> = {
      user: { companyId: session.user.companyId },
    };

    if (userId) {
      where.userId = userId;
    }

    if (status) {
      where.status = status as LeaveStatus;
    }

    if (type) {
      where.leaveType = type as LeaveType;
    }

    // Date range filter on startDate
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setDate(toDate.getDate() + 1);
        dateFilter.lt = toDate;
      }
      where.startDate = dateFilter;
    }

    const total = await prisma.leaveRequest.count({ where });

    const records = await prisma.leaveRequest.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        approvedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { appliedOn: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return successResponse({ records, total, page, limit, totalPages });
  } catch (err) {
    console.error("[LEAVES-LIST]", err);
    return errorResponse("Failed to fetch leave requests", 500);
  }
}

// ── POST  /api/leaves — Apply for leave ──────────────────────

export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const body = await parseBody(req);
    if (!body) return errorResponse("Invalid request body");

    const parsed = applyLeaveSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    const { leaveType, startDate: startStr, endDate: endStr, reason } = parsed.data;

    const startDate = new Date(startStr);
    const endDate = new Date(endStr);

    // Validate date range
    if (endDate < startDate) {
      return errorResponse("End date must be on or after start date");
    }

    // Calculate working days
    const durationDays = countWorkingDays(startDate, endDate);
    if (durationDays === 0) {
      return errorResponse("Leave must include at least one working day");
    }

    // Determine advance vs emergency
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysInAdvance = Math.floor(
      (startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    const isAdvance = daysInAdvance >= 7;
    const isEmergency = !isAdvance;

    // Calculate scoring impact
    let scoringImpact = 0;
    if (isEmergency) {
      scoringImpact = durationDays > 2 ? -2.0 : -1.0;
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        userId: session.user.id,
        leaveType,
        startDate,
        endDate,
        reason: reason ?? null,
        durationDays,
        isAdvance,
        isEmergency,
        scoringImpact,
        status: LeaveStatus.PENDING,
        proofStatus: ProofStatus.NOT_REQUIRED,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
    });

    return successResponse(leave, "Leave request submitted successfully");
  } catch (err) {
    console.error("[LEAVES-CREATE]", err);
    return errorResponse("Failed to create leave request", 500);
  }
}
