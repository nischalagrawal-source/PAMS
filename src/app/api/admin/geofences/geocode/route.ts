import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getSessionOrFail,
  checkPermission,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";

const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

const geocodeSchema = z.object({
  address: z.string().min(2, "Address is too short"),
  placeId: z.string().optional(), // If provided, fetch details for this place
});

/**
 * POST /api/admin/geofences/geocode
 * - Without placeId: returns autocomplete suggestions via Google Places
 * - With placeId: returns exact coordinates via Google Place Details
 * Falls back to Nominatim if no Google API key configured.
 */
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

    const { address, placeId } = parsed.data;

    // --- Google Place Details (when user selects a suggestion) ---
    if (placeId && GOOGLE_MAPS_KEY) {
      const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=geometry,formatted_address&key=${GOOGLE_MAPS_KEY}`;
      const detailResp = await fetch(detailUrl, { cache: "no-store" });
      const detailData = await detailResp.json() as {
        status: string;
        result?: { geometry?: { location?: { lat: number; lng: number } }; formatted_address?: string };
      };

      if (detailData.status === "OK" && detailData.result?.geometry?.location) {
        const loc = detailData.result.geometry.location;
        return successResponse([{
          latitude: loc.lat,
          longitude: loc.lng,
          displayName: detailData.result.formatted_address || address,
          placeId,
        }]);
      }
      return errorResponse("Could not get coordinates for selected place", 404);
    }

    // --- Google Places Autocomplete ---
    console.log("[GEOCODE] GOOGLE_MAPS_KEY present:", !!GOOGLE_MAPS_KEY, "length:", GOOGLE_MAPS_KEY.length);
    if (GOOGLE_MAPS_KEY) {
      const acUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(address.trim())}&components=country:in&key=${GOOGLE_MAPS_KEY}`;
      const acResp = await fetch(acUrl, { cache: "no-store" });
      const acData = await acResp.json() as {
        status: string;
        predictions?: Array<{ place_id: string; description: string }>;
        error_message?: string;
      };
      console.log("[GEOCODE] Google response status:", acData.status, acData.error_message || "");

      if (acData.status === "OK" && acData.predictions && acData.predictions.length > 0) {
        const results = acData.predictions.slice(0, 5).map((p) => ({
          latitude: 0,
          longitude: 0,
          displayName: p.description,
          placeId: p.place_id,
        }));
        return successResponse(results);
      }

      if (acData.status === "ZERO_RESULTS") {
        return errorResponse("No results found for this address", 404);
      }

      // If Google fails (invalid key, quota etc.), fall through to Nominatim
      console.warn("[GEOCODE] Google Places failed:", acData.status, "— falling back to Nominatim");
    }

    // --- Fallback: Nominatim (OpenStreetMap) ---
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=in&q=${encodeURIComponent(address.trim())}`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "PAMS/1.0 (attendance-geofencing)" },
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
