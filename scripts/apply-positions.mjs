#!/usr/bin/env node
// Applies position corrections exported from /positions/ to data/plants.csv,
// and trees marked as not there to data/observations.csv.
//
// A move is not a visit: lat, lng and geolocation_notes change (and
// collection_id if a tree crosses a campus boundary); the public map's survey
// dates and history stay as they were. A deletion is the one thing written to
// observations.csv: a `not-found` row, which takes the tree off the map and
// keeps everything it had.
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
import { applyPositions, currentStatus } from './lib/positions.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const plantsPath = join(dataDir, 'plants.csv');
const observationsPath = join(dataDir, 'observations.csv');
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
const observations = parse(readFileSync(observationsPath, 'utf8'));
const config = JSON.parse(readFileSync(join(dataDir, 'config.json'), 'utf8'));
const areas = JSON.parse(readFileSync(join(dataDir, 'campus-areas.geojson'), 'utf8'));

console.log(`\nRead ${moves.data.length} row(s) from ${file}`);
const { updates, removals, issues } = applyPositions(plants.data, moves.data, {
  bounds: config.map.bounds, areas, statusOf: currentStatus(observations.data),
});

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
if (removals.length) {
  console.log(`\n${removals.length} tree(s) marked as not there (a not-found observation each):`);
  console.log(`  ${removals.map((r) => r.plant_id).join(', ')}`);
}
for (const w of warnings) console.log(`  ! ${w.message}`);
for (const e of errors) console.log(`  ✗ ${e.message}`);

console.log(`\n${updates.length} correction(s), ${removals.length} not there, ${errors.length} error(s), ${warnings.length} warning(s)`);
console.log(removals.length
  ? 'Moves record no survey visit; only the trees marked not there get an observation.'
  : 'No survey visits are recorded: observations.csv is not touched.');

if (errors.length) {
  console.log('\nNothing written. Fix the errors above and run again.');
  process.exit(1);
}
if (!write) {
  console.log('\nDry run — nothing written. Re-run with --write to apply.');
  process.exit(0);
}
if (!updates.length && !removals.length) {
  console.log('\nNothing to write.');
  process.exit(0);
}

if (updates.length) {
  copyFileSync(plantsPath, `${plantsPath}.bak`);
  const byId = new Map(updates.map((u) => [u.plant_id, u.changes]));
  const rows = plants.data.map((row) => {
    const changes = byId.get(String(row.plant_id ?? '').trim());
    return changes ? { ...row, ...changes } : row;
  });
  // newline '\n' like every other writer here — see import-survey.mjs.
  writeFileSync(plantsPath, Papa.unparse(rows, { columns: plants.meta.fields, newline: '\n' }) + '\n');
  console.log(`\n✓ data/plants.csv updated (previous version saved as .bak)`);
}
if (removals.length) {
  copyFileSync(observationsPath, `${observationsPath}.bak`);
  const fallback = new Date().toISOString().slice(0, 10);
  const added = removals.map((r) => ({
    plant_id: r.plant_id,
    surveyed_on: r.on || fallback,
    status: 'not-found',
    notes: `No tree here on imagery: marked not there in /positions/${r.on ? ` on ${r.on}` : ''}.`,
  }));
  // Appended, not rewritten: every existing line stays byte for byte.
  const text = readFileSync(observationsPath, 'utf8');
  const lines = Papa.unparse(added, { columns: observations.meta.fields, header: false, newline: '\n' });
  writeFileSync(observationsPath, `${text}${text.endsWith('\n') ? '' : '\n'}${lines}\n`);
  console.log(`✓ data/observations.csv: ${added.length} not-found observation(s) added (previous version saved as .bak)`);
}
console.log('  Next: npm run data');
