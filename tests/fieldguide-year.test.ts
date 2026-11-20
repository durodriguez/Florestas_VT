import { describe, it, expect } from 'vitest';
import { monthRuns, yearInWords, yearOf } from '../src/fieldguide/year';
import { neighbours, othersOfItsKind, step, stepText } from '../src/fieldguide/walk';
import type { Plant } from '../src/types';

const cal = (over: Record<string, unknown> = {}) => ({
  type: 'deciduous-tree', flowerMonths: [] as number[], flowerColor: '', fruitMonths: [] as number[], fruitColor: '', fallColor: '', ...over,
}) as Parameters<typeof yearOf>[0];

describe('a tree’s year', () => {
  it('names months as runs, across New Year too', () => {
    expect(monthRuns([5])).toBe('May');
    expect(monthRuns([9, 10, 11])).toBe('September to November');
    expect(monthRuns([11, 12, 1, 2])).toBe('November to February');
    expect(monthRuns([4, 5, 8])).toBe('April to May and August');
    expect(monthRuns([])).toBe('');
    expect(monthRuns([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe('all year');
  });
  it('a strip of twelve months, the same as the map colors', () => {
    const crab = cal({ flowerColor: 'pink', flowerMonths: [5], fruitColor: 'red', fruitMonths: [9, 10, 11], fallColor: 'yellow' });
    expect(yearOf(crab).map((m) => m.state)).toEqual(['bare', 'bare', 'bare', 'bare', 'flower', 'leaf', 'leaf', 'leaf', 'fruit', 'fall', 'fruit', 'bare']);
  });
  it('says the showy parts in the order they come', () => {
    const crab = cal({ flowerColor: 'pink', flowerMonths: [5], fruitColor: 'red', fruitMonths: [9, 10, 11], fallColor: 'yellow' });
    expect(yearInWords(crab)).toEqual(['Pink flowers in May.', 'Red fruit from September to November.', 'Yellow fall color in October.']);
  });
  it('leaves out green flowers, and an evergreen’s pollen and fall color', () => {
    expect(yearInWords(cal({ flowerColor: 'green', flowerMonths: [4], fallColor: 'red' }))).toEqual(['Red fall color in October.']);
    expect(yearInWords(cal({ type: 'evergreen-tree', flowerColor: 'red', flowerMonths: [5], fruitColor: 'red', fruitMonths: [9], fallColor: 'yellow' })))
      .toEqual(['Red fruit in September.']);
    expect(yearInWords(cal())).toEqual([]);
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
