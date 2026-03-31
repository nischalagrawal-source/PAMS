"use client";

import { useState, useEffect } from "react";
import { MapPin, Smartphone, X, ChevronRight, Settings, Globe } from "lucide-react";

type PermStatus = "granted" | "denied" | "prompt" | "unknown";

export function LocationPermissionGuide() {
  const [status, setStatus] = useState<PermStatus>("unknown");
  const [dismissed, setDismissed] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    if (!navigator.permissions) {
      setStatus("unknown");
      return;
    }
    navigator.permissions.query({ name: "geolocation" }).then((result) => {
      setStatus(result.state as PermStatus);
      result.onchange = () => setStatus(result.state as PermStatus);
    }).catch(() => setStatus("unknown"));
  }, []);

  const requestPermission = async () => {
    setRequesting(true);
    try {
      await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      );
      setStatus("granted");
    } catch {
      setStatus("denied");
      setShowSteps(true);
    } finally {
      setRequesting(false);
    }
  };

  if (status === "granted" || dismissed) return null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
            <MapPin size={18} className="text-amber-600" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {status === "denied" ? "Location Access Blocked" : "Location Access Required"}
            </h4>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
              {status === "denied"
                ? "Location is blocked for this site. Please enable it in your browser settings to mark attendance."
                : "We need your location to verify attendance. Tap below to enable."}
            </p>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="shrink-0 rounded-md p-1 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900">
          <X size={16} />
        </button>
      </div>

      {status === "prompt" && (
        <button
          onClick={requestPermission}
          disabled={requesting}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50 sm:w-auto"
        >
          {requesting ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Requesting...
            </span>
          ) : (
            <>
              <MapPin size={16} />
              Enable Location Access
            </>
          )}
        </button>
      )}

      {status === "denied" && (
        <div className="mt-3">
          <button
            onClick={() => setShowSteps(!showSteps)}
            className="flex items-center gap-1 text-sm font-medium text-amber-700 underline dark:text-amber-300"
          >
            {showSteps ? "Hide" : "Show"} how to enable
            <ChevronRight size={14} className={showSteps ? "rotate-90 transition" : "transition"} />
          </button>

          {showSteps && (
            <div className="mt-3 space-y-3">
              {isIOS ? (
                <div className="rounded-lg bg-white p-3 dark:bg-gray-900">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                    <Smartphone size={16} />
                    iPhone / iPad (Safari)
                  </div>
                  <ol className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex gap-2"><span className="font-bold text-amber-600">1.</span> Open <strong>Settings</strong> app on your phone</li>
                    <li className="flex gap-2"><span className="font-bold text-amber-600">2.</span> Scroll down and tap <strong>Safari</strong> (or your browser)</li>
                    <li className="flex gap-2"><span className="font-bold text-amber-600">3.</span> Tap <strong>Location</strong></li>
                    <li className="flex gap-2"><span className="font-bold text-amber-600">4.</span> Select <strong>Allow</strong> or <strong>Ask</strong></li>
                    <li className="flex gap-2"><span className="font-bold text-amber-600">5.</span> Come back here and refresh the page</li>
                  </ol>
                </div>
              ) : (
                <div className="rounded-lg bg-white p-3 dark:bg-gray-900">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                    <Globe size={16} />
                    Android (Chrome)
                  </div>
                  <ol className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex gap-2"><span className="font-bold text-amber-600">1.</span> Tap the <strong>lock icon</strong> (🔒) in the address bar</li>
                    <li className="flex gap-2"><span className="font-bold text-amber-600">2.</span> Tap <strong>Permissions</strong> or <strong>Site settings</strong></li>
                    <li className="flex gap-2"><span className="font-bold text-amber-600">3.</span> Find <strong>Location</strong> and set to <strong>Allow</strong></li>
                    <li className="flex gap-2"><span className="font-bold text-amber-600">4.</span> Refresh the page</li>
                  </ol>
                  <div className="mt-3 border-t border-gray-100 pt-2 dark:border-gray-800">
                    <p className="text-xs text-gray-500">
                      <strong>Alternative:</strong> Open Chrome → <Settings size={12} className="inline" /> Menu → Settings → Site Settings → Location → find this site → Allow
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
