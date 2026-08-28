#!/usr/bin/env node
// Checks every wikipedia_url in data/taxa.csv actually resolves.
//
//   npm run check:links
//
// The build environment has no route to Wikipedia, so these URLs are derived
// from the scientific names rather than confirmed. Run this once from a machine
// with normal internet access before publishing.
//
// A redirect is not a failure — Wikipedia redirects synonyms to the accepted
// name (Quercus prinus → Quercus montana), which is exactly what we want. They
// are reported so you can see which names have moved on.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rows = Papa.parse(readFileSync(join(root, 'data', 'taxa.csv'), 'utf8'), {
  header: true,
  skipEmptyLines: 'greedy',
  transformHeader: (h) => h.trim(),
}).data;

const targets = rows
  .map((r) => ({ id: (r.taxon_id ?? '').trim(), url: (r.wikipedia_url ?? '').trim() }))
  .filter((t) => t.id && t.url);

const UA = 'UVMArboretumExplorer/0.1 (https://github.com/durodriguez/Florestas_VT) link-check';
const CONCURRENCY = 4;

async function check({ id, url }) {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA } });
    // Only a 404 means the article is not there. Anything else non-OK is a
    // network or proxy problem on this machine, not a bad link.
    if (res.status === 404) return { id, url, state: 'missing', detail: 'no such article' };
    if (!res.ok) return { id, url, state: 'error', detail: `HTTP ${res.status} (network or proxy?)` };
    // Compare the final article title against the one we asked for.
    const asked = decodeURIComponent(url.split('/wiki/')[1] ?? '');
    const got = decodeURIComponent(res.url.split('/wiki/')[1] ?? '');
    if (got && got !== asked) return { id, url, state: 'redirect', detail: got.replace(/_/g, ' ') };
    return { id, url, state: 'ok' };
  } catch (err) {
    return { id, url, state: 'error', detail: err.message };
  }
}

const results = [];
const queue = [...targets];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) results.push(await check(queue.shift()));
  }),
);

const by = (s) => results.filter((r) => r.state === s);
for (const r of by('redirect')) console.log(`  → ${r.id}: redirects to "${r.detail}"`);
for (const r of by('missing')) console.log(`  ✗ ${r.id}: ${r.detail} — ${r.url}`);
for (const r of by('error').slice(0, 5)) console.log(`  ! ${r.id}: ${r.detail}`);
if (by('error').length > 5) console.log(`  ! …and ${by('error').length - 5} more errors`);
if (by('error').length === targets.length) {
  console.log('\n  Every request failed the same way — this machine cannot reach Wikipedia.');
}

console.log(
  `\n${targets.length} links checked · ${by('ok').length} exact · ` +
  `${by('redirect').length} redirected · ${by('missing').length} missing · ${by('error').length} errored`,
);
if (by('missing').length) {
  console.log('\nFix the missing ones in data/taxa.csv, or clear the column for those rows.');
  process.exit(1);
}
