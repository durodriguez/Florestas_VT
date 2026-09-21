/**
 * Distance and direction on the ground.
 *
 * Shared by the public map's "near me" sort and the survey app's matching of a
 * tree in front of the surveyor to one already on the map. One copy, because
 * two copies of a haversine drift the moment somebody fixes one of them.
 */

/** Great-circle distance in metres. */
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Initial bearing from the first point to the second, in degrees clockwise
 * from true north. Over the tens of metres this is used for, the difference
 * between initial and final bearing is far below what a compass point shows.
 */
export function bearingDegrees(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(aLat);
  const φ2 = toRad(bLat);
  const Δλ = toRad(bLng - aLng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const POINTS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

/**
 * A bearing as one of eight compass points, written out.
 *
 * Eight rather than sixteen: "north-northeast" is more precision than a phone
 * fix supports, and more than anyone parses while looking up at a tree.
 */
export function compassPoint(degrees: number): string {
  const i = Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
  return POINTS[i]!;
}
