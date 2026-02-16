import type { NextAuthConfig } from "next-auth";

/**
 * Lightweight auth config for Edge Runtime (middleware).
 * Does NOT import Prisma or any Node.js-only modules.
 * Only contains callbacks and page configuration.
 */
export const authEdgeConfig: NextAuthConfig = {
  providers: [], // Providers are added in the full config (auth-config.ts)
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnAuth =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/register");
      const isApiAuth = nextUrl.pathname.startsWith("/api/auth");

      if (isApiAuth) return true;

      if (!isOnAuth) {
        // Protected route
        if (isLoggedIn) return true;
        return false; // Redirect to login
      } else if (isLoggedIn) {
        // Already logged in, redirect to dashboard
        return Response.redirect(new URL("/", nextUrl));
      }
      return true;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};
