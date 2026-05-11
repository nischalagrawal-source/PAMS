import { prisma } from "@/lib/db";
import { getSessionOrFail, errorResponse, successResponse } from "@/lib/api-utils";

/**
 * GET /api/admin/companies/mine
 * Returns the current admin's company details (works for ADMIN and SUPER_ADMIN).
 */
export async function GET() {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session.user.companyId;
    if (!companyId) {
      return errorResponse("No company associated with this account", 400);
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        address: true,
        email: true,
        phone: true,
        inTime: true,
        outTime: true,
        graceMinutes: true,
        lateThreshold: true,
      },
    });

    if (!company) {
      return errorResponse("Company not found", 404);
    }

    return successResponse(company);
  } catch (err) {
    console.error("[GET /api/admin/companies/mine]", err);
    return errorResponse("Failed to fetch company", 500);
  }
}
