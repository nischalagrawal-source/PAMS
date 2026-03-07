import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  checkPermission,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email("Invalid email address").optional(),
  phone: z.string().optional(),
  employeeCode: z.string().min(1).optional(),
  designation: z.string().optional(),
  department: z.string().optional(),
  workMode: z.enum(["office", "client", "hybrid"]).optional(),
  dateOfJoining: z.string().optional(),
  isActive: z.boolean().optional(),
  role: z.enum(["STAFF", "REVIEWER", "ADMIN", "SUPER_ADMIN"]).optional(),
  password: z.string().min(6).optional(),
});

/**
 * Default feature permissions by role (same logic as users/route.ts)
 */
function getDefaultPermissions(role: string) {
  const staffPerms = [
    { feature: "dashboard", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { feature: "attendance", canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: false },
    { feature: "leaves", canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: false },
    { feature: "tasks", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { feature: "salary", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
  ];

  const reviewerPerms = [
    { feature: "dashboard", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { feature: "attendance", canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: false },
    { feature: "leaves", canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: true },
    { feature: "tasks", canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true },
    { feature: "performance", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { feature: "salary", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { feature: "reports", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
  ];

  const allFeatures = [
    "dashboard", "attendance", "leaves", "tasks", "performance",
    "salary", "reports", "notifications", "admin_users", "admin_companies",
    "admin_geofences", "admin_parameters", "admin_rights", "admin_anomalies",
  ];

  const adminPerms = allFeatures.map((feature) => ({
    feature,
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canApprove: true,
  }));

  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN":
      return adminPerms;
    case "REVIEWER":
      return reviewerPerms;
    case "STAFF":
    default:
      return staffPerms;
  }
}

/**
 * GET /api/admin/users/[id]
 * Get a single user with full details and permissions
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session, "admin_users", "canView")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session.user.companyId;
    const isSuperAdmin = session.user.role === "SUPER_ADMIN";

    const user = await prisma.user.findFirst({
      where: {
        id,
        ...(isSuperAdmin ? {} : { companyId }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        employeeCode: true,
        role: true,
        designation: true,
        department: true,
        dateOfJoining: true,
        isActive: true,
        workMode: true,
        profilePhoto: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
        featurePermissions: {
          select: {
            id: true,
            feature: true,
            canView: true,
            canCreate: true,
            canEdit: true,
            canDelete: true,
            canApprove: true,
          },
        },
      },
    });

    if (!user) {
      return errorResponse("User not found", 404);
    }

    return successResponse(user);
  } catch (err) {
    console.error("[GET /api/admin/users/[id]]", err);
    return errorResponse("Failed to fetch user", 500);
  }
}

/**
 * PUT /api/admin/users/[id]
 * Update user profile
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session, "admin_users", "canEdit")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session.user.companyId;
    const isSuperAdmin = session.user.role === "SUPER_ADMIN";

    const existing = await prisma.user.findFirst({
      where: {
        id,
        ...(isSuperAdmin ? {} : { companyId }),
      },
    });

    if (!existing) {
      return errorResponse("User not found", 404);
    }

    const body = await parseBody<unknown>(req);
    if (!body) {
      return errorResponse("Invalid JSON body");
    }

    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return errorResponse(msg || "Validation failed");
    }

    const { password, role, email, employeeCode, dateOfJoining, ...rest } = parsed.data;

    const updateData: Record<string, unknown> = { ...rest };

    // Handle email change with uniqueness check
    if (email && email !== existing.email) {
      const emailExists = await prisma.user.findUnique({ where: { email } });
      if (emailExists) {
        return errorResponse("A user with this email already exists", 409);
      }
      updateData.email = email;
    }

    // Handle employeeCode change with uniqueness check
    if (employeeCode && employeeCode !== existing.employeeCode) {
      const codeExists = await prisma.user.findFirst({
        where: { companyId: existing.companyId, employeeCode, id: { not: id } },
      });
      if (codeExists) {
        return errorResponse("Employee code already exists in this company", 409);
      }
      updateData.employeeCode = employeeCode;
    }

    // Handle dateOfJoining conversion
    if (dateOfJoining !== undefined) {
      updateData.dateOfJoining = dateOfJoining ? new Date(dateOfJoining) : null;
    }

    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }

    if (role) {
      updateData.role = role;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        employeeCode: true,
        role: true,
        designation: true,
        department: true,
        dateOfJoining: true,
        isActive: true,
        workMode: true,
        profilePhoto: true,
        createdAt: true,
        featurePermissions: {
          select: {
            feature: true,
            canView: true,
            canCreate: true,
            canEdit: true,
            canDelete: true,
            canApprove: true,
          },
        },
      },
    });

    if (role && role !== existing.role) {
      await prisma.featurePermission.deleteMany({
        where: { userId: id },
      });

      const defaultPerms = getDefaultPermissions(role);
      await prisma.featurePermission.createMany({
        data: defaultPerms.map((p) => ({
          userId: id,
          ...p,
        })),
      });

      const updatedUser = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          employeeCode: true,
          role: true,
          designation: true,
          department: true,
          dateOfJoining: true,
          isActive: true,
          workMode: true,
          profilePhoto: true,
          createdAt: true,
          featurePermissions: {
            select: {
              feature: true,
              canView: true,
              canCreate: true,
              canEdit: true,
              canDelete: true,
              canApprove: true,
            },
          },
        },
      });

      return successResponse(updatedUser, "User updated with new role permissions");
    }

    return successResponse(user, "User updated successfully");
  } catch (err) {
    console.error("[PUT /api/admin/users/[id]]", err);
    return errorResponse("Failed to update user", 500);
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Soft delete — deactivate user (set isActive = false)
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session, "admin_users", "canDelete")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session.user.companyId;
    const isSuperAdmin = session.user.role === "SUPER_ADMIN";

    const existing = await prisma.user.findFirst({
      where: {
        id,
        ...(isSuperAdmin ? {} : { companyId }),
      },
    });

    if (!existing) {
      return errorResponse("User not found", 404);
    }

    if (existing.id === session.user.id) {
      return errorResponse("You cannot deactivate your own account", 400);
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return successResponse(null, "User deactivated successfully");
  } catch (err) {
    console.error("[DELETE /api/admin/users/[id]]", err);
    return errorResponse("Failed to deactivate user", 500);
  }
}
