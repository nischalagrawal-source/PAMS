import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";
import { z } from "zod";
import { ProofStatus } from "@/generated/prisma/client";

// ── validation ───────────────────────────────────────────────

const proofUploadSchema = z.object({
  proofUrl: z.string().min(1, "Proof URL is required"),
});

// ── POST  /api/leaves/[id]/proof — Upload proof for a leave ──

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { id } = await params;

    const body = await parseBody(req);
    if (!body) return errorResponse("Invalid request body");

    const parsed = proofUploadSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    const { proofUrl } = parsed.data;

    // Fetch the leave request
    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, companyId: true },
        },
      },
    });

    if (!leave) {
      return errorResponse("Leave request not found", 404);
    }

    // Tenant isolation
    if (leave.user.companyId !== session.user.companyId) {
      return errorResponse("Leave request not found", 404);
    }

    // Only the leave owner can upload proof
    if (leave.userId !== session.user.id) {
      return errorResponse("You can only upload proof for your own leave", 403);
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        proofUrl,
        proofStatus: ProofStatus.PENDING_REVIEW,
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

    return successResponse(updated, "Proof uploaded successfully");
  } catch (err) {
    console.error("[LEAVE-PROOF-UPLOAD]", err);
    return errorResponse("Failed to upload proof", 500);
  }
}
