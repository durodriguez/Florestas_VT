#!/usr/bin/env node
// Writes an inventory file for i-Tree Eco from data/city-trees.csv.
//
// i-Tree Eco is the USDA Forest Service's model of what trees do — carbon
// stored and taken up, air pollution removed, rainfall intercepted — and it
// runs on species, trunk diameter and location. This script only prepares its
// input; the model itself runs in i-Tree. See docs/ITREE.md for the whole
// round trip.
//
// Usage:
//   npm run itree:export                      # writes itree-export/city-trees-itree.csv
//   npm run itree:export -- --out file.csv
//
// The file is regenerated from committed data whenever it is needed, so it is
// not committed itself (itree-export/ is ignored).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import { itreeName, itreeCondition } from './lib/itree.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outArg = args.indexOf('--out');
const out = outArg >= 0 ? resolve(args[outArg + 1]) : join(root, 'itree-export', 'city-trees-itree.csv');

const parse = (p) => Papa.parse(readFileSync(p, 'utf8'), { header: true, skipEmptyLines: 'greedy' }).data;
const trees = parse(join(root, 'data', 'city-trees.csv'));
const taxa = new Map(parse(join(root, 'data', 'taxa.csv')).map((t) => [t.taxon_id, t]));

const rows = [];
const notes = new Map();
for (const t of trees) {
  const taxon = taxa.get(t.taxon_id);
  if (!taxon) {
    console.error(`✗ ${t.city_id}: taxon ${t.taxon_id} is not in taxa.csv`);
    process.exit(1);
  }
  const { name, note } = itreeName(taxon);
  if (note) notes.set(`${taxon.scientific_name} → ${name}`, note);
  rows.push({
    // Burlington's own id, so results can be joined back to the tree.
    ID: t.city_id,
    Species: name,
    'Common Name': taxon.common_name,
    'DBH (in)': t.dbh_in,
    'Total Height (ft)': t.height_ft,
    // The city records one crown spread; i-Tree asks for two directions.
    'Crown Width N-S (ft)': t.spread_ft,
    'Crown Width E-W (ft)': t.spread_ft,
    Condition: itreeCondition(t.condition),
    'Street Tree': 'Yes',
    'Date Measured': t.recorded_on,
    Latitude: t.lat,
    Longitude: t.lng,
    Address: t.address,
  });
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Papa.unparse(rows, { newline: '\n' }) + '\n');

const years = rows.map((r) => r['Date Measured'].slice(0, 4)).filter(Boolean).sort();
console.log(`\n✓ ${rows.length} trees written to ${out}`);
console.log(`  measured ${years[0]}–${years.at(-1)}; ${rows.filter((r) => !r['Date Measured']).length} with no date`);
if (notes.size) {
  console.log(`\n${notes.size} name(s) translated for i-Tree — check these in its species step:`);
  for (const [k, v] of notes) console.log(`  ${k}  (${v})`);
}
