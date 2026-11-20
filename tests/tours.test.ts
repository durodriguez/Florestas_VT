import { describe, it, expect } from 'vitest';
// @ts-expect-error plain JS module, no type declarations
import { buildTours } from '../scripts/lib/tours.mjs';

const plants: Record<string, { lat: number; lng: number; active: boolean }> = {
  A: { lat: 44.478, lng: -73.2, active: true },
  B: { lat: 44.479, lng: -73.2, active: true },
  C: { lat: 44.48, lng: -73.2, active: false },
};
const at = (id: string) => plants[id];
const tour = { tour_id: 't', name: 'A walk', description: 'Two trees.' };

describe('tours', () => {
  it('puts the stops in order and measures the walk stop to stop', () => {
    const r = buildTours([tour], [
      { tour_id: 't', stop: '2', plant_id: 'B', note: 'second' },
      { tour_id: 't', stop: '1', plant_id: 'A', note: 'first' },
    ], at);
    expect(r.errors).toEqual([]);
    expect(r.tours[0].stops).toEqual([{ plantId: 'A', note: 'first' }, { plantId: 'B', note: 'second' }]);
    expect(r.tours[0].lengthM).toBe(111);
  });
  it('refuses an unknown tree, a repeated stop number and an unknown tour', () => {
    const r = buildTours([tour], [
      { tour_id: 't', stop: '1', plant_id: 'A' },
      { tour_id: 't', stop: '1', plant_id: 'B' },
      { tour_id: 't', stop: '2', plant_id: 'Z' },
      { tour_id: 'nope', stop: '1', plant_id: 'A' },
    ], at);
    expect(r.errors.join(' | ')).toMatch(/already has a stop 1/);
    expect(r.errors.join(' | ')).toMatch(/"Z" is not in plants.csv/);
    expect(r.errors.join(' | ')).toMatch(/"nope" is not in tours.csv/);
  });
  it('warns about a tree no longer standing, and leaves out a tour of one stop', () => {
    const r = buildTours([tour], [{ tour_id: 't', stop: '1', plant_id: 'C' }], at);
    expect(r.warnings.join(' | ')).toMatch(/C is no longer standing/);
    expect(r.warnings.join(' | ')).toMatch(/needs at least two/);
    expect(r.tours).toEqual([]);
  });
});
