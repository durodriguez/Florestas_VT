#!/usr/bin/env node
/**
 * Checks every photo in data/part-photos.csv against its source, as a second
 * line of defence behind looking at it (docs/SPECIES-PAGES.md, "Choosing a
 * photo"). Run by hand (`npm run check:photos`) after adding photos; it needs
 * the network, so the build does not run it.
 *
 * - Wikimedia Commons: the file must sit in a visible category that names
 *   the species (or the older name Little's atlas uses for it). A file filed
 *   only under its genus, or only under "Trees", is not identified to species.
 * - iNaturalist: the observation must be research grade (its identification
 *   agreed by others) and identified as that species.
 *
 * Neither proves a photo right: an uploader can mislabel one, as the photo of
 * pink-red cones filed under Thuja occidentalis was. That is why every row
 * also says, in its `matches` column, what the photo shows that agrees with
 * what taxa.csv records for that part, and the build refuses a row without
 * it. Exits non-zero on any problem.
 */

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import { SYNONYMS } from './fetch-ranges.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => Papa.parse(readFileSync(join(root, 'data', f), 'utf8'), { header: true, skipEmptyLines: true }).data;
const UA = 'UVMTreesInventory/0.1 (+https://github.com/durodriguez/Florestas_VT)';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** curl, as Node's own fetch cannot always resolve hosts here; with patient retries for rate limits. */
async function getJson(url, tries = 8) {
  for (let i = 0; i < tries; i++) {
    try { return JSON.parse(execFileSync('curl', ['-sf', '--max-time', '30', '-A', UA, url], { maxBuffer: 1 << 26 }).toString()); }
    catch { await wait(5000 * (i + 1)); }
  }
  throw new Error(`could not fetch ${url}`);
}

const taxa = new Map(read('taxa.csv').map((t) => [t.taxon_id, t]));
const rows = read('part-photos.csv');
const problems = [];

const namesFor = (t) => {
  const sp = `${t.genus} ${t.species}`;
  // A hybrid is "Acer x freemanii" here and "Acer × freemanii" at both sources.
  const hybrid = / x /.test(sp) ? sp.replace(' x ', ' × ') : null;
  return [sp, hybrid, SYNONYMS[sp], sp === 'Callitropsis nootkatensis' ? 'Cupressus nootkatensis' : null].filter(Boolean).map((n) => n.toLowerCase());
};

/**
 * A file's visible categories from its ordinary page, for when the API
 * refuses (Commons rate-limits API clients far sooner than page views).
 * Slow on purpose: one page every two seconds.
 */
async function pageCategories(page) {
  for (let i = 0; i < 4; i++) {
    try {
      const html = execFileSync('curl', ['-sf', '--max-time', '30', '-A', UA, page], { maxBuffer: 1 << 26 }).toString();
      await wait(2000);
      const box = html.split('id="mw-normal-catlinks"')[1]?.split('</div>')[0] ?? '';
      return [...box.matchAll(/href="\/wiki\/Category:([^"]+)"/g)].map((m) => `category:${decodeURIComponent(m[1]).replace(/_/g, ' ')}`.toLowerCase());
    } catch { await wait(30000 * (i + 1)); }
  }
  return null;
}

// Commons, forty files to a request; file by file from its page if the API refuses.
const commons = rows.filter((r) => r.page_url.includes('commons.wikimedia.org'));
let viaPages = false;
for (let i = 0; i < commons.length; i += 40) {
  const batch = commons.slice(i, i + 40);
  const titles = batch.map((r) => r.title).join('|');
  const norm = (s) => s.replace(/_/g, ' ');
  let cats = new Map(), renamed = new Map();
  let data = null;
  if (!viaPages) {
    try { data = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=categories&cllimit=max&clshow=!hidden&titles=${encodeURIComponent(titles)}`, 2); }
    catch { viaPages = true; console.log('The Commons API is refusing; reading each file page instead (slow).'); }
  }
  if (data) {
    cats = new Map(Object.values(data.query.pages).map((p) => [norm(p.title), (p.categories ?? []).map((c) => c.title.toLowerCase())]));
    renamed = new Map((data.query.normalized ?? []).map((n) => [n.from, n.to]));
  } else {
    for (const r of batch) { const c = await pageCategories(r.page_url); if (c) cats.set(norm(r.title), c); }
  }
  for (const r of batch) {
    const t = taxa.get(r.taxon_id);
    const c = cats.get(norm(renamed.get(r.title) ?? r.title));
    if (!c) { problems.push(`${r.taxon_id} ${r.part}: ${r.title} not found on Commons`); continue; }
    if (!c.some((cat) => namesFor(t).some((n) => cat.includes(n)))) {
      problems.push(`${r.taxon_id} ${r.part}: ${r.title} is in no category naming ${t.genus} ${t.species}`);
    }
  }
  if (!viaPages) await wait(2000);
}

// iNaturalist, thirty observations to a request.
const inat = rows.filter((r) => r.page_url.includes('inaturalist.org'));
for (let i = 0; i < inat.length; i += 30) {
  const batch = inat.slice(i, i + 30);
  const ids = batch.map((r) => r.page_url.split('/').pop());
  const data = await getJson(`https://api.inaturalist.org/v1/observations/${ids.join(',')}`);
  const byId = new Map(data.results.map((o) => [String(o.id), o]));
  for (const r of batch) {
    const t = taxa.get(r.taxon_id);
    const o = byId.get(r.page_url.split('/').pop());
    if (!o) { problems.push(`${r.taxon_id} ${r.part}: observation not found`); continue; }
    if (o.quality_grade !== 'research') problems.push(`${r.taxon_id} ${r.part}: observation is ${o.quality_grade}, not research grade`);
    const named = (o.taxon?.name ?? '').toLowerCase();
    if (!namesFor(t).some((n) => named.startsWith(n))) problems.push(`${r.taxon_id} ${r.part}: observation is identified as ${o.taxon?.name}`);
  }
  await wait(1500);
}

console.log(`${rows.length} photos checked: ${commons.length} from Commons, ${inat.length} from iNaturalist.`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log('Every photo is identified to its species at its source.');
