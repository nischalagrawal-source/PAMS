import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { FeatureKey } from "@/lib/constants";

/**
 * Get the authenticated session or return 401
 */
export async function getSessionOrFail() {
  const session = await auth();
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  }
  return { session, error: null };
}

/**
 * Check if user has permission for a feature
 */
export function checkPermission(
  session: { user: { role: string; permissions?: Record<string, { canView?: boolean; canCreate?: boolean; canEdit?: boolean; canDelete?: boolean; canApprove?: boolean }> } },
  feature: FeatureKey,
  action: "canView" | "canCreate" | "canEdit" | "canDelete" | "canApprove" = "canView"
): boolean {
  if (session.user.role === "SUPER_ADMIN" || session.user.role === "ADMIN") return true;
  const permissions = session.user.permissions;
  if (!permissions) return false;
  const perm = permissions[feature];
  if (!perm) return false;
  return !!perm[action];
}

/**
 * Standard error response
 */
export function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/**
 * Standard success response
 */
export function successResponse<T>(data: T, message?: string) {
  return NextResponse.json({ success: true, data, message });
}

/**
 * Parse JSON body safely
 */
export async function parseBody<T>(req: NextRequest): Promise<T | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
