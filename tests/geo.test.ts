import { describe, it, expect } from 'vitest';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { campusAt, inGeometry } from '../scripts/lib/geo.mjs';

const square = (lng: number, lat: number, d: number) => [
  [lng, lat], [lng + d, lat], [lng + d, lat + d], [lng, lat + d], [lng, lat],
];

const polygon = { type: 'Polygon', coordinates: [square(-73.2, 44.47, 0.01)] };

describe('inGeometry', () => {
  it('finds a point inside', () => {
    expect(inGeometry(-73.195, 44.475, polygon)).toBe(true);
  });

  it('rejects a point outside', () => {
    expect(inGeometry(-73.18, 44.475, polygon)).toBe(false);
  });

  // A vertex sitting exactly on the ray's latitude is the classic double-count
  // bug: the ray crosses two edges at one point and the answer flips twice.
  it('does not double-count a vertex level with the point', () => {
    const spiky = {
      type: 'Polygon',
      coordinates: [[[-73.2, 44.47], [-73.19, 44.48], [-73.18, 44.47], [-73.18, 44.49], [-73.2, 44.49], [-73.2, 44.47]]],
    };
    expect(inGeometry(-73.195, 44.48, spiky)).toBe(true);
    expect(inGeometry(-73.21, 44.48, spiky)).toBe(false);
  });

  it('excludes a point inside a hole', () => {
    const withHole = {
      type: 'Polygon',
      coordinates: [square(-73.2, 44.47, 0.01), square(-73.197, 44.473, 0.004)],
    };
    expect(inGeometry(-73.195, 44.475, withHole)).toBe(false);
    expect(inGeometry(-73.1915, 44.4785, withHole)).toBe(true);
  });

  it('handles a MultiPolygon by testing every part', () => {
    const multi = {
      type: 'MultiPolygon',
      coordinates: [[square(-73.2, 44.47, 0.005)], [square(-73.19, 44.45, 0.005)]],
    };
    expect(inGeometry(-73.1975, 44.4725, multi)).toBe(true);
    expect(inGeometry(-73.1875, 44.4525, multi)).toBe(true);
    expect(inGeometry(-73.193, 44.46, multi)).toBe(false);
  });

  it('is false for missing geometry', () => {
    expect(inGeometry(-73.19, 44.47, null)).toBe(false);
  });
});

describe('campusAt', () => {
  const areas = {
    type: 'FeatureCollection',
    features: [
      // The boundary contains every campus, so matching it would file every
      // plant under the outline instead of the campus it actually stands in.
      { properties: { area_id: 'campus-boundary', kind: 'boundary' },
        geometry: { type: 'Polygon', coordinates: [square(-73.21, 44.46, 0.05)] } },
      { properties: { area_id: 'central', kind: 'campus' },
        geometry: { type: 'Polygon', coordinates: [square(-73.2, 44.47, 0.01)] } },
      { properties: { area_id: 'spear', kind: 'campus' },
        geometry: { type: 'Polygon', coordinates: [square(-73.19, 44.462, 0.004)] } },
    ],
  };

  it('returns the campus a point stands in, never the boundary', () => {
    expect(campusAt(-73.195, 44.475, areas)).toBe('central');
    expect(campusAt(-73.188, 44.464, areas)).toBe('spear');
  });

  it('returns null inside the boundary but no campus', () => {
    expect(campusAt(-73.205, 44.465, areas)).toBeNull();
  });

  it('returns null well outside everything', () => {
    expect(campusAt(-72.0, 44.0, areas)).toBeNull();
  });

  it('survives an empty file', () => {
    expect(campusAt(-73.195, 44.475, { type: 'FeatureCollection', features: [] })).toBeNull();
    expect(campusAt(-73.195, 44.475, undefined)).toBeNull();
  });
});
