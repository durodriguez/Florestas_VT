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
