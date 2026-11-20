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
const renumberedPath = join(root, 'data', 'renumbered.csv');

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
  campusAreas: JSON.parse(readFileSync(join(root, 'data', 'campus-areas.geojson'), 'utf8')),
  config: JSON.parse(readFileSync(join(root, 'data', 'config.json'), 'utf8')),
  renumberedRows: existsSync(renumberedPath) ? parse(renumberedPath).rows : [],
  year: Number(opt('year', new Date().getFullYear())),
  duplicateMeters: flag('allow-duplicates') ? 0 : Number(opt('duplicate-meters', 2)),
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

if (result.renumbers.length) {
  console.log(`\n${result.renumbers.length} tree(s) renumbered to match the tag read off the trunk:`);
  for (const r of result.renumbers) console.log(`  ${r.from} → ${r.to} (tag ${r.tag})`);
  console.log('  Their earlier visits move with them, and data/renumbered.csv records the change.');
}

if (result.observations.length) {
  const dates = [...new Set(result.observations.map((o) => o.surveyed_on))].sort();
  console.log(
    `\n${result.observations.length} observation(s) to append` +
    `${dates.length === 1 ? `, all dated ${dates[0]}` : `, dated ${dates[0]} – ${dates.at(-1)}`}`,
  );
}

// Rows that were already on file, word for word. Reported rather than passed
// over in silence — "5 of 12 imported" should never leave somebody wondering
// where the other seven went — but counted apart from the errors, because
// there is nothing here to fix.
if (result.reimported.length) {
  // Recognised either by accession or, for a tree with no tag, by its photo.
  const trees = [...new Set(result.reimported.map((o) => o.plant_id ?? o.photo))];
  console.log(
    `\n${result.reimported.length} row(s) already on file, unchanged — skipped:`,
  );
  console.log(`  ${trees.slice(0, 12).join(', ')}${trees.length > 12 ? ` … and ${trees.length - 12} more` : ''}`);
  console.log('  The field app exports everything it has saved, so this is expected.');
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
  `${s.renumbers ? `${s.renumbers} renumbered, ` : ''}` +
  `${s.reimported} already on file, ${s.errors} error(s), ${s.warnings} warning(s)`,
);

// A row that errored was skipped entirely. Importing the rest would quietly
// leave trees out of the dataset, so refuse until they are fixed.
if (s.errors > 0) {
  console.error('\n✗ Nothing was written. Fix the rows above and run again.');
  process.exit(1);
}

if (s.inserts === 0 && s.updates === 0 && s.observations === 0 && s.renumbers === 0) {
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
  if (result.renumbers.length) {
    console.error('\n✗ This file renumbers trees, which rewrites lines already in data/; stage it with --write on a branch instead of --out.');
    process.exit(1);
  }
  writeFileSync(outPath, Papa.unparse([...plants.rows, ...newRows], { columns: header, newline: '\n' }) + '\n');
  const stem = outPath.replace(/\.csv$/i, '');
  const obsOut = `${stem}-observations.csv`;
  writeFileSync(
    obsOut,
    Papa.unparse(result.observations, { columns: OBSERVATION_COLUMNS, newline: '\n' }) + '\n',
  );
  console.log(`\n✓ wrote ${opt('out')} and ${obsOut.slice(root.length + 1)} — review, then copy over data/`);
  console.log('  Note: the observations file holds only the new rows, to append.');
  process.exit(0);
}

copyFileSync(plantsPath, `${plantsPath}.bak`);
copyFileSync(observationsPath, `${observationsPath}.bak`);

// A renumbered tree's line takes its new accession and its tag before the
// corrections are applied, since they are filed under the new number.
for (const r of result.renumbers) {
  const row = plants.rows.find((p) => p.plant_id?.trim() === r.from);
  if (!row || row.tag?.trim()) throw new Error(`${r.from} is not on file without a tag; not renumbering it`);
  row.plant_id = r.to;
  row.tag = r.tag;
}

if (result.updates.length > 0 || result.renumbers.length > 0) {
  // Every write here says newline: '\n'. Papa's default is \r\n, while every
  // other script writes \n, and a file holding both is misread by the next
  // script to parse it: a bare \n at the end of a \r\n file becomes part of
  // the last field. That is how six plants came to have a source_id of "\n".
  // Corrections touch existing lines, so the file has to be rewritten whole.
  const byId = new Map(result.updates.map((u) => [u.plant_id, u.changes]));
  const merged = plants.rows.map((row) => {
    const changes = byId.get(row.plant_id?.trim());
    return changes ? { ...row, ...changes } : row;
  });
  writeFileSync(plantsPath, Papa.unparse([...merged, ...newRows], { columns: header, newline: '\n' }) + '\n');
} else if (newRows.length > 0) {
  // Inserts only — append so the diff shows just the new lines.
  const lines = Papa.unparse(newRows, { columns: header, header: false, newline: '\n' });
  writeFileSync(plantsPath, readFileSync(plantsPath, 'utf8').replace(/\n*$/, '\n') + lines + '\n');
}

// Observations are only ever appended. Nothing already in the file is read,
// rewritten or reordered, which is what keeps a past survey a past survey.
if (result.observations.length > 0) {
  const lines = Papa.unparse(result.observations, { columns: OBSERVATION_COLUMNS, header: false, newline: '\n' });
  writeFileSync(
    observationsPath,
    readFileSync(observationsPath, 'utf8').replace(/\n*$/, '\n') + lines + '\n',
  );
}

// Renumbering, the rest: the tree's earlier visits in observations.csv are
// filed under its new accession (the visits themselves are untouched), and
// data/renumbered.csv records old → new, so an old link or a later export
// carrying the old number still reaches it.
if (result.renumbers.length > 0) {
  const relabel = (path, fix) => {
    const lines = readFileSync(path, 'utf8').split('\n');
    writeFileSync(path, lines.map((line) => {
      for (const r of result.renumbers) if (line.startsWith(`${r.from},`)) return fix(line, r);
      return line;
    }).join('\n'));
  };
  relabel(observationsPath, (line, r) => `${r.to}${line.slice(r.from.length)}`);
  const on = new Date().toISOString().slice(0, 10);
  const rows = result.renumbers.map((r) => ({
    old_id: r.from, new_id: r.to, renumbered_on: on,
    reason: `Wears tag ${r.tag}; renumbered to match it by the survey importer`,
  }));
  const lines = Papa.unparse(rows, { columns: ['old_id', 'new_id', 'renumbered_on', 'reason'], header: !existsSync(renumberedPath), newline: '\n' });
  writeFileSync(renumberedPath, (existsSync(renumberedPath) ? readFileSync(renumberedPath, 'utf8').replace(/\n*$/, '\n') : '') + lines + '\n');
}

console.log(`\n✓ data/plants.csv and data/observations.csv${result.renumbers.length ? ' and data/renumbered.csv' : ''} updated (previous versions saved as .bak)`);
console.log('  Next: npm run data');
