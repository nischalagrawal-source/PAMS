/**
 * Geo-fencing utilities
 * Server-side Haversine distance calculation and geo-fence validation
 */

const EARTH_RADIUS_M = 6371000; // Earth's radius in meters

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
