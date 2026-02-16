"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Save,
  ToggleLeft,
  ToggleRight,
  Users,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAnomalyRules,
  useCreateAnomalyRule,
  useUpdateAnomalyRule,
  useDeleteAnomalyRule,
  type AnomalyRule,
} from "@/hooks/use-anomalies";

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeCode: string;
};

type FormData = {
  name: string;
  condition: string;
  severity: "low" | "medium" | "high" | "critical";
  recipientIds: string[];
};

const emptyForm: FormData = {
  name: "",
  condition: "",
  severity: "medium",
  recipientIds: [],
};

const SEVERITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

const severityStyles: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

export default function AnomalyRulesPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [formError, setFormError] = useState("");

  const { data: rules = [], isLoading } = useAnomalyRules();
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      const json = await res.json();
      return json.data as UserOption[];
    },
  });
  const users = usersQuery.data ?? [];
  const createRule = useCreateAnomalyRule();
  const updateRule = useUpdateAnomalyRule();
  const deleteRule = useDeleteAnomalyRule();

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
  }

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setShowModal(true);
    setFormError("");
  }

  function openEdit(rule: AnomalyRule) {
    setForm({
      name: rule.name,
      condition: rule.condition,
      severity: rule.severity as FormData["severity"],
      recipientIds: rule.recipients.map((r) => r.id),
    });
    setEditingId(rule.id);
    setShowModal(true);
    setFormError("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim()) {
      setFormError("Name is required");
      return;
    }
    if (!form.condition.trim()) {
      setFormError("Condition is required");
      return;
    }
    const payload = {
      name: form.name.trim(),
      condition: form.condition.trim(),
      severity: form.severity,
      recipientIds: form.recipientIds,
    };
    if (editingId) {
      updateRule.mutate(
        { id: editingId, ...payload },
        { onSuccess: closeModal, onError: (err) => setFormError(err.message) }
      );
    } else {
      createRule.mutate(payload, {
        onSuccess: closeModal,
        onError: (err) => setFormError(err.message),
      });
    }
  }

  function handleToggleActive(rule: AnomalyRule) {
    updateRule.mutate({ id: rule.id, isActive: !rule.isActive });
  }

  function toggleRecipient(id: string) {
    setForm((f) =>
      f.recipientIds.includes(id)
        ? { ...f, recipientIds: f.recipientIds.filter((rid) => rid !== id) }
        : { ...f, recipientIds: [...f.recipientIds, id] }
    );
  }

  const isSaving = createRule.isPending || updateRule.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/25">
            <AlertTriangle size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Anomaly Rules
            </h1>
            <p className="text-gray-500">
              Configure conditions that trigger anomaly alerts
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 self-start rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-500/25 transition hover:from-red-500 hover:to-rose-500"
        >
          <Plus size={18} />
          Add Rule
        </button>
      </div>

      {/* Rules List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : rules.length === 0 ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
          <div className="text-center">
            <AlertTriangle size={48} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-500">No anomaly rules yet</h3>
            <p className="mt-1 text-sm text-gray-400">
              Add your first rule to start detecting anomalies
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={cn(
                "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-950",
                !rule.isActive && "opacity-50"
              )}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium capitalize",
                        severityStyles[rule.severity] ?? severityStyles.medium
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          rule.severity === "critical" && "bg-red-500",
                          rule.severity === "high" && "bg-orange-500",
                          rule.severity === "medium" && "bg-amber-500",
                          rule.severity === "low" && "bg-gray-500"
                        )}
                      />
                      {rule.severity}
                    </span>
                    <h4
                      className={cn(
                        "font-semibold text-gray-900 dark:text-white",
                        !rule.isActive && "line-through"
                      )}
                    >
                      {rule.name}
                    </h4>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{rule.condition}</p>
                  {rule.recipients.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {rule.recipients.map((r) => (
                        <span
                          key={r.id}
                          className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        >
                          <Users size={12} />
                          {r.firstName} {r.lastName}
                          <span className="text-gray-400">({r.email})</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    <Mail size={12} />
                    {rule.recipients.length}
                  </span>
                  <button
                    onClick={() => handleToggleActive(rule)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    title={rule.isActive ? "Deactivate" : "Activate"}
                  >
                    {rule.isActive ? (
                      <ToggleRight size={22} className="text-green-600" />
                    ) : (
                      <ToggleLeft size={22} className="text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={() => openEdit(rule)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this anomaly rule?"))
                        deleteRule.mutate(rule.id);
                    }}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingId ? "Edit Rule" : "New Rule"}
              </h3>
              <button
                onClick={closeModal}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
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
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Simultaneous Absence"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Condition
                </label>
                <textarea
                  value={form.condition}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, condition: e.target.value }))
                  }
                  rows={3}
                  placeholder="Describe what triggers this anomaly..."
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Severity
                </label>
                <select
                  value={form.severity}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      severity: e.target.value as FormData["severity"],
                    }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  {SEVERITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Recipients
                </label>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-gray-300 p-3 dark:border-gray-700 dark:bg-gray-800">
                  {users.length === 0 ? (
                    <p className="text-sm text-gray-500">No users available</p>
                  ) : (
                    users.map((u) => (
                      <label
                        key={u.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                      >
                        <input
                          type="checkbox"
                          checked={form.recipientIds.includes(u.id)}
                          onChange={() => toggleRecipient(u.id)}
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {u.firstName} {u.lastName}
                        </span>
                        <span className="text-xs text-gray-500">({u.email})</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {editingId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
