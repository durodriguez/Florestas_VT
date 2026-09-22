#!/usr/bin/env node
// What became of the 2,502 trees the 2014 inventory tagged, only 950 of which
// are on the map.
//
//   npm run check:coverage           # the accounting and the gaps to walk
//   npm run check:coverage -- --csv  # data/coverage-gaps.csv
//
// Like check:inventories, this reports and changes nothing.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

import { coverage } from './lib/coverage.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const parse = (p) =>
  Papa.parse(readFileSync(join(root, p), 'utf8').trim(), { header: true, skipEmptyLines: true }).data;

const asCsv = process.argv.slice(2).includes('--csv');
const r = coverage({ plants: parse('data/plants.csv'), reference: parse('public/field/reference.csv') });
const s = r.summary;
const pct = (n, d) => `${((n / d) * 100).toFixed(0)}%`;

console.log('\nWhat happened to the 2014 tags\n');
console.log(`  tagged in 2014, numbers 1-${r.highestLegacy}         ${s.legacyTags}`);
console.log(`  of those, on the map today             ${s.matched}`);
console.log(`  of those, missing from the map         ${s.missing}   ${pct(s.missing, s.legacyTags)}`);

console.log('\nAnd what the map holds instead\n');
console.log(`  trees on the map                       ${s.onMap}`);
console.log(`    carrying a 2014 number               ${r.counts.legacy}`);
console.log(`    carrying a tag above ${r.highestLegacy}            ${r.counts['new-tag']}   real metal tags, issued after 2014`);
console.log(`    carrying no readable tag             ${r.counts.untagged}   numbered UVM-4001+ here, not a tag`);

console.log('\nSo how much could renumbering explain?\n');
console.log(`  missing 2014 tags                      ${s.missing}`);
console.log(`  trees that could be one, at most       ${s.renumberCeiling}   (every new tag and every untagged tree)`);
console.log(`  left over even then                    ${s.unaccounted}   cannot be a renumbering`);

// The clean result. If a 2014 tree had been quietly renumbered to another
// number inside the same range, this would not be zero.
console.log(`\n  map tags inside 1-${r.highestLegacy} that 2014 never issued: ${r.unknownInRange.length}`);
if (r.unknownInRange.length) console.log(`    ${r.unknownInRange.slice(0, 20).join(', ')}`);
else console.log('    Nothing was renumbered within the old range — every legacy number on the');
console.log('    map is a 2014 number, so the 2014 numbering is intact as far as it goes.');

console.log('\nBy campus area\n');
console.log('  area            2014 tag   new tag   untagged     not traceable to 2014');
for (const [area, v] of Object.entries(r.byArea).sort((a, b) => {
  const t = (x) => x.legacy + x['new-tag'] + x.untagged;
  return t(b[1]) - t(a[1]);
})) {
  const total = v.legacy + v['new-tag'] + v.untagged;
  console.log(`  ${area.padEnd(14)} ${String(v.legacy).padStart(8)} ${String(v['new-tag']).padStart(9)} ${String(v.untagged).padStart(10)} ${pct(v['new-tag'] + v.untagged, total).padStart(14)}  of ${total}`);
}

console.log('\nThe missing tags are not scattered\n');
console.log(`  they form ${r.runs.length} runs of consecutive numbers`);
console.log(`  ${s.inRunsOf10} of the ${s.missing} sit in a run of 10 or more   ${pct(s.inRunsOf10, s.missing)}`);
console.log(`  only ${s.singletons} are an isolated single number`);
console.log('\n  A tag can fall off one tree. It does not fall off 192 consecutive ones,');
console.log('  so the long runs are a stretch nobody walked or a block that never');
console.log('  reached the export — not tag loss.');

// Worth walking: many missing numbers, short distance between the two
// surviving neighbours. Those are the cheapest questions to answer.
const walk = [...r.gaps].filter((g) => g.count >= 8 && g.span <= 250)
  .sort((a, b) => b.density - a.density).slice(0, 12);
if (walk.length) {
  console.log('\nCheapest gaps to settle on foot — most unanswered numbers per metre:\n');
  console.log('  gone  tags         between          apart   area      what 2014 said they were');
  for (const g of walk) {
    const mix = g.distinctSpecies === 1 ? 'all ' : `${g.distinctSpecies} spp, mostly `;
    const young = g.youngShare >= 0.6 ? ', nearly all young' : '';
    console.log(`  ${String(g.count).padStart(4)}  ${String(g.from + '-' + g.to).padEnd(12)} #${String(g.before).padEnd(5)}-#${String(g.after).padEnd(5)} ${String(Math.round(g.span) + ' m').padStart(6)}   ${g.area.padEnd(9)} ${mix}${g.dominant}${young}`);
  }
  console.log('\n  Walk one and read what is on the trunks. Tags in the 2556+ range means');
  console.log('  renumbering; bare trunks means lost tags; no trees means they were');
  console.log('  removed. One afternoon distinguishes three hypotheses.');
  console.log('\n  Read the last column first. One species repeated is a planting — or one');
  console.log('  clump-form tree whose stems were each tagged in 2014 and counted once in');
  console.log('  2023. A dozen species mixed together is somebody\'s walking route.');
}

if (asCsv) {
  const out = join(root, 'data', 'coverage-gaps.csv');
  writeFileSync(out, `${Papa.unparse(
    [...r.gaps].sort((a, b) => b.count - a.count).map((g) => ({
      first_missing_tag: g.from,
      last_missing_tag: g.to,
      missing_count: g.count,
      previous_tag_on_map: g.before,
      next_tag_on_map: g.after,
      metres_apart: Math.round(g.span),
      area: g.area,
      distinct_species_2014: g.distinctSpecies,
      dominant_species_2014: g.dominant,
      dominant_share: g.dominantShare.toFixed(2),
      young_share_2014: g.youngShare.toFixed(2),
    })),
    { newline: '\n' },
  )}\n`);
  console.log(`\nWrote ${r.gaps.length} gaps to data/coverage-gaps.csv`);
}

console.log('');
