#!/usr/bin/env node
// One-off: give the tag number a column of its own, and pull the five
// survey-issued accessions into the one untagged block.
//
// Until now the accession WAS the tag: UVM-0763 meant "metal tag 763". That
// welds a permanent identifier to a piece of metal that falls off, corrodes
// and gets replaced with a different number — and it already has. Tree
// UVM-0105 wears tag 3497 today, and nothing in the schema could say so.
//
// Two changes, both additive where they can be:
//
//   1. A `tag` column on plants.csv, backfilled from the accession for the
//      1,349 minted from tags and left blank for the 703 that never had one.
//      Existing accessions are NOT renumbered — they are already permanent,
//      they are what QR labels and shared links encode, and they work fine as
//      opaque strings even though they still read like tags.
//
//   2. UVM-2026-0001..0005 renumbered into the untagged block as
//      UVM-4704..4708. Those five were issued by the survey app a day before
//      this ran, so nothing has been printed or shared that points at them.
//      The year in that shape was never meaningful — it recorded when a
//      number was issued, not when anything was planted — and one shape for
//      "no tag" is worth more than two.
//
// Run once, on 23 September 2026.

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

/** Accessions at or above this were minted here for trees with no tag. */
const UNTAGGED_BLOCK_START = 4001;

const plantRows = read('plants.csv');
const observationRows = read('observations.csv');

// --- 1. the renumbering ----------------------------------------------------
// Continue the untagged block rather than starting anywhere new, so the block
// stays contiguous and the next number is always obvious.
const untagged = plantRows
  .map((r) => trim(r.plant_id).match(/^UVM-(\d{4})$/)?.[1])
  .filter(Boolean)
  .map(Number)
  .filter((n) => n >= UNTAGGED_BLOCK_START);
let next = Math.max(...untagged) + 1;

const renamed = new Map();
for (const row of plantRows) {
  const id = trim(row.plant_id);
  if (/^UVM-\d{4}-\d{4}$/.test(id)) renamed.set(id, `UVM-${next++}`);
}

// --- 2. the tag column -----------------------------------------------------
// A number below the untagged block is a tag that was adopted as an accession,
// so the tag it was minted from is recoverable. Above it, there was never one.
const tagFor = (id) => {
  const m = id.match(/^UVM-(\d{4})$/);
  if (!m) return '';
  const n = Number(m[1]);
  return n >= UNTAGGED_BLOCK_START ? '' : String(n);
};

// One tree is already known to have outlived the assumption. UVM-0105 was
// found on 21 September wearing tag 3497, photographed, and recorded as an
// observation because nothing in the schema could hold it. Deriving its tag
// from its accession would write down 105, which is not what is on the trunk.
//
// Its accession does NOT change — that is the point of the split, and it is
// what the observation asked for: "ask grounds how re-tagging works before
// changing any accession". Nothing here changes one.
//
// The eight TAG DISPUTED and six TAG UNCERTAIN trees are deliberately left
// blank. A disputed tag is a number already serving as another tree's
// accession and an uncertain one could not be read, so in both cases nobody
// yet knows what is on the trunk. The column now gives them somewhere for the
// answer to go once somebody walks out and looks.
const KNOWN_TAGS = new Map([['UVM-0105', '3497']]);

const plants = plantRows.map((row) => {
  const was = trim(row.plant_id);
  const id = renamed.get(was) ?? was;
  return { ...row, plant_id: id, tag: KNOWN_TAGS.get(id) ?? tagFor(id) };
});

const observations = observationRows.map((row) => {
  const was = trim(row.plant_id);
  return { ...row, plant_id: renamed.get(was) ?? was };
});

// Two trees cannot wear one tag. Nothing could violate this before, because
// the tag was the identifier; now that it is ordinary data, it can.
const byTag = new Map();
for (const p of plants) {
  if (!p.tag) continue;
  if (byTag.has(p.tag)) throw new Error(`tag ${p.tag} on both ${byTag.get(p.tag)} and ${p.plant_id}`);
  byTag.set(p.tag, p.plant_id);
}

// Every observation must still point at a plant that exists.
const ids = new Set(plants.map((p) => p.plant_id));
for (const o of observations) {
  if (!ids.has(trim(o.plant_id))) throw new Error(`observation for missing plant ${o.plant_id}`);
}

const write = (name, columns, rows) =>
  writeFileSync(join(dataDir, name), Papa.unparse(rows, { columns, newline: '\n' }) + '\n');

write('plants.csv', PLANT_COLUMNS, plants);
write('observations.csv', OBSERVATION_COLUMNS, observations);

console.log(
  `✓ ${plants.length} plants — ${byTag.size} carry a tag, ${plants.length - byTag.size} do not\n` +
  `  renumbered ${renamed.size}: ${[...renamed].map(([a, b]) => `${a} → ${b}`).join(', ')}\n` +
  `  ${observations.length} observations repointed where needed`,
);
