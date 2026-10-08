#!/usr/bin/env node
// Brings i-Tree Eco's per-tree results back into data/itree-city-trees.csv.
//
// The other half of `npm run itree:export`. The file comes from i-Tree Eco:
// Reports → Individual Level Results → Tree Benefits and Costs → Summary, with
// User Tree ID ticked, saved as CSV. Every row is checked against
// data/city-trees.csv — the ID, the position and the DBH i-Tree was sent — and
// nothing is written unless all of them agree. See docs/ITREE.md.
//
// Usage:
//   npm run itree:import -- path/to/Tree_BenefitsCosts_Summary.csv
//
// The run's settings (version, weather year, stations, prices) are not in the
// file, so they are kept by hand in data/itree-run.json. Update it with each run.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import { readItreeResults, ITREE_RESULT_COLUMNS } from './lib/itree.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2];
if (!input) {
  console.error('Usage: npm run itree:import -- path/to/Tree_BenefitsCosts_Summary.csv');
  process.exit(1);
}

const parse = (p) => Papa.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''), { header: true, skipEmptyLines: 'greedy' }).data;
const cityRows = parse(join(root, 'data', 'city-trees.csv'));
const { rows, errors } = readItreeResults(parse(resolve(input)), cityRows);

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s); nothing was written:`);
  for (const e of errors.slice(0, 20)) console.error(`  ${e}`);
  process.exit(1);
}

const out = join(root, 'data', 'itree-city-trees.csv');
writeFileSync(out, Papa.unparse(rows, { columns: ITREE_RESULT_COLUMNS.map(([, key]) => key), newline: '\n' }) + '\n');

const sum = (key) => rows.reduce((a, r) => a + Number(r[key]), 0);
const fmt = (n, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
console.log(`\n✓ ${rows.length} trees written to data/itree-city-trees.csv — every one matched by ID, position and DBH`);
console.log(`  carbon stored           ${fmt(sum('carbon_storage_lb'))} lb`);
console.log(`  carbon taken up         ${fmt(sum('carbon_sequestration_lb_yr'))} lb/yr`);
console.log(`  runoff avoided          ${fmt(sum('avoided_runoff_gal_yr'))} gal/yr`);
console.log(`  pollution removed       ${fmt(sum('pollution_removal_oz_yr'), 1)} oz/yr`);
console.log(`  yearly benefits         $${fmt(sum('total_benefits_usd_yr'), 2)}/yr`);
console.log(`  replacement value       $${fmt(sum('replacement_usd'), 2)}`);
console.log('\nCheck data/itree-run.json describes this run, then `npm run data`.');
