import NextAuth from "next-auth";
import { authEdgeConfig } from "@/lib/auth-edge";

export default NextAuth(authEdgeConfig).auth;

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|public|icon-.*\\.png|manifest\\.json).*)",
  ],
};
