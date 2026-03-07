import { NextResponse } from "next/server";
import { getSessionOrFail, successResponse, errorResponse } from "@/lib/api-utils";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, error } = await getSessionOrFail();
  if (error) return error;

  const userId = session.user.id!;
  const role = session.user.role!;
  const companyId = session.user.companyId;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAdminOrAbove = role === "SUPER_ADMIN" || role === "ADMIN";

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Company filter — SUPER_ADMIN sees all, others see their company
    const companyFilter = isSuperAdmin ? {} : { companyId: companyId! };

    // ──────────────────────────────────────
    // Run all queries in parallel
    // ──────────────────────────────────────
    const [
      totalStaff,
      activeStaff,
      presentToday,
      activeTasks,
      overdueTasks,
      tasksCompletedThisWeek,
      onLeaveToday,
      plannedLeaves,
      emergencyLeaves,
      overtimeHoursResult,
      anomalyCount,
      recentActivity,
      topPerformers,
    ] = await Promise.all([
      // Total staff
      prisma.user.count({ where: { ...companyFilter, role: { not: "SUPER_ADMIN" } } }),

      // Active staff
      prisma.user.count({ where: { ...companyFilter, isActive: true, role: { not: "SUPER_ADMIN" } } }),

      // Present today
      prisma.attendance.count({
        where: {
          date: today,
          user: companyFilter,
        },
      }),

      // Active tasks (ASSIGNED + IN_PROGRESS)
      prisma.task.count({
        where: {
          status: { in: ["ASSIGNED", "IN_PROGRESS"] },
          ...(isSuperAdmin ? {} : isAdminOrAbove
            ? { OR: [{ assignedTo: companyFilter }, { assignedBy: companyFilter }] }
            : { assignedToId: userId }),
        },
      }),

      // Overdue tasks
      prisma.task.count({
        where: {
          isOverdue: true,
          status: { in: ["ASSIGNED", "IN_PROGRESS"] },
          ...(isSuperAdmin ? {} : isAdminOrAbove
            ? { OR: [{ assignedTo: companyFilter }, { assignedBy: companyFilter }] }
            : { assignedToId: userId }),
        },
      }),

      // Tasks completed this week
      prisma.task.count({
        where: {
          status: "COMPLETED",
          completedAt: { gte: startOfWeek },
          ...(isSuperAdmin ? {} : isAdminOrAbove
            ? { OR: [{ assignedTo: companyFilter }, { assignedBy: companyFilter }] }
            : { assignedToId: userId }),
        },
      }),

      // On leave today (approved leaves covering today)
      prisma.leaveRequest.count({
        where: {
          status: "APPROVED",
          startDate: { lte: today },
          endDate: { gte: today },
          user: companyFilter,
        },
      }),

      // Planned leaves today
      prisma.leaveRequest.count({
        where: {
          status: "APPROVED",
          startDate: { lte: today },
          endDate: { gte: today },
          isAdvance: true,
          user: companyFilter,
        },
      }),

      // Emergency leaves today
      prisma.leaveRequest.count({
        where: {
          status: "APPROVED",
          startDate: { lte: today },
          endDate: { gte: today },
          isEmergency: true,
          user: companyFilter,
        },
      }),

      // Overtime hours this month
      prisma.attendance.aggregate({
        _sum: { overtimeHours: true },
        where: {
          date: { gte: startOfMonth },
          user: companyFilter,
        },
      }),

      // Anomaly reports count (this month)
      prisma.anomalyReport.count({
        where: {
          date: { gte: startOfMonth },
          ...(isSuperAdmin ? {} : { companyId: companyId! }),
        },
      }),

      // Recent activity — last 5 notifications for the user, or recent events for admins
      isAdminOrAbove
        ? prisma.notification.findMany({
            where: isSuperAdmin ? {} : { user: companyFilter },
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { user: { select: { firstName: true, lastName: true } } },
          })
        : prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 5,
          }),

      // Top performers — best weighted scores this period
      isAdminOrAbove
        ? prisma.perfScore.findMany({
            where: {
              user: companyFilter,
            },
            orderBy: { weightedScore: "desc" },
            take: 5,
            include: { user: { select: { firstName: true, lastName: true } }, parameter: { select: { name: true } } },
          })
        : Promise.resolve([]),
    ]);

    const overtimeHours = Math.round(overtimeHoursResult._sum.overtimeHours ?? 0);
    const attendancePercent = totalStaff > 0 ? Math.round((presentToday / activeStaff) * 100) : 0;

    // Build top performers with tier labels
    const performerList = topPerformers.map((p: any, i: number) => {
      const score = Math.round(p.weightedScore * 10); // normalize for display
      let tier = "Good";
      if (score >= 90) tier = "Excellent";
      else if (score >= 80) tier = "Very Good";
      else if (score >= 70) tier = "Good";
      else if (score >= 60) tier = "Average";
      else tier = "Below Average";
      return {
        name: `${p.user.firstName} ${p.user.lastName}`,
        score: p.normalizedScore,
        tier,
      };
    });

    // Format recent activity
    const activityList = recentActivity.map((n: any) => {
      const age = Date.now() - new Date(n.createdAt).getTime();
      let time = "";
      if (age < 60000) time = "Just now";
      else if (age < 3600000) time = `${Math.round(age / 60000)} min ago`;
      else if (age < 86400000) time = `${Math.round(age / 3600000)} hr ago`;
      else time = new Date(n.createdAt).toLocaleDateString();

      let type = "info";
      if (n.type?.includes("complet") || n.type?.includes("check")) type = "success";
      else if (n.type?.includes("anomal") || n.type?.includes("alert")) type = "warning";

      return {
        action: n.subject || n.type,
        detail: n.message?.substring(0, 60),
        time,
        type,
        user: n.user ? `${n.user.firstName} ${n.user.lastName}` : undefined,
      };
    });

    return successResponse({
      stats: {
        totalStaff,
        activeStaff,
        presentToday,
        attendancePercent,
        activeTasks,
        overdueTasks,
        tasksCompletedThisWeek,
        onLeaveToday,
        plannedLeaves,
        emergencyLeaves,
        overtimeHours,
        anomalyCount,
      },
      recentActivity: activityList,
      topPerformers: performerList,
    });
  } catch (err: any) {
    console.error("Dashboard stats error:", err);
    return errorResponse("Failed to fetch dashboard stats", 500);
  }
}
