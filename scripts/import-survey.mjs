#!/usr/bin/env node
// Merges a field-survey export into data/plants.csv and data/observations.csv.
//
// A new tree gets a row in plants.csv; every visit — to a new tree or one
// already on file — is appended to observations.csv. Re-measuring a tree is
// therefore never an edit: nothing already recorded is overwritten.
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
import { OBSERVATION_COLUMNS, QA_NOTE } from './lib/vocab.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const plantsPath = join(root, 'data', 'plants.csv');
const observationsPath = join(root, 'data', 'observations.csv');

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
const existingObservations = parse(observationsPath);
const mappingPath = resolve(root, opt('mapping', 'survey/mapping.json'));

const result = importSurvey({
  rows: field.rows,
  headers: field.headers,
  mapping: JSON.parse(readFileSync(mappingPath, 'utf8')),
  taxaRows: parse(join(root, 'data', 'taxa.csv')).rows,
  plantRows: plants.rows,
  observationRows: existingObservations.rows,
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
  console.log('  (fill in family, genus, species and plant_type — see docs/DATA-MODEL.md)');
}

if (result.updates.length) {
  console.log(`\n${result.updates.length} correction(s) to what a plant is:`);
  for (const u of result.updates) {
    const diff = Object.entries(u.changes).map(([k, v]) => `${k}=${v}`).join(', ');
    console.log(`  ${u.plant_id}: ${diff}`);
  }
}

if (result.observations.length) {
  const dates = [...new Set(result.observations.map((o) => o.surveyed_on))].sort();
  console.log(
    `\n${result.observations.length} observation(s) to append` +
    `${dates.length === 1 ? `, all dated ${dates[0]}` : `, dated ${dates[0]} – ${dates.at(-1)}`}`,
  );
}

// Notes the survey app addressed to whoever is at this desk. They are in the
// CSV either way, but a species correction buried in a cell is a species
// correction nobody acts on.
const deskNotes = result.observations.flatMap((o) =>
  String(o.notes ?? '')
    .split('. ')
    .map((part) => part.trim())
    .filter((part) => QA_NOTE.test(part))
    .map((part) => `  ${o.plant_id}: ${part}`),
);
if (deskNotes.length) {
  console.log(`\n${deskNotes.length} note(s) for review:`);
  for (const note of deskNotes) console.log(note);
}

if (result.inserts.length) {
  console.log(`\n${result.inserts.length} new accession(s): ${result.inserts[0].plant_id} … ${result.inserts.at(-1).plant_id}`);
}

console.log(
  `\n${s.inserts} new plant(s), ${s.observations} observation(s), ${s.updates} correction(s), ` +
  `${s.errors} error(s), ${s.warnings} warning(s)`,
);

// A row that errored was skipped entirely. Importing the rest would quietly
// leave trees out of the dataset, so refuse until they are fixed.
if (s.errors > 0) {
  console.error('\n✗ Nothing was written. Fix the rows above and run again.');
  process.exit(1);
}

if (s.inserts === 0 && s.updates === 0 && s.observations === 0) {
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

// Staging to --out writes one file for review, so both halves have to go in it
// — splitting them would hand back a plants file whose observations vanished.
if (outPath !== plantsPath) {
  writeFileSync(outPath, Papa.unparse([...plants.rows, ...newRows], { columns: header }) + '\n');
  const stem = outPath.replace(/\.csv$/i, '');
  const obsOut = `${stem}-observations.csv`;
  writeFileSync(
    obsOut,
    Papa.unparse(result.observations, { columns: OBSERVATION_COLUMNS }) + '\n',
  );
  console.log(`\n✓ wrote ${opt('out')} and ${obsOut.slice(root.length + 1)} — review, then copy over data/`);
  console.log('  Note: the observations file holds only the new rows, to append.');
  process.exit(0);
}

copyFileSync(plantsPath, `${plantsPath}.bak`);
copyFileSync(observationsPath, `${observationsPath}.bak`);

if (result.updates.length > 0) {
  // Corrections touch existing lines, so the file has to be rewritten whole.
  const byId = new Map(result.updates.map((u) => [u.plant_id, u.changes]));
  const merged = plants.rows.map((row) => {
    const changes = byId.get(row.plant_id?.trim());
    return changes ? { ...row, ...changes } : row;
  });
  writeFileSync(plantsPath, Papa.unparse([...merged, ...newRows], { columns: header }) + '\n');
} else if (newRows.length > 0) {
  // Inserts only — append so the diff shows just the new lines.
  const lines = Papa.unparse(newRows, { columns: header, header: false });
  writeFileSync(plantsPath, readFileSync(plantsPath, 'utf8').replace(/\n*$/, '\n') + lines + '\n');
}

// Observations are only ever appended. Nothing already in the file is read,
// rewritten or reordered, which is what keeps a past survey a past survey.
if (result.observations.length > 0) {
  const lines = Papa.unparse(result.observations, { columns: OBSERVATION_COLUMNS, header: false });
  writeFileSync(
    observationsPath,
    readFileSync(observationsPath, 'utf8').replace(/\n*$/, '\n') + lines + '\n',
  );
}

console.log('\n✓ data/plants.csv and data/observations.csv updated (previous versions saved as .bak)');
console.log('  Next: npm run data');
