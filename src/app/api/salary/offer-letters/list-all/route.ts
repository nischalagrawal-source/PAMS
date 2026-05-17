import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionOrFail, errorResponse, successResponse } from "@/lib/api-utils";

// GET /api/salary/offer-letters/list-all
// Returns all generated offer letters for the company (admins only)

export async function GET(_req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return errorResponse("Forbidden", 403);
    }

    const letters = await prisma.offerLetter.findMany({
      where: {
        user: { companyId: session.user.companyId ?? undefined },
      },
      orderBy: { generatedAt: "desc" },
      include: {
        user: { select: { firstName: true, lastName: true, designation: true } },
        template: { select: { name: true } },
      },
      take: 100,
    });

    return successResponse(letters);
  } catch (err) {
    console.error("[GET /api/salary/offer-letters/list-all]", err);
    return errorResponse("Failed to fetch offer letters", 500);
  }
}
