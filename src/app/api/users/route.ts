import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionOrFail, errorResponse, successResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role");

    const users = await prisma.user.findMany({
      where: {
        companyId: session!.user.companyId,
        isActive: true,
        ...(role ? { role: role as never } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        email: true,
        role: true,
        designation: true,
        department: true,
        workMode: true,
      },
      orderBy: { firstName: "asc" },
    });

    return successResponse(users);
  } catch (err) {
    return errorResponse("Failed to fetch users", 500);
  }
}
