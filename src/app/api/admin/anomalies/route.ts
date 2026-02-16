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

const createRuleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  condition: z.string().min(1, "Condition is required"),
  severity: z.enum(["low", "medium", "high", "critical"]),
  recipientIds: z.array(z.string()).optional(),
});

// ── GET  /api/admin/anomalies — List anomaly rules ────────────────

export async function GET(_req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session!, "admin_anomalies", "canView")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session!.user.companyId;

    const rules = await prisma.anomalyRule.findMany({
      where: { companyId },
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
      orderBy: { createdAt: "desc" },
    });

    return successResponse(rules);
  } catch (err) {
    console.error("[ADMIN-ANOMALY-RULES-LIST]", err);
    return errorResponse("Failed to fetch anomaly rules", 500);
  }
}

// ── POST  /api/admin/anomalies — Create anomaly rule ──────────────

export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session!, "admin_anomalies", "canCreate")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session!.user.companyId;

    const body = await parseBody<unknown>(req);
    if (!body) return errorResponse("Invalid request body");

    const parsed = createRuleSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return errorResponse(msg || "Validation failed");
    }

    const { name, condition, severity, recipientIds } = parsed.data;

    const rule = await prisma.anomalyRule.create({
      data: {
        companyId,
        name,
        condition,
        severity,
        ...(recipientIds && recipientIds.length > 0
          ? { recipients: { connect: recipientIds.map((id) => ({ id })) } }
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

    return successResponse(rule, "Anomaly rule created successfully");
  } catch (err) {
    console.error("[ADMIN-ANOMALY-RULES-CREATE]", err);
    return errorResponse("Failed to create anomaly rule", 500);
  }
}
