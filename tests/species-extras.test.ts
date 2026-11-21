import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';
import { yearSummary as tsSummary, yearTable as tsTable } from '../src/fieldguide/year';
import type { Taxon } from '../src/types';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { yearSummary as mjsSummary, yearTable as mjsTable } from '../scripts/lib/year.mjs';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { BURLINGTON, SIZE, inRange, project, rangeTouches } from '../scripts/lib/range-map.mjs';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { crownForm, treeDrawing } from '../scripts/lib/tree-drawing.mjs';
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
