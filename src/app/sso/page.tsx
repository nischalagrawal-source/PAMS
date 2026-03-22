import { Suspense } from "react";
import SSOClient from "./SSOClient";

export const metadata = { title: "Signing in…" };

function Fallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        <p className="text-gray-600 text-sm">Loading…</p>
      </div>
    </div>
  );
}

export default function SSOPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <SSOClient />
    </Suspense>
  );
}
