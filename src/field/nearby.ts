/**
 * Matching the tree in front of the surveyor to one already on the map.
 *
 * Most of campus will be mapped without ever having been tagged — a municipal
 * or sustainability-office inventory gives you a position and a species, not a
 * number on a trunk. So the tag box cannot help, and the surveyor has nothing
 * to type. Position is the one thing they and the map both have.
 *
 * The app therefore offers the nearest mapped trees and lets the surveyor pick.
 * Deliberately *offers*, rather than deciding: a phone fix under canopy is
 * routinely 5–10 m out and the map's own positions are imperfect, so the person
 * looking at the tree is better placed to choose than any rule. Three maples at
 * 8, 11 and 14 m is the ordinary case, not the hard one.
 */

import { bearingDegrees, compassPoint, distanceMeters } from '../geo';

/** One plant from public/field/trees.json, as `npm run data` writes it. */
export interface MappedTree {
  id: string;
  lat: number;
  lng: number;
  common: string;
  sci: string;
  /** Date of its most recent survey, or null if nobody has surveyed it. */
  surveyed: string | null;
}

export interface NearbyTree {
  tree: MappedTree;
  meters: number;
  /** Written-out compass point from the surveyor to the tree. */
  heading: string;
}

/**
 * How far out to look. Wide enough to cover a bad fix under a canopy, narrow
 * enough that the list stays a handful rather than a page — and narrow enough
 * that a match at the far edge looks as doubtful as it is.
 */
export const NEARBY_RADIUS_M = 25;
/** More than this is scrolling, which one-handed in the field is not use. */
export const NEARBY_LIMIT = 6;

/**
 * Mapped trees near a position, nearest first.
 *
 * Nearest first and nothing else: no ranking by species, no preferring the
 * unsurveyed. Sorting by anything but distance would quietly make one of three
 * equally plausible maples look like the right answer.
 */
export function nearbyTrees(
  lat: number,
  lng: number,
  trees: MappedTree[],
  { radiusM = NEARBY_RADIUS_M, limit = NEARBY_LIMIT } = {},
): NearbyTree[] {
  const out: NearbyTree[] = [];
  for (const tree of trees) {
    const meters = distanceMeters(lat, lng, tree.lat, tree.lng);
    if (meters > radiusM) continue;
    out.push({ tree, meters, heading: compassPoint(bearingDegrees(lat, lng, tree.lat, tree.lng)) });
  }
  out.sort((a, b) => a.meters - b.meters);
  return out.slice(0, limit);
}

/**
 * "7 m northeast". Rounded to the metre, because a phone fix does not support
 * decimals and a surveyor pacing it out does not either.
 *
 * Under 2 m the heading is dropped: a direction that close is noise, and
 * "1 m southwest" invites someone to turn around looking for it.
 */
export function describeDistance(hit: NearbyTree): string {
  const m = Math.round(hit.meters);
  return m < 2 ? `${m} m away` : `${m} m ${hit.heading}`;
}
