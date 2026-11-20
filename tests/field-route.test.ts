import { describe, it, expect } from 'vitest';
import { coverage, needsOf, planRoute, routeLength } from '../src/field/route';
import type { MappedTree } from '../src/field/nearby';

// About 11 m per 0.0001° of latitude here, so trees laid out along a line.
const at = (id: string, north: number, over: Partial<MappedTree> = {}): MappedTree => ({
  id, tag: '', lat: 44.478 + north * 0.0001, lng: -73.198, common: 'Tree', sci: 'Acer rubrum', surveyed: null,
  ...over,
});
const ME = { lat: 44.478, lng: -73.198 };

describe('what a tree needs', () => {
  it('a trunk size, a photo, and a species check for one named only to genus', () => {
    expect(needsOf(at('A', 0))).toEqual(['trunk', 'photo']);
    expect(needsOf(at('B', 0, { measured: '2014', photo: true }))).toEqual([]);
    expect(needsOf(at('C', 0, { measured: '2014', photo: true, genusOnly: true }))).toEqual(['species']);
    expect(needsOf(at('D', 0, { gone: true }))).toEqual([]);
  });
});

describe('the route', () => {
  it('visits the nearest trees that need what is asked, nearest next', () => {
    const trees = [at('FAR', 9), at('NEAR', 1), at('MID', 5), at('DONE', 2, { measured: '2022' })];
    const stops = planRoute(ME, trees, { wants: new Set(['trunk']) });
    expect(stops.map((s) => s.tree.id)).toEqual(['NEAR', 'MID', 'FAR']);
    expect(stops[0]!.needs).toEqual(['trunk']);
    expect(Math.round(stops[1]!.legM)).toBe(44);
    expect(Math.round(routeLength(stops))).toBe(100);
  });
  it('walks on from each stop, not back to the start', () => {
    // From ME the order by distance alone would be S1, N1, S2; nearest-next
    // finishes one side before crossing back.
    const trees = [at('N1', 2), at('S1', -1), at('S2', -3)];
    expect(planRoute(ME, trees, { wants: new Set(['trunk']) }).map((s) => s.tree.id)).toEqual(['S1', 'S2', 'N1']);
  });
  it('skips trees visited on this device, and keeps to the limit and radius', () => {
    const trees = Array.from({ length: 30 }, (_, i) => at(`T${i}`, i + 1));
    const stops = planRoute(ME, trees, { wants: new Set(['trunk']), visited: new Set(['T0']), limit: 5, radiusM: 1000 });
    expect(stops.map((s) => s.tree.id)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5']);
    expect(planRoute(ME, trees, { wants: new Set(['trunk']), radiusM: 25 })).toHaveLength(2);
  });
  it('finds nothing when nothing nearby needs what is asked', () => {
    expect(planRoute(ME, [at('A', 1, { photo: true })], { wants: new Set(['photo']) })).toEqual([]);
  });
});

describe('coverage', () => {
  it('counts the trees of an area with a trunk size', () => {
    const trees = [at('A', 0, { area: 'Trinity Campus', measured: '2014' }), at('B', 0, { area: 'Trinity Campus' }), at('C', 0, { area: 'Central Campus' })];
    expect(coverage(trees, 'Trinity Campus')).toEqual({ measured: 1, total: 2 });
  });
});
