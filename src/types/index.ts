import type { UserRole } from "@/generated/prisma/client";
import type { FeatureKey } from "@/lib/constants";

/**
 * Extended session user with company and permission info
 */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  companyId: string;
  companyName: string;
  employeeCode: string;
  profilePhoto?: string | null;
  permissions: Record<FeatureKey, Permission>;
}

export interface Permission {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
}

/**
 * Check if user has a specific permission for a feature
 */
export function hasPermission(
  user: SessionUser,
  feature: FeatureKey,
  action: keyof Permission = "canView"
): boolean {
  // Super admin has all permissions
  if (user.role === "SUPER_ADMIN") return true;

  const perm = user.permissions[feature];
  if (!perm) return false;
  return perm[action];
}

/**
 * Sidebar nav item type
 */
export interface NavItem {
  title: string;
  href: string;
  icon: string;
  feature: FeatureKey;
  children?: NavItem[];
}
