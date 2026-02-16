import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
} from "@/lib/api-utils";
import {
  calculateUserPerformance,
  calculateBonusPercentage,
} from "@/lib/performance";

/**
 * GET /api/performance
 * Get performance scores/rankings for a period.
 * Query params:
 *   - period: "YYYY-MM" (default: current month)
 *   - userId: optional — if provided, return that user's detailed scores
 */
export async function GET(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const now = new Date();
    const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const period = searchParams.get("period") || defaultPeriod;
    const userId = searchParams.get("userId");
    const companyId = session!.user.companyId;
    const role = session!.user.role;

    if (userId) {
      // Single user detail — STAFF can only see their own
      if (role === "STAFF" && userId !== session!.user.id) {
        return errorResponse("You can only view your own performance", 403);
      }

      const user = await prisma.user.findFirst({
        where: { id: userId, companyId },
        select: { id: true, firstName: true, lastName: true, employeeCode: true },
      });

      if (!user) {
        return errorResponse("User not found", 404);
      }

      const result = await getOrCalculateUserPerformance(userId, companyId, period);

      return successResponse({
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        employeeCode: user.employeeCode,
        ...result,
      });
    }

    // All users — only REVIEWER/ADMIN/SUPER_ADMIN can see rankings
    if (role === "STAFF") {
      return errorResponse("Only reviewers and admins can view rankings", 403);
    }

    const users = await prisma.user.findMany({
      where: { companyId, isActive: true },
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
      orderBy: { firstName: "asc" },
    });

    const rankings = await Promise.all(
      users.map(async (user) => {
        const result = await getOrCalculateUserPerformance(user.id, companyId, period);
        return {
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`,
          employeeCode: user.employeeCode,
          ...result,
        };
      })
    );

    // Sort by totalScore descending
    rankings.sort((a, b) => b.totalScore - a.totalScore);

    return successResponse(rankings);
  } catch (err) {
    console.error("[GET /api/performance]", err);
    return errorResponse("Failed to fetch performance data", 500);
  }
}

/**
 * POST /api/performance
 * Trigger score calculation for all users in a period.
 * Only ADMIN/SUPER_ADMIN.
 * Query params: period (required, "YYYY-MM")
 */
export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const role = session!.user.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return errorResponse("Only admins can trigger score calculation", 403);
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period");

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return errorResponse("Valid period is required (YYYY-MM)");
    }

    const companyId = session!.user.companyId;

    const users = await prisma.user.findMany({
      where: { companyId, isActive: true },
      select: { id: true },
    });

    let calculated = 0;

    for (const user of users) {
      const result = await calculateUserPerformance(user.id, companyId, period);

      // Upsert PerfScore for each parameter
      for (const score of result.scores) {
        await prisma.perfScore.upsert({
          where: {
            userId_parameterId_period: {
              userId: user.id,
              parameterId: score.parameterId,
              period,
            },
          },
          update: {
            rawValue: score.rawValue,
            normalizedScore: score.normalizedScore,
            weightedScore: score.weightedScore,
          },
          create: {
            userId: user.id,
            parameterId: score.parameterId,
            period,
            rawValue: score.rawValue,
            normalizedScore: score.normalizedScore,
            weightedScore: score.weightedScore,
          },
        });
      }

      // Upsert BonusCalculation
      await prisma.bonusCalculation.upsert({
        where: {
          userId_period: {
            userId: user.id,
            period,
          },
        },
        update: {
          totalScore: result.totalScore,
          bonusPercentage: result.bonusPercentage,
          tier: result.tier,
          breakdown: JSON.parse(JSON.stringify(result.scores)),
        },
        create: {
          userId: user.id,
          period,
          totalScore: result.totalScore,
          bonusPercentage: result.bonusPercentage,
          tier: result.tier,
          breakdown: JSON.parse(JSON.stringify(result.scores)),
        },
      });

      calculated++;
    }

    return successResponse({ calculated, period });
  } catch (err) {
    console.error("[POST /api/performance]", err);
    return errorResponse("Failed to calculate performance scores", 500);
  }
}

/**
 * Helper: Check if PerfScore records exist for the period; if so return them,
 * otherwise calculate fresh using calculateUserPerformance().
 */
async function getOrCalculateUserPerformance(
  userId: string,
  companyId: string,
  period: string
) {
  // Try loading stored scores
  const existingScores = await prisma.perfScore.findMany({
    where: { userId, period },
    include: { parameter: { select: { name: true, weight: true } } },
  });

  if (existingScores.length > 0) {
    const scores = existingScores.map((s) => ({
      parameterId: s.parameterId,
      parameterName: s.parameter.name,
      weight: s.parameter.weight,
      rawValue: s.rawValue,
      normalizedScore: s.normalizedScore,
      weightedScore: s.weightedScore,
    }));

    const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
    const totalWeighted = scores.reduce((sum, s) => sum + s.weightedScore, 0);
    const totalScore =
      totalWeight > 0
        ? Math.round((totalWeighted / totalWeight) * 100 * 100) / 100
        : 0;

    const { bonusPercentage, tier, tierColor } = calculateBonusPercentage(totalScore);

    return { totalScore, bonusPercentage, tier, tierColor, scores };
  }

  // Calculate fresh
  const result = await calculateUserPerformance(userId, companyId, period);
  return {
    totalScore: result.totalScore,
    bonusPercentage: result.bonusPercentage,
    tier: result.tier,
    tierColor: result.tierColor,
    scores: result.scores,
  };
}
