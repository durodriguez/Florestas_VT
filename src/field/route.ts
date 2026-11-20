/**
 * A walk to the mapped trees that still need something: a trunk size, a
 * photo, or a check of a species named only to genus. The surveyor says what
 * they are out for; the app picks the nearest trees that need it and puts them
 * in walking order, so nobody has to work out where to go next.
 *
 * The order is "nearest next" from where the surveyor stands: not the shortest
 * possible walk, but close to it for a dozen trees, and easy to follow because
 * each stop is the closest one left. Trees already visited on this device are
 * left out, so the route shrinks as the day goes on. No DOM here, so it can be
 * tested.
 */

import { distanceMeters } from '../geo';
import type { MappedTree } from './nearby';

export type Need = 'trunk' | 'photo' | 'species';

export const NEED_LABELS: Record<Need, string> = { trunk: 'Trunk size', photo: 'Photo', species: 'Species?' };

/** What a mapped tree is missing. */
export function needsOf(t: MappedTree): Need[] {
  const needs: Need[] = [];
  if (t.gone) return needs;
  if (!t.measured) needs.push('trunk');
  if (!t.photo) needs.push('photo');
  if (t.genusOnly) needs.push('species');
  return needs;
}

export interface Stop {
  tree: MappedTree;
  /** What it is missing, of what the surveyor is looking for. */
  needs: Need[];
  /** Walking distance from the previous stop, or from the surveyor for the first. */
  legM: number;
}

export interface RouteOptions {
  wants: ReadonlySet<Need>;
  /** Accessions already visited on this device. */
  visited?: ReadonlySet<string>;
  /** How many stops. A dozen or so is an hour or two of measuring. */
  limit?: number;
  /** How far out to look, in meters. */
  radiusM?: number;
}

export const ROUTE_LIMIT = 12;
export const ROUTE_RADIUS_M = 500;

export function planRoute(from: { lat: number; lng: number }, trees: MappedTree[], opts: RouteOptions): Stop[] {
  const { wants, visited = new Set(), limit = ROUTE_LIMIT, radiusM = ROUTE_RADIUS_M } = opts;
  const d = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => distanceMeters(a.lat, a.lng, b.lat, b.lng);
  const candidates = trees
    .filter((t) => !visited.has(t.id))
    .map((t) => ({ tree: t, needs: needsOf(t).filter((n) => wants.has(n)), away: d(from, t) }))
    .filter((c) => c.needs.length > 0 && c.away <= radiusM)
    .sort((a, b) => a.away - b.away)
    .slice(0, limit);

  const stops: Stop[] = [];
  let here = from;
  while (candidates.length) {
    let best = 0;
    for (let i = 1; i < candidates.length; i++) {
      if (d(here, candidates[i]!.tree) < d(here, candidates[best]!.tree)) best = i;
    }
    const next = candidates.splice(best, 1)[0]!;
    stops.push({ tree: next.tree, needs: next.needs, legM: d(here, next.tree) });
    here = next.tree;
  }
  return stops;
}

/** The walk's length in meters, from the surveyor through every stop. */
export const routeLength = (stops: Stop[]): number => stops.reduce((sum, s) => sum + s.legM, 0);

/** How many of an area's trees have a trunk size, for the progress line. */
export function coverage(trees: MappedTree[], area: string): { measured: number; total: number } {
  const here = trees.filter((t) => t.area === area);
  return { measured: here.filter((t) => t.measured).length, total: here.length };
}
