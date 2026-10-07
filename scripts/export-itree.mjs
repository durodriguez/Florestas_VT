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
//   npm run itree:export                      # writes itree-export/city-trees-itree.xlsx
//   npm run itree:export -- --out file.xlsx
//
// Excel, not CSV: i-Tree's importer takes .xls or .xlsx only, and wants each
// column typed — numbers as numbers, dates as dates (Eco Guide: Importing an
// Existing Inventory, 2021). Column names follow i-Tree's fields, so the
// import wizard's matching is a matter of confirming, not searching.
//
// The file is regenerated from committed data whenever it is needed, so it is
// not committed itself (itree-export/ is ignored).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import { itreeName, itreeCondition } from './lib/itree.mjs';
import { writeXlsx } from './lib/xlsx.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outArg = args.indexOf('--out');
const out = outArg >= 0 ? resolve(args[outArg + 1]) : join(root, 'itree-export', 'city-trees-itree.xlsx');

const parse = (p) => Papa.parse(readFileSync(p, 'utf8'), { header: true, skipEmptyLines: 'greedy' }).data;
const trees = parse(join(root, 'data', 'city-trees.csv'));
const taxa = new Map(parse(join(root, 'data', 'taxa.csv')).map((t) => [t.taxon_id, t]));

const columns = [
  // i-Tree's Tree ID must be a number above zero, so it is Burlington's site
  // number; the BTV- form goes in User Tree ID, which is what the results are
  // joined back on.
  { header: 'Tree ID', type: 'number' },
  { header: 'User Tree ID', type: 'text' },
  { header: 'Species', type: 'text' },
  { header: 'Common Name', type: 'text' },
  { header: 'DBH (in)', type: 'number' },
  { header: 'Total Height (ft)', type: 'number' },
  // The city records one crown spread; i-Tree's import takes one crown width.
  { header: 'Crown Width (ft)', type: 'number' },
  { header: 'Crown Health', type: 'text' },
  { header: 'Street Tree', type: 'text' },
  { header: 'Public Tree', type: 'text' },
  // Left out, i-Tree assumes Residential, which changes growth and value. Its
  // field manual classes a street tree by the nearest land use beside the road
  // (only limited-access highways are Transportation), and inside the campus
  // boundary that is the university: Institutional.
  { header: 'Land Use', type: 'text' },
  { header: 'Survey Date', type: 'date' },
  { header: 'Latitude', type: 'number' },
  { header: 'Longitude', type: 'number' },
  { header: 'Tree Address', type: 'text' },
];

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
  rows.push([
    Number(t.city_id.replace(/^BTV-/, '')),
    t.city_id,
    name,
    taxon.common_name,
    t.dbh_in,
    t.height_ft,
    t.spread_ft,
    itreeCondition(t.condition),
    'Y',
    'Y',
    'Institutional',
    t.recorded_on || null,
    t.lat,
    t.lng,
    t.address,
  ]);
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, await writeXlsx(columns, rows, 'Burlington campus trees'));

const dates = rows.map((r) => r[columns.findIndex((c) => c.type === 'date')]);
const years = dates.filter(Boolean).map((d) => d.slice(0, 4)).sort();
console.log(`\n✓ ${rows.length} trees written to ${out}`);
console.log(`  measured ${years[0]}–${years.at(-1)}; ${dates.filter((d) => !d).length} with no date`);
if (notes.size) {
  console.log(`\n${notes.size} name(s) translated for i-Tree — check these in its species step:`);
  for (const [k, v] of notes) console.log(`  ${k}  (${v})`);
}
