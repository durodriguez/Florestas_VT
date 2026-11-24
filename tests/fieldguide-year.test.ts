import { describe, it, expect } from 'vitest';
import { colorOf, monthRuns, yearSummary, yearTable } from '../src/fieldguide/year';
import { tilesFor, yearText } from '../src/fieldguide/tiles';
import { neighbours, othersOfItsKind, step, stepText } from '../src/fieldguide/walk';
import type { Plant } from '../src/types';

const cal = (over: Record<string, unknown> = {}) => ({
  type: 'deciduous-tree', family: 'Rosaceae', flowerMonths: [] as number[], flowerColor: '', fruitMonths: [] as number[], fruitColor: '', fallColor: '', ...over,
}) as Parameters<typeof yearTable>[0];
const crab = cal({ flowerColor: 'pink', flowerMonths: [5], fruitColor: 'red', fruitMonths: [9, 10, 11], fallColor: 'yellow' });
const filled = (row: { cells: unknown[] }) => row.cells.map((c, i) => (c ? i + 1 : 0)).filter(Boolean);

describe('a tree’s year', () => {
  it('colors the leaves of a tree that is not green in summer', () => {
    const crimson = cal({ family: 'Sapindaceae', flowerColor: 'yellow', flowerMonths: [4, 5], fruitColor: 'brown', fruitMonths: [9, 10], fallColor: 'bronze', leafColor: 'purple' });
    const leaves = yearTable(crimson)[0]!.cells;
    expect(leaves[6]).toMatchObject({ title: 'Purple leaves' });
    expect(leaves[6]!.color).not.toBe(yearTable(cal({}))[0]!.cells[6]?.color);
    expect(leaves[9]).toMatchObject({ title: 'Bronze fall color' });
    expect(yearSummary(crimson)).toBe('Yellow flowers from April to May. Purple leaves from May to September. Brown fruit from September to October. Bronze fall color in October.');
    const spruce = cal({ type: 'evergreen-tree', family: 'Pinaceae', leafColor: 'blue-gray' });
    expect(yearTable(spruce)[0]!.cells[0]).toMatchObject({ title: 'Evergreen, blue-gray foliage' });
    expect(yearSummary(spruce)).toBe('Blue-gray foliage all year.');
  });

  it('names months as runs, across New Year too', () => {
    expect(monthRuns([5])).toBe('May');
    expect(monthRuns([9, 10, 11])).toBe('September to November');
    expect(monthRuns([11, 12, 1, 2])).toBe('November to February');
    expect(monthRuns([4, 5, 8])).toBe('April to May and August');
    expect(monthRuns([])).toBe('');
    expect(monthRuns([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe('all year');
  });
  it('has three rows: leaves, with October in the fall color; flowers; fruit', () => {
    const [leaves, flowers, fruit] = yearTable(crab);
    expect(leaves!.label).toBe('Leaves');
    expect(filled(leaves!)).toEqual([5, 6, 7, 8, 9, 10]);
    expect(leaves!.cells[9]!.title).toBe('Yellow fall color');
    expect(leaves!.cells[9]!.color).toBe(colorOf('yellow'));
    expect(filled(flowers!)).toEqual([5]);
    expect(filled(fruit!)).toEqual([9, 10, 11]);
  });
  it('shows every flower and fruit in its real color, green and brown included', () => {
    const oak = cal({ family: 'Fagaceae', flowerColor: 'yellow-green', flowerMonths: [5], fruitColor: 'brown', fruitMonths: [9, 10], fallColor: 'purple' });
    const [, flowers, fruit] = yearTable(oak);
    expect(flowers!.cells[4]!.color).toContain('color-mix');
    expect(fruit!.cells[8]!.title).toBe('Brown fruit');
  });
  it('calls a conifer’s fruit cones, and keeps an evergreen in leaf all year', () => {
    const spruce = cal({ type: 'evergreen-tree', family: 'Pinaceae', flowerColor: 'red', flowerMonths: [5], fruitColor: 'brown', fruitMonths: [9, 10], fallColor: 'none' });
    const [leaves, , cones] = yearTable(spruce);
    expect(filled(leaves!)).toHaveLength(12);
    expect(cones!.label).toBe('Cones');
    expect(yearSummary(spruce)).toBe('Red flowers in May. Brown cones from September to October.');
  });
  it('says the table in words, in the order the year goes', () => {
    expect(yearSummary(crab)).toBe('Pink flowers in May. Red fruit from September to November. Yellow fall color in October.');
    expect(yearSummary(cal({ flowerColor: 'green', flowerMonths: [4, 5], fruitColor: 'tan', fruitMonths: [9, 10], fallColor: 'yellow' })))
      .toBe('Green flowers from April to May. Tan fruit from September to October. Yellow fall color in October.');
    expect(yearSummary(cal())).toBe('');
  });
});

describe('the two tiles', () => {
  const NOW = new Date(2026, 10, 21);
  const tree = (over: Partial<Plant> = {}) => ({
    id: 'UVM-0001', taxon: { id: 'malus-sp', ...crab }, dbhIn: null, dbhOn: null, heightFt: null, spreadFt: null,
    condition: 'good', conditionOn: null, surveyedOn: '2023-10-05', ...over,
  }) as unknown as Plant;
  it('dates to the year, so a tile fits one line', () => {
    expect(yearText('2023-10-05', NOW)).toBe('2023, 3 years ago');
    expect(yearText('2026-09-01', NOW)).toBe('2026');
  });
  it('size first, then what it is doing this month', () => {
    const t = tilesFor(tree({ dbhIn: 10, dbhOn: '2014' }), 11, NOW);
    expect(t.tiles.map((x) => [x.label, x.value, x.sub])).toEqual([['Trunk diameter', '10 in', '2014, 12 years ago'], ['Right now', 'In fruit', 'November']]);
    expect(t.conditionShown).toBe(false);
  });
  it('condition in the first tile when nothing is measured', () => {
    const t = tilesFor(tree(), 11, NOW);
    expect(t.tiles.map((x) => x.label)).toEqual(['Condition', 'Right now']);
    expect(t.tiles[0]!.sub).toBe('2023, 3 years ago');
  });
  it('one tile for a tree not yet identified, with nothing measured', () => {
    const t = tilesFor(tree({ taxon: { id: 'unknown' } as Plant['taxon'] }), 11, NOW);
    expect(t.tiles.map((x) => x.label)).toEqual(['Condition']);
    const sized = tilesFor(tree({ taxon: { id: 'unknown' } as Plant['taxon'], dbhIn: 8, dbhOn: '2014' }), 11, NOW);
    expect(sized.tiles.map((x) => x.label)).toEqual(['Trunk diameter', 'Condition']);
  });
});

const p = (id: string, taxon: string, north: number, status = 'active') =>
  ({ id, lat: 44.478 + north * 0.0001, lng: -73.199, status, taxon: { id: taxon } }) as unknown as Plant;

describe('getting there', () => {
  it('how far and which way', () => {
    const s = step({ lat: 44.478, lng: -73.199 }, { lat: 44.479, lng: -73.199 });
    expect(s.heading).toBe('north');
    expect(stepText(s)).toBe('111 m north');
    expect(stepText({ meters: 1234, heading: 'south' })).toBe('1.2 km south');
  });
  it('the others of its species, nearest first, standing only', () => {
    const me = p('A', 'ginkgo', 0);
    const all = [me, p('B', 'ginkgo', 5), p('C', 'ginkgo', 2), p('D', 'ginkgo', 1, 'removed'), p('E', 'oak', 1)];
    expect(othersOfItsKind(me, all).map((o) => o.plant.id)).toEqual(['C', 'B']);
  });
  it('no others for a tree not yet identified', () => {
    const me = p('A', 'unknown', 0);
    expect(othersOfItsKind(me, [me, p('B', 'unknown', 1)])).toEqual([]);
  });
  it('a tour walked forward, or in reverse from its last stop', () => {
    expect(neighbours(0, 10, 1)).toEqual({ prev: null, next: 1 });
    expect(neighbours(9, 10, 1)).toEqual({ prev: 8, next: null });
    expect(neighbours(9, 10, -1)).toEqual({ prev: null, next: 8 });
    expect(neighbours(0, 10, -1)).toEqual({ prev: 1, next: null });
  });
});
