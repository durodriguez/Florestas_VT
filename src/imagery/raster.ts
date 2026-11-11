/**
 * Turning aligned images into one new image: the arithmetic, with no browser
 * in it, so it can be tested.
 *
 * Every image this app makes is laid on the Web Mercator pixel grid at some
 * zoom, the grid Leaflet and every web map draw in. A pixel of the output is
 * a pixel of that grid, so the result sits on the map with a plain image
 * overlay, exactly, and could later be cut into tiles without resampling.
 * In Web Mercator longitude depends only on the column and latitude only on
 * the row, so each is worked out once per column or row, not per pixel.
 */

import type { Bounds } from '../positions/imagery-math';

/** Leaflet's tile size: zoom z is 256·2^z pixels around the world. */
const TILE = 256;
const R = 6378137;
const MAX_LAT = 85.0511287798;

const worldPx = (z: number): number => TILE * 2 ** z;

/** [lat, lng] to Web Mercator pixels at zoom z, as Leaflet counts them. */
export function project(lat: number, lng: number, z: number): [number, number] {
  const s = worldPx(z);
  const phi = (Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180;
  const x = ((lng + 180) / 360) * s;
  const y = (0.5 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / (2 * Math.PI)) * s;
  return [x, y];
}

export const lngAt = (x: number, z: number): number => (x / worldPx(z)) * 360 - 180;

export function latAt(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / worldPx(z);
  return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
}

/** Ground metres per pixel at a latitude and zoom. */
export const metersPerPixel = (lat: number, z: number): number =>
  (2 * Math.PI * R * Math.cos((lat * Math.PI) / 180)) / worldPx(z);

/** A block of the grid: whole pixels at zoom z, from (x0, y0). */
export interface Grid {
  z: number;
  x0: number;
  y0: number;
  width: number;
  height: number;
}

export interface Box {
  south: number;
  west: number;
  north: number;
  east: number;
}

export const boxOfPoints = (pts: Array<[number, number]>): Box => ({
  south: Math.min(...pts.map((p) => p[0])),
  north: Math.max(...pts.map((p) => p[0])),
  west: Math.min(...pts.map((p) => p[1])),
  east: Math.max(...pts.map((p) => p[1])),
});

export const unionBox = (a: Box, b: Box): Box => ({
  south: Math.min(a.south, b.south), west: Math.min(a.west, b.west),
  north: Math.max(a.north, b.north), east: Math.max(a.east, b.east),
});

/** Where two boxes overlap, or null if they do not. */
export function intersectBox(a: Box, b: Box): Box | null {
  const out = {
    south: Math.max(a.south, b.south), west: Math.max(a.west, b.west),
    north: Math.min(a.north, b.north), east: Math.min(a.east, b.east),
  };
  return out.north > out.south && out.east > out.west ? out : null;
}

/** The whole-pixel grid at zoom z that covers a box. */
export function gridFor(box: Box, z: number): Grid {
  const [xa, ya] = project(box.north, box.west, z);
  const [xb, yb] = project(box.south, box.east, z);
  const x0 = Math.floor(xa);
  const y0 = Math.floor(ya);
  return { z, x0, y0, width: Math.max(1, Math.ceil(xb) - x0), height: Math.max(1, Math.ceil(yb) - y0) };
}

/** The grid's edges, in Leaflet's [[south, west], [north, east]]. */
export function gridBounds(g: Grid): Bounds {
  return [
    [latAt(g.y0 + g.height, g.z), lngAt(g.x0, g.z)],
    [latAt(g.y0, g.z), lngAt(g.x0 + g.width, g.z)],
  ];
}

/**
 * The zoom whose pixels are no coarser than `mpp` metres, then stepped down
 * until the image has no more than `maxPixels` — a browser cannot hold a
 * canvas much past a few hundred million bytes. `capped` says it had to.
 */
export function chooseZoom(box: Box, mpp: number, maxPixels: number): { z: number; grid: Grid; capped: boolean } {
  const lat = (box.north + box.south) / 2;
  let z = Math.min(23, Math.max(0, Math.ceil(Math.log2(metersPerPixel(lat, 0) / mpp))));
  let grid = gridFor(box, z);
  let capped = false;
  while (grid.width * grid.height > maxPixels && z > 0) {
    z -= 1;
    grid = gridFor(box, z);
    capped = true;
  }
  return { z, grid, capped };
}

/** Metres across one pixel of an image, from its four corners. */
export function sourceMpp(corners: Array<[number, number]>, width: number, height: number): number {
  const m = (a: [number, number], b: [number, number]) => {
    const kx = 111_320 * Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180);
    return Math.hypot((b[1] - a[1]) * kx, (b[0] - a[0]) * 111_320);
  };
  const [tl, tr, br, bl] = corners as [[number, number], [number, number], [number, number], [number, number]];
  return ((m(tl, tr) + m(bl, br)) / 2 / width + (m(tl, bl) + m(tr, br)) / 2 / height) / 2;
}

/** The rows and columns of the grid an image's four corners can reach. */
export function footprintInGrid(grid: Grid, corners: Array<[number, number]>): { x0: number; x1: number; y0: number; y1: number } {
  const fp = corners.map(([lat, lng]) => project(lat, lng, grid.z));
  return {
    x0: Math.max(0, Math.floor(Math.min(...fp.map((p) => p[0])) - grid.x0)),
    x1: Math.min(grid.width, Math.ceil(Math.max(...fp.map((p) => p[0])) - grid.x0)),
    y0: Math.max(0, Math.floor(Math.min(...fp.map((p) => p[1])) - grid.y0)),
    y1: Math.min(grid.height, Math.ceil(Math.max(...fp.map((p) => p[1])) - grid.y0)),
  };
}

/**
 * A world file (.wld), which GIS programs such as QGIS read to place an image:
 * the pixel size and the centre of the top-left pixel, in Web Mercator metres
 * (EPSG:3857), which the image is drawn in.
 */
export function worldFile(g: Grid): string {
  const half = Math.PI * R;
  const res = (2 * half) / worldPx(g.z);
  const x = g.x0 * res - half + res / 2;
  const y = half - g.y0 * res - res / 2;
  return [res, 0, 0, -res, x, y].map((v) => v.toFixed(10)).join('\n') + '\n';
}

/** One aligned image, decoded, ready to be sampled. */
export interface Source {
  /** The image's own pixel size, which `toImage` answers in. */
  width: number;
  height: number;
  /** RGBA, possibly decoded smaller than the image: `dataWidth` × `dataHeight`. */
  data: Uint8ClampedArray;
  dataWidth: number;
  dataHeight: number;
  /** [lat, lng] to a pixel of the full-size image. */
  toImage: (lat: number, lng: number) => [number, number];
  corners: Array<[number, number]>;
}

/**
 * Paints one image into the output, over whatever is there. Called worst
 * first and best last, so wherever images overlap the best is what is left —
 * and only one decoded image is ever held at a time.
 *
 * Bilinear: each output pixel is the four nearest image pixels, weighted.
 * Pixels the image does not reach are left alone.
 */
export function paint(grid: Grid, out: Uint8ClampedArray, src: Source, rowFrom = 0, rowTo = grid.height): number {
  const { x0: fx0, x1: fx1, y0: fy0, y1: fy1 } = footprintInGrid(grid, src.corners);
  const cx0 = fx0;
  const cx1 = fx1;
  const cy0 = Math.max(fy0, rowFrom);
  const cy1 = Math.min(fy1, rowTo);
  if (cx1 <= cx0 || cy1 <= cy0) return 0;

  const lngs = new Float64Array(cx1 - cx0);
  for (let c = cx0; c < cx1; c++) lngs[c - cx0] = lngAt(grid.x0 + c + 0.5, grid.z);
  const kx = src.dataWidth / src.width;
  const ky = src.dataHeight / src.height;
  const dw = src.dataWidth;
  const dh = src.dataHeight;
  const d = src.data;
  let painted = 0;

  for (let r = cy0; r < cy1; r++) {
    const lat = latAt(grid.y0 + r + 0.5, grid.z);
    const rowAt = r * grid.width;
    for (let c = cx0; c < cx1; c++) {
      const [px, py] = src.toImage(lat, lngs[c - cx0]!);
      // Pixel centres: image pixel i covers i..i+1, its centre at i + 0.5.
      const fx = px * kx - 0.5;
      const fy = py * ky - 0.5;
      if (!(fx >= -0.5 && fy >= -0.5 && fx <= dw - 0.5 && fy <= dh - 0.5)) continue;
      const x0 = Math.max(0, Math.min(dw - 1, Math.floor(fx)));
      const y0 = Math.max(0, Math.min(dh - 1, Math.floor(fy)));
      const x1 = Math.min(dw - 1, x0 + 1);
      const y1 = Math.min(dh - 1, y0 + 1);
      const ax = Math.max(0, Math.min(1, fx - x0));
      const ay = Math.max(0, Math.min(1, fy - y0));
      const i00 = (y0 * dw + x0) * 4;
      const i10 = (y0 * dw + x1) * 4;
      const i01 = (y1 * dw + x0) * 4;
      const i11 = (y1 * dw + x1) * 4;
      const o = (rowAt + c) * 4;
      for (let k = 0; k < 3; k++) {
        const top = d[i00 + k]! + (d[i10 + k]! - d[i00 + k]!) * ax;
        const bottom = d[i01 + k]! + (d[i11 + k]! - d[i01 + k]!) * ax;
        out[o + k] = top + (bottom - top) * ay;
      }
      out[o + 3] = 255;
      painted += 1;
    }
  }
  return painted;
}

/**
 * How much smaller an image can be decoded without losing anything the
 * output keeps: an 8,000-pixel print going into a half-metre mosaic needs a
 * fraction of its pixels. Never enlarged; 1 means full size.
 */
export function decodeScale(srcMpp: number, outMpp: number): number {
  if (!(srcMpp > 0) || !(outMpp > 0)) return 1;
  // A margin, so bilinear sampling still has a pixel or so to blend.
  return Math.min(1, (srcMpp / outMpp) * 1.5);
}

/**
 * A campus polygon in the grid's pixels, ready to fill: outer rings and holes
 * alike, for an even-odd fill. Polygon or MultiPolygon, as GeoJSON has them.
 */
export function ringsInGrid(
  geometry: { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] },
  grid: Grid,
): Array<Array<[number, number]>> {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polys.flatMap((poly) =>
    poly.map((ring) => ring.map(([lng, lat]) => {
      const [x, y] = project(lat!, lng!, grid.z);
      return [x - grid.x0, y - grid.y0] as [number, number];
    })),
  );
}

/** A polygon's box, for cropping the output to it. */
export function boxOfGeometry(
  geometry: { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] },
): Box {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return boxOfPoints(polys.flatMap((poly) => poly[0]!.map(([lng, lat]) => [lat!, lng!] as [number, number])));
}

// ---------------------------------------------------------------- tiles

/** Leaflet's tile edge, in pixels. */
export const TILE_PX = TILE;

/** The tiles at zoom z that cover a box: x from x0 up to (not including) x1, likewise y. */
export function tilesCovering(box: Box, z: number): { x0: number; x1: number; y0: number; y1: number } {
  const g = gridFor(box, z);
  return {
    x0: Math.floor(g.x0 / TILE), x1: Math.ceil((g.x0 + g.width) / TILE),
    y0: Math.floor(g.y0 / TILE), y1: Math.ceil((g.y0 + g.height) / TILE),
  };
}

/**
 * The tiles cut into square blocks of `size` tiles a side, worked one at a
 * time: a whole campus at full detail is hundreds of megapixels, far beyond
 * one browser canvas, but a block of 16 × 16 tiles is 4,096 pixels square.
 */
export function blocksOf(t: { x0: number; x1: number; y0: number; y1: number }, z: number, size: number): Grid[] {
  const out: Grid[] = [];
  for (let ty = t.y0; ty < t.y1; ty += size) {
    for (let tx = t.x0; tx < t.x1; tx += size) {
      const w = Math.min(size, t.x1 - tx);
      const h = Math.min(size, t.y1 - ty);
      out.push({ z, x0: tx * TILE, y0: ty * TILE, width: w * TILE, height: h * TILE });
    }
  }
  return out;
}

/** Whether a tile's square in a block has any pixel that is not transparent. */
export function tileHasPixels(rgba: Uint8ClampedArray, blockWidth: number, col: number, row: number): boolean {
  const x0 = col * TILE;
  const y0 = row * TILE;
  for (let y = y0; y < y0 + TILE; y++) {
    const start = (y * blockWidth + x0) * 4 + 3;
    for (let i = start; i < start + TILE * 4; i += 4) if (rgba[i] !== 0) return true;
  }
  return false;
}

/** The tiles one zoom out that the given tiles fall in, each once. */
export function parentsOf(tiles: Iterable<[number, number]>): Array<[number, number]> {
  const seen = new Map<string, [number, number]>();
  for (const [x, y] of tiles) {
    const p: [number, number] = [Math.floor(x / 2), Math.floor(y / 2)];
    seen.set(`${p[0]}/${p[1]}`, p);
  }
  return [...seen.values()];
}
