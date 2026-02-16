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

// ── validation ────────────────────────────────────────────────────

const updateRuleSchema = z.object({
  name: z.string().min(1).optional(),
  condition: z.string().min(1).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  isActive: z.boolean().optional(),
  recipientIds: z.array(z.string()).optional(),
});

// ── PUT  /api/admin/anomalies/[id] — Update anomaly rule ──────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session!, "admin_anomalies", "canEdit")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session!.user.companyId;

    const existing = await prisma.anomalyRule.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return errorResponse("Anomaly rule not found", 404);
    }

    const body = await parseBody<unknown>(req);
    if (!body) return errorResponse("Invalid request body");

    const parsed = updateRuleSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return errorResponse(msg || "Validation failed");
    }

    const { recipientIds, ...data } = parsed.data;

    const rule = await prisma.anomalyRule.update({
      where: { id },
      data: {
        ...data,
        ...(recipientIds !== undefined
          ? { recipients: { set: recipientIds.map((rid) => ({ id: rid })) } }
          : {}),
      },
      include: {
        recipients: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return successResponse(rule, "Anomaly rule updated successfully");
  } catch (err) {
    console.error("[PUT /api/admin/anomalies/[id]]", err);
    return errorResponse("Failed to update anomaly rule", 500);
  }
}

// ── DELETE  /api/admin/anomalies/[id] — Delete anomaly rule ───────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session!, "admin_anomalies", "canDelete")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session!.user.companyId;

    const existing = await prisma.anomalyRule.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return errorResponse("Anomaly rule not found", 404);
    }

    await prisma.anomalyRule.delete({
      where: { id },
    });

    return successResponse(null, "Anomaly rule deleted successfully");
  } catch (err) {
    console.error("[DELETE /api/admin/anomalies/[id]]", err);
    return errorResponse("Failed to delete anomaly rule", 500);
  }
}
