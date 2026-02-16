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

const updateParameterSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  weight: z.number().min(0).max(100).optional(),
  formula: z.enum(["HIGHER_IS_BETTER", "LOWER_IS_BETTER", "CUSTOM"]).optional(),
  dataSource: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

/**
 * PUT /api/admin/parameters/[id]
 * Update a performance parameter.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session!, "admin_parameters", "canEdit")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session!.user.companyId;

    const existing = await prisma.perfParameter.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return errorResponse("Parameter not found", 404);
    }

    const body = await parseBody<unknown>(req);
    if (!body) {
      return errorResponse("Invalid JSON body");
    }

    const parsed = updateParameterSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return errorResponse(msg || "Validation failed");
    }

    const parameter = await prisma.perfParameter.update({
      where: { id },
      data: parsed.data,
    });

    return successResponse(parameter);
  } catch (err) {
    console.error("[PUT /api/admin/parameters/[id]]", err);
    return errorResponse("Failed to update parameter", 500);
  }
}

/**
 * DELETE /api/admin/parameters/[id]
 * Delete a performance parameter.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session!, "admin_parameters", "canDelete")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session!.user.companyId;

    const existing = await prisma.perfParameter.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return errorResponse("Parameter not found", 404);
    }

    await prisma.perfParameter.delete({
      where: { id },
    });

    return successResponse(null, "Parameter deleted successfully");
  } catch (err) {
    console.error("[DELETE /api/admin/parameters/[id]]", err);
    return errorResponse("Failed to delete parameter", 500);
  }
}
