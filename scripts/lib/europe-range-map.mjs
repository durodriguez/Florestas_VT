/**
 * A species' native range on a map of Europe and Asia, for its species page:
 * the European species Little's atlas does not map, from Caudullo, Welk and
 * San-Miguel-Ayanz's chorological maps (CC BY 4.0), fetched once into
 * data/ranges/europe/ by scripts/fetch-ranges-europe.mjs.
 *
 * Drawn as the US maps are (range-map.mjs), three layers stacked in the page,
 * in the same size, colors and order: the sea and the land; the range, with
 * its small isolated stands as dots; the lakes and the borders. But each
 * species has its own frame, fitted to its range (Serbian spruce's few
 * valleys in the Drina; Scotch pine from Spain to the Sea of Okhotsk), so its
 * two outer layers are its own files rather than shared by every page. There
 * is no star on Burlington, which none of these maps would reach.
 *
 * Each frame is a Lambert azimuthal equal-area projection centred on the
 * range, the projection the EU's own grid uses for Europe. No DOM here.
 */

import polygonClipping from 'polygon-clipping';
import { SIZE as US_SIZE } from './range-map.mjs';

/** The same size as the US maps, so the page lays out the same. */
export const SIZE = { width: US_SIZE.width, height: US_SIZE.height };
/** Space around the range, as a share of the frame on each side. */
const PAD = 0.1;
/**
 * The narrowest a frame gets, in the projection's units (the earth's
 * radius): about 2,500 km across, so a small range is shown in its part of
 * Europe rather than as a blob filling the frame.
 */
const MIN_WIDTH = 0.4;
/** Dots for isolated stands, in pixels. */
const DOT = 2.2;

const rad = Math.PI / 180;

/** The frame for a range: its projection, and [lng, lat] → [x, y] on the map. */
export function frameFor(range) {
  const coords = [...range.range.flatMap((poly) => poly[0]), ...(range.points ?? [])];
  if (!coords.length) return null;
  // Centred on the middle of the range's extent.
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  const lam0 = ((Math.min(...lngs) + Math.max(...lngs)) / 2) * rad;
  const phi0 = ((Math.min(...lats) + Math.max(...lats)) / 2) * rad;
  const [sp0, cp0] = [Math.sin(phi0), Math.cos(phi0)];

  const laea = (lng, lat) => {
    const l = lng * rad - lam0;
    const p = lat * rad;
    const k = Math.sqrt(2 / Math.max(1e-9, 1 + sp0 * Math.sin(p) + cp0 * Math.cos(p) * Math.cos(l)));
    return [k * Math.cos(p) * Math.sin(l), k * (cp0 * Math.sin(p) - sp0 * Math.cos(p) * Math.cos(l))];
  };
  const inverse = (x, y) => {
    const r = Math.hypot(x, y);
    if (r < 1e-12) return [lam0 / rad, phi0 / rad];
    const c = 2 * Math.asin(Math.min(1, r / 2));
    const lat = Math.asin(Math.cos(c) * sp0 + (y * Math.sin(c) * cp0) / r);
    const lng = lam0 + Math.atan2(x * Math.sin(c), r * cp0 * Math.cos(c) - y * sp0 * Math.sin(c));
    return [lng / rad, lat / rad];
  };

  // The range's box in the projection, padded, widened to the narrowest
  // frame, then to the map's shape.
  const pts = coords.map(([lng, lat]) => laea(lng, lat));
  let [x0, x1] = [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))];
  let [y0, y1] = [Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))];
  let w = Math.max((x1 - x0) / (1 - 2 * PAD), MIN_WIDTH);
  let h = (y1 - y0) / (1 - 2 * PAD);
  const shape = SIZE.height / SIZE.width;
  if (h / w > shape) w = h / shape; else h = w * shape;
  const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
  [x0, x1, y0, y1] = [cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2];
  const scale = SIZE.width / w;

  const project = (lng, lat) => {
    const [x, y] = laea(lng, lat);
    return [(x - x0) * scale, (y1 - y) * scale];
  };

  // What the frame covers on the globe, read off its edges, for cutting the
  // outlines to it before they are projected: land on the far side of the
  // globe would fold over the map.
  const edge = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    edge.push(inverse(x0 + t * w, y0), inverse(x0 + t * w, y1), inverse(x0, y0 + t * h), inverse(x1, y0 + t * h));
  }
  const poleInside = (() => { const [px, py] = laea(0, 90); return px > x0 && px < x1 && py > y0 && py < y1; })();
  const crossesDateLine = Math.max(...edge.map((e) => e[0])) > 180 || Math.min(...edge.map((e) => e[0])) < -180;
  const MARGIN = 8;
  const covers = {
    west: poleInside || crossesDateLine ? -180 : Math.max(-180, Math.min(...edge.map((e) => e[0])) - MARGIN),
    east: poleInside || crossesDateLine ? 180 : Math.min(180, Math.max(...edge.map((e) => e[0])) + MARGIN),
    south: Math.max(-89, Math.min(...edge.map((e) => e[1])) - MARGIN),
    north: poleInside ? 90 : Math.min(90, Math.max(...edge.map((e) => e[1])) + MARGIN),
  };
  return { project, covers, center: [lam0 / rad, phi0 / rad] };
}

/** Douglas–Peucker on a run of [x, y] pixels. */
function simplify(pts, tol) {
  if (pts.length < 5) return pts;
  const keep = new Uint8Array(pts.length);
  const last = pts.length - 1;
  keep[0] = keep[last] = 1;
  let far = 1;
  for (let i = 1; i < last; i++) if (Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]) > Math.hypot(pts[far][0] - pts[0][0], pts[far][1] - pts[0][1])) far = i;
  keep[far] = 1;
  const stack = [[0, far], [far, last]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const len = Math.hypot(bx - ax, by - ay) || 1e-12;
    let worst = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((by - ay) * pts[i][0] - (bx - ax) * pts[i][1] + bx * ay - by * ax) / len;
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > tol) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/**
 * Polygons of [lng, lat] → polygons of [x, y] on the map: cut to what the
 * frame covers, projected, then cut to the map with a few pixels to spare, so
 * a border cut at the edge is drawn outside it.
 */
function toPixels(polygons, frame) {
  const { west, east, south, north } = frame.covers;
  const globe = [[[west, south], [east, south], [east, north], [west, north], [west, south]]];
  const S = 6;
  const box = [[[-S, -S], [SIZE.width + S, -S], [SIZE.width + S, SIZE.height + S], [-S, SIZE.height + S], [-S, -S]]];
  const out = [];
  for (const poly of polygons) {
    const ring = poly[0];
    let [w, e, s, n] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const [x, y] of ring) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
    if (e < west || w > east || n < south || s > north) continue;
    let cut;
    try { cut = polygonClipping.intersection([poly], globe); } catch { continue; }
    const projected = cut.map((p) => p.map((r) => {
      // Edges cut along a meridian or a parallel are straight in degrees but
      // curve on the map: fill them in a degree at a time before projecting.
      const dense = [];
      for (let i = 0; i < r.length; i++) {
        const [ax, ay] = r[i];
        const [bx, by] = r[(i + 1) % r.length];
        dense.push([ax, ay]);
        const steps = Math.min(200, Math.floor(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
        for (let k = 1; k < steps; k++) dense.push([ax + ((bx - ax) * k) / steps, ay + ((by - ay) * k) / steps]);
      }
      return dense.map(([lng, lat]) => frame.project(lng, lat));
    }));
    try { out.push(...polygonClipping.intersection(projected, box)); } catch { /* a sliver the clipper cannot take */ }
  }
  return out;
}

/** Shoelace area of a ring of pixels. */
const pxArea = (ring) => Math.abs(ring.reduce((sum, [x, y], i) => {
  const [nx, ny] = ring[(i + 1) % ring.length];
  return sum + x * ny - nx * y;
}, 0)) / 2;

/**
 * Pixel polygons as one SVG path, simplified to half a pixel, without the
 * specks smaller than a pixel (islands, mostly) that add bytes and nothing
 * one can see. `specks`, when given, collects the middle of each, so a range
 * can draw them as dots instead of losing them.
 */
function pathOf(polygons, specks = null) {
  let d = '';
  for (const poly of polygons) {
    poly.forEach((ring, i) => {
      const pts = simplify(ring, 0.5);
      if (pts.length < 4 || pxArea(pts) < 1) {
        if (i === 0 && specks) specks.push([ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length]);
        return;
      }
      d += `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`;
    });
  }
  return d;
}

const allLand = (basemap) => basemap.countries.flatMap((c) => c.polygons);

/** The bottom layer, its own colors as range-map.mjs's: the sea and the land. */
export function europeBaseSvg(frame, basemap) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE.width} ${SIZE.height}">
<style>.sea{fill:#eaf1f5}.land{fill:#f5f3ea}
@media (prefers-color-scheme:dark){.sea{fill:#17232b}.land{fill:#2a2f2b}}</style>
<rect class="sea" width="${SIZE.width}" height="${SIZE.height}"/>
<path class="land" d="${pathOf(toPixels(allLand(basemap), frame))}"/>
</svg>`;
}

/** The top layer: the large lakes and the borders. */
export function europeLinesSvg(frame, basemap) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE.width} ${SIZE.height}">
<style>.lk{fill:#eaf1f5;stroke:#b9c7cf;stroke-width:.4}.ln{fill:none;stroke:#a9a594;stroke-width:.5}
@media (prefers-color-scheme:dark){.lk{fill:#17232b;stroke:#2d3a42}.ln{stroke:#565b55}}</style>
<path class="lk" d="${pathOf(toPixels(basemap.lakes, frame))}"/>
<path class="ln" d="${pathOf(toPixels(allLand(basemap), frame))}"/>
</svg>`;
}

/** The species' own layer, inline in its page: its range, and a dot for each isolated stand. */
export function europeRangeSvg(range, frame) {
  // An area too small to draw at this frame's scale (Serbian spruce's is a
  // few valleys) is drawn as a dot, as an isolated stand is.
  const specks = [];
  const d = pathOf(toPixels(range.range, frame), specks);
  const seen = new Set();
  const dots = [...specks, ...(range.points ?? []).map(([lng, lat]) => frame.project(lng, lat))]
    .filter(([x, y]) => x >= 0 && x <= SIZE.width && y >= 0 && y <= SIZE.height)
    .filter(([x, y]) => { const k = `${Math.round(x)},${Math.round(y)}`; return !seen.has(k) && seen.add(k); })
    .map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${DOT}"/>`).join('');
  return `<svg class="range-fill" viewBox="0 0 ${SIZE.width} ${SIZE.height}" aria-hidden="true"><path d="${d}" fill-rule="evenodd"/>${dots}</svg>`;
}
