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
  LeaveStatus,
  ProofStatus,
} from "@/generated/prisma/client";

// ── validation ───────────────────────────────────────────────

const updateLeaveSchema = z.object({
  status: z
    .enum([LeaveStatus.APPROVED, LeaveStatus.REJECTED, LeaveStatus.CANCELLED])
    .optional(),
  approvalNotes: z.string().optional(),
  proofStatus: z
    .enum([ProofStatus.APPROVED, ProofStatus.REJECTED])
    .optional(),
});

// ── GET  /api/leaves/[id] — Get a single leave request ───────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { id } = await params;

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            companyId: true,
          },
        },
        approvedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!leave) {
      return errorResponse("Leave request not found", 404);
    }

    // Tenant isolation: leave must belong to the same company
    if (leave.user.companyId !== session.user.companyId) {
      return errorResponse("Leave request not found", 404);
    }

    // STAFF can only view their own leaves
    if (
      session.user.role === UserRole.STAFF &&
      leave.userId !== session.user.id
    ) {
      return errorResponse("You can only view your own leave requests", 403);
    }

    return successResponse(leave);
  } catch (err) {
    console.error("[LEAVE-GET]", err);
    return errorResponse("Failed to fetch leave request", 500);
  }
}

// ── PUT  /api/leaves/[id] — Update leave (approve/reject/cancel/proof) ──

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

    const parsed = updateLeaveSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    const { status, approvalNotes, proofStatus } = parsed.data;

    // Fetch existing leave with user for company check
    const existing = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, companyId: true },
        },
      },
    });

    if (!existing) {
      return errorResponse("Leave request not found", 404);
    }

    // Tenant isolation
    if (existing.user.companyId !== session.user.companyId) {
      return errorResponse("Leave request not found", 404);
    }

    // Build update payload
    const updateData: Record<string, unknown> = {};

    // Handle status changes
    if (status) {
      if (
        status === LeaveStatus.APPROVED ||
        status === LeaveStatus.REJECTED
      ) {
        // Only REVIEWER, ADMIN, SUPER_ADMIN can approve/reject
        const allowedRoles: string[] = [
          UserRole.REVIEWER,
          UserRole.ADMIN,
          UserRole.SUPER_ADMIN,
        ];
        if (!allowedRoles.includes(session.user.role)) {
          return errorResponse(
            "Only reviewers and admins can approve or reject leaves",
            403
          );
        }
        updateData.status = status;
        updateData.approvedById = session.user.id;
      } else if (status === LeaveStatus.CANCELLED) {
        // Only the leave owner can cancel, and only if still PENDING
        if (existing.userId !== session.user.id) {
          return errorResponse("Only the leave owner can cancel", 403);
        }
        if (existing.status !== LeaveStatus.PENDING) {
          return errorResponse(
            "Only pending leave requests can be cancelled"
          );
        }
        updateData.status = LeaveStatus.CANCELLED;
      }
    }

    if (approvalNotes !== undefined) {
      updateData.approvalNotes = approvalNotes;
    }

    // Handle proof status update
    if (proofStatus) {
      updateData.proofStatus = proofStatus;

      // If proof is approved, neutralize the scoring penalty
      if (proofStatus === ProofStatus.APPROVED) {
        updateData.scoringImpact = 0;
      }
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: updateData,
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
    });

    return successResponse(updated, "Leave request updated successfully");
  } catch (err) {
    console.error("[LEAVE-UPDATE]", err);
    return errorResponse("Failed to update leave request", 500);
  }
}
