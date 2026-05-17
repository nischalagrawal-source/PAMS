import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionOrFail, errorResponse, successResponse } from "@/lib/api-utils";
import { BONUS_TIERS } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;
    if (session.user.role !== "SUPER_ADMIN") return errorResponse("Forbidden", 403);

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") ?? new Date().toISOString().slice(0, 7);

    const companies = await prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    // Get bonus calculations for the period (they contain aggregate scores)
    const bonusCalcs = await prisma.bonusCalculation.findMany({
      where: { period },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            companyId: true,
            company: { select: { name: true } },
          },
        },
      },
    });

    // Also fetch perf scores for employees who may not have bonus calcs yet
    const perfScores = await prisma.perfScore.findMany({
      where: { period },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyId: true,
            company: { select: { name: true } },
          },
        },
      },
    });

    // Build employee score map from bonus calcs (most accurate)
    type EmpScore = { name: string; companyName: string; companyId: string; score: number; tier: string; period: string };
    const empMap = new Map<string, EmpScore>();
    for (const bc of bonusCalcs) {
      const tier = BONUS_TIERS.find((t) => bc.totalScore >= t.minScore && bc.totalScore <= t.maxScore)?.tier ?? "—";
      empMap.set(bc.userId, {
        name: `${bc.user.firstName} ${bc.user.lastName}`,
        companyName: bc.user.company.name,
        companyId: bc.user.companyId,
        score: bc.totalScore,
        tier,
        period,
      });
    }

    // Supplement with perf scores for employees without bonus calcs
    const scoresByUser = new Map<string, number[]>();
    for (const ps of perfScores) {
      if (!empMap.has(ps.userId)) {
        if (!scoresByUser.has(ps.userId)) scoresByUser.set(ps.userId, []);
        scoresByUser.get(ps.userId)!.push(ps.weightedScore);
      }
    }
    for (const ps of perfScores) {
      if (!empMap.has(ps.userId) && scoresByUser.has(ps.userId)) {
        const scores = scoresByUser.get(ps.userId)!;
        const total = scores.reduce((s, v) => s + v, 0);
        const tier = BONUS_TIERS.find((t) => total >= t.minScore && total <= t.maxScore)?.tier ?? "—";
        empMap.set(ps.userId, {
          name: `${ps.user.firstName} ${ps.user.lastName}`,
          companyName: ps.user.company.name,
          companyId: ps.user.companyId,
          score: total,
          tier,
          period,
        });
        scoresByUser.delete(ps.userId);
      }
    }

    const employees = Array.from(empMap.values());

    // Build per-company performance summary
    const companyPerfMap = new Map(companies.map((c) => [c.id, { companyId: c.id, companyName: c.name, scores: [] as number[], employees: [] as typeof employees }]));
    for (const emp of employees) {
      const co = companyPerfMap.get(emp.companyId);
      if (!co) continue;
      co.scores.push(emp.score);
      co.employees.push(emp);
    }

    const companyStats = Array.from(companyPerfMap.values()).map((c) => {
      const avgScore = c.scores.length > 0 ? c.scores.reduce((s, v) => s + v, 0) / c.scores.length : 0;
      const topEmp = c.employees.sort((a, b) => b.score - a.score)[0];
      const belowAvgCount = c.scores.filter((s) => s < 50).length;
      return {
        companyId: c.companyId,
        companyName: c.companyName,
        avgScore: Math.round(avgScore * 10) / 10,
        topPerformer: topEmp?.name ?? "—",
        belowAvgCount,
        period,
      };
    });

    return successResponse({ companies: companyStats, employees });
  } catch (err) {
    console.error("[GET /api/admin/super/performance]", err);
    return errorResponse("Failed to fetch performance data", 500);
  }
}
