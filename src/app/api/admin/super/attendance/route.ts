import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionOrFail, errorResponse, successResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;
    if (session.user.role !== "SUPER_ADMIN") return errorResponse("Forbidden", 403);

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const date = new Date(dateStr);

    // Get all companies
    const companies = await prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    // Get all users (staff) across companies
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { notIn: ["SUPER_ADMIN"] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        designation: true,
        companyId: true,
        company: { select: { name: true } },
      },
    });

    // Get attendance for the date
    const startOfDay = new Date(dateStr + "T00:00:00.000Z");
    const endOfDay = new Date(dateStr + "T23:59:59.999Z");
    const attendance = await prisma.attendance.findMany({
      where: { date: { gte: startOfDay, lte: endOfDay } },
      select: {
        userId: true,
        checkInTime: true,
        checkOutTime: true,
        status: true,
        isLate: true,
        lateByMinutes: true,
        totalHours: true,
      },
    });

    // Get leaves on this date
    const leaves = await prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: endOfDay },
        endDate: { gte: startOfDay },
      },
      select: { userId: true },
    });
    const onLeaveSet = new Set(leaves.map((l) => l.userId));

    // Build attendance map
    const attMap = new Map(attendance.map((a) => [a.userId, a]));

    // Build per-company summary
    const companyMap = new Map(companies.map((c) => ({ ...c, totalStaff: 0, presentToday: 0, onLeave: 0, lateToday: 0, absentUnexplained: 0 })).map((c) => [c.id, c]));
    users.forEach((u) => {
      const co = companyMap.get(u.companyId);
      if (!co) return;
      co.totalStaff++;
      if (attMap.has(u.id)) {
        co.presentToday++;
        if (attMap.get(u.id)!.isLate) co.lateToday++;
      } else if (onLeaveSet.has(u.id)) {
        co.onLeave++;
      } else {
        co.absentUnexplained++;
      }
    });

    const companyStats = Array.from(companyMap.values()).map((c) => ({
      companyId: c.id,
      companyName: c.name,
      totalStaff: c.totalStaff,
      presentToday: c.presentToday,
      onLeave: c.onLeave,
      lateToday: c.lateToday,
      absentUnexplained: c.absentUnexplained,
      attendancePercent: c.totalStaff > 0 ? Math.round((c.presentToday / c.totalStaff) * 100) : 0,
    }));

    // Build employee-level data (only those with attendance records)
    const fmt = (dt: Date | null) =>
      dt
        ? dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
        : null;

    const employees = users
      .filter((u) => attMap.has(u.id))
      .map((u) => {
        const att = attMap.get(u.id)!;
        return {
          userId: u.id,
          name: `${u.firstName} ${u.lastName}`,
          employeeCode: u.employeeCode,
          companyName: u.company.name,
          designation: u.designation,
          date: dateStr,
          checkIn: fmt(att.checkInTime),
          checkOut: fmt(att.checkOutTime),
          status: att.status,
          isLate: att.isLate,
          lateByMinutes: att.lateByMinutes,
          totalHours: att.totalHours,
        };
      });

    return successResponse({ companies: companyStats, employees });
  } catch (err) {
    console.error("[GET /api/admin/super/attendance]", err);
    return errorResponse("Failed to fetch attendance data", 500);
  }
}
