"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import jwt from "jsonwebtoken";

export async function ssoLogin(token: string): Promise<{ error?: string }> {
  try {
    const decoded = jwt.decode(token) as { role?: string } | null;
    const redirectTo = ["superadmin", "admin", "partner"].includes(decoded?.role || "")
      ? "/admin/companies"
      : "/";

    await signIn("sso-nraco", { token, redirectTo });
    return {};
  } catch (e) {
    // NextAuth signIn throws NEXT_REDIRECT on success — re-throw it
    if (isRedirectError(e)) throw e;
    if (e instanceof AuthError) {
      return { error: "SSO authentication failed. Please contact your administrator." };
    }
    return { error: "An unexpected error occurred during SSO login." };
  }
}
