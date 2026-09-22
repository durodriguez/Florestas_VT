import { describe, it, expect } from 'vitest';
import { bearingDegrees, compassPoint, distanceMeters } from '../src/geo';
import {
  accessionForTag, describeDistance, mappedByTag, mappedNeighbours, nearbyTrees,
  type MappedTree,
} from '../src/field/nearby';

/** A metre of latitude is about 1/111111 of a degree at this latitude. */
const M = 1 / 111111;
const HERE = { lat: 44.4779, lng: -73.1955 };

const tree = (id: string, northM: number, eastM: number, over: Partial<MappedTree> = {}): MappedTree => ({
  id,
  lat: HERE.lat + northM * M,
  lng: HERE.lng + (eastM * M) / Math.cos((HERE.lat * Math.PI) / 180),
  common: 'Sugar maple',
  sci: 'Acer saccharum',
  surveyed: null,
  ...over,
});

describe('bearingDegrees and compassPoint', () => {
  it('reads the four cardinal directions', () => {
    expect(compassPoint(bearingDegrees(HERE.lat, HERE.lng, HERE.lat + 10 * M, HERE.lng))).toBe('north');
    expect(compassPoint(bearingDegrees(HERE.lat, HERE.lng, HERE.lat - 10 * M, HERE.lng))).toBe('south');
    expect(compassPoint(bearingDegrees(HERE.lat, HERE.lng, HERE.lat, HERE.lng + 10 * M))).toBe('east');
    expect(compassPoint(bearingDegrees(HERE.lat, HERE.lng, HERE.lat, HERE.lng - 10 * M))).toBe('west');
  });

  it('rounds to the nearest of eight points', () => {
    expect(compassPoint(0)).toBe('north');
    expect(compassPoint(44)).toBe('northeast');
    expect(compassPoint(46)).toBe('northeast');
    expect(compassPoint(359)).toBe('north');
  });

  it('handles a bearing outside 0-360 rather than indexing off the end', () => {
    expect(compassPoint(-45)).toBe('northwest');
    expect(compassPoint(405)).toBe('northeast');
  });
});

describe('nearbyTrees', () => {
  const trees = [
    tree('UVM-0001', 14, 0),
    tree('UVM-0002', 3, 0),
    tree('UVM-0003', 0, 8),
    tree('UVM-0004', 200, 0), // well outside the radius
  ];

  it('offers only what is within the radius', () => {
    expect(nearbyTrees(HERE.lat, HERE.lng, trees).map((h) => h.tree.id))
      .toEqual(['UVM-0002', 'UVM-0003', 'UVM-0001']);
  });

  it('sorts by distance and nothing else', () => {
    // Not by species, not by whether it has been surveyed: sorting by anything
    // but distance would make one of three plausible maples look like the
    // answer, and the surveyor is the one who can actually tell.
    const mixed = [
      tree('far-unsurveyed', 20, 0),
      tree('near-surveyed', 4, 0, { surveyed: '2026-09-01' }),
    ];
    expect(nearbyTrees(HERE.lat, HERE.lng, mixed).map((h) => h.tree.id))
      .toEqual(['near-surveyed', 'far-unsurveyed']);
  });

  it('still offers a tree that has been surveyed', () => {
    // An untagged tree can only ever be found this way, so hiding a surveyed
    // one would make re-surveying it impossible rather than merely awkward.
    const seen = [tree('UVM-0009', 5, 0, { surveyed: '2026-09-01' })];
    expect(nearbyTrees(HERE.lat, HERE.lng, seen)).toHaveLength(1);
  });

  it('caps the list rather than handing back something to scroll', () => {
    const many = Array.from({ length: 20 }, (_, i) => tree(`t${i}`, i + 1, 0));
    expect(nearbyTrees(HERE.lat, HERE.lng, many)).toHaveLength(6);
    expect(nearbyTrees(HERE.lat, HERE.lng, many, { limit: 2 })).toHaveLength(2);
  });

  it('returns nothing when the map has nothing nearby', () => {
    expect(nearbyTrees(HERE.lat, HERE.lng, [tree('far', 500, 0)])).toEqual([]);
    expect(nearbyTrees(HERE.lat, HERE.lng, [])).toEqual([]);
  });

  it('measures and bears correctly enough to act on', () => {
    const [hit] = nearbyTrees(HERE.lat, HERE.lng, [tree('x', 7, 7)]);
    expect(hit!.meters).toBeCloseTo(Math.sqrt(98), 0);
    expect(hit!.heading).toBe('northeast');
  });
});

describe('describeDistance', () => {
  const at = (northM: number, eastM: number) =>
    describeDistance(nearbyTrees(HERE.lat, HERE.lng, [tree('x', northM, eastM)])[0]!);

  it('reads as metres and a direction', () => {
    expect(at(0, 7)).toBe('7 m east');
  });

  it('drops the heading up close, where a direction is noise', () => {
    expect(at(1, 0)).toBe('1 m away');
    expect(at(0, 0)).toBe('0 m away');
  });

  it('rounds to the metre, which is all a phone fix supports', () => {
    expect(at(0, 7.4)).toBe('7 m east');
    expect(at(0, 7.6)).toBe('8 m east');
  });
});

describe('distanceMeters still behaves after the move to src/geo', () => {
  it('is zero for one point and symmetric for two', () => {
    expect(distanceMeters(HERE.lat, HERE.lng, HERE.lat, HERE.lng)).toBe(0);
    const a = distanceMeters(44.4779, -73.1955, 44.4716, -73.1971);
    const b = distanceMeters(44.4716, -73.1971, 44.4779, -73.1955);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('accessionForTag', () => {
  it('pads a tag to the four digits the labels use', () => {
    expect(accessionForTag('763')).toBe('UVM-0763');
    expect(accessionForTag('3235')).toBe('UVM-3235');
    expect(accessionForTag('1')).toBe('UVM-0001');
    expect(accessionForTag(' 763 ')).toBe('UVM-0763');
  });

  it('refuses anything that is not a tag number', () => {
    expect(accessionForTag('')).toBeNull();
    expect(accessionForTag('Young')).toBeNull();
    expect(accessionForTag('1818 or 1942')).toBeNull();
    expect(accessionForTag('12345')).toBeNull();
  });
});

describe('mappedByTag', () => {
  const trees = [
    { id: 'UVM-3235', lat: 44.4823, lng: -73.1958, common: 'Northern white cedar', sci: 'Thuja occidentalis', surveyed: '2023-11-10' },
    { id: 'UVM-3236', lat: 44.4823, lng: -73.1958, common: 'Northern white cedar', sci: 'Thuja occidentalis', surveyed: '2023-11-10' },
    { id: 'UVM-0763', lat: 44.4760, lng: -73.1950, common: 'River birch', sci: 'Betula nigra', surveyed: '2026-09-01' },
    { id: 'UVM-4001', lat: 44.4700, lng: -73.1990, common: 'Norway maple', sci: 'Acer platanoides', surveyed: null },
  ];

  it('finds a tag the 2014 inventory never had', () => {
    // The bug this fixes: 3235 was surveyed in 2023 and the app said no such
    // tree, because it only ever asked the 2014 file.
    expect(mappedByTag('3235', trees)?.sci).toBe('Thuja occidentalis');
  });

  it('finds a tag whatever padding it is typed with', () => {
    expect(mappedByTag('763', trees)?.id).toBe('UVM-0763');
    expect(mappedByTag('0763', trees)?.id).toBe('UVM-0763');
  });

  it('gives back nothing for a tag on no record', () => {
    expect(mappedByTag('9999', trees)).toBeUndefined();
    expect(mappedByTag('Young', trees)).toBeUndefined();
  });

  it('finds a record with no survey behind it', () => {
    // A tree somebody plotted but nobody has measured is a normal record.
    expect(mappedByTag('4001', trees)?.surveyed).toBeNull();
  });
});

describe('mappedNeighbours', () => {
  const trees = [
    { id: 'UVM-3234', lat: 0, lng: 0, common: 'Sugar maple', sci: 'Acer saccharum', surveyed: null },
    { id: 'UVM-3236', lat: 0, lng: 0, common: 'Northern white cedar', sci: 'Thuja occidentalis', surveyed: null },
    { id: 'UVM-3299', lat: 0, lng: 0, common: 'Red oak', sci: 'Quercus rubra', surveyed: null },
  ];

  it('offers the tags either side, for a tag that has lost a digit', () => {
    const ids = mappedNeighbours('3235', trees).map((t) => t.id);
    expect(ids).toEqual(['UVM-3234', 'UVM-3236']);
  });

  it('leaves out anything outside the span', () => {
    expect(mappedNeighbours('3235', trees).map((t) => t.id)).not.toContain('UVM-3299');
  });

  it('offers nothing for a tag that is not a number', () => {
    expect(mappedNeighbours('Young', trees)).toEqual([]);
  });
});
