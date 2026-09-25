import type { CityTree, FilterState, Plant } from './types';

/**
 * Anything the filters can be run over: a UVM plant or a Burlington street
 * tree. The filter panel is one set of controls over one map, so a species,
 * family or campus chosen there has to thin out both layers — otherwise
 * "Show all" on a species leaves every city tree of every species standing.
 * A city tree has no `status` and needs none: only standing trees are
 * imported, so it counts as active.
 */
export type Filterable = Pick<Plant | CityTree, 'taxon' | 'collection' | 'dbhIn' | 'search'> & {
  condition: string | null;
  status?: string;
};

export function emptyFilters(): FilterState {
  return {
    q: '',
    taxon: null,
    types: new Set(),
    origins: new Set(),
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
    f.taxon !== null ||
    f.types.size > 0 ||
    f.origins.size > 0 ||
    f.conditions.size > 0 ||
    f.collections.size > 0 ||
    f.families.size > 0 ||
    f.bloomMonth !== null ||
    f.minDbh !== null ||
    f.includeRemoved
  );
}

const isWordChar = (c: string | undefined): boolean => c !== undefined && /[a-z0-9]/.test(c);

/** `term` appears in `text` as a whole word, not inside a longer one. */
function hasWord(text: string, term: string): boolean {
  for (let i = text.indexOf(term); i !== -1; i = text.indexOf(term, i + 1)) {
    if (!isWordChar(text[i - 1]) && !isWordChar(text[i + term.length])) return true;
  }
  return false;
}

/**
 * Free-text match. Every whitespace-separated term must appear in the plant's
 * haystack, so "red oak green" narrows rather than widens — the behaviour
 * people expect from a search box.
 *
 * A word the visitor has finished typing must match a whole word; only the
 * one still being typed may match part of one. Otherwise "red maple" finds
 * every maple on Redstone Campus, because "red" is inside "redstone" — and
 * searching everything a tree is known by, campus included, is the point.
 * The last word stays a part-match so results keep up while typing: "red
 * mapl" already finds the red maples, and a bare "772" still lists UVM-2772.
 */
export function matchesQuery(plant: Pick<Filterable, 'search'>, q: string): boolean {
  const query = q.toLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  // A trailing space means the last word is finished too.
  const typing = /\s$/.test(query) ? -1 : terms.length - 1;
  return terms.every((t, i) => (i === typing ? plant.search.includes(t) : hasWord(plant.search, t)));
}

/** A set filter is inactive when empty; otherwise the value must be a member. */
const inSet = (set: Set<string>, value: string | null): boolean =>
  set.size === 0 || (value !== null && set.has(value));

export function matchesFilters(plant: Filterable, f: FilterState): boolean {
  if (!f.includeRemoved && (plant.status ?? 'active') !== 'active') return false;
  // The taxon itself or one of its named varieties: "Show all" on red maple
  // includes 'Red Sunset'.
  if (f.taxon !== null && plant.taxon.id !== f.taxon && plant.taxon.parent !== f.taxon) return false;
  if (!inSet(f.types, plant.taxon.type)) return false;
  if (!inSet(f.origins, plant.taxon.origin)) return false;
  if (!inSet(f.conditions, plant.condition)) return false;
  if (!inSet(f.collections, plant.collection?.id ?? null)) return false;
  if (!inSet(f.families, plant.taxon.family)) return false;
  if (f.bloomMonth !== null && !plant.taxon.flowerMonths.includes(f.bloomMonth)) return false;
  if (f.minDbh !== null && (plant.dbhIn === null || plant.dbhIn < f.minDbh)) return false;
  if (f.q.trim() !== '' && !matchesQuery(plant, f.q)) return false;
  return true;
}

export function applyFilters<T extends Filterable>(plants: T[], f: FilterState): T[] {
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


const CSV_COLUMNS: Array<[string, (p: Plant) => unknown]> = [
  ['plant_id', (p) => p.id],
  ['scientific_name', (p) => p.taxon.sci],
  ['common_name', (p) => p.taxon.common],
  ['family', (p) => p.taxon.family],
  ['plant_type', (p) => p.taxon.type],
  ['origin', (p) => p.taxon.origin],
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
  // No notes column: a surveyor's remarks are internal, and a downloaded file
  // travels further than a panel row does.
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
