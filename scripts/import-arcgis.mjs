#!/usr/bin/env node
// Loads UVM's ArcGIS tree layer into data/plants.csv and data/observations.csv.
//
//   npm run import:arcgis -- query.geojson            # dry run, writes nothing
//   npm run import:arcgis -- query.geojson --write    # apply
//
// Dry run is the default, as with `npm run import`: 2,061 rows is far too many
// to eyeball in a diff, so the report has to be the thing you read.
//
// The source file is not committed. It is UVM's data, shared for this purpose,
// and the fields naming the surveyor are dropped on the way in rather than
// carried into a public repository.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

import { buildSpeciesLookup } from './lib/species.mjs';
import { importArcgis } from './lib/arcgis.mjs';
import { PLANT_COLUMNS, OBSERVATION_COLUMNS } from './lib/vocab.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const plantsPath = join(root, 'data', 'plants.csv');
const observationsPath = join(root, 'data', 'observations.csv');

const argv = process.argv.slice(2);
const input = argv.find((a) => !a.startsWith('--'));
const write = argv.includes('--write');
const surveyor = (argv.find((a) => a.startsWith('--surveyor=')) ?? '--surveyor=EC').split('=')[1];

if (!input) {
  console.error('Usage: npm run import:arcgis -- <layer.geojson> [--write] [--surveyor=XX]');
  process.exit(1);
}

const parse = (path) => {
  const out = Papa.parse(readFileSync(path, 'utf8').trim(), { header: true, skipEmptyLines: true });
  return { rows: out.data, headers: out.meta.fields };
};

const source = JSON.parse(readFileSync(resolve(process.cwd(), input), 'utf8'));
const features = source.features ?? [];
const plants = parse(plantsPath);
const observations = parse(observationsPath);
const taxa = parse(join(root, 'data', 'taxa.csv'));
const aliases = parse(join(root, 'data', 'species-aliases.csv'));
const campusAreas = JSON.parse(readFileSync(join(root, 'data', 'campus-areas.geojson'), 'utf8'));

const result = importArcgis({
  features,
  plants: plants.rows,
  observations: observations.rows,
  speciesLookup: buildSpeciesLookup(taxa.rows, aliases.rows).lookup,
  campusAreas,
  surveyor,
});

// ---- report ---------------------------------------------------------------

const s = result.summary;
console.log(`\n${input} · ${s.read} features\n`);
console.log(`  new plants          ${s.inserted}`);
console.log(`  new observations    ${s.observed}`);
console.log(`  already on file     ${s.matchedExisting} matched an accession we already had`);
console.log(`  tagged / untagged   ${s.tagged} kept their tag number, ${s.untagged} issued from the new block`);
if (s.noCollection) console.log(`  outside the boundary ${s.noCollection} plants have no campus area`);

if (result.skipped.length) {
  console.log(`\nSkipped ${result.skipped.length} — a tree needs a species before it can have a record:`);
  for (const x of result.skipped) console.log(`  OBJECTID ${x.objectId}: ${x.reason} — ${x.detail}`);
}

if (result.conflicts.length) {
  console.log(`\nDisagreements with what is already on file (nothing was overwritten):`);
  for (const c of result.conflicts) console.log(`  ${c.plant_id} ${c.kind}: ${c.message}`);
}

const flagged = result.observations.filter((o) => o.notes);
if (flagged.length) {
  console.log(`\nFlagged for an in-person check (${flagged.length}):`);
  for (const o of flagged.slice(0, 20)) console.log(`  ${o.plant_id}: ${o.notes}`);
  if (flagged.length > 20) console.log(`  … and ${flagged.length - 20} more`);
}

if (!write) {
  console.log('\nDry run — nothing written. Re-run with --write to apply.\n');
  process.exit(0);
}

// ---- write ----------------------------------------------------------------

const csv = (columns, rows) =>
  Papa.unparse(rows.map((r) => Object.fromEntries(columns.map((c) => [c, r[c] ?? '']))), {
    columns,
    newline: '\n',
  });

// Existing rows are rewritten verbatim through the same column order, so the
// file's shape is the importer's business and the diff shows only additions.
writeFileSync(plantsPath, `${csv(PLANT_COLUMNS, [...plants.rows, ...result.inserts])}\n`);
writeFileSync(
  observationsPath,
  `${csv(OBSERVATION_COLUMNS, [...observations.rows, ...result.observations])}\n`,
);

console.log(`\nWrote ${result.inserts.length} plants and ${result.observations.length} observations.\n`);
