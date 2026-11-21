#!/usr/bin/env node
// Reads the human-edited CSV files in data/ and writes the compact JSON the map
// loads at runtime. Run via `npm run data` (also invoked by `npm run dev` and
// `npm run build`). Exits non-zero on validation errors so CI catches bad data.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import { buildDataset } from './lib/build.mjs';
import { UNKNOWN_TAXON } from './lib/vocab.mjs';
import { normalizeName } from './lib/species.mjs';
import { renderSpeciesIndex, renderSpeciesPage, SPECIES_CSS } from './lib/species-pages.mjs';
import { renderItreePage } from './lib/itree-page.mjs';
import { collectionHealth } from './lib/health.mjs';
import { reviewSubmission } from './lib/review.mjs';
import { SPECIES_SEARCH_JS } from './lib/species-search.mjs';
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
  // A row whose field count differs from the header is fatal, not a warning.
  // It used to warn, and the warning was right there in the output and got
  // scrolled past — while the row itself was quietly truncated at its first
  // unquoted comma and shipped half a sentence to the browser. Anything that
  // corrupts a value rather than rejecting it has to stop the build.
  if (errors.length) {
    console.error(`✗ data/${name} does not parse cleanly:`);
    // +2 turns Papa's zero-based data row into the line number an editor shows.
    for (const e of errors.slice(0, 10)) console.error(`  line ${e.row + 2}: ${e.message}`);
    const mismatch = errors.some((e) => e.type === 'FieldMismatch');
    if (mismatch) {
      console.error('\n  A field holding a comma has to be quoted. The value is otherwise');
      console.error('  cut at that comma and the remainder read as another column.');
    }
    process.exit(1);
  }
  return data;
}

const config = JSON.parse(readFileSync(join(dataDir, 'config.json'), 'utf8'));

const result = buildDataset({
  taxaRows: readCsv('taxa.csv'),
  plantRows: readCsv('plants.csv'),
  observationRows: readCsv('observations.csv'),
  collectionRows: readCsv('collections.csv'),
  campusAreas: JSON.parse(readFileSync(join(dataDir, 'campus-areas.geojson'), 'utf8')),
  aliasRows: readCsv('species-aliases.csv'),
  tourRows: readCsv('tours.csv'),
  tourStopRows: readCsv('tour-stops.csv'),
  ...(existsSync(join(dataDir, 'renumbered.csv')) && { renumberedRows: readCsv('renumbered.csv') }),
  cityTreeRows: readCsv('city-trees.csv'),
  // i-Tree Eco's results for the city's trees (docs/ITREE.md). Optional, like
  // the crown peaks: without them the city trees simply show no estimates.
  ...(existsSync(join(dataDir, 'itree-city-trees.csv')) && {
    itreeRows: readCsv('itree-city-trees.csv'),
    itreeRun: existsSync(join(dataDir, 'itree-run.json'))
      ? JSON.parse(readFileSync(join(dataDir, 'itree-run.json'), 'utf8'))
      : null,
  }),
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

// ---- crown peaks, for /positions/ only -------------------------------------
// Tree tops found in the April 2023 LiDAR by scripts/lidar/crown_peaks.py (see
// docs/LIDAR.md). The desk tool compares them with the mapped trees; the
// public map never loads them. Optional: without the file the tool simply has
// no LiDAR layer.
const peaksFile = 'crown-peaks.csv';
if (existsSync(join(dataDir, peaksFile))) {
  const rows = readCsv(peaksFile).map((r, i) => {
    const row = [r.peak_id, Number(r.lat), Number(r.lng), Number(r.height_m)];
    if (!r.peak_id || row.slice(1).some((n) => !Number.isFinite(n))) {
      console.error(`✗ data/${peaksFile} line ${i + 2} is not a peak: ${JSON.stringify(r)}`);
      process.exit(1);
    }
    return row;
  });
  writeFileSync(join(outDir, 'crown-peaks.json'), JSON.stringify({ fields: ['id', 'lat', 'lng', 'height_m'], rows }));
}

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
    // The number on the trunk, which is what a surveyor types. Not derivable
    // from the id any more — see src/accession.ts.
    tag: at(row, 'tag'),
    lat: at(row, 'lat'),
    lng: at(row, 'lng'),
    common: taxon?.common ?? '',
    sci: taxon?.sci ?? '',
    // Null for a tree nobody has surveyed, which the app says out loud: it is
    // the difference between "claim this" and "you may be re-surveying it".
    surveyed: at(row, 'surveyed_on'),
    // So an update shows the plaque on record rather than an empty box. Left
    // out when there is none, which is nearly every tree.
    ...(at(row, 'dedication_label') ? { dedication: at(row, 'dedication_label') } : {}),
    // What the tree still needs, for the survey app's route to trees that
    // need a visit: when its trunk was measured, whether it has a photo,
    // whether it is named only to genus, and its campus. Left out when empty.
    ...(at(row, 'dbh_in') !== null ? { measured: at(row, 'dbh_on') ?? at(row, 'surveyed_on') } : {}),
    ...(at(row, 'photo') ? { photo: true } : {}),
    ...(taxon && !taxon.species ? { genusOnly: true } : {}),
    ...(at(row, 'collection') !== null ? { area: result.dataset.collections[at(row, 'collection')]?.name } : {}),
    // Removed or not found: still matchable, never a stop on a route.
    ...(at(row, 'status') !== 0 ? { gone: true } : {}),
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
writeFileSync(join(speciesDir, 'search.js'), SPECIES_SEARCH_JS);

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
      // The survey the photo came off: photo_on when it is from an earlier
      // visit than the latest, otherwise the latest visit's own date.
      taken: at(row, 'photo_on') ?? at(row, 'surveyed_on'),
    });
  }
  const c = result.dataset.collections[at(row, 'collection')];
  if (c) {
    if (!areasByTaxon.has(taxon.id)) areasByTaxon.set(taxon.id, new Set());
    areasByTaxon.get(taxon.id).add(c.name);
  }
}

// Not for the placeholder of an unidentified plant: there is no species to describe.
const describable = result.dataset.taxa.filter((t) => t.id !== UNKNOWN_TAXON);
for (const taxon of describable) {
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
  renderSpeciesIndex(describable, { base: siteBase, config }),
);

// ---- the i-Tree page -------------------------------------------------------
// What a city tree's "i-Tree estimates" link opens (docs/ITREE.md). Written
// only when there are results to describe.
const itreeDir = join(root, 'public', 'itree');
rmSync(itreeDir, { recursive: true, force: true });
if (result.dataset.itree) {
  mkdirSync(itreeDir, { recursive: true });
  writeFileSync(join(itreeDir, 'index.html'), renderItreePage(
    result.dataset.itree, readCsv('itree-city-trees.csv'), { base: siteBase, config },
  ));
}

// ---- collection health ------------------------------------------------------
// Diversity, pest exposure, origin, condition and survey progress (health.mjs),
// for the steward console, which shows them at /steward/#health. /health/ was
// a page of its own until November 2026; it stays as a redirect so links to it
// from before keep working.
const healthDir = join(root, 'public', 'health');
rmSync(healthDir, { recursive: true, force: true });
mkdirSync(healthDir, { recursive: true });
writeFileSync(
  join(root, 'public', 'data', 'health.json'),
  JSON.stringify(collectionHealth(result.dataset, result.plants, new Date().getFullYear())),
);
writeFileSync(join(healthDir, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Collection health — UVM Trees</title>
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=../steward/#health">
<link rel="canonical" href="../steward/#health">
<script>location.replace('../steward/#health')</script></head>
<body><p>Collection health is now part of the <a href="../steward/#health">steward console</a>.</p></body></html>
`);

// ---- the review inbox ---------------------------------------------------------
// Survey files waiting for approval, in survey/inbox/, each run through the
// importer as a dry run against the data as it stands (review.mjs), for the
// steward console's Review inbox. survey/inbox-examples/ holds made-up ones
// so the inbox has something to show while it is not yet active. A file with
// errors does not stop the build: showing them is the point.
{
  const surveyDir = join(root, 'survey');
  const parseFile = (path) => Papa.parse(readFileSync(path, 'utf8'), { header: true, delimiter: ',', skipEmptyLines: 'greedy', transformHeader: (h) => h.trim() });
  const inputs = {
    mapping: JSON.parse(readFileSync(join(surveyDir, 'mapping.json'), 'utf8')),
    taxaRows: readCsv('taxa.csv'), plantRows: readCsv('plants.csv'), observationRows: readCsv('observations.csv'),
    collectionRows: readCsv('collections.csv'), campusAreas: JSON.parse(readFileSync(join(dataDir, 'campus-areas.geojson'), 'utf8')),
    config, renumberedRows: existsSync(join(dataDir, 'renumbered.csv')) ? readCsv('renumbered.csv') : [],
  };
  const submissions = [];
  for (const [dir, example] of [['inbox', false], ['inbox-examples', true]]) {
    const at = join(surveyDir, dir);
    if (!existsSync(at)) continue;
    for (const name of readdirSync(at).filter((n) => n.toLowerCase().endsWith('.csv')).sort()) {
      const parsed = parseFile(join(at, name));
      submissions.push({ example, ...reviewSubmission({ ...inputs, file: `survey/${dir}/${name}`, rows: parsed.data, headers: parsed.meta.fields ?? [] }) });
    }
  }
  // Not active yet: the console shows the inbox, but nothing feeds it and
  // approving is switched off (docs/STEWARD.md).
  writeFileSync(join(root, 'public', 'data', 'inbox.json'), JSON.stringify({ active: false, submissions }));
  const waiting = submissions.filter((x) => !x.example).length;
  if (waiting) console.log(`  ${waiting} survey file(s) waiting in survey/inbox/ for review`);
}

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
    ['taxa.csv', 'plants.csv', 'observations.csv', 'collections.csv', 'tours.csv', 'tour-stops.csv', 'renumbered.csv',
      'campus-areas.geojson', 'species-aliases.csv', 'config.json', 'city-trees.csv', 'itree-city-trees.csv', 'itree-run.json', peaksFile]
      .filter((name) => existsSync(join(dataDir, name)))
      .map((name) => readFileSync(join(dataDir, name)))
      // The review inbox's files too, so a new submission is not hidden behind
      // a cached copy of the last inbox.
      .concat(['inbox', 'inbox-examples'].flatMap((dir) => {
        const at = join(root, 'survey', dir);
        return existsSync(at) ? readdirSync(at).filter((n) => n.endsWith('.csv')).sort().map((n) => readFileSync(join(at, n))) : [];
      }))
      .reduce((a, b) => Buffer.concat([a, b]), Buffer.alloc(0)),
  )
  .digest('hex')
  .slice(0, 12);
writeFileSync(join(root, '.data-version'), version + '\n');

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} kB`;
const c = result.dataset.counts;
console.log(
  `\n✓ ${c.plants} plants (${c.active} active) · ${c.taxa} taxa · ` +
  `${c.collections} collections · ${c.tours} tour${c.tours === 1 ? "" : "s"} · ${c.campusAreas} campus areas · ` +
  `${c.aliases} species aliases` +
  `${result.warnings.length ? ` · ${result.warnings.length} warning(s)` : ''}`
);
console.log(
  `  ${c.observations} observation(s) · ${c.resurveyed} plant(s) surveyed more than once · ` +
  `${c.unsurveyed} never surveyed`,
);
// Counted on its own line, never added to the plant total: these are
// Burlington's trees standing inside the boundary, not the university's.
console.log(`  ${c.cityTrees} Burlington street tree(s) inside the boundary (not UVM's)` +
  (c.itreeResults ? `, ${c.itreeResults} with i-Tree estimates` : ''));
console.log(`  public/data/dataset.json  ${kb(datasetJson)}`);
console.log(`  public/data/plants.json   ${kb(plantsJson)}`);
console.log(`  public/field/species.json ${kb(speciesJson)}  (${species.length} taxa for the survey app)`);
console.log(`  public/field/trees.json   ${kb(treesJson)}  (${trees.length} mapped trees to match against)`);
console.log(`  public/species/           ${result.dataset.taxa.length} species pages + an index`);
if (result.dataset.itree) console.log('  public/itree/             the i-Tree estimates page');
console.log(`  data version              ${version}`);
