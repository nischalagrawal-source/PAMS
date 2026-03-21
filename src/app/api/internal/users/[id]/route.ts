import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateInternalKey } from "@/lib/internal-auth";

// PUT /api/internal/users/[id] — update employee details + salary structure
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateInternalKey(req);
  if (authError) return authError;

  const { id } = await params;
  const body = await req.json();
  const {
    name, email, designation, department, phone,
    date_of_joining, basic_salary, hra, special_allowance, status,
  } = body;

  const parts = name ? String(name).trim().split(" ") : [];
  const updateData: Record<string, unknown> = {};
  if (parts.length > 0) {
    updateData.firstName = parts[0];
    updateData.lastName = parts.slice(1).join(" ") || "-";
  }
  if (email) updateData.email = email;
  if (designation !== undefined) updateData.designation = designation;
  if (department !== undefined) updateData.department = department;
  if (phone !== undefined) updateData.phone = phone;
  if (date_of_joining) updateData.dateOfJoining = new Date(date_of_joining);
  if (status !== undefined) updateData.isActive = status === "Active";

  await prisma.user.update({ where: { id }, data: updateData });

  // Upsert salary structure
  if (basic_salary !== undefined || hra !== undefined || special_allowance !== undefined) {
    const basic = Number(basic_salary) || 0;
    const hraVal = Number(hra) || 0;
    const specialAllow = Number(special_allowance) || 0;
    const gross = basic + hraVal + specialAllow;
    const pf = Math.round(basic * 0.12);
    const net = gross - pf;

    await prisma.salaryStructure.upsert({
      where: { userId: id },
      update: { basic, hra: hraVal, specialAllow, netSalary: net },
      create: {
        userId: id,
        basic,
        hra: hraVal,
        specialAllow,
        netSalary: net,
        effectiveFrom: new Date(),
      },
    });
  }

  return NextResponse.json({ success: true });
}
