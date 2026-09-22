#!/usr/bin/env node
// Compares a freshly traced campus-areas.geojson against the one on disk.
//
//   npm run areas:check -- ~/Downloads/campus-areas.geojson
//
// The tracer exports the whole file, and a polygon drawn onto an area that
// already exists comes back as that area's *only* geometry rather than added
// to what was there. The outer boundary is updated correctly either way, so
// the giveaway is a boundary that grew by as much as a campus shrank — which
// is easy to miss in a diff of several hundred coordinates and expensive to
// miss, because it silently deletes a campus.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!input) {
  console.error('Usage: npm run areas:check -- <traced.geojson>');
  process.exit(1);
}

const R = 6378137;
const ACRE = 4046.8564224;
const rad = (d) => (d * Math.PI) / 180;

/** Spherical excess — the same measure PostGIS and Turf use for geography. */
function ringAcres(ring) {
  const r = ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring : [...ring, ring[0]];
  let total = 0;
  for (let i = 0; i < r.length - 1; i += 1) {
    total += (rad(r[i + 1][0]) - rad(r[i][0])) * (2 + Math.sin(rad(r[i][1])) + Math.sin(rad(r[i + 1][1])));
  }
  return Math.abs((total * R * R) / 2) / ACRE;
}

const acres = (g) => (g.type === 'Polygon'
  ? ringAcres(g.coordinates[0])
  : g.coordinates.reduce((sum, poly) => sum + ringAcres(poly[0]), 0));

const table = (path) => Object.fromEntries(
  JSON.parse(readFileSync(path, 'utf8')).features.map((f) => [f.properties.area_id, acres(f.geometry)]),
);

const before = table(join(root, 'data', 'campus-areas.geojson'));
const after = table(resolve(process.cwd(), input));

console.log(`\n${input}\n`);
console.log(`  ${'area'.padEnd(18)}${'on disk'.padStart(10)}${'traced'.padStart(10)}${'change'.padStart(10)}`);

let shrank = 0;
for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
  const a = before[id];
  const b = after[id];
  if (a === undefined) { console.log(`  ${id.padEnd(18)}${'—'.padStart(10)}${b.toFixed(1).padStart(10)}${'added'.padStart(10)}`); continue; }
  if (b === undefined) { console.log(`  ${id.padEnd(18)}${a.toFixed(1).padStart(10)}${'—'.padStart(10)}${'REMOVED'.padStart(10)}`); shrank += 1; continue; }
  const delta = b - a;
  const flag = delta < -0.05 ? '  ← shrank' : '';
  if (delta < -0.05) shrank += 1;
  console.log(`  ${id.padEnd(18)}${a.toFixed(1).padStart(10)}${b.toFixed(1).padStart(10)}${`${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`.padStart(10)}${flag}`);
}

if (shrank) {
  console.log(
    `\n✗ ${shrank} area(s) got smaller. If you only added land, that is the tracer\n`
    + '  writing the new polygon as the area\'s whole geometry. Union it with what is\n'
    + '  on disk rather than replacing:  pc.union(oldGeometry, newGeometry)\n',
  );
  process.exit(1);
}
console.log('\n✓ nothing shrank.\n');
