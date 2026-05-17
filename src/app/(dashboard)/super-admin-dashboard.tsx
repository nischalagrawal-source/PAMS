"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  MapPin,
  TrendingUp,
  Building2,
  Clock,
  CalendarOff,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────

interface CompanyAttendance {
  companyId: string;
  companyName: string;
  totalStaff: number;
  presentToday: number;
  onLeave: number;
  absentUnexplained: number;
  lateToday: number;
  attendancePercent: number;
}

interface EmployeeAttendanceRow {
  userId: string;
  name: string;
  employeeCode: string;
  companyName: string;
  designation: string | null;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  isLate: boolean;
  lateByMinutes: number;
  totalHours: number | null;
}

interface CompanyPerformance {
  companyId: string;
  companyName: string;
  avgScore: number;
  topPerformer: string;
  belowAvgCount: number;
  period: string;
}

// ─── Helpers ─────────────────────────────────────────────────

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
  const colorMap: Record<string, string> = {
    blue: "from-blue-500 to-blue-700",
    green: "from-emerald-500 to-emerald-700",
    purple: "from-violet-500 to-violet-700",
    orange: "from-orange-500 to-orange-700",
    red: "from-red-500 to-red-700",
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</p>
          <p className="mt-1.5 text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br shadow-md", colorMap[color] ?? colorMap.blue)}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────

function AttendanceManagementTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterCompany, setFilterCompany] = useState("all");

  const { data, isLoading, error } = useQuery<{ companies: CompanyAttendance[]; employees: EmployeeAttendanceRow[] }>({
    queryKey: ["superadmin", "attendance", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/admin/super/attendance?date=${selectedDate}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to load attendance");
      return json.data;
    },
  });

  const companies = data?.companies ?? [];
  const employees = (data?.employees ?? []).filter((e) => {
    const matchesSearch =
      !searchQuery ||
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.employeeCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCompany = filterCompany === "all" || e.companyName === filterCompany;
    return matchesSearch && matchesCompany;
  });

  const totalPresent = companies.reduce((s, c) => s + c.presentToday, 0);
  const totalStaff = companies.reduce((s, c) => s + c.totalStaff, 0);
  const totalLate = companies.reduce((s, c) => s + c.lateToday, 0);
  const totalLeave = companies.reduce((s, c) => s + c.onLeave, 0);

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Total Staff" value={totalStaff} icon={Users} color="blue" />
        <StatCard title="Present Today" value={totalPresent} subtitle={`${totalStaff > 0 ? Math.round((totalPresent / totalStaff) * 100) : 0}% attendance`} icon={CheckCircle2} color="green" />
        <StatCard title="Late Arrivals" value={totalLate} icon={Clock} color="orange" />
        <StatCard title="On Leave" value={totalLeave} icon={CalendarOff} color="red" />
      </div>

      {/* Per-company summary */}
      {companies.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white">Company-wise Attendance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Company</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-500">Total</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-500">Present</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-500">Late</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-500">On Leave</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-500">% Attendance</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.companyId} className="border-b border-gray-50 dark:border-gray-800/50">
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{c.companyName}</td>
                    <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-400">{c.totalStaff}</td>
                    <td className="px-5 py-3 text-right text-green-600 font-medium">{c.presentToday}</td>
                    <td className="px-5 py-3 text-right text-amber-600">{c.lateToday}</td>
                    <td className="px-5 py-3 text-right text-red-500">{c.onLeave}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={cn("font-semibold", c.attendancePercent >= 80 ? "text-green-600" : c.attendancePercent >= 60 ? "text-amber-600" : "text-red-600")}>
                        {c.attendancePercent}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Employee-level attendance */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h3 className="mr-auto font-semibold text-gray-900 dark:text-white">Employee Attendance</h3>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-gray-300 py-1.5 pl-8 pr-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
          <div className="relative">
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="appearance-none rounded-lg border border-gray-300 py-1.5 pl-3 pr-8 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            >
              <option value="all">All Companies</option>
              {companies.map((c) => (
                <option key={c.companyId} value={c.companyName}>{c.companyName}</option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="px-5 py-6 text-center text-sm text-red-500">Failed to load attendance data</div>
        ) : employees.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">No attendance records for this date</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Employee</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Company</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Check In</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Check Out</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Hours</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.userId} className="border-b border-gray-50 hover:bg-gray-50/50 dark:border-gray-800/50 dark:hover:bg-gray-900/30">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{emp.name}</div>
                      <div className="text-xs text-gray-400">{emp.employeeCode}{emp.designation ? ` · ${emp.designation}` : ""}</div>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{emp.companyName}</td>
                    <td className="px-5 py-3">
                      {emp.checkIn ? (
                        <span className={cn("font-medium", emp.isLate ? "text-amber-600" : "text-gray-900 dark:text-white")}>
                          {emp.checkIn}
                          {emp.isLate && <span className="ml-1 text-xs text-amber-500">+{emp.lateByMinutes}m late</span>}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{emp.checkOut ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{emp.totalHours != null ? `${emp.totalHours.toFixed(1)}h` : "—"}</td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                        emp.status === "APPROVED" || emp.status === "AUTO_APPROVED"
                          ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : emp.status === "FLAGGED"
                          ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      )}>
                        {emp.status.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Performance Tab ──────────────────────────────────────────

function PerformanceManagementTab() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading } = useQuery<{ companies: CompanyPerformance[]; employees: { name: string; companyName: string; score: number; tier: string; period: string }[] }>({
    queryKey: ["superadmin", "performance", period],
    queryFn: async () => {
      const res = await fetch(`/api/admin/super/performance?period=${period}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to load performance");
      return json.data;
    },
  });

  const companies = data?.companies ?? [];
  const employees = (data?.employees ?? []).filter(
    (e) => !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tierColor = (tier: string) =>
    tier === "Exceptional" ? "text-pink-600" :
    tier === "Outstanding" ? "text-purple-600" :
    tier === "Excellent" ? "text-cyan-600" :
    tier === "Very Good" ? "text-green-600" :
    tier === "Good" ? "text-lime-600" :
    tier === "Average" ? "text-yellow-600" :
    "text-gray-500";

  return (
    <div className="space-y-6">
      {/* Company Performance Summary */}
      {companies.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
            <h3 className="mr-auto font-semibold text-gray-900 dark:text-white">Company Performance Overview</h3>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((c) => (
              <div key={c.companyId} className="rounded-lg border border-gray-100 p-4 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-800 dark:text-gray-200">{c.companyName}</p>
                  <span className={cn("text-2xl font-bold", c.avgScore >= 80 ? "text-green-600" : c.avgScore >= 60 ? "text-yellow-600" : "text-red-500")}>
                    {c.avgScore.toFixed(0)}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-400">Top: {c.topPerformer}</p>
                {c.belowAvgCount > 0 && (
                  <p className="mt-1 text-xs text-red-400">{c.belowAvgCount} below average</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Employee performance list */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h3 className="mr-auto font-semibold text-gray-900 dark:text-white">Employee Performance Scores</h3>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-gray-300 py-1.5 pl-8 pr-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : employees.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">No performance data for this period</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Employee</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Company</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-500">Score</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Tier</th>
                </tr>
              </thead>
              <tbody>
                {employees.sort((a, b) => b.score - a.score).map((emp, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 dark:border-gray-800/50 dark:hover:bg-gray-900/30">
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{emp.name}</td>
                    <td className="px-5 py-3 text-gray-500">{emp.companyName}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className={cn("h-full rounded-full", emp.score >= 80 ? "bg-green-500" : emp.score >= 60 ? "bg-yellow-500" : "bg-red-500")}
                            style={{ width: `${emp.score}%` }}
                          />
                        </div>
                        <span className="font-semibold text-gray-900 dark:text-white">{emp.score.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn("font-medium", tierColor(emp.tier))}>{emp.tier}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main SUPER_ADMIN Dashboard ───────────────────────────────

export function SuperAdminDashboard({ userName }: { userName: string }) {
  const [activeTab, setActiveTab] = useState<"attendance" | "performance">("attendance");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Overview</h1>
        <p className="text-sm text-gray-500">Super Admin · Cross-company management</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="-mb-px flex gap-6">
          {(
            [
              { id: "attendance", label: "Employee Attendance Management", icon: MapPin },
              { id: "performance", label: "Performance Management", icon: TrendingUp },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 border-b-2 pb-3 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "attendance" ? <AttendanceManagementTab /> : <PerformanceManagementTab />}
    </div>
  );
}
