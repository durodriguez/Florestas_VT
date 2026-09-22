import { describe, it, expect } from 'vitest';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { importCityTrees, conditionFromScore, formatAddress, recordedOn, STANDING_TREE } from '../scripts/lib/city-trees.mjs';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { fromStatePlaneFeet, inverseTransverseMercator, US_SURVEY_FOOT } from '../scripts/lib/vtsp.mjs';

describe('Vermont State Plane', () => {
  it('uses the US survey foot, not the international one', () => {
    // 68 rows of Burlington's export carry both feet and metre columns, and
    // the ratio between them is 3937/1200 on every one. Getting this wrong
    // puts every tree about 4 m out.
    expect(US_SURVEY_FOOT).toBeCloseTo(1200 / 3937, 15);
    expect(US_SURVEY_FOOT).not.toBeCloseTo(0.3048, 9);
  });

  it('returns the projection origin exactly', () => {
    // At the false easting on the central meridian the answer is known: the
    // latitude of origin and the central meridian themselves.
    const o = inverseTransverseMercator(500000, 0);
    expect(o.lat).toBeCloseTo(42.5, 7);
    expect(o.lng).toBeCloseTo(-72.5, 9);
  });

  it('puts a real Burlington record in Burlington', () => {
    // The first row of the city's export, 800 Pine St.
    const p = fromStatePlaneFeet(1453969.81589808, 714278.923916072);
    expect(p.lat).toBeGreaterThan(44.44);
    expect(p.lat).toBeLessThan(44.56);
    expect(p.lng).toBeGreaterThan(-73.29);
    expect(p.lng).toBeLessThan(-73.17);
  });

  it('agrees with the metre columns the source supplies for the same tree', () => {
    // Row from the export carrying both: feet and metres must land together.
    const feet = fromStatePlaneFeet(1460540.27, 721824.99);
    const metres = inverseTransverseMercator(445173.57, 220012.7);
    expect(feet.lat).toBeCloseTo(metres.lat, 6);
    expect(feet.lng).toBeCloseTo(metres.lng, 6);
  });
});

describe('conditionFromScore', () => {
  it('maps the four scores the clip actually contains', () => {
    expect(conditionFromScore(90)).toBe('excellent');
    expect(conditionFromScore(80)).toBe('good');
    expect(conditionFromScore(70)).toBe('fair');
    expect(conditionFromScore(50)).toBe('poor');
  });

  it('gives back nothing rather than a grade for a missing score', () => {
    expect(conditionFromScore('')).toBe('');
    expect(conditionFromScore(null)).toBe('');
    expect(conditionFromScore(0)).toBe('');
  });
});

describe('formatAddress', () => {
  it('writes the city\'s lowercase fields the way a person would', () => {
    expect(formatAddress('284', 'east av')).toBe('284 East Ave');
    expect(formatAddress('0', 'main st')).toBe('0 Main St');
  });

  it('copes with a missing number or street', () => {
    expect(formatAddress('', 'colchester av')).toBe('Colchester Ave');
    expect(formatAddress('12', '')).toBe('');
  });
});

describe('recordedOn', () => {
  it('keeps the date and drops the time', () => {
    expect(recordedOn('2024/02/21 15:06:22+00')).toBe('2024-02-21');
    expect(recordedOn('2014-04-15 00:00:00')).toBe('2014-04-15');
  });

  it('gives back nothing for anything else', () => {
    expect(recordedOn('')).toBe('');
    expect(recordedOn('sometime')).toBe('');
  });
});

describe('importCityTrees', () => {
  const speciesLookup = new Map<string, string | null>([
    ['tilia cordata', 'tilia-cordata'],
    ['acer saccharum', 'acer-saccharum'],
    ['unknown', null],
  ]);

  // A box over the middle of campus, in degrees.
  const campusAreas = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { kind: 'campus', area_id: 'central' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-73.20, 44.470], [-73.19, 44.470], [-73.19, 44.480], [-73.20, 44.480], [-73.20, 44.470]]],
      },
    }],
  };

  // Real rows from Burlington's export. This one lands at 44.479351,
  // -73.191647, inside the box above.
  const ON_CAMPUS = { X: '1459892.65313375', Y: '722227.040565737' };
  // 44.457411, -73.214071 — Burlington's South End, nowhere near campus.
  const OFF_CAMPUS = { X: '1453969.81589808', Y: '714278.923916072' };

  const row = (over: Record<string, string> = {}) => ({
    ...ON_CAMPUS,
    site_id: '886',
    site_typ: STANDING_TREE,
    botanic: 'Tilia cordata',
    diameter: '14',
    conditn: '80',
    planted: '2012',
    add_num: '284',
    add_str: 'east av',
    modified: '2014-04-15 00:00:00',
    GlobalID: '{AAAA}',
    ...over,
  });

  const run = (rows: unknown[]) => importCityTrees({ rows, speciesLookup, campusAreas });

  it('keeps a standing street tree inside the boundary', () => {
    const r = run([row()]);
    expect(r.inserts).toHaveLength(1);
    expect(r.inserts[0]).toMatchObject({
      city_id: 'BTV-886',
      taxon_id: 'tilia-cordata',
      collection_id: 'central',
      dbh_in: '14',
      condition: 'good',
      planted_year: '2012',
      address: '284 East Ave',
      recorded_on: '2014-04-15',
      source_id: '{AAAA}',
    });
  });

  it('gives a city tree a BTV id, never an accession', () => {
    // The whole point of the separate file: nothing here can look like a
    // UVM accession, so nothing downstream can mistake it for one.
    expect(run([row()]).inserts[0].city_id).toMatch(/^BTV-/);
    expect(run([row()]).inserts[0].city_id).not.toMatch(/UVM/);
  });

  it('drops the 14,000 trees that are nowhere near campus', () => {
    const r = run([row(OFF_CAMPUS)]);
    expect(r.inserts).toHaveLength(0);
    expect(r.summary.offCampus).toBe(1);
    // Not "skipped": there is nothing wrong with them, they are just not ours.
    expect(r.summary.skipped).toBe(0);
  });

  it('leaves out stumps, removals and vacant planting sites', () => {
    const r = run([row({ site_typ: 'S' }), row({ site_typ: 'R' }), row({ site_typ: 'P' })]);
    expect(r.inserts).toHaveLength(0);
    expect(r.summary.skipped).toBe(3);
  });

  it('leaves out a tree whose species is not a species', () => {
    const r = run([row({ botanic: 'Unknown' }), row({ botanic: '' })]);
    expect(r.inserts).toHaveLength(0);
    expect(r.unknownSpecies.size).toBe(0); // both are known non-species
  });

  it('reports a species name nobody has classified, without stopping', () => {
    const r = run([row({ botanic: 'Quercus imaginaria' }), row({ site_id: '887' })]);
    expect(r.inserts).toHaveLength(1);           // the good one still comes in
    expect(r.unknownSpecies.get('Quercus imaginaria')).toBe(1);
  });

  it('refuses a second tree on one site_id', () => {
    const r = run([row(), row({ GlobalID: '{BBBB}' })]);
    expect(r.inserts).toHaveLength(1);
    expect(r.summary.skipped).toBe(1);
  });

  it('sorts by id, so a refresh diffs cleanly', () => {
    const r = run([row({ site_id: '900' }), row({ site_id: '88' }), row({ site_id: '9' })]);
    expect(r.inserts.map((t: any) => t.city_id)).toEqual(['BTV-9', 'BTV-88', 'BTV-900']);
  });

  it('leaves a diameter of zero blank rather than recording nought inches', () => {
    expect(run([row({ diameter: '0' })]).inserts[0].dbh_in).toBe('');
  });

  it('leaves out a planting year that is not one', () => {
    expect(run([row({ planted: '0' })]).inserts[0].planted_year).toBe('');
    expect(run([row({ planted: '' })]).inserts[0].planted_year).toBe('');
  });
});
