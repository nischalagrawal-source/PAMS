"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";

export async function ssoLogin(token: string): Promise<{ error?: string }> {
  try {
    console.error("[SSO-ACTION] Starting signIn request", { tokenLength: token.length });
    await signIn("sso-nraco", { token, redirectTo: "/" });
    return {};
  } catch (e) {
    // NextAuth signIn throws NEXT_REDIRECT on success — re-throw it
    if (isRedirectError(e)) {
      console.error("[SSO-ACTION] signIn success redirect triggered");
      throw e;
    }
    if (e instanceof AuthError) {
      console.error("[SSO-ACTION] AuthError:", e.type, e.message);
      return { error: "SSO authentication failed. Please contact your administrator." };
    }
    console.error("[SSO-ACTION] Unknown error:", e);
    return { error: "An unexpected error occurred during SSO login." };
  }
}
