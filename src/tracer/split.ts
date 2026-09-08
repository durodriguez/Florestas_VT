/**
 * Geometry for carving the campus boundary into sub-campuses.
 *
 * The insight that makes this bearable to use: the outer boundary is already
 * traced precisely, so the only edges anyone should have to draw again are the
 * *internal* ones. Intersecting a roughly-drawn shape with the unassigned
 * remainder snaps its outer side back to the real boundary, so you can scribble
 * well outside campus and still get an exact edge.
 *
 * Kept free of Leaflet and the DOM so the test suite can exercise it directly.
 */
import * as clipping from 'polygon-clipping';

/** `[lng, lat]`, GeoJSON order — the order polygon-clipping wants too. */
export type Pair = [number, number];
export type Ring = Pair[];
export type Poly = Ring[];
export type MultiPoly = Poly[];

/**
 * Slivers below this are clipping noise, not geography: a hair's overlap where
 * a drawn edge grazes the boundary. 200 m² is a small building's footprint.
 */
export const MIN_PIECE_M2 = 200;

const R = 111_320;

/** Metres² of a ring, via the shoelace formula on a local flat projection. */
export function ringAreaM2(ring: Ring): number {
  if (ring.length < 3) return 0;
  // One scale factor for the whole ring: campus is ~2 km across, so the error
  // from treating latitude as constant is far below the precision that matters.
  const k = Math.cos((ring[0]![1] * Math.PI) / 180);
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    sum += x1 * k * R * (y2 * R) - x2 * k * R * (y1 * R);
  }
  return Math.abs(sum) / 2;
}

/** Metres² of a multipolygon: outer rings less their holes. */
export function areaM2(mp: MultiPoly): number {
  return mp.reduce(
    (total, poly) =>
      total + poly.reduce((a, ring, i) => a + (i === 0 ? ringAreaM2(ring) : -ringAreaM2(ring)), 0),
    0,
  );
}

export const ACRES_PER_M2 = 1 / 4046.8564224;

export function toMultiPoly(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): MultiPoly {
  return (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates) as MultiPoly;
}

/** Back to GeoJSON, collapsing to a plain Polygon when there is only one. */
export function toGeometry(mp: MultiPoly): GeoJSON.Polygon | GeoJSON.MultiPolygon | null {
  if (mp.length === 0) return null;
  if (mp.length === 1) return { type: 'Polygon', coordinates: mp[0]! as number[][][] };
  return { type: 'MultiPolygon', coordinates: mp as number[][][][] };
}

/** Discard pieces too small to be anything but a clipping artefact. */
export function dropSlivers(mp: MultiPoly, minAreaM2 = MIN_PIECE_M2): MultiPoly {
  return mp.filter((poly) => ringAreaM2(poly[0]!) >= minAreaM2);
}

export interface CarveResult {
  /** The part of `remaining` that fell inside the drawn shape. */
  assigned: MultiPoly;
  /** What is left of `remaining` afterwards. */
  remaining: MultiPoly;
}

/**
 * Take the drawn shape out of the unassigned remainder.
 *
 * `drawn` is an open ring of at least three points; it may be sloppy, may run
 * outside the boundary, and may even cross itself — polygon-clipping normalises
 * it. An `assigned` of zero length means the shape missed the remainder
 * entirely, which is a mistake worth reporting rather than applying.
 */
export function carve(remaining: MultiPoly, drawn: Ring): CarveResult {
  if (drawn.length < 3) return { assigned: [], remaining };
  const clip: MultiPoly = [[[...drawn, drawn[0]!]]];
  return {
    assigned: dropSlivers(clipping.intersection(remaining, clip) as MultiPoly),
    remaining: dropSlivers(clipping.difference(remaining, clip) as MultiPoly),
  };
}

/** Everything in `whole` that none of `taken` has claimed. */
export function subtractAll(whole: MultiPoly, taken: MultiPoly[]): MultiPoly {
  const claimed = taken.filter((t) => t.length > 0);
  if (claimed.length === 0) return whole;
  return dropSlivers(clipping.difference(whole, ...(claimed as [MultiPoly, ...MultiPoly[]])) as MultiPoly);
}
