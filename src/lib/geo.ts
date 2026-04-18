/**
 * Geo-fencing utilities
 * Server-side Haversine distance calculation and geo-fence validation
 */

const EARTH_RADIUS_M = 6371000; // Earth's radius in meters
const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance between two GPS coordinates using the Haversine formula
 * Returns distance in meters
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}

/**
 * Check if a GPS coordinate is within a geo-fence
 */
export function isWithinGeoFence(
  userLat: number,
  userLng: number,
  fenceLat: number,
  fenceLng: number,
  fenceRadiusM: number
): boolean {
  const distance = haversineDistance(userLat, userLng, fenceLat, fenceLng);
  return distance <= fenceRadiusM;
}

/**
 * Determine location type based on distance from geo-fences
 * - Within fence = OFFICE or CLIENT_SITE (based on fence type)
 * - Within 5km = WORK_FROM_HOME
 * - Beyond 5km = UNKNOWN
 */
export function determineLocationType(
  userLat: number,
  userLng: number,
  geoFences: Array<{
    id: string;
    latitude: number;
    longitude: number;
    radiusM: number;
    type: string;
  }>,
  wfhThresholdM: number = 5000
): {
  locationType: "OFFICE" | "CLIENT_SITE" | "WORK_FROM_HOME" | "UNKNOWN";
  nearestFenceId: string | null;
  distanceFromFence: number | null;
} {
  let nearestDistance = Infinity;
  let nearestFence: (typeof geoFences)[0] | null = null;

  for (const fence of geoFences) {
    const distance = haversineDistance(
      userLat,
      userLng,
      fence.latitude,
      fence.longitude
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestFence = fence;
    }

    // If within the fence boundary
    if (distance <= fence.radiusM) {
      return {
        locationType: fence.type === "client_site" ? "CLIENT_SITE" : "OFFICE",
        nearestFenceId: fence.id,
        distanceFromFence: distance,
      };
    }
  }

  // Not inside any fence — check if within WFH range
  if (nearestFence && nearestDistance <= wfhThresholdM) {
    return {
      locationType: "WORK_FROM_HOME",
      nearestFenceId: nearestFence.id,
      distanceFromFence: nearestDistance,
    };
  }

  return {
    locationType: "UNKNOWN",
    nearestFenceId: nearestFence?.id ?? null,
    distanceFromFence: nearestFence ? nearestDistance : null,
  };
}

/**
 * Calculate distance from the nearest geo-fence boundary (not center)
 * Positive = outside fence, Negative = inside fence
 */
export function distanceFromFenceBoundary(
  userLat: number,
  userLng: number,
  fenceLat: number,
  fenceLng: number,
  fenceRadiusM: number
): number {
  const distanceFromCenter = haversineDistance(userLat, userLng, fenceLat, fenceLng);
  return distanceFromCenter - fenceRadiusM;
}

/**
 * Estimate travel distance and duration between two points.
 * Uses Google Maps Directions when configured, otherwise falls back to straight-line estimation.
 */
export async function estimateTravelMetrics(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
): Promise<{ distanceKm: number; durationMinutes: number; source: "google" | "fallback" }> {
  if (GOOGLE_MAPS_KEY) {
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=driving&departure_time=now&key=${GOOGLE_MAPS_KEY}`;
      const resp = await fetch(url, { cache: "no-store" });
      const data = await resp.json() as {
        status?: string;
        routes?: Array<{
          legs?: Array<{
            distance?: { value?: number };
            duration?: { value?: number };
          }>;
        }>;
      };

      const leg = data.routes?.[0]?.legs?.[0];
      if (resp.ok && data.status === "OK" && leg?.distance?.value && leg?.duration?.value) {
        return {
          distanceKm: Math.round((leg.distance.value / 1000) * 100) / 100,
          durationMinutes: Math.max(1, Math.round(leg.duration.value / 60)),
          source: "google",
        };
      }
    } catch (error) {
      console.warn("[GEO][TRAVEL_METRICS_FALLBACK]", error);
    }
  }

  const distanceKm = Math.round((haversineDistance(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude
  ) / 1000) * 100) / 100;

  // Conservative urban travel estimate fallback: average effective speed ~25 km/h.
  const durationMinutes = Math.max(5, Math.round((distanceKm / 25) * 60));

  return {
    distanceKm,
    durationMinutes,
    source: "fallback",
  };
}

/**
 * Check whether recorded travel time is reasonable compared with estimated route time.
 */
export function isTravelReasonable(
  actualTravelMinutes: number,
  estimatedTravelMinutes: number,
  distanceKm: number
): boolean {
  if (distanceKm <= 1) return true;
  const minimumReasonableMinutes = Math.max(5, Math.round(estimatedTravelMinutes * 0.6));
  return actualTravelMinutes >= minimumReasonableMinutes;
}
