import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateInternalKey } from "@/lib/internal-auth";

const LEAVE_TYPE_MAP: Record<string, "SICK" | "PERSONAL" | "EMERGENCY"> = {
  SL: "SICK",
  CL: "PERSONAL",
  EL: "EMERGENCY",
};

const LEAVE_TYPE_REVERSE: Record<string, string> = {
  SICK: "SL",
  PERSONAL: "CL",
  EMERGENCY: "EL",
};

function mapStatus(s: string): string {
  // PENDING → Pending, APPROVED → Approved, etc.
  return s.charAt(0) + s.slice(1).toLowerCase();
}

// GET /api/internal/leaves?companyId=
export async function GET(req: NextRequest) {
  const authError = validateInternalKey(req);
  if (authError) return authError;

  try {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId") || undefined;

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      user: { isActive: true, ...(companyId ? { companyId } : {}) },
    },
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { appliedOn: "desc" },
    take: 200,
  });

  const requests = leaves.map((l) => ({
    id: l.id,
    employee_id: l.userId,
    employee_name: `${l.user.firstName} ${l.user.lastName}`,
    leave_type: LEAVE_TYPE_REVERSE[l.leaveType] || "CL",
    from_date: l.startDate,
    to_date: l.endDate,
    days: l.durationDays,
    status: mapStatus(l.status),
    reason: l.reason || "",
  }));

  return NextResponse.json({ requests });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/internal/leaves — create a new leave request
export async function POST(req: NextRequest) {
  const authError = validateInternalKey(req);
  if (authError) return authError;

  const body = await req.json();
  const { employee_id, leave_type, from_date, to_date, reason, days } = body;

  if (!employee_id || !from_date || !to_date) {
    return NextResponse.json({ error: "employee_id, from_date, to_date are required" }, { status: 400 });
  }

  const leaveType = LEAVE_TYPE_MAP[leave_type] || "PERSONAL";
  const startDate = new Date(from_date);
  const endDate = new Date(to_date);
  const durationDays =
    days ??
    Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const leave = await prisma.leaveRequest.create({
    data: {
      userId: employee_id,
      leaveType,
      startDate,
      endDate,
      reason: reason || "",
      durationDays,
      isEmergency: leaveType === "EMERGENCY",
    },
  });

  return NextResponse.json({ success: true, id: leave.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
