import type { ColorBy, Dataset, Plant } from './types';

const HABIT_COLORS: Record<string, string> = {
  tree: '#2f7a4d',
  conifer: '#1c5b52',
  shrub: '#8a9a2b',
  vine: '#6b5b95',
};

const NATIVE_COLORS: Record<string, string> = {
  native: '#2f7a4d',
  introduced: '#4a7c9b',
  invasive: '#b3452c',
};

const CONDITION_COLORS: Record<string, string> = {
  excellent: '#1a7f37',
  good: '#4fa64f',
  fair: '#d4a017',
  poor: '#d1642c',
  dead: '#7c7c7c',
};

const FALLBACK = '#6b7280';

export function colorFor(plant: Plant, mode: ColorBy): string {
  switch (mode) {
    case 'habit':
      return HABIT_COLORS[plant.taxon.habit] ?? FALLBACK;
    case 'native':
      return NATIVE_COLORS[plant.taxon.native] ?? FALLBACK;
    case 'condition':
      return plant.condition ? CONDITION_COLORS[plant.condition] ?? FALLBACK : FALLBACK;
    case 'collection':
      return plant.collection?.color ?? FALLBACK;
  }
}

/** Legend entries for the active colour scheme, in a stable display order. */
export function legendFor(mode: ColorBy, dataset: Dataset): Array<{ label: string; color: string }> {
  switch (mode) {
    case 'habit':
      return dataset.vocab.habits.map((h) => ({ label: h, color: HABIT_COLORS[h] ?? FALLBACK }));
    case 'native':
      return dataset.vocab.nativeStatus.map((n) => ({ label: n, color: NATIVE_COLORS[n] ?? FALLBACK }));
    case 'condition':
      return dataset.vocab.conditions.map((c) => ({ label: c, color: CONDITION_COLORS[c] ?? FALLBACK }));
    case 'collection':
      return dataset.collections.map((c) => ({ label: c.name, color: c.color }));
  }
}
