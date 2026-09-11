#!/usr/bin/env node
// ONE-OFF MIGRATION, retained for provenance.
//
// Two vocabulary changes, applied to data/taxa.csv together because both touch
// every row:
//
// 1. `habit` loses "conifer". A conifer is a tree; the old list made a larch
//    both a tree and not one, and left holly and boxwood with nowhere sensible
//    to sit. Every conifer becomes a tree, and the deciduous/evergreen split
//    the category was really carrying now comes from `foliage`, which already
//    had it right (26 evergreen against 30 conifers — the four deciduous
//    conifers were exactly the problem).
//
// 2. `native_status` splits into three columns. It was an enum of
//    native/introduced/invasive, which cannot express what it needs to: a
//    Vermont native can be regionally invasive, and being prohibited for sale
//    is a legal fact independent of both. So:
//      origin              vermont-native | introduced | unknown
//      vt_prohibited       yes | no | blank
//      northeast_invasive  yes | no | blank
//    Blank means nobody has assessed it, which is different from "no".
//
// Usage: node scripts/one-off/migrate-vocab.mjs
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import Papa from 'papaparse';

const path = 'data/taxa.csv';
const { data, meta } = Papa.parse(readFileSync(path, 'utf8'), {
  header: true, delimiter: ',', skipEmptyLines: 'greedy',
});

// Regulatory judgement, recorded here rather than buried in a diff. Vermont's
// Noxious Weed Quarantine Rule bans sale, transport and distribution of listed
// species; these are the ones in this file confident enough to assert. Anything
// uncertain is left blank rather than guessed at — see docs/DATA-MODEL.md.
const VT_PROHIBITED = new Set([
  'acer-platanoides', 'acer-platanoides-crimson-king', 'acer-ginnala',
  'rhamnus-cathartica', 'elaeagnus-angustifolia',
]);

// Ecologically invasive in the northeast, which is a wider net than the legal
// one and includes species nobody has banned.
const NE_INVASIVE = new Set([
  ...VT_PROHIBITED,
  'pyrus-calleryana', 'morus-alba', 'ulmus-pumila', 'robinia-pseudoacacia',
]);

let conifers = 0;
for (const row of data) {
  if (row.habit === 'conifer') { row.habit = 'tree'; conifers++; }

  const was = (row.native_status ?? '').trim();
  row.origin = was === 'native' ? 'vermont-native' : was === '' ? 'unknown' : 'introduced';
  row.vt_prohibited = VT_PROHIBITED.has(row.taxon_id) ? 'yes' : '';
  row.northeast_invasive = NE_INVASIVE.has(row.taxon_id) ? 'yes' : '';
  delete row.native_status;
}

const fields = meta.fields
  .flatMap((f) => (f === 'native_status' ? ['origin', 'vt_prohibited', 'northeast_invasive'] : [f]));

copyFileSync(path, `${path}.bak`);
writeFileSync(path, Papa.unparse(data, { columns: fields, newline: '\n' }) + '\n');

const count = (k, v) => data.filter((r) => (r[k] ?? '') === v).length;
console.log(`conifer -> tree        : ${conifers}`);
console.log(`vermont-native         : ${count('origin', 'vermont-native')}`);
console.log(`introduced             : ${count('origin', 'introduced')}`);
console.log(`unknown                : ${count('origin', 'unknown')}`);
console.log(`vt_prohibited yes      : ${count('vt_prohibited', 'yes')}`);
console.log(`northeast_invasive yes : ${count('northeast_invasive', 'yes')}`);
