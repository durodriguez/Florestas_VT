#!/usr/bin/env node
// Merges a field-survey export into data/plants.csv.
//
//   npm run import -- survey/field-template.csv            # dry run, writes nothing
//   npm run import -- survey/2026-09-green.csv --write     # apply
//   npm run import -- export.csv --out review.csv          # stage for review
//   npm run import -- export.csv --year 2026 --write
//   npm run import -- field.csv --adopt-tags --write   # first survey of tagged trees
//
// Dry run is the default on purpose: you see exactly what would change, and
// what it could not read, before anything touches the dataset.

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import { importSurvey, taxaStubs } from './lib/import.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const plantsPath = join(root, 'data', 'plants.csv');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i > -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const VALUE_FLAGS = ['out', 'year', 'mapping', 'duplicate-meters'];
const positional = argv.filter((a, i) => {
  if (a.startsWith('--')) return false;
  const prev = argv[i - 1];
  return !(prev?.startsWith('--') && VALUE_FLAGS.includes(prev.slice(2)));
});
const input = positional[0];

if (!input) {
  console.error('Usage: npm run import -- <field-export.csv> [--write] [--out file.csv] [--year 2026]');
  process.exit(1);
}
const inputPath = resolve(root, input);
if (!existsSync(inputPath)) {
  console.error(`✗ no such file: ${input}`);
  process.exit(1);
}

const parse = (path) => {
  const out = Papa.parse(readFileSync(path, 'utf8'), {
    header: true,
    // Stated rather than sniffed: a header-only file (an emptied collections
    // list, say) gives Papa nothing to detect a delimiter from and it errors.
    delimiter: ',',
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });
  return { rows: out.data, headers: out.meta.fields ?? [] };
};

const field = parse(inputPath);
const plants = parse(plantsPath);
const mappingPath = resolve(root, opt('mapping', 'survey/mapping.json'));

const result = importSurvey({
  rows: field.rows,
  headers: field.headers,
  mapping: JSON.parse(readFileSync(mappingPath, 'utf8')),
  taxaRows: parse(join(root, 'data', 'taxa.csv')).rows,
  plantRows: plants.rows,
  collectionRows: parse(join(root, 'data', 'collections.csv')).rows,
  config: JSON.parse(readFileSync(join(root, 'data', 'config.json'), 'utf8')),
  year: Number(opt('year', new Date().getFullYear())),
  duplicateMeters: flag('allow-duplicates') ? 0 : Number(opt('duplicate-meters', 2)),
  adoptTags: flag('adopt-tags'),
});

// ---- report --------------------------------------------------------------

const s = result.summary;
console.log(`\nRead ${s.read} row(s) from ${input}`);

const mappedCount = Object.keys(result.resolved).length;
console.log(`  matched ${mappedCount} column(s): ${Object.entries(result.resolved).map(([f, h]) => `${h}→${f}`).join(', ')}`);
if (result.unmapped.length) {
  console.log(`  ignored ${result.unmapped.length} unrecognised column(s): ${result.unmapped.join(', ')}`);
  console.log('    (add them to survey/mapping.json if they should be imported)');
}

for (const issue of result.issues) {
  const mark = issue.level === 'error' ? '✗' : '!';
  // row 0 means the issue is about the file as a whole, not one line.
  console.log(`  ${mark} ${issue.row > 0 ? `row ${issue.row}: ` : ''}${issue.message}`);
}

if (result.unknownSpecies.size) {
  console.log(`\n${result.unknownSpecies.size} species not in taxa.csv. Add these rows first:`);
  for (const stub of taxaStubs(result.unknownSpecies)) console.log(`  ${stub}`);
  console.log('  (fill in family, genus, species and habit — see docs/DATA-MODEL.md)');
}

if (result.updates.length) {
  console.log(`\n${result.updates.length} re-survey update(s):`);
  for (const u of result.updates) {
    const diff = Object.entries(u.changes).map(([k, v]) => `${k}=${v}`).join(', ');
    console.log(`  ${u.plant_id}: ${diff}`);
  }
}

if (result.inserts.length) {
  console.log(`\n${result.inserts.length} new accession(s): ${result.inserts[0].plant_id} … ${result.inserts.at(-1).plant_id}`);
}

console.log(
  `\n${s.inserts} insert(s), ${s.updates} update(s), ` +
  `${s.errors} error(s), ${s.warnings} warning(s)`,
);

// A row that errored was skipped entirely. Importing the rest would quietly
// leave trees out of the dataset, so refuse until they are fixed.
if (s.errors > 0) {
  console.error('\n✗ Nothing was written. Fix the rows above and run again.');
  process.exit(1);
}

if (s.inserts === 0 && s.updates === 0) {
  console.log('\nNothing to import.');
  process.exit(0);
}

// ---- write ---------------------------------------------------------------

const header = plants.headers;
const blankRow = Object.fromEntries(header.map((h) => [h, '']));
const newRows = result.inserts.map((r) => ({ ...blankRow, ...r }));

const outPath = opt('out') ? resolve(root, opt('out')) : plantsPath;

if (!flag('write') && !opt('out')) {
  console.log('\nDry run — nothing written. Re-run with --write to apply,');
  console.log('or --out <file.csv> to stage the result for review first.');
  process.exit(0);
}

if (outPath === plantsPath) copyFileSync(plantsPath, `${plantsPath}.bak`);

if (result.updates.length > 0) {
  // Updates touch existing lines, so the file has to be rewritten as a whole.
  const byId = new Map(result.updates.map((u) => [u.plant_id, u.changes]));
  const merged = plants.rows.map((row) => {
    const changes = byId.get(row.plant_id?.trim());
    return changes ? { ...row, ...changes } : row;
  });
  writeFileSync(outPath, Papa.unparse([...merged, ...newRows], { columns: header }) + '\n');
} else {
  // Inserts only — append so the diff shows just the new lines.
  const lines = Papa.unparse(newRows, { columns: header, header: false });
  const current = readFileSync(plantsPath, 'utf8');
  writeFileSync(outPath, current.replace(/\n*$/, '\n') + lines + '\n');
}

if (outPath === plantsPath) {
  console.log(`\n✓ data/plants.csv updated (previous version saved as plants.csv.bak)`);
} else {
  console.log(`\n✓ wrote ${opt('out')} — review it, then copy over data/plants.csv`);
}
console.log('  Next: npm run data');
