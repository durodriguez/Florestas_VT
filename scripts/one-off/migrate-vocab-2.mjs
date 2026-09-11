#!/usr/bin/env node
// ONE-OFF MIGRATION, retained for provenance. Follows migrate-vocab.mjs and
// simplifies what that produced, on review.
//
// 1. `habit` and `foliage` collapse into one `plant_type` column. The seven
//    categories already encode the deciduous/evergreen split for trees, which
//    is the only place foliage was doing real work. One column a surveyor
//    fills in, rather than two that have to agree.
//
//    Cost, recorded because it is a real one: an evergreen shrub — yew, box,
//    rhododendron — is now just "shrub". With five shrubs in the file that is
//    nothing; if the shrub list grows, foliage may need to come back for them.
//
// 2. `origin`, `vt_prohibited` and `northeast_invasive` collapse back into one
//    `origin` column of vermont-native / vermont-invasive / introduced.
//    Tracking the legal prohibition list was dropped deliberately: it is a
//    regulatory claim that would need checking against a rule that changes,
//    and this map does not need to make it.
//
// Usage: node scripts/one-off/migrate-vocab-2.mjs
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import Papa from 'papaparse';

const path = 'data/taxa.csv';
const { data, meta } = Papa.parse(readFileSync(path, 'utf8'), {
  header: true, delimiter: ',', skipEmptyLines: 'greedy',
});

for (const row of data) {
  const foliage = (row.foliage ?? '').trim();
  row.plant_type = row.habit === 'tree'
    ? (foliage === 'evergreen' || foliage === 'semi-evergreen' ? 'evergreen-tree' : 'deciduous-tree')
    : (row.habit ?? '').trim();

  // A plant flagged invasive is invasive whatever its recorded origin; that is
  // the whole reason the flag existed, so it wins when the two columns merge.
  if ((row.northeast_invasive ?? '').trim() === 'yes') row.origin = 'vermont-invasive';

  delete row.habit;
  delete row.foliage;
  delete row.vt_prohibited;
  delete row.northeast_invasive;
}

const fields = meta.fields
  .flatMap((f) => (f === 'habit' ? ['plant_type'] : f))
  .filter((f) => !['foliage', 'vt_prohibited', 'northeast_invasive'].includes(f));

copyFileSync(path, `${path}.bak`);
writeFileSync(path, Papa.unparse(data, { columns: fields, newline: '\n' }) + '\n');

const tally = (key) => {
  const m = new Map();
  for (const r of data) m.set((r[key] ?? '').trim() || '(blank)', (m.get((r[key] ?? '').trim() || '(blank)') ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ');
};
console.log('plant_type :', tally('plant_type'));
console.log('origin     :', tally('origin'));
console.log('columns    :', fields.length);
