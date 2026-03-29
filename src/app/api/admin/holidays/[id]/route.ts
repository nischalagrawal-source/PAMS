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

const updateHolidaySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  isOptional: z.boolean().optional(),
});

/**
 * PUT /api/admin/holidays/[id]
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session, "admin_company_settings", "canEdit")) {
      return errorResponse("Forbidden", 403);
    }

    const { id } = await params;
    const companyId = session.user.companyId;
    const body = await parseBody(req);
    if (!body) return errorResponse("Invalid request body");

    const parsed = updateHolidaySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    const existing = await prisma.holiday.findFirst({
      where: { id, companyId },
    });
    if (!existing) return errorResponse("Holiday not found", 404);

    const data: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.isOptional !== undefined) data.isOptional = parsed.data.isOptional;
    if (parsed.data.date !== undefined) data.date = new Date(parsed.data.date);

    const holiday = await prisma.holiday.update({
      where: { id },
      data,
    });

    return successResponse(holiday);
  } catch (err) {
    console.error("[PUT /api/admin/holidays/[id]]", err);
    return errorResponse("Failed to update holiday", 500);
  }
}

/**
 * DELETE /api/admin/holidays/[id]
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session, "admin_company_settings", "canDelete")) {
      return errorResponse("Forbidden", 403);
    }

    const { id } = await params;
    const companyId = session.user.companyId;

    const existing = await prisma.holiday.findFirst({
      where: { id, companyId },
    });
    if (!existing) return errorResponse("Holiday not found", 404);

    await prisma.holiday.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/admin/holidays/[id]]", err);
    return errorResponse("Failed to delete holiday", 500);
  }
}
