"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  BarChart3,
  AlertTriangle,
  Shield,
  Loader2,
  Play,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAnomalyReports,
  useDetectAnomalies,
  type AnomalyItem,
} from "@/hooks/use-anomalies";

const SEVERITY_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  critical: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-600 dark:text-red-400", dot: "bg-red-600" },
  high: { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-600 dark:text-orange-400", dot: "bg-orange-600" },
  medium: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-600" },
  low: { bg: "bg-gray-50 dark:bg-gray-800/50", text: "text-gray-500 dark:text-gray-400", dot: "bg-gray-500" },
};

function SeverityBadge({ severity }: { severity: string }) {
  const s = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.low;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", s.bg, s.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
}

function AnomalyCard({ item }: { item: AnomalyItem }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <SeverityBadge severity={item.severity} />
            <span className="truncate text-sm font-bold text-gray-900 dark:text-white">{item.title}</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{item.description}</p>
        </div>
        {item.affectedUsers.length > 0 && (
          <div className="flex shrink-0 items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            <Info size={12} />
            {item.affectedUsers.length} user{item.affectedUsers.length !== 1 && "s"}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role || "";
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(role);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const detectMutation = useDetectAnomalies();
  const reportsQuery = useAnomalyReports({ from: fromDate || undefined, to: toDate || undefined, page, limit: 10 });

  const reports = reportsQuery.data?.records ?? [];
  const totalPages = reportsQuery.data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
            <BarChart3 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
            <p className="text-gray-500">Anomaly detection reports and system analytics</p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => detectMutation.mutate()}
            disabled={detectMutation.isPending}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
          >
            {detectMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            Run Detection
          </button>
        )}
      </div>

      {/* Detection Results */}
      {detectMutation.isSuccess && detectMutation.data && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-5 shadow-sm dark:border-indigo-900/50 dark:from-indigo-950/20 dark:to-violet-950/20">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-400">
              <Shield size={16} />
              Detection Complete
            </div>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{detectMutation.data.summary}</p>
          </div>

          {detectMutation.data.anomalies.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-5 dark:border-green-900/50 dark:bg-green-950/20">
              <CheckCircle2 size={20} className="shrink-0 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-semibold text-green-700 dark:text-green-400">All Clear</p>
                <p className="text-sm text-green-600/80 dark:text-green-400/70">No anomalies detected. Everything looks good.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-500">
                {detectMutation.data.anomalies.length} anomal{detectMutation.data.anomalies.length === 1 ? "y" : "ies"} found
              </p>
              {detectMutation.data.anomalies.map((a, i) => (
                <AnomalyCard key={i} item={a} />
              ))}
            </div>
          )}
        </div>
      )}

      {detectMutation.isError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          <XCircle size={16} className="shrink-0" />
          {detectMutation.error?.message || "Detection failed. Please try again."}
        </div>
      )}

      {/* Reports History */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <AlertTriangle size={18} className="text-indigo-500" />
            Report History
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              placeholder="From"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              placeholder="To"
            />
          </div>
        </div>

        {reportsQuery.isLoading ? (
          <div className="px-6 py-16 text-center">
            <Loader2 size={24} className="mx-auto animate-spin text-gray-400" />
          </div>
        ) : reports.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <BarChart3 size={36} className="mx-auto text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">No reports found for the selected date range.</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden grid-cols-[1fr_2fr_80px_80px_140px] items-center gap-3 border-b border-gray-100 px-6 py-3 text-xs font-medium text-gray-500 sm:grid dark:border-gray-800">
              <span>Date</span>
              <span>Summary</span>
              <span className="text-center">Issues</span>
              <span className="text-center">Sent To</span>
              <span>Sent At</span>
            </div>

            <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {reports.map((report) => {
                const isExpanded = expandedId === report.id;
                return (
                  <div key={report.id}>
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : report.id)}
                      className={cn(
                        "grid cursor-pointer grid-cols-1 gap-2 px-6 py-4 transition hover:bg-gray-50/50 sm:grid-cols-[1fr_2fr_80px_80px_140px] sm:items-center sm:gap-3 dark:hover:bg-gray-800/30",
                        isExpanded && "bg-gray-50 dark:bg-gray-800/20"
                      )}
                    >
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {new Date(report.date).toLocaleDateString()}
                      </span>
                      <span className="truncate text-sm text-gray-600 dark:text-gray-400">
                        {report.summary}
                      </span>
                      <span className="text-center text-sm font-semibold text-gray-900 dark:text-white">
                        {report.details.length}
                      </span>
                      <span className="text-center text-sm text-gray-500">
                        {report.sentTo.length}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock size={12} />
                        {report.sentAt ? new Date(report.sentAt).toLocaleString() : "—"}
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="space-y-2 border-t border-gray-100 bg-gray-50/50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/30">
                        {report.details.length === 0 ? (
                          <p className="py-2 text-center text-sm text-gray-400">No anomaly details recorded.</p>
                        ) : (
                          report.details.map((item, i) => <AnomalyCard key={i} item={item} />)
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-800">
                <p className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
