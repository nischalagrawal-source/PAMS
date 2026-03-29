"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Save, Loader2, AlertCircle } from "lucide-react";

interface CompanySettings {
  inTime: string;
  outTime: string;
  graceMinutes: number;
  lateThreshold: number;
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
