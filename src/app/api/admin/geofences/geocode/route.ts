import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getSessionOrFail,
  checkPermission,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";

const geocodeSchema = z.object({
  address: z.string().min(2, "Address is too short"),
});

export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session, "admin_geofences", "canView")) {
      return errorResponse("Forbidden", 403);
    }

    const body = await parseBody<unknown>(req);
    if (!body) return errorResponse("Invalid request body");

    const parsed = geocodeSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    const address = parsed.data.address.trim();
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=in&q=${encodeURIComponent(address)}`;

    const resp = await fetch(url, {
      headers: {
        "User-Agent": "PAMS/1.0 (attendance-geofencing)",
      },
      cache: "no-store",
    });

    if (!resp.ok) {
      return errorResponse("Failed to fetch coordinates from geocoding provider", 502);
    }

    const data = await resp.json() as Array<{ lat: string; lon: string; display_name?: string }>;
    if (!Array.isArray(data) || data.length === 0) {
      return errorResponse("No coordinates found for this address", 404);
    }

    const results = data.map((item) => ({
      latitude: Number(item.lat),
      longitude: Number(item.lon),
      displayName: item.display_name || address,
    })).filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude));

    if (results.length === 0) {
      return errorResponse("No valid coordinates found", 404);
    }

    return successResponse(results);
  } catch (err) {
    console.error("[POST /api/admin/geofences/geocode]", err);
    return errorResponse("Failed to geocode address", 500);
  }
}
