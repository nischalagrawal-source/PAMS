"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Smartphone, X } from "lucide-react";
import pkg from "../../package.json";

interface VersionResponse {
  version: string;
  buildTime: string;
  status?: string;
}

export function AppUpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const dismissedVersion = typeof window !== "undefined"
      ? window.localStorage.getItem("pams-update-dismissed-version")
      : null;

    const checkVersion = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const json = await res.json() as VersionResponse;
        if (!json.version) return;

        setServerVersion(json.version);

        if (json.version !== pkg.version && dismissedVersion !== json.version) {
          setUpdateAvailable(true);
        }
      } catch {
        // silent fail
      }
    };

    void checkVersion();
    const interval = setInterval(() => {
      void checkVersion();
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
      <div className="flex items-start gap-3">
        <Smartphone size={18} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">App update available</p>
          <p className="mt-1">
            A newer build is ready{serverVersion ? ` (${serverVersion})` : ""}. Refresh to get the latest attendance and mobile updates.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            <RefreshCw size={14} /> Refresh now
          </button>
        </div>
      </div>
      <button
        onClick={() => {
          setDismissed(true);
          if (serverVersion) {
            window.localStorage.setItem("pams-update-dismissed-version", serverVersion);
          }
        }}
        className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
        aria-label="Dismiss update notice"
      >
        <X size={16} />
      </button>
    </div>
  );
}
