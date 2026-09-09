import { describe, it, expect } from 'vitest';
import {
  areaM2, carve, dropSlivers, intersect, outside, ringAreaM2, subtractAll, toGeometry, toMultiPoly,
  transfer, union,
  type MultiPoly, type Ring,
} from '../src/tracer/split';

/** A square `deg` across with its south-west corner at (lng, lat). */
const square = (lng: number, lat: number, deg: number): Ring => [
  [lng, lat], [lng + deg, lat], [lng + deg, lat + deg], [lng, lat + deg], [lng, lat],
];

// Roughly campus-sized and campus-located, so the metre conversions are
// exercised at the latitude they will actually run at.
const boundary: MultiPoly = [[square(-73.2, 44.47, 0.02)]];

describe('area', () => {
  it('measures a ring in square metres', () => {
    // 0.02 deg of latitude is ~2224 m; longitude shrinks by cos(44.48).
    const a = ringAreaM2(square(-73.2, 44.47, 0.02));
    expect(a / 1e6).toBeGreaterThan(3.4);
    expect(a / 1e6).toBeLessThan(3.6);
  });

  it('subtracts holes from the enclosing ring', () => {
    const withHole: MultiPoly = [[square(-73.2, 44.47, 0.02), square(-73.195, 44.475, 0.005)]];
    expect(areaM2(withHole)).toBeLessThan(areaM2(boundary));
  });
});

describe('carve', () => {
  it('splits the remainder into the assigned part and what is left', () => {
    // A shape covering the western half, drawn well past the western edge.
    const drawn: Ring = [[-73.25, 44.46], [-73.19, 44.46], [-73.19, 44.50], [-73.25, 44.50]];
    const { assigned, remaining } = carve(boundary, drawn);
    expect(assigned).toHaveLength(1);
    expect(remaining).toHaveLength(1);
    // Nothing is created or lost: the two pieces still add up to the whole.
    expect(areaM2(assigned) + areaM2(remaining)).toBeCloseTo(areaM2(boundary), 0);
  });

  it('clips the assigned piece back to the boundary, however sloppy the draw', () => {
    // Entirely swallows the boundary, and then some.
    const drawn: Ring = [[-73.3, 44.4], [-73.1, 44.4], [-73.1, 44.55], [-73.3, 44.55]];
    const { assigned, remaining } = carve(boundary, drawn);
    expect(areaM2(assigned)).toBeCloseTo(areaM2(boundary), 0);
    expect(remaining).toEqual([]);
  });

  it('reports nothing assigned when the shape misses the remainder', () => {
    const elsewhere: Ring = [[-73.0, 44.4], [-72.99, 44.4], [-72.99, 44.41], [-73.0, 44.41]];
    const { assigned, remaining } = carve(boundary, elsewhere);
    expect(assigned).toEqual([]);
    expect(areaM2(remaining)).toBeCloseTo(areaM2(boundary), 0);
  });

  it('refuses a shape with fewer than three points', () => {
    expect(carve(boundary, [[-73.2, 44.47], [-73.19, 44.47]]).assigned).toEqual([]);
  });

  it('normalises a self-intersecting shape rather than failing on it', () => {
    // A bowtie: the two lobes cross in the middle.
    const bowtie: Ring = [[-73.21, 44.465], [-73.185, 44.485], [-73.21, 44.485], [-73.185, 44.465]];
    const { assigned } = carve(boundary, bowtie);
    expect(areaM2(assigned)).toBeGreaterThan(0);
  });

  it('can leave a hole when the drawn shape sits wholly inside', () => {
    const island: Ring = square(-73.195, 44.475, 0.005).slice(0, -1);
    const { assigned, remaining } = carve(boundary, island);
    expect(areaM2(assigned)).toBeGreaterThan(0);
    expect(remaining[0]!.length).toBe(2); // an outer ring plus the hole
    expect(areaM2(assigned) + areaM2(remaining)).toBeCloseTo(areaM2(boundary), 0);
  });

  // Repeated carving is the actual workflow — five areas out of one boundary.
  it('conserves area across a sequence of carves', () => {
    let remaining = boundary;
    const taken: MultiPoly[] = [];
    for (const west of [-73.2, -73.195, -73.19, -73.185]) {
      const strip: Ring = [[west, 44.46], [west + 0.005, 44.46], [west + 0.005, 44.50], [west, 44.50]];
      const r = carve(remaining, strip);
      taken.push(r.assigned);
      remaining = r.remaining;
    }
    const total = taken.reduce((sum, t) => sum + areaM2(t), 0) + areaM2(remaining);
    expect(total).toBeCloseTo(areaM2(boundary), 0);
  });
});

describe('subtractAll', () => {
  it('returns what no one has claimed', () => {
    const half: Ring = [[-73.25, 44.46], [-73.19, 44.46], [-73.19, 44.50], [-73.25, 44.50]];
    const { assigned } = carve(boundary, half);
    expect(areaM2(subtractAll(boundary, [assigned]))).toBeCloseTo(areaM2(boundary) - areaM2(assigned), 0);
  });

  it('returns the whole thing when nothing has been claimed', () => {
    expect(subtractAll(boundary, [[], []])).toEqual(boundary);
  });
});

describe('conversions', () => {
  it('round-trips a Polygon', () => {
    const g: GeoJSON.Polygon = { type: 'Polygon', coordinates: [square(-73.2, 44.47, 0.01)] };
    expect(toGeometry(toMultiPoly(g))).toEqual(g);
  });

  it('collapses a single-part MultiPolygon to a Polygon', () => {
    expect(toGeometry([[square(-73.2, 44.47, 0.01)]])!.type).toBe('Polygon');
  });

  it('keeps a genuine MultiPolygon as one', () => {
    expect(toGeometry([[square(-73.2, 44.47, 0.005)], [square(-73.18, 44.47, 0.005)]])!.type)
      .toBe('MultiPolygon');
  });

  it('returns null for nothing at all', () => {
    expect(toGeometry([])).toBeNull();
  });
});

describe('dropSlivers', () => {
  it('drops clipping noise but keeps real pieces', () => {
    const noise: MultiPoly = [[square(-73.2, 44.47, 0.01)], [square(-73.18, 44.47, 0.00001)]];
    expect(dropSlivers(noise)).toHaveLength(1);
  });
});

describe('union and outside', () => {
  // Spear Street Campus sits about 1.2 km south of everything else, so the
  // campus boundary has to become a two-part MultiPolygon to hold it.
  const detached: MultiPoly = [[square(-73.19, 44.452, 0.008)]];

  it('keeps disjoint parts separate rather than bridging them', () => {
    const merged = union(boundary, detached);
    expect(merged).toHaveLength(2);
    expect(areaM2(merged)).toBeCloseTo(areaM2(boundary) + areaM2(detached), 0);
  });

  it('dissolves the shared edge between touching parts', () => {
    const abutting: MultiPoly = [[square(-73.18, 44.47, 0.02)]];
    expect(union(boundary, abutting)).toHaveLength(1);
  });

  it('ignores empty parts', () => {
    expect(union([], boundary, [])).toEqual(boundary);
    expect(union([], [])).toEqual([]);
  });

  it('reports the part of a shape that falls outside the boundary', () => {
    expect(areaM2(outside(detached, boundary))).toBeCloseTo(areaM2(detached), 0);
  });

  it('reports nothing outside for a shape wholly within the boundary', () => {
    const inside: MultiPoly = [[square(-73.195, 44.475, 0.005)]];
    expect(outside(inside, boundary)).toEqual([]);
  });

  it('treats a shape as wholly outside when there is no boundary yet', () => {
    expect(outside(detached, [])).toEqual(detached);
  });

  // The workflow: trace the detached parcel, merge it in, then split the
  // original polygon without the parcel getting swept into a campus.
  it('leaves only the main part unassigned once the parcel is claimed', () => {
    const merged = union(boundary, detached);
    const rest = subtractAll(merged, [detached]);
    expect(rest).toHaveLength(1);
    expect(areaM2(rest)).toBeCloseTo(areaM2(boundary), 0);
  });
});

describe('transfer', () => {
  // Two areas splitting the boundary down the middle, as a real split leaves it.
  const west: MultiPoly = [[[[-73.2, 44.47], [-73.19, 44.47], [-73.19, 44.49], [-73.2, 44.49], [-73.2, 44.47]]]];
  const east: MultiPoly = [[[[-73.19, 44.47], [-73.18, 44.47], [-73.18, 44.49], [-73.19, 44.49], [-73.19, 44.47]]]];

  it('moves a region from its holder to the target, conserving area', () => {
    // A strip straddling the shared edge.
    const strip: MultiPoly = [[[[-73.192, 44.47], [-73.188, 44.47], [-73.188, 44.49], [-73.192, 44.49], [-73.192, 44.47]]]];
    const [newWest, newEast] = transfer([west, east], 0, strip);
    expect(areaM2(newWest!) + areaM2(newEast!)).toBeCloseTo(areaM2(west) + areaM2(east), 0);
    expect(areaM2(newWest!)).toBeGreaterThan(areaM2(west));
    expect(areaM2(newEast!)).toBeLessThan(areaM2(east));
  });

  it('leaves no overlap between the target and the areas it took from', () => {
    const strip: MultiPoly = [[[[-73.192, 44.47], [-73.188, 44.47], [-73.188, 44.49], [-73.192, 44.49], [-73.192, 44.47]]]];
    const [newWest, newEast] = transfer([west, east], 0, strip);
    expect(intersect(newWest!, newEast!)).toEqual([]);
  });

  // The real case that prompted this: a scrap of one area stranded inside
  // another's territory, which leaves the neighbour holding a hole around it.
  it('moves a whole detached part and closes the hole it leaves behind', () => {
    const scrap: MultiPoly = [[[[-73.186, 44.475], [-73.184, 44.475], [-73.184, 44.477], [-73.186, 44.477], [-73.186, 44.475]]]];
    const holder: MultiPoly = [...west, ...scrap];
    const punctured = outside(east, scrap);
    expect(punctured[0]).toHaveLength(2); // outer ring plus the hole

    const [newHolder, newEast] = transfer([holder, punctured], 1, scrap);
    expect(newHolder).toHaveLength(1);
    expect(areaM2(newHolder!)).toBeCloseTo(areaM2(west), 0);
    // The hole is filled again, so east is whole and there is no seam left.
    expect(newEast).toHaveLength(1);
    expect(newEast![0]).toHaveLength(1);
    expect(areaM2(newEast!)).toBeCloseTo(areaM2(east), 0);
  });

  it('is a no-op for an empty region', () => {
    expect(transfer([west, east], 0, [])).toEqual([west, east]);
  });

  it('gives the target land it did not touch, leaving the others alone', () => {
    const detached: MultiPoly = [[[[-73.17, 44.47], [-73.169, 44.47], [-73.169, 44.471], [-73.17, 44.471], [-73.17, 44.47]]]];
    const [newWest, newEast] = transfer([west, east], 0, detached);
    expect(newWest).toHaveLength(2);
    expect(newEast).toEqual(east);
  });
});

describe('intersect', () => {
  it('returns the overlap', () => {
    const a: MultiPoly = [[square(-73.2, 44.47, 0.01)]];
    const b: MultiPoly = [[square(-73.195, 44.475, 0.01)]];
    expect(areaM2(intersect(a, b))).toBeGreaterThan(0);
    expect(areaM2(intersect(a, b))).toBeLessThan(areaM2(a));
  });

  it('returns nothing for shapes that miss each other', () => {
    expect(intersect([[square(-73.2, 44.47, 0.005)]], [[square(-73.18, 44.47, 0.005)]])).toEqual([]);
  });
});
