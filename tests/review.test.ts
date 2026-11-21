import { describe, it, expect } from 'vitest';
// @ts-expect-error plain JS module, no type declarations
import { reviewSubmission } from '../scripts/lib/review.mjs';

const mapping = JSON.parse(
  // eslint-disable-next-line no-undef
  require('node:fs').readFileSync(new URL('../survey/mapping.json', import.meta.url), 'utf8'),
);
const base = {
  mapping, config: { accessionPrefix: 'UVM', map: { bounds: [[44.45, -73.23], [44.5, -73.155]] } },
  taxaRows: [{ taxon_id: 'acer-rubrum', scientific_name: 'Acer rubrum', common_name: 'Red maple', genus: 'Acer', species: 'rubrum' },
    { taxon_id: 'zelkova-serrata', scientific_name: 'Zelkova serrata', common_name: 'Japanese zelkova', genus: 'Zelkova', species: 'serrata' }],
  plantRows: [{ plant_id: 'UVM-2003', tag: '2003', taxon_id: 'acer-rubrum', lat: '44.470640', lng: '-73.199505', collection_id: 'redstone' },
    { plant_id: 'UVM-4520', tag: '', taxon_id: 'zelkova-serrata', lat: '44.469376', lng: '-73.199605', collection_id: 'redstone' }],
  observationRows: [], collectionRows: [{ collection_id: 'redstone', name: 'Redstone Campus' }], campusAreas: null, renumberedRows: [],
};
const headers = ['tag', 'taxon_id', 'species', 'lat', 'lng', 'status', 'condition', 'date', 'geolocation_notes', 'notes'];
const row = (o: Record<string, string>) => ({ tag: '', taxon_id: '', species: '', lat: '', lng: '', status: 'active', condition: 'good', date: '2026-11-21', geolocation_notes: '', notes: '', ...o });

describe('reviewing a survey file before it is imported', () => {
  it('lays out new trees, moves with their distance, renumberings and notes, and is ready', () => {
    const r = reviewSubmission({ ...base, file: 'x.csv', headers, rows: [
      row({ tag: '3990', taxon_id: 'acer-rubrum', lat: '44.470250', lng: '-73.199700' }),
      row({ tag: '2003', taxon_id: 'acer-rubrum', lat: '44.470740', lng: '-73.199505' }),
      row({ tag: 'UVM-4520', taxon_id: 'zelkova-serrata', lat: '44.469376', lng: '-73.199605', notes: 'TAG ON TRUNK: the trunk reads 2804; UVM-4520 is on file with no tag' }),
    ] });
    expect(r.status).toBe('ready');
    expect(r.newTrees.map((t: { plant: string }) => t.plant)).toEqual(['UVM-3990']);
    expect(r.corrections[0].plant).toBe('UVM-2003');
    expect(r.corrections[0].moved.metres).toBeCloseTo(11.1, 0);
    expect(r.renumbered).toEqual([{ from: 'UVM-4520', to: 'UVM-2804', tag: '2804', common: 'Japanese zelkova' }]);
    expect(r.notes[0]).toEqual({ plant: 'UVM-2804', note: 'TAG ON TRUNK: the trunk reads 2804; UVM-4520 is on file with no tag' });
    expect(r.summary).toMatchObject({ newTrees: 1, visits: 3, corrections: 1, renumbered: 1, errors: 0 });
  });
  it('is blocked by any error, as the importer is', () => {
    const r = reviewSubmission({ ...base, file: 'y.csv', headers, rows: [row({ tag: '3991', species: 'Acer rubrom', lat: '44.4703', lng: '-73.1998' })] });
    expect(r.status).toBe('blocked');
    expect(r.issues[0].message).toMatch(/Acer rubrom/);
  });
});
