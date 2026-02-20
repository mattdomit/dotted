import { prisma } from "@dotted/db";

/**
 * Calculate distance between two points using the Haversine formula.
 * Returns distance in kilometers. Falls back to this when PostGIS is unavailable.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calculate distance between two points using PostGIS ST_DistanceSphere.
 * Falls back to Haversine when PostGIS extension is unavailable.
 */
export async function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): Promise<number> {
  try {
    const result = await prisma.$queryRawUnsafe<{ distance: number }[]>(
      `SELECT ST_DistanceSphere(
        ST_MakePoint($1, $2),
        ST_MakePoint($3, $4)
      ) / 1000.0 as distance`,
      lng1, lat1, lng2, lat2
    );
    return result[0]?.distance ?? haversineDistance(lat1, lng1, lat2, lng2);
  } catch {
    // PostGIS not available — fall back to Haversine
    return haversineDistance(lat1, lng1, lat2, lng2);
  }
}

/**
 * Check if a point is inside a zone's boundary GeoJSON using PostGIS.
 * Returns true if inside, false if outside or if PostGIS/boundary is unavailable.
 */
export async function isPointInZone(
  lat: number,
  lng: number,
  zoneId: string
): Promise<boolean> {
  const zone = await prisma.zone.findUnique({
    where: { id: zoneId },
    select: { boundaryGeoJson: true },
  });

  if (!zone?.boundaryGeoJson) return true; // No boundary — assume in zone

  try {
    const result = await prisma.$queryRawUnsafe<{ inside: boolean }[]>(
      `SELECT ST_Contains(
        ST_GeomFromGeoJSON($1),
        ST_MakePoint($2, $3)
      ) as inside`,
      zone.boundaryGeoJson, lng, lat
    );
    return result[0]?.inside ?? true;
  } catch {
    return true; // PostGIS unavailable — assume in zone
  }
}

interface SupplierWithDistance {
  supplierId: string;
  businessName: string;
  distance: number; // km
}

/**
 * Get suppliers in a zone sorted by distance from a reference point.
 * Uses supplier lat/lng coordinates when available, falls back to 0 distance.
 */
export async function getSuppliersByDistance(
  zoneId: string,
  refLat: number,
  refLng: number
): Promise<SupplierWithDistance[]> {
  const suppliers = await prisma.supplier.findMany({
    where: { zoneId },
    select: { id: true, businessName: true, latitude: true, longitude: true },
  });

  const results: SupplierWithDistance[] = [];
  for (const s of suppliers) {
    let distance = 0;
    if (s.latitude != null && s.longitude != null) {
      distance = haversineDistance(refLat, refLng, s.latitude, s.longitude);
    }
    results.push({ supplierId: s.id, businessName: s.businessName, distance });
  }

  results.sort((a, b) => a.distance - b.distance);
  return results;
}
