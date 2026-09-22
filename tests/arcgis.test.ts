import { describe, it, expect } from 'vitest';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { importArcgis, readTag, normalizeCondition, surveyDate, isRefinement, UNTAGGED_BLOCK_START } from '../scripts/lib/arcgis.mjs';

const lookup = new Map<string, string | null>([
  ['river birch', 'betula-nigra'],
  ['white pine', 'pinus-strobus'],
  ['swamp white oak', 'quercus-bicolor'],
  ['id needed', null],
  ['cedar', 'thuja-sp'],
]);

// Only the columns isRefinement reads.
const taxaById = new Map<string, Record<string, string>>([
  ['thuja-sp', { genus: 'Thuja', species: '' }],
  ['thuja-occidentalis', { genus: 'Thuja', species: 'occidentalis' }],
  ['juniperus-virginiana', { genus: 'Juniperus', species: 'virginiana' }],
  ['quercus-bicolor', { genus: 'Quercus', species: 'bicolor' }],
  ['quercus-michauxii', { genus: 'Quercus', species: 'michauxii' }],
]);

// Central Campus as a box big enough to hold the fixtures.
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

// 14 Oct 2023, the day the first points were recorded.
const OCT_2023 = 1697305903893;

const feature = (over: Record<string, unknown> = {}, geom: number[] | null = [-73.1943, 44.4766]) => ({
  type: 'Feature',
  geometry: geom ? { type: 'Point', coordinates: geom } : null,
  properties: {
    OBJECTID: 1, Species: 'River Birch', Health: 'Good', Tag_ID: '763', CreationDate: OCT_2023,
    // Every feature in the real layer carries one, and an untagged tree needs
    // it: it is the only thing that identifies the tree on a second import.
    GlobalID: `{fixture-${String(over.OBJECTID ?? 1)}}`,
    ...over,
  },
});

const run = (features: unknown[], over: Record<string, unknown> = {}) =>
  importArcgis({ features, speciesLookup: lookup, taxaById, campusAreas, surveyor: 'EC', ...over });

describe('readTag', () => {
  it('reads a plain number as a tag we can trust', () => {
    expect(readTag('763')).toEqual({ kind: 'number', number: 763 });
    expect(readTag(' 763 ')).toEqual({ kind: 'number', number: 763 });
  });

  it('treats "Young" and blank alike — an untagged tree', () => {
    // 592 records say Young and 103 are blank. Both mean the same thing:
    // there is a tree, and there is no number on it.
    expect(readTag('Young').kind).toBe('none');
    expect(readTag('young').kind).toBe('none');
    expect(readTag('').kind).toBe('none');
    expect(readTag(null).kind).toBe('none');
  });

  it('refuses to guess at "1818 or 1942"', () => {
    expect(readTag('1818 or 1942')).toEqual({ kind: 'uncertain', text: '1818 or 1942' });
  });
});

describe('normalizeCondition', () => {
  it('folds the spellings ArcGIS actually contains', () => {
    // "Good", "Good " and "good" all appear in the real layer.
    for (const v of ['Good', 'Good ', 'good', ' GOOD ']) expect(normalizeCondition(v)).toBe('good');
  });

  it('gives back nothing for a value that is not a condition', () => {
    expect(normalizeCondition(null)).toBe('');
    expect(normalizeCondition('Unknown')).toBe('');
  });
});

describe('surveyDate', () => {
  it('files an observation under the day the point was recorded', () => {
    expect(surveyDate(OCT_2023)).toBe('2023-10-14');
  });

  it('gives back nothing rather than 1970 for a missing date', () => {
    expect(surveyDate(undefined)).toBe('');
  });
});

describe('isRefinement', () => {
  it('counts a species inside the genus the source named', () => {
    // "Cedar" -> thuja-sp, later identified as Thuja occidentalis.
    expect(isRefinement('thuja-sp', 'thuja-occidentalis', taxaById)).toBe(true);
  });

  it('does not count a different genus, however similar the common name', () => {
    // Red cedar is a juniper. Sharing the word "cedar" makes it no less wrong.
    expect(isRefinement('thuja-sp', 'juniperus-virginiana', taxaById)).toBe(false);
  });

  it('does not count two different species of one genus', () => {
    expect(isRefinement('quercus-bicolor', 'quercus-michauxii', taxaById)).toBe(false);
  });

  it('does not count going the other way, from a species to a genus', () => {
    expect(isRefinement('thuja-occidentalis', 'thuja-sp', taxaById)).toBe(false);
  });

  it('says no rather than guessing when a taxon is unknown', () => {
    expect(isRefinement('thuja-sp', 'nothing-here', taxaById)).toBe(false);
    expect(isRefinement('thuja-sp', 'thuja-occidentalis', undefined)).toBe(false);
  });
});

describe('importArcgis', () => {
  it('gives a tagged tree the accession its metal tag already says', () => {
    const r = run([feature()]);
    expect(r.inserts[0].plant_id).toBe('UVM-0763');
    expect(r.inserts[0].taxon_id).toBe('betula-nigra');
    expect(r.inserts[0].collection_id).toBe('central');
  });

  it('issues untagged trees from a block above the highest tag', () => {
    const r = run([
      feature({ OBJECTID: 1, Tag_ID: 'Young' }),
      feature({ OBJECTID: 2, Tag_ID: '' }),
    ]);
    expect(r.inserts.map((p: any) => p.plant_id)).toEqual(['UVM-4001', 'UVM-4002']);
    expect(UNTAGGED_BLOCK_START).toBeGreaterThan(3849); // the highest real tag
  });

  it('does not put two trees on one accession when a tag is duplicated', () => {
    const r = run([
      feature({ OBJECTID: 1, Tag_ID: '2297', Species: 'White pine' }),
      feature({ OBJECTID: 2, Tag_ID: '2297', Species: 'River Birch' }),
    ]);
    const ids = r.inserts.map((p: any) => p.plant_id);
    expect(ids).toEqual(['UVM-2297', 'UVM-4001']);
    expect(new Set(ids).size).toBe(2);
    // And the second one says why it is not UVM-2297.
    expect(r.observations[1].notes).toContain('TAG DISPUTED: tag 2297 is also on UVM-2297');
  });

  it('flags an unreadable tag instead of picking one of the two numbers', () => {
    const r = run([feature({ Tag_ID: '1818 or 1942' })]);
    expect(r.inserts[0].plant_id).toBe('UVM-4001');
    expect(r.observations[0].notes).toContain('TAG UNCERTAIN: recorded as "1818 or 1942"');
  });

  it('leaves out a tree whose species nobody could name', () => {
    const r = run([feature({ Species: 'ID Needed' }), feature({ OBJECTID: 2, Species: '' })]);
    expect(r.inserts).toHaveLength(0);
    expect(r.skipped.map((x: any) => x.reason)).toEqual(['not a species', 'no species recorded']);
  });

  it('leaves out a point with no position', () => {
    const r = run([feature({}, null)]);
    expect(r.inserts).toHaveLength(0);
    expect(r.skipped[0].reason).toBe('no position');
  });

  it('records the health rating as the observation, dated when it was surveyed', () => {
    const r = run([feature({ Health: 'Fair ' })]);
    expect(r.observations[0]).toMatchObject({
      plant_id: 'UVM-0763', surveyed_on: '2023-10-14', surveyor: 'EC',
      condition: 'fair', status: 'active',
    });
  });

  it('keeps a position established in the field and says ArcGIS disagreed', () => {
    // UVM-0762 in the real data: 13 m away, and a different oak.
    const onFile = {
      plant_id: 'UVM-0762', taxon_id: 'quercus-michauxii',
      lat: '44.476167', lng: '-73.194979',
    };
    const plants = [onFile];
    const r = run([feature({ Tag_ID: '762', Species: 'Swamp white oak', Health: 'Good' },
      [-73.194979, 44.476284])], { plants });

    expect(r.inserts).toHaveLength(0);              // no second row for a tree we have
    expect(r.summary.matchedExisting).toBe(1);
    expect(onFile.taxon_id).toBe('quercus-michauxii'); // untouched
    expect(r.conflicts.map((c: any) => c.kind).sort()).toEqual(['position', 'species']);
    expect(r.observations[0].notes).toContain('SPECIES CONFLICT');
    expect(r.observations[0].notes).toContain('POSITION CONFLICT');
  });

  it('treats a finer identification as kept work, not a disagreement', () => {
    // The real case: UVM-3235-3237, recorded as "Cedar" and since identified
    // from photographs as northern white cedar.
    const plants = [{
      plant_id: 'UVM-3236', taxon_id: 'thuja-occidentalis',
      lat: '44.482327', lng: '-73.195826',
    }];
    const r = run([feature({ Tag_ID: '3236', Species: 'Cedar' }, [-73.195826, 44.482327])], { plants });

    expect(r.conflicts).toHaveLength(0);
    expect(r.refinements).toHaveLength(1);
    expect(r.refinements[0].plant_id).toBe('UVM-3236');
    // Nothing for anybody to go and re-check, so no note on the tree.
    expect(r.observations[0].notes).toBe('');
  });

  it('still calls a different genus a conflict, not a refinement', () => {
    const plants = [{
      plant_id: 'UVM-3236', taxon_id: 'juniperus-virginiana',
      lat: '44.482327', lng: '-73.195826',
    }];
    const r = run([feature({ Tag_ID: '3236', Species: 'Cedar' }, [-73.195826, 44.482327])], { plants });

    expect(r.refinements).toHaveLength(0);
    expect(r.conflicts.map((c: any) => c.kind)).toEqual(['species']);
    expect(r.observations[0].notes).toContain('SPECIES CONFLICT');
  });

  it('does not flag a position that agrees within a few metres', () => {
    const plants = [{ plant_id: 'UVM-0763', taxon_id: 'betula-nigra', lat: '44.476079', lng: '-73.195033' }];
    const r = run([feature({ Tag_ID: '763' }, [-73.195045, 44.476090])], { plants });
    expect(r.conflicts).toHaveLength(0);
    expect(r.observations[0].notes).toBe('');
  });

  it('is safe to run twice — the second run adds nothing', () => {
    const first = run([feature(), feature({ OBJECTID: 2, Tag_ID: 'Young' })]);
    const second = importArcgis({
      features: [feature(), feature({ OBJECTID: 2, Tag_ID: 'Young' })],
      plants: first.inserts,
      observations: first.observations,
      speciesLookup: lookup, campusAreas, surveyor: 'EC',
    });
    expect(second.inserts).toHaveLength(0);
    expect(second.observations).toHaveLength(0);
  });

  it('issues the same numbers whatever order the features arrive in', () => {
    const a = feature({ OBJECTID: 1, Tag_ID: 'Young' });
    const b = feature({ OBJECTID: 2, Tag_ID: 'Young' });
    expect(run([a, b]).inserts.map((p: any) => p.plant_id))
      .toEqual(run([b, a]).inserts.map((p: any) => p.plant_id));
  });

  it('carries nothing that identifies the surveyor out of the source file', () => {
    const r = run([feature({ Creator: 'someone@uvm.edu_UVM', Editor: 'someone@uvm.edu_UVM' })]);
    const text = JSON.stringify(r.inserts) + JSON.stringify(r.observations);
    expect(text).not.toContain('@uvm.edu');
    expect(text).not.toContain('someone');
  });

  it('refuses an untagged tree with no stable id, rather than duplicating it later', () => {
    const r = run([feature({ Tag_ID: 'Young', GlobalID: '' })]);
    expect(r.inserts).toHaveLength(0);
    expect(r.skipped[0].reason).toBe('no tag and no stable id');
  });

  it('keeps the accession a re-imported tree was given, even if its tag changed', () => {
    const first = run([feature({ Tag_ID: 'Young' })]);
    const id = first.inserts[0].plant_id;
    const second = importArcgis({
      features: [feature({ Tag_ID: '999' })],       // somebody tagged it since
      plants: first.inserts,
      observations: first.observations,
      speciesLookup: lookup, campusAreas, surveyor: 'EC',
    });
    expect(second.inserts).toHaveLength(0);
    expect(id).toBe('UVM-4001');
  });

  it('leaves the campus area blank rather than guessing when a tree is off the map', () => {
    const r = run([feature({}, [-73.5, 44.9])]);
    expect(r.inserts[0].collection_id).toBe('');
  });
});
