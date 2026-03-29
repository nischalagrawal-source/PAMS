"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, X } from "lucide-react";

interface UserShift {
  id: string;
  userId: string;
  inTime: string;
  outTime: string;
  graceMinutes: number | null;
  label: string | null;
  user: { id: string; firstName: string; lastName: string; employeeCode: string; designation: string | null };
}

interface SimpleUser {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  designation: string | null;
}

async function fetchShifts(): Promise<UserShift[]> {
  const res = await fetch("/api/admin/user-shifts");
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function fetchUsers(): Promise<SimpleUser[]> {
  const res = await fetch("/api/admin/users?limit=500");
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return (json.data.users ?? json.data).map((u: Record<string, unknown>) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    employeeCode: u.employeeCode,
    designation: u.designation,
  }));
}

const emptyForm = { userId: "", inTime: "09:30", outTime: "18:30", graceMinutes: "", label: "" };

export function UserShiftsTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");

  const shiftsQuery = useQuery({ queryKey: ["user-shifts"], queryFn: fetchShifts });
  const usersQuery = useQuery({ queryKey: ["users-list"], queryFn: fetchUsers, enabled: showForm });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/admin/user-shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: data.userId,
          inTime: data.inTime,
          outTime: data.outTime,
          graceMinutes: data.graceMinutes ? parseInt(data.graceMinutes) : null,
          label: data.label || null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-shifts"] });
      setShowForm(false);
      setForm(emptyForm);
      setFormError("");
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/user-shifts/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user-shifts"] }),
  });

  const shifts = shiftsQuery.data ?? [];
  const users = usersQuery.data ?? [];
  // Filter out users who already have a shift override
  const existingUserIds = new Set(shifts.map((s) => s.userId));
  const availableUsers = users.filter((u) => !existingUserIds.has(u.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            Users without a shift override use the default company in/out times.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Cancel" : "Add Shift Override"}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">New Shift Override</h3>
          {formError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
              {formError}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Employee</label>
              <select
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="">Select...</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.employeeCode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">In-Time</label>
              <input
                type="time"
                value={form.inTime}
                onChange={(e) => setForm({ ...form, inTime: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Out-Time</label>
              <input
                type="time"
                value={form.outTime}
                onChange={(e) => setForm({ ...form, outTime: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Grace (min)</label>
              <input
                type="number"
                min="0"
                max="120"
                value={form.graceMinutes}
                onChange={(e) => setForm({ ...form, graceMinutes: e.target.value })}
                placeholder="Company default"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Label</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. Evening Shift"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending || !form.userId}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saveMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              Save
            </button>
          </div>
        </div>
      )}

      {/* Shifts Table */}
      {shiftsQuery.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : shifts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 py-12 text-center dark:border-gray-700">
          <p className="text-gray-500">No shift overrides set</p>
          <p className="mt-1 text-xs text-gray-400">All users follow the default company timings</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Employee</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Shift</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">In-Time</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Out-Time</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Grace</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {shifts.map((s) => (
                <tr key={s.id} className="bg-white dark:bg-gray-950">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white">{s.user.firstName} {s.user.lastName}</p>
                    <p className="text-xs text-gray-500">{s.user.employeeCode}{s.user.designation ? ` · ${s.user.designation}` : ""}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{s.label || "Custom"}</td>
                  <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">{s.inTime}</td>
                  <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">{s.outTime}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{s.graceMinutes != null ? `${s.graceMinutes} min` : "Default"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteMutation.mutate(s.id)}
                      disabled={deleteMutation.isPending}
                      className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                      title="Remove override (revert to company default)"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
