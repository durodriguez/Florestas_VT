/**
 * The two tiles at the top of a tree's page in the field guide.
 *
 * The first is the tree's size: its trunk diameter, else its height, else its
 * crown spread, else (with nothing measured) its condition. The second is
 * what it is doing this month, which every identified tree has. A tree whose
 * species is not known yet has no "right now", so it shows its condition
 * there instead, or, if that is already in the first tile, has one tile.
 *
 * Dates are the year only ("2023, 3 years ago") so a tile stays one line.
 * No DOM here, so the choice can be tested.
 */

import { measuredOn, yearsAgo } from '../measured';
import { MONTH_NAMES, SEASON_LABELS, season } from '../season';
import type { Plant } from '../types';

export interface Tile {
  label: string;
  value: string;
  /** When: "2014, 12 years ago", or the month for "Right now". */
  sub: string;
  /** For "Right now": the color of what the tree is doing. */
  dot?: string;
}

/** "2023, 3 years ago"; just "2026" while it is recent. */
export function yearText(date: string | null, now = new Date()): string {
  if (!date) return '';
  const n = yearsAgo(date, now);
  return n >= 2 ? `${date.slice(0, 4)}, ${n} years ago` : date.slice(0, 4);
}

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

export function tilesFor(p: Plant, month: number, now = new Date()): { tiles: Tile[]; conditionShown: boolean } {
  const on = measuredOn(p);
  const tiles: Tile[] = [];
  const condition = (): Tile => ({ label: 'Condition', value: cap(p.condition!), sub: yearText(p.conditionOn ?? p.surveyedOn, now) });
  let conditionShown = false;

  if (p.dbhIn !== null) tiles.push({ label: 'Trunk diameter', value: `${p.dbhIn} in`, sub: yearText(on.dbh, now) });
  else if (p.heightFt !== null) tiles.push({ label: 'Height', value: `${p.heightFt} ft`, sub: yearText(on.height, now) });
  else if (p.spreadFt !== null) tiles.push({ label: 'Crown spread', value: `${p.spreadFt} ft`, sub: yearText(on.spread, now) });
  else if (p.condition) { tiles.push(condition()); conditionShown = true; }

  if (p.taxon.id !== 'unknown') {
    const s = season(p.taxon, month);
    tiles.push({ label: 'Right now', value: SEASON_LABELS[s.state], sub: MONTH_NAMES[month - 1]!, dot: s.color });
  } else if (!conditionShown && p.condition) {
    tiles.push(condition());
    conditionShown = true;
  }
  return { tiles, conditionShown };
}
