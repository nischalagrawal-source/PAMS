"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  CalendarOff,
  Plus,
  X,
  Loader2,
  Save,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Shield,
  Upload,
  FileText,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useLeaveList,
  useLeaveBalance,
  useApplyLeave,
  useUpdateLeave,
  useUploadProof,
  type LeaveRequest,
} from "@/hooks/use-leaves";

function getStatusBadge(status: string) {
  const map: Record<string, { color: string; icon: React.ReactNode }> = {
    PENDING: { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: <Clock size={12} /> },
    APPROVED: { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: <CheckCircle2 size={12} /> },
    REJECTED: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: <XCircle size={12} /> },
    CANCELLED: { color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", icon: <XCircle size={12} /> },
  };
  const s = map[status] || map.PENDING;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", s.color)}>
      {s.icon} {status}
    </span>
  );
}

function getTypeBadge(type: string) {
  const map: Record<string, string> = {
    SICK: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    PERSONAL: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    EMERGENCY: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", map[type] || map.PERSONAL)}>
      {type}
    </span>
  );
}

function getProofBadge(status: string) {
  const map: Record<string, { color: string; label: string }> = {
    NOT_REQUIRED: { color: "text-gray-400", label: "—" },
    PENDING_REVIEW: { color: "text-amber-600", label: "Pending Review" },
    APPROVED: { color: "text-green-600", label: "Approved" },
    REJECTED: { color: "text-red-600", label: "Rejected" },
  };
  const s = map[status] || map.NOT_REQUIRED;
  return <span className={cn("text-xs font-medium", s.color)}>{s.label}</span>;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function LeavesPage() {
  const { data: session } = useSession();
  const isStaff = session?.user?.role === "STAFF";
  const isReviewerOrAbove = ["REVIEWER", "ADMIN", "SUPER_ADMIN"].includes(session?.user?.role || "");

  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [proofUrl, setProofUrl] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");

  const balanceQuery = useLeaveBalance();
  const listQuery = useLeaveList({ status: statusFilter || undefined, page, limit: 15 });
  const applyMutation = useApplyLeave();
  const updateMutation = useUpdateLeave();
  const proofMutation = useUploadProof();

  const [form, setForm] = useState({
    leaveType: "PERSONAL" as "SICK" | "PERSONAL" | "EMERGENCY",
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [formError, setFormError] = useState("");

  function handleApply(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.startDate || !form.endDate) {
      setFormError("Start and end dates are required");
      return;
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      setFormError("End date must be after start date");
      return;
    }
    applyMutation.mutate(form, {
      onSuccess: () => {
        setShowForm(false);
        setForm({ leaveType: "PERSONAL", startDate: "", endDate: "", reason: "" });
      },
      onError: (err) => setFormError(err.message),
    });
  }

  // Check if a date is >=7 days from today
  const isAdvanceLeave = form.startDate
    ? (new Date(form.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24) >= 7
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg shadow-purple-500/25">
            <CalendarOff size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leaves</h1>
            <p className="text-gray-500">Apply for leave and track your leave balance</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition hover:from-purple-500 hover:to-violet-500"
        >
          <Plus size={18} />
          Apply Leave
        </button>
      </div>

      {/* Leave Balance Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {balanceQuery.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-900" />
          ))
        ) : (
          balanceQuery.data?.map((bal) => (
            <div key={bal.leaveType} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{bal.leaveType} Leave</p>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">{bal.remainingDays}</span>
                    <span className="text-sm text-gray-400">/ {bal.maxDays} days</span>
                  </div>
                </div>
                <div className="h-12 w-12">
                  <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e5e7eb" strokeWidth="3" className="dark:stroke-gray-800" />
                    <circle
                      cx="18" cy="18" r="15.5" fill="none"
                      stroke={bal.leaveType === "SICK" ? "#ef4444" : bal.leaveType === "PERSONAL" ? "#3b82f6" : "#f97316"}
                      strokeWidth="3" strokeLinecap="round"
                      strokeDasharray={`${(bal.usedDays / bal.maxDays) * 97.4} 97.4`}
                    />
                  </svg>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">{bal.usedDays} days used this year</p>
            </div>
          ))
        )}
      </div>

      {/* Apply Leave Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Apply for Leave</h3>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                {formError}
              </div>
            )}

            {/* Advance notice warning */}
            {isAdvanceLeave !== null && (
              <div className={cn(
                "mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm",
                isAdvanceLeave
                  ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400"
                  : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400"
              )}>
                {isAdvanceLeave ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
                <div>
                  {isAdvanceLeave ? (
                    <p><strong>Planned leave</strong> — Applied 7+ days in advance. No negative impact on performance score.</p>
                  ) : (
                    <p><strong>Short notice leave</strong> — Less than 7 days advance. This will have a negative impact on your performance score unless you upload proof (e.g., doctor&apos;s note).</p>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleApply} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Leave Type</label>
                <select
                  value={form.leaveType}
                  onChange={(e) => setForm((p) => ({ ...p, leaveType: e.target.value as typeof form.leaveType }))}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="PERSONAL">Personal</option>
                  <option value="SICK">Sick</option>
                  <option value="EMERGENCY">Emergency</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Reason (optional)</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                  rows={3}
                  placeholder="Provide a reason for your leave..."
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                  Cancel
                </button>
                <button type="submit" disabled={applyMutation.isPending} className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50">
                  {applyMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Detail / Approval Modal */}
      {selectedLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Leave Details</h3>
              <button onClick={() => { setSelectedLeave(null); setApprovalNotes(""); setProofUrl(""); }} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              {selectedLeave.user && (
                <div className="flex justify-between"><span className="text-gray-500">Employee</span><span className="font-medium text-gray-900 dark:text-white">{selectedLeave.user.firstName} {selectedLeave.user.lastName} ({selectedLeave.user.employeeCode})</span></div>
              )}
              <div className="flex justify-between"><span className="text-gray-500">Type</span>{getTypeBadge(selectedLeave.leaveType)}</div>
              <div className="flex justify-between"><span className="text-gray-500">Dates</span><span className="font-medium text-gray-900 dark:text-white">{formatDate(selectedLeave.startDate)} — {formatDate(selectedLeave.endDate)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Duration</span><span className="font-medium">{selectedLeave.durationDays} day{selectedLeave.durationDays !== 1 ? "s" : ""}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span>{getStatusBadge(selectedLeave.status)}</div>
              <div className="flex justify-between"><span className="text-gray-500">Advance Notice</span><span className={cn("font-medium", selectedLeave.isAdvance ? "text-green-600" : "text-amber-600")}>{selectedLeave.isAdvance ? "Yes (7+ days)" : "No (short notice)"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Score Impact</span><span className={cn("font-medium", selectedLeave.scoringImpact < 0 ? "text-red-600" : "text-green-600")}>{selectedLeave.scoringImpact === 0 ? "None" : selectedLeave.scoringImpact.toFixed(1)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Proof</span>{getProofBadge(selectedLeave.proofStatus)}</div>
              {selectedLeave.reason && <div><span className="text-gray-500">Reason:</span><p className="mt-1 text-gray-700 dark:text-gray-300">{selectedLeave.reason}</p></div>}
              {selectedLeave.approvalNotes && <div><span className="text-gray-500">Approval Notes:</span><p className="mt-1 text-gray-700 dark:text-gray-300">{selectedLeave.approvalNotes}</p></div>}
            </div>

            {/* Upload proof (for leave owner, if emergency) */}
            {selectedLeave.isEmergency && selectedLeave.userId === session?.user?.id && selectedLeave.proofStatus !== "APPROVED" && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <p className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                  <Upload size={14} className="mr-1 inline" />
                  Upload proof to neutralize score penalty
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={proofUrl}
                    onChange={(e) => setProofUrl(e.target.value)}
                    placeholder="Paste URL to proof document..."
                    className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm dark:border-amber-700 dark:bg-gray-800 dark:text-white"
                  />
                  <button
                    onClick={() => proofMutation.mutate({ id: selectedLeave.id, proofUrl }, { onSuccess: (data) => { setSelectedLeave(data); setProofUrl(""); } })}
                    disabled={!proofUrl || proofMutation.isPending}
                    className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                  >
                    {proofMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Upload"}
                  </button>
                </div>
              </div>
            )}

            {/* Approval actions (for reviewers) */}
            {isReviewerOrAbove && selectedLeave.status === "PENDING" && (
              <div className="mt-4 space-y-3 border-t border-gray-200 pt-4 dark:border-gray-800">
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Approval notes (optional)..."
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => updateMutation.mutate({ id: selectedLeave.id, status: "APPROVED", approvalNotes }, { onSuccess: (data) => setSelectedLeave(data) })}
                    disabled={updateMutation.isPending}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} /> Approve
                  </button>
                  <button
                    onClick={() => updateMutation.mutate({ id: selectedLeave.id, status: "REJECTED", approvalNotes }, { onSuccess: (data) => setSelectedLeave(data) })}
                    disabled={updateMutation.isPending}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    <XCircle size={16} /> Reject
                  </button>
                </div>
                {/* Proof approval */}
                {selectedLeave.proofStatus === "PENDING_REVIEW" && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => updateMutation.mutate({ id: selectedLeave.id, proofStatus: "APPROVED" }, { onSuccess: (data) => setSelectedLeave(data) })}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-green-300 py-2 text-sm font-medium text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400"
                    >
                      <FileText size={14} /> Approve Proof
                    </button>
                    <button
                      onClick={() => updateMutation.mutate({ id: selectedLeave.id, proofStatus: "REJECTED" }, { onSuccess: (data) => setSelectedLeave(data) })}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-300 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                    >
                      <FileText size={14} /> Reject Proof
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Cancel button (for owner, if pending) */}
            {selectedLeave.userId === session?.user?.id && selectedLeave.status === "PENDING" && (
              <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-800">
                <button
                  onClick={() => updateMutation.mutate({ id: selectedLeave.id, status: "CANCELLED" }, { onSuccess: (data) => setSelectedLeave(data) })}
                  disabled={updateMutation.isPending}
                  className="w-full rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  Cancel This Leave
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leave Requests Table */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-col items-start justify-between gap-4 border-b border-gray-200 p-6 dark:border-gray-800 sm:flex-row sm:items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isReviewerOrAbove ? "All Leave Requests" : "My Leave Requests"}
          </h3>
          <div className="flex gap-2">
            {["", "PENDING", "APPROVED", "REJECTED"].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  statusFilter === s
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                    : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                {s || "All"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {isReviewerOrAbove && <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Employee</th>}
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Dates</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Days</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Notice</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Score Impact</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Proof</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {listQuery.isLoading ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center"><Loader2 size={24} className="mx-auto animate-spin text-gray-400" /></td></tr>
              ) : listQuery.data?.records.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center"><CalendarOff size={24} className="mx-auto text-gray-300" /><p className="mt-2 text-sm text-gray-500">No leave requests found</p></td></tr>
              ) : (
                listQuery.data?.records.map((leave) => (
                  <tr
                    key={leave.id}
                    onClick={() => setSelectedLeave(leave)}
                    className="cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                  >
                    {isReviewerOrAbove && (
                      <td className="whitespace-nowrap px-6 py-3.5 text-sm text-gray-700 dark:text-gray-300">
                        {leave.user ? `${leave.user.firstName} ${leave.user.lastName}` : "-"}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-6 py-3.5">{getTypeBadge(leave.leaveType)}</td>
                    <td className="whitespace-nowrap px-6 py-3.5 text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(leave.startDate)} — {formatDate(leave.endDate)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3.5 text-sm font-medium text-gray-900 dark:text-white">{leave.durationDays}</td>
                    <td className="whitespace-nowrap px-6 py-3.5">
                      {leave.isAdvance ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600"><CheckCircle2 size={12} /> Advance</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><AlertTriangle size={12} /> Short</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3.5">
                      <span className={cn("text-sm font-medium", leave.scoringImpact < 0 ? "text-red-600" : "text-gray-400")}>
                        {leave.scoringImpact === 0 ? "—" : leave.scoringImpact.toFixed(1)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-3.5">{getProofBadge(leave.proofStatus)}</td>
                    <td className="whitespace-nowrap px-6 py-3.5">{getStatusBadge(leave.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {listQuery.data && listQuery.data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-800">
            <p className="text-sm text-gray-500">Page {listQuery.data.page} of {listQuery.data.totalPages} ({listQuery.data.total} total)</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-400"><ChevronLeft size={16} /></button>
              <button onClick={() => setPage((p) => Math.min(listQuery.data!.totalPages, p + 1))} disabled={page >= listQuery.data.totalPages} className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-400"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Info box about leave policies */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-blue-600" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-semibold">Leave Policy</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-blue-700 dark:text-blue-400">
              <li>Apply at least <strong>7 days in advance</strong> for no negative impact on your performance score</li>
              <li>Emergency/short-notice leaves carry a <strong>negative score impact</strong></li>
              <li>Upload proof (doctor&apos;s note, etc.) to <strong>neutralize</strong> the penalty</li>
              <li>Emergency leaves exceeding 2-3 days have a <strong>higher penalty</strong></li>
              <li>Click on any leave request to view details, upload proof, or cancel</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
