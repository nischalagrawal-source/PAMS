"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  TrendingUp,
  Trophy,
  Target,
  Zap,
  Star,
  Calculator,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useRankings,
  useUserPerformance,
  useTriggerCalculation,
  type UserPerformance,
} from "@/hooks/use-performance";
import { BONUS_TIERS } from "@/lib/constants";

function getTierForScore(score: number) {
  return BONUS_TIERS.find((t) => score >= t.minScore && score <= t.maxScore) ?? BONUS_TIERS[0];
}

function trophyIcon(rank: number) {
  if (rank === 1) return <Trophy size={16} className="text-yellow-500" />;
  if (rank === 2) return <Trophy size={16} className="text-gray-400" />;
  if (rank === 3) return <Trophy size={16} className="text-amber-700" />;
  return null;
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
      />
    </div>
  );
}

function ParameterBreakdown({ scores }: { scores: UserPerformance["scores"] }) {
  if (!scores || scores.length === 0) {
    return <p className="py-3 text-center text-sm text-gray-400">No parameter data available</p>;
  }
  return (
    <div className="space-y-3 px-4 pb-4 pt-2 sm:px-14">
      <div className="grid grid-cols-[1fr_50px_60px_1fr_60px] items-center gap-3 text-xs font-medium text-gray-500">
        <span>Parameter</span>
        <span className="text-center">Weight</span>
        <span className="text-center">Raw</span>
        <span>Normalized (0–100)</span>
        <span className="text-center">Weighted</span>
      </div>
      {scores.map((s) => {
        const tier = getTierForScore(s.normalizedScore);
        return (
          <div
            key={s.parameterId}
            className="grid grid-cols-[1fr_50px_60px_1fr_60px] items-center gap-3"
          >
            <span className="truncate text-sm font-medium text-gray-700 dark:text-gray-300">
              {s.parameterName}
            </span>
            <span className="text-center text-xs text-gray-500">{s.weight}%</span>
            <span className="text-center text-xs font-medium text-gray-600 dark:text-gray-400">
              {s.rawValue.toFixed(1)}
            </span>
            <div className="flex items-center gap-2">
              <ScoreBar value={s.normalizedScore} color={tier.color} />
              <span className="w-8 text-right text-xs font-semibold" style={{ color: tier.color }}>
                {s.normalizedScore.toFixed(0)}
              </span>
            </div>
            <span className="text-center text-sm font-bold text-gray-900 dark:text-white">
              {s.weightedScore.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function PerformancePage() {
  const { data: session } = useSession();
  const role = session?.user?.role || "";
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(role);
  const isStaff = role === "STAFF";

  const [period, setPeriod] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
  );
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const rankingsQuery = useRankings(period);
  const myPerfQuery = useUserPerformance(isStaff ? session?.user?.id ?? null : null, period);
  const calcMutation = useTriggerCalculation();

  const rankings = rankingsQuery.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/25">
            <TrendingUp size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Performance</h1>
            <p className="text-gray-500">Track performance scores and bonus calculations</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          {isAdmin && (
            <button
              onClick={() => calcMutation.mutate(period)}
              disabled={calcMutation.isPending}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:from-orange-500 hover:to-amber-500 disabled:opacity-50"
            >
              {calcMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Calculator size={16} />
              )}
              Calculate Scores
            </button>
          )}
        </div>
      </div>

      {calcMutation.isSuccess && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400">
          Calculated scores for {calcMutation.data?.calculated} employee(s) for period{" "}
          {calcMutation.data?.period}.
        </div>
      )}

      {/* Bonus Tier Visual */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          <Star size={16} className="text-amber-500" /> Bonus Tier Scale
        </h3>
        <div className="flex overflow-hidden rounded-xl">
          {BONUS_TIERS.map((tier) => {
            const width = tier.maxScore - tier.minScore + 1;
            return (
              <div
                key={tier.tier}
                className="relative flex flex-col items-center justify-center px-1 py-3 text-center text-white transition-all hover:brightness-110"
                style={{ backgroundColor: tier.color, width: `${width}%`, minWidth: "40px" }}
                title={`${tier.tier}: Score ${tier.minScore}–${tier.maxScore} → Bonus ${tier.minBonus}–${tier.maxBonus}%`}
              >
                <span className="truncate text-[10px] font-bold leading-tight drop-shadow-sm">
                  {tier.tier}
                </span>
                <span className="text-[9px] opacity-90">
                  {tier.minScore}–{tier.maxScore}
                </span>
                <span className="text-[9px] font-semibold opacity-90">
                  {tier.minBonus}–{tier.maxBonus}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* My Performance (Staff only) */}
      {isStaff && myPerfQuery.data && (
        <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-6 shadow-sm dark:border-orange-900/50 dark:from-orange-950/20 dark:to-amber-950/20">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <Target size={18} className="text-orange-500" /> My Performance
          </h3>
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-white/70 p-4 text-center dark:bg-gray-900/50">
              <p className="text-xs font-medium text-gray-500">Total Score</p>
              <p
                className="mt-1 text-3xl font-bold"
                style={{ color: getTierForScore(myPerfQuery.data.totalScore).color }}
              >
                {myPerfQuery.data.totalScore.toFixed(1)}
              </p>
            </div>
            <div className="rounded-xl bg-white/70 p-4 text-center dark:bg-gray-900/50">
              <p className="text-xs font-medium text-gray-500">Tier</p>
              <span
                className="mt-2 inline-block rounded-full px-3 py-1 text-sm font-bold text-white"
                style={{ backgroundColor: myPerfQuery.data.tierColor }}
              >
                {myPerfQuery.data.tier}
              </span>
            </div>
            <div className="rounded-xl bg-white/70 p-4 text-center dark:bg-gray-900/50">
              <p className="text-xs font-medium text-gray-500">Bonus</p>
              <p className="mt-1 text-3xl font-bold text-orange-600">
                {myPerfQuery.data.bonusPercentage}%
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {myPerfQuery.data.scores.map((s) => {
              const tier = getTierForScore(s.normalizedScore);
              return (
                <div key={s.parameterId} className="flex items-center gap-3">
                  <span className="w-32 truncate text-sm font-medium text-gray-700 dark:text-gray-300">
                    {s.parameterName}
                  </span>
                  <div className="flex-1">
                    <ScoreBar value={s.normalizedScore} color={tier.color} />
                  </div>
                  <span
                    className="w-12 text-right text-sm font-bold"
                    style={{ color: tier.color }}
                  >
                    {s.normalizedScore.toFixed(0)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isStaff && myPerfQuery.isLoading && (
        <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white py-12 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      )}

      {/* Rankings Table */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="border-b border-gray-200 px-6 py-5 dark:border-gray-800">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <Zap size={18} className="text-orange-500" /> Rankings — {period}
          </h3>
        </div>

        {rankingsQuery.isLoading ? (
          <div className="px-6 py-16 text-center">
            <Loader2 size={24} className="mx-auto animate-spin text-gray-400" />
          </div>
        ) : rankings.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <TrendingUp size={36} className="mx-auto text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">
              No performance data for this period.{" "}
              {isAdmin && "Use Calculate Scores to generate data."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {/* Table header */}
            <div className="hidden grid-cols-[50px_1fr_100px_90px_130px_40px] items-center gap-3 px-6 py-3 text-xs font-medium text-gray-500 sm:grid">
              <span>#</span>
              <span>Employee</span>
              <span className="text-center">Score</span>
              <span className="text-center">Bonus</span>
              <span>Tier</span>
              <span />
            </div>

            {rankings.map((user, idx) => {
              const rank = idx + 1;
              const tier = getTierForScore(user.totalScore);
              const isMe = user.userId === session?.user?.id;
              const isExpanded = expandedUserId === user.userId;

              return (
                <div key={user.userId}>
                  <div
                    onClick={() => setExpandedUserId(isExpanded ? null : user.userId)}
                    className={cn(
                      "grid cursor-pointer grid-cols-[50px_1fr_100px_90px_130px_40px] items-center gap-3 px-6 py-4 transition hover:bg-gray-50/50 dark:hover:bg-gray-800/30",
                      isMe && "bg-orange-50/50 dark:bg-orange-950/10",
                      isExpanded && "bg-gray-50 dark:bg-gray-800/20"
                    )}
                  >
                    {/* Rank */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "text-sm font-bold",
                          rank <= 3 ? "text-gray-900 dark:text-white" : "text-gray-500"
                        )}
                      >
                        {rank}
                      </span>
                      {trophyIcon(rank)}
                    </div>

                    {/* Employee */}
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "truncate font-medium text-gray-900 dark:text-white",
                          isMe && "text-orange-700 dark:text-orange-400"
                        )}
                      >
                        {user.userName}
                        {isMe && (
                          <span className="ml-2 text-xs font-normal text-orange-500">(You)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">{user.employeeCode}</p>
                    </div>

                    {/* Score */}
                    <div className="text-center">
                      <span className="text-lg font-bold" style={{ color: tier.color }}>
                        {user.totalScore.toFixed(1)}
                      </span>
                    </div>

                    {/* Bonus */}
                    <div className="text-center">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {user.bonusPercentage}%
                      </span>
                    </div>

                    {/* Tier badge */}
                    <span
                      className="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-bold text-white"
                      style={{ backgroundColor: user.tierColor || tier.color }}
                    >
                      {user.tier}
                    </span>

                    {/* Expand toggle */}
                    <div className="flex justify-center text-gray-400">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {/* Expanded parameter breakdown */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/30">
                      <ParameterBreakdown scores={user.scores} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
