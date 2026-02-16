"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  MapPin,
  LogIn,
  LogOut,
  Clock,
  Wifi,
  WifiOff,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Home,
  Building2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Navigation,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGeolocation } from "@/hooks/use-geolocation";
import {
  useTodayAttendance,
  useAttendanceList,
  useCheckIn,
  useCheckOut,
  useLocationPing,
} from "@/hooks/use-attendance";

function formatTime(dateStr: string | null) {
  if (!dateStr) return "--:--";
  return new Date(dateStr).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatHours(hours: number | null) {
  if (hours === null) return "--";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

function getLocationIcon(type: string) {
  switch (type) {
    case "OFFICE":
      return <Building2 size={16} className="text-green-600" />;
    case "CLIENT_SITE":
      return <Navigation size={16} className="text-blue-600" />;
    case "WORK_FROM_HOME":
      return <Home size={16} className="text-purple-600" />;
    default:
      return <AlertTriangle size={16} className="text-amber-600" />;
  }
}

function getLocationLabel(type: string) {
  switch (type) {
    case "OFFICE":
      return "Office";
    case "CLIENT_SITE":
      return "Client Site";
    case "WORK_FROM_HOME":
      return "Work From Home";
    default:
      return "Unknown";
  }
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    AUTO_APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    PENDING_REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    FLAGGED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", styles[status] || styles.PENDING_REVIEW)}>
      {status === "AUTO_APPROVED" ? <ShieldCheck size={12} /> : status === "FLAGGED" || status === "REJECTED" ? <ShieldAlert size={12} /> : <Shield size={12} />}
      {status.replace("_", " ")}
    </span>
  );
}

export default function AttendancePage() {
  const { data: session } = useSession();
  const geo = useGeolocation();
  const todayQuery = useTodayAttendance();
  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();
  const pingMutation = useLocationPing();

  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

  const listQuery = useAttendanceList({
    from: dateRange.from,
    to: dateRange.to,
    page,
    limit: 15,
  });

  const today = todayQuery.data;
  const isCheckedIn = !!today?.checkInTime && !today?.checkOutTime;
  const isCheckedOut = !!today?.checkOutTime;

  // Periodic location ping when checked in (every 30 minutes)
  useEffect(() => {
    if (!isCheckedIn) return;

    const interval = setInterval(async () => {
      try {
        const pos = await geo.getCurrentPosition();
        pingMutation.mutate({ latitude: pos.latitude, longitude: pos.longitude });
      } catch {
        // Silently fail — ping is best-effort
      }
    }, 30 * 60 * 1000); // 30 minutes

    return () => clearInterval(interval);
  }, [isCheckedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCheckIn = useCallback(async () => {
    try {
      const pos = await geo.getCurrentPosition();
      checkInMutation.mutate({ latitude: pos.latitude, longitude: pos.longitude });
    } catch {
      // Error is shown via geo.error
    }
  }, [geo, checkInMutation]);

  const handleCheckOut = useCallback(async () => {
    try {
      const pos = await geo.getCurrentPosition();
      checkOutMutation.mutate({ latitude: pos.latitude, longitude: pos.longitude });
    } catch {
      // Error is shown via geo.error
    }
  }, [geo, checkOutMutation]);

  const isLoading = checkInMutation.isPending || checkOutMutation.isPending || geo.loading;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/25">
          <MapPin size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Attendance
          </h1>
          <p className="text-gray-500">Check in, check out, and view your attendance records</p>
        </div>
      </div>

      {/* Today's Status Card */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Check-in/out card */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Today&apos;s Attendance
          </h3>

          {/* GPS Status */}
          <div className="mb-6 flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-900">
            {geo.latitude ? (
              <>
                <Wifi size={16} className="text-green-500" />
                <span className="text-sm text-green-700 dark:text-green-400">
                  GPS Active — Accuracy: {geo.accuracy ? `${Math.round(geo.accuracy)}m` : "..."}
                </span>
              </>
            ) : geo.error ? (
              <>
                <WifiOff size={16} className="text-red-500" />
                <span className="text-sm text-red-600 dark:text-red-400">{geo.error}</span>
              </>
            ) : (
              <>
                <Wifi size={16} className="text-gray-400" />
                <span className="text-sm text-gray-500">GPS will activate when you check in</span>
              </>
            )}
          </div>

          {/* Error messages */}
          {(checkInMutation.error || checkOutMutation.error) && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
              {checkInMutation.error?.message || checkOutMutation.error?.message}
            </div>
          )}

          {/* Status and action */}
          <div className="flex flex-col items-center gap-6 py-4 sm:flex-row sm:justify-between">
            {/* Time display */}
            <div className="flex gap-8">
              <div className="text-center">
                <div className="flex items-center gap-2 text-gray-500">
                  <LogIn size={14} />
                  <span className="text-xs font-medium uppercase">Check In</span>
                </div>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                  {formatTime(today?.checkInTime ?? null)}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-2 text-gray-500">
                  <LogOut size={14} />
                  <span className="text-xs font-medium uppercase">Check Out</span>
                </div>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                  {formatTime(today?.checkOutTime ?? null)}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-2 text-gray-500">
                  <Clock size={14} />
                  <span className="text-xs font-medium uppercase">Hours</span>
                </div>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                  {formatHours(today?.totalHours ?? null)}
                </p>
              </div>
            </div>

            {/* Action button */}
            <div>
              {!today || (!today.checkInTime && !today.checkOutTime) ? (
                <button
                  onClick={handleCheckIn}
                  disabled={isLoading}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-8 py-3 font-semibold text-white shadow-lg shadow-green-500/25 transition hover:from-green-500 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />}
                  {isLoading ? "Getting Location..." : "Check In"}
                </button>
              ) : isCheckedIn ? (
                <button
                  onClick={handleCheckOut}
                  disabled={isLoading}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-8 py-3 font-semibold text-white shadow-lg shadow-red-500/25 transition hover:from-red-500 hover:to-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : <LogOut size={20} />}
                  {isLoading ? "Getting Location..." : "Check Out"}
                </button>
              ) : (
                <div className="rounded-xl bg-gray-100 px-8 py-3 text-center dark:bg-gray-800">
                  <p className="font-medium text-gray-500">Day Complete</p>
                </div>
              )}
            </div>
          </div>

          {/* Today's details */}
          {today && (
            <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-900 sm:grid-cols-3 lg:grid-cols-6">
              <div>
                <p className="text-xs font-medium text-gray-500">Location</p>
                <div className="mt-1 flex items-center gap-1.5">
                  {getLocationIcon(today.locationType)}
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {getLocationLabel(today.locationType)}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Status</p>
                <div className="mt-1">{getStatusBadge(today.status)}</div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Punctuality</p>
                <p className={cn("mt-1 text-sm font-medium", today.isLate ? "text-red-600" : "text-green-600")}>
                  {today.isLate ? `Late by ${today.lateByMinutes}min` : "On Time"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Half Day</p>
                <p className={cn("mt-1 text-sm font-medium", today.isHalfDay ? "text-red-600" : "text-green-600")}>
                  {today.isHalfDay ? "Yes" : "No"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Geo-fence Exits</p>
                <p className={cn("mt-1 text-sm font-medium", today.geoExitCount > 0 ? "text-red-600" : "text-green-600")}>
                  {today.geoExitCount} time{today.geoExitCount !== 1 ? "s" : ""}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Overtime</p>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                  {today.overtimeHours ? formatHours(today.overtimeHours) : "None"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <ShieldCheck size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {listQuery.data?.total ?? "--"}
                </p>
                <p className="text-xs text-gray-500">Total Records This Month</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Clock size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {today?.overtimeHours ? formatHours(today.overtimeHours) : "0h"}
                </p>
                <p className="text-xs text-gray-500">Overtime Today</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Home size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {today?.isWfh ? "Yes" : "No"}
                </p>
                <p className="text-xs text-gray-500">Working From Home</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance History */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-col items-start justify-between gap-4 border-b border-gray-200 p-6 dark:border-gray-800 sm:flex-row sm:items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Attendance History
          </h3>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => { setDateRange((prev) => ({ ...prev, from: e.target.value })); setPage(1); }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => { setDateRange((prev) => ({ ...prev, to: e.target.value })); setPage(1); }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                {session?.user?.role !== "STAFF" && (
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Employee</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Check In</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Check Out</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Hours</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Late</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Exits</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {listQuery.isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Loader2 size={24} className="mx-auto animate-spin text-gray-400" />
                    <p className="mt-2 text-sm text-gray-500">Loading records...</p>
                  </td>
                </tr>
              ) : listQuery.data?.records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <MapPin size={24} className="mx-auto text-gray-300" />
                    <p className="mt-2 text-sm text-gray-500">No attendance records found</p>
                  </td>
                </tr>
              ) : (
                listQuery.data?.records.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    <td className="whitespace-nowrap px-6 py-3.5 text-sm font-medium text-gray-900 dark:text-white">
                      {new Date(record.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                    </td>
                    {session?.user?.role !== "STAFF" && (
                      <td className="whitespace-nowrap px-6 py-3.5 text-sm text-gray-600 dark:text-gray-400">
                        {record.user ? `${record.user.firstName} ${record.user.lastName}` : "-"}
                        {record.user && <span className="ml-1 text-xs text-gray-400">({record.user.employeeCode})</span>}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-6 py-3.5 text-sm text-gray-600 dark:text-gray-400">
                      {formatTime(record.checkInTime)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3.5 text-sm text-gray-600 dark:text-gray-400">
                      {formatTime(record.checkOutTime)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3.5 text-sm font-medium text-gray-900 dark:text-white">
                      {formatHours(record.totalHours)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {getLocationIcon(record.locationType)}
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {getLocationLabel(record.locationType)}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-3.5">
                      {record.isLate ? (
                        <span className="text-xs font-medium text-red-600">
                          {record.lateByMinutes}min late
                          {record.isHalfDay && <span className="ml-1 rounded bg-red-100 px-1 text-red-700">Half Day</span>}
                        </span>
                      ) : (
                        <span className="text-xs text-green-600">On time</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3.5">
                      <span className={cn("text-sm font-medium", record.geoExitCount > 0 ? "text-red-600" : "text-gray-400")}>
                        {record.geoExitCount}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-3.5">
                      {getStatusBadge(record.status)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {listQuery.data && listQuery.data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-800">
            <p className="text-sm text-gray-500">
              Showing page {listQuery.data.page} of {listQuery.data.totalPages} ({listQuery.data.total} records)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(listQuery.data!.totalPages, p + 1))}
                disabled={page >= listQuery.data.totalPages}
                className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
