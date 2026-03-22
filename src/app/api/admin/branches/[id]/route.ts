import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";

const updateBranchSchema = z.object({
  name: z.string().min(1, "Branch name is required").optional(),
  code: z.string().min(1).max(10).optional(),
  isActive: z.boolean().optional(),
});

/**
 * PUT /api/admin/branches/[id]
 * Update a branch
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return errorResponse("Forbidden", 403);
    }

    const { id } = await params;
    const branch = await prisma.branch.findUnique({ where: { id } });
    if (!branch) return errorResponse("Branch not found", 404);

    // ADMIN can only manage branches within their company
    if (
      session.user.role === "ADMIN" &&
      branch.companyId !== session.user.companyId
    ) {
      return errorResponse("Forbidden", 403);
    }

    const body = await parseBody<unknown>(req);
    if (!body) return errorResponse("Invalid JSON body");

    const parsed = updateBranchSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return errorResponse(msg || "Validation failed");
    }

    const updated = await prisma.branch.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.code !== undefined ? { code: parsed.data.code.toUpperCase() } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
      include: {
        _count: { select: { users: true } },
        company: { select: { name: true, code: true } },
      },
    });

    return successResponse(updated, "Branch updated");
  } catch (err) {
    console.error("[PUT /api/admin/branches/[id]]", err);
    return errorResponse("Failed to update branch", 500);
  }
}

/**
 * DELETE /api/admin/branches/[id]
 * Delete a branch (must have no active users)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return errorResponse("Forbidden", 403);
    }

    const { id } = await params;
    const branch = await prisma.branch.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!branch) return errorResponse("Branch not found", 404);

    if (
      session.user.role === "ADMIN" &&
      branch.companyId !== session.user.companyId
    ) {
      return errorResponse("Forbidden", 403);
    }

    if (branch._count.users > 0) {
      return errorResponse(
        "Cannot delete a branch that has users. Reassign or remove users first.",
        409
      );
    }

    await prisma.branch.delete({ where: { id } });
    return successResponse(null, "Branch deleted");
  } catch (err) {
    console.error("[DELETE /api/admin/branches/[id]]", err);
    return errorResponse("Failed to delete branch", 500);
  }
}
