import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  checkPermission,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";

const setPermissionsSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  permissions: z.array(
    z.object({
      feature: z.string().min(1, "Feature name is required"),
      canView: z.boolean(),
      canCreate: z.boolean(),
      canEdit: z.boolean(),
      canDelete: z.boolean(),
      canApprove: z.boolean(),
    })
  ).min(1, "At least one permission entry is required"),
});

/**
 * GET /api/admin/rights
 * Get all feature permissions for a specific user
 */
export async function GET(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session!, "admin_rights", "canView")) {
      return errorResponse("Forbidden", 403);
    }

    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return errorResponse("userId query parameter is required");
    }

    const companyId = session!.user.companyId;
    const isSuperAdmin = session!.user.role === "SUPER_ADMIN";

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        ...(isSuperAdmin ? {} : { companyId }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
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
    console.error("[GET /api/admin/rights]", err);
    return errorResponse("Failed to fetch permissions", 500);
  }
}

/**
 * POST /api/admin/rights
 * Set/update feature permissions for a user
 */
export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session!, "admin_rights", "canEdit")) {
      return errorResponse("Forbidden", 403);
    }

    const body = await parseBody<unknown>(req);
    if (!body) {
      return errorResponse("Invalid JSON body");
    }

    const parsed = setPermissionsSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return errorResponse(msg || "Validation failed");
    }

    const { userId, permissions } = parsed.data;

    const companyId = session!.user.companyId;
    const isSuperAdmin = session!.user.role === "SUPER_ADMIN";

    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        ...(isSuperAdmin ? {} : { companyId }),
      },
    });

    if (!targetUser) {
      return errorResponse("User not found", 404);
    }

    const upsertOps = permissions.map((perm) =>
      prisma.featurePermission.upsert({
        where: {
          userId_feature: {
            userId,
            feature: perm.feature,
          },
        },
        update: {
          canView: perm.canView,
          canCreate: perm.canCreate,
          canEdit: perm.canEdit,
          canDelete: perm.canDelete,
          canApprove: perm.canApprove,
        },
        create: {
          userId,
          feature: perm.feature,
          canView: perm.canView,
          canCreate: perm.canCreate,
          canEdit: perm.canEdit,
          canDelete: perm.canDelete,
          canApprove: perm.canApprove,
        },
      })
    );

    await prisma.$transaction(upsertOps);

    const updatedPermissions = await prisma.featurePermission.findMany({
      where: { userId },
      select: {
        id: true,
        feature: true,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canApprove: true,
      },
    });

    return successResponse(updatedPermissions, "Permissions updated successfully");
  } catch (err) {
    console.error("[POST /api/admin/rights]", err);
    return errorResponse("Failed to update permissions", 500);
  }
}
