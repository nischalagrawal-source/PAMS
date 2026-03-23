"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, Plus, Pencil, Loader2, Save, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  email: string;
  role: string;
}

interface SalaryStructure {
  id: string;
  userId: string;
  basic: number;
  hra: number;
  da: number;
  ta: number;
  specialAllow: number;
  pf: number;
  esi: number;
  tax: number;
  otherDeduct: number;
  netSalary: number;
  effectiveFrom: string;
  user?: User;
}

type FormData = Omit<SalaryStructure, "id" | "netSalary" | "currency" | "user">;

const emptyForm: Partial<FormData> = {
  userId: "",
  basic: 0,
  hra: 0,
  da: 0,
  ta: 0,
  specialAllow: 0,
  pf: 0,
  esi: 0,
  tax: 0,
  otherDeduct: 0,
  effectiveFrom: new Date().toISOString().split("T")[0],
};

interface ListResponse {
  records: SalaryStructure[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

async function fetchStructures(page: number): Promise<ListResponse> {
  const res = await fetch(`/api/admin/salary-structures?page=${page}&limit=20`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function fetchUsers(): Promise<User[]> {
  const res = await fetch("/api/admin/users?limit=999");
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data?.records || [];
}

export default function SalaryStructuresPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<FormData>>(emptyForm);
  const [formError, setFormError] = useState("");

  const structuresQuery = useQuery({
    queryKey: ["salary-structures", page],
    queryFn: () => fetchStructures(page),
  });

  const usersQuery = useQuery({
    queryKey: ["users-for-salary"],
    queryFn: fetchUsers,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<FormData>) => {
      const res = await fetch("/api/admin/salary-structures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-structures"] });
      closeForm();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
  }

  function openEdit(structure: SalaryStructure) {
    setForm({
      userId: structure.userId,
      basic: structure.basic,
      hra: structure.hra,
      da: structure.da,
      ta: structure.ta,
      specialAllow: structure.specialAllow,
      pf: structure.pf,
      esi: structure.esi,
      tax: structure.tax,
      otherDeduct: structure.otherDeduct,
      effectiveFrom: structure.effectiveFrom.split("T")[0],
    });
    setEditingId(structure.id);
    setShowForm(true);
    setFormError("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!form.userId) {
      setFormError("Please select an employee");
      return;
    }

    if ((form.basic || 0) <= 0) {
      setFormError("Basic salary must be greater than 0");
      return;
    }

    saveMutation.mutate(form);
  }

  const structures = structuresQuery.data?.records || [];
  const total = structuresQuery.data?.total || 0;
  const totalPages = structuresQuery.data?.totalPages || 1;
  const users = usersQuery.data || [];

  // Get configured user IDs
  const configuredUserIds = new Set(structures.map((s) => s.userId));
  const availableUsers = users.filter((u) => !configuredUserIds.has(u.id) || editingId);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/25">
            <Wallet size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Salary Structures</h1>
            <p className="text-gray-500">Configure salary components for each employee</p>
          </div>
        </div>
        {availableUsers.length > 0 && (
          <button
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setForm({ ...emptyForm, userId: availableUsers[0].id });
            }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-green-500/25 transition hover:from-green-500 hover:to-emerald-500"
          >
            <Plus size={18} />
            Add Salary
          </button>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 max-h-[90vh] overflow-y-auto">
            <div className="mb-6 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingId ? "Edit Salary Structure" : "New Salary Structure"}
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

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Employee Selection */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Employee</label>
                <select
                  value={form.userId || ""}
                  onChange={(e) => setForm({ ...form, userId: e.target.value })}
                  disabled={!!editingId}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none disabled:opacity-50 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">Select employee...</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Earnings Section */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 dark:text-white">Earnings</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Basic Salary *</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={form.basic || 0}
                      onChange={(e) => setForm({ ...form, basic: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">HRA</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={form.hra || 0}
                      onChange={(e) => setForm({ ...form, hra: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">DA</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={form.da || 0}
                      onChange={(e) => setForm({ ...form, da: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">TA</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={form.ta || 0}
                      onChange={(e) => setForm({ ...form, ta: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Special Allowance</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={form.specialAllow || 0}
                      onChange={(e) => setForm({ ...form, specialAllow: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
                <div className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 dark:bg-green-950/30 dark:text-green-400">
                  Gross: {formatCurrency((form.basic || 0) + (form.hra || 0) + (form.da || 0) + (form.ta || 0) + (form.specialAllow || 0))}
                </div>
              </div>

              {/* Deductions Section */}
              <div className="space-y-4 border-t border-gray-200 pt-6 dark:border-gray-800">
                <h4 className="font-semibold text-gray-900 dark:text-white">Deductions</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">PF</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={form.pf || 0}
                      onChange={(e) => setForm({ ...form, pf: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">ESI</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={form.esi || 0}
                      onChange={(e) => setForm({ ...form, esi: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Income Tax</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={form.tax || 0}
                      onChange={(e) => setForm({ ...form, tax: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Other Deductions</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={form.otherDeduct || 0}
                      onChange={(e) => setForm({ ...form, otherDeduct: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-950/30 dark:text-red-400">
                  Total Deductions: {formatCurrency((form.pf || 0) + (form.esi || 0) + (form.tax || 0) + (form.otherDeduct || 0))}
                </div>
              </div>

              {/* Effective Date */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Effective From</label>
                <input
                  type="date"
                  value={form.effectiveFrom || ""}
                  onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              {/* Net Salary Summary */}
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950/30">
                <div className="text-sm font-medium text-green-700 dark:text-green-400">
                  Net Salary: {formatCurrency(
                    (form.basic || 0) + (form.hra || 0) + (form.da || 0) + (form.ta || 0) + (form.specialAllow || 0) -
                      ((form.pf || 0) + (form.esi || 0) + (form.tax || 0) + (form.otherDeduct || 0))
                  )}
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
                  disabled={saveMutation.isPending}
                  className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                >
                  {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Salary Structures Table */}
      {structuresQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : structures.length === 0 ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
          <div className="text-center">
            <Wallet size={48} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-500">No salary structures yet</h3>
            <p className="mt-1 text-sm text-gray-400">Add salary components for employees</p>
          </div>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Employee</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Gross</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Deductions</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Net</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {structures.map((structure) => {
                  const gross = structure.basic + structure.hra + structure.da + structure.ta + structure.specialAllow;
                  const deductions = structure.pf + structure.esi + structure.tax + structure.otherDeduct;
                  return (
                    <tr key={structure.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {structure.user?.firstName} {structure.user?.lastName}
                        </div>
                        <div className="text-xs text-gray-500">{structure.user?.employeeCode}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">{formatCurrency(gross)}</td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">{formatCurrency(deductions)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(structure.netSalary)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openEdit(structure)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950"
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
