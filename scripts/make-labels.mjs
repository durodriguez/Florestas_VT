#!/usr/bin/env node
// Generates a printable sheet of plant labels, each with a QR code pointing at
// that plant's deep link (?plant=<accession>). Print on weatherproof label
// stock, or use the SVGs as artwork for engraved/aluminium signs.
//
//   npm run labels                       # every active plant
//   npm run labels -- --collection university-green
//   npm run labels -- --ids DEMO-0001,DEMO-0002
//   npm run labels -- --base https://uvm.edu/arboretum/

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import QRCode from 'qrcode';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'labels');

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const config = JSON.parse(readFileSync(join(root, 'data', 'config.json'), 'utf8'));
const csv = (name) =>
  Papa.parse(readFileSync(join(root, 'data', name), 'utf8'), {
    header: true,
    // Stated rather than sniffed: a header-only file (an emptied collections
    // list, say) gives Papa nothing to detect a delimiter from and it errors.
    delimiter: ',',
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  }).data;

const taxa = new Map(csv('taxa.csv').map((t) => [t.taxon_id?.trim(), t]));
const baseUrl = (arg('base', config.publicUrl) ?? '').replace(/\/?$/, '/');
const onlyCollection = arg('collection');
const onlyIds = arg('ids')?.split(',').map((s) => s.trim());

const plants = csv('plants.csv').filter((p) => {
  if ((p.status || 'active').trim() !== 'active') return false;
  if (onlyIds && !onlyIds.includes(p.plant_id?.trim())) return false;
  if (onlyCollection && p.collection_id?.trim() !== onlyCollection) return false;
  return true;
});

if (plants.length === 0) {
  console.error('✗ No matching plants. Check your --collection or --ids values.');
  process.exit(1);
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Genus and species italic, cultivar upright in single quotes. */
function sciHtml(t) {
  const parts = [];
  if (t.genus?.trim()) parts.push(`<i>${esc(t.genus.trim())}</i>`);
  if (t.species?.trim()) parts.push(`<i>${esc(t.species.trim())}</i>`);
  if (t.infraspecific?.trim()) parts.push(esc(t.infraspecific.trim()));
  if (t.cultivar?.trim()) parts.push(`&lsquo;${esc(t.cultivar.trim())}&rsquo;`);
  return parts.join(' ') || esc(t.scientific_name);
}

mkdirSync(outDir, { recursive: true });

const cards = [];
for (const plant of plants) {
  const id = plant.plant_id.trim();
  const taxon = taxa.get(plant.taxon_id?.trim());
  if (!taxon) {
    console.warn(`  ! ${id}: taxon_id "${plant.taxon_id}" not found, skipping`);
    continue;
  }
  const url = `${baseUrl}?plant=${encodeURIComponent(id)}`;
  // Level M keeps the code small; these labels are scanned from ~1 ft away.
  const svg = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 220,
  });
  writeFileSync(join(outDir, `${id}.svg`), svg);

  cards.push(`
    <article class="label">
      <div class="label-text">
        <p class="common">${esc(taxon.common_name)}</p>
        <p class="sci">${sciHtml(taxon)}</p>
        <p class="family">${esc(taxon.family)}</p>
        <p class="accession">${esc(id)}</p>
      </div>
      <div class="label-qr">${svg}<p class="scan">Scan to learn more</p></div>
    </article>`);
}

const sheet = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(config.shortName)} — plant labels</title>
<style>
  @page { size: letter; margin: 0.4in; }
  body { font-family: Georgia, "Times New Roman", serif; margin: 0; color: #111; }
  .sheet { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.2in; }
  .label {
    display: flex; justify-content: space-between; gap: 0.15in;
    border: 1.5pt solid #154734; border-radius: 6pt;
    padding: 0.16in; height: 2.0in; box-sizing: border-box;
    break-inside: avoid; page-break-inside: avoid;
  }
  .label-text { display: flex; flex-direction: column; min-width: 0; }
  .common { font-size: 15pt; font-weight: bold; margin: 0 0 2pt; line-height: 1.15; }
  .sci { font-size: 11pt; margin: 0 0 2pt; color: #333; }
  .family { font-size: 8.5pt; letter-spacing: .04em; text-transform: uppercase; color: #666; margin: 0; }
  .accession { font-size: 8pt; color: #666; margin: auto 0 0; font-family: ui-monospace, monospace; }
  .label-qr { display: flex; flex-direction: column; align-items: center; flex: 0 0 auto; }
  .label-qr svg { width: 1.05in; height: 1.05in; }
  .scan { font-size: 6.5pt; color: #666; margin: 3pt 0 0; text-align: center; }
  .note { padding: 0.2in; font-size: 9pt; color: #555; }
  @media print { .note { display: none; } }
</style></head>
<body>
<p class="note">${cards.length} label(s) linking to <code>${esc(baseUrl)}</code>.
  Print at 100% scale (no "fit to page"), two per row. Individual QR SVGs are in <code>public/labels/</code>.</p>
<div class="sheet">${cards.join('')}</div>
</body></html>`;

writeFileSync(join(outDir, 'labels.html'), sheet);
console.log(`\n✓ ${cards.length} labels -> public/labels/labels.html`);
console.log(`  QR codes point at ${baseUrl}?plant=<accession>`);
console.log(`  Individual SVGs: public/labels/<accession>.svg`);
