/**
 * Getting from here to there: how far and which way to a tree, the others of
 * a tree's species on campus, and the way along a tour. No DOM here, so it
 * can be tested.
 */

import { bearingDegrees, compassPoint, distanceMeters } from '../geo';
import type { Plant } from '../types';

type At = { lat: number; lng: number };

export function step(from: At, to: At): { meters: number; heading: string } {
  return {
    meters: distanceMeters(from.lat, from.lng, to.lat, to.lng),
    heading: compassPoint(bearingDegrees(from.lat, from.lng, to.lat, to.lng)),
  };
}

/** "85 m northeast", or "1.2 km south" past a kilometer. */
export function stepText(s: { meters: number; heading: string }): string {
  const d = s.meters < 1000 ? `${Math.round(s.meters)} m` : `${(s.meters / 1000).toFixed(1)} km`;
  return `${d} ${s.heading}`;
}

/**
 * The standing trees of the same species, nearest first. None for a tree
 * whose species is not known yet: "the others of its kind" would be every
 * unidentified tree on campus.
 */
export function othersOfItsKind(p: Plant, plants: Plant[]): Array<{ plant: Plant; meters: number; heading: string }> {
  if (p.taxon.id === 'unknown') return [];
  return plants
    .filter((o) => o !== p && o.status === 'active' && o.taxon.id === p.taxon.id)
    .map((o) => ({ plant: o, ...step(p, o) }))
    .sort((a, b) => a.meters - b.meters);
}

/**
 * The stops before and after one, walking the tour forward (1, 2, 3…) or in
 * reverse (…3, 2, 1), for a visitor who is nearer its last stop than its
 * first. Null past either end.
 */
export function neighbours(index: number, count: number, dir: 1 | -1): { prev: number | null; next: number | null } {
  const at = (i: number) => (i >= 0 && i < count ? i : null);
  return { prev: at(index - dir), next: at(index + dir) };
}
