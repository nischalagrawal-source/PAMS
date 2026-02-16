"use client";

import { useState } from "react";
import {
  SlidersHorizontal,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Save,
  ToggleLeft,
  ToggleRight,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useParameters,
  useCreateParameter,
  useUpdateParameter,
  useDeleteParameter,
  type PerfParameter,
} from "@/hooks/use-performance";

type FormData = {
  name: string;
  description: string;
  weight: number;
  formula: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | "CUSTOM";
  dataSource: string;
  sortOrder: number;
};

const emptyForm: FormData = {
  name: "",
  description: "",
  weight: 0,
  formula: "HIGHER_IS_BETTER",
  dataSource: "custom",
  sortOrder: 0,
};

const FORMULA_OPTIONS = [
  { value: "HIGHER_IS_BETTER", label: "Higher is Better" },
  { value: "LOWER_IS_BETTER", label: "Lower is Better" },
  { value: "CUSTOM", label: "Custom" },
] as const;

const DATA_SOURCE_OPTIONS = [
  { value: "attendance", label: "Attendance" },
  { value: "tasks", label: "Tasks" },
  { value: "leaves", label: "Leaves" },
  { value: "custom", label: "Custom" },
];

export default function PerformanceParametersPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [formError, setFormError] = useState("");

  const { data: parameters = [], isLoading } = useParameters();
  const createParam = useCreateParameter();
  const updateParam = useUpdateParameter();
  const deleteParam = useDeleteParameter();

  const activeWeight = parameters
    .filter((p) => p.isActive)
    .reduce((sum, p) => sum + p.weight, 0);
  const weightStatus =
    activeWeight === 100 ? "ok" : activeWeight >= 90 ? "warn" : "error";

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
  }

  function openCreate() {
    setForm({ ...emptyForm, sortOrder: parameters.length });
    setEditingId(null);
    setShowModal(true);
    setFormError("");
  }

  function openEdit(p: PerfParameter) {
    setForm({
      name: p.name,
      description: p.description ?? "",
      weight: p.weight,
      formula: p.formula as FormData["formula"],
      dataSource: p.dataSource ?? "custom",
      sortOrder: p.sortOrder,
    });
    setEditingId(p.id);
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
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      weight: form.weight,
      formula: form.formula,
      dataSource: form.dataSource || undefined,
      sortOrder: form.sortOrder,
    };
    if (editingId) {
      updateParam.mutate(
        { id: editingId, ...payload },
        { onSuccess: closeModal, onError: (err) => setFormError(err.message) }
      );
    } else {
      createParam.mutate(payload, {
        onSuccess: closeModal,
        onError: (err) => setFormError(err.message),
      });
    }
  }

  function handleToggleActive(p: PerfParameter) {
    updateParam.mutate({ id: p.id, isActive: !p.isActive });
  }

  const isSaving = createParam.isPending || updateParam.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/25">
            <SlidersHorizontal size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Performance Parameters
            </h1>
            <p className="text-gray-500">
              Configure and weight the parameters that drive performance scoring
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 self-start rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:from-orange-500 hover:to-amber-500"
        >
          <Plus size={18} />
          Add Parameter
        </button>
      </div>

      {/* Total Weight Indicator */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Active parameter weights
          </span>
          <span
            className={cn(
              "font-semibold",
              weightStatus === "ok" && "text-green-600 dark:text-green-400",
              weightStatus === "warn" && "text-amber-600 dark:text-amber-400",
              weightStatus === "error" && "text-red-600 dark:text-red-400"
            )}
          >
            {activeWeight.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className={cn(
              "h-full transition-all",
              weightStatus === "ok" && "bg-green-500",
              weightStatus === "warn" && "bg-amber-500",
              weightStatus === "error" && "bg-red-500"
            )}
            style={{ width: `${Math.min(activeWeight, 100)}%` }}
          />
        </div>
        {activeWeight !== 100 && (
          <p
            className={cn(
              "mt-2 text-sm",
              weightStatus === "warn" && "text-amber-600 dark:text-amber-400",
              weightStatus === "error" && "text-red-600 dark:text-red-400"
            )}
          >
            Active parameter weights should sum to 100% (currently {activeWeight.toFixed(1)}%)
          </p>
        )}
      </div>

      {/* Parameters List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : parameters.length === 0 ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
          <div className="text-center">
            <SlidersHorizontal size={48} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-500">No parameters yet</h3>
            <p className="mt-1 text-sm text-gray-400">
              Add your first performance parameter to get started
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {parameters.map((p) => (
            <div
              key={p.id}
              className={cn(
                "flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-950 sm:flex-row sm:items-center",
                !p.isActive && "opacity-50"
              )}
            >
              <div className="flex flex-1 items-start gap-3">
                <GripVertical size={18} className="mt-0.5 shrink-0 text-gray-400" />
                <div>
                  <h4
                    className={cn(
                      "font-semibold text-gray-900 dark:text-white",
                      !p.isActive && "line-through"
                    )}
                  >
                    {p.name}
                  </h4>
                  {p.description && (
                    <p className="text-sm text-gray-500">{p.description}</p>
                  )}
                  {p.dataSource && (
                    <span className="mt-1 inline-block rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      {p.dataSource}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {p.weight}%
                </span>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-medium",
                    p.formula === "HIGHER_IS_BETTER" &&
                      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                    p.formula === "LOWER_IS_BETTER" &&
                      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                    p.formula === "CUSTOM" &&
                      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                  )}
                >
                  {p.formula.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(p)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  title={p.isActive ? "Deactivate" : "Activate"}
                >
                  {p.isActive ? (
                    <ToggleRight size={22} className="text-green-600" />
                  ) : (
                    <ToggleLeft size={22} className="text-gray-400" />
                  )}
                </button>
                <button
                  onClick={() => openEdit(p)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => {
                    if (confirm("Delete this parameter?"))
                      deleteParam.mutate(p.id);
                  }}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingId ? "Edit Parameter" : "New Parameter"}
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
                  placeholder="e.g., Task Speed"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={2}
                  placeholder="Brief description of this parameter"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Weight (0–100)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={form.weight}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, weight: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        sortOrder: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Formula
                </label>
                <select
                  value={form.formula}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      formula: e.target.value as FormData["formula"],
                    }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  {FORMULA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Data Source
                </label>
                <select
                  value={form.dataSource}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dataSource: e.target.value }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  {DATA_SOURCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
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
                  className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
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
