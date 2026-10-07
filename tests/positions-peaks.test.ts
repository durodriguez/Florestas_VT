import { describe, it, expect } from 'vitest';
import { pairPeaks, parsePeaks, MATCH_M, type Peak } from '../src/positions/peaks';

// Metres to degrees near campus, for laying out small test scenes.
const LAT = 44.475;
const dy = (m: number) => m / 111_320;
const dx = (m: number) => m / (111_320 * Math.cos((LAT * Math.PI) / 180));
const at = (east: number, north: number) => ({ lat: LAT + dy(north), lng: -73.19 + dx(east) });
const peak = (id: string, east: number, north: number, height = 12): Peak => ({ id, height, ...at(east, north) });
const tree = (id: string, east: number, north: number) => ({ id, ...at(east, north) });

describe('pairPeaks', () => {
  it('gives a tree the peak beside it, with the distance', () => {
    const { byTree } = pairPeaks([tree('A', 0, 0)], [peak('P1', 3, 4)]);
    expect(byTree.get('A')!.peak.id).toBe('P1');
    expect(byTree.get('A')!.distance).toBeCloseTo(5, 1);
  });

  it('gives each peak to one tree only, the nearer one', () => {
    // A is 1 m from the only peak, B 3 m: B must not be offered A's crown.
    const { byTree } = pairPeaks([tree('B', 3, 0), tree('A', -1, 0)], [peak('P1', 0, 0)]);
    expect(byTree.get('A')!.peak.id).toBe('P1');
    expect(byTree.has('B')).toBe(false);
  });

  it('settles a crowded grove by nearest pairs first, not by list order', () => {
    // Taken in list order, A would grab P2 (1.5 m) and leave B with nothing;
    // nearest-first gives P2 to B (0.5 m) and A its own P1.
    const { byTree } = pairPeaks(
      [tree('A', 0, 0), tree('B', 2, 0)],
      [peak('P1', -2, 0), peak('P2', 1.5, 0)],
    );
    expect(byTree.get('B')!.peak.id).toBe('P2');
    expect(byTree.get('A')!.peak.id).toBe('P1');
  });

  it('does not pair across more than the radius', () => {
    const { byTree } = pairPeaks([tree('A', 0, 0)], [peak('P1', MATCH_M + 0.5, 0)]);
    expect(byTree.size).toBe(0);
  });

  it('lets a city tree keep its own crown', () => {
    const { byTree } = pairPeaks([tree('UVM-1', 3, 0), tree('BTV-9', 0.5, 0)], [peak('P1', 0, 0)]);
    expect(byTree.get('BTV-9')!.peak.id).toBe('P1');
    expect(byTree.has('UVM-1')).toBe(false);
  });

  it('calls a peak an orphan only when no mapped tree is near it at all', () => {
    // P2 lost the pairing to nothing — A took P1 — but A is still within
    // reach, so P2 is a spare peak on a big crown, not an unmapped tree.
    const { orphans } = pairPeaks(
      [tree('A', 0, 0)],
      [peak('P1', 0.5, 0), peak('P2', 4, 0), peak('P3', 30, 0)],
    );
    expect(orphans.map((p) => p.id)).toEqual(['P3']);
  });

  it('works across bucket edges', () => {
    // Every pairing within the radius is found, whichever grid cells the two fall in.
    for (let e = -10; e <= 10; e += 0.7) {
      const { byTree } = pairPeaks([tree('A', e, e / 2)], [peak('P1', e + 5, e / 2 + 5)]);
      expect(byTree.get('A')?.peak.id).toBe('P1');
    }
  });
});

describe('parsePeaks', () => {
  it('reads the build file by column name', () => {
    expect(parsePeaks({ fields: ['id', 'lat', 'lng', 'height_m'], rows: [['P0001', 44.48, -73.19, 22.3]] }))
      .toEqual([{ id: 'P0001', lat: 44.48, lng: -73.19, height: 22.3 }]);
  });
});
