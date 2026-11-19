/**
 * What a tree is doing in a given month, from its species' calendar in
 * taxa.csv: in flower, in fall color, in fruit, evergreen, in leaf or bare.
 * Drives "Color by season" and the map's "In season" list.
 *
 * These are the species' typical months, not dates observed on campus, and
 * they carry two assumptions worth knowing:
 *
 * - Deciduous plants are in leaf May to October, Burlington's usual season.
 * - Fall color shows in October. taxa.csv records the color, not its timing.
 *
 * Only showy flowers and fruit count. Green, yellow-green and brown flowers
 * (oaks, honeylocusts, conifers' pollen) and brown or green fruit are real,
 * but not what anyone means by "in flower", so those trees show as in leaf
 * or bare instead. No DOM here, so the rules can be tested.
 */

import type { Taxon } from './types';

export type SeasonState = 'flower' | 'fall' | 'fruit' | 'evergreen' | 'leaf' | 'bare';

/** In the order the legend lists them: the showy states first. */
export const SEASON_STATES: SeasonState[] = ['flower', 'fall', 'fruit', 'evergreen', 'leaf', 'bare'];

export const SEASON_LABELS: Record<SeasonState, string> = {
  flower: 'In flower',
  fall: 'Fall color',
  fruit: 'In fruit',
  evergreen: 'Evergreen',
  leaf: 'In leaf',
  bare: 'Bare',
};

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const FLOWER: Record<string, string> = {
  white: '#f7f4ea', cream: '#efe2b0', pink: '#f19cbb', red: '#d8434e', purple: '#9b6cc4', yellow: '#f2c934',
};
const FRUIT: Record<string, string> = {
  red: '#c8323e', orange: '#e57a1f', yellow: '#e8c22c', purple: '#6d3b8f', blue: '#4166b0',
  'blue-black': '#2c3550', black: '#2b2b2b',
};
const FALL: Record<string, string> = {
  yellow: '#f0c419', orange: '#ef8a2b', red: '#d43d33', 'orange-red': '#e8602c', purple: '#8c3c6e',
  bronze: '#a8742f', 'yellow-brown': '#c9a24a', brown: '#9a7550',
};
/** The same greens as "Color by plant type", so the two modes agree. */
const EVERGREEN = '#12501a';
const LEAF = '#4ea72e';
const BARE = '#c9bfae';

const LEAF_MONTHS = new Set([5, 6, 7, 8, 9, 10]);
const FALL_MONTH = 10;

type Calendar = Pick<Taxon, 'type' | 'flowerMonths' | 'flowerColor' | 'fruitMonths' | 'fruitColor' | 'fallColor'>;

/**
 * A tree's state and color in a month (1–12). Flowers win over everything,
 * then fall color, then fruit, so a crabapple reads pink in May, yellow in
 * October and red with fruit in November.
 */
export function season(t: Calendar, month: number): { state: SeasonState; color: string } {
  const evergreen = t.type === 'evergreen-tree';
  if (!evergreen && t.flowerMonths.includes(month) && FLOWER[t.flowerColor]) {
    return { state: 'flower', color: FLOWER[t.flowerColor]! };
  }
  if (!evergreen && month === FALL_MONTH && FALL[t.fallColor]) {
    return { state: 'fall', color: FALL[t.fallColor]! };
  }
  if (t.fruitMonths.includes(month) && FRUIT[t.fruitColor]) {
    return { state: 'fruit', color: FRUIT[t.fruitColor]! };
  }
  if (evergreen) return { state: 'evergreen', color: EVERGREEN };
  if (LEAF_MONTHS.has(month)) return { state: 'leaf', color: LEAF };
  return { state: 'bare', color: BARE };
}

/** Pale enough that a white edge would lose it on a light basemap. */
export function isPale(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 215;
}

export interface SeasonSummary {
  counts: Record<SeasonState, number>;
  /** Each state's colors, most common first, for the legend's swatch. */
  colors: Record<SeasonState, string[]>;
  /** Species in flower, fall color or fruit, most trees first. */
  picks: Array<{ taxon: Taxon; state: SeasonState; color: string; n: number }>;
}

export function summarizeSeason(items: Iterable<{ taxon: Taxon }>, month: number): SeasonSummary {
  const counts = Object.fromEntries(SEASON_STATES.map((s) => [s, 0])) as Record<SeasonState, number>;
  const colorCounts = Object.fromEntries(SEASON_STATES.map((s) => [s, new Map<string, number>()])) as Record<SeasonState, Map<string, number>>;
  const picks = new Map<string, { taxon: Taxon; state: SeasonState; color: string; n: number }>();
  for (const { taxon } of items) {
    const { state, color } = season(taxon, month);
    counts[state]++;
    colorCounts[state].set(color, (colorCounts[state].get(color) ?? 0) + 1);
    if (state === 'flower' || state === 'fall' || state === 'fruit') {
      const pick = picks.get(taxon.id) ?? { taxon, state, color, n: 0 };
      pick.n++;
      picks.set(taxon.id, pick);
    }
  }
  const colors = Object.fromEntries(SEASON_STATES.map((s) => [
    s, [...colorCounts[s]].sort((a, b) => b[1] - a[1]).map(([c]) => c),
  ])) as Record<SeasonState, string[]>;
  return { counts, colors, picks: [...picks.values()].sort((a, b) => b.n - a.n) };
}

/**
 * A legend swatch: one color, or a pie of up to four, most common first,
 * for a state whose trees show their own flower, fruit or leaf colors.
 */
export function swatch(colors: string[]): string {
  const c = colors.slice(0, 4);
  if (c.length <= 1) return c[0] ?? BARE;
  const step = 100 / c.length;
  return `conic-gradient(${c.map((col, i) => `${col} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
}
