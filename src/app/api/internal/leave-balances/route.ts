import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateInternalKey } from "@/lib/internal-auth";

/**
 * GET /api/internal/leave-balances?financial_year=YYYY-YY&companyId=
 * Returns leave balance summary for all active employees.
 * Calculates used/remaining leaves for the given financial year (Apr–Mar).
 */
export async function GET(req: NextRequest) {
  const authError = validateInternalKey(req);
  if (authError) return authError;

  try {
  const { searchParams } = new URL(req.url);
  const fy = searchParams.get("financial_year") || "";
  const companyId = searchParams.get("companyId") || undefined;

  // Parse FY string like "2025-26" → start Apr 2025, end Mar 2026
  let fyStart: Date;
  let fyEnd: Date;
  const fyMatch = fy.match(/^(\d{4})-(\d{2,4})$/);
  if (fyMatch) {
    const startYear = parseInt(fyMatch[1]);
    fyStart = new Date(`${startYear}-04-01`);
    fyEnd = new Date(`${startYear + 1}-03-31`);
  } else {
    // Default to current financial year
    const now = new Date();
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    fyStart = new Date(`${year}-04-01`);
    fyEnd = new Date(`${year + 1}-03-31`);
  }

  // Get leave policies for max days
  const policies = await prisma.leavePolicy.findMany({
    where: companyId ? { companyId } : {},
  });
  const policyMap: Record<string, number> = {};
  for (const p of policies) {
    policyMap[p.leaveType] = p.maxDaysPerYear;
  }
  const maxSick = policyMap["SICK"] ?? 12;
  const maxPersonal = policyMap["PERSONAL"] ?? 15;
  const maxEmergency = policyMap["EMERGENCY"] ?? 5;

  // Fetch all approved leaves in the FY for active employees
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: { gte: fyStart, lte: fyEnd },
      user: { isActive: true, ...(companyId ? { companyId } : {}) },
    },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });

  // Fetch all active employees
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { not: "SUPER_ADMIN" },
      ...(companyId ? { companyId } : {}),
    },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: "asc" },
  });

  // Aggregate leaves per employee per type
  const usageMap: Record<string, { SICK: number; PERSONAL: number; EMERGENCY: number }> = {};
  for (const leave of leaves) {
    const uid = leave.userId;
    if (!usageMap[uid]) usageMap[uid] = { SICK: 0, PERSONAL: 0, EMERGENCY: 0 };
    usageMap[uid][leave.leaveType] += leave.durationDays;
  }

  const balances = users.map((u) => {
    const used = usageMap[u.id] || { SICK: 0, PERSONAL: 0, EMERGENCY: 0 };
    const sickUsed = used.SICK;
    const personalUsed = used.PERSONAL;
    const emergencyUsed = used.EMERGENCY;
    const totalUsed = sickUsed + personalUsed + emergencyUsed;
    const totalMax = maxSick + maxPersonal + maxEmergency;

    return {
      employee_id: u.id,
      employee_name: `${u.firstName} ${u.lastName}`,
      sick_leave: Math.max(0, maxSick - sickUsed),       // SL remaining
      casual_leave: Math.max(0, maxPersonal - personalUsed), // CL remaining
      earned_leave: Math.max(0, maxEmergency - emergencyUsed), // EL remaining (mapped from EMERGENCY)
      used: totalUsed,
      available: Math.max(0, totalMax - totalUsed),
    };
  });

  return NextResponse.json({ balances });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
