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

const createGeofenceSchema = z.object({
  label: z.string().min(1, "Label is required"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusM: z.number().min(10).max(50000),
  type: z.enum(["office", "client_site"]),
});

/**
 * GET /api/admin/geofences
 * List all geo-fences for the user's company
 */
export async function GET() {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session!, "admin_geofences", "canView")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session!.user.companyId;
    const geofences = await prisma.geoFence.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(geofences);
  } catch (err) {
    console.error("[GET /api/admin/geofences]", err);
    return errorResponse("Failed to fetch geo-fences", 500);
  }
}

/**
 * POST /api/admin/geofences
 * Create a new geo-fence
 */
export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session!, "admin_geofences", "canCreate")) {
      return errorResponse("Forbidden", 403);
    }

    const body = await parseBody<unknown>(req);
    if (!body) {
      return errorResponse("Invalid JSON body");
    }

    const parsed = createGeofenceSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return errorResponse(msg || "Validation failed");
    }

    const { label, latitude, longitude, radiusM, type } = parsed.data;
    const companyId = session!.user.companyId;

    const geofence = await prisma.geoFence.create({
      data: {
        companyId,
        label,
        latitude,
        longitude,
        radiusM,
        type,
      },
    });

    return successResponse(geofence);
  } catch (err) {
    console.error("[POST /api/admin/geofences]", err);
    return errorResponse("Failed to create geo-fence", 500);
  }
}
