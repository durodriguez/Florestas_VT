// Point-in-polygon, for filing a plant under the campus area it stands in.
// Pure and dependency-free so the test suite can exercise it directly.

/**
 * Ray casting: count how many times a ray east from the point crosses the ring.
 * Odd means inside. Works in degrees without projecting — campus is small
 * enough that the distortion cannot move a point across an edge.
 */
function inRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    // Strictly one endpoint above and one below, so a vertex exactly at the
    // ray's latitude is counted once rather than twice.
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Inside the outer ring and outside every hole. */
function inPolygon(lng, lat, rings) {
  if (!inRing(lng, lat, rings[0])) return false;
  return rings.slice(1).every((hole) => !inRing(lng, lat, hole));
}

/** Is [lng, lat] inside this Polygon or MultiPolygon geometry? */
export function inGeometry(lng, lat, geometry) {
  if (!geometry) return false;
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polys.some((rings) => inPolygon(lng, lat, rings));
}

/**
 * The `area_id` of the campus a point falls in, or null.
 *
 * Only `kind: 'campus'` features are considered: the boundary contains every
 * point that any campus does, so including it would match everything.
 */
export function campusAt(lng, lat, campusAreas) {
  for (const feature of campusAreas?.features ?? []) {
    if (feature.properties?.kind !== 'campus') continue;
    if (inGeometry(lng, lat, feature.geometry)) return feature.properties.area_id;
  }
  return null;
}
