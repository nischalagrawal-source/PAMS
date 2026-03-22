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
  address: z.string().min(5, "Address is too short"),
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
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`;

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

    const first = data[0];
    const latitude = Number(first.lat);
    const longitude = Number(first.lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return errorResponse("Invalid coordinates returned by geocoding provider", 502);
    }

    return successResponse({
      latitude,
      longitude,
      displayName: first.display_name || address,
    });
  } catch (err) {
    console.error("[POST /api/admin/geofences/geocode]", err);
    return errorResponse("Failed to geocode address", 500);
  }
}
