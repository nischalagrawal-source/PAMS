import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { FeatureKey } from "@/lib/constants";
import type { Session } from "next-auth";

/**
 * Get the authenticated session or return 401
 */
type SessionSuccess = { session: Session & { user: Session["user"] }; error: null };
type SessionFailure = { session: null; error: NextResponse };
type SessionResult = SessionSuccess | SessionFailure;

export async function getSessionOrFail(): Promise<SessionResult> {
  const session = await auth() as Session | null;
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) } as SessionFailure;
  }
  return { session: session as SessionSuccess["session"], error: null } as SessionSuccess;
}

/**
 * Check if user has permission for a feature
 */
export function checkPermission(
  session: { user: { role: string; permissions?: Record<string, { canView?: boolean; canCreate?: boolean; canEdit?: boolean; canDelete?: boolean; canApprove?: boolean }> } },
  feature: FeatureKey,
  action: "canView" | "canCreate" | "canEdit" | "canDelete" | "canApprove" = "canView"
): boolean {
  if (session.user.role === "SUPER_ADMIN" || session.user.role === "ADMIN" || session.user.role === "BRANCH_ADMIN") return true;
  const permissions = session.user.permissions;
  if (!permissions) return false;
  const perm = permissions[feature];
  if (!perm) return false;
  return !!perm[action];
}

/**
 * Returns a Prisma where-clause fragment to scope user queries to the
 * correct tenancy level:
 *   SUPER_ADMIN   → no filter
 *   ADMIN         → companyId only (all branches)
 *   BRANCH_ADMIN / REVIEWER → companyId + branchId
 *   (STAFF is always own-records-only — handled in each route)
 */
export function getUserScopeFilter(
  session: { user: { role: string; companyId?: string | null; branchId?: string | null } }
) {
  const { role, companyId, branchId } = session.user;
  if (role === "SUPER_ADMIN") return {};
  if (role === "ADMIN") return { companyId: companyId! };
  return { companyId: companyId!, branchId: branchId ?? undefined };
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
