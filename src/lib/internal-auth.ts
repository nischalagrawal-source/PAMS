import { NextRequest, NextResponse } from "next/server";

/**
 * Validates the X-PAMS-Key header for server-to-server internal API calls.
 * Used by the CA Website Express server to fetch HR data without user sessions.
 */
export function validateInternalKey(req: NextRequest): NextResponse | null {
  const key = req.headers.get("x-pams-key");
  if (!key || key !== process.env.PAMS_INTERNAL_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null; // null = valid
}
