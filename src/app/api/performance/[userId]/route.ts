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
 * GET /api/performance/[userId]
 * Get detailed performance for a specific user.
 * Query params:
 *   - period: "YYYY-MM" (default: current month)
 * Returns scores + last 6 months of bonus history.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const companyId = session!.user.companyId;
    const role = session!.user.role;

    // STAFF can only see their own performance
    if (role === "STAFF" && userId !== session!.user.id) {
      return errorResponse("You can only view your own performance", 403);
    }

    // Verify user belongs to the same company
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
      },
    });

    if (!user) {
      return errorResponse("User not found", 404);
    }

    const { searchParams } = new URL(req.url);
    const now = new Date();
    const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const period = searchParams.get("period") || defaultPeriod;

    // Try to load stored scores for this period
    const existingScores = await prisma.perfScore.findMany({
      where: { userId, period },
      include: { parameter: { select: { name: true, weight: true } } },
    });

    let totalScore: number;
    let bonusPercentage: number;
    let tier: string;
    let tierColor: string;
    let scores: Array<{
      parameterId: string;
      parameterName: string;
      weight: number;
      rawValue: number;
      normalizedScore: number;
      weightedScore: number;
    }>;

    if (existingScores.length > 0) {
      scores = existingScores.map((s) => ({
        parameterId: s.parameterId,
        parameterName: s.parameter.name,
        weight: s.parameter.weight,
        rawValue: s.rawValue,
        normalizedScore: s.normalizedScore,
        weightedScore: s.weightedScore,
      }));

      const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
      const totalWeighted = scores.reduce((sum, s) => sum + s.weightedScore, 0);
      totalScore =
        totalWeight > 0
          ? Math.round((totalWeighted / totalWeight) * 100 * 100) / 100
          : 0;

      const bonus = calculateBonusPercentage(totalScore);
      bonusPercentage = bonus.bonusPercentage;
      tier = bonus.tier;
      tierColor = bonus.tierColor;
    } else {
      // Calculate on-the-fly
      const result = await calculateUserPerformance(userId, companyId, period);
      totalScore = result.totalScore;
      bonusPercentage = result.bonusPercentage;
      tier = result.tier;
      tierColor = result.tierColor;
      scores = result.scores;
    }

    // Fetch last 6 months of bonus history
    const sixMonthsAgo = getLast6Periods(period);
    const history = await prisma.bonusCalculation.findMany({
      where: {
        userId,
        period: { in: sixMonthsAgo },
      },
      orderBy: { period: "asc" },
      select: {
        period: true,
        totalScore: true,
        bonusPercentage: true,
        tier: true,
        isFinalized: true,
      },
    });

    return successResponse({
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      employeeCode: user.employeeCode,
      period,
      totalScore,
      bonusPercentage,
      tier,
      tierColor,
      scores,
      history,
    });
  } catch (err) {
    console.error("[GET /api/performance/[userId]]", err);
    return errorResponse("Failed to fetch user performance", 500);
  }
}

/**
 * Generate an array of the last 6 period strings (YYYY-MM) ending at the given period.
 */
function getLast6Periods(period: string): string[] {
  const [yearStr, monthStr] = period.split("-");
  let year = parseInt(yearStr);
  let month = parseInt(monthStr);
  const periods: string[] = [];

  for (let i = 0; i < 6; i++) {
    periods.push(`${year}-${String(month).padStart(2, "0")}`);
    month--;
    if (month < 1) {
      month = 12;
      year--;
    }
  }

  return periods;
}
