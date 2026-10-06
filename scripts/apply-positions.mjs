#!/usr/bin/env node
// Applies position corrections exported from /positions/ to data/plants.csv.
//
// Not a visit: lat, lng and geolocation_notes change (and collection_id if a
// tree crosses a campus boundary); observations.csv is not touched, so the
// public map's survey dates and history stay as they were.
//
// Usage:
//   npm run positions -- positions-2026-10-06.csv            # dry run
//   npm run positions -- positions-2026-10-06.csv --write    # apply
//
// Refuses to write anything if any row has an error, like the other importers.

import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import { applyPositions } from './lib/positions.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const plantsPath = join(dataDir, 'plants.csv');
const args = process.argv.slice(2);
const write = args.includes('--write');
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('Usage: npm run positions -- <positions.csv> [--write]');
  process.exit(1);
}

const parse = (text) => Papa.parse(text, { header: true, delimiter: ',', skipEmptyLines: 'greedy', transformHeader: (h) => h.trim() });
const plants = parse(readFileSync(plantsPath, 'utf8'));
const moves = parse(readFileSync(resolve(file), 'utf8'));
const config = JSON.parse(readFileSync(join(dataDir, 'config.json'), 'utf8'));
const areas = JSON.parse(readFileSync(join(dataDir, 'campus-areas.geojson'), 'utf8'));

console.log(`\nRead ${moves.data.length} move(s) from ${file}`);
const { updates, issues } = applyPositions(plants.data, moves.data, { bounds: config.map.bounds, areas });

const errors = issues.filter((i) => i.level === 'error');
const warnings = issues.filter((i) => i.level === 'warning');

if (updates.length) {
  console.log(`\n${updates.length} position(s) to correct:`);
  for (const u of updates) {
    console.log(`  ${u.plant_id.padEnd(9)} ${u.metres.toFixed(1).padStart(6)} m  →  ${u.changes.lat}, ${u.changes.lng}`);
  }
  const total = updates.reduce((s, u) => s + u.metres, 0);
  console.log(`  median ${[...updates].sort((a, b) => a.metres - b.metres)[updates.length >> 1].metres.toFixed(1)} m, ` +
    `largest ${Math.max(...updates.map((u) => u.metres)).toFixed(1)} m, ${total.toFixed(0)} m in all`);
}
for (const w of warnings) console.log(`  ! ${w.message}`);
for (const e of errors) console.log(`  ✗ ${e.message}`);

console.log(`\n${updates.length} correction(s), ${errors.length} error(s), ${warnings.length} warning(s)`);
console.log('No survey visits are recorded: observations.csv is not touched.');

if (errors.length) {
  console.log('\nNothing written. Fix the errors above and run again.');
  process.exit(1);
}
if (!write) {
  console.log('\nDry run — nothing written. Re-run with --write to apply.');
  process.exit(0);
}
if (!updates.length) {
  console.log('\nNothing to write.');
  process.exit(0);
}

copyFileSync(plantsPath, `${plantsPath}.bak`);
const byId = new Map(updates.map((u) => [u.plant_id, u.changes]));
const rows = plants.data.map((row) => {
  const changes = byId.get(String(row.plant_id ?? '').trim());
  return changes ? { ...row, ...changes } : row;
});
// newline '\n' like every other writer here — see import-survey.mjs.
writeFileSync(plantsPath, Papa.unparse(rows, { columns: plants.meta.fields, newline: '\n' }) + '\n');
console.log(`\n✓ data/plants.csv updated (previous version saved as .bak)\n  Next: npm run data`);
