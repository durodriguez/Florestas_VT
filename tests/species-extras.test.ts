import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';
import { yearSummary as tsSummary, yearTable as tsTable } from '../src/fieldguide/year';
import type { Taxon } from '../src/types';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { yearSummary as mjsSummary, yearTable as mjsTable } from '../scripts/lib/year.mjs';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { BURLINGTON, SIZE, describeRange, inRange, project, rangeTouches, whereIn } from '../scripts/lib/range-map.mjs';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { CROWN_FORMS, crownForm, treeDrawing } from '../scripts/lib/tree-drawing.mjs';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { speciesExtras, staleGaps } from '../scripts/lib/species-extras.mjs';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { campusFrame, campusSvg } from '../scripts/lib/campus-map.mjs';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { campusFacts, whereSentence } from '../scripts/lib/species-pages.mjs';

const rows = Papa.parse<Record<string, string>>(readFileSync('data/taxa.csv', 'utf8'), { header: true, skipEmptyLines: true }).data;
const months = (v: string) => (v ?? '').split(/[,;\s]+/).filter(Boolean).map(Number).filter((m) => m >= 1 && m <= 12);
const token = (v: string) => (v ?? '').trim().toLowerCase().replace(/\s+/g, '-');
/** taxa.csv's rows as the calendar the year table reads, as build.mjs makes them. */
const calendars = rows.map((r) => ({
  id: r.taxon_id!, type: r.plant_type!, family: r.family!,
  flowerColor: token(r.flower_color!), flowerMonths: months(r.flower_months!),
  fruitColor: token(r.fruit_color!), fruitMonths: months(r.fruit_months!), fallColor: token(r.fall_color!),
}));

const range = (name: string) => JSON.parse(readFileSync(`data/ranges/${name}.json`, 'utf8'));
const basemap = JSON.parse(readFileSync('data/ranges/basemap.json', 'utf8'));
const vermont = basemap.states.find((s: { name: string }) => s.name === 'Vermont').polygons;

describe('the year on a species page', () => {
  it('is the field guide\'s year, for every species in taxa.csv', () => {
    // year.mjs is a copy of src/fieldguide/year.ts; this is what keeps it one.
    for (const t of calendars) {
      expect(mjsTable(t), t.id).toEqual(tsTable(t as unknown as Taxon));
      expect(mjsSummary(t), t.id).toBe(tsSummary(t as unknown as Taxon));
    }
  });
});

describe('native range maps', () => {
  it('puts Burlington inside red maple\'s range and outside baldcypress\'s', () => {
    expect(inRange(range('acer-rubrum'), BURLINGTON.lat, BURLINGTON.lng)).toBe(true);
    expect(inRange(range('taxodium-distichum'), BURLINGTON.lat, BURLINGTON.lng)).toBe(false);
  });

  it('tells the main body of a range from a patch Little drew apart from it', () => {
    const at = (name: string) => whereIn(range(name), BURLINGTON.lat, BURLINGTON.lng);
    expect(at('acer-rubrum')).toBe('main');
    expect(at('pinus-rigida')).toBe('outlier');
    expect(at('taxodium-distichum')).toBeNull();
  });

  it('describes a range by the states it covers', () => {
    expect(describeRange(range('acer-rubrum').where)).toBe('Grows wild in 32 states, from Maine west to Minnesota and south to Florida and Texas, reaching north into Canada.');
    // A range lying east to west, by its ends.
    expect(describeRange(range('picea-glauca').where)).toBe('Grows wild in 9 states, from Maine west to Montana, reaching north into Canada.');
    // A few states, named outright, west to east.
    expect(describeRange({ states: [{ name: 'Georgia', lat: 33, lng: -83, n: 9 }, { name: 'Alabama', lat: 33, lng: -87, n: 9 }] })).toBe('Grows wild in 2 states: Alabama and Georgia.');
    expect(describeRange({ states: [] })).toBe('');
  });

  it('knows a range that reaches only the south of Vermont', () => {
    const dogwood = range('cornus-florida');
    expect(inRange(dogwood, BURLINGTON.lat, BURLINGTON.lng)).toBe(false);
    expect(rangeTouches(dogwood, vermont)).toBe(true);
    expect(rangeTouches(range('taxodium-distichum'), vermont)).toBe(false);
  });

  it('draws Burlington in the top right of the map', () => {
    const [x, y] = project(BURLINGTON.lng, BURLINGTON.lat);
    expect(x).toBeGreaterThan(SIZE.width * 0.7);
    expect(x).toBeLessThan(SIZE.width);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(SIZE.height * 0.4);
  });

  it('has a map for every Vermont-native tree species in taxa.csv', () => {
    const natives = rows.filter((r) => r.origin === 'vermont-native' && /tree$/.test(r.plant_type!) && r.species && !r.cultivar && !r.infraspecific && !r.species.startsWith('x '));
    const missing = natives.map((r) => `${r.genus} ${r.species}`.toLowerCase().replace(/\s+/g, '-'))
      .filter((file) => { try { range(file); return false; } catch { return true; } });
    // Amelanchier laevis and Crataegus crus-galli are not in Little's atlas.
    expect(missing.sort()).toEqual(['amelanchier-laevis', 'crataegus-crus-galli']);
  });
});

describe('the drawing of a tree at maturity', () => {
  const tree = { id: 'acer-rubrum', common: 'Red maple', family: 'Sapindaceae', type: 'deciduous-tree', matureHeightFt: 60, matureSpreadFt: 40 };

  it('is the same on every build', () => {
    expect(treeDrawing(tree)).toBe(treeDrawing(tree));
    expect(treeDrawing(tree)).not.toBe(treeDrawing({ ...tree, id: 'acer-saccharum' }));
  });

  it('draws every tree at the same scale, so a taller tree has a taller frame', () => {
    const height = (svg: string) => Number(/viewBox="0 0 \d+ (\d+)"/.exec(svg)![1]);
    expect(height(treeDrawing({ ...tree, matureHeightFt: 25 }))).toBeLessThan(height(treeDrawing(tree)));
    expect(treeDrawing(tree)).toContain('60 ft tall and 40 ft wide');
  });

  it('draws only trees with a height and a spread on file', () => {
    expect(treeDrawing({ ...tree, type: 'shrub' })).toBe('');
    expect(treeDrawing({ ...tree, matureSpreadFt: null })).toBe('');
  });

  it('gives conifers a cone and other trees an oval, for now', () => {
    expect(crownForm({ family: 'Pinaceae' })).toBe('conical');
    expect(crownForm({ family: 'Cupressaceae' })).toBe('conical');
    expect(crownForm({ family: 'Sapindaceae' })).toBe('oval');
  });
});

describe('the campus on a species page', () => {
  const trees = [
    { id: 'UVM-0001', lat: 44.478, lng: -73.199, dbh: 20, campus: 'Central Campus' },
    { id: 'UVM-0002', lat: 44.471, lng: -73.199, dbh: 20, campus: 'Redstone Campus' },
    { id: 'UVM-0003', lat: 44.471, lng: -73.198, dbh: 12, campus: 'Redstone Campus' },
    { id: 'UVM-0004', lat: 44.470, lng: -73.198, dbh: null, campus: 'Redstone Campus' },
  ];

  it('says where they are, the largest share first', () => {
    expect(whereSentence(trees)).toBe('4 trees mapped on campus: 3 on Redstone Campus and 1 on Central Campus.');
    expect(whereSentence(trees.slice(1, 3))).toBe('2 trees mapped on campus, both on Redstone Campus.');
    expect(whereSentence(trees.slice(0, 1))).toBe('1 tree mapped on campus, on Central Campus.');
  });

  it('names the largest trunk measured, and every tree tied for it', () => {
    const [fact] = campusFacts(trees, '/');
    expect(fact).toContain('The largest trunk measured so far is 20 in across');
    expect(fact).toContain('href="/?plant=UVM-0001">UVM-0001</a> on Central Campus and');
    expect(fact).toContain('UVM-0002</a> on Redstone Campus');
    expect(campusFacts(trees.slice(1, 3), '/')[0]).toContain('UVM-0002</a>, on Redstone Campus');
  });

  it('says when there is only one, and claims nothing about its size', () => {
    expect(campusFacts(trees.slice(0, 1), '/')).toEqual(['The only one mapped on campus, on Central Campus.']);
    expect(campusFacts([], '/')).toEqual([]);
  });

  it('draws each tree as a link to it on the map', () => {
    const frame = campusFrame(trees);
    const svg = campusSvg(frame, trees.slice(0, 1), '/Florestas_VT/');
    expect(svg).toContain('<a href="/Florestas_VT/?plant=UVM-0001">');
    for (const t of trees) {
      const [x, y] = frame.xy(t.lng, t.lat);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(frame.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(frame.height);
    }
  });
});


describe('what species pages add by hand', () => {
  const taxa = [
    { id: 'gleditsia-triacanthos', genus: 'Gleditsia', species: 'triacanthos', infra: '', cultivar: '' },
    { id: 'gleditsia-triacanthos-inermis', genus: 'Gleditsia', species: 'triacanthos', infra: 'var. inermis', cultivar: '' },
    { id: 'gleditsia-triacanthos-inermis-skyline', genus: 'Gleditsia', species: 'triacanthos', infra: 'var. inermis', cultivar: 'Skyline' },
  ];
  const src = { source: 'Silvics', source_url: 'https://example.org/s' };

  it('gives a cultivar or variety its species\' crown form and habitat, but not its facts', () => {
    const { extras, errors } = speciesExtras({
      crownRows: [{ taxon_id: 'gleditsia-triacanthos', crown_form: 'spreading' }],
      habitatRows: [{ taxon_id: 'gleditsia-triacanthos', habitat: 'River bottoms.', ...src }],
      factRows: [{ taxon_id: 'gleditsia-triacanthos', fact: 'Wild trees carry thorns.', ...src }],
      taxa,
    });
    expect(errors).toEqual([]);
    const skyline = extras.get('gleditsia-triacanthos-inermis-skyline');
    expect(skyline.crownForm).toBe('spreading');
    expect(skyline.habitat).toMatchObject({ text: 'River bottoms.', inherited: true });
    expect(skyline.facts).toEqual([]);
    expect(extras.get('gleditsia-triacanthos').facts.map((f: { text: string }) => f.text)).toEqual(['Wild trees carry thorns.']);
    expect(extras.get('gleditsia-triacanthos').habitat.inherited).toBeUndefined();
  });

  it('lets a cultivar have a crown form of its own', () => {
    const { extras } = speciesExtras({
      crownRows: [
        { taxon_id: 'gleditsia-triacanthos', crown_form: 'spreading' },
        { taxon_id: 'gleditsia-triacanthos-inermis-skyline', crown_form: 'pyramidal' },
      ],
      taxa,
    });
    expect(extras.get('gleditsia-triacanthos-inermis-skyline').crownForm).toBe('pyramidal');
    expect(extras.get('gleditsia-triacanthos-inermis').crownForm).toBe('spreading');
  });

  it('refuses an unknown taxon, an unknown form, a row twice, and a claim without a source', () => {
    const { errors } = speciesExtras({
      crownRows: [
        { taxon_id: 'nope', crown_form: 'oval' },
        { taxon_id: 'gleditsia-triacanthos', crown_form: 'blobby' },
        { taxon_id: 'gleditsia-triacanthos-inermis', crown_form: 'oval' },
        { taxon_id: 'gleditsia-triacanthos-inermis', crown_form: 'oval' },
      ],
      factRows: [{ taxon_id: 'gleditsia-triacanthos', fact: 'Unsourced.', source: '', source_url: '' }],
      taxa,
    });
    expect(errors).toHaveLength(4);
    expect(errors.join('\n')).toMatch(/no taxon "nope"/);
    expect(errors.join('\n')).toMatch(/crown_form must be one of/);
    expect(errors.join('\n')).toMatch(/listed twice/);
    expect(errors.join('\n')).toMatch(/needs a source/);
  });

  it('takes a Commons photo under a free license, credited, and gives it to cultivars', () => {
    const photo = {
      taxon_id: 'gleditsia-triacanthos', part: 'bark', title: 'File:Bark.jpg',
      page_url: 'https://commons.wikimedia.org/wiki/File:Bark.jpg',
      image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Bark.jpg/500px-Bark.jpg',
      author: 'A. Photographer', license: 'CC BY-SA 4.0', license_url: 'https://creativecommons.org/licenses/by-sa/4.0', matches: 'gray, furrowed, as taxa.csv',
    };
    const ok = speciesExtras({ photoRows: [photo], taxa });
    expect(ok.errors).toEqual([]);
    expect(ok.extras.get('gleditsia-triacanthos').photos.bark.author).toBe('A. Photographer');
    expect(ok.extras.get('gleditsia-triacanthos-inermis-skyline').photos).toMatchObject({ inherited: true, bark: { title: 'File:Bark.jpg' } });

    const bad = speciesExtras({
      photoRows: [
        { ...photo, license: 'CC BY-NC 4.0' },
        { ...photo, author: '' },
        { ...photo, part: 'roots' },
        { ...photo, image_url: 'https://example.org/bark.jpg' },
        { ...photo, matches: '' },
      ],
      taxa,
    });
    expect(bad.errors.join('\n')).toMatch(/not one that allows reuse/);
    expect(bad.errors.join('\n')).toMatch(/author is empty/);
    expect(bad.errors.join('\n')).toMatch(/part must be one of/);
    expect(bad.errors.join('\n')).toMatch(/Commons 500px thumbnail/);
    expect(bad.errors.join('\n')).toMatch(/matches is empty/);
    const inat = speciesExtras({ photoRows: [{ ...photo, image_url: 'https://inaturalist-open-data.s3.amazonaws.com/photos/757919298/medium.jpg', page_url: 'https://www.inaturalist.org/observations/411951899', license: 'CC BY 4.0' }], taxa });
    expect(inat.errors).toEqual([]);
    expect(inat.extras.get('gleditsia-triacanthos').photos.bark.site).toBe('iNaturalist');
  });

  it("lets a cultivar replace one part's photo and keep its species' others", () => {
    const photo = (taxon_id: string, part: string, name: string) => ({
      taxon_id, part, title: `File:${name}.jpg`,
      page_url: `https://commons.wikimedia.org/wiki/File:${name}.jpg`,
      image_url: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${name}.jpg/500px-${name}.jpg`,
      author: 'A. Photographer', license: 'CC BY 4.0', license_url: 'https://creativecommons.org/licenses/by/4.0/', matches: 'as recorded',
    });
    const { errors, extras } = speciesExtras({
      photoRows: [
        photo('gleditsia-triacanthos', 'bark', 'Bark'),
        photo('gleditsia-triacanthos', 'leaves', 'Green'),
        photo('gleditsia-triacanthos-inermis-skyline', 'leaves', 'Gold'),
      ],
      taxa,
    });
    expect(errors).toEqual([]);
    const own = extras.get('gleditsia-triacanthos-inermis-skyline').photos;
    expect(own.inherited).toBeUndefined();
    expect(own.leaves).toMatchObject({ title: 'File:Gold.jpg' });
    expect(own.leaves.inherited).toBeUndefined();
    expect(own.bark).toMatchObject({ title: 'File:Bark.jpg', inherited: true });
    expect(extras.get('gleditsia-triacanthos').photos.inherited).toBeUndefined();

    // Not a flower photo when the cultivar's flowers are another color.
    const hawthorns = [
      { id: 'crataegus-laevigata', genus: 'Crataegus', species: 'laevigata', infra: '', cultivar: '', flowerColor: 'white', fruitColor: 'red' },
      { id: 'crataegus-laevigata-crimson-cloud', genus: 'Crataegus', species: 'laevigata', infra: '', cultivar: 'Crimson Cloud', flowerColor: 'red', fruitColor: 'red' },
    ];
    const red = speciesExtras({ photoRows: [photo('crataegus-laevigata', 'flowers', 'White'), photo('crataegus-laevigata', 'fruit', 'Haws')], taxa: hawthorns });
    expect(red.extras.get('crataegus-laevigata-crimson-cloud').photos).toEqual({ inherited: true, fruit: expect.objectContaining({ title: 'File:Haws.jpg' }) });

    const doc = '- [ ] **Skyline**, bark (`gleditsia-triacanthos-inermis-skyline`, bark).\n- [ ] **Skyline**, leaves (`gleditsia-triacanthos-inermis-skyline`, leaves).';
    expect(staleGaps(doc, extras)).toEqual(['docs/PHOTO-GAPS.md: gleditsia-triacanthos-inermis-skyline now has a leaves photo; tick its line off']);
  });

  it('passes the files in data/', () => {
    const read = (f: string) => Papa.parse<Record<string, string>>(readFileSync(`data/${f}`, 'utf8'), { header: true, skipEmptyLines: true }).data;
    const all = rows.map((r) => ({ id: r.taxon_id, genus: r.genus, species: r.species, infra: r.infraspecific, cultivar: r.cultivar }));
    const { errors, warnings } = speciesExtras({ crownRows: read('crown-forms.csv'), habitatRows: read('habitat.csv'), factRows: read('facts.csv'), photoRows: read('part-photos.csv'), taxa: all });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('draws every crown form', () => {
    for (const form of CROWN_FORMS) {
      const svg = treeDrawing({ id: `t-${form}`, common: 'Tree', family: 'Fagaceae', type: 'deciduous-tree', matureHeightFt: 50, matureSpreadFt: 30, crownForm: form });
      expect(svg, form).toMatch(/<ellipse cx=/);
      expect(svg, form).not.toContain('NaN');
    }
  });

  it('warns about a missing-photo line whose photo has been added', () => {
    const extras = new Map([['oak', { photos: { bark: {} } }], ['elm', { photos: null }]]);
    const doc = '- [ ] **Oak**, bark (`oak`, bark). Any time.\n- [ ] **Elm**, leaves (`elm`, leaves).\n- [x] **Oak**, bark (`oak`, bark).';
    expect(staleGaps(doc, extras)).toEqual(['docs/PHOTO-GAPS.md: oak now has a bark photo; tick its line off']);
  });

  it('lists in docs/PHOTO-GAPS.md only photos that are still missing', () => {
    const read = (f: string) => Papa.parse<Record<string, string>>(readFileSync(`data/${f}`, 'utf8'), { header: true, skipEmptyLines: true }).data;
    const all = rows.map((r) => ({ id: r.taxon_id, genus: r.genus, species: r.species, infra: r.infraspecific, cultivar: r.cultivar }));
    const { extras } = speciesExtras({ photoRows: read('part-photos.csv'), taxa: all });
    expect(staleGaps(readFileSync('docs/PHOTO-GAPS.md', 'utf8'), extras)).toEqual([]);
  });
});
