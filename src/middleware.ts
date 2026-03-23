import NextAuth from "next-auth";
import { authEdgeConfig } from "@/lib/auth-edge";

export default NextAuth(authEdgeConfig).auth;

export const config = {
  matcher: [
    // Match all routes except the ones below
    "/((?!api/auth|api/internal|api/health|sso|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
