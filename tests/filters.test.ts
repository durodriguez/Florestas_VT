import { describe, it, expect } from 'vitest';
import {
  applyFilters, emptyFilters, facetCounts, isFilterActive,
  matchesQuery, distanceMeters, toCsv,
} from '../src/filters';
import { expandPlants } from '../src/data';
import type { Dataset, Plant, Taxon } from '../src/types';

const taxon = (over: Partial<Taxon>): Taxon => ({
  id: 't', sci: '', common: '', family: '', genus: '', species: '', infra: '',
  cultivar: '', habit: 'tree', foliage: 'deciduous', native: 'native',
  flowerColor: '', flowerMonths: [], fruitColor: '', fruitMonths: [], fallColor: '',
  matureHeightFt: null, zones: '', wikipedia: '', description: '', count: 0, ...over,
});

const dataset = {
  vocab: {
    conditions: ['excellent', 'good', 'fair', 'poor', 'dead'],
    statuses: ['active', 'removed'],
    habits: ['tree', 'conifer', 'shrub', 'vine'],
    foliage: [], nativeStatus: [],
  },
  collections: [
    { id: 'green', name: 'University Green', color: '#154734', description: '' },
    { id: 'redstone', name: 'Redstone Campus', color: '#8c6d1f', description: '' },
  ],
  taxa: [
    taxon({ id: 'acer-saccharum', sci: 'Acer saccharum', common: 'Sugar maple', family: 'Sapindaceae', genus: 'Acer', flowerMonths: [4, 5] }),
    taxon({ id: 'pinus-strobus', sci: 'Pinus strobus', common: 'Eastern white pine', family: 'Pinaceae', genus: 'Pinus', habit: 'conifer', flowerMonths: [5, 6] }),
    taxon({ id: 'rhamnus', sci: 'Rhamnus cathartica', common: 'Common buckthorn', family: 'Rhamnaceae', genus: 'Rhamnus', habit: 'shrub', native: 'invasive' }),
  ],
} as unknown as Dataset;

// fields mirror scripts/lib/vocab.mjs PLANT_FIELDS
const fields = ['plant_id', 'taxon', 'lat', 'lng', 'collection', 'dbh_in', 'height_ft',
  'spread_ft', 'condition', 'planted_year', 'status', 'surveyed_on', 'surveyor',
  'photo', 'memorial', 'notes'];

const plants: Plant[] = expandPlants({
  fields,
  rows: [
    ['UVM-0001', 0, 44.4779, -73.1955, 0, 32, 68, 55, 1, 1908, 0, null, null, null, null, null],
    ['UVM-0002', 0, 44.4780, -73.1950, 0, 6, 20, 15, 0, 2018, 0, null, null, null, null, null],
    ['UVM-0003', 1, 44.4716, -73.1971, 1, 34, 88, 42, 1, 1895, 0, null, null, null, null, null],
    ['UVM-0004', 2, 44.4767, -73.1849, 1, null, 12, 10, 1, null, 0, null, null, null, null, null],
    ['UVM-0005', 0, 44.4770, -73.1965, 0, 29, 64, 50, 4, 1912, 1, null, null, null, null, null],
  ],
}, dataset);

describe('expandPlants', () => {
  it('resolves indices back into taxon, collection and enum values', () => {
    const p = plants[0]!;
    expect(p.taxon.common).toBe('Sugar maple');
    expect(p.collection?.name).toBe('University Green');
    expect(p.condition).toBe('good');
    expect(p.status).toBe('active');
    expect(plants[4]!.status).toBe('removed');
  });

  it('builds a lowercase search haystack covering names and accession', () => {
    expect(plants[0]!.search).toContain('sugar maple');
    expect(plants[0]!.search).toContain('acer saccharum');
    expect(plants[0]!.search).toContain('uvm-0001');
  });
});

describe('matchesQuery', () => {
  it('matches on common name, scientific name and accession', () => {
    expect(matchesQuery(plants[0]!, 'sugar')).toBe(true);
    expect(matchesQuery(plants[0]!, 'saccharum')).toBe(true);
    expect(matchesQuery(plants[0]!, 'UVM-0001')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(matchesQuery(plants[0]!, 'SUGAR MAPLE')).toBe(true);
  });

  it('requires every term, so extra words narrow the result', () => {
    expect(matchesQuery(plants[0]!, 'sugar maple')).toBe(true);
    expect(matchesQuery(plants[0]!, 'sugar pine')).toBe(false);
  });
});

describe('applyFilters', () => {
  const base = () => emptyFilters();

  it('hides removed plants by default and shows them on request', () => {
    expect(applyFilters(plants, base()).map((p) => p.id)).not.toContain('UVM-0005');
    expect(applyFilters(plants, { ...base(), includeRemoved: true })).toHaveLength(5);
  });

  it('filters by habit', () => {
    const f = { ...base(), habits: new Set(['conifer']) };
    expect(applyFilters(plants, f).map((p) => p.id)).toEqual(['UVM-0003']);
  });

  it('treats multiple values in one facet as OR', () => {
    const f = { ...base(), habits: new Set(['conifer', 'shrub']) };
    expect(applyFilters(plants, f).map((p) => p.id)).toEqual(['UVM-0003', 'UVM-0004']);
  });

  it('treats different facets as AND', () => {
    const f = { ...base(), habits: new Set(['tree']), collections: new Set(['redstone']) };
    expect(applyFilters(plants, f)).toHaveLength(0);
  });

  it('filters by minimum DBH and excludes plants with no DBH recorded', () => {
    const f = { ...base(), minDbh: 30 };
    expect(applyFilters(plants, f).map((p) => p.id)).toEqual(['UVM-0001', 'UVM-0003']);
  });

  it('filters by flowering month using the taxon calendar', () => {
    expect(applyFilters(plants, { ...base(), bloomMonth: 4 }).map((p) => p.id))
      .toEqual(['UVM-0001', 'UVM-0002']);
    expect(applyFilters(plants, { ...base(), bloomMonth: 6 }).map((p) => p.id))
      .toEqual(['UVM-0003']);
  });

  it('filters by native status', () => {
    const f = { ...base(), native: new Set(['invasive']) };
    expect(applyFilters(plants, f).map((p) => p.id)).toEqual(['UVM-0004']);
  });

  it('combines a text query with facets', () => {
    const f = { ...base(), q: 'maple', collections: new Set(['green']) };
    expect(applyFilters(plants, f).map((p) => p.id)).toEqual(['UVM-0001', 'UVM-0002']);
  });

  it('returns everything active when no filter is set', () => {
    expect(applyFilters(plants, base())).toHaveLength(4);
  });
});

describe('isFilterActive', () => {
  it('is false for a fresh state and true once anything is set', () => {
    expect(isFilterActive(emptyFilters())).toBe(false);
    expect(isFilterActive({ ...emptyFilters(), q: 'oak' })).toBe(true);
    expect(isFilterActive({ ...emptyFilters(), bloomMonth: 5 })).toBe(true);
    expect(isFilterActive({ ...emptyFilters(), habits: new Set(['tree']) })).toBe(true);
  });

  it('ignores a whitespace-only query', () => {
    expect(isFilterActive({ ...emptyFilters(), q: '   ' })).toBe(false);
  });
});

describe('facetCounts', () => {
  it('counts values across the active result set', () => {
    const counts = facetCounts(plants, emptyFilters(), 'habits', (p) => p.taxon.habit);
    expect(counts.get('tree')).toBe(2);
    expect(counts.get('conifer')).toBe(1);
    expect(counts.get('shrub')).toBe(1);
  });

  it('ignores its own facet so sibling options stay selectable', () => {
    const f = { ...emptyFilters(), habits: new Set(['conifer']) };
    const counts = facetCounts(plants, f, 'habits', (p) => p.taxon.habit);
    expect(counts.get('tree')).toBe(2);
    expect(counts.get('conifer')).toBe(1);
  });

  it('still respects the other facets', () => {
    const f = { ...emptyFilters(), collections: new Set(['redstone']) };
    const counts = facetCounts(plants, f, 'habits', (p) => p.taxon.habit);
    expect(counts.get('tree')).toBeUndefined();
    expect(counts.get('conifer')).toBe(1);
  });
});

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceMeters(44.4779, -73.1955, 44.4779, -73.1955)).toBe(0);
  });

  it('approximates a known short campus distance', () => {
    // University Green to Redstone Campus is roughly 700 m.
    const d = distanceMeters(44.4779, -73.1955, 44.4716, -73.1971);
    expect(d).toBeGreaterThan(600);
    expect(d).toBeLessThan(800);
  });
});

describe('toCsv', () => {
  it('emits a header plus one row per plant', () => {
    const lines = toCsv(plants.slice(0, 2)).split('\n');
    expect(lines[0]).toContain('plant_id,scientific_name,common_name');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('UVM-0001');
  });

  it('quotes and escapes values containing commas or quotes', () => {
    const p = { ...plants[0]!, notes: 'Large, open-grown "specimen"' };
    expect(toCsv([p])).toContain('"Large, open-grown ""specimen"""');
  });
});
