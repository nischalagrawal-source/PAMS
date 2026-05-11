import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { validateInternalKey } from "@/lib/internal-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authError = validateInternalKey(req);
  if (authError) return authError;

  const body = await req.json().catch(() => ({}));
  const email = (body.email as string) || "superadmin@pams.com";
  const password = (body.password as string) || "Admin@123";

  const hashed = await bcrypt.hash(password, 12);

  // Find first company to attach to if creating fresh
  const company = await prisma.company.findFirst();
  if (!company) return errorResponse("No company found in DB", 400);

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashed, isActive: true, role: "SUPER_ADMIN" },
    create: {
      email,
      password: hashed,
      firstName: "Super",
      lastName: "Admin",
      employeeCode: "SA001",
      role: "SUPER_ADMIN",
      companyId: company.id,
      designation: "System Administrator",
      department: "IT",
      dateOfJoining: new Date("2024-01-01"),
      workMode: "office",
      isActive: true,
    },
    select: { id: true, email: true, role: true, isActive: true },
  });

  return successResponse({ user, passwordSet: password });
}
