"use client";

import { useSession } from "next-auth/react";
import {
  Users,
  MapPin,
  ListTodo,
  TrendingUp,
  CalendarOff,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
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
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
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

export default function DashboardPage() {
  const { data: session } = useSession();
  const user = session?.user;

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

      {/* Stats grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Staff"
          value={50}
          subtitle="Across all companies"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Present Today"
          value={42}
          subtitle="84% attendance"
          icon={MapPin}
          color="green"
        />
        <StatCard
          title="Active Tasks"
          value={128}
          subtitle="23 overdue"
          icon={ListTodo}
          color="purple"
        />
        <StatCard
          title="Avg Performance"
          value="72%"
          subtitle="Good tier"
          icon={TrendingUp}
          color="orange"
        />
      </div>

      {/* Second row */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="On Leave"
          value={5}
          subtitle="3 planned, 2 emergency"
          icon={CalendarOff}
          color="red"
        />
        <StatCard
          title="Overtime Hours"
          value="156"
          subtitle="This month total"
          icon={Clock}
          color="cyan"
        />
        <StatCard
          title="Anomalies"
          value={7}
          subtitle="Needs attention"
          icon={AlertTriangle}
          color="pink"
        />
        <StatCard
          title="Tasks Completed"
          value={89}
          subtitle="This week"
          icon={CheckCircle2}
          color="indigo"
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
            {[
              { action: "Task completed", detail: "Website redesign - Phase 2", time: "2 min ago", type: "success" },
              { action: "Leave approved", detail: "Personal leave - Mar 5-6", time: "15 min ago", type: "info" },
              { action: "Anomaly detected", detail: "3 staff absent simultaneously", time: "1 hr ago", type: "warning" },
              { action: "Check-in", detail: "Office - Main Branch", time: "9:05 AM", type: "success" },
              { action: "New task assigned", detail: "Client report preparation", time: "Yesterday", type: "info" },
            ].map((item, i) => (
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
            ))}
          </div>
        </div>

        {/* Top performers */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Top Performers
          </h3>
          <div className="space-y-3">
            {[
              { name: "Rahul Sharma", score: 92, tier: "Excellent", color: "text-cyan-600" },
              { name: "Priya Patel", score: 88, tier: "Excellent", color: "text-cyan-600" },
              { name: "Amit Kumar", score: 85, tier: "Very Good", color: "text-green-600" },
              { name: "Sneha Reddy", score: 81, tier: "Very Good", color: "text-green-600" },
              { name: "Vikram Singh", score: 78, tier: "Good", color: "text-lime-600" },
            ].map((person, i) => (
              <div key={i} className="flex items-center gap-4 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {person.name}
                  </p>
                  <p className={`text-xs font-medium ${person.color}`}>
                    {person.tier}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {person.score}
                  </p>
                  <p className="text-xs text-gray-500">score</p>
                </div>
                {/* Score bar */}
                <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                    style={{ width: `${person.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick action cards for personal info if staff */}
      {user?.role === "STAFF" && (
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/30">
            <MapPin className="mb-3 text-blue-600" size={24} />
            <h4 className="font-semibold text-blue-900 dark:text-blue-100">Check In</h4>
            <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
              Mark your attendance for today
            </p>
          </div>
          <div className="rounded-xl border border-purple-100 bg-purple-50 p-6 dark:border-purple-900 dark:bg-purple-950/30">
            <CalendarOff className="mb-3 text-purple-600" size={24} />
            <h4 className="font-semibold text-purple-900 dark:text-purple-100">Apply Leave</h4>
            <p className="mt-1 text-sm text-purple-700 dark:text-purple-300">
              Request time off (apply 7+ days in advance)
            </p>
          </div>
          <div className="rounded-xl border border-green-100 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950/30">
            <ListTodo className="mb-3 text-green-600" size={24} />
            <h4 className="font-semibold text-green-900 dark:text-green-100">My Tasks</h4>
            <p className="mt-1 text-sm text-green-700 dark:text-green-300">
              View and manage your assigned tasks
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
