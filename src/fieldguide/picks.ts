/**
 * "Around you": the few trees near the visitor worth walking to, and why.
 *
 * One of each sort where there is one: the nearest notable tree (the largest
 * trunk of its kind, the only one on campus), the nearest doing something
 * this month (in flower, fruit or fall color), and the nearest with a photo.
 * Any places left go to the next best, notable first. Never two of the same
 * kind of tree, so three red oaks in a row do not crowd out the ginkgo. If
 * too few are close, the search widens. No DOM here, so it can be tested.
 */

import { bearingDegrees, compassPoint, distanceMeters } from '../geo';
import { SEASON_LABELS, season } from '../season';
import type { Plant } from '../types';

export type PickKind = 'notable' | 'season' | 'photo';

export interface Pick {
  plant: Plant;
  kind: PickKind;
  /** Why it is worth the walk, in a few words. */
  reason: string;
  meters: number;
  /** Written-out compass point from the visitor to the tree. */
  heading: string;
}

const RANK: Record<PickKind, number> = { notable: 0, season: 1, photo: 2 };
/** Rings searched outward until enough trees are found. */
export const RADII_M = [150, 300, 600];

export function whyVisit(p: Plant, month: number): { kind: PickKind; reason: string } | null {
  if (p.notable?.length) return { kind: 'notable', reason: p.notable[0]! };
  const s = season(p.taxon, month).state;
  if (s === 'flower' || s === 'fruit' || s === 'fall') return { kind: 'season', reason: `${SEASON_LABELS[s]} now` };
  if (p.photo) return { kind: 'photo', reason: 'Photographed' };
  return null;
}

export function aroundYou(
  plants: Plant[], here: { lat: number; lng: number }, month: number, limit = 4,
): { picks: Pick[]; radius: number; within: number } {
  const standing = plants.filter((p) => p.status === 'active');
  const away = (p: Plant) => distanceMeters(here.lat, here.lng, p.lat, p.lng);
  let radius = RADII_M[0]!;
  let picks: Pick[] = [];
  for (radius of RADII_M) {
    const candidates = standing
      .map((plant) => ({ plant, why: whyVisit(plant, month), meters: away(plant) }))
      .filter((c) => c.why && c.meters <= radius)
      .sort((a, b) => RANK[a.why!.kind] - RANK[b.why!.kind] || a.meters - b.meters);
    const seen = new Set<string>();
    picks = [];
    const take = (c: (typeof candidates)[number]) => {
      if (picks.length === limit || seen.has(c.plant.taxon.id)) return false;
      seen.add(c.plant.taxon.id);
      picks.push({
        plant: c.plant, kind: c.why!.kind, reason: c.why!.reason, meters: c.meters,
        heading: compassPoint(bearingDegrees(here.lat, here.lng, c.plant.lat, c.plant.lng)),
      });
      return true;
    };
    // One of each sort first, then the rest in order of preference.
    for (const kind of ['notable', 'season', 'photo'] as PickKind[]) {
      for (const c of candidates) if (c.why!.kind === kind && take(c)) break;
    }
    for (const c of candidates) take(c);
    if (picks.length >= Math.min(limit, 3)) break;
  }
  // Nearest first on screen, now the best have been chosen.
  picks.sort((a, b) => a.meters - b.meters);
  return { picks, radius, within: standing.filter((p) => away(p) <= RADII_M[0]!).length };
}
