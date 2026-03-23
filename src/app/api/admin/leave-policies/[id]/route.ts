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

const updateLeavePolicySchema = z.object({
  maxDaysPerYear: z.number().min(1).max(365).optional(),
  advanceNoticeDays: z.number().min(0).max(365).optional(),
  emergencyPenaltyWeight: z.number().min(0).optional(),
  longEmergencyDays: z.number().min(1).optional(),
  longEmergencyPenaltyWeight: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

/**
 * PUT /api/admin/leave-policies/[id]
 * Update a leave policy
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session, "admin_leave_policies", "canEdit")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session.user.companyId;
    const body = await parseBody(req);
    if (!body) {
      return errorResponse("Invalid request body");
    }

    const parsed = updateLeavePolicySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    // Verify policy belongs to this company
    const policy = await prisma.leavePolicy.findFirst({
      where: { id, companyId },
    });

    if (!policy) {
      return errorResponse("Policy not found", 404);
    }

    const updated = await prisma.leavePolicy.update({
      where: { id },
      data: parsed.data,
    });

    return successResponse(updated);
  } catch (err) {
    console.error("[PUT /api/admin/leave-policies/[id]]", err);
    return errorResponse("Failed to update leave policy", 500);
  }
}

/**
 * DELETE /api/admin/leave-policies/[id]
 * Delete a leave policy
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session, "admin_leave_policies", "canDelete")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session.user.companyId;

    // Verify policy belongs to this company
    const policy = await prisma.leavePolicy.findFirst({
      where: { id, companyId },
    });

    if (!policy) {
      return errorResponse("Policy not found", 404);
    }

    await prisma.leavePolicy.delete({
      where: { id },
    });

    return successResponse({ message: "Policy deleted successfully" });
  } catch (err) {
    console.error("[DELETE /api/admin/leave-policies/[id]]", err);
    return errorResponse("Failed to delete leave policy", 500);
  }
}
