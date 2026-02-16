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

const updateGeofenceSchema = z.object({
  label: z.string().min(1).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radiusM: z.number().min(10).max(50000).optional(),
  type: z.enum(["office", "client_site"]).optional(),
});

/**
 * PUT /api/admin/geofences/[id]
 * Update a geo-fence
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session!, "admin_geofences", "canEdit")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session!.user.companyId;

    const existing = await prisma.geoFence.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return errorResponse("Geo-fence not found", 404);
    }

    const body = await parseBody<unknown>(req);
    if (!body) {
      return errorResponse("Invalid JSON body");
    }

    const parsed = updateGeofenceSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return errorResponse(msg || "Validation failed");
    }

    const geofence = await prisma.geoFence.update({
      where: { id },
      data: parsed.data,
    });

    return successResponse(geofence);
  } catch (err) {
    console.error("[PUT /api/admin/geofences/[id]]", err);
    return errorResponse("Failed to update geo-fence", 500);
  }
}

/**
 * DELETE /api/admin/geofences/[id]
 * Delete a geo-fence
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session!, "admin_geofences", "canDelete")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session!.user.companyId;

    const existing = await prisma.geoFence.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return errorResponse("Geo-fence not found", 404);
    }

    await prisma.geoFence.delete({
      where: { id },
    });

    return successResponse(null, "Geo-fence deleted successfully");
  } catch (err) {
    console.error("[DELETE /api/admin/geofences/[id]]", err);
    return errorResponse("Failed to delete geo-fence", 500);
  }
}
