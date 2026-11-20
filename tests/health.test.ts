import { describe, it, expect } from 'vitest';
// @ts-expect-error plain JS module, no type declarations
import { collectionHealth } from '../scripts/lib/health.mjs';

const taxa = [
  { id: 'pine', common: 'White pine', genus: 'Pinus', family: 'Pinaceae', species: 'strobus', origin: 'vermont-native' },
  { id: 'ash', common: 'Ash', genus: 'Fraxinus', family: 'Oleaceae', species: '', origin: 'vermont-native' },
  { id: 'nm', common: 'Norway maple', genus: 'Acer', family: 'Sapindaceae', species: 'platanoides', origin: 'vermont-invasive' },
  { id: 'unknown', common: 'Unknown (TBD)', genus: '', family: 'Unknown', species: '', origin: '' },
];
const dataset = { taxa, collections: [{ name: 'Central Campus' }], vocab: { conditions: ['excellent', 'good', 'fair', 'poor', 'dead'] } };
const fields = ['plant_id', 'taxon', 'collection', 'dbh_in', 'dbh_on', 'photo', 'condition', 'status', 'surveyed_on'];
const plant = (taxon: number, over: Record<string, unknown> = {}) => {
  const p: Record<string, unknown> = { plant_id: 'x', taxon, collection: 0, dbh_in: null, dbh_on: null, photo: null, condition: 1, status: 0, surveyed_on: '2023-10-01', ...over };
  return fields.map((f) => p[f]);
};

describe('collection health', () => {
  const rows = [
    plant(0, { dbh_in: 20, dbh_on: '2014' }), plant(0, { dbh_in: 12, dbh_on: '2022' }), plant(0),
    plant(1, { dbh_in: 9, surveyed_on: '2026-09-01', photo: 'a.webp' }), plant(2), plant(3), plant(0, { status: 1 }),
  ];
  const h = collectionHealth(dataset, { fields, rows }, 2026);
  it('counts standing plants only, and leaves the unknown placeholder out of diversity', () => {
    expect(h.trees).toBe(6);
    expect(h.knownTrees).toBe(5);
    expect(h.unknown).toBe(1);
    expect(h.genusOnly).toBe(1);
  });
  it('checks the 10-20-30 guideline against the most common species, genus and family', () => {
    expect(h.diversity.species).toMatchObject({ name: 'White pine', count: 3, share: 0.6, within: false });
    expect(h.diversity.family.limit).toBe(0.3);
  });
  it('counts hosts of each threat, and lists invasive species', () => {
    expect(h.threats).toEqual([expect.objectContaining({ name: 'Emerald ash borer', trees: 1 })]);
    expect(h.invasive).toEqual([['Norway maple', 1]]);
  });
  it('ages trunk measurements, and tallies each campus', () => {
    expect(h.age).toEqual({ recent: 2, older: 0, old: 1, none: 3 });
    expect(h.areas[0]).toMatchObject({ area: 'Central Campus', trees: 6, measured: 3, photo: 1, recent: 1 });
  });
});
