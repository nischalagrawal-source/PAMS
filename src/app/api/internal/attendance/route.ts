import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateInternalKey } from "@/lib/internal-auth";

function formatTime(dt: Date | null | undefined): string {
  if (!dt) return "";
  return dt.toTimeString().slice(0, 5); // "HH:MM"
}

function deriveStatus(att: { checkInTime: Date | null; isHalfDay: boolean }): string {
  if (!att.checkInTime) return "Absent";
  if (att.isHalfDay) return "Half Day";
  return "Present";
}

// GET /api/internal/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD&companyId=
export async function GET(req: NextRequest) {
  const authError = validateInternalKey(req);
  if (authError) return authError;

  try {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const companyId = searchParams.get("companyId") || undefined;

  const records = await prisma.attendance.findMany({
    where: {
      ...(from ? { date: { gte: new Date(from) } } : {}),
      ...(to ? { date: { lte: new Date(to) } } : {}),
      user: { isActive: true, ...(companyId ? { companyId } : {}) },
    },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: [{ date: "desc" }, { user: { firstName: "asc" } }],
    take: 500,
  });

  const mapped = records.map((r) => ({
    id: r.id,
    employee_id: r.userId,
    employee_name: `${r.user.firstName} ${r.user.lastName}`,
    date: r.date,
    in_time: formatTime(r.checkInTime),
    out_time: formatTime(r.checkOutTime),
    total_hours: r.totalHours ?? 0,
    status: deriveStatus(r),
    overtime: r.overtimeHours ?? 0,
  }));

  return NextResponse.json({ records: mapped });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/internal/attendance — bulk create attendance records
export async function POST(req: NextRequest) {
  const authError = validateInternalKey(req);
  if (authError) return authError;

  const body = await req.json();
  const entries: Array<{
    employee_id: string;
    date: string;
    status: string;
    in_time?: string;
    out_time?: string;
  }> = Array.isArray(body) ? body : body.records || [];

  let created = 0;
  let skipped = 0;

  for (const entry of entries) {
    const dateVal = new Date(entry.date);
    const isAbsent = entry.status === "Absent" || entry.status === "Leave";

    // Parse HH:MM times into full DateTime on the same date
    let checkInTime: Date | undefined;
    let checkOutTime: Date | undefined;
    if (!isAbsent && entry.in_time) {
      const [h, m] = entry.in_time.split(":").map(Number);
      checkInTime = new Date(dateVal);
      checkInTime.setHours(h, m, 0, 0);
    }
    if (!isAbsent && entry.out_time) {
      const [h, m] = entry.out_time.split(":").map(Number);
      checkOutTime = new Date(dateVal);
      checkOutTime.setHours(h, m, 0, 0);
    }

    const totalHours =
      checkInTime && checkOutTime
        ? Math.round(((checkOutTime.getTime() - checkInTime.getTime()) / 3600000) * 10) / 10
        : 0;

    try {
      await prisma.attendance.upsert({
        where: { userId_date: { userId: entry.employee_id, date: dateVal } },
        update: {
          checkInTime: checkInTime ?? null,
          checkOutTime: checkOutTime ?? null,
          totalHours,
          isHalfDay: entry.status === "Half Day",
          locationType: "OFFICE",
        },
        create: {
          userId: entry.employee_id,
          date: dateVal,
          checkInTime: checkInTime ?? null,
          checkOutTime: checkOutTime ?? null,
          totalHours,
          isHalfDay: entry.status === "Half Day",
          locationType: "OFFICE",
        },
      });
      created++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ success: true, created, skipped });
}
