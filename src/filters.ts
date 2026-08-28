import type { FilterState, Plant } from './types';

export function emptyFilters(): FilterState {
  return {
    q: '',
    habits: new Set(),
    native: new Set(),
    conditions: new Set(),
    collections: new Set(),
    families: new Set(),
    bloomMonth: null,
    minDbh: null,
    includeRemoved: false,
  };
}

export function isFilterActive(f: FilterState): boolean {
  return (
    f.q.trim() !== '' ||
    f.habits.size > 0 ||
    f.native.size > 0 ||
    f.conditions.size > 0 ||
    f.collections.size > 0 ||
    f.families.size > 0 ||
    f.bloomMonth !== null ||
    f.minDbh !== null ||
    f.includeRemoved
  );
}

/**
 * Free-text match. Every whitespace-separated term must appear somewhere in the
 * plant's haystack, so "red oak green" narrows rather than widens — the
 * behaviour people expect from a search box.
 */
export function matchesQuery(plant: Plant, q: string): boolean {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  return terms.every((t) => plant.search.includes(t));
}

/** A set filter is inactive when empty; otherwise the value must be a member. */
const inSet = (set: Set<string>, value: string | null): boolean =>
  set.size === 0 || (value !== null && set.has(value));

export function matchesFilters(plant: Plant, f: FilterState): boolean {
  if (!f.includeRemoved && plant.status !== 'active') return false;
  if (!inSet(f.habits, plant.taxon.habit)) return false;
  if (!inSet(f.native, plant.taxon.native)) return false;
  if (!inSet(f.conditions, plant.condition)) return false;
  if (!inSet(f.collections, plant.collection?.id ?? null)) return false;
  if (!inSet(f.families, plant.taxon.family)) return false;
  if (f.bloomMonth !== null && !plant.taxon.flowerMonths.includes(f.bloomMonth)) return false;
  if (f.minDbh !== null && (plant.dbhIn === null || plant.dbhIn < f.minDbh)) return false;
  if (f.q.trim() !== '' && !matchesQuery(plant, f.q)) return false;
  return true;
}

export function applyFilters(plants: Plant[], f: FilterState): Plant[] {
  return plants.filter((p) => matchesFilters(p, f));
}

/**
 * Counts for one facet, computed with that facet's own selection ignored. This
 * keeps the other options in a multi-select visible and clickable after the
 * first choice, instead of every alternative dropping to zero.
 */
export function facetCounts(
  plants: Plant[],
  f: FilterState,
  facet: keyof FilterState,
  valueOf: (p: Plant) => string | null,
): Map<string, number> {
  const relaxed: FilterState = { ...f, [facet]: new Set<string>() } as FilterState;
  const counts = new Map<string, number>();
  for (const p of plants) {
    if (!matchesFilters(p, relaxed)) continue;
    const v = valueOf(p);
    if (v === null || v === '') continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return counts;
}

/** Great-circle distance in metres — used by the "near me" sort. */
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const CSV_COLUMNS: Array<[string, (p: Plant) => unknown]> = [
  ['plant_id', (p) => p.id],
  ['scientific_name', (p) => p.taxon.sci],
  ['common_name', (p) => p.taxon.common],
  ['family', (p) => p.taxon.family],
  ['habit', (p) => p.taxon.habit],
  ['native_status', (p) => p.taxon.native],
  ['collection', (p) => p.collection?.name ?? ''],
  ['lat', (p) => p.lat],
  ['lng', (p) => p.lng],
  ['dbh_in', (p) => p.dbhIn ?? ''],
  ['height_ft', (p) => p.heightFt ?? ''],
  ['spread_ft', (p) => p.spreadFt ?? ''],
  ['condition', (p) => p.condition ?? ''],
  ['planted_year', (p) => p.plantedYear ?? ''],
  ['status', (p) => p.status],
  ['surveyed_on', (p) => p.surveyedOn ?? ''],
  ['notes', (p) => p.notes ?? ''],
];

/** Serialise the current result set so staff can pull it into a spreadsheet. */
export function toCsv(plants: Plant[]): string {
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [CSV_COLUMNS.map(([h]) => h).join(',')];
  for (const p of plants) lines.push(CSV_COLUMNS.map(([, get]) => esc(get(p))).join(','));
  return lines.join('\n');
}
