#!/usr/bin/env node
// Fills in each plant's collection_id from its coordinates, by finding which
// campus area in campus-areas.geojson contains it.
//
// A surveyor picking a campus from a list gets it wrong occasionally and has to
// think about it every time; the coordinate already knows. Run this after an
// import, or after the campus boundaries change.
//
// Usage:
//   node scripts/assign-collections.mjs            # dry run, report only
//   node scripts/assign-collections.mjs --write    # write plants.csv
//   node scripts/assign-collections.mjs --write --all   # also redo existing

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import { campusAt } from './lib/geo.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const write = process.argv.includes('--write');
const all = process.argv.includes('--all');

const plantsPath = join(dataDir, 'plants.csv');
const { data: rows, meta } = Papa.parse(readFileSync(plantsPath, 'utf8'), {
  header: true,
  delimiter: ',',
  skipEmptyLines: 'greedy',
  transformHeader: (h) => h.trim(),
});
const areas = JSON.parse(readFileSync(join(dataDir, 'campus-areas.geojson'), 'utf8'));

let filled = 0;
let changed = 0;
let outside = 0;
const notes = [];

for (const row of rows) {
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
  const current = (row.collection_id ?? '').trim();
  if (current && !all) continue;

  const found = campusAt(lng, lat, areas);
  if (!found) {
    outside++;
    notes.push(`  ? ${row.plant_id}  ${lat}, ${lng} is not inside any campus area`);
    continue;
  }
  if (current === found) continue;
  if (current) {
    changed++;
    notes.push(`  ~ ${row.plant_id}  ${current} -> ${found}`);
  } else {
    filled++;
  }
  row.collection_id = found;
}

for (const note of notes.slice(0, 20)) console.log(note);
if (notes.length > 20) console.log(`  …and ${notes.length - 20} more`);

console.log(
  `\n${filled} filled in, ${changed} changed, ${outside} outside every area` +
  `${all ? '' : ' (existing values kept; pass --all to redo them)'}`,
);

if (!write) {
  console.log('\nDry run. Pass --write to update data/plants.csv.');
  process.exit(0);
}
if (filled + changed === 0) {
  console.log('\nNothing to write.');
  process.exit(0);
}

// Back up before overwriting: this rewrites every row of the file.
const backup = `${plantsPath}.bak`;
if (existsSync(plantsPath)) copyFileSync(plantsPath, backup);
writeFileSync(plantsPath, Papa.unparse(rows, { columns: meta.fields, newline: '\n' }) + '\n');
console.log(`\n✓ data/plants.csv updated (previous version at ${backup})`);
