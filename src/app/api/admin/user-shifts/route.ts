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

const upsertShiftSchema = z.object({
  userId: z.string().min(1),
  inTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:mm format"),
  outTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:mm format"),
  graceMinutes: z.number().min(0).max(120).nullable().optional(),
  label: z.string().max(50).nullable().optional(),
});

/**
 * GET /api/admin/user-shifts
 * List all user shift overrides for the company
 */
export async function GET() {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session, "admin_company_settings", "canView")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session.user.companyId;
    const shifts = await prisma.userShift.findMany({
      where: { user: { companyId } },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true, designation: true },
        },
      },
      orderBy: { user: { firstName: "asc" } },
    });

    return successResponse(shifts);
  } catch (err) {
    console.error("[GET /api/admin/user-shifts]", err);
    return errorResponse("Failed to fetch user shifts", 500);
  }
}

/**
 * POST /api/admin/user-shifts
 * Create or update a user's shift override
 */
export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session, "admin_company_settings", "canEdit")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session.user.companyId;
    const body = await parseBody(req);
    if (!body) return errorResponse("Invalid request body");

    const parsed = upsertShiftSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    const { userId, inTime, outTime, graceMinutes, label } = parsed.data;

    // Verify user belongs to same company
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId },
    });
    if (!user) return errorResponse("User not found", 404);

    const shift = await prisma.userShift.upsert({
      where: { userId },
      create: { userId, inTime, outTime, graceMinutes: graceMinutes ?? null, label: label ?? null },
      update: { inTime, outTime, graceMinutes: graceMinutes ?? null, label: label ?? null },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true, designation: true },
        },
      },
    });

    return successResponse(shift);
  } catch (err) {
    console.error("[POST /api/admin/user-shifts]", err);
    return errorResponse("Failed to save user shift", 500);
  }
}
