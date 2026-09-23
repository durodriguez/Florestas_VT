#!/usr/bin/env node
// Reports taxa whose fun fact merely restates its description.
//
//   npm run check:prose
//
// Exits non-zero when it finds something, so it can be wired into CI later.
// Nothing is written or changed; the fix is always a person rewriting a
// sentence, which is not something a script should attempt.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

import { checkProse, ECHO_WORDS, TEXT_OVERLAP } from './lib/prose.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const taxa = Papa.parse(readFileSync(join(root, 'data', 'taxa.csv'), 'utf8').trim(), {
  header: true,
  skipEmptyLines: true,
}).data;

const { issues, duplicates, summary } = checkProse(taxa);

console.log(`\nDescription against fun fact, across ${summary.compared} taxa\n`);

if (!issues.length && !duplicates.length) {
  console.log('  Nothing repeats itself.\n');
  console.log('  Three things are checked, because one measure missed the pin oak:');
  console.log(`  two openings beginning with the same words, a run of ${ECHO_WORDS}+ words shared`);
  console.log(`  anywhere in them, and a whole text sharing ${(TEXT_OVERLAP * 100).toFixed(0)}% of its words.`);
  console.log('');
  console.log('  Shared subject matter is not flagged. A green ash entry naming the');
  console.log('  emerald ash borer in both fields is staying on topic, and the giveaway');
  console.log('  is position: an echo opens both sentences, a subject moves about.\n');
  process.exit(0);
}

if (duplicates.length) {
  console.log(`${duplicates.length} fun fact(s) used on more than one taxon:\n`);
  for (const d of duplicates) console.log(`  ${d.name} — same as ${d.sameAs}`);
  console.log('');
}

if (issues.length) {
  console.log(`${issues.length} entr${issues.length === 1 ? 'y' : 'ies'} where the fun fact restates the description:\n`);
  for (const i of issues) {
    console.log(`  ${i.name}  (${i.taxon_id})`);
    for (const r of i.reasons) console.log(`    · ${r}`);
    console.log(`      D: ${i.description}`);
    console.log(`      F: ${i.fact}`);
    console.log('');
  }
  console.log('  The fix is usually not a new fact. Most of these already carry one');
  console.log('  behind the restatement and only need to lead with it.\n');
  console.log('  Check any genuinely new angle against the parent species and the rest');
  console.log('  of the file before using it — silkworms already belong to the white');
  console.log('  mulberry, marcescence to the European beech.\n');
}

process.exit(1);
