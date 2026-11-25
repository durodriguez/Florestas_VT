#!/usr/bin/env node
/**
 * Fetch the native range of each European species in taxa.csv that Little's
 * atlas does not map, and the outlines to draw them on, into
 * data/ranges/europe/. Run by hand, rarely (`npm run ranges:fetch-europe`),
 * after species are added to taxa.csv; the build reads only what this writes.
 * See data/SOURCES.md.
 *
 * - Ranges: Caudullo, Welk and San-Miguel-Ayanz's chorological maps of the
 *   main European woody species (European Commission Joint Research Centre,
 *   CC BY 4.0), version 19, from Mendeley Data. One file per species:
 *   data/ranges/europe/<species id>.json, e.g. picea-abies.json, holding the
 *   areas where it grows wild and its small isolated stands as points.
 *   Where the dataset maps subspecies apart (Austrian pine's five), they are
 *   put together, as taxa.csv names the species. Its maps of where a species
 *   was introduced or has gone wild (the files named _syn_) are left out.
 * - Outlines: Natural Earth (public domain): the countries of Europe, North
 *   Africa and Asia, and the large lakes, in data/ranges/europe/basemap.json.
 *
 * The US ranges are fetched by fetch-ranges.mjs, which leaves this folder be.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import JSZip from 'jszip';
import polygonClipping from 'polygon-clipping';
import * as shapefile from 'shapefile';
import { area, simplify } from './fetch-ranges.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'data', 'ranges', 'europe');
const littleDir = join(root, 'data', 'ranges');
const DATASET = 'https://data.mendeley.com/public-files/datasets/hr5h2hcgg4/files/2e1639c0-f513-4e6b-bc1d-9523a73a0faf/file_downloaded';
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';

/** Our name → the dataset's, where it uses another. None yet. */
export const SYNONYMS = {};

/**
 * Everything is cut to this box: the Atlantic islands to the Bering Strait,
 * the equator to the Arctic. The ranges reach no farther south than 21°N;
 * the land goes on to the equator so a wide frame (walnut's, from the Canary
 * Islands to Japan) does not show Africa cut off.
 */
const BOX = { west: -35, east: 180, south: 0, north: 84 };
/** Degrees: about 2 km; the page simplifies again to the pixel for each map. */
const TOLERANCE = 0.02;
/** Square degrees, about 20 km² in central Europe: an area smaller is drawn as a dot. */
const MIN_AREA = 0.002;

const round = (v) => Math.round(v * 100) / 100;
const BOX_POLY = [[[BOX.west, BOX.south], [BOX.east, BOX.south], [BOX.east, BOX.north], [BOX.west, BOX.north], [BOX.west, BOX.south]]];
const centroid = (ring) => [round(ring.reduce((s, p) => s + p[0], 0) / ring.length), round(ring.reduce((s, p) => s + p[1], 0) / ring.length)];

async function get(url, as = 'json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return as === 'json' ? res.json() : as === 'buffer' ? res.arrayBuffer() : res.text();
}

const polysOf = (g) => (!g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);

/**
 * GeoJSON geometries → { polygons, dots }: cut to the box, simplified and
 * rounded, with areas too small to draw turned into dots at their middle.
 */
function prepare(geometries) {
  const polys = geometries.flatMap(polysOf);
  if (!polys.length) return { polygons: [], dots: [] };
  // Subspecies' areas can overlap: merged first, so each is drawn once.
  const clipped = polygonClipping.intersection(polygonClipping.union(...polys), BOX_POLY);
  const polygons = [];
  const dots = [];
  for (const poly of clipped) {
    if (area(poly[0]) < MIN_AREA) { dots.push(centroid(poly[0])); continue; }
    const rings = poly.map((ring) => simplify(ring, TOLERANCE).map(([x, y]) => [round(x), round(y)]))
      .filter((r) => r.length >= 4 && area(r) >= MIN_AREA / 4);
    if (rings.length) polygons.push(rings);
  }
  return { polygons, dots };
}

/** Outlines only: cut to the box, simplified, without the dots. */
const outlines = (features) => prepare(features.map((f) => f.geometry)).polygons;

/** Every shapefile in a species' folder of the zip, read to GeoJSON features, by file name. */
async function readSpecies(zip, folder) {
  const out = new Map();
  const files = Object.keys(zip.files).filter((p) => p.startsWith(`${folder}/`) && p.endsWith('.shp'));
  for (const shp of files) {
    const name = basename(shp, '.shp');
    const dbf = zip.file(shp.replace(/\.shp$/, '.dbf'));
    const source = await zip.file(shp).async('arraybuffer');
    const collection = await shapefile.read(source, dbf ? await dbf.async('arraybuffer') : undefined);
    out.set(name, collection.features.filter((f) => f.geometry));
  }
  return out;
}

/**
 * A species' native range from its files: every file but the _syn_ ones
 * (introduced), taking a file's coast-clipped copy (_clip) over the uncut one.
 * Two names in version 19 do not follow the pattern: sycamore maple's
 * introduced stands are also in a file spelled _sym_pnt, left out with the
 * _syn_ ones (they reach Madeira and northern Norway); Atlas cedar's native
 * range is in Cedrus_atlantica_png, a slip for _plg, and is kept.
 */
export function nativeFiles(names) {
  const native = names.filter((n) => !/_sy[nm](_|$)/.test(n));
  return native.filter((n) => n.endsWith('_clip') || !native.includes(`${n}_clip`));
}

async function main() {
  mkdirSync(outDir, { recursive: true });

  // ---- the outlines
  const countries = (await get(`${NE}/ne_50m_admin_0_countries_lakes.geojson`)).features;
  const lakes = (await get(`${NE}/ne_50m_lakes.geojson`)).features;
  const basemap = {
    countries: countries.map((f) => ({ name: f.properties.NAME, polygons: outlines([f]) })).filter((c) => c.polygons.length),
    lakes: outlines(lakes.filter((f) => (f.properties.scalerank ?? 9) <= 2)),
  };
  writeFileSync(join(outDir, 'basemap.json'), JSON.stringify(basemap));

  // ---- the ranges: the dataset's species, matched to taxa.csv by genus and
  // species, for those Little's atlas does not already map
  const zip = await JSZip.loadAsync(await get(DATASET, 'buffer'));
  const folders = new Map(Object.keys(zip.files)
    .map((p) => p.split('/'))
    .filter((parts) => parts.length >= 3 && parts[1])
    .map((parts) => [parts[1].toLowerCase(), `${parts[0]}/${parts[1]}`]));
  const taxa = Papa.parse(readFileSync(join(root, 'data', 'taxa.csv'), 'utf8'), { header: true, skipEmptyLines: true }).data;
  const species = new Map();
  for (const t of taxa) {
    const genus = (t.genus ?? '').trim();
    const epithet = (t.species ?? '').trim();
    if (!genus || !epithet || epithet.startsWith('x ')) continue;
    const name = `${genus} ${epithet}`;
    const file = `${name.toLowerCase().replace(/\s+/g, '-')}.json`;
    if (existsSync(join(littleDir, file))) continue; // Little maps it
    const theirs = SYNONYMS[name] ?? name;
    const folder = folders.get(theirs.toLowerCase());
    if (folder) species.set(name, { folder, theirs, file });
  }

  for (const f of readdirSync(outDir)) if (f !== 'basemap.json' && f.endsWith('.json')) rmSync(join(outDir, f));
  for (const [name, { folder, theirs, file }] of [...species].sort()) {
    const shapes = await readSpecies(zip, folder);
    const used = nativeFiles([...shapes.keys()]);
    const features = used.flatMap((n) => shapes.get(n));
    const { polygons, dots } = prepare(features.filter((f) => f.geometry.type !== 'Point' && f.geometry.type !== 'MultiPoint').map((f) => f.geometry));
    const points = features.flatMap((f) => (f.geometry.type === 'Point' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPoint' ? f.geometry.coordinates : []))
      .filter(([x, y]) => x >= BOX.west && x <= BOX.east && y >= BOX.south && y <= BOX.north)
      .map(([x, y]) => [round(x), round(y)]);
    const out = {
      species: name,
      ...(theirs !== name ? { datasetName: theirs } : {}),
      source: 'caudullo',
      files: used.sort(),
      range: polygons,
      absent: [],
      points: [...points, ...dots],
    };
    writeFileSync(join(outDir, file), JSON.stringify(out));
    console.log(`${file.padEnd(30)} ${String(polygons.length).padStart(3)} areas ${String(out.points.length).padStart(4)} stands  ${used.join(', ')}`);
  }
  console.log(`\n${species.size} species, basemap.json`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
