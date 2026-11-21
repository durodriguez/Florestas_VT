/**
 * The steward console's worklists: which standing trees still need what, and
 * how the survey has gone lately. The same "missing" rules as the survey
 * app's route (src/field/route.ts), with two more that only make sense at a
 * desk: a trunk size so old it needs measuring again, and a tree whose
 * species nobody has identified. No DOM here, so it can be tested.
 */

import { measuredOn, yearsAgo } from '../measured';
import type { Plant } from '../types';

export type Need = 'trunk' | 'stale' | 'photo' | 'species' | 'unknown';

export const NEEDS: Array<{ id: Need; label: string; hint: string }> = [
  { id: 'trunk', label: 'No trunk size', hint: 'Never measured' },
  { id: 'stale', label: 'Trunk size over 10 years old', hint: 'Measured, but before 2016' },
  { id: 'photo', label: 'No photo', hint: 'Nobody has photographed it' },
  { id: 'species', label: 'Named only to genus', hint: 'A crabapple, an elm, an ash: which one?' },
  { id: 'unknown', label: 'Species not identified', hint: 'Mapped as "Unknown (TBD)"' },
];

/** How old a trunk size has to be before it is due again. */
export const STALE_YEARS = 10;

export function needsOf(p: Plant, now = new Date()): Need[] {
  if (p.status !== 'active') return [];
  const needs: Need[] = [];
  const on = measuredOn(p).dbh;
  if (p.dbhIn === null) needs.push('trunk');
  else if (on && yearsAgo(on, now) > STALE_YEARS) needs.push('stale');
  if (!p.photo) needs.push('photo');
  if (p.taxon.id === 'unknown') needs.push('unknown');
  else if (!p.taxon.species) needs.push('species');
  return needs;
}

/**
 * The standing trees that need `need`, in one campus or all, ordered by
 * campus and then accession so a printed list walks a campus in a fixed order.
 */
export function worklist(plants: Plant[], need: Need, area: string | null, now = new Date()): Plant[] {
  return plants
    .filter((p) => (!area || p.collection?.name === area) && needsOf(p, now).includes(need))
    .sort((a, b) => (a.collection?.name ?? '~').localeCompare(b.collection?.name ?? '~') || a.id.localeCompare(b.id));
}

/**
 * Survey days, newest first: how many trees were visited, how many of those
 * visits added a trunk size or a photo. Who surveyed is left out, as on the
 * public map.
 */
export function surveyDays(plants: Plant[], limit = 8): Array<{ date: string; visits: number; measured: number; photos: number }> {
  const days = new Map<string, { visits: number; measured: number; photos: number }>();
  for (const p of plants) {
    for (const o of p.history) {
      // The 2014 inventory and 2022 class rows stand for a whole year, not a day.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(o.surveyedOn) || o.surveyedOn.endsWith('-12-31')) continue;
      const d = days.get(o.surveyedOn) ?? { visits: 0, measured: 0, photos: 0 };
      d.visits++;
      if (o.dbhIn !== null) d.measured++;
      if (o.photo) d.photos++;
      days.set(o.surveyedOn, d);
    }
  }
  return [...days].sort((a, b) => b[0].localeCompare(a[0])).slice(0, limit).map(([date, d]) => ({ date, ...d }));
}
