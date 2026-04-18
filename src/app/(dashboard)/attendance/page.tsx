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
  Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGeolocation } from "@/hooks/use-geolocation";
import { InstallAppBanner } from "@/components/install-app-banner";
import { LocationPermissionGuide } from "@/components/location-permission-guide";
import {
  useTodayAttendance,
  useAttendanceList,
  useCheckIn,
  useCheckOut,
  useLocationPing,
  useClientVisitCheckIn,
} from "@/hooks/use-attendance";
import { SelfieCapture } from "@/components/selfie-capture";
import { generateDeviceFingerprint } from "@/lib/device-fingerprint";

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

function parseClientVisitEntries(notes: string | null) {
  if (!notes) return [] as Array<{
    timestamp: string;
    fenceLabel: string;
    actualTravelMinutes: number | null;
    estimatedTravelMinutes: number | null;
    isReasonable: boolean;
  }>;

  return notes
    .split("\n")
    .filter((line) => line.startsWith("[CLIENT_VISIT] "))
    .flatMap((line) => {
      try {
        return [JSON.parse(line.replace("[CLIENT_VISIT] ", "")) as {
          timestamp: string;
          fenceLabel: string;
          actualTravelMinutes: number | null;
          estimatedTravelMinutes: number | null;
          isReasonable: boolean;
        }];
      } catch {
        return [];
      }
    });
}

export default function AttendancePage() {
  const { data: session } = useSession();
  const geo = useGeolocation();
  const todayQuery = useTodayAttendance();
  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();
  const pingMutation = useLocationPing();
  const clientVisitMutation = useClientVisitCheckIn();

  const [page, setPage] = useState(1);
  const [showSelfieCapture, setShowSelfieCapture] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [geoMessage, setGeoMessage] = useState<{ tone: "info" | "alert"; text: string } | null>(null);
  const profilePhotoUrl = session?.user?.profilePhoto ?? null;
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
  const clientVisits = parseClientVisitEntries(today?.notes ?? null);
  const lastClientVisit = clientVisits.length > 0 ? clientVisits[clientVisits.length - 1] : null;

  // Duty-hours-only location ping when checked in.
  useEffect(() => {
    if (!isCheckedIn) {
      setGeoMessage(null);
      return;
    }

    let cancelled = false;

    const sendPing = async () => {
      try {
        const pos = await geo.getCurrentPosition();
        const result = await pingMutation.mutateAsync({ latitude: pos.latitude, longitude: pos.longitude });
        if (cancelled || !result?.message) return;
        setGeoMessage({
          tone: result.alertTriggered || !result.insideFence ? "alert" : "info",
          text: result.message,
        });
      } catch {
        // Silently fail — ping is best-effort during active duty only
      }
    };

    void sendPing();
    const interval = setInterval(() => {
      void sendPing();
    }, 5 * 60 * 1000); // 5 minutes while checked in

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [geo, isCheckedIn, pingMutation]);

  const handleCheckIn = useCallback(async () => {
    try {
      const pos = await geo.getCurrentPosition();
      setPendingLocation({ latitude: pos.latitude, longitude: pos.longitude, accuracy: pos.accuracy });
      setShowSelfieCapture(true);
    } catch {
      // Error is shown via geo.error
    }
  }, [geo]);

  const handleSelfieCapture = useCallback(async (selfieBase64: string, faceMatchScore: number | null) => {
    setShowSelfieCapture(false);
    if (!pendingLocation) return;
    try {
      const fingerprint = await generateDeviceFingerprint();
      checkInMutation.mutate({
        ...pendingLocation,
        deviceFingerprint: fingerprint,
        selfie: selfieBase64,
        faceMatchScore,
      });
    } catch {
      // Fingerprint generation failed — still attempt with fallback
      checkInMutation.mutate({
        ...pendingLocation,
        deviceFingerprint: "unsupported-" + Date.now(),
        selfie: selfieBase64,
        faceMatchScore,
      });
    }
    setPendingLocation(null);
  }, [pendingLocation, checkInMutation]);

  const handleSelfieCancelled = useCallback(() => {
    setShowSelfieCapture(false);
    setPendingLocation(null);
  }, []);

  const handleCheckOut = useCallback(async () => {
    try {
      const pos = await geo.getCurrentPosition();
      checkOutMutation.mutate({ latitude: pos.latitude, longitude: pos.longitude, accuracy: pos.accuracy });
    } catch {
      // Error is shown via geo.error
    }
  }, [geo, checkOutMutation]);

  const handleClientVisitCheckIn = useCallback(async () => {
    try {
      const pos = await geo.getCurrentPosition();
      const result = await clientVisitMutation.mutateAsync({ latitude: pos.latitude, longitude: pos.longitude });
      setGeoMessage({
        tone: result.reviewRequired ? "alert" : "info",
        text: result.reviewRequired
          ? `${result.currentSite} recorded, but travel timing needs manager review.`
          : `Visit ${result.visitCount} recorded at ${result.currentSite}.`,
      });
    } catch {
      // Error is shown via mutation state
    }
  }, [clientVisitMutation, geo]);

  const isLoading = checkInMutation.isPending || checkOutMutation.isPending || clientVisitMutation.isPending || geo.loading;

  return (
    <div className="space-y-6">
      {/* Install App Banner (mobile) */}
      <InstallAppBanner />

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/25">
          <MapPin size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Attendance
          </h1>
          <p className="hidden sm:block text-gray-500">Check in, check out, and view your attendance records</p>
        </div>
      </div>

      {/* Location permission guide */}
      <LocationPermissionGuide />

      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
        <p className="font-semibold">Privacy-safe location checks</p>
        <p className="mt-1">Location validation runs only while you are checked in for duty and stops automatically after check-out.</p>
      </div>

      {geoMessage && (
        <div
          className={cn(
            "rounded-2xl border px-4 py-3 text-sm",
            geoMessage.tone === "alert"
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
              : "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300"
          )}
        >
          {geoMessage.text}
        </div>
      )}

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
          {(checkInMutation.error || checkOutMutation.error || clientVisitMutation.error) && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
              {checkInMutation.error?.message || checkOutMutation.error?.message || clientVisitMutation.error?.message}
            </div>
          )}

          {/* Selfie capture overlay */}
          {showSelfieCapture && (
            <div className="mb-4 rounded-2xl border-2 border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
              <div className="mb-3 flex items-center gap-2">
                <Camera size={18} className="text-blue-600" />
                <h4 className="font-semibold text-blue-900 dark:text-blue-300">Identity Verification</h4>
              </div>
              <p className="mb-4 text-sm text-blue-700 dark:text-blue-400">
                Please take a selfie to verify your identity. This is required for attendance check-in.
              </p>
              <SelfieCapture
                onCapture={handleSelfieCapture}
                onCancel={handleSelfieCancelled}
                profilePhotoUrl={profilePhotoUrl}
              />
            </div>
          )}

          {/* Status and action */}
          <div className="flex flex-col items-center gap-4 py-4">
            {/* Action button — prominent on mobile, shown first */}
            <div className="w-full sm:w-auto order-first sm:order-last">
              {!today || (!today.checkInTime && !today.checkOutTime) ? (
                <button
                  onClick={handleCheckIn}
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-8 py-4 sm:py-3 text-lg sm:text-base font-semibold text-white shadow-lg shadow-green-500/25 transition hover:from-green-500 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />}
                  {isLoading ? "Getting Location..." : "Check In"}
                </button>
              ) : isCheckedIn ? (
                <div className="flex w-full flex-col gap-3 sm:w-auto">
                  <button
                    onClick={handleCheckOut}
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-8 py-4 sm:py-3 text-lg sm:text-base font-semibold text-white shadow-lg shadow-red-500/25 transition hover:from-red-500 hover:to-rose-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {isLoading ? <Loader2 size={20} className="animate-spin" /> : <LogOut size={20} />}
                    {isLoading ? "Getting Location..." : "Check Out"}
                  </button>
                  <button
                    onClick={handleClientVisitCheckIn}
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-6 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50 sm:w-auto"
                  >
                    <Navigation size={18} />
                    Client Visit Check-In
                  </button>
                </div>
              ) : (
                <div className="rounded-xl bg-gray-100 px-8 py-4 sm:py-3 text-center dark:bg-gray-800">
                  <p className="font-medium text-gray-500">Day Complete</p>
                </div>
              )}
            </div>

            {/* Time display */}
            <div className="flex gap-6 sm:gap-8">
              <div className="text-center">
                <div className="flex items-center gap-1.5 sm:gap-2 text-gray-500">
                  <LogIn size={14} />
                  <span className="text-xs font-medium uppercase">Check In</span>
                </div>
                <p className="mt-1 text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {formatTime(today?.checkInTime ?? null)}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1.5 sm:gap-2 text-gray-500">
                  <LogOut size={14} />
                  <span className="text-xs font-medium uppercase">Check Out</span>
                </div>
                <p className="mt-1 text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {formatTime(today?.checkOutTime ?? null)}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1.5 sm:gap-2 text-gray-500">
                  <Clock size={14} />
                  <span className="text-xs font-medium uppercase">Hours</span>
                </div>
                <p className="mt-1 text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {formatHours(today?.totalHours ?? null)}
                </p>
              </div>
            </div>
          </div>

          {/* Today's details */}
          {today && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 rounded-lg bg-gray-50 p-3 sm:p-4 dark:bg-gray-900 sm:grid-cols-3 lg:grid-cols-7">
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
              <div>
                <p className="text-xs font-medium text-gray-500">Client Visits</p>
                <p className={cn("mt-1 text-sm font-medium", clientVisits.length > 0 ? "text-blue-600" : "text-gray-500")}>
                  {clientVisits.length}
                </p>
              </div>
            </div>
          )}

          {lastClientVisit && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Latest client checkpoint</p>
                  <p className="mt-1 text-sm text-blue-700 dark:text-blue-400">
                    {lastClientVisit.fenceLabel} at {new Date(lastClientVisit.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <span className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-semibold",
                  lastClientVisit.isReasonable
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                )}>
                  {lastClientVisit.isReasonable ? "Travel OK" : "Needs Review"}
                </span>
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
        <div className="flex flex-col items-start justify-between gap-3 border-b border-gray-200 p-4 sm:p-6 dark:border-gray-800 sm:flex-row sm:items-center sm:gap-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Attendance History
          </h3>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => { setDateRange((prev) => ({ ...prev, from: e.target.value })); setPage(1); }}
              className="rounded-lg border border-gray-300 bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => { setDateRange((prev) => ({ ...prev, to: e.target.value })); setPage(1); }}
              className="rounded-lg border border-gray-300 bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Mobile card list */}
        <div className="block sm:hidden divide-y divide-gray-100 dark:divide-gray-800/50">
          {listQuery.isLoading ? (
            <div className="px-4 py-12 text-center">
              <Loader2 size={24} className="mx-auto animate-spin text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">Loading records...</p>
            </div>
          ) : listQuery.data?.records.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <MapPin size={24} className="mx-auto text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">No attendance records found</p>
            </div>
          ) : (
            listQuery.data?.records.map((record) => (
              <div key={record.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {new Date(record.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                  {getStatusBadge(record.status)}
                </div>
                {session?.user?.role !== "STAFF" && record.user && (
                  <p className="text-xs text-gray-500">
                    {record.user.firstName} {record.user.lastName} <span className="text-gray-400">({record.user.employeeCode})</span>
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1"><LogIn size={12} className="text-green-500" />{formatTime(record.checkInTime)}</span>
                  <span className="flex items-center gap-1"><LogOut size={12} className="text-red-500" />{formatTime(record.checkOutTime)}</span>
                  <span className="flex items-center gap-1"><Clock size={12} className="text-blue-500" />{formatHours(record.totalHours)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    {getLocationIcon(record.locationType)}
                    {getLocationLabel(record.locationType)}
                  </span>
                  {record.isLate && (
                    <span className="text-red-600">{record.lateByMinutes}min late{record.isHalfDay ? " (Half Day)" : ""}</span>
                  )}
                  {record.geoExitCount > 0 && (
                    <span className="text-red-600">{record.geoExitCount} exit{record.geoExitCount !== 1 ? "s" : ""}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
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
          <div className="flex items-center justify-between border-t border-gray-200 px-4 sm:px-6 py-3 sm:py-4 dark:border-gray-800">
            <p className="text-xs sm:text-sm text-gray-500">
              Page {listQuery.data.page}/{listQuery.data.totalPages} <span className="hidden sm:inline">({listQuery.data.total} records)</span>
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
