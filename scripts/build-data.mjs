#!/usr/bin/env node
// Reads the human-edited CSV files in data/ and writes the compact JSON the map
// loads at runtime. Run via `npm run data` (also invoked by `npm run dev` and
// `npm run build`). Exits non-zero on validation errors so CI catches bad data.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import { buildDataset } from './lib/build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const outDir = join(root, 'public', 'data');

function readCsv(name) {
  const path = join(dataDir, name);
  if (!existsSync(path)) {
    console.error(`✗ missing required file: data/${name}`);
    process.exit(1);
  }
  const { data, errors } = Papa.parse(readFileSync(path, 'utf8'), {
    header: true,
    // Stated rather than sniffed: a header-only file (an emptied collections
    // list, say) gives Papa nothing to detect a delimiter from and it errors.
    delimiter: ',',
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });
  const fatal = errors.filter((e) => e.code !== 'TooFewFields' && e.code !== 'TooManyFields');
  if (fatal.length) {
    console.error(`✗ could not parse data/${name}:`);
    for (const e of fatal.slice(0, 10)) console.error(`  row ${e.row}: ${e.message}`);
    process.exit(1);
  }
  for (const e of errors.filter((x) => !fatal.includes(x)).slice(0, 10)) {
    console.warn(`  ! data/${name} row ${e.row}: ${e.message}`);
  }
  return data;
}

const result = buildDataset({
  taxaRows: readCsv('taxa.csv'),
  plantRows: readCsv('plants.csv'),
  collectionRows: readCsv('collections.csv'),
  trails: JSON.parse(readFileSync(join(dataDir, 'trails.geojson'), 'utf8')),
  config: JSON.parse(readFileSync(join(dataDir, 'config.json'), 'utf8')),
});

for (const w of result.warnings) console.warn(`  ! ${w}`);

if (result.errors.length) {
  console.error(`\n✗ ${result.errors.length} data error(s):`);
  for (const e of result.errors) console.error(`  ${e}`);
  console.error('\nNothing was written. Fix the rows above and re-run `npm run data`.');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const datasetJson = JSON.stringify(result.dataset);
const plantsJson = JSON.stringify(result.plants);
writeFileSync(join(outDir, 'dataset.json'), datasetJson);
writeFileSync(join(outDir, 'plants.json'), plantsJson);

// These two files keep the same URL forever — Vite hashes JS and CSS
// filenames, but copies public/ through untouched. Without a cache-buster a
// returning visitor keeps seeing the plants they saw last time, however many
// surveys have landed since. The app appends this hash to the data URLs, and
// because it is compiled into the bundle, changing it also changes the
// bundle's own hashed filename.
//
// Hashed from the source files rather than the generated JSON: the output
// carries a build timestamp, which would change the version on every build and
// make every visitor re-download data that had not actually changed.
const version = createHash('sha256')
  .update(
    ['taxa.csv', 'plants.csv', 'collections.csv', 'trails.geojson', 'config.json']
      .map((name) => readFileSync(join(dataDir, name)))
      .reduce((a, b) => Buffer.concat([a, b]), Buffer.alloc(0)),
  )
  .digest('hex')
  .slice(0, 12);
writeFileSync(join(root, '.data-version'), version + '\n');

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} kB`;
const c = result.dataset.counts;
console.log(
  `\n✓ ${c.plants} plants (${c.active} active) · ${c.taxa} taxa · ` +
  `${c.collections} collections · ${c.trails} trails` +
  `${result.warnings.length ? ` · ${result.warnings.length} warning(s)` : ''}`
);
console.log(`  public/data/dataset.json  ${kb(datasetJson)}`);
console.log(`  public/data/plants.json   ${kb(plantsJson)}`);
console.log(`  data version              ${version}`);
