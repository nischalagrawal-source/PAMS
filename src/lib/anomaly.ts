import { prisma } from "./db";

export interface AnomalyItem {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  affectedUsers: string[];
  data?: Record<string, unknown>;
}

/**
 * Run all anomaly detection checks for a company on a given date
 */
export async function detectAnomalies(companyId: string, date: Date): Promise<AnomalyItem[]> {
  const anomalies: AnomalyItem[] = [];

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // 1. Simultaneous Absence Check
  const simultaneous = await checkSimultaneousAbsence(companyId, startOfDay);
  if (simultaneous) anomalies.push(simultaneous);

  // 2. Excessive Geo-fence Exits
  const geoExits = await checkExcessiveGeoExits(companyId, startOfDay, endOfDay);
  anomalies.push(...geoExits);

  // 3. Overdue Tasks Without Special Permission
  const overdueTasks = await checkOverdueTasks(companyId);
  anomalies.push(...overdueTasks);

  // 4. Frequent Emergency Leaves
  const emergencyLeaves = await checkFrequentEmergencyLeaves(companyId);
  anomalies.push(...emergencyLeaves);

  // 5. Low Attendance
  const lowAttendance = await checkLowAttendance(companyId);
  anomalies.push(...lowAttendance);

  // 6. Backlog Alerts
  const backlogs = await checkBacklogAlerts(companyId);
  anomalies.push(...backlogs);

  // 7. Frequent Late Arrivals
  const lateArrivals = await checkFrequentLateArrivals(companyId);
  anomalies.push(...lateArrivals);

  return anomalies;
}

/**
 * Check if 2+ staff are absent on the same day
 */
async function checkSimultaneousAbsence(companyId: string, date: Date): Promise<AnomalyItem | null> {
  const totalActive = await prisma.user.count({
    where: { companyId, isActive: true, role: { not: "SUPER_ADMIN" } },
  });

  const presentCount = await prisma.attendance.count({
    where: {
      user: { companyId },
      date,
    },
  });

  const absentCount = totalActive - presentCount;

  if (absentCount >= 2) {
    const onLeave = await prisma.leaveRequest.findMany({
      where: {
        user: { companyId },
        status: "APPROVED",
        startDate: { lte: date },
        endDate: { gte: date },
      },
      include: { user: { select: { firstName: true, lastName: true, employeeCode: true } } },
    });

    const names = onLeave.map((l) => `${l.user.firstName} ${l.user.lastName} (${l.user.employeeCode})`);

    return {
      type: "simultaneous_absence",
      severity: absentCount >= 3 ? "critical" : "high",
      title: "Simultaneous Staff Absence",
      description: `${absentCount} staff members absent today. ${names.length > 0 ? `On approved leave: ${names.join(", ")}` : "No approved leaves found — may be unplanned."}`,
      affectedUsers: onLeave.map((l) => l.userId),
      data: { absentCount, presentCount, totalActive },
    };
  }

  return null;
}

/**
 * Check for employees who left geo-fence more than 3 times in a day
 */
async function checkExcessiveGeoExits(companyId: string, startOfDay: Date, endOfDay: Date): Promise<AnomalyItem[]> {
  const records = await prisma.attendance.findMany({
    where: {
      user: { companyId },
      date: { gte: startOfDay, lte: endOfDay },
      geoExitCount: { gte: 3 },
    },
    include: { user: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
  });

  return records.map((r) => ({
    type: "excessive_geo_exits",
    severity: r.geoExitCount >= 5 ? "high" : "medium",
    title: "Excessive Geo-fence Exits",
    description: `${r.user.firstName} ${r.user.lastName} (${r.user.employeeCode}) left the geo-fence ${r.geoExitCount} times today.`,
    affectedUsers: [r.user.id],
    data: { geoExitCount: r.geoExitCount, userId: r.user.id },
  }));
}

/**
 * Check for tasks overdue more than 7 days without special permission
 */
async function checkOverdueTasks(companyId: string): Promise<AnomalyItem[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const overdue = await prisma.task.findMany({
    where: {
      assignedTo: { companyId },
      deadline: { lt: sevenDaysAgo },
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      specialPermission: false,
    },
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
    },
  });

  return overdue.map((t) => ({
    type: "overdue_task_no_permission",
    severity: "medium",
    title: "Overdue Task Without Permission",
    description: `Task "${t.title}" assigned to ${t.assignedTo.firstName} ${t.assignedTo.lastName} is ${Math.ceil((Date.now() - t.deadline.getTime()) / (1000 * 60 * 60 * 24))} days overdue without special permission.`,
    affectedUsers: [t.assignedTo.id],
    data: { taskId: t.id, title: t.title, deadline: t.deadline.toISOString() },
  }));
}

/**
 * Check for users with more than 2 emergency leaves in the current month
 */
async function checkFrequentEmergencyLeaves(companyId: string): Promise<AnomalyItem[]> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const users = await prisma.user.findMany({
    where: { companyId, isActive: true },
    select: { id: true, firstName: true, lastName: true, employeeCode: true },
  });

  const anomalies: AnomalyItem[] = [];

  for (const user of users) {
    const emergencyCount = await prisma.leaveRequest.count({
      where: {
        userId: user.id,
        isEmergency: true,
        status: { in: ["APPROVED", "PENDING"] },
        appliedOn: { gte: startOfMonth },
      },
    });

    if (emergencyCount > 2) {
      anomalies.push({
        type: "frequent_emergency_leaves",
        severity: "high",
        title: "Frequent Emergency Leaves",
        description: `${user.firstName} ${user.lastName} (${user.employeeCode}) has ${emergencyCount} emergency leaves this month (threshold: 2).`,
        affectedUsers: [user.id],
        data: { emergencyCount },
      });
    }
  }

  return anomalies;
}

/**
 * Check for users with less than 80% attendance in the current month
 */
async function checkLowAttendance(companyId: string): Promise<AnomalyItem[]> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const today = new Date();

  // Count working days so far this month
  let workingDays = 0;
  const current = new Date(startOfMonth);
  while (current <= today) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) workingDays++;
    current.setDate(current.getDate() + 1);
  }

  if (workingDays < 5) return []; // Too early in month

  const users = await prisma.user.findMany({
    where: { companyId, isActive: true, role: { not: "SUPER_ADMIN" } },
    select: { id: true, firstName: true, lastName: true, employeeCode: true },
  });

  const anomalies: AnomalyItem[] = [];

  for (const user of users) {
    const presentDays = await prisma.attendance.count({
      where: { userId: user.id, date: { gte: startOfMonth, lte: today } },
    });

    const rate = (presentDays / workingDays) * 100;

    if (rate < 80) {
      anomalies.push({
        type: "low_attendance",
        severity: rate < 60 ? "critical" : "high",
        title: "Low Attendance",
        description: `${user.firstName} ${user.lastName} (${user.employeeCode}) has ${Math.round(rate)}% attendance this month (${presentDays}/${workingDays} days). Threshold: 80%.`,
        affectedUsers: [user.id],
        data: { attendanceRate: Math.round(rate), presentDays, workingDays },
      });
    }
  }

  return anomalies;
}

/**
 * Check for users with significant task backlogs
 */
async function checkBacklogAlerts(companyId: string): Promise<AnomalyItem[]> {
  const users = await prisma.user.findMany({
    where: { companyId, isActive: true },
    select: { id: true, firstName: true, lastName: true, employeeCode: true },
  });

  const anomalies: AnomalyItem[] = [];

  for (const user of users) {
    const backlogTasks = await prisma.task.count({
      where: {
        assignedToId: user.id,
        deadline: { lt: new Date() },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
    });

    if (backlogTasks >= 3) {
      anomalies.push({
        type: "high_backlog",
        severity: backlogTasks >= 5 ? "critical" : "high",
        title: "High Task Backlog",
        description: `${user.firstName} ${user.lastName} (${user.employeeCode}) has ${backlogTasks} overdue tasks in their backlog.`,
        affectedUsers: [user.id],
        data: { backlogTasks },
      });
    }
  }

  return anomalies;
}

/**
 * Check for users with 3+ late arrivals this month (approaching half-day threshold)
 */
async function checkFrequentLateArrivals(companyId: string): Promise<AnomalyItem[]> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { lateThreshold: true },
  });
  const threshold = company?.lateThreshold ?? 3;

  const users = await prisma.user.findMany({
    where: { companyId, isActive: true, role: { not: "SUPER_ADMIN" } },
    select: { id: true, firstName: true, lastName: true, employeeCode: true },
  });

  const anomalies: AnomalyItem[] = [];

  for (const user of users) {
    const lateCount = await prisma.attendance.count({
      where: { userId: user.id, isLate: true, date: { gte: startOfMonth } },
    });

    const halfDayCount = await prisma.attendance.count({
      where: { userId: user.id, isHalfDay: true, date: { gte: startOfMonth } },
    });

    if (lateCount >= threshold) {
      anomalies.push({
        type: "frequent_late_arrivals",
        severity: halfDayCount > 0 ? "critical" : "high",
        title: "Frequent Late Arrivals",
        description: `${user.firstName} ${user.lastName} (${user.employeeCode}) has been late ${lateCount} times this month (threshold: ${threshold}). ${halfDayCount} marked as half-day.`,
        affectedUsers: [user.id],
        data: { lateCount, halfDayCount, threshold },
      });
    }
  }

  return anomalies;
}

/**
 * Generate the daily anomaly report for a company
 */
export async function generateDailyReport(companyId: string): Promise<{
  summary: string;
  anomalies: AnomalyItem[];
  reportId: string;
}> {
  const today = new Date();
  const anomalies = await detectAnomalies(companyId, today);

  const criticalCount = anomalies.filter((a) => a.severity === "critical").length;
  const highCount = anomalies.filter((a) => a.severity === "high").length;
  const mediumCount = anomalies.filter((a) => a.severity === "medium").length;

  const summary = anomalies.length === 0
    ? "No anomalies detected today. All systems normal."
    : `${anomalies.length} anomal${anomalies.length === 1 ? "y" : "ies"} detected: ${criticalCount} critical, ${highCount} high, ${mediumCount} medium severity.`;

  // Get recipients from anomaly rules
  const rules = await prisma.anomalyRule.findMany({
    where: { companyId, isActive: true },
    include: { recipients: { select: { email: true } } },
  });

  const recipientEmails = [...new Set(rules.flatMap((r) => r.recipients.map((u) => u.email)))];

  // Save the report
  const report = await prisma.anomalyReport.upsert({
    where: { companyId_date: { companyId, date: today } },
    update: {
      summary,
      details: JSON.parse(JSON.stringify(anomalies)),
      sentTo: recipientEmails,
      sentAt: new Date(),
    },
    create: {
      companyId,
      date: today,
      summary,
      details: JSON.parse(JSON.stringify(anomalies)),
      sentTo: recipientEmails,
      sentAt: new Date(),
    },
  });

  return { summary, anomalies, reportId: report.id };
}
