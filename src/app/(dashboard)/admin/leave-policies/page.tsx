"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarOff, Plus, Pencil, Trash2, X, Loader2, Save } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface LeavePolicy {
  id: string;
  leaveType: string;
  maxDaysPerYear: number;
  advanceNoticeDays: number;
  emergencyPenaltyWeight: number;
  longEmergencyDays: number;
  longEmergencyPenaltyWeight: number;
  isActive: boolean;
  createdAt: string;
}

type FormData = Pick<
  LeavePolicy,
  "leaveType" | "maxDaysPerYear" | "advanceNoticeDays" | "emergencyPenaltyWeight" | "longEmergencyDays" | "longEmergencyPenaltyWeight"
>;

const emptyForm: Partial<FormData> = {
  leaveType: "PERSONAL",
  maxDaysPerYear: 12,
  advanceNoticeDays: 7,
  emergencyPenaltyWeight: 1.0,
  longEmergencyDays: 2,
  longEmergencyPenaltyWeight: 2.0,
};

async function fetchPolicies(): Promise<LeavePolicy[]> {
  const res = await fetch("/api/admin/leave-policies");
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export default function LeavePoliciesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<FormData>>(emptyForm);
  const [formError, setFormError] = useState("");

  const policiesQuery = useQuery({
    queryKey: ["leave-policies"],
    queryFn: fetchPolicies,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<FormData>) => {
      const res = await fetch("/api/admin/leave-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-policies"] });
      closeForm();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FormData> }) => {
      const res = await fetch(`/api/admin/leave-policies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-policies"] });
      closeForm();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/leave-policies/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leave-policies"] }),
  });

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
  }

  function openEdit(policy: LeavePolicy) {
    setForm({
      leaveType: policy.leaveType,
      maxDaysPerYear: policy.maxDaysPerYear,
      advanceNoticeDays: policy.advanceNoticeDays,
      emergencyPenaltyWeight: policy.emergencyPenaltyWeight,
      longEmergencyDays: policy.longEmergencyDays,
      longEmergencyPenaltyWeight: policy.longEmergencyPenaltyWeight,
    });
    setEditingId(policy.id);
    setShowForm(true);
    setFormError("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.leaveType || !form.maxDaysPerYear) {
      setFormError("Leave type and max days are required");
      return;
    }

    const payload = {
      leaveType: form.leaveType,
      maxDaysPerYear: form.maxDaysPerYear,
      advanceNoticeDays: form.advanceNoticeDays,
      emergencyPenaltyWeight: form.emergencyPenaltyWeight,
      longEmergencyDays: form.longEmergencyDays,
      longEmergencyPenaltyWeight: form.longEmergencyPenaltyWeight,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const policies = policiesQuery.data || [];
  const configuredTypes = new Set(policies.map((p) => p.leaveType));
  const availableTypes = ["SICK", "PERSONAL", "EMERGENCY"].filter((t) => !configuredTypes.has(t) || editingId);

  const getLeaveTypeDetails = (type: string) => {
    const details: Record<string, { color: string; icon: string; description: string }> = {
      SICK: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: "🏥", description: "Sick leaves for medical reasons" },
      PERSONAL: {
        color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        icon: "📅",
        description: "Paid leaves (e.g., 12 regular + 13 festival = 25)",
      },
      EMERGENCY: {
        color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
        icon: "🚨",
        description: "Emergency/urgent personal leave",
      },
    };
    return details[type];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg shadow-purple-500/25">
            <CalendarOff size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leave Policies</h1>
            <p className="text-gray-500">Configure leaves: sick, personal (paid), and emergency</p>
          </div>
        </div>
        {availableTypes.length > 0 && (
          <button
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setForm({ ...emptyForm, leaveType: availableTypes[0] });
            }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition hover:from-purple-500 hover:to-pink-500"
          >
            <Plus size={18} />
            Add Leave Policy
          </button>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingId ? "Edit Leave Policy" : "New Leave Policy"}
              </h3>
              <button onClick={closeForm} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Leave Type</label>
                <select
                  value={form.leaveType || ""}
                  onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
                  disabled={!!editingId}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none disabled:opacity-50 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  {availableTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Max Days per Year</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={form.maxDaysPerYear || 0}
                  onChange={(e) => setForm({ ...form, maxDaysPerYear: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500">For PERSONAL: total paid leaves (e.g., 12 regular + 13 festival = 25)</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Advance Notice Days</label>
                <input
                  type="number"
                  min="0"
                  max="365"
                  value={form.advanceNoticeDays || 0}
                  onChange={(e) => setForm({ ...form, advanceNoticeDays: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500">Days notice required before taking leave (e.g., 7 = must apply 1 week in advance)</p>
              </div>

              <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
                <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Emergency Leave Penalties</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">Base Penalty Weight</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.emergencyPenaltyWeight || 0}
                      onChange={(e) => setForm({ ...form, emergencyPenaltyWeight: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">Long Emergency Penalty</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.longEmergencyPenaltyWeight || 0}
                      onChange={(e) => setForm({ ...form, longEmergencyPenaltyWeight: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">Long Emergency Threshold (days)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.longEmergencyDays || 0}
                    onChange={(e) => setForm({ ...form, longEmergencyDays: parseInt(e.target.value) || 1 })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500">Emergency &gt; this many days incurs higher penalty</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {editingId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Policies List */}
      {policiesQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : policies.length === 0 ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
          <div className="text-center">
            <CalendarOff size={48} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-500">No leave policies configured</h3>
            <p className="mt-1 text-sm text-gray-400">Create policies for sick, personal, and emergency leaves</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {policies.map((policy) => {
            const details = getLeaveTypeDetails(policy.leaveType);
            return (
              <div
                key={policy.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={cn("flex h-12 w-12 items-center justify-center rounded-lg text-xl", details?.color)}>
                      {details?.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">{policy.leaveType}</h4>
                      <p className="text-sm text-gray-500">{details?.description}</p>
                      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                        <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900">
                          <span className="text-gray-500">Max Days/Year:</span>
                          <span className="ml-1 font-semibold text-gray-900 dark:text-white">{policy.maxDaysPerYear}</span>
                        </div>
                        <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900">
                          <span className="text-gray-500">Notice Days:</span>
                          <span className="ml-1 font-semibold text-gray-900 dark:text-white">{policy.advanceNoticeDays}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(policy)}
                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Delete this policy?")) deleteMutation.mutate(policy.id);
                      }}
                      className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
