"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function SSOClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      router.replace("/login?error=missing_sso_token");
      return;
    }

    signIn("sso-nraco", { token, redirect: false }).then((result) => {
      if (result?.error) {
        setError("SSO authentication failed. Please contact your administrator.");
      } else {
        router.replace(result?.url || "/");
      }
    });
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-lg bg-white p-8 shadow text-center max-w-sm">
          <div className="text-red-500 mb-4 text-4xl">⚠️</div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Sign-in failed</h2>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <a
            href="/login"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Go to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        <p className="text-gray-600 text-sm">Signing you in via NRA &amp; Co portal…</p>
      </div>
    </div>
  );
}
