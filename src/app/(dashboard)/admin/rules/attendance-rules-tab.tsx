"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Save, Loader2, AlertCircle } from "lucide-react";

interface CompanySettings {
  inTime: string;
  outTime: string;
  graceMinutes: number;
  lateThreshold: number;
  saturdayOffRule: string;
  otEnabled: boolean;
  otMonths: string[];
  dutyHoursPerDay: number;
}

async function fetchSettings(): Promise<CompanySettings> {
  const res = await fetch("/api/admin/company-settings");
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export function AttendanceRulesTab() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const settingsQuery = useQuery({
    queryKey: ["company-settings"],
    queryFn: fetchSettings,
  });

  useEffect(() => {
    if (settingsQuery.data) setSettings(settingsQuery.data);
  }, [settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async (data: CompanySettings) => {
      const res = await fetch("/api/admin/company-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: (data) => {
      setSettings(data);
      setSuccess("Settings updated!");
      setError("");
      setTimeout(() => setSuccess(""), 3000);
    },
    onError: (err: Error) => {
      setError(err.message);
      setSuccess("");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    updateMutation.mutate(settings);
  }

  if (settingsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
        <p className="text-gray-500">Failed to load settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Default Office Hours</h2>
        <p className="text-sm text-gray-500">These apply to all users unless they have a shift override.</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">In-Time</label>
            <input
              type="time"
              value={settings.inTime}
              onChange={(e) => setSettings({ ...settings, inTime: e.target.value })}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Out-Time</label>
            <input
              type="time"
              value={settings.outTime}
              onChange={(e) => setSettings({ ...settings, outTime: e.target.value })}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Grace Period (minutes)</label>
            <input
              type="number"
              min="0"
              max="120"
              value={settings.graceMinutes}
              onChange={(e) => setSettings({ ...settings, graceMinutes: Math.max(0, parseInt(e.target.value) || 0) })}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <p className="mt-1 text-xs text-gray-500">Minutes after in-time before marking late</p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Late Threshold (count)</label>
            <input
              type="number"
              min="1"
              max="30"
              value={settings.lateThreshold}
              onChange={(e) => setSettings({ ...settings, lateThreshold: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <p className="mt-1 text-xs text-gray-500">Late arrivals before half-day (e.g. 3 = 4th late = half day)</p>
          </div>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400">
          <p className="font-medium">How it works:</p>
          <ul className="mt-1 ml-4 list-disc text-xs space-y-0.5">
            <li>Arrive by in-time + grace = ON TIME</li>
            <li>After grace = LATE (counted)</li>
            <li>Every (threshold+1)th late = HALF DAY</li>
          </ul>
        </div>

        {/* Saturday Off Rule */}
        <div className="border-t border-gray-200 pt-6 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Saturday Off Rule</h2>
          <p className="mt-1 text-sm text-gray-500">Staff checking in on off-Saturdays will require admin approval.</p>
          <div className="mt-4 max-w-xs">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Off Saturdays</label>
            <select
              value={settings.saturdayOffRule}
              onChange={(e) => setSettings({ ...settings, saturdayOffRule: e.target.value })}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="none">No Saturdays off</option>
              <option value="2nd_4th">2nd & 4th Saturday off</option>
              <option value="2nd">Only 2nd Saturday off</option>
              <option value="4th">Only 4th Saturday off</option>
              <option value="all">All Saturdays off</option>
            </select>
          </div>
        </div>

        {/* Overtime Settings */}
        <div className="border-t border-gray-200 pt-6 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Overtime (OT) Settings</h2>
          <p className="mt-1 text-sm text-gray-500">Enable OT pay for selected months. Rate = Net Salary ÷ (Working Days × Duty Hours).</p>

          <div className="mt-4 flex items-center gap-3">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={settings.otEnabled}
                onChange={(e) => setSettings({ ...settings, otEnabled: e.target.checked })}
                className="peer sr-only"
              />
              <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-gray-700" />
            </label>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {settings.otEnabled ? "OT Pay Enabled" : "OT Pay Disabled"}
            </span>
          </div>

          {settings.otEnabled && (
            <div className="mt-4 space-y-4">
              <div className="max-w-xs">
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Duty Hours / Day</label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  step="0.5"
                  value={settings.dutyHoursPerDay}
                  onChange={(e) => setSettings({ ...settings, dutyHoursPerDay: Math.max(1, parseFloat(e.target.value) || 8) })}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500">Standard duty hours used for OT rate calculation</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">OT-Eligible Months</label>
                <p className="mb-2 text-xs text-gray-500">Select months where overtime pay will be calculated</p>
                <OtMonthPicker
                  selected={settings.otMonths}
                  onChange={(months) => setSettings({ ...settings, otMonths: months })}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {updateMutation.isPending ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function OtMonthPicker({ selected, onChange }: { selected: string[]; onChange: (months: string[]) => void }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  function toggle(monthStr: string) {
    if (selected.includes(monthStr)) {
      onChange(selected.filter((m) => m !== monthStr));
    } else {
      onChange([...selected, monthStr].sort());
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setYear(year - 1)} className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">←</button>
        <span className="min-w-[4rem] text-center text-sm font-medium text-gray-900 dark:text-white">{year}</span>
        <button type="button" onClick={() => setYear(year + 1)} className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">→</button>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {MONTH_NAMES.map((name, idx) => {
          const monthStr = `${year}-${String(idx + 1).padStart(2, "0")}`;
          const isSelected = selected.includes(monthStr);
          return (
            <button
              key={monthStr}
              type="button"
              onClick={() => toggle(monthStr)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                isSelected
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-600"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-gray-500">{selected.length} month(s) selected</p>
      )}
    </div>
  );
}
