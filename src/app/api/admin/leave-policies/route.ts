import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  checkPermission,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";

const createLeavePolicySchema = z.object({
  leaveType: z.enum(["SICK", "PERSONAL", "EMERGENCY"]),
  maxDaysPerYear: z.number().min(1).max(365),
  advanceNoticeDays: z.number().min(0).max(365).default(7),
  emergencyPenaltyWeight: z.number().min(0).default(1.0),
  longEmergencyDays: z.number().min(1).default(2),
  longEmergencyPenaltyWeight: z.number().min(0).default(2.0),
});

/**
 * GET /api/admin/leave-policies
 * List all leave policies for the company
 */
export async function GET() {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session, "admin_leave_policies", "canView")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session.user.companyId;
    const policies = await prisma.leavePolicy.findMany({
      where: { companyId },
      orderBy: { leaveType: "asc" },
    });

    return successResponse(policies);
  } catch (err) {
    console.error("[GET /api/admin/leave-policies]", err);
    return errorResponse("Failed to fetch leave policies", 500);
  }
}

/**
 * POST /api/admin/leave-policies
 * Create a new leave policy
 */
export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session, "admin_leave_policies", "canCreate")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session.user.companyId;
    const body = await parseBody(req);
    if (!body) {
      return errorResponse("Invalid request body");
    }

    const parsed = createLeavePolicySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    const { leaveType, maxDaysPerYear, advanceNoticeDays, emergencyPenaltyWeight, longEmergencyDays, longEmergencyPenaltyWeight } = parsed.data;

    // Check if policy already exists for this leave type
    const existing = await prisma.leavePolicy.findUnique({
      where: { companyId_leaveType: { companyId, leaveType: leaveType as any } },
    });

    if (existing) {
      return errorResponse("Policy already exists for this leave type", 400);
    }

    const policy = await prisma.leavePolicy.create({
      data: {
        companyId,
        leaveType: leaveType as any,
        maxDaysPerYear,
        advanceNoticeDays,
        emergencyPenaltyWeight,
        longEmergencyDays,
        longEmergencyPenaltyWeight,
      },
    });

    return successResponse(policy);
  } catch (err) {
    console.error("[POST /api/admin/leave-policies]", err);
    return errorResponse("Failed to create leave policy", 500);
  }
}
