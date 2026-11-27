/**
 * A page per species, generated at build time.
 *
 * The map answers "what is this tree in front of me". These answer "what is
 * this species, and where is it on campus" — the question someone arrives at
 * from a search engine or a link, with no map in front of them. Purdue's
 * arboretum explorer has the same shape, a static page per plant.
 *
 * Written as plain HTML into public/, which Vite copies through untouched, for
 * three reasons: the URLs are real (`/species/acer-saccharum/`) rather than a
 * query string, a search engine can read them without running any JavaScript,
 * and nothing about the map's bundle has to change.
 *
 * Everything on them is in taxa.csv and plants.csv, apart from the native
 * range maps, which are Little's Atlas of United States Trees in data/ranges/
 * (range-map.mjs) and, for European species it does not map, Caudullo et
 * al.'s chorological maps in data/ranges/europe/ (europe-range-map.mjs). The drawing of the tree at maturity (tree-drawing.mjs), the
 * year (year.mjs) and the campus facts are worked out from those, at every
 * build. See docs/SPECIES-PAGES.md.
 */

import { createHash } from 'node:crypto';
import { SEARCH_FORM, SPECIES_SEARCH_JS } from './species-search.mjs';
import { treeDrawing } from './tree-drawing.mjs';
import { yearTable, yearSummary, MONTH_NAMES } from './year.mjs';
import { describeRange, rangeSvg } from './range-map.mjs';
import { campusSvg } from './campus-map.mjs';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/**
 * "2026-09-01" as "Sep 2026", for the line under a photo. The month is as
 * precise as this wants to be: a reader wants to know how old the picture is.
 *
 * Mirrors photoTaken() in src/detail.ts. The two cannot share a module —
 * src/ is TypeScript compiled by Vite, scripts/ is plain .mjs — so the rule
 * is written twice on purpose, as the accession rules were.
 */
const photoTaken = (date) => {
  const m = /^(\d{4})-(\d{2})/.exec(String(date ?? ''));
  if (!m) return '';
  const month = MONTHS[Number(m[2])];
  return month ? `${month} ${m[1]}` : '';
};

const monthRange = (m) => (m.length ? m.map((n) => MONTHS[n] ?? '').filter(Boolean).join('–') : '');
const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ') : '');

const TYPE_LABELS = {
  'deciduous-tree': 'Deciduous tree', 'evergreen-tree': 'Evergreen tree',
  shrub: 'Shrub/bush', perennial: 'Perennial', annual: 'Annual',
  vine: 'Vine/climber', grass: 'Grass',
};
const ORIGIN_LABELS = {
  'vermont-native': 'Vermont native', 'vermont-invasive': 'Vermont invasive',
  introduced: 'Introduced',
};

/** Botanical convention: genus and species italic, cultivar upright in quotes. */
function sciHtml(t) {
  const parts = [];
  if (t.genus) parts.push(`<i>${esc(t.genus)}</i>`);
  if (t.species) parts.push(`<i>${esc(t.species)}</i>`);
  if (t.infra) parts.push(esc(t.infra));
  if (t.cultivar) parts.push(`&lsquo;${esc(t.cultivar)}&rsquo;`);
  return parts.join(' ') || esc(t.sci);
}

export const row = (label, value) =>
  value === null || value === undefined || value === '' ? ''
    : `<div class="fact"><dt>${esc(label)}</dt><dd>${value}</dd></div>`;

/**
 * The page around a body. `depth` counts folders below /species/; a page
 * outside it (the i-Tree page) passes `root`, its relative path to the site.
 */
export function shell({ title, description, base, body, depth = 0, root = null, search = false, allSpecies = true }) {
  // Relative, so the pages work under a project path (/Florestas_VT/) and at a
  // domain root alike, without the generator having to know which.
  const up = '../'.repeat(depth);
  // ?v= changes whenever the file does, so a browser holding an older copy
  // fetches the new one rather than styling a new page with old rules.
  const css = `${root === null ? `${up}species.css` : `${root}species/species.css`}?v=${assetVersion()}`;
  const mark = root === null ? `${up}../uvm-mark.png` : `${root}uvm-mark.png`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="stylesheet" href="${css}">
${search ? `<script src="${up}search.js?v=${assetVersion()}" defer></script>\n` : ''}</head>
<body>
<header class="bar">
  <a class="bar-home" href="${esc(base)}"><img class="bar-mark" src="${mark}" alt="" width="30" height="30">UVM Trees</a>
  ${allSpecies ? `<a class="bar-link" href="${esc(base)}species/">All species</a>` : ''}
  ${search ? SEARCH_FORM : ''}
</header>
${body}
</body>
</html>
`;
}

/** "1 tree", "53 trees". */
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** "a, b and c". */
const listing = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

/**
 * Where the trees of a species stand, by campus, largest share first:
 * "30 on Redstone Campus, 10 on Athletic Campus and 4 on Central Campus".
 */
function byCampus(trees) {
  const counts = new Map();
  for (const t of trees) if (t.campus) counts.set(t.campus, (counts.get(t.campus) ?? 0) + 1);
  return listing([...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c, n]) => `${n} on ${esc(c)}`));
}

/** The campus every one of them is on, or null when they are spread or not placed. */
function oneCampus(trees) {
  const names = new Set(trees.map((t) => t.campus));
  return names.size === 1 && trees[0].campus ? trees[0].campus : null;
}

/** "53 trees mapped on campus: 30 on Redstone Campus, …", "2 trees mapped on campus, both on Central Campus". */
export function whereSentence(trees) {
  const count = plural(trees.length, 'tree');
  const only = oneCampus(trees);
  if (only) {
    const all = trees.length === 1 ? '' : trees.length === 2 ? 'both ' : 'all ';
    return `${count} mapped on campus, ${all}on ${esc(only)}.`;
  }
  const where = byCampus(trees);
  return where ? `${count} mapped on campus: ${where}.` : `${count} mapped on campus.`;
}

/**
 * Know it by: a photo of its bark, leaves, flowers and fruit, from Wikimedia
 * Commons (data/part-photos.csv), each with what taxa.csv says of that part.
 * A tap shows the photo full size (LIGHTBOX_JS). Its credit, as its license
 * requires, is a numbered note at the end of the page (photoCredits), so the
 * captions stay short; the full-size view shows it too.
 */

/** A photo's credit: author, license and site, linked. */
function creditHtml(p) {
  const license = p.licenseUrl ? `<a href="${esc(p.licenseUrl)}" rel="noopener license">${esc(p.license)}</a>` : esc(p.license);
  return `<a href="${esc(p.page)}" rel="noopener">${esc(p.author)}</a>, ${license}, ${esc(p.site)}`;
}

/**
 * Numbers a photo's credit for the notes at the end of the page and returns
 * its marker: a small number linking down to the note, which links back up.
 */
function footnote(credits, what, p) {
  credits.push({ what, p });
  const n = credits.length;
  return `<sup class="fn"><a href="#credit-${n}" id="credit-ref-${n}" aria-label="Photo credit ${n}">${n}</a></sup>`;
}

/** The notes: every photo credit on the page, numbered as marked. */
function photoCredits(credits) {
  if (!credits.length) return '';
  return `<section class="credits" aria-labelledby="credits-head">
    <p id="credits-head"><b>Photo credits.</b></p>
    <ol>${credits.map(({ what, p }, i) => `<li id="credit-${i + 1}">${what}: ${creditHtml(p)}. <a href="#credit-ref-${i + 1}" class="fn-back" aria-label="Back to the photo">&uarr;</a></li>`).join('')}</ol>
  </section>`;
}
/** What the leaf tile says: evergreen or not, a summer color other than green, the fall color. */
function leafCaption(t) {
  const summer = t.leafColor ? t.leafColor.replace(/-/g, ' ') : '';
  if (t.type === 'evergreen-tree') return summer ? `Evergreen, ${esc(summer)}.` : 'Evergreen.';
  const parts = [summer && `${esc(titleCase(summer))} all summer.`, t.fallColor && `Fall color: ${esc(t.fallColor.replace(/-/g, ' '))}.`];
  return parts.filter(Boolean).join(' ');
}

/** One photo of a tile, a button that shows it full size. */
function partShot(t, label, p, credits, creditWhat) {
  const big = p.site === 'iNaturalist' ? p.image.replace('/medium.', '/large.') : p.image.replace('/500px-', '/960px-');
  return {
    mark: footnote(credits, esc(creditWhat), p),
    html: `<button type="button" class="shot-open" aria-label="Show the photo of the ${esc(label.toLowerCase())} full size" data-full="${esc(big)}" data-credit="${esc(`${label}. Photo: ${p.author}, ${p.license}, ${p.site}`)}">
        <img src="${esc(p.image)}" srcset="${esc(p.image)} 500w, ${esc(big)} ${p.site === 'iNaturalist' ? 1024 : 960}w" sizes="(max-width: 48rem) 50vw, 15rem" alt="${esc(`${label} of ${t.common.toLowerCase()}`)}" loading="lazy">
      </button>`,
  };
}

/** A tile: its photo, or two side by side, and its caption. */
function partTile(t, { label, parts, says, def }, photos, credits) {
  const two = parts.length > 1;
  const word = (part) => PART_WORDS[part] ?? part;
  const shots = parts.map((part) => partShot(t, two ? word(part).charAt(0).toUpperCase() + word(part).slice(1) : label, photos[part], credits,
    two ? `${label}, ${word(part)}` : label));
  return `<figure class="part${two ? ' part--two' : ''}${def ? ' part--default' : ''}">
      ${two ? `<div class="pair">${shots.map((s) => s.html).join('')}</div>` : shots[0].html}
      <figcaption><b>${esc(label)}.</b>${shots.map((s) => s.mark).join('')} ${says}</figcaption>
    </figure>`;
}
const PART_WORDS = { leaves: 'leaves', flowers: 'flowers', fruit: 'fruit', bark: 'bark', buds: 'buds', twigs: 'twigs', thorns: 'thorns', catkins: 'catkins', seeds: 'seeds', fronds: 'fronds', fiddleheads: 'fiddleheads', spores: 'spore cases', underside: 'underside', color: 'seasonal color', habit: 'whole plant', roots: 'roots' };

/** The four tiles a page shows without written ones: bark, leaves, flowers and fruit, captioned from taxa.csv. */
function defaultTiles(t, photos) {
  const needles = t.family === 'Pinaceae';
  const cones = t.family === 'Pinaceae' || t.family === 'Cupressaceae';
  const when = (color, months) => [titleCase(color), monthRange(months)].filter(Boolean).map(esc).join(' &middot; ');
  return [
    { key: 'bark', def: true, label: 'Bark', parts: ['bark'], says: esc(t.bark) },
    { key: 'leaves', def: true, label: needles ? 'Needles' : 'Leaves', parts: ['leaves'], says: leafCaption(t) },
    { key: 'flowers', def: true, label: cones ? 'Pollen cones' : 'Flowers', parts: ['flowers'], says: when(t.flowerColor, t.flowerMonths) },
    { key: 'fruit', def: true, label: cones ? 'Cones' : t.genus === 'Quercus' ? 'Acorns' : 'Fruit', parts: ['fruit'], says: when(t.fruitColor, t.fruitMonths) },
  ].filter((d) => photos[d.key]);
}

/**
 * The tiles a page shows. Written ones (know-it-by.csv) where the taxon or its
 * species has them; a species' tile on a cultivar's page only where every
 * photo it needs is the species' too (a cultivar with its own leaf photo has
 * leaves unlike the species', so the species' note on them would mislead),
 * else that part's default tile in its place. Without written ones, the four
 * defaults.
 */
export function chooseTiles(t, photos, know) {
  const defaults = defaultTiles(t, photos);
  if (!know?.length) return defaults;
  const tiles = [];
  const used = new Set();
  for (const k of know) {
    const ok = k.parts.every((p) => photos[p] && (!k.inherited || photos[p].inherited));
    if (ok) {
      tiles.push({ label: k.label, parts: k.parts, says: esc(k.text), inherited: k.inherited });
      k.parts.forEach((p) => used.add(p));
      continue;
    }
    const stand = defaults.find((d) => k.parts.includes(d.key) && !used.has(d.key));
    if (stand && tiles.length < 4) { tiles.push(stand); used.add(stand.key); }
  }
  // Fewer than four written (or lent): the defaults not yet shown fill in.
  for (const d of defaults) {
    if (tiles.length >= 4) break;
    if (!used.has(d.key)) { tiles.push(d); used.add(d.key); }
  }
  return tiles;
}

function knowItBy(t, photos, credits, know) {
  if (!photos) return '';
  const tiles = chooseTiles(t, photos, know);
  if (!tiles.length) return '';
  const shown = tiles.flatMap((tile) => tile.parts.map((part) => [part, tile.parts.length > 1 ? `${tile.label} (${PART_WORDS[part] ?? part})` : tile.label]));
  const notes = tiles.some((tile) => tile.inherited);
  return `<h2>Know it by</h2>
  ${ofSpeciesNote(t, photos, shown, notes)}
  <section class="parts">${tiles.map((tile) => partTile(t, tile, photos, credits)).join('')}</section>`;
}

/** For a taxon named only to genus: a leaf of each species of the genus here, labelled and linked. */
function whichOne(t, kin, credits) {
  if (!kin?.length) return '';
  const tiles = kin.map((k) => {
    const p = k.photo;
    const mark = footnote(credits, `${esc(k.common)} leaves`, p);
    return `<figure class="part">
      <a href="../${esc(k.id)}/"><img src="${esc(p.image)}" alt="${esc(`Leaves of ${k.common.toLowerCase()}`)}" loading="lazy"></a>
      <figcaption><b><a href="../${esc(k.id)}/">${esc(k.common)}</a></b>${mark} <i>${esc(k.sci)}</i>${k.count ? ` &middot; ${k.count} on campus` : ''}</figcaption>
    </figure>`;
  }).join('');
  return `<h2>Which one?</h2>
  <p class="note of-species">These trees are named only as <i>${esc(t.genus)}</i>, not yet to species. Below is a leaf of each <i>${esc(t.genus)}</i> species in the collection, most planted first.</p>
  <section class="parts">${tiles}</section>`;
}

/** Says which photos are of the species a cultivar was selected from: all of them, or the parts named. */
function ofSpeciesNote(t, photos, shown, notes = false) {
  const species = `<i>${esc(`${t.genus} ${t.species}`)}</i>`;
  const all = shown.every(([key]) => photos[key]?.inherited);
  if (all && notes) return `<p class="note of-species">Photos and notes of ${species}, the species this was selected from.</p>`;
  if (photos.inherited || all) return `<p class="note of-species">Photos of ${species}, the species this was selected from.</p>`;
  const labels = shown.filter(([key]) => photos[key].inherited).map(([, label]) => label.toLowerCase());
  if (!labels.length) return '';
  const list = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
  return `<p class="note of-species">The ${esc(list)} shown are of ${species}, the species this was selected from.</p>`;
}

/** The year in a table, as the field guide shows it, with the same words under it. */
function yearSection(t) {
  const rows = yearTable(t);
  const summary = yearSummary(t);
  const shows = rows.some((r) => r.cells.some(Boolean));
  if (!shows) return '';
  const head = MONTH_NAMES.map((m) => `<th scope="col" title="${m}">${m[0]}</th>`).join('');
  const body = rows.map((r) => `<tr><th scope="row">${esc(r.label)}</th>${r.cells.map((c, i) => c
    ? `<td style="--cell:${esc(c.color)}" title="${esc(`${c.title}, ${MONTH_NAMES[i]}`)}"><span>${esc(c.title)}</span></td>`
    : '<td></td>').join('')}</tr>`).join('');
  return `<h2>Through the year</h2>
  <table class="year"><thead><tr><td></td>${head}</tr></thead><tbody>${body}</tbody></table>
  ${summary ? `<p class="year-words">${esc(summary)}</p>` : ''}
  <p class="note">Typical months for this species, not dates seen on campus.</p>`;
}

/**
 * One species: what it is and looks like, its year, where it grows wild, and
 * where it stands on campus.
 *
 * `trees` are its standing trees ({ id, lat, lng, dbh, campus }); `range` is
 * its native range from data/ranges/, or null; `maps` holds what the range and
 * campus maps need (range-map.mjs, campus-map.mjs), and for a European range
 * its own map (`maps.range`: the addresses of its two outer layers and its
 * inline layer, europe-range-map.mjs); `shared` the addresses of
 * the files every page shares. All but the first three are optional, so a
 * page can be rendered from a taxon alone.
 */
export function renderSpeciesPage(taxon, { photos, areas, base, config, trees = [], range: rangeIn = null, maps = null, shared = {}, extras = null }) {
  const t = taxon;
  // A European or East Asian range is drawn only on its own map, framed to
  // it; without one, none.
  const europe = rangeIn?.source === 'caudullo' || rangeIn?.source === 'gbif';
  const fromRecords = rangeIn?.source === 'gbif';
  // Photo credits, numbered in the order the photos appear (footnote()).
  const credits = [];
  const range = europe && !maps?.range ? null : rangeIn;
  const habitat = extras?.habitat ?? null;
  const added = extras?.facts ?? [];
  const kicker = [esc(t.family), TYPE_LABELS[t.type] ?? titleCase(t.type)].filter(Boolean).join(' &middot; ');
  const origin = ORIGIN_LABELS[t.origin] ?? titleCase(t.origin);

  // Campus photos, newest first, all under On campus; the top of the page is
  // the drawing's (November 2026: the newest photo used to lead the page).
  const shots = [...photos].sort((a, b) => String(b.taken ?? '').localeCompare(String(a.taken ?? '')));
  const shotButton = (p) => `<button type="button" class="shot-open" aria-label="Show the photo full size">
          <img src="${esc(p.url)}" alt="${esc(t.common)} on campus, accession ${esc(p.id)}" loading="lazy">
        </button>`;
  const gallery = shots.length
    ? `<ul class="shots">${shots.map((p) => {
      const taken = photoTaken(p.taken);
      return `<li>
        ${shotButton(p)}
        <span><a href="${esc(base)}?plant=${encodeURIComponent(p.id)}">${esc(p.id)}</a>${taken ? ` &middot; ${esc(taken)}` : ''}</span>
      </li>`;
    }).join('')}</ul>`
    : '';

  const drawing = treeDrawing({ ...t, crownForm: extras?.crownForm ?? null });
  const stats = [
    t.matureHeightFt ? `<div><dt>Mature height</dt><dd>${t.matureHeightFt} ft</dd></div>` : '',
    t.matureSpreadFt ? `<div><dt>Spread</dt><dd>${t.matureSpreadFt} ft</dd></div>` : '',
    t.zones ? `<div><dt>Hardiness zones</dt><dd>${esc(t.zones)}</dd></div>` : '',
  ].join('');
  const drawingCard = drawing
    ? `<figure class="mature">${drawing}<dl class="stats">${stats}</dl>
      <figcaption>At maturity, drawn to scale beside a person.</figcaption></figure>`
    : '';
  // Worth knowing: about the species, not the campus: the fun fact, then the
  // facts in data/facts.csv. (Until November 2026 it ended with the campus's
  // own, campusFacts: the only one mapped, the largest trunk measured.)
  // A cultivar's page adds its species' facts marked as holding for it too
  // (facts.csv's cultivars column), under a line saying whose they are.
  const facts = [t.funFact ? esc(t.funFact) : '', ...added.map((f) => esc(f.text))].filter(Boolean);
  const fromSpecies = (extras?.speciesFacts ?? []).map((f) => esc(f.text));
  const list = (items) => `<ul>${items.map((f) => `<li>${f}</li>`).join('')}</ul>`;
  const factsBox = facts.length || fromSpecies.length
    ? `<aside class="worth"><h2>Worth knowing</h2>${facts.length ? list(facts) : ''}${fromSpecies.length
      ? `<p class="worth-of">Of the species, <i>${esc(`${t.genus} ${t.species}`)}</i>:</p>${list(fromSpecies)}` : ''}</aside>`
    : '';
  const lede = t.description ? `<p class="lede">${esc(t.description)}</p>` : '';

  // The top of the page: the drawing of the tree at maturity, with the
  // description and Worth knowing beside it; without a drawing (shrubs,
  // ferns, a tree without its size on file), the two side by side.
  const hero = drawingCard
    ? `<section class="hero">${drawingCard}<div class="hero-text">${lede}${factsBox}</div></section>`
    : `<section class="intro${factsBox ? '' : ' intro--one'}">
    ${lede || '<div></div>'}
    ${factsBox}
  </section>`;

  // Where it grows wild, as a field guide has it: Habitat (the ground and
  // light it grows in) and Distribution (where in the world), from
  // habitat.csv, beside the range map when the species has one. Where no
  // distribution is written yet, the map's own summary of the states it
  // covers stands in for it (range-map.mjs, describeRange). Soil and
  // hardiness zones are in Characteristics, not repeated here (until November
  // 2026 they were). Whether Burlington is inside is for the map's star to show.
  const habitatText = habitat?.text ?? '';
  const distributionText = habitat?.distribution || (range ? describeRange(range.where) : '');
  const growing = [
    habitatText ? `<h3>Habitat</h3><p>${esc(habitatText)}</p>` : '',
    distributionText ? `<h3>Distribution</h3><p>${esc(distributionText)}</p>` : '',
  ].join('\n      ');
  // A cultivar's or variety's habitat and range are its species', said once.
  const ofSpecies = (t.cultivar || t.infra) && (habitat?.inherited || range)
    ? `<p class="note of-species">For <i>${esc(`${t.genus} ${t.species}`)}</i>, the species this was selected from.</p>`
    : '';
  let rangeSection = '';
  if (range && maps) {
    rangeSection = `<h2>Where it grows wild</h2>
  ${ofSpecies}
  <section class="wild">
    <div>
      ${growing}
    </div>
    <figure class="range">
      ${europe
    ? `<div class="range-map"><img src="${esc(maps.range.base)}" alt="">${maps.range.fill}<img src="${esc(maps.range.lines)}" alt=""></div>
      <figcaption><span class="key"><i></i>Grows wild</span>${range.points?.length ? `<span class="key"><i class="dot"></i>${fromRecords ? 'Isolated records' : 'Small isolated stands'}</span>` : ''}</figcaption>`
    : `<div class="range-map"><img src="${esc(shared.rangeBase)}" alt="">${rangeSvg(range)}<img src="${esc(shared.rangeLines)}" alt=""></div>
      <figcaption><span class="key"><i></i>Grows wild</span><span class="key star">&#9733; Burlington</span><span class="key vt">Vermont</span></figcaption>`}
    </figure>
  </section>`;
  } else if (habitat) {
    rangeSection = `<h2>Where it grows wild</h2>
  ${ofSpecies}
  <section class="wild wild--text">
    <div>
      ${growing}
    </div>
  </section>`;
  }

  const campusMap = trees.length && maps?.campus
    ? `<figure class="campus"><div class="campus-map"><img src="${esc(shared.campusBase)}" alt="">${campusSvg(maps.campus, trees, base)}</div>
      <figcaption>Each red dot is one; tap it to open it on the map.</figcaption></figure>`
    : '';
  const where = trees.length
    ? `<p>${whereSentence(trees)}</p>`
    : t.count > 0
      ? `<p>${t.count} mapped on campus${areas.length ? ` &mdash; ${areas.map(esc).join(', ')}` : ''}.</p>`
      // Most of taxa.csv is a species list running ahead of the survey, and
      // saying so is more use than an empty section.
      : `<p class="quiet">None mapped yet. The species list runs ahead of the
       survey, so this one may be on campus without having been recorded.</p>`;

  // One row of buttons, as the map's record panel has: the map first, then
  // Wikipedia beside it.
  const buttons = [
    t.count > 0 ? `<a class="btn" href="${esc(base)}?taxon=${encodeURIComponent(t.id)}">Show them on the map</a>` : '',
    t.wikipedia ? `<a class="btn" href="${esc(t.wikipedia)}" rel="noopener">Wikipedia</a>` : '',
  ].filter(Boolean);
  const actions = buttons.length ? `<p class="actions">${buttons.join('\n    ')}</p>` : '';

  // Only what is known. A species with no flower colour recorded shows no
  // flower row rather than an em dash, which reads as "nobody has said".
  const characteristics = [
    row('Plant type', esc(TYPE_LABELS[t.type] ?? titleCase(t.type))),
    row('Origin', esc(origin)),
    row('Flowers', [titleCase(t.flowerColor), monthRange(t.flowerMonths)].filter(Boolean).map(esc).join(' &middot; ')),
    row('Fruit', [titleCase(t.fruitColor), monthRange(t.fruitMonths)].filter(Boolean).map(esc).join(' &middot; ')),
    row('Summer leaves', esc(titleCase(t.leafColor))),
    row('Fall color', esc(titleCase(t.fallColor))),
    row('Mature height', t.matureHeightFt === null ? '' : `${t.matureHeightFt} ft`),
    row('Mature spread', t.matureSpreadFt === null ? '' : `${t.matureSpreadFt} ft`),
    row('Bark', esc(t.bark)),
    row('Soil', esc(t.soil)),
    row('Pests and disease', esc(t.pests)),
    row('Hardiness zones', esc(t.zones)),
    row('Lifespan', esc(t.lifespan ?? '')),
  ].join('');

  // Credits only for what a license requires: the European range map (CC BY
  // 4.0), the East Asian one (drawn from CC BY records and Kew's checklist,
  // CC BY 4.0) and the photos (photoCredits). Little's maps are public domain; the
  // habitat's and facts' sources are kept in their files, not shown, as the
  // description's and fun fact's are not.
  const mapCredit = range && fromRecords
    ? `<section class="credits"><p><b>Map credit.</b></p><p class="credit-line">Drawn for this site from herbarium specimens shared through <a href="https://www.gbif.org" rel="noopener">GBIF.org</a> (records under CC0, CC BY or CC BY-NC, November 2026), leaving out any labelled as planted, within the native range in Govaerts et al. 2021, <a href="https://doi.org/10.1038/s41597-021-00997-6" rel="noopener">The World Checklist of Vascular Plants</a>, Royal Botanic Gardens, Kew, <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener license">CC BY 4.0</a>.</p></section>`
    : range && europe
    ? `<section class="credits"><p><b>Map credit.</b></p><p class="credit-line">Caudullo, G., Welk, E., San-Miguel-Ayanz, J., 2017, <a href="https://doi.org/10.1016/j.dib.2017.05.007" rel="noopener">Chorological maps for the main European woody species</a>, <i>Data in Brief</i> 12, European Commission Joint Research Centre, <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener license">CC BY 4.0</a>. Drawn here without the areas where the species was introduced.</p></section>`
    : '';

  const body = `<main class="page sp">
  <header class="sp-head">
    ${kicker ? `<p class="kicker">${kicker}</p>` : ''}
    <h1>${esc(t.common)}</h1>
    <p class="sci">${sciHtml(t)}</p>
    ${origin ? `<p class="badge badge--${esc(t.origin)}">${esc(origin)}</p>` : ''}
  </header>
  ${hero}

  ${knowItBy(t, extras?.photos, credits, extras?.know)}
  ${whichOne(t, extras?.kin, credits)}

  ${yearSection(t)}

  ${rangeSection}

  <h2>Characteristics</h2>
  <dl class="facts">${characteristics}</dl>

  <h2>On campus</h2>
  <section class="oncampus${campusMap ? '' : ' oncampus--one'}">
    <div>
      ${where}
      ${gallery}
      ${actions}
    </div>
    ${campusMap}
  </section>

  ${mapCredit || credits.length ? `<div class="sources">${mapCredit}${photoCredits(credits)}</div>` : ''}
  <p class="foot">Something look wrong? Email
    <a href="mailto:${esc(config.contactEmail)}?subject=${encodeURIComponent(`${config.siteName} species ${t.id}`)}">${esc(config.contactEmail)}</a>.</p>
</main>${photos.length || extras?.photos ? `\n<script>${LIGHTBOX_JS}</script>` : ''}`;

  return shell({
    title: `${t.common} (${t.sci}) — ${config.siteName}`,
    description: t.description || `${t.common}, ${t.sci}, on the ${config.institution} campus.`,
    base, body, depth: 1, search: true,
  });
}

/**
 * The index is written sorted by common name. The buttons re-sort it in the
 * page by scientific name and back, and lead each row with the name it is
 * sorted by. Hidden until the script shows them, as they do nothing without
 * it; the choice rides in the address (?sort=scientific) so it can be shared
 * and survives the back button.
 */
const SORT_CONTROL = `<div class="sort" role="group" aria-label="Sort species" hidden>
    <span class="sort-label">Sort by</span>
    <button type="button" data-sort="common" aria-pressed="true">Common</button>
    <button type="button" data-sort="scientific" aria-pressed="false">Scientific</button>
    <button type="button" data-sort="type" aria-pressed="false">Type</button>
  </div>`;

/** The groups the index can be sorted into, in order, with their headings. */
const TYPE_GROUPS = [
  ['deciduous-tree', 'Deciduous trees'], ['evergreen-tree', 'Evergreen trees'], ['shrub', 'Shrubs'],
  ['vine', 'Vines'], ['perennial', 'Perennials and ferns'], ['grass', 'Grasses'], ['unknown', 'Not yet identified'],
];

/**
 * A tap on a photo shows it full size, as the map's panel does (openPhoto in
 * src/main.ts): the same dark backdrop, closed by a tap anywhere, the ×, or
 * Escape, with focus handed back to the photo it came from.
 */
const LIGHTBOX_JS = `(() => {
  let opener = null;
  const close = () => {
    document.querySelector('.lightbox')?.remove();
    opener?.focus();
    opener = null;
  };
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.shot-open');
    if (!btn) return;
    const img = btn.querySelector('img');
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Photo, full size');
    box.innerHTML = '<button type="button" class="lightbox-close" aria-label="Close the photo">&times;</button>';
    const big = document.createElement('img');
    big.src = btn.dataset.full || img.currentSrc || img.src;
    big.alt = img.alt;
    box.append(big);
    if (btn.dataset.credit) {
      const cap = document.createElement('p');
      cap.className = 'lightbox-credit';
      cap.textContent = btn.dataset.credit;
      box.append(cap);
    }
    box.addEventListener('click', close);
    opener = btn;
    document.body.append(box);
    box.querySelector('.lightbox-close').focus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.querySelector('.lightbox')) close();
  });
})();`;

const SORT_JS = `(() => {
  const group = document.querySelector('.sort');
  const list = document.querySelector('.index');
  if (!group || !list) return;
  const rows = [...list.children];
  const byCommon = rows.slice();
  const bySci = rows.slice().sort((a, b) => a.dataset.sci.localeCompare(b.dataset.sci));
  // By plant type: a heading for each group, then its species by common name.
  const byType = [];
  for (const [type, label] of JSON.parse(list.dataset.groups)) {
    const members = byCommon.filter((r) => r.dataset.type === type);
    if (!members.length) continue;
    const h = document.createElement('li');
    h.className = 'idx-group';
    h.innerHTML = '<h2></h2>';
    h.firstChild.textContent = label + ' ';
    const n = document.createElement('span');
    n.textContent = members.length;
    h.firstChild.append(n);
    byType.push(h, ...members);
  }
  const apply = (mode, push) => {
    const sci = mode === 'scientific';
    list.replaceChildren(...(sci ? bySci : mode === 'type' ? byType : byCommon));
    list.classList.toggle('by-sci', sci);
    // Lead each row with the name it is sorted by.
    for (const a of list.querySelectorAll('a')) {
      const first = a.querySelector(sci ? '.idx-sci' : '.idx-common');
      if (a.firstElementChild !== first) a.prepend(first, ' ');
    }
    for (const b of group.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.sort === mode));
    if (push) {
      const url = new URL(location.href);
      if (mode === 'common') url.searchParams.delete('sort'); else url.searchParams.set('sort', mode);
      history.replaceState(null, '', url);
    }
  };
  group.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-sort]');
    if (b) apply(b.dataset.sort, true);
  });
  const asked = new URLSearchParams(location.search).get('sort');
  if (asked === 'scientific' || asked === 'type') apply(asked, false);
  group.hidden = false;
})();`;

/**
 * The species mapped on campus, for someone browsing rather than searching.
 * Every taxon in the list still gets its own page; a species joins this index
 * the first time a plant of it is mapped, with no other step.
 */
export function renderSpeciesIndex(taxa, { base, config }) {
  const mapped = taxa.filter((t) => t.count > 0);
  const sorted = [...mapped].sort((a, b) => a.common.localeCompare(b.common));
  const items = sorted.map((t) => `<li data-sci="${esc(t.sci)}" data-type="${esc(t.type || 'unknown')}">
    <a href="${encodeURIComponent(t.id)}/">
      <span class="idx-common">${esc(t.common)}</span>
      <span class="idx-sci">${esc(t.sci)}</span>
    </a>
    <span class="idx-count">${t.count} mapped</span>
  </li>`).join('');

  const body = `<main class="page">
  <h1>Species</h1>
  <p class="label">${mapped.length} species mapped on campus so far &middot; <a href="progress/">How complete each page is</a></p>
  ${SORT_CONTROL}
  <ul class="index" data-groups="${esc(JSON.stringify(TYPE_GROUPS))}">${items}</ul>
</main>
<script>${SORT_JS}</script>`;

  return shell({
    title: `Species — ${config.siteName}`,
    description: `Every species of tree, shrub and vine mapped so far on the ${config.siteName} map.`,
    // The index is the page "All species" leads to, so it leaves the link out.
    base, body, depth: 0, search: true, allSpecies: false,
  });
}

/** One stylesheet for all of them, rather than a copy inlined in each. */
export const SPECIES_CSS = `:root {
  --green: #154734; --green-light: #1f6f4a; --gold: #ffd100;
  --bg: #fff; --sunk: #f4f6f4; --border: #dfe3df; --ink: #1b201d; --dim: #5d665f;
  --band: #e7efe9; --note: #f5f1e3; --note-ink: #6b5a14; --mint: #e1efe5; --tan: #efe7d6; --tan-ink: #6b4f12;
  --font: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #141816; --sunk: #1c221f; --border: #2e3733; --ink: #e7ece9; --dim: #9aa8a1;
    --band: #1d2a23; --note: #2a2716; --note-ink: #e8d48a; --mint: #1d3326; --tan: #33291a; --tan-ink: #e6cf9f; }
  .sp h2 { color: #9fd3b4; }
  .badge--vermont-native { color: #9fd3b4; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--font); line-height: 1.55; }

.bar {
  display: flex; align-items: center; gap: 1rem;
  padding: .7rem 1rem; background: var(--green); border-bottom: 3px solid var(--gold);
}
.bar a { color: #fff; text-decoration: none; }
/* The margin sits on the home link, so the rest of the bar keeps right
   whether or not "All species" is there. */
.bar-home { font-weight: 700; display: flex; align-items: center; gap: .55rem; margin-right: auto; }
.bar-mark { flex: 0 0 auto; display: block; }
.bar-link { font-size: .9rem; opacity: .9; white-space: nowrap; }
.bar-home { white-space: nowrap; }
/* A phone has room for the home link, two short links and the search button. */
@media (max-width: 30rem) { .bar { gap: .8rem; } }
.bar a:hover { text-decoration: underline; }

.page { max-width: 44rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
h1 { font-size: 1.9rem; margin: .2rem 0 .1rem; line-height: 1.15; }
h2 {
  font-size: .78rem; letter-spacing: .08em; text-transform: uppercase; color: var(--dim);
  margin: 2rem 0 .6rem; padding-bottom: .3rem; border-bottom: 1px solid var(--border);
}
.sci { margin: 0; font-size: 1.05rem; color: var(--dim); }
.label { margin: .4rem 0 0; font-size: .82rem; color: var(--dim); }
.desc { font-size: .95rem; }
/* Closed by default, the same fold as the map's detail panel, so the two read
   alike and the description is what meets the eye. */
.fun {
  margin: .9rem 0 0; font-size: .9rem;
  padding-left: .8rem; border-left: 2px solid var(--border);
}
.fun summary {
  padding: .1rem 0; cursor: pointer; font-weight: 600;
  color: var(--dim); list-style-position: inside;
}
.fun summary:hover { color: var(--ink); }
.fun p { margin: .3rem 0 .35rem; color: var(--dim); }
.quiet { color: var(--dim); font-size: .9rem; }

.shots { list-style: none; display: grid; gap: .8rem; padding: 0; margin: 1.2rem 0 0;
  grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); }
.shots img { width: 100%; height: auto; border-radius: 8px; display: block; }
/* The photo is a button: a tap shows it full size (LIGHTBOX_JS). */
.shot-open { display: block; width: 100%; padding: 0; border: 0; background: none;
  cursor: zoom-in; border-radius: 8px; }
.shot-open:focus-visible { outline: 2px solid var(--green, #154734); outline-offset: 2px; }
/* Full size, as on the map. */
.lightbox { position: fixed; inset: 0; z-index: 2500; display: grid; place-items: center;
  padding: 1rem; background: rgb(0 0 0 / 90%); cursor: zoom-out; }
.lightbox img { max-width: calc(100vw - 2rem); max-height: calc(100vh - 2rem);
  max-height: calc(100dvh - 2rem); width: auto; height: auto; object-fit: contain; border-radius: 8px; }
.lightbox-close { position: absolute; top: .75rem; right: .75rem; width: 2.75rem; height: 2.75rem;
  border-radius: 50%; border: 0; background: rgb(255 255 255 / 15%); color: #fff;
  font-size: 1.8rem; line-height: 1; cursor: pointer; }
.shots span { display: block; font-size: .76rem; color: var(--dim); margin-top: .25rem; }
.shots a { color: inherit; }

.facts { margin: 0; display: grid; gap: .3rem; }
.fact { display: grid; grid-template-columns: 10rem 1fr; gap: .6rem; font-size: .88rem; line-height: 1.45; }
.fact dt { color: var(--dim); }
.fact dd { margin: 0; }

.btn {
  display: inline-block; margin: .3rem .4rem .3rem 0; padding: .45rem .8rem;
  font-size: .87rem; text-decoration: none; color: inherit;
  background: var(--sunk); border: 1px solid var(--border); border-radius: 8px;
}
.btn:hover { border-color: var(--green-light); }
.actions { display: flex; flex-wrap: wrap; gap: .5rem; margin: 1rem 0; }
.actions .btn { margin: 0; }

/* Species search, in the bar. Wide screens: a box after "All species", 28rem
   wide, which fits about nine in ten species' names on one line. Narrow
   screens: a magnifier that turns the bar into the box (search.js). */
.search { position: relative; flex: 0 1 28rem; display: flex; align-items: center; gap: .5rem; }
.search[hidden] { display: none; }
.search input {
  flex: 1; min-width: 0; box-sizing: border-box; padding: .4rem .7rem; font: inherit; font-size: .9rem;
  color: #fff; background: rgb(255 255 255 / 12%); border: 1px solid rgb(255 255 255 / 30%); border-radius: 8px;
}
.search input::placeholder { color: rgb(255 255 255 / 70%); }
.search input:focus { outline: 2px solid #fff; outline-offset: 1px; }
/* The browser's own clear button is blue on green; hidden, with the close
   button standing in for it on a narrow screen. */
.search input::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; }
.search-open, .search-close {
  display: none; place-items: center; flex: 0 0 auto; width: 2.3rem; height: 2.3rem; padding: 0;
  border: 0; border-radius: 8px; color: #fff; cursor: pointer; font: inherit;
}
.search-open { background: rgb(255 255 255 / 12%); }
.search-close { background: none; font-size: 1.6rem; line-height: 1; }
.hits {
  position: absolute; z-index: 10; left: 0; right: 0; top: calc(100% + .35rem);
  list-style: none; margin: 0; padding: .25rem 0; background: var(--bg);
  border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 6px 18px rgb(0 0 0 / 14%);
}
.bar .hits a { display: block; padding: .45rem .75rem; color: var(--ink); text-decoration: none; }
.bar .hits a:hover, .hits [aria-selected="true"] a { background: var(--sunk); text-decoration: none; }
.hit-common { font-weight: 600; }
.hit-sci { font-style: italic; color: var(--dim); font-size: .88rem; margin-left: .3rem; }
.hit-none { padding: .45rem .75rem; color: var(--dim); font-size: .9rem; }
@media (max-width: 48rem) {
  .bar .search { display: none; flex: 1; }
  .search-open:not([hidden]) { display: grid; }
  .bar.searching .bar-home, .bar.searching .bar-link, .bar.searching .search-open { display: none; }
  .bar.searching .search:not([hidden]) { display: flex; }
  .bar.searching .search-close { display: grid; }
  .bar.searching .hits { right: 2.8rem; }
}
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.index { list-style: none; padding: 0; margin: 1.2rem 0 0; }
.index li.idx-group { display: block; border: 0; padding: 1.4rem 0 .3rem; }
.index li.idx-group:first-child { padding-top: .2rem; }
.index li.idx-group h2 { margin: 0; font-size: .8rem; letter-spacing: .08em; text-transform: uppercase; color: var(--green); border-bottom: 2px solid var(--gold); padding-bottom: .3rem; }
.index li.idx-group h2 span { color: var(--dim); font-weight: 400; letter-spacing: 0; }
@media (prefers-color-scheme: dark) { .index li.idx-group h2 { color: #9fd3b4; } }
.index li {
  display: flex; align-items: baseline; gap: .6rem;
  padding: .5rem 0; border-bottom: 1px solid var(--border);
}
.index a { color: inherit; text-decoration: none; }
.index a:hover .idx-common { text-decoration: underline; }
.idx-common { font-weight: 600; }
.idx-sci { font-style: italic; color: var(--dim); font-size: .88rem; margin-left: .4rem; }
.idx-count { margin-left: auto; font-size: .78rem; color: var(--dim); white-space: nowrap; }
/* Sorted by scientific name, the row leads with it: the eye runs down the
   names in the order they are sorted. */
.index.by-sci .idx-sci { font-size: 1rem; font-weight: 600; color: var(--ink); margin-left: 0; }
.index.by-sci .idx-common { font-weight: 400; color: var(--dim); font-size: .88rem; margin-left: .4rem; }
.index.by-sci a:hover .idx-common { text-decoration: none; }
.index.by-sci a:hover .idx-sci { text-decoration: underline; }

.sort:not([hidden]) { display: flex; align-items: center; gap: .4rem; flex-wrap: wrap; margin: 1rem 0 0; }
.sort-label { font-size: .82rem; color: var(--dim); margin-right: .2rem; }
.sort button {
  font: inherit; font-size: .82rem; padding: .25rem .75rem; cursor: pointer;
  border: 1px solid var(--border); border-radius: 999px; background: var(--bg); color: var(--ink);
}
.sort button:hover { border-color: var(--green-light); }
.sort button[aria-pressed="true"] { background: var(--green); border-color: var(--green); color: #fff; }

.foot { margin-top: 2rem; font-size: .8rem; color: var(--dim); }

/* ---- a species page: the layout of the report's mock-up ---- */
.page.sp { max-width: 62rem; }
.sp h2 {
  color: var(--green-light); border: 0; margin: 2.2rem 0 .8rem; padding: .35rem .7rem;
  background: var(--band); border-radius: 6px;
}
.sp-head h1 { font-size: 2.4rem; letter-spacing: -.01em; margin-top: .1rem; }
.kicker { margin: 0; font-size: .76rem; letter-spacing: .08em; text-transform: uppercase; color: var(--dim); }
.sp .sci { font-size: 1.1rem; }
.badge { display: inline-block; margin: .6rem 0 0; padding: .12rem .6rem; border-radius: 99px;
  font-size: .78rem; font-weight: 600; background: var(--tan); color: var(--tan-ink); }
.badge--vermont-native { background: var(--mint); color: var(--green-light); }
.badge--vermont-invasive { background: #fbe3dc; color: #7a2410; }

.hero { display: grid; grid-template-columns: 18rem 1fr; gap: 1.6rem; margin-top: 1.4rem; align-items: start; }
.hero-text .worth { margin-top: 1.3rem; }
figure { margin: 0; }
.mature { background: var(--sunk); border-radius: 14px; padding: .8rem .8rem .7rem; }
.tree-drawing { display: block; width: 100%; height: auto; max-height: 26rem; }
.td-guide { stroke: var(--border); stroke-dasharray: 2 4; }
.td-ft { font-size: 9px; fill: var(--dim); }
.td-ground { stroke: var(--dim); }
.td-shade { fill: rgb(0 0 0 / 8%); }
.td-trunk { fill: #6b4a33; }
.td-limb { fill: none; stroke: #6b4a33; stroke-linecap: round; }
.td-person { fill: var(--ink); opacity: .75; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(5rem, 1fr)); gap: .4rem; margin: .5rem 0 .3rem; }
.stats div { background: var(--bg); border-radius: 8px; padding: .35rem .55rem; }
.stats dt { font-size: .68rem; color: var(--dim); }
.stats dd { margin: 0; font-weight: 700; font-size: 1.05rem; }
.sp figcaption { font-size: .78rem; color: var(--dim); margin-top: .35rem; }
.sp figcaption a { color: inherit; }

.intro { display: grid; grid-template-columns: 1fr 19rem; gap: 1.6rem; margin-top: 1.6rem; align-items: start; }
.intro--one { grid-template-columns: 1fr; }
.lede { margin: 0; font-size: 1.15rem; line-height: 1.6; }
.worth { background: var(--note); border-left: 4px solid var(--gold); border-radius: 0 12px 12px 0; padding: .8rem 1rem .5rem; }
.sp .worth h2 { margin: 0 0 .4rem; padding: 0; background: none; color: var(--note-ink); }
.worth ul { margin: 0; padding-left: 1.1rem; font-size: .87rem; }
.worth li { margin-bottom: .45rem; }
.worth a { color: inherit; }
.worth-of { margin: .2rem 0 .3rem; font-size: .8rem; color: var(--note-ink); }

.parts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
.part img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 10px; background: var(--sunk); }
.part figcaption { font-size: .84rem; color: var(--ink); margin-top: .45rem; }
.part .shot-open { border-radius: 10px; }
.part .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; }
.part .pair img { aspect-ratio: 2 / 3; border-radius: 0; }
.part .pair .shot-open:first-child img { border-radius: 10px 0 0 10px; }
.part .pair .shot-open:last-child img { border-radius: 0 10px 10px 0; }
.fn { font-size: .68em; line-height: 0; margin-left: .1em; }
.fn a { color: var(--dim); text-decoration: none; padding: 0 .1em; }
.fn a:hover, .fn a:focus-visible { color: var(--ink); text-decoration: underline; }
.credits { font-size: .76rem; color: var(--dim); }
.credits p { margin: .9rem 0 .2rem; }
.credits ol { margin: 0; padding-left: 1.4rem; }
.credits li { margin-bottom: .15rem; }
.credits a { color: inherit; }
.credits li:target { color: var(--ink); background: var(--note, #fff6d6); border-radius: 4px; }
.fn-back { text-decoration: none; }
.lightbox { grid-template-rows: auto auto; align-content: center; }
.lightbox:has(.lightbox-credit) img { max-height: calc(100vh - 5rem); max-height: calc(100dvh - 5rem); }
.lightbox-credit { margin: .5rem 0 0; color: rgb(255 255 255 / 75%); font-size: .8rem; text-align: center; }
.year { width: 100%; border-collapse: separate; border-spacing: 3px; table-layout: fixed; }
.year thead th { font-size: .74rem; font-weight: 500; color: var(--dim); text-align: center; }
.year thead td, .year tbody th { width: 5rem; }
.year tbody th { font-size: .82rem; font-weight: 500; text-align: left; padding: 0; }
.year tbody td { height: 1.1rem; padding: 0; border-radius: 4px; background: var(--cell, var(--sunk)); box-shadow: inset 0 0 0 1px rgb(0 0 0 / 7%); }
.year tbody td span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.year-words { margin: .6rem 0 0; font-size: .92rem; }
.note { margin: .2rem 0 0; font-size: .78rem; color: var(--dim); }

.wild { display: grid; grid-template-columns: 1fr 1.5fr; gap: 1.6rem; align-items: start; }
.wild p { margin: 0 0 .8rem; font-size: .93rem; }
.wild h3 { margin: 0 0 .25rem; font-size: .95rem; }
.wild p + h3 { margin-top: 1rem; }
.wild--text { grid-template-columns: minmax(0, 40rem); }
.of-species { margin: -.3rem 0 .8rem; }
.range-map, .campus-map { position: relative; }
.range-map img, .campus-map img { display: block; width: 100%; height: auto; }
.range-map img { border-radius: 10px; border: 1px solid var(--border); }
.range-map img + svg, .range-map img:last-child, .campus-map svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.range-map img:last-child { border-color: transparent; }
.range-fill path, .range-fill circle { fill: #3d8a5e; fill-opacity: .85; }
.key { margin-right: .9rem; white-space: nowrap; }
.key i { display: inline-block; width: .8rem; height: .8rem; margin-right: .3rem; vertical-align: -1px; background: #3d8a5e; border-radius: 2px; }
.key.star { color: #8a6d00; }
.key.vt { border-bottom: 2px solid var(--green); }
.key i.dot { width: .5rem; height: .5rem; border-radius: 50%; vertical-align: 1px; }

.oncampus { display: grid; grid-template-columns: 1fr 14rem; gap: 1.4rem; align-items: start; }
.oncampus--one { grid-template-columns: 1fr; }
.oncampus p:first-child { margin-top: 0; }
.campus-map img { border-radius: 10px; border: 1px solid var(--border); }
.campus-trees circle { fill: #c0392b; stroke: #fff; stroke-width: 1.4; }
.campus-trees a:hover circle, .campus-trees a:focus circle { fill: var(--gold); stroke: var(--green); }
.foot a, .sources a { color: inherit; }
.sources { margin-top: 2.2rem; padding-top: .1rem; border-top: 1px solid var(--border); font-size: .76rem; color: var(--dim); }
.credits .credit-line { margin: 0; }

@media (max-width: 48rem) {
  .sp-head h1 { font-size: 1.9rem; }
  .hero, .intro, .wild, .oncampus { grid-template-columns: 1fr; }
  .parts { grid-template-columns: repeat(2, 1fr); gap: .7rem; }
  .mature { max-width: 22rem; }
  .campus { max-width: 15rem; }
}

@media (max-width: 30rem) {
  /* Stacked label over value, so each row is two lines: kept tight. */
  .facts { gap: .3rem; }
  .fact { grid-template-columns: 1fr; gap: 0; line-height: 1.3; }
  .fact dt { font-size: .78rem; }
  /* Two photos a row on a phone, where the 13rem minimum above would leave
     one, full width, and push "Show them on the map" screens down. */
  .shots { grid-template-columns: repeat(2, 1fr); gap: .6rem; }
}
`;

/** A short fingerprint of the stylesheet and search script, for their URLs. */
let version;
function assetVersion() {
  return version ??= createHash('sha256').update(SPECIES_CSS).update(SPECIES_SEARCH_JS).digest('hex').slice(0, 10);
}
