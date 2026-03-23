"use client";

import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Clock, Save, Loader2, AlertCircle } from "lucide-react";
import { useState } from "react";

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

export default function CompanySettingsPage() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const settingsQuery = useQuery({
    queryKey: ["company-settings"],
    queryFn: fetchSettings,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings(settingsQuery.data);
    }
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
      setSuccess("Settings updated successfully!");
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
    setError("");
    setSuccess("");
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
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
          <p className="text-gray-500">Failed to load settings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg shadow-blue-500/25">
          <Clock size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Company Settings</h1>
          <p className="text-gray-500">Configure office hours, grace period, and attendance thresholds</p>
        </div>
      </div>

      {/* Success/Error Messages */}
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

      {/* Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        {/* Office Hours Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Office Hours</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Office In-Time
              </label>
              <input
                type="time"
                value={settings.inTime}
                onChange={(e) => setSettings({ ...settings, inTime: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500">Expected arrival time (e.g., 09:30)</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Office Out-Time
              </label>
              <input
                type="time"
                value={settings.outTime}
                onChange={(e) => setSettings({ ...settings, outTime: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500">Expected departure time (e.g., 18:30)</p>
            </div>
          </div>
        </div>

        {/* Attendance Thresholds Section */}
        <div className="space-y-4 border-t border-gray-200 pt-6 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Attendance Policies</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Grace Period (minutes)
              </label>
              <input
                type="number"
                min="0"
                max="120"
                value={settings.graceMinutes}
                onChange={(e) => setSettings({ ...settings, graceMinutes: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500">Minutes allowed after in-time before marking late (e.g., 15 = 9:45)</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Late Threshold (days)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={settings.lateThreshold}
                onChange={(e) => setSettings({ ...settings, lateThreshold: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500">Number of late arrivals before marking half-day (e.g., 3 = 4th late = half day)</p>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400">
          <p className="font-medium">️ How it works:</p>
          <ul className="mt-2 space-y-1 ml-4 list-disc text-xs">
            <li>Employee arrives by in-time + grace period = ON TIME</li>
            <li>After grace period but before out-time = LATE (counted)</li>
            <li>Fourth late arrival (threshold+1) = marked as HALF DAY</li>
          </ul>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
