/**
 * How complete each species page is, item by item, so the gaps can be worked
 * through over time (docs/SPECIES-PROGRESS.md, and /species/progress/ on the
 * site). Pure: give it the built taxa, the species extras and tree counts.
 *
 * An item is "done", "borrowed" (shown, but from the species a cultivar was
 * selected from), "missing" or not applicable (left out). Not applicable:
 * a fern's flowers, fruit and bark; a vine's or perennial's bark; fruit on a
 * taxon recorded as bearing none; a genus-only entry's habitat, growing
 * details and Know it by (it shows a leaf of each species instead); a
 * fern's, perennial's or grass's lifespan.
 */

import { chooseTiles } from './species-pages.mjs';

const FERN_FAMILIES = new Set(['Pteridaceae', 'Dryopteridaceae', 'Athyriaceae', 'Onocleaceae', 'Thelypteridaceae', 'Polypodiaceae']);
/** Know it by shows four tiles (species-pages.mjs), of any parts. */
export const KNOW_TILES = 4;
/** How many things a page's Worth knowing should hold: the fun fact and at least two more. */
export const WORTH_KNOWING = 3;
/** Left blank on purpose (DATA-MODEL.md, "Filling in a new taxon"): boxwood's fruit is insignificant. */
const DELIBERATE_NO_FRUIT_MONTHS = new Set(['buxus-sempervirens', 'buxus-verdant-hills']);
const GROWING = [
  ['flowerColor', 'flower color'], ['flowerMonths', 'flower months'], ['fruitColor', 'fruit color'], ['fruitMonths', 'fruit months'],
  ['fallColor', 'fall color'], ['matureHeightFt', 'height'], ['matureSpreadFt', 'spread'], ['zones', 'hardiness zones'], ['bark', 'bark description'], ['lifespan', 'lifespan'],
];

/** A blank species is a genus-only entry ("Forsythia sp."), unless the name is a cross ("Acer griseum x maximowiczianum"). */
export const kindOf = (t) => (t.cultivar || t.infra ? 'cultivar'
  : !t.species ? (/ x /.test(t.sci ?? '') ? 'hybrid' : 'genus')
  : /^x\b/.test(t.species) ? 'hybrid' : 'species');

/** One taxon's checklist: [{ item, state }] with state done | borrowed | missing. */
export function checklist(t, extras) {
  const e = extras ?? {};
  const kind = kindOf(t);
  const fern = FERN_FAMILIES.has(t.family);
  const isTree = t.type === 'deciduous-tree' || t.type === 'evergreen-tree';
  const items = [];
  const add = (item, ok, borrowed = false) => items.push({ item, state: ok ? (borrowed ? 'borrowed' : 'done') : 'missing' });

  add('description', !!t.description);
  add('fun fact', !!t.funFact);
  // Worth knowing: the fun fact and the facts in facts.csv, a cultivar's own
  // and its species' marked for it; WORTH_KNOWING or more to count as done.
  const own = (t.funFact ? 1 : 0) + (e.facts?.length ?? 0);
  const worth = own + (e.speciesFacts?.length ?? 0);
  items.push({ item: `worth knowing (${WORTH_KNOWING})`, state: worth >= WORTH_KNOWING ? (own >= WORTH_KNOWING ? 'done' : 'borrowed') : 'missing', detail: `${worth} of ${WORTH_KNOWING}` });
  if (kind === 'genus') {
    add('"Which one?" leaves', !!e.kin?.length);
    return items;
  }
  const blankOk = (key) => (fern && ['flowerColor', 'flowerMonths', 'fruitColor', 'fruitMonths', 'fallColor', 'bark'].includes(key))
    || ((key === 'fruitMonths') && (t.fruitColor === 'none' || DELIBERATE_NO_FRUIT_MONTHS.has(t.id)))
    || (key === 'bark' && !isTree && t.type !== 'shrub')
    // Lifespan is for woody plants (DATA-MODEL.md).
    || (key === 'lifespan' && (fern || t.type === 'perennial' || t.type === 'grass' || t.type === 'annual'));
  const missingGrowing = GROWING.filter(([k]) => !blankOk(k) && (t[k] === undefined || t[k] === null || t[k] === '' || (Array.isArray(t[k]) && !t[k].length))).map(([, l]) => l);
  items.push({ item: 'growing details', state: missingGrowing.length ? 'missing' : 'done', detail: missingGrowing.join(', ') });
  add('where it grows wild', !!e.habitat, !!e.habitat?.inherited);
  if (isTree) add('crown shape', !!e.crownForm);
  // Know it by (since November 2026): four tiles of any parts, as the page
  // picks them, not a fixed bark, leaves, flowers and fruit; and a written note
  // (know-it-by.csv) on each, where a tile without one shows a one-line caption
  // drawn from Characteristics.
  const tiles = chooseTiles(t, e.photos ?? {}, e.know);
  const borrowedPhoto = (tile) => tile.parts.every((p) => e.photos[p].inherited);
  const shown = Math.min(KNOW_TILES, tiles.length);
  items.push({ item: `know it by photos (${KNOW_TILES})`, state: shown >= KNOW_TILES ? (tiles.some(borrowedPhoto) ? 'borrowed' : 'done') : 'missing', detail: `${shown} of ${KNOW_TILES}` });
  const written = tiles.filter((tile) => !tile.def);
  const lacking = tiles.filter((tile) => tile.def).map((tile) => tile.label.toLowerCase());
  items.push({ item: 'know it by notes', state: shown && written.length >= shown ? (written.some((tile) => tile.inherited) ? 'borrowed' : 'done') : 'missing', detail: !shown ? 'no tiles yet' : lacking.length ? `none on ${lacking.join(', ')}` : `${written.length} of ${shown}` });
  return items;
}

/** Every describable taxon's checklist, with counts, most planted first. */
export function completeness(taxa, extras, counts = {}) {
  return taxa
    .filter((t) => t.id !== 'unknown')
    .map((t) => {
      const items = checklist(t, extras.get(t.id));
      const filled = items.filter((i) => i.state !== 'missing').length;
      return { id: t.id, common: t.common, sci: t.sci, kind: kindOf(t), trees: counts[t.id] ?? 0, items, filled, total: items.length, facts: extras.get(t.id)?.facts?.length ?? 0 };
    })
    .sort((a, b) => (b.trees > 0) - (a.trees > 0) || a.filled / a.total - b.filled / b.total || b.trees - a.trees || a.common.localeCompare(b.common));
}

/** Totals for a set of rows: pages complete, items filled, items missing by name. */
export function summary(rows) {
  const missingBy = {};
  for (const r of rows) for (const i of r.items) if (i.state === 'missing') missingBy[i.item] = (missingBy[i.item] ?? 0) + 1;
  return {
    pages: rows.length,
    complete: rows.filter((r) => r.filled === r.total).length,
    filled: rows.reduce((s, r) => s + r.filled, 0),
    total: rows.reduce((s, r) => s + r.total, 0),
    missingBy: Object.entries(missingBy).sort((a, b) => b[1] - a[1]),
  };
}

const pct = (a, b) => (b ? Math.round((100 * a) / b) : 100);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const GROUPS = [['species', 'Species'], ['hybrid', 'Hybrids'], ['cultivar', 'Cultivars and forms'], ['genus', 'Named only to genus']];

/** The progress document committed as docs/SPECIES-PROGRESS.md: totals, then every page with gaps. */
export function progressMarkdown(rows, date) {
  const line = (label, rs) => { const s = summary(rs); return `| ${label} | ${s.pages} | ${s.complete} | ${pct(s.filled, s.total)}% |`; };
  const out = [
    '# Species page progress',
    '',
    `Generated by \`npm run data\` on ${date}; do not edit by hand. Each page is checked for a`,
    'description and fun fact, three things worth knowing, its growing details',
    '(lifespan included), where it grows wild, a crown shape (trees), and Know it',
    'by: four photo tiles, of whatever parts best identify it, each with a written',
    'note rather than a caption drawn from the growing details. "Borrowed" items',
    'show the species a cultivar was selected from and count as filled. The',
    'same list, with links, is on the site at /species/progress/.',
    '',
    '| Group | Pages | Complete | Items filled |',
    '| --- | --- | --- | --- |',
  ];
  for (const mapped of [true, false]) for (const [k, l] of GROUPS) {
    const rs = rows.filter((r) => r.kind === k && (r.trees > 0) === mapped);
    if (rs.length) out.push(line(`${mapped ? 'On campus' : 'Not yet mapped'}: ${l.toLowerCase()}`, rs));
  }
  out.push(line('**All**', rows), '', '## Most often missing', '');
  for (const [item, n] of summary(rows).missingBy) out.push(`- ${item}: ${n} pages`);
  for (const mapped of [true, false]) {
    out.push('', `## ${mapped ? 'On campus' : 'Not yet mapped'}: pages with gaps`, '');
    for (const r of rows.filter((x) => (x.trees > 0) === mapped && x.filled < x.total)) {
      const miss = r.items.filter((i) => i.state === 'missing').map((i) => (i.detail ? `${i.item} (${i.detail})` : i.item));
      out.push(`- [ ] **${r.common}** (\`${r.id}\`${r.trees ? `, ${r.trees} on campus` : ''}): ${miss.join('; ')}`);
    }
  }
  return `${out.join('\n')}\n`;
}

/** The same, as a page with links and filters, for /species/progress/. */
export function progressHtml(rows, date) {
  const s = summary(rows);
  const tr = rows.map((r) => {
    const cells = r.items.map((i) => `<span class="pg pg-${i.state}" title="${esc(i.item + (i.detail ? `: ${i.detail}` : ''))}">${esc(i.item)}</span>`).join('');
    return `<tr data-mapped="${r.trees > 0}" data-done="${r.filled === r.total}"><td><a href="../${esc(r.id)}/">${esc(r.common)}</a><br><i>${esc(r.sci)}</i></td><td>${r.trees || ''}</td><td>${pct(r.filled, r.total)}%</td><td>${cells}${r.facts ? ` <span class="pg pg-extra">+${r.facts} fact${r.facts > 1 ? 's' : ''}</span>` : ''}</td></tr>`;
  }).join('');
  return `<main class="page">
  <h1>Species page progress</h1>
  <p class="label">${s.complete} of ${s.pages} pages complete &middot; ${pct(s.filled, s.total)}% of items filled &middot; updated ${esc(date)}</p>
  <p>Each item is <span class="pg pg-done">filled</span>, <span class="pg pg-borrowed">borrowed from the species</span> or <span class="pg pg-missing">missing</span>. Know it by wants four photo tiles, of whatever parts best identify the plant, each with a written note (a tile without one falls back to a caption drawn from the growing details). Items that do not apply, such as a fern's bark or a perennial's lifespan, are left out.</p>
  <p><label><input type="checkbox" id="pg-gaps" checked> Only pages with gaps</label> <label><input type="checkbox" id="pg-mapped"> Only species on campus</label></p>
  <table class="pg-table"><thead><tr><th>Species</th><th>On campus</th><th>Filled</th><th>Items</th></tr></thead><tbody>${tr}</tbody></table>
</main>
<style>
.pg-table { border-collapse: collapse; width: 100%; font-size: .9rem; }
.pg-table th, .pg-table td { text-align: left; vertical-align: top; padding: .45rem .5rem; border-bottom: 1px solid var(--border); }
.pg { display: inline-block; margin: 0 .25rem .25rem 0; padding: .05rem .45rem; border-radius: 99px; font-size: .78rem; border: 1px solid var(--border); }
.pg-done { background: var(--mint); }
.pg-borrowed { background: var(--note); color: var(--note-ink); }
.pg-missing { background: #f6d9d0; color: #7a2a12; border-color: #e3a996; font-weight: 600; }
.pg-extra { background: var(--sunk); }
@media (prefers-color-scheme: dark) { .pg-missing { background: #4a2219; color: #f3c2b2; border-color: #7a3a2a; } }
@media (max-width: 40rem) { .pg-table td:nth-child(2), .pg-table th:nth-child(2) { display: none; } }
</style>
<script>
const f = () => { const g = document.getElementById('pg-gaps').checked, m = document.getElementById('pg-mapped').checked;
  for (const r of document.querySelectorAll('.pg-table tbody tr')) r.hidden = (g && r.dataset.done === 'true') || (m && r.dataset.mapped !== 'true'); };
document.getElementById('pg-gaps').onchange = f; document.getElementById('pg-mapped').onchange = f; f();
</script>`;
}
