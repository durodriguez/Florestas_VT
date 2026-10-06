/**
 * Placing a Google Earth print on the map.
 *
 * A `.geprint` records the camera, not the picture: where it looked, from how
 * far, and at what tilt and heading. Where the corners land depends on Earth's
 * field of view, which the file does not record, so the footprint worked out
 * from it is a first guess — good to tens of metres, not to one. The surveyor
 * then pins it down by matching points: a feature clicked on the image, the
 * same feature clicked on the map's imagery, two or more times. Those pairs
 * fix the image exactly, and say how well they agree.
 *
 * Axis-aligned throughout: heading in these prints is a hundredth of a degree,
 * and Leaflet's image overlay cannot rotate. The 2–3° tilt Earth leaves on is
 * a small perspective lean that no straight stretch removes; the residual the
 * fit reports is where it shows.
 */

export interface Camera {
  lat: number;
  lng: number;
  /** Metres from the camera to the point it looks at. */
  range: number;
  tilt: number;
  heading: number;
}

/** [[south, west], [north, east]], Leaflet's order. */
export type Bounds = [[number, number], [number, number]];

/** A feature as a pixel on the image and as a position on the ground. */
export interface Pair {
  px: number;
  py: number;
  lat: number;
  lng: number;
}

const M_PER_DEG_LAT = 111_320;
const mPerDegLng = (lat: number): number => M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

/**
 * Google Earth's horizontal field of view is not stored in the print. 60° is
 * Earth's default; aligning one image measures the real figure, and
 * `calibrate` carries it to the rest.
 */
export const DEFAULT_HFOV = 60;

/** The camera, read out of a .geprint's embedded KML. Null if it has none. */
export function parseGeprint(text: string): Camera | null {
  const num = (tag: string): number | null => {
    const m = text.match(new RegExp(`<${tag}>\\s*(-?[\\d.]+(?:e-?\\d+)?)\\s*</${tag}>`));
    return m ? Number(m[1]) : null;
  };
  const lat = num('latitude');
  const lng = num('longitude');
  const range = num('range');
  if (lat === null || lng === null || range === null) return null;
  return { lat, lng, range, tilt: num('tilt') ?? 0, heading: num('heading') ?? 0 };
}

/**
 * Where the print probably lies, from the camera alone. `scale` and the
 * offsets come from images already aligned (see `calibrate`): Earth's real
 * field of view, and any shift common to every print.
 */
export function estimateBounds(
  cam: Camera,
  width: number,
  height: number,
  { scale = 1, dLat = 0, dLng = 0 }: { scale?: number; dLat?: number; dLng?: number } = {},
): Bounds {
  const wM = 2 * cam.range * Math.tan(((DEFAULT_HFOV / 2) * Math.PI) / 180) * scale;
  const hM = (wM * height) / width;
  const lat = cam.lat + dLat;
  const lng = cam.lng + dLng;
  const halfLat = hM / 2 / M_PER_DEG_LAT;
  const halfLng = wM / 2 / mPerDegLng(cam.lat);
  return [[lat - halfLat, lng - halfLng], [lat + halfLat, lng + halfLng]];
}

/** Which pixel of the image is under a map position, given where it lies now. */
export function pixelAt(bounds: Bounds, width: number, height: number, lat: number, lng: number): [number, number] {
  const [[s, w], [n, e]] = bounds;
  return [((lng - w) / (e - w)) * width, ((n - lat) / (n - s)) * height];
}

function line(xs: number[], ys: number[]): { a: number; b: number } | null {
  const k = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / k;
  const my = ys.reduce((s, v) => s + v, 0) / k;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < k; i++) {
    sxx += (xs[i]! - mx) ** 2;
    sxy += (xs[i]! - mx) * (ys[i]! - my);
  }
  if (sxx === 0) return null;
  const b = sxy / sxx;
  return { a: my - b * mx, b };
}

/**
 * The bounds that best match the pairs, and how far each pair is off.
 *
 * Least squares, separately east–west and north–south: lng = a + b·px and
 * lat = c + d·py. Two pairs fix it, provided they differ both across and down
 * the image; more average out an imprecise click and show it as residual.
 */
export function fitBounds(
  pairs: Pair[],
  width: number,
  height: number,
): { bounds: Bounds; residuals: number[]; rms: number } | null {
  if (pairs.length < 2) return null;
  const x = line(pairs.map((p) => p.px), pairs.map((p) => p.lng));
  const y = line(pairs.map((p) => p.py), pairs.map((p) => p.lat));
  // Two clicks on one row (or column) of pixels fix nothing across it.
  const minSpread = 0.15;
  const spread = (vs: number[], size: number) => (Math.max(...vs) - Math.min(...vs)) / size;
  if (!x || !y || spread(pairs.map((p) => p.px), width) < minSpread || spread(pairs.map((p) => p.py), height) < minSpread) {
    return null;
  }
  const west = x.a;
  const east = x.a + x.b * width;
  const north = y.a;
  const south = y.a + y.b * height;
  if (!(east > west) || !(north > south)) return null;
  const residuals = pairs.map((p) => {
    const dLng = (x.a + x.b * p.px - p.lng) * mPerDegLng(p.lat);
    const dLat = (y.a + y.b * p.py - p.lat) * M_PER_DEG_LAT;
    return Math.hypot(dLng, dLat);
  });
  const rms = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length);
  return { bounds: [[south, west], [north, east]], residuals, rms };
}

/**
 * What aligned images say about the rest: Earth's real field of view, as a
 * scale on the default, and the shift between where the camera said the
 * centre was and where it turned out to be. Averaged; identity with none.
 */
export function calibrate(
  aligned: Array<{ cam: Camera; width: number; height: number; bounds: Bounds }>,
): { scale: number; dLat: number; dLng: number } {
  if (aligned.length === 0) return { scale: 1, dLat: 0, dLng: 0 };
  let scale = 0;
  let dLat = 0;
  let dLng = 0;
  for (const a of aligned) {
    const guess = estimateBounds(a.cam, a.width, a.height);
    const [[s, w], [n, e]] = a.bounds;
    const [[gs, gw], [gn, ge]] = guess;
    scale += (e - w) / (ge - gw);
    dLat += (s + n) / 2 - (gs + gn) / 2;
    dLng += (w + e) / 2 - (gw + ge) / 2;
  }
  const k = aligned.length;
  return { scale: scale / k, dLat: dLat / k, dLng: dLng / k };
}

// ---------------------------------------------------------------- tilt

/**
 * A 3×3 projective transform, row-major, as nine numbers:
 *   x' = (h0·x + h1·y + h2) / (h6·x + h7·y + h8)
 *   y' = (h3·x + h4·y + h5) / (h6·x + h7·y + h8)
 *
 * It is the exact model of a flat scene seen by a tilted camera, which is what
 * a Google Earth print is: a straight stretch fits one part of a tilted print
 * and not the rest, and this fits the whole. It cannot remove what is not
 * tilt — hills, and the two imagery providers' own warps — and the residual
 * says how much of that there is.
 */
export type H = [number, number, number, number, number, number, number, number, number];

export function applyH(h: H, x: number, y: number): [number, number] {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}

export function invertH(h: H): H {
  const [a, b, c, d, e, f, g, i, j] = h;
  const A = e * j - f * i;
  const B = -(d * j - f * g);
  const C = d * i - e * g;
  const det = a * A + b * B + c * C;
  return [
    A / det, -(b * j - c * i) / det, (b * f - c * e) / det,
    B / det, (a * j - c * g) / det, -(a * f - c * d) / det,
    C / det, -(a * i - b * g) / det, (a * e - b * d) / det,
  ];
}

/** Solve A·x = b by Gaussian elimination with partial pivoting; null if singular. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r]![col]!) > Math.abs(M[piv]![col]!)) piv = r;
    if (Math.abs(M[piv]![col]!) < 1e-12) return null;
    [M[col], M[piv]] = [M[piv]!, M[col]!];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const k = M[r]![col]! / M[col]![col]!;
      for (let c = col; c <= n; c++) M[r]![c]! -= k * M[col]![c]!;
    }
  }
  return M.map((row, i) => row[n]! / row[i]!);
}

/**
 * The projective transform taking `from` points to `to` points, by least
 * squares with h8 = 1. Coordinates are centred and scaled first — pixels run
 * to thousands and metres to hundreds, and unscaled the equations lose most of
 * their precision.
 */
export function fitH(from: Array<[number, number]>, to: Array<[number, number]>): H | null {
  if (from.length < 4 || from.length !== to.length) return null;
  const norm = (pts: Array<[number, number]>) => {
    const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const sc = Math.sqrt(2) / (pts.reduce((s, p) => s + Math.hypot(p[0] - mx, p[1] - my), 0) / pts.length || 1);
    const T: H = [sc, 0, -sc * mx, 0, sc, -sc * my, 0, 0, 1];
    return { T, pts: pts.map(([x, y]) => applyH(T, x, y)) };
  };
  const F = norm(from);
  const G = norm(to);
  const AtA = Array.from({ length: 8 }, () => new Array(8).fill(0) as number[]);
  const Atb = new Array(8).fill(0) as number[];
  for (let k = 0; k < F.pts.length; k++) {
    const [x, y] = F.pts[k]!;
    const [u, v] = G.pts[k]!;
    const rows: Array<[number[], number]> = [
      [[x, y, 1, 0, 0, 0, -x * u, -y * u], u],
      [[0, 0, 0, x, y, 1, -x * v, -y * v], v],
    ];
    for (const [r, rhs] of rows) {
      for (let i = 0; i < 8; i++) {
        Atb[i]! += r[i]! * rhs;
        for (let j = 0; j < 8; j++) AtA[i]![j]! += r[i]! * r[j]!;
      }
    }
  }
  const s = solve(AtA, Atb);
  if (!s) return null;
  const Hn = [...s, 1] as H;
  // Undo the normalisation: H = inv(Tto) · Hn · Tfrom.
  return mul(mul(invertH(G.T), Hn), F.T);
}

function mul(a: H, b: H): H {
  const r = new Array(9).fill(0) as number[];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j]! += a[i * 3 + k]! * b[k * 3 + j]!;
  return r as H;
}

/**
 * CSS `matrix3d()` values that draw a `width`×`height` element onto the four
 * screen points given, clockwise from top-left. The browser does the warping;
 * this only says where the corners go.
 */
export function matrix3dFor(width: number, height: number, corners: Array<[number, number]>): number[] | null {
  const h = fitH([[0, 0], [width, 0], [width, height], [0, height]], corners);
  if (!h) return null;
  // Column-major, with z passed through untouched.
  return [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, h[8]];
}

// ---------------------------------------------------------------- placement

/**
 * Where an image lies, in whichever model the points support: a straight
 * stretch from two or three points, the tilt-corrected fit from four or more.
 * Both answer the same questions, so nothing downstream needs to know which.
 */
export interface Placement {
  kind: 'stretch' | 'tilt';
  /** Image pixel to [lat, lng]. */
  toMap: (px: number, py: number) => [number, number];
  /** [lat, lng] to image pixel. */
  toImage: (lat: number, lng: number) => [number, number];
  /** [lat, lng] of the corners, clockwise from top-left. */
  corners: Array<[number, number]>;
  residuals: number[];
  rms: number;
  /** Why a tilt fit was not used, when there were enough points for one. */
  note?: string;
}

function stretchPlacement(bounds: Bounds, width: number, height: number, residuals: number[], rms: number): Placement {
  const [[s, w], [n, e]] = bounds;
  return {
    kind: 'stretch',
    toMap: (px, py) => [n - (py / height) * (n - s), w + (px / width) * (e - w)],
    toImage: (lat, lng) => pixelAt(bounds, width, height, lat, lng),
    corners: [[n, w], [n, e], [s, e], [s, w]],
    residuals,
    rms,
  };
}

/** The stretch an unaligned image sits at, as a placement. */
export const placementFromBounds = (bounds: Bounds, width: number, height: number): Placement =>
  stretchPlacement(bounds, width, height, [], 0);

const shoelace = (pts: Array<[number, number]>): number =>
  pts.reduce((s, [x, y], i) => {
    const [x2, y2] = pts[(i + 1) % pts.length]!;
    return s + x * y2 - x2 * y;
  }, 0) / 2;

/** Every turn the same way: no bow-tie, no corner folded inwards. */
function convex(pts: Array<[number, number]>): boolean {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i]!;
    const [bx, by] = pts[(i + 1) % pts.length]!;
    const [cx, cy] = pts[(i + 2) % pts.length]!;
    const z = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (z === 0) continue;
    if (sign === 0) sign = Math.sign(z);
    else if (Math.sign(z) !== sign) return false;
  }
  return true;
}

/**
 * The best placement the points support. Four or more points get the tilt fit,
 * fitted in metres east and north of their middle — a local flat frame, so the
 * model is the camera's and not the map projection's — unless it comes out
 * folded or far from the stretch's size, which is what one careless click
 * does to it. Then the stretch stands, and `note` says why.
 */
export function fitPlacement(pairs: Pair[], width: number, height: number): Placement | null {
  const stretch = fitBounds(pairs, width, height);
  if (!stretch) return null;
  const base = stretchPlacement(stretch.bounds, width, height, stretch.residuals, stretch.rms);
  if (pairs.length < 4) return base;

  const lat0 = pairs.reduce((s, p) => s + p.lat, 0) / pairs.length;
  const lng0 = pairs.reduce((s, p) => s + p.lng, 0) / pairs.length;
  const kx = mPerDegLng(lat0);
  const toM = (lat: number, lng: number): [number, number] => [(lng - lng0) * kx, (lat - lat0) * M_PER_DEG_LAT];
  const toLL = (x: number, y: number): [number, number] => [lat0 + y / M_PER_DEG_LAT, lng0 + x / kx];

  const h = fitH(pairs.map((p) => [p.px, p.py]), pairs.map((p) => toM(p.lat, p.lng)));
  if (!h) return { ...base, note: 'The tilt fit could not be solved from these points; using the stretch.' };
  const inv = invertH(h);

  const cornersM = ([[0, 0], [width, 0], [width, height], [0, height]] as Array<[number, number]>).map(([x, y]) => applyH(h, x, y));
  const stretchM = base.corners.map(([lat, lng]) => toM(lat, lng));
  const ratio = Math.abs(shoelace(cornersM)) / Math.abs(shoelace(stretchM));
  if (!cornersM.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)) || !convex(cornersM) || ratio < 0.7 || ratio > 1.4) {
    return { ...base, note: 'The tilt fit came out twisted — usually one mis-clicked point. Using the stretch; undo the worst point and try again.' };
  }

  const residuals = pairs.map((p) => {
    const [x, y] = applyH(h, p.px, p.py);
    const [ex, ey] = toM(p.lat, p.lng);
    return Math.hypot(x - ex, y - ey);
  });
  const rms = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length);
  return {
    kind: 'tilt',
    toMap: (px, py) => toLL(...applyH(h, px, py)),
    toImage: (lat, lng) => applyH(inv, ...toM(lat, lng)),
    corners: cornersM.map(([x, y]) => toLL(x, y)),
    residuals,
    rms,
  };
}
