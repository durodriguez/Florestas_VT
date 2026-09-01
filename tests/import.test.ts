import { describe, it, expect } from 'vitest';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { importSurvey, parseCoord, parseLatLng, resolveColumns, nextSequence, taxaStubs } from '../scripts/lib/import.mjs';

const mapping = JSON.parse(
  // eslint-disable-next-line no-undef
  require('node:fs').readFileSync(new URL('../survey/mapping.json', import.meta.url), 'utf8'),
);

const config = {
  accessionPrefix: 'UVM',
  map: { bounds: [[44.45, -73.23], [44.5, -73.155]] },
};

const taxaRows = [
  { taxon_id: 'acer-saccharum', scientific_name: 'Acer saccharum', common_name: 'Sugar maple', genus: 'Acer', species: 'saccharum' },
  { taxon_id: 'acer-rubrum', scientific_name: 'Acer rubrum', common_name: 'Red maple', genus: 'Acer', species: 'rubrum' },
  { taxon_id: 'pinus-strobus', scientific_name: 'Pinus strobus', common_name: 'Eastern white pine', genus: 'Pinus', species: 'strobus' },
];

const collectionRows = [
  { collection_id: 'university-green', name: 'University Green' },
  { collection_id: 'redstone-campus', name: 'Redstone Campus' },
];

const plantRows = [
  { plant_id: 'UVM-2025-0007', taxon_id: 'acer-saccharum', lat: '44.4700', lng: '-73.2000', condition: 'good', dbh_in: '20', status: 'active', notes: 'old note' },
];

const headers = ['tag', 'species', 'lat', 'lng', 'area', 'dbh_in', 'condition', 'notes'];
const row = (over: Record<string, string> = {}) => ({
  tag: '', species: 'Sugar maple', lat: '44.4779', lng: '-73.1955',
  area: 'University Green', dbh_in: '30', condition: 'good', notes: '', ...over,
});

const run = (rows: Record<string, string>[], over: Record<string, unknown> = {}) =>
  importSurvey({ rows, headers, mapping, taxaRows, plantRows, collectionRows, config, year: 2026, ...over });

describe('parseCoord', () => {
  it('reads plain decimal degrees', () => {
    expect(parseCoord('44.4779')).toBeCloseTo(44.4779, 6);
    expect(parseCoord('-73.1955')).toBeCloseTo(-73.1955, 6);
  });

  it('reads degrees-minutes-seconds with a hemisphere', () => {
    expect(parseCoord(`44°28'40.5"N`)).toBeCloseTo(44.47792, 4);
    expect(parseCoord(`73°11'43.8"W`)).toBeCloseTo(-73.19550, 4);
  });

  it('reads a decimal with a trailing hemisphere letter', () => {
    expect(parseCoord('73.1955 W')).toBeCloseTo(-73.1955, 6);
    expect(parseCoord('44.4779 N')).toBeCloseTo(44.4779, 6);
  });

  it('returns null for blank and NaN for junk', () => {
    expect(parseCoord('')).toBeNull();
    expect(parseCoord('   ')).toBeNull();
    expect(parseCoord('notacoord')).toBeNaN();
  });
});

describe('parseLatLng', () => {
  it('reads a comma-separated pair as lat,lng', () => {
    expect(parseLatLng('44.4779, -73.1955')).toEqual({ lat: 44.4779, lng: -73.1955 });
  });

  it('reads WKT POINT as lng-first, the order QGIS emits', () => {
    expect(parseLatLng('POINT(-73.1955 44.4779)')).toEqual({ lat: 44.4779, lng: -73.1955 });
  });

  it('reads a GeoJSON-style bracketed pair as lng-first', () => {
    expect(parseLatLng('[-73.1955, 44.4779]')).toEqual({ lat: 44.4779, lng: -73.1955 });
  });

  it('returns null for blank or unparseable input', () => {
    expect(parseLatLng('')).toBeNull();
    expect(parseLatLng('somewhere near the chapel')).toBeNull();
  });
});

describe('resolveColumns', () => {
  it('matches headers ignoring case, spaces and punctuation', () => {
    const { resolved } = resolveColumns(['Tag No', 'DBH (in)', 'Survey Date'], mapping.columns);
    expect(resolved.plant_id).toBe('Tag No');
    expect(resolved.dbh_in).toBe('DBH (in)');
    expect(resolved.surveyed_on).toBe('Survey Date');
  });

  it('reports headers it could not place', () => {
    const { unmapped } = resolveColumns(['species', 'Crew Size'], mapping.columns);
    expect(unmapped).toEqual(['Crew Size']);
  });
});

describe('nextSequence', () => {
  it('continues from the highest existing number for that year', () => {
    expect(nextSequence(['UVM-2026-0001', 'UVM-2026-0042'], 'UVM', 2026)).toBe(43);
  });

  it('ignores other years and other prefixes', () => {
    expect(nextSequence(['UVM-2025-0900', 'OTHER-2026-0500'], 'UVM', 2026)).toBe(1);
  });

  it('starts at 1 when nothing exists', () => {
    expect(nextSequence([], 'UVM', 2026)).toBe(1);
  });
});

describe('importSurvey — species matching', () => {
  it('accepts a common name, a scientific name or a taxon_id', () => {
    const r = run([row({ species: 'Sugar maple' }), row({ species: 'Acer rubrum', lat: '44.4780' }), row({ species: 'pinus-strobus', lat: '44.4781' })]);
    expect(r.summary.errors).toBe(0);
    expect(r.inserts.map((i: { taxon_id: string }) => i.taxon_id))
      .toEqual(['acer-saccharum', 'acer-rubrum', 'pinus-strobus']);
  });

  it('is case- and spacing-insensitive', () => {
    const r = run([row({ species: '  SUGAR MAPLE ' })]);
    expect(r.summary.errors).toBe(0);
    expect(r.inserts[0].taxon_id).toBe('acer-saccharum');
  });

  it('reports an unknown species and skips the row', () => {
    const r = run([row({ species: 'Dawn redwood' })]);
    expect(r.inserts).toHaveLength(0);
    expect(r.issues.some((i: { message: string }) => /not in taxa\.csv/.test(i.message))).toBe(true);
    expect(r.unknownSpecies.get('Dawn redwood')).toBe(1);
  });

  it('refuses a name that matches two taxa rather than guessing', () => {
    const ambiguous = [
      { taxon_id: 'a', scientific_name: 'Acer x', common_name: 'Maple', genus: 'Acer', species: 'x' },
      { taxon_id: 'b', scientific_name: 'Acer y', common_name: 'Maple', genus: 'Acer', species: 'y' },
    ];
    const r = run([row({ species: 'Maple' })], { taxaRows: ambiguous });
    expect(r.inserts).toHaveLength(0);
    expect(r.issues.some((i: { message: string }) => /more than one taxon/.test(i.message))).toBe(true);
  });

  it('lets a plain species win over a cultivar of it', () => {
    // Adding Acer platanoides 'Crimson King' must not make plain
    // "Acer platanoides" ambiguous — the exact scientific name wins over the
    // genus+species key derived from the cultivar's own columns.
    const withCultivar = [
      ...taxaRows,
      { taxon_id: 'acer-platanoides', scientific_name: 'Acer platanoides', common_name: 'Norway maple', genus: 'Acer', species: 'platanoides' },
      { taxon_id: 'acer-platanoides-crimson-king', scientific_name: "Acer platanoides 'Crimson King'", common_name: 'Crimson King Norway maple', genus: 'Acer', species: 'platanoides', cultivar: 'Crimson King' },
    ];
    const r = run([row({ species: 'Acer platanoides' })], { taxaRows: withCultivar });
    expect(r.summary.errors).toBe(0);
    expect(r.inserts[0].taxon_id).toBe('acer-platanoides');
  });

  it('still resolves the cultivar by its own full name', () => {
    const withCultivar = [
      ...taxaRows,
      { taxon_id: 'acer-platanoides', scientific_name: 'Acer platanoides', common_name: 'Norway maple', genus: 'Acer', species: 'platanoides' },
      { taxon_id: 'acer-platanoides-crimson-king', scientific_name: "Acer platanoides 'Crimson King'", common_name: 'Crimson King Norway maple', genus: 'Acer', species: 'platanoides', cultivar: 'Crimson King' },
    ];
    const r = run([row({ species: "Acer platanoides 'Crimson King'" })], { taxaRows: withCultivar });
    expect(r.inserts[0].taxon_id).toBe('acer-platanoides-crimson-king');
  });

  it('resolves a genus-only taxon such as "Malus sp."', () => {
    const withGenusOnly = [
      ...taxaRows,
      { taxon_id: 'malus-sp', scientific_name: 'Malus sp.', common_name: 'Crabapple', genus: 'Malus', species: '' },
    ];
    // The inventory writes "Malus sp"; the taxa list writes "Malus sp." Both
    // normalise to the same key.
    const r = run([row({ species: 'Malus sp' })], { taxaRows: withGenusOnly });
    expect(r.summary.errors).toBe(0);
    expect(r.inserts[0].taxon_id).toBe('malus-sp');
  });

  it('still refuses a common name genuinely shared by two taxa', () => {
    const ambiguous = [
      { taxon_id: 'a', scientific_name: 'Acer x', common_name: 'Maple', genus: 'Acer', species: 'x' },
      { taxon_id: 'b', scientific_name: 'Acer y', common_name: 'Maple', genus: 'Acer', species: 'y' },
    ];
    const r = run([row({ species: 'Maple' })], { taxaRows: ambiguous });
    expect(r.inserts).toHaveLength(0);
    expect(r.issues.some((i: { message: string }) => /more than one taxon/.test(i.message))).toBe(true);
  });

  it('offers paste-ready taxa.csv stubs for unknown species', () => {
    const r = run([row({ species: 'Dawn redwood' })]);
    expect(taxaStubs(r.unknownSpecies)[0]).toMatch(/^dawn-redwood,Dawn redwood,/);
  });
});

describe('importSurvey — normalisation', () => {
  it('maps condition abbreviations onto the controlled vocabulary', () => {
    const r = run([row({ condition: 'EXC' }), row({ condition: 'Very Good', lat: '44.4780' }), row({ condition: 'g', lat: '44.4781' })]);
    expect(r.summary.errors).toBe(0);
    expect(r.inserts.map((i: { condition: string }) => i.condition)).toEqual(['excellent', 'excellent', 'good']);
  });

  it('stops a row whose condition word is not recognised', () => {
    const r = run([row({ condition: 'brilliant' })]);
    expect(r.inserts).toHaveLength(0);
    expect(r.issues.some((i: { message: string }) => /not recognised/.test(i.message))).toBe(true);
  });

  it('resolves a campus area by display name', () => {
    const r = run([row({ area: 'University Green' })]);
    expect(r.inserts[0].collection_id).toBe('university-green');
  });

  it('rejects an unknown campus area', () => {
    const r = run([row({ area: 'Nonexistent Bed' })]);
    expect(r.inserts).toHaveLength(0);
    expect(r.issues.some((i: { message: string }) => /not in collections\.csv/.test(i.message))).toBe(true);
  });

  it('tolerates a unit typed into a measurement cell', () => {
    const r = run([row({ dbh_in: '32.5 in' })]);
    expect(r.summary.errors).toBe(0);
    expect(r.inserts[0].dbh_in).toBe('32.5');
  });

  it('refuses a written-out number rather than importing it as zero', () => {
    const r = run([row({ dbh_in: 'twelve' })]);
    expect(r.inserts).toHaveLength(0);
    expect(r.issues.some((i: { message: string }) => /is not a number/.test(i.message))).toBe(true);
  });

  it('leaves a blank measurement blank', () => {
    const r = run([row({ dbh_in: '' })]);
    expect(r.summary.errors).toBe(0);
    expect(r.inserts[0].dbh_in).toBe('');
  });
});

describe('importSurvey — coordinates', () => {
  it('warns but still imports a point outside campus bounds', () => {
    const r = run([row({ lat: '40.7128', lng: '-74.0060' })]);
    expect(r.inserts).toHaveLength(1);
    expect(r.summary.errors).toBe(0);
    expect(r.issues.some((i: { message: string }) => /outside the campus bounds/.test(i.message))).toBe(true);
  });

  it('stops a row with an unreadable coordinate', () => {
    const r = run([row({ lat: 'notacoord' })]);
    expect(r.inserts).toHaveLength(0);
    expect(r.issues.some((i: { message: string }) => /could not read a latitude/.test(i.message))).toBe(true);
  });

  it('rounds stored coordinates to six decimal places', () => {
    const r = run([row({ lat: '44.47791234567' })]);
    expect(r.inserts[0].lat).toBe('44.477912');
  });
});

describe('importSurvey — accessions', () => {
  it('assigns sequential accessions in the configured scheme', () => {
    const r = run([row(), row({ lat: '44.4780' }), row({ lat: '44.4781' })]);
    expect(r.inserts.map((i: { plant_id: string }) => i.plant_id))
      .toEqual(['UVM-2026-0001', 'UVM-2026-0002', 'UVM-2026-0003']);
  });

  it('continues numbering past accessions already issued that year', () => {
    const existing = [...plantRows, { plant_id: 'UVM-2026-0012', taxon_id: 'pinus-strobus', lat: '44.46', lng: '-73.21', status: 'active' }];
    const r = run([row()], { plantRows: existing });
    expect(r.inserts[0].plant_id).toBe('UVM-2026-0013');
  });

  it('honours an explicit --year', () => {
    const r = run([row()], { year: 2030 });
    expect(r.inserts[0].plant_id).toBe('UVM-2030-0001');
  });
});

describe('importSurvey — re-surveys', () => {
  it('updates an existing accession instead of inserting', () => {
    const r = run([row({ tag: 'UVM-2025-0007', dbh_in: '22', condition: 'fair' })]);
    expect(r.inserts).toHaveLength(0);
    expect(r.updates).toHaveLength(1);
    expect(r.updates[0].plant_id).toBe('UVM-2025-0007');
  });

  it('records only the values that actually changed', () => {
    const r = run([row({ tag: 'UVM-2025-0007', dbh_in: '22', condition: 'good' })]);
    expect(r.updates[0].changes).toHaveProperty('dbh_in', '22');
    // condition was already "good" on file, so it is not part of the update
    expect(r.updates[0].changes).not.toHaveProperty('condition');
  });

  it('does not blank a field the surveyor left empty', () => {
    const r = run([row({ tag: 'UVM-2025-0007', dbh_in: '22', notes: '' })]);
    expect(r.updates[0].changes).not.toHaveProperty('notes');
  });

  it('warns when a re-survey changed nothing', () => {
    const r = run([row({ tag: 'UVM-2025-0007', dbh_in: '20', condition: 'good', area: '', lat: '44.4700', lng: '-73.2000', notes: 'old note' })]);
    expect(r.updates).toHaveLength(0);
    expect(r.issues.some((i: { message: string }) => /no changed values/.test(i.message))).toBe(true);
  });

  it('rejects a tag that is not an existing accession', () => {
    const r = run([row({ tag: 'BOGUS-999' })]);
    expect(r.inserts).toHaveLength(0);
    expect(r.issues.some((i: { message: string }) => /not an existing accession/.test(i.message))).toBe(true);
  });
});

describe('importSurvey — adopting physical tags', () => {
  it('refuses an unknown tag by default, and says how to adopt it', () => {
    const r = run([row({ tag: '772' })]);
    expect(r.inserts).toHaveLength(0);
    expect(r.issues.some((i: { message: string }) => /--adopt-tags/.test(i.message))).toBe(true);
  });

  it('adopts a bare numeric tag as the accession number', () => {
    const r = run([row({ tag: '772' })], { adoptTags: true });
    expect(r.summary.errors).toBe(0);
    expect(r.inserts[0].plant_id).toBe('UVM-0772');
  });

  it('zero-pads short tags and leaves long ones intact', () => {
    const r = run([row({ tag: '7' }), row({ tag: '12345', lat: '44.4780' })], { adoptTags: true });
    expect(r.inserts.map((i: { plant_id: string }) => i.plant_id)).toEqual(['UVM-0007', 'UVM-12345']);
  });

  it('treats a later survey of the same tag as an update, not a duplicate', () => {
    const adopted = [
      ...plantRows,
      { plant_id: 'UVM-0772', taxon_id: 'acer-saccharum', lat: '44.4779', lng: '-73.1955', dbh_in: '9.4', status: 'active' },
    ];
    const r = run([row({ tag: '772', dbh_in: '10.2' })], { adoptTags: true, plantRows: adopted });
    expect(r.inserts).toHaveLength(0);
    expect(r.updates[0].plant_id).toBe('UVM-0772');
    expect(r.updates[0].changes).toHaveProperty('dbh_in', '10.2');
  });

  it('still assigns a fresh accession when the tag column is blank', () => {
    const r = run([row({ tag: '' })], { adoptTags: true });
    expect(r.inserts[0].plant_id).toBe('UVM-2026-0001');
  });

  it('does not adopt a non-numeric tag, which is probably a typo', () => {
    const r = run([row({ tag: 'BOGUS-1' })], { adoptTags: true });
    expect(r.inserts).toHaveLength(0);
    expect(r.issues.some((i: { message: string }) => /not an existing accession/.test(i.message))).toBe(true);
  });

  it('refuses when two rows in one file adopt the same tag', () => {
    // Two trees cannot share a physical tag number; the second is a
    // transcription error and must not overwrite the first.
    const r = run([row({ tag: '772' }), row({ tag: '772', lat: '44.4781' })], { adoptTags: true });
    expect(r.inserts).toHaveLength(1);
    expect(r.issues.some((i: { message: string }) => /already in use/.test(i.message))).toBe(true);
  });
});

describe('importSurvey — duplicate protection', () => {
  it('flags a new plant sitting on top of the same species already on file', () => {
    const r = run([row({ lat: '44.4700', lng: '-73.2000', species: 'Sugar maple' })]);
    expect(r.duplicates).toHaveLength(1);
    expect(r.duplicates[0].existing).toBe('UVM-2025-0007');
  });

  it('does not flag a different species at the same spot', () => {
    const r = run([row({ lat: '44.4700', lng: '-73.2000', species: 'Red maple' })]);
    expect(r.duplicates).toHaveLength(0);
  });

  it('errors when most of the batch duplicates existing records', () => {
    const dup = { lat: '44.4700', lng: '-73.2000', species: 'Sugar maple' };
    const r = run([row(dup), row(dup), row(dup)]);
    expect(r.issues.some((i: { level: string; message: string }) =>
      i.level === 'error' && /already been imported/.test(i.message))).toBe(true);
  });

  it('can be switched off for genuinely dense new planting', () => {
    const dup = { lat: '44.4700', lng: '-73.2000', species: 'Sugar maple' };
    const r = run([row(dup), row(dup), row(dup)], { duplicateMeters: 0 });
    expect(r.summary.errors).toBe(0);
    expect(r.inserts).toHaveLength(3);
  });
});

describe('importSurvey — housekeeping', () => {
  it('skips entirely blank rows without complaining', () => {
    const blank = Object.fromEntries(headers.map((h) => [h, '']));
    const r = run([row(), blank]);
    expect(r.summary.errors).toBe(0);
    expect(r.inserts).toHaveLength(1);
  });

  it('reports a row with no species recorded', () => {
    const r = run([row({ species: '' })]);
    expect(r.issues.some((i: { message: string }) => /no species recorded/.test(i.message))).toBe(true);
  });
});
