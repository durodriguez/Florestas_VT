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
  habit: 'tree',
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
  condition: 'good',
  status: 'active',
  ...over,
});

const collection = { collection_id: 'green', name: 'University Green', color: '#154734' };

const build = (over: Partial<Parameters<typeof buildDataset>[0]> = {}) =>
  buildDataset({
    taxaRows: [taxon()],
    plantRows: [plant()],
    collectionRows: [collection],
    trails: { type: 'FeatureCollection', features: [] },
    config,
    ...over,
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
    const r = build({ plantRows: [plant({ condition: 'pretty good' })] });
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
    const r = build({ taxaRows: [taxon({ native_status: 'Native' })] });
    expect(r.errors).toEqual([]);
    expect(r.dataset.taxa[0].native).toBe('native');
  });

  it('parses flowering months into a numeric list and drops junk', () => {
    const r = build({ taxaRows: [taxon({ flower_months: '4, 5; 13, x' })] });
    expect(r.dataset.taxa[0].flowerMonths).toEqual([4, 5]);
  });

  it('counts only active plants toward a taxon total', () => {
    const r = build({
      plantRows: [plant(), plant({ plant_id: 'UVM-0002', status: 'removed' })],
    });
    expect(r.dataset.taxa[0].count).toBe(1);
    expect(r.dataset.counts).toMatchObject({ plants: 2, active: 1 });
  });

  it('treats a blank status as active', () => {
    const r = build({ plantRows: [plant({ status: '' })] });
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
