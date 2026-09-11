import type { ColorBy, Dataset, Plant } from './types';

// Seven hues that stay apart from each other in both themes. The two tree
// greens are deliberately close: they are the same kind of thing, and a reader
// scanning the map should see "trees, two sorts" rather than two unrelated
// categories.
const TYPE_COLORS: Record<string, string> = {
  'deciduous-tree': '#2f7a4d',
  'evergreen-tree': '#1c5b52',
  shrub: '#8a9a2b',
  perennial: '#b5651d',
  annual: '#c2185b',
  vine: '#6b5b95',
  grass: '#7a8b3a',
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

export function colorFor(plant: Plant, mode: ColorBy): string {
  switch (mode) {
    case 'type':
      return TYPE_COLORS[plant.taxon.type] ?? FALLBACK;
    case 'origin':
      return ORIGIN_COLORS[plant.taxon.origin] ?? FALLBACK;
    case 'condition':
      return plant.condition ? CONDITION_COLORS[plant.condition] ?? FALLBACK : FALLBACK;
    case 'collection':
      return plant.collection?.color ?? FALLBACK;
  }
}

/** Legend entries for the active colour scheme, in a stable display order. */
export function legendFor(mode: ColorBy, dataset: Dataset): Array<{ label: string; color: string }> {
  switch (mode) {
    case 'type':
      return dataset.vocab.plantTypes.map((t) => ({ label: TYPE_LABELS[t] ?? t, color: TYPE_COLORS[t] ?? FALLBACK }));
    case 'origin':
      return dataset.vocab.origins.map((o) => ({ label: ORIGIN_LABELS[o] ?? o, color: ORIGIN_COLORS[o] ?? FALLBACK }));
    case 'condition':
      return dataset.vocab.conditions.map((c) => ({ label: c, color: CONDITION_COLORS[c] ?? FALLBACK }));
    case 'collection':
      return dataset.collections.map((c) => ({ label: c.name, color: c.color }));
  }
}
