import { prisma } from "./db";
import { BONUS_TIERS } from "./constants";

/**
 * Calculate the bonus percentage from a total score (0-100)
 * Uses exponential curve — top tiers are extremely hard to reach
 */
export function calculateBonusPercentage(totalScore: number): {
  bonusPercentage: number;
  tier: string;
  tierColor: string;
} {
  const clamped = Math.max(0, Math.min(100, totalScore));

  for (const t of BONUS_TIERS) {
    if (clamped >= t.minScore && clamped <= t.maxScore) {
      const rangeScore = t.maxScore - t.minScore;
      const rangeBonus = t.maxBonus - t.minBonus;
      const position = rangeScore > 0 ? (clamped - t.minScore) / rangeScore : 0;
      const bonusPercentage = Math.round(t.minBonus + position * rangeBonus);
      return { bonusPercentage, tier: t.tier, tierColor: t.color };
    }
  }

  return { bonusPercentage: 25, tier: "Minimum", tierColor: "#ef4444" };
}

/**
 * Calculate a normalized score (0-100) for a single performance parameter
 * based on raw data from attendance, tasks, and leaves modules
 */
export async function calculateParameterScore(
  userId: string,
  companyId: string,
  paramName: string,
  paramFormula: string,
  period: string // "2026-02"
): Promise<{ rawValue: number; normalizedScore: number }> {
  const [yearStr, monthStr] = period.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  switch (paramName) {
    case "Task Completion Speed": {
      const tasks = await prisma.task.findMany({
        where: {
          assignedToId: userId,
          status: "COMPLETED",
          completedAt: { gte: startOfMonth, lte: endOfMonth },
        },
        select: { speedScore: true },
      });
      if (tasks.length === 0) return { rawValue: 0, normalizedScore: 50 };
      const avg = tasks.reduce((sum, t) => sum + (t.speedScore ?? 0), 0) / tasks.length;
      return { rawValue: Math.round(avg * 100) / 100, normalizedScore: Math.round(avg) };
    }

    case "Attendance Consistency": {
      const totalDays = await prisma.attendance.count({
        where: { userId, date: { gte: startOfMonth, lte: endOfMonth } },
      });
      const workingDaysInMonth = countWorkingDaysInMonth(year, month);
      const rate = workingDaysInMonth > 0 ? (totalDays / workingDaysInMonth) * 100 : 0;
      return { rawValue: Math.round(rate * 100) / 100, normalizedScore: Math.min(100, Math.round(rate)) };
    }

    case "Health/Sickness Frequency": {
      const sickLeaves = await prisma.leaveRequest.count({
        where: {
          userId,
          leaveType: "SICK",
          status: "APPROVED",
          startDate: { gte: startOfMonth, lte: endOfMonth },
        },
      });
      // Lower is better: 0 sick leaves = 100, each sick leave deducts 20
      const score = Math.max(0, 100 - sickLeaves * 20);
      return { rawValue: sickLeaves, normalizedScore: score };
    }

    case "Simultaneous Absence": {
      // This is a company-wide metric applied equally — check how many times
      // 2+ staff were absent on the same day in the last 3 months
      const threeMonthsAgo = new Date(year, month - 4, 1);
      const absenceDays = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
        `SELECT COUNT(*) as cnt FROM (
          SELECT date FROM attendance
          WHERE "userId" IN (SELECT id FROM users WHERE "companyId" = $1)
          AND date >= $2 AND date <= $3
          GROUP BY date
          HAVING COUNT(DISTINCT "userId") < (
            SELECT COUNT(*) FROM users WHERE "companyId" = $1 AND "isActive" = true
          ) - 1
        ) sub`,
        companyId, threeMonthsAgo, endOfMonth
      ).catch(() => [{ cnt: BigInt(0) }]);

      const violations = Number(absenceDays[0]?.cnt ?? 0);
      const score = Math.max(0, 100 - violations * 15);
      return { rawValue: violations, normalizedScore: score };
    }

    case "Overtime & Extra Effort": {
      const attendance = await prisma.attendance.findMany({
        where: { userId, date: { gte: startOfMonth, lte: endOfMonth } },
        select: { overtimeHours: true },
      });
      const totalOvertime = attendance.reduce((sum, a) => sum + (a.overtimeHours ?? 0), 0);
      // Normalize: 0 overtime = 30 base, each hour adds ~3.5 points up to 100
      const score = Math.min(100, 30 + totalOvertime * 3.5);
      return { rawValue: Math.round(totalOvertime * 100) / 100, normalizedScore: Math.round(score) };
    }

    case "Work Accuracy": {
      const reviews = await prisma.taskReview.findMany({
        where: {
          task: {
            assignedToId: userId,
            completedAt: { gte: startOfMonth, lte: endOfMonth },
          },
        },
        select: { accuracyScore: true },
      });
      if (reviews.length === 0) return { rawValue: 0, normalizedScore: 50 };
      const avg = reviews.reduce((sum, r) => sum + r.accuracyScore, 0) / reviews.length;
      return { rawValue: Math.round(avg * 100) / 100, normalizedScore: Math.round(avg) };
    }

    case "Backlog Management": {
      const overdueTasks = await prisma.task.count({
        where: {
          assignedToId: userId,
          deadline: { lt: endOfMonth },
          status: { notIn: ["COMPLETED", "CANCELLED"] },
          createdAt: { lte: endOfMonth },
        },
      });
      const totalTasks = await prisma.task.count({
        where: {
          assignedToId: userId,
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      });
      // Lower backlog is better
      if (totalTasks === 0) return { rawValue: 0, normalizedScore: 70 };
      const backlogRate = (overdueTasks / totalTasks) * 100;
      const score = Math.max(0, 100 - backlogRate * 1.5);
      return { rawValue: overdueTasks, normalizedScore: Math.round(score) };
    }

    case "Leave Discipline": {
      const leaves = await prisma.leaveRequest.findMany({
        where: {
          userId,
          status: { in: ["APPROVED", "PENDING"] },
          startDate: { gte: startOfMonth, lte: endOfMonth },
        },
        select: { isAdvance: true, isEmergency: true, scoringImpact: true },
      });
      if (leaves.length === 0) return { rawValue: 0, normalizedScore: 80 };
      const advanceCount = leaves.filter((l) => l.isAdvance).length;
      const emergencyCount = leaves.filter((l) => l.isEmergency).length;
      const totalImpact = leaves.reduce((sum, l) => sum + (l.scoringImpact ?? 0), 0);
      // More advance = good, less emergency = good
      const score = Math.max(0, Math.min(100, 80 + advanceCount * 5 + totalImpact * 10 - emergencyCount * 15));
      return { rawValue: emergencyCount, normalizedScore: Math.round(score) };
    }

    case "WFH Productivity": {
      const wfhTasks = await prisma.task.count({
        where: {
          assignedToId: userId,
          isWfhTask: true,
          status: "COMPLETED",
          completedAt: { gte: startOfMonth, lte: endOfMonth },
        },
      });
      const wfhDays = await prisma.attendance.count({
        where: { userId, isWfh: true, date: { gte: startOfMonth, lte: endOfMonth } },
      });
      if (wfhDays === 0) return { rawValue: 0, normalizedScore: 50 };
      const tasksPerDay = wfhTasks / wfhDays;
      const score = Math.min(100, tasksPerDay * 50);
      return { rawValue: Math.round(tasksPerDay * 100) / 100, normalizedScore: Math.round(score) };
    }

    case "Punctuality": {
      // Count late arrivals and half-days in the month
      const lateCount = await prisma.attendance.count({
        where: { userId, isLate: true, date: { gte: startOfMonth, lte: endOfMonth } },
      });
      const halfDayCount = await prisma.attendance.count({
        where: { userId, isHalfDay: true, date: { gte: startOfMonth, lte: endOfMonth } },
      });
      const totalAttendance = await prisma.attendance.count({
        where: { userId, date: { gte: startOfMonth, lte: endOfMonth } },
      });
      // Score: 100 for no late arrivals, each late deducts 10, each half-day deducts 20
      const punctualityScore = Math.max(0, 100 - lateCount * 10 - halfDayCount * 20);
      return { rawValue: lateCount + halfDayCount * 2, normalizedScore: punctualityScore };
    }

    default:
      return { rawValue: 0, normalizedScore: 50 };
  }
}

/**
 * Calculate all performance scores for a user in a given period
 */
export async function calculateUserPerformance(
  userId: string,
  companyId: string,
  period: string
): Promise<{
  scores: Array<{
    parameterId: string;
    parameterName: string;
    weight: number;
    rawValue: number;
    normalizedScore: number;
    weightedScore: number;
  }>;
  totalScore: number;
  bonusPercentage: number;
  tier: string;
  tierColor: string;
}> {
  const parameters = await prisma.perfParameter.findMany({
    where: { companyId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const scores = [];
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const param of parameters) {
    const { rawValue, normalizedScore } = await calculateParameterScore(
      userId, companyId, param.name, param.formula, period
    );
    const weightedScore = (normalizedScore * param.weight) / 100;
    totalWeightedScore += weightedScore;
    totalWeight += param.weight;

    scores.push({
      parameterId: param.id,
      parameterName: param.name,
      weight: param.weight,
      rawValue,
      normalizedScore,
      weightedScore: Math.round(weightedScore * 100) / 100,
    });
  }

  // Normalize if weights don't sum to exactly 100
  const totalScore = totalWeight > 0
    ? Math.round((totalWeightedScore / totalWeight) * 100 * 100) / 100
    : 0;

  const { bonusPercentage, tier, tierColor } = calculateBonusPercentage(totalScore);

  return { scores, totalScore, bonusPercentage, tier, tierColor };
}

/**
 * Count working days in a month
 */
function countWorkingDaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}
