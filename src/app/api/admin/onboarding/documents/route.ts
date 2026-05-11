import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionOrFail, errorResponse, successResponse } from "@/lib/api-utils";

/**
 * GET /api/admin/onboarding/documents?userId=...
 * List all onboarding documents for an employee.
 */
export async function GET(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return errorResponse("Forbidden — admin only", 403);
    }

    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) return errorResponse("userId query param is required");

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });
    if (!targetUser) return errorResponse("User not found", 404);
    if (role === "ADMIN" && targetUser.companyId !== session.user.companyId) {
      return errorResponse("Forbidden", 403);
    }

    const docs = await prisma.onboardingDocument.findMany({
      where: { userId },
      orderBy: { uploadedAt: "asc" },
    });

    return successResponse(docs);
  } catch (err) {
    console.error("[GET /api/admin/onboarding/documents]", err);
    return errorResponse("Failed to fetch documents", 500);
  }
}
