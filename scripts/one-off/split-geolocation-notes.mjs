#!/usr/bin/env node
// One-off: rename memorial -> dedicated + dedication_label, and lift the
// positional remarks out of each observation into plants.csv.
//
// Two columns were doing two jobs each:
//
//   memorial  held dedication text, with nothing to say "this is a dedicated
//             tree" for one whose plaque wording nobody has transcribed yet.
//   notes     held both how a position was arrived at ("GPS ±3 m") and what
//             the surveyor thought of the tree. The first belongs beside the
//             coordinates it qualifies, the second beside the visit.
//
// Every note on the six existing observations is positional, so all six move.
// Kept for provenance. Run once, on 11 September 2026.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import { PLANT_COLUMNS, OBSERVATION_COLUMNS } from '../lib/vocab.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dataDir = join(root, 'data');

const read = (name) =>
  Papa.parse(readFileSync(join(dataDir, name), 'utf8'), {
    header: true,
    delimiter: ',',
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  }).data;

const trim = (v) => String(v ?? '').trim();

/**
 * Does this note describe how the position was arrived at, rather than the
 * tree? The field app wrote both into one column in a known set of shapes, so
 * this recognises those rather than guessing at prose.
 */
const POSITIONAL = /^(GPS ±[\d.]+\s*m(, pin adjusted on imagery)?|Position set by pin on imagery)$/;

const observations = read('observations.csv');
const geoByPlant = new Map();

for (const o of observations) {
  const parts = trim(o.notes).split('. ').map((p) => p.trim()).filter(Boolean);
  const positional = parts.filter((p) => POSITIONAL.test(p));
  const rest = parts.filter((p) => !POSITIONAL.test(p));
  o.notes = rest.join('. ');
  // Later surveys re-establish the position, so the last one wins — which is
  // also the one whose coordinates are in plants.csv.
  if (positional.length) geoByPlant.set(trim(o.plant_id), positional.join('. '));
}

const plants = read('plants.csv').map((row) => {
  const dedication = trim(row.memorial);
  return {
    ...row,
    geolocation_notes: geoByPlant.get(trim(row.plant_id)) ?? '',
    // A tree with dedication wording on file is self-evidently a dedicated one.
    dedicated: dedication ? 'yes' : '',
    dedication_label: dedication,
  };
});

const write = (name, columns, rows) =>
  writeFileSync(join(dataDir, name), Papa.unparse(rows, { columns, newline: '\n' }) + '\n');

write('plants.csv', PLANT_COLUMNS, plants);
write('observations.csv', OBSERVATION_COLUMNS, observations);

console.log(
  `✓ ${plants.length} plants (${geoByPlant.size} with a positional note, ` +
  `${plants.filter((p) => p.dedicated).length} dedicated), ` +
  `${observations.length} observations`,
);
