import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  checkPermission,
  errorResponse,
  successResponse,
} from "@/lib/api-utils";

/**
 * DELETE /api/admin/user-shifts/[id]
 * Remove a user's shift override (they revert to company defaults)
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

    const existing = await prisma.userShift.findFirst({
      where: { id, user: { companyId } },
    });
    if (!existing) return errorResponse("Shift override not found", 404);

    await prisma.userShift.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/admin/user-shifts/[id]]", err);
    return errorResponse("Failed to delete shift override", 500);
  }
}
