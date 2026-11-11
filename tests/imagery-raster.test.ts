import { describe, it, expect } from 'vitest';
import {
  boxOfGeometry, chooseZoom, decodeScale, gridBounds, gridFor, intersectBox, latAt, lngAt, metersPerPixel, paint,
  project, ringsInGrid, sourceMpp, worldFile, type Grid, type Source,
} from '../src/imagery/raster';

const campus = { south: 44.47, west: -73.21, north: 44.485, east: -73.18 };

describe('Web Mercator grid', () => {
  it('projects the way Leaflet does, and back', () => {
    // Leaflet: map.project([0, 0], 0) is (128, 128).
    expect(project(0, 0, 0)).toEqual([128, 128]);
    const [x, y] = project(44.4777, -73.1956, 18);
    expect(latAt(y, 18)).toBeCloseTo(44.4777, 9);
    expect(lngAt(x, 18)).toBeCloseTo(-73.1956, 9);
  });

  it('covers a box in whole pixels, and reports the edges of those pixels', () => {
    const g = gridFor(campus, 17);
    const [[s, w], [n, e]] = gridBounds(g);
    expect(s).toBeLessThanOrEqual(campus.south);
    expect(w).toBeLessThanOrEqual(campus.west);
    expect(n).toBeGreaterThanOrEqual(campus.north);
    expect(e).toBeGreaterThanOrEqual(campus.east);
    // And by less than a pixel on each side.
    const px = metersPerPixel(44.48, 17) / 111_320;
    expect(campus.south - s).toBeLessThan(2 * px);
  });

  it('picks a zoom at least as fine as asked, then steps down to fit the pixel limit', () => {
    const fine = chooseZoom(campus, 0.3, 1e9);
    expect(metersPerPixel(44.48, fine.z)).toBeLessThanOrEqual(0.3);
    expect(metersPerPixel(44.48, fine.z)).toBeGreaterThan(0.15);
    expect(fine.capped).toBe(false);
    const small = chooseZoom(campus, 0.3, 2_000_000);
    expect(small.grid.width * small.grid.height).toBeLessThanOrEqual(2_000_000);
    expect(small.z).toBeLessThan(fine.z);
    expect(small.capped).toBe(true);
  });

  it('finds where two boxes overlap, or that they do not', () => {
    expect(intersectBox(campus, { south: 44.48, west: -73.19, north: 44.5, east: -73.1 }))
      .toEqual({ south: 44.48, west: -73.19, north: 44.485, east: -73.18 });
    expect(intersectBox(campus, { south: 45, west: -73.19, north: 45.1, east: -73.1 })).toBeNull();
  });

  it('writes a world file GDAL can read: pixel size, then the centre of the top-left pixel', () => {
    const g: Grid = { z: 1, x0: 0, y0: 0, width: 512, height: 512 };
    const [a, d, b, e, c, f] = worldFile(g).trim().split('\n').map(Number);
    const half = Math.PI * 6378137;
    expect(a).toBeCloseTo((2 * half) / 512, 6);
    expect(e).toBeCloseTo(-(2 * half) / 512, 6);
    expect(b).toBe(0);
    expect(d).toBe(0);
    expect(c).toBeCloseTo(-half + a! / 2, 4);
    expect(f).toBeCloseTo(half - a! / 2, 4);
  });
});

describe('sizes', () => {
  it('measures an image’s ground pixel size from its corners', () => {
    // 1,000 px across 100 m east–west and 50 m north–south: 0.1 m per pixel.
    const kx = 111_320 * Math.cos((44.48 * Math.PI) / 180);
    const n = 44.48;
    const s = n - 50 / 111_320;
    const w = -73.2;
    const e = w + 100 / kx;
    expect(sourceMpp([[n, w], [n, e], [s, e], [s, w]], 1000, 500)).toBeCloseTo(0.1, 3);
  });

  it('decodes no larger than the output needs, never larger than the image', () => {
    expect(decodeScale(0.1, 1)).toBeCloseTo(0.15);
    expect(decodeScale(0.1, 0.1)).toBe(1);
    expect(decodeScale(0.5, 0.1)).toBe(1);
  });
});

describe('paint', () => {
  // A 2×2 image filling a known patch of ground, as a straight stretch.
  const grid: Grid = gridFor({ south: 44.4799, west: -73.2001, north: 44.4801, east: -73.1999 }, 20);
  const [[gs, gw], [gn, ge]] = gridBounds(grid);
  const image = (rgb: [number, number, number], cover: { s: number; w: number; n: number; e: number }): Source => {
    const data = new Uint8ClampedArray(2 * 2 * 4);
    for (let i = 0; i < 4; i++) data.set([...rgb, 255], i * 4);
    return {
      width: 2, height: 2, data, dataWidth: 2, dataHeight: 2,
      toImage: (lat, lng) => [((lng - cover.w) / (cover.e - cover.w)) * 2, ((cover.n - lat) / (cover.n - cover.s)) * 2],
      corners: [[cover.n, cover.w], [cover.n, cover.e], [cover.s, cover.e], [cover.s, cover.w]],
    };
  };
  const at = (out: Uint8ClampedArray, c: number, r: number) => [...out.slice((r * grid.width + c) * 4, (r * grid.width + c) * 4 + 4)];

  it('fills what the image covers and leaves the rest transparent', () => {
    const out = new Uint8ClampedArray(grid.width * grid.height * 4);
    const westHalf = { s: gs, w: gw, n: gn, e: (gw + ge) / 2 };
    const n = paint(grid, out, image([200, 10, 10], westHalf));
    expect(n).toBeGreaterThan(0);
    expect(at(out, 1, 1)).toEqual([200, 10, 10, 255]);
    expect(at(out, grid.width - 2, 1)[3]).toBe(0);
  });

  it('lets the image painted last win where two overlap', () => {
    const out = new Uint8ClampedArray(grid.width * grid.height * 4);
    const all = { s: gs, w: gw, n: gn, e: ge };
    paint(grid, out, image([0, 0, 255], all));
    paint(grid, out, image([0, 255, 0], all));
    expect(at(out, Math.floor(grid.width / 2), Math.floor(grid.height / 2))).toEqual([0, 255, 0, 255]);
  });

  it('paints only the rows asked for, so the work can be sliced', () => {
    const out = new Uint8ClampedArray(grid.width * grid.height * 4);
    paint(grid, out, image([9, 9, 9], { s: gs, w: gw, n: gn, e: ge }), 0, 2);
    expect(at(out, 1, 1)[3]).toBe(255);
    expect(at(out, 1, 3)[3]).toBe(0);
  });
});

describe('clip shapes', () => {
  const poly = { type: 'Polygon' as const, coordinates: [[[-73.2, 44.47], [-73.19, 44.47], [-73.19, 44.48], [-73.2, 44.48], [-73.2, 44.47]]] };
  it('boxes a polygon from its outer ring', () => {
    expect(boxOfGeometry(poly)).toEqual({ south: 44.47, west: -73.2, north: 44.48, east: -73.19 });
  });
  it('puts a polygon’s rings in the grid’s pixels, holes included', () => {
    const g = gridFor(boxOfGeometry(poly), 16);
    const withHole = { type: 'MultiPolygon' as const, coordinates: [[poly.coordinates[0]!, [[-73.196, 44.474], [-73.194, 44.474], [-73.194, 44.476], [-73.196, 44.474]]]] };
    const rings = ringsInGrid(withHole, g);
    expect(rings).toHaveLength(2);
    const [x, y] = rings[0]![0]!;
    expect(x).toBeGreaterThanOrEqual(-1);
    expect(y).toBeLessThanOrEqual(g.height + 1);
  });
});

describe('tiles', () => {
  it('covers a box with whole tiles, the way the satellite layer numbers them', async () => {
    const { tilesCovering } = await import('../src/imagery/raster');
    const t = tilesCovering(campus, 20);
    // The campus box at zoom 20 is tens of thousands of pixels: about a hundred-plus tiles a side.
    expect(t.x1 - t.x0).toBeGreaterThan(80);
    const [x, y] = project(campus.north, campus.west, 20);
    expect(t.x0).toBe(Math.floor(x / 256));
    expect(t.y0).toBe(Math.floor(y / 256));
  });

  it('cuts the tiles into blocks that cover each exactly once', async () => {
    const { blocksOf } = await import('../src/imagery/raster');
    const t = { x0: 10, x1: 45, y0: 3, y1: 20 };
    const blocks = blocksOf(t, 20, 16);
    const area = blocks.reduce((s, b) => s + (b.width / 256) * (b.height / 256), 0);
    expect(area).toBe(35 * 17);
    expect(blocks[0]).toEqual({ z: 20, x0: 2560, y0: 768, width: 4096, height: 4096 });
    expect(blocks.at(-1)).toEqual({ z: 20, x0: 42 * 256, y0: 19 * 256, width: 3 * 256, height: 256 });
  });

  it('tells an empty tile from one with a single pixel in it', async () => {
    const { tileHasPixels } = await import('../src/imagery/raster');
    const w = 512;
    const rgba = new Uint8ClampedArray(w * 256 * 4);
    expect(tileHasPixels(rgba, w, 0, 0)).toBe(false);
    rgba[(200 * w + 300) * 4 + 3] = 1; // one pixel in the second tile
    expect(tileHasPixels(rgba, w, 0, 0)).toBe(false);
    expect(tileHasPixels(rgba, w, 1, 0)).toBe(true);
  });

  it('finds each parent tile once', async () => {
    const { parentsOf } = await import('../src/imagery/raster');
    expect(parentsOf([[4, 6], [5, 6], [4, 7], [5, 7], [6, 6]])).toEqual([[2, 3], [3, 3]]);
  });
});
