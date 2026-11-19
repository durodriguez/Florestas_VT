import type { ColorBy, Dataset, Plant } from './types';
import { season } from './season';
import { ageBand, measuredOn, type AgeBand } from './measured';

// Seven colors chosen by the project lead (October 2026). The two tree greens
// used to be close on purpose, "trees, two sorts", but were too hard to tell
// apart on the map: now a light green and a dark one.
const TYPE_COLORS: Record<string, string> = {
  'deciduous-tree': '#4ea72e',
  'evergreen-tree': '#12501a',
  shrub: '#666633',
  perennial: '#cc5316',
  annual: '#860000',
  vine: '#7030a0',
  grass: '#b8b400',
};

const ORIGIN_COLORS: Record<string, string> = {
  'vermont-native': '#2f7a4d',
  'vermont-invasive': '#b3452c',
  introduced: '#4a7c9b',
};

const CONDITION_COLORS: Record<string, string> = {
  excellent: '#1a7f37',
  good: '#4fa64f',
  fair: '#d4a017',
  poor: '#d1642c',
  dead: '#7c7c7c',
};

/** How old a tree's trunk measurement is (the legend says trunk only by
 * implication: height and spread follow once trees have them). Gold flags the
 * oldest, for re-measuring. */
const AGE_COLORS: Record<AgeBand, string> = {
  recent: '#1a7f37',
  older: '#8fbf4d',
  old: '#e0a400',
  none: '#b9b2a6',
};
const AGE_LABELS: Record<AgeBand, string> = {
  recent: 'Measured within 5 years',
  older: 'Measured 5 to 10 years ago',
  old: 'Measured over 10 years ago',
  none: 'Not measured yet',
};

const FALLBACK = '#6b7280';

/** Display names. The stored values stay hyphenated and lowercase. */
export const TYPE_LABELS: Record<string, string> = {
  'deciduous-tree': 'Deciduous tree',
  'evergreen-tree': 'Evergreen tree',
  shrub: 'Shrub/bush',
  perennial: 'Perennial',
  annual: 'Annual',
  vine: 'Vine/climber',
  grass: 'Grass',
};

export const ORIGIN_LABELS: Record<string, string> = {
  'vermont-native': 'Vermont native',
  'vermont-invasive': 'Vermont invasive',
  introduced: 'Introduced',
};

/** `month` (1–12) matters only for 'season'. */
export function colorFor(plant: Plant, mode: ColorBy, month = new Date().getMonth() + 1): string {
  switch (mode) {
    case 'type':
      return TYPE_COLORS[plant.taxon.type] ?? FALLBACK;
    case 'origin':
      return ORIGIN_COLORS[plant.taxon.origin] ?? FALLBACK;
    case 'condition':
      return plant.condition ? CONDITION_COLORS[plant.condition] ?? FALLBACK : FALLBACK;
    case 'collection':
      return plant.collection?.color ?? FALLBACK;
    case 'season':
      return season(plant.taxon, month).color;
    case 'measured':
      return AGE_COLORS[ageBand(measuredOn(plant).dbh)];
  }
}

/**
 * The plant types something on the map actually has, in the vocabulary's
 * order. The filter and the legend list only these, so an allowed type nothing
 * uses (annual, today) stays out of sight and comes back by itself once a
 * plant of that type is added.
 */
export function typesInUse(all: string[], items: Iterable<{ taxon: { type: string } }>): string[] {
  const used = new Set<string>();
  for (const item of items) used.add(item.taxon.type);
  return all.filter((t) => used.has(t));
}

/** Legend entries for the active colour scheme, in a stable display order. */
export function legendFor(
  mode: ColorBy, dataset: Dataset, types: string[] = dataset.vocab.plantTypes,
): Array<{ label: string; color: string }> {
  switch (mode) {
    case 'type':
      return types.map((t) => ({ label: TYPE_LABELS[t] ?? t, color: TYPE_COLORS[t] ?? FALLBACK }));
    case 'origin':
      return dataset.vocab.origins.map((o) => ({ label: ORIGIN_LABELS[o] ?? o, color: ORIGIN_COLORS[o] ?? FALLBACK }));
    case 'condition':
      return dataset.vocab.conditions.map((c) => ({ label: c, color: CONDITION_COLORS[c] ?? FALLBACK }));
    case 'collection':
      return dataset.collections.map((c) => ({ label: c.name, color: c.color }));
    case 'season':
      // Counted from what is on the map, for the month chosen: see renderLegend in main.ts.
      return [];
    case 'measured':
      return (Object.keys(AGE_LABELS) as AgeBand[]).map((b) => ({ label: AGE_LABELS[b], color: AGE_COLORS[b] }));
  }
}
