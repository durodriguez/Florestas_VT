/**
 * A tree's year: what its species does in each month, as a strip of twelve
 * colors, and the same thing said in words ("Flowers in May. Fruit from
 * September to November. Fall color in October."). Both come from season.ts,
 * so the strip, the words and the map's colors never disagree. These are the
 * species' usual months, not dates seen on this tree. No DOM here.
 */

import { FALL_MONTH, MONTH_NAMES, season, showy, type SeasonState } from '../season';
import type { Taxon } from '../types';

type Calendar = Parameters<typeof season>[0];

export function yearOf(t: Calendar): Array<{ month: number; state: SeasonState; color: string }> {
  return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, ...season(t, i + 1) }));
}

/**
 * Months as runs, in calendar order, joining across New Year:
 * [9, 10, 11] → "September to November"; [5] → "May";
 * [11, 12, 1, 2] → "November to February"; [4, 5, 8] → "April to May and August".
 */
export function monthRuns(months: number[]): string {
  const set = new Set(months.filter((m) => m >= 1 && m <= 12));
  if (set.size === 0) return '';
  if (set.size === 12) return 'all year';
  // Start a run at a month whose month before is not in the set, so a run
  // across December and January stays whole.
  const runs: number[][] = [];
  for (let m = 1; m <= 12; m++) {
    if (!set.has(m) || set.has(m === 1 ? 12 : m - 1)) continue;
    const run = [m];
    for (let n = m === 12 ? 1 : m + 1; set.has(n); n = n === 12 ? 1 : n + 1) run.push(n);
    runs.push(run);
  }
  const name = (m: number) => MONTH_NAMES[m - 1]!;
  const parts = runs.map((r) => (r.length === 1 ? name(r[0]!) : `${name(r[0]!)} to ${name(r.at(-1)!)}`));
  return parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

/** The showy parts of the year, in the order they come. Empty when there are none. */
export function yearInWords(t: Pick<Taxon, 'type' | 'flowerMonths' | 'flowerColor' | 'fruitMonths' | 'fruitColor' | 'fallColor'>): string[] {
  const s = showy(t);
  const when = (months: number[]) => {
    const text = monthRuns(months);
    return text === 'all year' ? text : text.includes(' to ') ? `from ${text}` : `in ${text}`;
  };
  const out: Array<[number, string]> = [];
  if (s.flower) out.push([Math.min(...t.flowerMonths), `${t.flowerColor[0]!.toUpperCase()}${t.flowerColor.slice(1)} flowers ${when(t.flowerMonths)}.`]);
  if (s.fruit) out.push([Math.min(...t.fruitMonths) + 0.1, `${t.fruitColor[0]!.toUpperCase()}${t.fruitColor.slice(1)} fruit ${when(t.fruitMonths)}.`]);
  if (s.fall) out.push([FALL_MONTH + 0.2, `${t.fallColor[0]!.toUpperCase()}${t.fallColor.slice(1)} fall color in ${MONTH_NAMES[FALL_MONTH - 1]}.`]);
  return out.sort((a, b) => a[0] - b[0]).map(([, text]) => text);
}
