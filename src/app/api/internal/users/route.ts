import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateInternalKey } from "@/lib/internal-auth";

// GET /api/internal/users — list all active employees with salary structure
export async function GET(req: NextRequest) {
  const authError = validateInternalKey(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId") || undefined;

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { not: "SUPER_ADMIN" },
      ...(companyId ? { companyId } : {}),
    },
    include: {
      salaryStructure: true,
      company: { select: { name: true } },
    },
    orderBy: { firstName: "asc" },
  });

  const employees = users.map((u) => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`,
    email: u.email,
    designation: u.designation || "",
    department: u.department || "",
    phone: u.phone || "",
    branch: u.company.name,
    employee_code: u.employeeCode,
    date_of_joining: u.dateOfJoining ?? null,
    status: u.isActive ? "Active" : "Inactive",
    basic_salary: u.salaryStructure?.basic ?? 0,
    hra: u.salaryStructure?.hra ?? 0,
    special_allowance: u.salaryStructure?.specialAllow ?? 0,
  }));

  return NextResponse.json({ employees });
}

// POST /api/internal/users — create a new employee + salary structure
export async function POST(req: NextRequest) {
  const authError = validateInternalKey(req);
  if (authError) return authError;

  const body = await req.json();
  const {
    name, email, designation, department, phone, branch,
    date_of_joining, basic_salary, hra, special_allowance, companyId,
  } = body;

  if (!name || !email || !companyId) {
    return NextResponse.json({ error: "name, email, and companyId are required" }, { status: 400 });
  }

  // Derive firstName/lastName from name
  const parts = String(name).trim().split(" ");
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ") || "-";

  // Generate a unique employee code
  const count = await prisma.user.count({ where: { companyId } });
  const employeeCode = `EMP${String(count + 1).padStart(3, "0")}`;

  // Default password = Email@1234
  const bcrypt = await import("bcryptjs");
  const password = await bcrypt.hash("Employee@1234", 12);

  const user = await prisma.user.create({
    data: {
      companyId,
      email,
      password,
      firstName,
      lastName,
      employeeCode,
      designation: designation || "",
      department: department || "",
      phone: phone || undefined,
      dateOfJoining: date_of_joining ? new Date(date_of_joining) : undefined,
      role: "STAFF",
      workMode: "office",
    },
  });

  const gross = (basic_salary || 0) + (hra || 0) + (special_allowance || 0);
  const pf = Math.round((basic_salary || 0) * 0.12);
  const net = gross - pf;

  if (basic_salary || hra || special_allowance) {
    await prisma.salaryStructure.create({
      data: {
        userId: user.id,
        basic: Number(basic_salary) || 0,
        hra: Number(hra) || 0,
        specialAllow: Number(special_allowance) || 0,
        netSalary: net,
        effectiveFrom: new Date(),
      },
    });
  }

  return NextResponse.json({ success: true, employee: { id: user.id, name, email } });
}
