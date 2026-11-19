import { describe, it, expect } from 'vitest';
import { dotScale } from '../src/tree-display';

describe('dot size by zoom', () => {
  it('keeps clustered dots at full size, whatever the zoom', () => {
    for (const z of [13, 15, 17, 20]) expect(dotScale('clusters', z)).toEqual({ scale: 1, weight: 1.5 });
  });
  it('shrinks every-tree dots as the map zooms out', () => {
    const scales = [20, 18, 17, 16, 15, 14].map((z) => dotScale('every', z).scale);
    expect(scales[0]).toBe(1);
    expect(scales[1]).toBe(1);
    for (let i = 1; i < scales.length; i++) expect(scales[i]).toBeLessThanOrEqual(scales[i - 1]!);
    expect(dotScale('every', 15).scale).toBe(0.5);
  });
  it('thins the white edge with the dot', () => {
    expect(dotScale('every', 15).weight).toBeLessThan(dotScale('every', 18).weight);
  });
});
