import { authConfig } from "@/lib/auth-config";
import NextAuth from "next-auth";
import { NextRequest } from "next/server";

function getHandler(req: NextRequest) {
  // Dynamically set the auth URL based on the incoming request's host
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const authUrl = `${proto}://${host}`;

  // Override NEXTAUTH_URL for this request
  process.env.NEXTAUTH_URL = authUrl;
  process.env.AUTH_URL = authUrl;

  const { handlers } = NextAuth(authConfig);
  return handlers;
}

export async function GET(req: NextRequest) {
  const { GET } = getHandler(req);
  return GET(req);
}

export async function POST(req: NextRequest) {
  const { POST } = getHandler(req);
  return POST(req);
}
