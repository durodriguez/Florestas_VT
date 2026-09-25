#!/usr/bin/env node
// Clips Burlington's street-tree inventory to the campus boundary and writes
// data/city-trees.csv.
//
//   npm run import:city -- Tree_Sites_Public_View.csv            # dry run
//   npm run import:city -- Tree_Sites_Public_View.csv --write    # apply
//
// Burlington's export is open data and changes on its own schedule, so this is
// a refresh rather than a merge: the file is rewritten from the source every
// time. Nothing here is hand-edited, which is why rewriting it is safe.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

import { buildSpeciesLookup } from './lib/species.mjs';
import { importCityTrees, CITY_TREE_COLUMNS } from './lib/city-trees.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'data', 'city-trees.csv');

const argv = process.argv.slice(2);
const input = argv.find((a) => !a.startsWith('--'));
const write = argv.includes('--write');

if (!input) {
  console.error('Usage: npm run import:city -- <Tree_Sites_Public_View.csv> [--write]');
  process.exit(1);
}

const parse = (path) =>
  Papa.parse(readFileSync(path, 'utf8').trim(), { header: true, skipEmptyLines: true }).data;

const rows = parse(resolve(process.cwd(), input));
const species = buildSpeciesLookup(
  parse(join(root, 'data', 'taxa.csv')),
  parse(join(root, 'data', 'species-aliases.csv')),
);
const campusAreas = JSON.parse(readFileSync(join(root, 'data', 'campus-areas.geojson'), 'utf8'));

const result = importCityTrees({ rows, speciesLookup: species.lookup, campusAreas });
const s = result.summary;

console.log(`\n${input} · ${s.read} rows\n`);
console.log(`  outside the campus boundary  ${s.offCampus} (not this project's business)`);
console.log(`  inside, but not imported     ${s.skipped}`);
console.log(`  kept                         ${s.kept} standing street trees`);
console.log(`  of those, with a diameter    ${s.withDbh}`);
console.log(`  with a height                ${s.withHeight}`);
console.log(`  with a crown spread          ${s.withSpread}`);
console.log(`  with a planting year         ${s.withYear}`);
console.log('');
for (const [area, n] of Object.entries(s.byArea).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(5)}  ${area}`);
}

if (Object.keys(result.skipped).length) {
  console.log('\nInside the boundary and left out:');
  for (const [reason, n] of Object.entries(result.skipped).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${reason}`);
  }
}

if (result.unknownSpecies.size) {
  // Not fatal: a city tree of an unknown species is left out rather than
  // blocking the clip, but it is worth an alias line.
  console.log('\nSpecies names not in taxa.csv — add each to species-aliases.csv:');
  for (const [name, n] of [...result.unknownSpecies].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${name}`);
  }
}

if (!write) {
  console.log('\nDry run — nothing written. Re-run with --write to apply.\n');
  process.exit(0);
}

writeFileSync(
  outPath,
  `${Papa.unparse(result.inserts, { columns: CITY_TREE_COLUMNS, newline: '\n' })}\n`,
);
console.log(`\nWrote ${result.inserts.length} city trees to data/city-trees.csv\n`);
