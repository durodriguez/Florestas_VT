#!/usr/bin/env node
// Reports how a file's species names resolve against taxa.csv and
// species-aliases.csv, without importing anything.
//
// Run it before an import. An unrecognised name is not an error — it is a line
// to add to species-aliases.csv, or a taxon to add to taxa.csv — but finding
// out afterwards means finding out from a map with holes in it.
//
// Usage:
//   node scripts/check-species.mjs <file.csv|file.geojson> [column]
//
// The column defaults to the first of species / botanic / Species / scientific_name
// that the file actually has. GeoJSON is read from feature properties.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import { buildSpeciesLookup, classifyNames } from './lib/species.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [file, column] = process.argv.slice(2);
if (!file) {
  console.error('usage: node scripts/check-species.mjs <file.csv|file.geojson> [column]');
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`✗ no such file: ${file}`);
  process.exit(1);
}

const csv = (path) => Papa.parse(readFileSync(path, 'utf8'), {
  header: true, delimiter: ',', skipEmptyLines: 'greedy',
  transformHeader: (h) => h.trim().replace(/^﻿/, ''),
}).data;

const { lookup, conflicts } = buildSpeciesLookup(
  csv(join(root, 'data', 'taxa.csv')),
  csv(join(root, 'data', 'species-aliases.csv')),
);
for (const c of conflicts) console.warn(`  ! alias "${c.alias}": ${c.reason}`);

const CANDIDATES = ['botanic', 'botanical', 'Botanical', 'scientific_name', 'species', 'Species', 'common', 'common_name'];
const rows = file.endsWith('.geojson') || file.endsWith('.json')
  ? (JSON.parse(readFileSync(file, 'utf8')).features ?? []).map((f) => f.properties ?? {})
  : csv(file);

if (rows.length === 0) {
  console.error('✗ no rows in that file');
  process.exit(1);
}
const columns = Object.keys(rows[0]);
if (column && !columns.includes(column)) {
  console.error(`✗ no column "${column}" in that file. Columns are: ${columns.join(', ')}`);
  process.exit(1);
}

const tally = (name) => {
  const counts = new Map();
  for (const row of rows) {
    const value = String(row[name] ?? '').trim();
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
};

/**
 * Pick the column that resolves best rather than the first one that exists.
 * Burlington's inventory has both a `species` column holding "ash,gr patmore"
 * and a `botanic` column holding "Fraxinus pennsylvanica 'Patmore'"; a fixed
 * priority order picked the first and reported 2.7% coverage on a file that
 * actually reaches 59%.
 */
function chooseColumn() {
  if (column) return column;
  let best = null;
  for (const name of CANDIDATES.filter((c) => columns.includes(c))) {
    const counts = tally(name);
    if (counts.size === 0) continue;
    const { resolved } = classifyNames([...counts.keys()], lookup);
    const hits = [...resolved.keys()].reduce((sum, n) => sum + counts.get(n), 0);
    if (!best || hits > best.hits) best = { name, hits };
  }
  return best?.name;
}

const field = chooseColumn();
if (!field) {
  console.error(`✗ no species column found. Columns are: ${columns.join(', ')}`);
  console.error('  Pass one as the second argument.');
  process.exit(1);
}

const counts = tally(field);
const { resolved, unresolved, unknown } = classifyNames([...counts.keys()], lookup);
const records = (names) => names.reduce((sum, n) => sum + (counts.get(n) ?? 0), 0);
const pct = (n) => `${((n / rows.length) * 100).toFixed(1)}%`;

console.log(`\n${file} · column "${field}"${column ? '' : ' (chosen as the best-resolving)'} · ${rows.length} rows, ${counts.size} distinct names\n`);
console.log(`  resolved             ${String(resolved.size).padStart(4)} names  ${String(records([...resolved.keys()])).padStart(6)} records  ${pct(records([...resolved.keys()]))}`);
console.log(`  known unresolvable   ${String(unresolved.length).padStart(4)} names  ${String(records(unresolved)).padStart(6)} records`);
console.log(`  not yet seen         ${String(unknown.length).padStart(4)} names  ${String(records(unknown)).padStart(6)} records`);

if (unresolved.length) {
  console.log('\nDeliberately unresolved (a blank taxon_id in species-aliases.csv):');
  for (const n of unresolved) console.log(`  ${String(counts.get(n)).padStart(5)}  ${n}`);
}
if (unknown.length) {
  console.log('\nNot yet seen — add each to species-aliases.csv, or to taxa.csv:');
  const sorted = unknown.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
  for (const n of sorted.slice(0, 40)) console.log(`  ${String(counts.get(n)).padStart(5)}  ${n}`);
  if (sorted.length > 40) console.log(`  …and ${sorted.length - 40} more`);
  console.log('\nPaste-ready alias lines:');
  for (const n of sorted.slice(0, 40)) console.log(`${n.includes(',') ? `"${n}"` : n},,`);
}
