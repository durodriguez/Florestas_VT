#!/usr/bin/env node
// Compares what the 2014 inventory and the 2023-24 ArcGIS mapping each say a
// tagged tree is, and reports every disagreement.
//
//   npm run check:inventories            # summary plus the conflicts
//   npm run check:inventories -- --all   # also list the refinements
//   npm run check:inventories -- --csv   # a file to take into the field
//
// This reports. It does not change a record. Neither file is authoritative —
// 2014 was slower and on foot, ArcGIS is newer and was mapped at speed — so a
// disagreement is a tree to go and look at, not a value to overwrite.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

import { buildSpeciesLookup, resolveSpecies } from './lib/species.mjs';
import { crossReference } from './lib/inventory-xref.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const parse = (p) =>
  Papa.parse(readFileSync(join(root, p), 'utf8').trim(), { header: true, skipEmptyLines: true }).data;

const argv = process.argv.slice(2);
const showAll = argv.includes('--all');
const asCsv = argv.includes('--csv');

const species = buildSpeciesLookup(parse('data/taxa.csv'), parse('data/species-aliases.csv'));
const result = crossReference({
  plants: parse('data/plants.csv'),
  reference: parse('public/field/reference.csv'),
  speciesLookup: species.lookup,
  taxaById: species.byId,
  resolveSpecies,
});

const s = result.summary;
const name = (id) => species.byId.get(id)?.common_name ?? id;
const pct = (n) => (s.joined ? `${((n / s.joined) * 100).toFixed(1)}%` : '—');

console.log(`\n2014 inventory vs. the map\n`);
console.log(`  trees on the map              ${s.plants}`);
console.log(`  tags in the 2014 inventory    ${s.reference}`);
console.log(`  in both, so comparable        ${s.joined}`);
console.log('');
console.log(`  the two agree                 ${s.agree}  ${pct(s.agree)}`);
console.log(`  one is more specific          ${s.refinements}  ${pct(s.refinements)}`);
console.log(`  they disagree                 ${s.conflicts}  ${pct(s.conflicts)}`);
if (s.unresolved) console.log(`  2014 name not in taxa.csv     ${s.unresolved}`);

const byRank = {};
for (const c of result.conflicts) byRank[c.rank] = (byRank[c.rank] ?? 0) + 1;
if (result.conflicts.length) {
  console.log('\nWhere they part:');
  for (const rank of ['genus', 'species', 'infraspecific', 'cultivar']) {
    if (byRank[rank]) console.log(`  ${String(byRank[rank]).padStart(5)}  ${rank}`);
  }
  // Most of these are not 165 separate mistakes. The same pair of species
  // comes up again and again — a row of lindens labelled one way in 2014 and
  // another in ArcGIS is one judgement to settle, not eleven. Grouping them
  // is what turns this list into a morning's work.
  const pairs = new Map();
  for (const c of result.conflicts) {
    const key = `${c.map}|${c.ref}`;
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push(c.plant_id);
  }
  const repeated = [...pairs].filter(([, ids]) => ids.length >= 3)
    .sort((a, b) => b[1].length - a[1].length);
  if (repeated.length) {
    const inPattern = repeated.reduce((n, [, ids]) => n + ids.length, 0);
    console.log(`\nThe same confusion, repeated — ${inPattern} of the ${result.conflicts.length} sit in one of these.`);
    console.log('Settle the pair once and most of the list goes with it:\n');
    for (const [key, ids] of repeated) {
      const [map, ref] = key.split('|');
      console.log(`  ${String(ids.length).padStart(4)}  map: ${name(map).padEnd(26)} 2014: ${name(ref).padEnd(24)} ${ids.slice(0, 3).join(' ')}${ids.length > 3 ? ' …' : ''}`);
    }
  }

  console.log('\nEvery disagreement, worst first. Each is a tree to go and look at:\n');
  for (const c of result.conflicts) {
    const was = [c.dbh_2014 && `${c.dbh_2014}"`, c.age_2014].filter(Boolean).join(', ');
    console.log(`  ${c.plant_id}  ${c.rank.padEnd(13)} map: ${name(c.map).padEnd(28)} 2014: ${name(c.ref)}${was ? `  (${was} in 2014)` : ''}`);
  }
}

if (showAll && result.refinements.length) {
  console.log('\nOne side simply more specific than the other — not disagreements:\n');
  for (const r of result.refinements) {
    console.log(`  ${r.plant_id}  ${name(r.narrower)} is the narrower of the two (${name(r.broader)})`);
  }
}

if (result.unresolved.length) {
  console.log('\n2014 names that resolve to nothing — add each to species-aliases.csv:');
  const counts = new Map();
  for (const u of result.unresolved) counts.set(u.name, (counts.get(u.name) ?? 0) + 1);
  for (const [n, c] of [...counts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(c).padStart(5)}  ${n || '(blank)'}`);
  }
}

if (asCsv) {
  const out = join(root, 'data', 'species-disagreements.csv');
  writeFileSync(out, `${Papa.unparse(
    result.conflicts.map((c) => ({
      plant_id: c.plant_id,
      differs_at: c.rank,
      map_taxon: c.map,
      map_name: name(c.map),
      inventory_2014_taxon: c.ref,
      inventory_2014_name: name(c.ref),
      inventory_2014_as_written: c.refCommon,
      dbh_in_2014: c.dbh_2014,
      age_class_2014: c.age_2014,
      condition_2014: c.condition_2014,
    })),
    { newline: '\n' },
  )}\n`);
  console.log(`\nWrote ${result.conflicts.length} rows to data/species-disagreements.csv`);
}

console.log('');
