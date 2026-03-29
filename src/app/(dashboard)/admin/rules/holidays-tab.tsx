"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface Holiday {
  id: string;
  name: string;
  date: string;
  isOptional: boolean;
  createdAt: string;
}

async function fetchHolidays(year: string): Promise<Holiday[]> {
  const res = await fetch(`/api/admin/holidays?year=${year}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export function HolidaysTab() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear().toString();
  const [year, setYear] = useState(currentYear);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", date: "", isOptional: false });
  const [formError, setFormError] = useState("");

  const holidaysQuery = useQuery({
    queryKey: ["holidays", year],
    queryFn: () => fetchHolidays(year),
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/admin/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      setShowForm(false);
      setForm({ name: "", date: "", isOptional: false });
      setFormError("");
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/holidays/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["holidays"] }),
  });

  const holidays = holidaysQuery.data ?? [];
  const mandatory = holidays.filter((h) => !h.isOptional);
  const optional = holidays.filter((h) => h.isOptional);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-4">
      {/* Year Selector + Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-500" />
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            {[...Array(3)].map((_, i) => {
              const y = (parseInt(currentYear) - 1 + i).toString();
              return <option key={y} value={y}>{y}</option>;
            })}
          </select>
          <span className="text-sm text-gray-500">
            {holidays.length} holiday{holidays.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Plus size={16} />
          Add Holiday
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">New Holiday</h3>
          {formError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
              {formError}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Holiday Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Diwali"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={form.isOptional}
                  onChange={(e) => setForm({ ...form, isOptional: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Optional (restricted)
              </label>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.name || !form.date}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              Save
            </button>
            <button
              onClick={() => { setShowForm(false); setFormError(""); }}
              className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Holiday List */}
      {holidaysQuery.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : holidays.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 py-12 text-center dark:border-gray-700">
          <Calendar size={40} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500">No holidays added for {year}</p>
          <p className="mt-1 text-xs text-gray-400">Click &quot;Add Holiday&quot; to add festival leaves and public holidays</p>
        </div>
      ) : (
        <div className="space-y-4">
          {mandatory.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Mandatory Holidays ({mandatory.length})
              </h3>
              <div className="space-y-1">
                {mandatory.map((h) => (
                  <HolidayRow key={h.id} holiday={h} onDelete={(id) => deleteMutation.mutate(id)} deleting={deleteMutation.isPending} />
                ))}
              </div>
            </div>
          )}
          {optional.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Optional / Restricted ({optional.length})
              </h3>
              <div className="space-y-1">
                {optional.map((h) => (
                  <HolidayRow key={h.id} holiday={h} onDelete={(id) => deleteMutation.mutate(id)} deleting={deleteMutation.isPending} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HolidayRow({ holiday, onDelete, deleting }: { holiday: Holiday; onDelete: (id: string) => void; deleting: boolean }) {
  const isPast = new Date(holiday.date) < new Date(new Date().toDateString());

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950",
        isPast && "opacity-60"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold",
          holiday.isOptional
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        )}>
          {new Date(holiday.date).getDate()}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{holiday.name}</p>
          <p className="text-xs text-gray-500">
            {new Date(holiday.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
            {holiday.isOptional && <span className="ml-2 text-amber-600">(Optional)</span>}
          </p>
        </div>
      </div>
      <button
        onClick={() => onDelete(holiday.id)}
        disabled={deleting}
        className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
