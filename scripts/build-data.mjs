#!/usr/bin/env node
// Reads the human-edited CSV files in data/ and writes the compact JSON the map
// loads at runtime. Run via `npm run data` (also invoked by `npm run dev` and
// `npm run build`). Exits non-zero on validation errors so CI catches bad data.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import { buildDataset } from './lib/build.mjs';
import { normalizeName } from './lib/species.mjs';
import { renderSpeciesIndex, renderSpeciesPage, SPECIES_CSS } from './lib/species-pages.mjs';
import { photoUrl } from './lib/photo-url.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const outDir = join(root, 'public', 'data');
// The field app is a separate PWA with its own cache; its species list lives
// beside it so a surveyor's phone never fetches the whole 197 kB dataset.
const fieldDir = join(root, 'public', 'field');

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

const config = JSON.parse(readFileSync(join(dataDir, 'config.json'), 'utf8'));

const result = buildDataset({
  taxaRows: readCsv('taxa.csv'),
  plantRows: readCsv('plants.csv'),
  observationRows: readCsv('observations.csv'),
  collectionRows: readCsv('collections.csv'),
  trails: JSON.parse(readFileSync(join(dataDir, 'trails.geojson'), 'utf8')),
  campusAreas: JSON.parse(readFileSync(join(dataDir, 'campus-areas.geojson'), 'utf8')),
  aliasRows: readCsv('species-aliases.csv'),
  cityTreeRows: readCsv('city-trees.csv'),
  config,
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

// ---- the field app's species list ----------------------------------------
// Just enough to autocomplete a name offline and hand back a taxon_id: no
// descriptions, no horticultural columns. Search keys are normalised here,
// once, by the same function the importer resolves names with, so the phone
// never has to agree with the desk about what "Scot's pine" folds down to.
const aliasKeys = new Map();
for (const row of readCsv('species-aliases.csv')) {
  const id = (row.taxon_id ?? '').trim();
  // A blank taxon_id is a deliberate "cannot resolve this" — offering it as a
  // suggestion would hand back the one thing it was recorded to say it is not.
  if (!id) continue;
  const key = normalizeName(row.alias);
  if (!key) continue;
  if (!aliasKeys.has(id)) aliasKeys.set(id, []);
  aliasKeys.get(id).push(key);
}

const species = result.dataset.taxa.map((t) => {
  const keys = new Set([normalizeName(t.sci), normalizeName(t.common), normalizeName(t.id)]);
  for (const key of aliasKeys.get(t.id) ?? []) keys.add(key);
  keys.delete('');
  return { id: t.id, sci: t.sci, common: t.common, n: t.count, k: [...keys] };
});

mkdirSync(fieldDir, { recursive: true });
const speciesJson = JSON.stringify(species);
writeFileSync(join(fieldDir, 'species.json'), speciesJson);

// ---- the field app's map of what is already out there ---------------------
// Most of campus will be mapped without ever having been tagged, so a surveyor
// standing at a tree has no number to type. Position is the one thing they and
// the map both have, so the app carries the mapped trees and matches on it.
//
// Every plant, not only the unsurveyed ones: an untagged tree that was surveyed
// last year can only be found this way too, and hiding it would make a
// re-survey impossible rather than merely awkward.
const fields = result.plants.fields;
const at = (row, name) => row[fields.indexOf(name)];
const trees = result.plants.rows.map((row) => {
  const taxon = result.dataset.taxa[at(row, 'taxon')];
  return {
    id: at(row, 'plant_id'),
    lat: at(row, 'lat'),
    lng: at(row, 'lng'),
    common: taxon?.common ?? '',
    sci: taxon?.sci ?? '',
    // Null for a tree nobody has surveyed, which the app says out loud: it is
    // the difference between "claim this" and "you may be re-surveying it".
    surveyed: at(row, 'surveyed_on'),
  };
});
const treesJson = JSON.stringify(trees);
writeFileSync(join(fieldDir, 'trees.json'), treesJson);

// ---- a page per species ---------------------------------------------------
// Real URLs rather than a query string, readable without JavaScript, and
// nothing new authored: every word on them is already in taxa.csv.
//
// BASE_PATH is what the Pages deploy sets for `vite build`, and `npm run data`
// runs inside the same step, so the two agree about where the site lives.
const siteBase = process.env.BASE_PATH ?? '/';
const speciesDir = join(root, 'public', 'species');
rmSync(speciesDir, { recursive: true, force: true });
mkdirSync(speciesDir, { recursive: true });
writeFileSync(join(speciesDir, 'species.css'), SPECIES_CSS);

// Campus photos and areas, grouped by species, so a page can show the trees
// actually standing on campus rather than a stock image of the species.
const photosByTaxon = new Map();
const areasByTaxon = new Map();
for (const row of result.plants.rows) {
  const taxon = result.dataset.taxa[at(row, 'taxon')];
  if (!taxon) continue;
  const file = at(row, 'photo');
  if (file) {
    if (!photosByTaxon.has(taxon.id)) photosByTaxon.set(taxon.id, []);
    photosByTaxon.get(taxon.id).push({
      id: at(row, 'plant_id'),
      url: photoUrl(file, siteBase, config.photoBaseUrl),
    });
  }
  const c = result.dataset.collections[at(row, 'collection')];
  if (c) {
    if (!areasByTaxon.has(taxon.id)) areasByTaxon.set(taxon.id, new Set());
    areasByTaxon.get(taxon.id).add(c.name);
  }
}

for (const taxon of result.dataset.taxa) {
  const dir = join(speciesDir, taxon.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), renderSpeciesPage(taxon, {
    photos: photosByTaxon.get(taxon.id) ?? [],
    areas: [...(areasByTaxon.get(taxon.id) ?? [])].sort(),
    base: siteBase,
    config,
  }));
}
writeFileSync(
  join(speciesDir, 'index.html'),
  renderSpeciesIndex(result.dataset.taxa, { base: siteBase, config }),
);

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
    ['taxa.csv', 'plants.csv', 'observations.csv', 'collections.csv', 'trails.geojson',
      'campus-areas.geojson', 'species-aliases.csv', 'config.json']
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
  `${c.collections} collections · ${c.trails} trails · ${c.campusAreas} campus areas · ` +
  `${c.aliases} species aliases` +
  `${result.warnings.length ? ` · ${result.warnings.length} warning(s)` : ''}`
);
console.log(
  `  ${c.observations} observation(s) · ${c.resurveyed} plant(s) surveyed more than once · ` +
  `${c.unsurveyed} never surveyed`,
);
// Counted on its own line, never added to the plant total: these are
// Burlington's trees standing inside the boundary, not the university's.
console.log(`  ${c.cityTrees} Burlington street tree(s) inside the boundary (not UVM's)`);
console.log(`  public/data/dataset.json  ${kb(datasetJson)}`);
console.log(`  public/data/plants.json   ${kb(plantsJson)}`);
console.log(`  public/field/species.json ${kb(speciesJson)}  (${species.length} taxa for the survey app)`);
console.log(`  public/field/trees.json   ${kb(treesJson)}  (${trees.length} mapped trees to match against)`);
console.log(`  public/species/           ${result.dataset.taxa.length} species pages + an index`);
console.log(`  data version              ${version}`);
