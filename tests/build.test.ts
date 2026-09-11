import { describe, it, expect } from 'vitest';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { buildDataset } from '../scripts/lib/build.mjs';

const config = { map: { bounds: [[44.45, -73.23], [44.5, -73.155]] } };

const taxon = (over: Record<string, string> = {}) => ({
  taxon_id: 'acer-saccharum',
  scientific_name: 'Acer saccharum',
  common_name: 'Sugar maple',
  family: 'Sapindaceae',
  genus: 'Acer',
  species: 'saccharum',
  plant_type: 'deciduous-tree',
  foliage: 'deciduous',
  native_status: 'native',
  flower_months: '4,5',
  mature_height_ft: '75',
  ...over,
});

const plant = (over: Record<string, string> = {}) => ({
  plant_id: 'UVM-0001',
  taxon_id: 'acer-saccharum',
  lat: '44.4779',
  lng: '-73.1956',
  collection_id: 'green',
  ...over,
});

const observation = (over: Record<string, string> = {}) => ({
  plant_id: 'UVM-0001',
  surveyed_on: '2026-09-01',
  surveyor: 'EMR',
  condition: 'good',
  status: 'active',
  ...over,
});

const collection = { collection_id: 'green', name: 'University Green', color: '#154734' };

/** A closed, correctly wound ring inside the configured map bounds. */
const ring = [
  [-73.198, 44.476], [-73.193, 44.476], [-73.193, 44.480], [-73.198, 44.480], [-73.198, 44.476],
];

const area = (props: Record<string, unknown> = {}, geometry: unknown = { type: 'Polygon', coordinates: [ring] }) => ({
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { area_id: 'central', name: 'Central Campus', kind: 'campus', color: '#154734', ...props },
    geometry,
  }],
});

const build = (over: Partial<Parameters<typeof buildDataset>[0]> = {}) =>
  buildDataset({
    taxaRows: [taxon()],
    plantRows: [plant()],
    observationRows: [observation()],
    collectionRows: [collection],
    trails: { type: 'FeatureCollection', features: [] },
    campusAreas: { type: 'FeatureCollection', features: [] },
    config,
    ...over,
  });

const field = (r: { plants: { fields: string[]; rows: unknown[][] } }, i: number, name: string) =>
  r.plants.rows[i]![r.plants.fields.indexOf(name)];

describe('buildDataset — observations', () => {
  it('shows the most recent observation, not the first', () => {
    const r = build({
      observationRows: [
        observation({ surveyed_on: '2026-09-01', dbh_in: '12', condition: 'good' }),
        observation({ surveyed_on: '2028-10-14', dbh_in: '16', condition: 'fair' }),
      ],
    });
    expect(r.errors).toEqual([]);
    expect(field(r, 0, 'dbh_in')).toBe(16);
    expect(field(r, 0, 'surveyed_on')).toBe('2028-10-14');
    expect(field(r, 0, 'surveys')).toBe(2);
  });

  it('orders by date, not by row order', () => {
    const r = build({
      observationRows: [
        observation({ surveyed_on: '2028-10-14', dbh_in: '16' }),
        observation({ surveyed_on: '2026-09-01', dbh_in: '12' }),
      ],
    });
    expect(field(r, 0, 'dbh_in')).toBe(16);
    expect(r.plants.history['UVM-0001']!.map((o: unknown[]) => o[0]))
      .toEqual(['2026-09-01', '2028-10-14']);
  });

  it('keeps the whole series for a plant surveyed more than once', () => {
    const r = build({
      observationRows: [
        observation({ surveyed_on: '2026-09-01', dbh_in: '12' }),
        observation({ surveyed_on: '2028-10-14', dbh_in: '16' }),
      ],
    });
    const series = r.plants.history['UVM-0001'];
    expect(series).toHaveLength(2);
    expect(series[0]![r.plants.observationFields.indexOf('dbh_in')]).toBe(12);
  });

  it('sends no history for a plant surveyed once — the row already says it', () => {
    const r = build();
    expect(r.plants.history).toEqual({});
    expect(field(r, 0, 'surveys')).toBe(1);
  });

  it('accepts a mapped plant nobody has surveyed yet', () => {
    const r = build({ observationRows: [] });
    expect(r.errors).toEqual([]);
    expect(field(r, 0, 'surveyed_on')).toBeNull();
    expect(field(r, 0, 'condition')).toBe(-1);
    expect(field(r, 0, 'surveys')).toBe(0);
    expect(r.dataset.counts.unsurveyed).toBe(1);
    // Still a live tree on the map, and still counted for its species.
    expect(r.dataset.counts.active).toBe(1);
  });

  it('takes status from the latest observation, so a removal is the last word', () => {
    const r = build({
      observationRows: [
        observation({ surveyed_on: '2026-09-01', status: 'active' }),
        observation({ surveyed_on: '2029-06-02', status: 'removed', condition: 'dead' }),
      ],
    });
    expect(r.dataset.counts.active).toBe(0);
    expect(r.dataset.taxa[0]!.count).toBe(0);
  });

  it('rejects an observation of a plant that is not in plants.csv', () => {
    const r = build({ observationRows: [observation({ plant_id: 'UVM-9999' })] });
    expect(r.errors.join()).toMatch(/UVM-9999.*no matching row in plants.csv/);
  });

  it('rejects two observations of one plant on one day', () => {
    const r = build({
      observationRows: [observation({ dbh_in: '12' }), observation({ dbh_in: '16' })],
    });
    expect(r.errors.join()).toMatch(/already has an observation dated 2026-09-01/);
  });

  it('rejects a date it cannot sort by', () => {
    // "2026-9-1" would sort after "2026-10-14" and quietly make the older
    // reading the current one.
    const r = build({ observationRows: [observation({ surveyed_on: '2026-9-1' })] });
    expect(r.errors.join()).toMatch(/must be a date as YYYY-MM-DD/);
  });

  it('requires a survey date', () => {
    const r = build({ observationRows: [observation({ surveyed_on: '' })] });
    expect(r.errors.join()).toMatch(/missing required field "surveyed_on"/);
  });

  it('sends a measurement left on a plants.csv row back where it belongs', () => {
    const r = build({ plantRows: [plant({ dbh_in: '20' })] });
    expect(r.errors.join()).toMatch(/"dbh_in" belongs in observations.csv/);
  });
});

describe('buildDataset', () => {
  it('builds a clean dataset with no errors', () => {
    const r = build();
    expect(r.errors).toEqual([]);
    expect(r.dataset.counts).toMatchObject({ taxa: 1, plants: 1, active: 1 });
    expect(r.plants.rows).toHaveLength(1);
  });

  it('resolves taxon and collection to array indices', () => {
    const r = build();
    const row = r.plants.rows[0];
    expect(row[r.plants.fields.indexOf('taxon')]).toBe(0);
    expect(row[r.plants.fields.indexOf('collection')]).toBe(0);
  });

  it('rejects a plant whose taxon_id has no taxa.csv row', () => {
    const r = build({ plantRows: [plant({ taxon_id: 'quercus-rubra' })] });
    expect(r.errors.join()).toMatch(/quercus-rubra.*no matching row/);
    expect(r.plants.rows).toHaveLength(0);
  });

  it('rejects duplicate plant accession numbers', () => {
    const r = build({ plantRows: [plant(), plant()] });
    expect(r.errors.join()).toMatch(/duplicate plant_id "UVM-0001"/);
  });

  it('rejects duplicate taxon ids', () => {
    const r = build({ taxaRows: [taxon(), taxon()] });
    expect(r.errors.join()).toMatch(/duplicate taxon_id/);
  });

  it('rejects a non-numeric coordinate', () => {
    const r = build({ plantRows: [plant({ lat: 'about 44.5' })] });
    expect(r.errors.join()).toMatch(/lat\/lng must both be numbers/);
  });

  it('rejects a condition outside the controlled vocabulary', () => {
    const r = build({ observationRows: [observation({ condition: 'pretty good' })] });
    expect(r.errors.join()).toMatch(/condition "pretty good" is not one of/);
  });

  it('rejects an unknown collection_id', () => {
    const r = build({ plantRows: [plant({ collection_id: 'nowhere' })] });
    expect(r.errors.join()).toMatch(/collection_id "nowhere" has no matching row/);
  });

  it('rejects a taxon missing a required field', () => {
    const r = build({ taxaRows: [taxon({ family: '' })] });
    expect(r.errors.join()).toMatch(/missing required field "family"/);
  });

  it('warns, but does not fail, on coordinates outside campus bounds', () => {
    const r = build({ plantRows: [plant({ lat: '40.7128', lng: '-74.0060' })] });
    expect(r.errors).toEqual([]);
    expect(r.warnings.join()).toMatch(/outside the campus bounds/);
  });

  it('normalises enum casing and spacing', () => {
    const r = build({ taxaRows: [taxon({ origin: 'Vermont Native' })] });
    expect(r.errors).toEqual([]);
    expect(r.dataset.taxa[0].origin).toBe('vermont-native');
  });

  it('accepts every plant type and rejects anything else', () => {
    for (const t of ['deciduous-tree', 'evergreen-tree', 'shrub', 'perennial', 'annual', 'vine', 'grass']) {
      expect(build({ taxaRows: [taxon({ plant_type: t })] }).errors).toEqual([]);
    }
    // The old vocabulary, which conflated a conifer with an evergreen.
    expect(build({ taxaRows: [taxon({ plant_type: 'conifer' })] }).errors.join())
      .toMatch(/plant_type "conifer" is not one of/);
  });

  it('rejects an origin outside the three values', () => {
    expect(build({ taxaRows: [taxon({ origin: 'naturalised' })] }).errors.join())
      .toMatch(/origin "naturalised" is not one of/);
  });

  it('parses flowering months into a numeric list and drops junk', () => {
    const r = build({ taxaRows: [taxon({ flower_months: '4, 5; 13, x' })] });
    expect(r.dataset.taxa[0].flowerMonths).toEqual([4, 5]);
  });

  it('counts only active plants toward a taxon total', () => {
    const r = build({
      plantRows: [plant(), plant({ plant_id: 'UVM-0002' })],
      observationRows: [observation(), observation({ plant_id: 'UVM-0002', status: 'removed' })],
    });
    expect(r.dataset.taxa[0].count).toBe(1);
    expect(r.dataset.counts).toMatchObject({ plants: 2, active: 1 });
  });

  it('treats a blank status as active', () => {
    const r = build({ observationRows: [observation({ status: '' })] });
    expect(r.errors).toEqual([]);
    expect(r.dataset.counts.active).toBe(1);
  });

  it('summarises unreferenced taxa in one warning rather than one each', () => {
    const many = Array.from({ length: 8 }, (_, i) => taxon({ taxon_id: `t${i}`, scientific_name: `Genus sp${i}` }));
    const r = build({ taxaRows: [taxon(), ...many] });
    const unused = r.warnings.filter((w: string) => /not referenced by any active plant/.test(w));
    expect(unused).toHaveLength(1);
    expect(unused[0]).toMatch(/8 taxa are not referenced/);
    expect(r.errors).toEqual([]);
  });

  it('warns when a trail stop is not a known accession', () => {
    const r = build({
      trails: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { stops: ['UVM-0001', 'UVM-9999'] },
          geometry: { type: 'LineString', coordinates: [[-73.19, 44.47], [-73.18, 44.48]] },
        }],
      },
    });
    expect(r.warnings.join()).toMatch(/UVM-9999.*not a plant_id/);
    expect(r.errors).toEqual([]);
  });

  it('rejects a trail that is not a LineString', () => {
    const r = build({
      trails: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { stops: [] },
          geometry: { type: 'Point', coordinates: [-73.19, 44.47] },
        }],
      },
    });
    expect(r.errors.join()).toMatch(/must be a LineString/);
  });
});

describe('campus areas', () => {
  it('passes a well-formed area through with provisional defaulted to false', () => {
    const r = build({ campusAreas: area() });
    expect(r.errors).toEqual([]);
    expect(r.dataset.counts.campusAreas).toBe(1);
    expect(r.dataset.campusAreas.features[0].properties).toMatchObject({
      area_id: 'central', name: 'Central Campus', kind: 'campus', provisional: false,
    });
  });

  it('warns, but does not fail, while geometry is flagged provisional', () => {
    const r = build({ campusAreas: area({ provisional: true }) });
    expect(r.errors).toEqual([]);
    expect(r.warnings.join(' ')).toMatch(/provisional/);
  });

  it('rejects a ring whose last position does not repeat the first', () => {
    const open = { type: 'Polygon', coordinates: [ring.slice(0, -1)] };
    expect(build({ campusAreas: area({}, open) }).errors.join(' ')).toMatch(/not closed/);
  });

  it('rejects a ring with fewer than four positions', () => {
    const sliver = { type: 'Polygon', coordinates: [[ring[0], ring[1], ring[0]]] };
    expect(build({ campusAreas: area({}, sliver) }).errors.join(' ')).toMatch(/at least 4 positions/);
  });

  // GeoJSON is lng-then-lat, the opposite of every other coordinate in this
  // repo. Swapping them puts the polygon in the Indian Ocean, where it is
  // simply invisible rather than visibly wrong.
  it('catches lat and lng written the wrong way round', () => {
    const swapped = { type: 'Polygon', coordinates: [ring.map(([lng, lat]) => [lat, lng])] };
    expect(build({ campusAreas: area({}, swapped) }).errors.join(' ')).toMatch(/lat and lng swapped/);
  });

  it('rejects an unknown kind', () => {
    expect(build({ campusAreas: area({ kind: 'zone' }) }).errors.join(' ')).toMatch(/kind must be/);
  });

  it('rejects a non-polygon geometry', () => {
    const line = { type: 'LineString', coordinates: ring };
    expect(build({ campusAreas: area({}, line) }).errors.join(' ')).toMatch(/must be a Polygon/);
  });

  it('rejects a duplicate area_id', () => {
    const two = area();
    two.features.push(JSON.parse(JSON.stringify(two.features[0])));
    expect(build({ campusAreas: two }).errors.join(' ')).toMatch(/duplicate area_id/);
  });

  it('accepts a MultiPolygon, validating every ring', () => {
    const multi = { type: 'MultiPolygon', coordinates: [[ring], [ring.slice(0, -1)]] };
    expect(build({ campusAreas: area({}, multi) }).errors.join(' ')).toMatch(/not closed/);
  });
});
