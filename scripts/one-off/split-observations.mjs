#!/usr/bin/env node
// One-off: split data/plants.csv into an identity file and an observations file.
//
// Before: one row per tree, holding both what the tree is and what the last
// surveyor measured — so a re-survey overwrote the previous measurements and
// the growth between them was lost.
//
// After: plants.csv keeps identity, observations.csv gets one row per tree per
// visit, appended and never overwritten.
//
// Kept for provenance. Run once, on 11 September 2026, against 6 rows.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import { PLANT_COLUMNS, OBSERVATION_COLUMNS } from '../lib/vocab.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dataDir = join(root, 'data');

const { data: rows } = Papa.parse(readFileSync(join(dataDir, 'plants.csv'), 'utf8'), {
  header: true,
  delimiter: ',',
  skipEmptyLines: 'greedy',
  transformHeader: (h) => h.trim(),
});

const trim = (v) => String(v ?? '').trim();
// Notes on the existing rows are all survey remarks ("GPS ±3 m", "Position set
// by pin on imagery") — recorded on a day, by a person, about a measurement.
// They belong with the observation, not with the tree.
const plants = [];
const observations = [];

for (const row of rows) {
  const id = trim(row.plant_id);
  if (!id) continue;
  plants.push(Object.fromEntries(PLANT_COLUMNS.map((c) => [c, trim(row[c])])));

  const surveyedOn = trim(row.surveyed_on);
  const measured = ['dbh_in', 'height_ft', 'spread_ft', 'condition', 'photo', 'notes', 'surveyor']
    .some((c) => trim(row[c]) !== '');
  // A row with no survey date and nothing measured was never actually visited:
  // it is a position somebody plotted, and inventing an observation for it
  // would put a date on a survey that never happened.
  if (!surveyedOn && !measured) continue;

  observations.push({
    plant_id: id,
    surveyed_on: surveyedOn,
    surveyor: trim(row.surveyor),
    dbh_in: trim(row.dbh_in),
    height_ft: trim(row.height_ft),
    spread_ft: trim(row.spread_ft),
    condition: trim(row.condition),
    status: trim(row.status) || 'active',
    photo: trim(row.photo),
    notes: trim(row.notes),
  });
}

const write = (name, columns, out) =>
  writeFileSync(join(dataDir, name), Papa.unparse(out, { columns, newline: '\n' }) + '\n');

write('plants.csv', PLANT_COLUMNS, plants);
write('observations.csv', OBSERVATION_COLUMNS, observations);

console.log(`✓ ${plants.length} plants, ${observations.length} observations`);
