"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  MapPin,
  ListTodo,
  TrendingUp,
  CalendarOff,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface DashboardStats {
  stats: {
    totalStaff: number;
    activeStaff: number;
    presentToday: number;
    attendancePercent: number;
    activeTasks: number;
    overdueTasks: number;
    tasksCompletedThisWeek: number;
    onLeaveToday: number;
    plannedLeaves: number;
    emergencyLeaves: number;
    overtimeHours: number;
    anomalyCount: number;
  };
  recentActivity: { action: string; detail: string; time: string; type: string; user?: string }[];
  topPerformers: { name: string; score: number; tier: string }[];
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  loading,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  loading?: boolean;
}) {
  const colorClasses: Record<string, string> = {
    blue: "from-blue-500 to-blue-600 shadow-blue-500/25",
    green: "from-emerald-500 to-emerald-600 shadow-emerald-500/25",
    purple: "from-violet-500 to-violet-600 shadow-violet-500/25",
    orange: "from-orange-500 to-orange-600 shadow-orange-500/25",
    red: "from-red-500 to-red-600 shadow-red-500/25",
    cyan: "from-cyan-500 to-cyan-600 shadow-cyan-500/25",
    indigo: "from-indigo-500 to-indigo-600 shadow-indigo-500/25",
    pink: "from-pink-500 to-pink-600 shadow-pink-500/25",
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          {loading ? (
            <div className="mt-2 h-9 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
              {value}
            </p>
          )}
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg ${colorClasses[color] || colorClasses.blue}`}
        >
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  );
}

function tierColor(tier: string): string {
  if (tier === "Excellent") return "text-cyan-600";
  if (tier === "Very Good") return "text-green-600";
  if (tier === "Good") return "text-lime-600";
  if (tier === "Average") return "text-yellow-600";
  return "text-gray-500";
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const user = session?.user;

  const { data, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    refetchInterval: 60000, // refresh every 60s
  });

  const s = data?.stats;
  const activity = data?.recentActivity ?? [];
  const performers = data?.topPerformers ?? [];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-gray-500">
          Overview of your performance and attendance metrics
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          Failed to load dashboard data: {error.message}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Staff"
          value={s?.totalStaff ?? 0}
          subtitle={`${s?.activeStaff ?? 0} active`}
          icon={Users}
          color="blue"
          loading={isLoading}
        />
        <StatCard
          title="Present Today"
          value={s?.presentToday ?? 0}
          subtitle={`${s?.attendancePercent ?? 0}% attendance`}
          icon={MapPin}
          color="green"
          loading={isLoading}
        />
        <StatCard
          title="Active Tasks"
          value={s?.activeTasks ?? 0}
          subtitle={`${s?.overdueTasks ?? 0} overdue`}
          icon={ListTodo}
          color="purple"
          loading={isLoading}
        />
        <StatCard
          title="Tasks Completed"
          value={s?.tasksCompletedThisWeek ?? 0}
          subtitle="This week"
          icon={CheckCircle2}
          color="indigo"
          loading={isLoading}
        />
      </div>

      {/* Second row */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="On Leave"
          value={s?.onLeaveToday ?? 0}
          subtitle={`${s?.plannedLeaves ?? 0} planned, ${s?.emergencyLeaves ?? 0} emergency`}
          icon={CalendarOff}
          color="red"
          loading={isLoading}
        />
        <StatCard
          title="Overtime Hours"
          value={s?.overtimeHours ?? 0}
          subtitle="This month total"
          icon={Clock}
          color="cyan"
          loading={isLoading}
        />
        <StatCard
          title="Anomalies"
          value={s?.anomalyCount ?? 0}
          subtitle="This month"
          icon={AlertTriangle}
          color="pink"
          loading={isLoading}
        />
        <StatCard
          title="Avg Performance"
          value={performers.length > 0 ? `${Math.round(performers.reduce((a, p) => a + p.score, 0) / performers.length)}%` : "—"}
          subtitle={performers.length > 0 ? "Based on scores" : "No data yet"}
          icon={TrendingUp}
          color="orange"
          loading={isLoading}
        />
      </div>

      {/* Content sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent activity */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Recent Activity
          </h3>
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : activity.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No recent activity</p>
            ) : (
              activity.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className={`mt-1 h-2 w-2 rounded-full ${
                      item.type === "success"
                        ? "bg-green-500"
                        : item.type === "warning"
                          ? "bg-amber-500"
                          : "bg-blue-500"
                    }`}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.action}
                    </p>
                    <p className="text-sm text-gray-500">{item.detail}</p>
                  </div>
                  <span className="text-xs text-gray-400">{item.time}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top performers */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Top Performers
          </h3>
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : performers.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No performance data yet</p>
            ) : (
              performers.map((person, i) => (
                <div key={i} className="flex items-center gap-4 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {person.name}
                    </p>
                    <p className={`text-xs font-medium ${tierColor(person.tier)}`}>
                      {person.tier}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {Math.round(person.score)}
                    </p>
                    <p className="text-xs text-gray-500">score</p>
                  </div>
                  {/* Score bar */}
                  <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                      style={{ width: `${Math.min(person.score, 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick action cards for personal info if staff */}
      {user?.role === "STAFF" && (
        <div className="grid gap-6 sm:grid-cols-3">
          <a href="/attendance" className="block rounded-xl border border-blue-100 bg-blue-50 p-6 transition-shadow hover:shadow-md dark:border-blue-900 dark:bg-blue-950/30">
            <MapPin className="mb-3 text-blue-600" size={24} />
            <h4 className="font-semibold text-blue-900 dark:text-blue-100">Check In</h4>
            <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
              Mark your attendance for today
            </p>
          </a>
          <a href="/leaves" className="block rounded-xl border border-purple-100 bg-purple-50 p-6 transition-shadow hover:shadow-md dark:border-purple-900 dark:bg-purple-950/30">
            <CalendarOff className="mb-3 text-purple-600" size={24} />
            <h4 className="font-semibold text-purple-900 dark:text-purple-100">Apply Leave</h4>
            <p className="mt-1 text-sm text-purple-700 dark:text-purple-300">
              Request time off (apply 7+ days in advance)
            </p>
          </a>
          <a href="/tasks" className="block rounded-xl border border-green-100 bg-green-50 p-6 transition-shadow hover:shadow-md dark:border-green-900 dark:bg-green-950/30">
            <ListTodo className="mb-3 text-green-600" size={24} />
            <h4 className="font-semibold text-green-900 dark:text-green-100">My Tasks</h4>
            <p className="mt-1 text-sm text-green-700 dark:text-green-300">
              View and manage your assigned tasks
            </p>
          </a>
        </div>
      )}
    </div>
  );
}
