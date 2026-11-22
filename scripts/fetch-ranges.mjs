#!/usr/bin/env node
/**
 * Fetch the native range of each species in taxa.csv from Little's "Atlas of
 * United States Trees", and the outlines to draw them on, into data/ranges/.
 * Run by hand, rarely (`npm run ranges:fetch`); the build reads only what this
 * writes and never goes to the network. See data/SOURCES.md.
 *
 * - Ranges: Elbert L. Little Jr.'s maps (U.S. Department of Agriculture,
 *   1971–1978), digitized by the USGS and public domain, from the copy at
 *   github.com/wpetry/USTreeAtlas. One file per species: data/ranges/<taxon
 *   species id>.json, e.g. acer-rubrum.json, holding the areas where it grows
 *   wild and the gaps inside them where it does not.
 * - Outlines: Natural Earth (public domain): the lower 48 states, Canada and
 *   Mexico, and the large lakes, in data/ranges/basemap.json.
 *
 * Everything is cut to the frame the species pages draw (the lower 48 and the
 * edges of Canada and Mexico) and simplified to what the page's map can show
 * (TOLERANCE). Little's maps are hand-drawn at continental scale anyway.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import polygonClipping from 'polygon-clipping';
import { FRAME, rangeStates } from './lib/range-map.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'data', 'ranges');
const ATLAS = 'https://raw.githubusercontent.com/wpetry/USTreeAtlas/main';
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';

/**
 * Our name → Little's, where the atlas uses an older one. Each is the same
 * plant under the name Little used in 1971–1978.
 */
export const SYNONYMS = {
  'Aesculus flava': 'Aesculus octandra',
  'Alnus incana': 'Alnus rugosa', // the eastern speckled alder, A. incana subsp. rugosa
  'Callitropsis nootkatensis': 'Chamaecyparis nootkatensis',
  'Carya illinoinensis': 'Carya illinoensis',
  'Cornus sericea': 'Cornus stolonifera',
  'Halesia tetraptera': 'Halesia carolina',
  'Quercus hemisphaerica': 'Quercus laurifolia', // Little did not separate the two
  'Quercus montana': 'Quercus prinus',
};

/**
 * Degrees: about 4 km, half a pixel on the page's map, where a pixel is about
 * 10 km. Areas smaller than MIN_AREA square degrees (a few square km, a
 * fraction of a pixel) are dropped as invisible.
 */
const TOLERANCE = 0.04;
const MIN_AREA = 0.002;

/** Shoelace area of a ring, in square degrees. */
const area = (ring) => Math.abs(ring.reduce((sum, [x, y], i) => {
  const [nx, ny] = ring[(i + 1) % ring.length];
  return sum + x * ny - nx * y;
}, 0)) / 2;

async function get(url, as = 'json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return as === 'json' ? res.json() : res.text();
}

/** Douglas–Peucker on one ring of [lng, lat]. */
function simplify(ring, tol) {
  if (ring.length < 5) return ring;
  const keep = new Uint8Array(ring.length);
  const last = ring.length - 1;
  // A closed ring starts and ends on the same point, which leaves no line to
  // measure from; split it at the point farthest from the start instead.
  let far = 1;
  for (let i = 1; i < last; i++) {
    if (Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]) > Math.hypot(ring[far][0] - ring[0][0], ring[far][1] - ring[0][1])) far = i;
  }
  keep[0] = keep[far] = keep[last] = 1;
  const stack = [[0, far], [far, last]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [x1, y1] = ring[a];
    const [x2, y2] = ring[b];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1e-12;
    let worst = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * ring[i][0] - dx * ring[i][1] + x2 * y1 - y2 * x1) / len;
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > tol) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

const round = (v) => Math.round(v * 100) / 100;
const FRAME_BOX = [[[FRAME.west, FRAME.south], [FRAME.east, FRAME.south], [FRAME.east, FRAME.north], [FRAME.west, FRAME.north], [FRAME.west, FRAME.south]]];

/** A GeoJSON geometry → polygons cut to the frame, simplified and rounded. */
function prepare(geometry) {
  if (!geometry) return [];
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  if (!polys.length) return [];
  const clipped = polygonClipping.intersection(polys, FRAME_BOX);
  return clipped
    .filter((poly) => area(poly[0]) >= MIN_AREA)
    .map((poly) => poly.map((ring) => simplify(ring, TOLERANCE).map(([x, y]) => [round(x), round(y)]))
      .filter((r) => r.length >= 4 && area(r) >= MIN_AREA))
    .filter((poly) => poly.length);
}

const merge = (features) => features.flatMap((f) => prepare(f.geometry));

async function main() {
  mkdirSync(outDir, { recursive: true });

  // ---- the outlines
  const states = (await get(`${NE}/ne_50m_admin_1_states_provinces_lakes.geojson`)).features;
  const countries = (await get(`${NE}/ne_50m_admin_0_countries_lakes.geojson`)).features;
  const lakes = (await get(`${NE}/ne_50m_lakes.geojson`)).features;
  const lower48 = states.filter((f) => f.properties.adm0_a3 === 'USA' && !['Alaska', 'Hawaii'].includes(f.properties.name));
  const basemap = {
    states: lower48.map((f) => ({ name: f.properties.name, polygons: prepare(f.geometry) })),
    neighbors: merge(countries.filter((f) => ['CAN', 'MEX'].includes(f.properties.ADM0_A3))),
    // The lakes big enough to read at this scale.
    lakes: merge(lakes.filter((f) => (f.properties.scalerank ?? 9) <= 2)),
  };
  writeFileSync(join(outDir, 'basemap.json'), JSON.stringify(basemap));

  // ---- the ranges: Little's list, matched to taxa.csv by genus and species
  const readme = await get(`${ATLAS}/README.md`, 'text');
  const atlas = new Map(
    [...readme.matchAll(/^\| \*([^*]+)\* \| ([a-z]+)\*? \|/gm)].map((m) => [m[1].trim().toLowerCase(), m[2]]),
  );
  const taxa = Papa.parse(readFileSync(join(root, 'data', 'taxa.csv'), 'utf8'), { header: true, skipEmptyLines: true }).data;
  const species = new Map();
  for (const t of taxa) {
    const genus = (t.genus ?? '').trim();
    const epithet = (t.species ?? '').trim();
    if (!genus || !epithet || epithet.startsWith('x ')) continue;
    const name = `${genus} ${epithet}`;
    const little = SYNONYMS[name] ?? name;
    const code = atlas.get(little.toLowerCase());
    if (code) species.set(name, { code, little });
  }

  for (const f of readdirSync(outDir)) if (f !== 'basemap.json' && f.endsWith('.json')) rmSync(join(outDir, f));
  for (const [name, { code, little }] of [...species].sort()) {
    const features = (await get(`${ATLAS}/geojson/${code}.geojson`)).features;
    // CODE 1 is where it grows; CODE 0, a gap inside that where it does not.
    const out = {
      species: name,
      ...(little !== name ? { atlasName: little } : {}),
      atlasCode: code,
      range: merge(features.filter((f) => f.properties.CODE === 1)),
      absent: merge(features.filter((f) => f.properties.CODE === 0)),
    };
    // Which states it covers, for the sentence on its page (describeRange).
    out.where = rangeStates(out, basemap);
    const file = `${name.toLowerCase().replace(/\s+/g, '-')}.json`;
    writeFileSync(join(outDir, file), JSON.stringify(out));
    console.log(`${file.padEnd(34)} ${code}${little !== name ? ` (as ${little})` : ''}`);
  }
  console.log(`\n${species.size} species, basemap.json`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
