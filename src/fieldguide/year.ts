/**
 * A tree's year, for its page in the field guide: a table of three rows
 * (leaves, flowers, fruit or cones) across the twelve months, each cell in
 * the color the tree shows then, and the same table in words ("Pink flowers
 * in May. Red fruit from September to November. Yellow fall color in
 * October."). These are the species' typical months from taxa.csv, not dates
 * seen on this tree, and the page says so.
 *
 * Unlike the map's "Color by season" (season.ts), which counts only what a
 * passer-by would notice, the table shows every flower and fruit in its real
 * color: a ginkgo's green flowers, a spruce's brown cones, a white oak's
 * brown acorns. No DOM here.
 */

import { EVERGREEN, FALL_MONTH, LEAF, LEAF_MONTHS, MONTH_NAMES } from '../season';
import type { Taxon } from '../types';

type Calendar = Pick<Taxon, 'type' | 'family' | 'flowerMonths' | 'flowerColor' | 'fruitMonths' | 'fruitColor' | 'fallColor'>;

/** Every color word taxa.csv uses, as the thing looks. */
const COLORS: Record<string, string> = {
  white: '#f7f4ea', cream: '#efe2b0', yellow: '#f2c934', gold: '#e0a91c', orange: '#e57a1f',
  red: '#cf3b45', pink: '#f19cbb', purple: '#8e5bb8', blue: '#4166b0', black: '#2b2b2b',
  green: '#7cae45', brown: '#8a5a33', tan: '#c8a46e', gray: '#9a9f9b', bronze: '#a8742f',
};

/**
 * A color word as CSS. A hyphenated pair ("yellow-green") is one blended
 * color (docs/DATA-MODEL.md), so it is mixed half and half. Blank or "none"
 * is no color; an unknown word is gray rather than nothing, so the month
 * still shows.
 */
export function colorOf(word: string): string | null {
  const w = (word ?? '').trim().toLowerCase();
  if (!w || w === 'none') return null;
  if (COLORS[w]) return COLORS[w]!;
  const [a, b] = w.split('-');
  if (a && b && COLORS[a] && COLORS[b]) return `color-mix(in srgb, ${COLORS[a]} 50%, ${COLORS[b]})`;
  return COLORS.gray!;
}

/** Conifers bear cones, not fruit, and the table and the words say so. */
const CONE_FAMILIES = new Set(['Pinaceae', 'Cupressaceae']);
export const fruitWord = (t: Pick<Taxon, 'family'>): 'cones' | 'fruit' => (CONE_FAMILIES.has(t.family) ? 'cones' : 'fruit');

export interface YearRow {
  label: string;
  /** Twelve months, January first: the cell's color and what it means, or null. */
  cells: Array<{ color: string; title: string } | null>;
}

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const months = <T>(f: (m: number) => T) => Array.from({ length: 12 }, (_, i) => f(i + 1));

export function yearTable(t: Calendar): YearRow[] {
  const evergreen = t.type === 'evergreen-tree';
  const fall = colorOf(t.fallColor);
  const flower = colorOf(t.flowerColor);
  const fruit = colorOf(t.fruitColor);
  const word = fruitWord(t);
  return [
    {
      label: 'Leaves',
      // In leaf from May to October, as season.ts has it, with October in the
      // fall color. An evergreen is in leaf all year and has none.
      cells: months((m) => evergreen ? { color: EVERGREEN, title: 'Evergreen' }
        : m === FALL_MONTH && fall ? { color: fall, title: `${cap(t.fallColor)} fall color` }
          : LEAF_MONTHS.has(m) ? { color: LEAF, title: 'In leaf' } : null),
    },
    { label: 'Flowers', cells: months((m) => flower && t.flowerMonths.includes(m) ? { color: flower, title: `${cap(t.flowerColor)} flowers` } : null) },
    { label: cap(word), cells: months((m) => fruit && t.fruitMonths.includes(m) ? { color: fruit, title: `${cap(t.fruitColor)} ${word}` } : null) },
  ];
}

/**
 * Months as runs, in calendar order, joining across New Year:
 * [9, 10, 11] → "September to November"; [5] → "May";
 * [11, 12, 1, 2] → "November to February"; [4, 5, 8] → "April to May and August".
 */
export function monthRuns(list: number[]): string {
  const set = new Set(list.filter((m) => m >= 1 && m <= 12));
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

/** The table in words, in the order the year goes. Empty when nothing is recorded. */
export function yearSummary(t: Calendar): string {
  const when = (list: number[]) => {
    const text = monthRuns(list);
    return text === 'all year' ? text : text.includes(' to ') ? `from ${text}` : `in ${text}`;
  };
  const parts: Array<[number, string]> = [];
  if (colorOf(t.flowerColor) && t.flowerMonths.length) {
    parts.push([Math.min(...t.flowerMonths), `${cap(t.flowerColor)} flowers ${when(t.flowerMonths)}.`]);
  }
  if (colorOf(t.fruitColor) && t.fruitMonths.length) {
    parts.push([Math.min(...t.fruitMonths) + 0.1, `${cap(t.fruitColor)} ${fruitWord(t)} ${when(t.fruitMonths)}.`]);
  }
  if (t.type !== 'evergreen-tree' && colorOf(t.fallColor)) {
    parts.push([FALL_MONTH + 0.2, `${cap(t.fallColor)} fall color in ${MONTH_NAMES[FALL_MONTH - 1]}.`]);
  }
  return parts.sort((a, b) => a[0] - b[0]).map(([, text]) => text).join(' ');
}
