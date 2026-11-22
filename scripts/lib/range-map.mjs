/**
 * A species' native range on a map of the lower 48, for its species page.
 *
 * The data is Little's "Atlas of United States Trees" (public domain), fetched
 * once into data/ranges/ by scripts/fetch-ranges.mjs. The map is three layers
 * stacked in the page, so what every page shares is drawn once:
 *
 * 1. range-base.svg, shared: the sea, Canada and Mexico, the states.
 * 2. inline, per species: where it grows wild, with the gaps inside its range
 *    cut out (fill-rule evenodd).
 * 3. range-lines.svg, shared: the large lakes, the state lines, Vermont and a
 *    star on Burlington.
 *
 * All three use one projection, an Albers equal-area conic centred on the
 * lower 48, the usual one for maps of the United States. No DOM here.
 */

export const FRAME = { west: -130, east: -58, south: 20, north: 56 };
/** What the map shows: the lower 48 and the edges of Canada and Mexico. */
const VIEW = { west: -125, east: -65.5, south: 24, north: 50.2 };
export const BURLINGTON = { lat: 44.4759, lng: -73.2121 };
const WIDTH = 640;

const rad = Math.PI / 180;
const [p1, p2, p0, l0] = [29.5 * rad, 45.5 * rad, 37.5 * rad, -96];
const n = (Math.sin(p1) + Math.sin(p2)) / 2;
const C = Math.cos(p1) ** 2 + 2 * n * Math.sin(p1);
const rho0 = Math.sqrt(C - 2 * n * Math.sin(p0)) / n;

function albers(lng, lat) {
  const rho = Math.sqrt(C - 2 * n * Math.sin(lat * rad)) / n;
  const theta = n * (lng - l0) * rad;
  return [rho * Math.sin(theta), rho0 - rho * Math.cos(theta)];
}

// The view's box in projected units, from points along its edges (the
// parallels curve, so the corners alone are not enough).
const edge = [];
for (let lng = VIEW.west; lng <= VIEW.east; lng += 0.5) edge.push(albers(lng, VIEW.south), albers(lng, VIEW.north));
const X0 = Math.min(...edge.map((p) => p[0]));
const X1 = Math.max(...edge.map((p) => p[0]));
const Y0 = Math.min(...edge.map((p) => p[1]));
const Y1 = Math.max(...edge.map((p) => p[1]));
const scale = WIDTH / (X1 - X0);
export const SIZE = { width: WIDTH, height: Math.round((Y1 - Y0) * scale) };

/** [lng, lat] → [x, y] on the map. */
export function project(lng, lat) {
  const [x, y] = albers(lng, lat);
  return [(x - X0) * scale, (Y1 - y) * scale];
}

/** Polygons (arrays of rings of [lng, lat]) as one SVG path. */
export function pathOf(polygons) {
  let d = '';
  for (const poly of polygons) {
    for (const ring of poly) {
      let last = null;
      const pts = [];
      for (const [lng, lat] of ring) {
        const [x, y] = project(lng, lat);
        // Points closer than a third of a pixel add bytes, not detail.
        if (last && Math.abs(x - last[0]) + Math.abs(y - last[1]) < 0.35) continue;
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
        last = [x, y];
      }
      if (pts.length > 2) d += `M${pts.join('L')}Z`;
    }
  }
  return d;
}

/** Even–odd ray casting: is [lng, lat] inside the rings? */
function inRings(rings, lng, lat) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Whether a point is in a species' range: in one of its areas, not in a gap. */
export function inRange(range, lat, lng) {
  const within = range.range.some((poly) => inRings(poly, lng, lat));
  return within && !range.absent.some((poly) => inRings(poly, lng, lat));
}

/** Shoelace area of a ring, in square degrees. */
const areaOf = (ring) => Math.abs(ring.reduce((sum, [x, y], i) => {
  const [nx, ny] = ring[(i + 1) % ring.length];
  return sum + x * ny - nx * y;
}, 0)) / 2;

/**
 * Smaller than this, in square degrees (about 18,000 km² at Vermont's
 * latitude, three quarters of Vermont), an area of a range is an outlier: a
 * patch Little drew apart from the main range, as he did for the Champlain
 * Valley's bur oaks and pitch pines.
 */
const OUTLIER = 2;

/** The range without its outlying patches. */
export const mainBody = (range) => ({ ...range, range: range.range.filter((poly) => areaOf(poly[0]) >= OUTLIER) });

/**
 * Where a point stands against a range: in its main body ('main'), only in an
 * outlying patch ('outlier'), or outside it (null).
 */
export function whereIn(range, lat, lng) {
  if (!inRange(range, lat, lng)) return null;
  const main = range.range.some((poly) => areaOf(poly[0]) >= OUTLIER && inRings(poly, lng, lat));
  return main ? 'main' : 'outlier';
}

/**
 * Whether a range and a state's outline overlap: a corner of either inside the
 * other. Enough at this scale, where neither is drawn finer than a few km.
 */
export function rangeTouches(range, polygons) {
  const inState = (lng, lat) => polygons.some((poly) => inRings(poly, lng, lat));
  const corners = (polys) => polys.flatMap((poly) => poly[0]);
  return corners(range.range).some(([lng, lat]) => inState(lng, lat) && inRange(range, lat, lng))
    || corners(polygons).some(([lng, lat]) => inRange(range, lat, lng));
}

const STAR = 'M0-9l2.6 5.6 6.1.7-4.6 4.2 1.3 6.1L0 4.5l-5.4 3.1 1.3-6.1-4.6-4.2 6.1-.7z';

/** The shared bottom layer. Its own colors, light and dark, as an <img> cannot see the page's. */
export function rangeBaseSvg(basemap) {
  const states = basemap.states.flatMap((s) => s.polygons);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE.width} ${SIZE.height}">
<style>.sea{fill:#eaf1f5}.nb{fill:#ecebe3;stroke:#c9c6b8;stroke-width:.4}.us{fill:#f5f3ea}
@media (prefers-color-scheme:dark){.sea{fill:#17232b}.nb{fill:#232724;stroke:#3a3f3b}.us{fill:#2a2f2b}}</style>
<rect class="sea" width="${SIZE.width}" height="${SIZE.height}"/>
<path class="nb" d="${pathOf(basemap.neighbors)}"/>
<path class="us" d="${pathOf(states)}"/>
</svg>`;
}

/** The shared top layer: lakes, state lines, Vermont, and Burlington's star. */
export function rangeLinesSvg(basemap) {
  const states = basemap.states.flatMap((s) => s.polygons);
  const vermont = basemap.states.find((s) => s.name === 'Vermont')?.polygons ?? [];
  const [bx, by] = project(BURLINGTON.lng, BURLINGTON.lat);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE.width} ${SIZE.height}">
<style>.lk{fill:#eaf1f5;stroke:#b9c7cf;stroke-width:.4}.ln{fill:none;stroke:#a9a594;stroke-width:.5}.vt{fill:none;stroke:#154734;stroke-width:1.6}.st{fill:#ffd100;stroke:#154734;stroke-width:1.4}
@media (prefers-color-scheme:dark){.lk{fill:#17232b;stroke:#2d3a42}.ln{stroke:#565b55}.vt{stroke:#9fd3b4}.st{stroke:#0e2a1e}}</style>
<path class="lk" d="${pathOf(basemap.lakes)}"/>
<path class="ln" d="${pathOf(states)}"/>
<path class="vt" d="${pathOf(vermont)}"/>
<path class="st" transform="translate(${bx.toFixed(1)} ${by.toFixed(1)}) scale(.62)" d="${STAR}"/>
</svg>`;
}

/** The species' own layer, inline in its page. */
export function rangeSvg(range) {
  const d = pathOf([...range.range, ...range.absent]);
  return `<svg class="range-fill" viewBox="0 0 ${SIZE.width} ${SIZE.height}" aria-hidden="true"><path d="${d}" fill-rule="evenodd"/></svg>`;
}

/** Ray casting on one polygon's outer ring, with a bounding-box check first. */
function boxOf(poly) {
  let w = Infinity, e = -Infinity, s = Infinity, n = -Infinity;
  for (const [x, y] of poly[0]) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
  return [w, e, s, n];
}

/**
 * Which states a range covers, and whether it reaches into Canada or Mexico,
 * read off a grid of points a quarter degree apart. Run once per species by
 * fetch-ranges.mjs and stored with the range, as it is slow. A state counts
 * when at least MIN_POINTS of its grid points fall in the range (a few
 * hundred square km), so a speck at a border does not add a state.
 */
export function rangeStates(range, basemap) {
  const MIN_POINTS = 3;
  const states = basemap.states.map((s) => ({ name: s.name, polys: s.polygons.map((p) => ({ p, box: boxOf(p) })) }));
  const nb = basemap.neighbors.map((p) => ({ p, box: boxOf(p) }));
  const rp = range.range.map((p) => ({ p, box: boxOf(p) }));
  const ap = range.absent.map((p) => ({ p, box: boxOf(p) }));
  const hit = (list, x, y) => list.some(({ p, box }) => x >= box[0] && x <= box[1] && y >= box[2] && y <= box[3] && inRings(p, x, y));
  const tally = new Map();
  let canada = 0, mexico = 0;
  for (let y = FRAME.south + 0.125; y < FRAME.north; y += 0.25) {
    for (let x = FRAME.west + 0.125; x < FRAME.east; x += 0.25) {
      if (!hit(rp, x, y) || hit(ap, x, y)) continue;
      const st = states.find((s) => hit(s.polys, x, y));
      if (st) {
        const t = tally.get(st.name) ?? { name: st.name, n: 0, lat: 0, lng: 0 };
        t.n += 1; t.lat += y; t.lng += x;
        tally.set(st.name, t);
      } else if (hit(nb, x, y)) {
        if (y > 41) canada += 1; else if (y < 33) mexico += 1;
      }
    }
  }
  return {
    states: [...tally.values()].filter((t) => t.n >= MIN_POINTS)
      .map((t) => ({ name: t.name, lat: Math.round((t.lat / t.n) * 10) / 10, lng: Math.round((t.lng / t.n) * 10) / 10, n: t.n }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    canada: canada >= MIN_POINTS,
    mexico: mexico >= MIN_POINTS,
  };
}

const listing = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

/**
 * The range in a sentence, from rangeStates(): "Grows wild in 32 states, from
 * Maine west to Minnesota and south to Florida and Texas, reaching north into
 * Canada." Four states or fewer are named outright; a range lying east to
 * west (under 6 degrees of latitude between its states, and far wider than it
 * is tall) by its two ends.
 * Otherwise the corners:
 * the state farthest to the northeast, then northwest, southeast and
 * southwest, by where the range lies within each, each named once and only
 * where it really is in the north or south of the range.
 */
export function describeRange(info) {
  const { states = [], canada = false, mexico = false } = info ?? {};
  if (!states.length) return '';
  const beyond = [canada ? 'north into Canada' : '', mexico ? 'south into Mexico' : ''].filter(Boolean);
  const tail = beyond.length ? `, reaching ${listing(beyond)}` : '';
  const count = `${states.length} ${states.length === 1 ? 'state' : 'states'}`;
  if (states.length <= 4) {
    const west = [...states].sort((a, b) => a.lng - b.lng).map((s) => s.name);
    return `Grows wild in ${states.length === 1 ? '' : `${count}: `}${listing(west)}${tail}.`;
  }
  const lats = states.map((s) => s.lat);
  const lngs = states.map((s) => s.lng);
  const [s0, s1, w0, w1] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  // A range lying east to west, across the north as white spruce's does:
  // its ends, east then west.
  const wide = (w1 - w0) * Math.cos((((s0 + s1) / 2) * Math.PI) / 180);
  if (s1 - s0 < 6 && wide > 2.5 * (s1 - s0)) {
    const east = states.reduce((a, b) => (b.lng > a.lng ? b : a));
    const west = states.reduce((a, b) => (b.lng < a.lng ? b : a));
    return `Grows wild in ${count}, from ${east.name} west to ${west.name}${tail}.`;
  }
  const ny = (s) => (s.lat - s0) / (s1 - s0 || 1);
  const nx = (s) => (s.lng - w0) / (w1 - w0 || 1);
  const best = (score) => states.reduce((a, b) => (score(b) > score(a) ? b : a));
  const ne = best((s) => nx(s) + ny(s));
  const nw = best((s) => ny(s) - nx(s));
  const se = best((s) => nx(s) - ny(s));
  const sw = best((s) => -nx(s) - ny(s));
  const north = [ne, nw].filter((s, i, a) => ny(s) >= 0.5 && a.indexOf(s) === i);
  const south = [se, sw].filter((s, i, a) => ny(s) < 0.5 && a.indexOf(s) === i && !north.includes(s));
  const from = north[0] ?? ne;
  const parts = [];
  if (north[1] && north[1] !== from) parts.push(`west to ${north[1].name}`);
  if (south.length) parts.push(`south to ${listing(south.map((s) => s.name))}`);
  return `Grows wild in ${count}, from ${from.name}${parts.length ? ` ${parts.join(' and ')}` : ''}${tail}.`;
}
