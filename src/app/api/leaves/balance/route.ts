import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
} from "@/lib/api-utils";
import { LeaveStatus } from "@/generated/prisma/client";

// ── GET  /api/leaves/balance — Get leave balance for current user ──

export async function GET(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    // Fetch active leave policies for the user's company
    const policies = await prisma.leavePolicy.findMany({
      where: {
        companyId: session.user.companyId,
        isActive: true,
      },
    });

    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);

    // For each policy, calculate used days this year
    const balances = await Promise.all(
      policies.map(async (policy) => {
        const usedResult = await prisma.leaveRequest.aggregate({
          where: {
            userId: session.user.id,
            leaveType: policy.leaveType,
            status: LeaveStatus.APPROVED,
            startDate: { gte: yearStart },
            endDate: { lte: yearEnd },
          },
          _sum: { durationDays: true },
        });

        const usedDays = usedResult._sum.durationDays ?? 0;

        return {
          leaveType: policy.leaveType,
          maxDays: policy.maxDaysPerYear,
          usedDays,
          remainingDays: Math.max(0, policy.maxDaysPerYear - usedDays),
          policy: {
            id: policy.id,
            advanceNoticeDays: policy.advanceNoticeDays,
            emergencyPenaltyWeight: policy.emergencyPenaltyWeight,
            longEmergencyDays: policy.longEmergencyDays,
            longEmergencyPenaltyWeight: policy.longEmergencyPenaltyWeight,
          },
        };
      })
    );

    return successResponse(balances);
  } catch (err) {
    console.error("[LEAVE-BALANCE]", err);
    return errorResponse("Failed to fetch leave balance", 500);
  }
}
