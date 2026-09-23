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
 * Everything on them is already in taxa.csv and plants.csv. Nothing new is
 * authored here; this is a second view of data the map already carries.
 */

const esc = (s) =>
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

const row = (label, value) =>
  value === null || value === undefined || value === '' ? ''
    : `<div class="fact"><dt>${esc(label)}</dt><dd>${value}</dd></div>`;

function shell({ title, description, base, body, depth }) {
  // Relative, so the pages work under a project path (/Florestas_VT/) and at a
  // domain root alike, without the generator having to know which.
  const up = '../'.repeat(depth);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="stylesheet" href="${up}species.css">
</head>
<body>
<header class="bar">
  <a class="bar-home" href="${esc(base)}">UVM Trees</a>
  <a class="bar-link" href="${esc(base)}species/">All species</a>
</header>
${body}
</body>
</html>
`;
}

/** One species: what it is, what it looks like, and where it is on campus. */
export function renderSpeciesPage(taxon, { photos, areas, base, config }) {
  const t = taxon;
  const label = [
    esc(t.family),
    TYPE_LABELS[t.type] ?? titleCase(t.type),
    ORIGIN_LABELS[t.origin] ?? titleCase(t.origin),
  ].filter(Boolean).join(' &middot; ');

  const gallery = photos.length
    ? `<ul class="shots">${photos.map((p) => {
      const taken = photoTaken(p.taken);
      return `<li>
        <img src="${esc(p.url)}" alt="${esc(t.common)} on campus, accession ${esc(p.id)}" loading="lazy">
        <span><a href="${esc(base)}?plant=${encodeURIComponent(p.id)}">${esc(p.id)}</a>${taken ? ` &middot; ${esc(taken)}` : ''}</span>
      </li>`;
    }).join('')}</ul>`
    : '';

  // Only what is known. A species with no flower colour recorded shows no
  // flower row rather than an em dash, which reads as "nobody has said".
  const facts = [
    row('Plant type', esc(TYPE_LABELS[t.type] ?? titleCase(t.type))),
    row('Origin', esc(ORIGIN_LABELS[t.origin] ?? titleCase(t.origin))),
    row('Flowers', [titleCase(t.flowerColor), monthRange(t.flowerMonths)].filter(Boolean).map(esc).join(' &middot; ')),
    row('Fruit', [titleCase(t.fruitColor), monthRange(t.fruitMonths)].filter(Boolean).map(esc).join(' &middot; ')),
    row('Fall color', esc(titleCase(t.fallColor))),
    row('Mature height', t.matureHeightFt === null ? '' : `${t.matureHeightFt} ft`),
    row('Mature spread', t.matureSpreadFt === null ? '' : `${t.matureSpreadFt} ft`),
    row('Bark', esc(t.bark)),
    row('Soil', esc(t.soil)),
    row('Pests and disease', esc(t.pests)),
    row('Hardiness zones', esc(t.zones)),
  ].join('');

  const where = t.count > 0
    ? `<p>${t.count} mapped on campus${areas.length ? ` &mdash; ${areas.map(esc).join(', ')}` : ''}.</p>
       <p><a class="btn" href="${esc(base)}?taxon=${encodeURIComponent(t.id)}">Show them on the map</a></p>`
    // Most of taxa.csv is a species list running ahead of the survey, and
    // saying so is more use than an empty section.
    : `<p class="quiet">None mapped yet. The species list runs ahead of the
       survey, so this one may be on campus without having been recorded.</p>`;

  const body = `<main class="page">
  <h1>${esc(t.common)}</h1>
  <p class="sci">${sciHtml(t)}</p>
  <p class="label">${label}</p>
  ${gallery}
  ${t.description ? `<p class="desc"><strong>Description:</strong> ${esc(t.description)}</p>` : ''}
  ${t.funFact ? `<details class="fun">
    <summary>Fun fact</summary>
    <p>${esc(t.funFact)}</p>
  </details>` : ''}

  <h2>Characteristics</h2>
  <dl class="facts">${facts}</dl>

  <h2>On campus</h2>
  ${where}

  ${t.wikipedia ? `<p><a class="btn" href="${esc(t.wikipedia)}" rel="noopener">Wikipedia</a></p>` : ''}
  <p class="foot">Something look wrong? Email
    <a href="mailto:${esc(config.contactEmail)}?subject=${encodeURIComponent(`${config.siteName} species ${t.id}`)}">${esc(config.contactEmail)}</a>.</p>
</main>`;

  return shell({
    title: `${t.common} (${t.sci}) — ${config.siteName}`,
    description: t.description || `${t.common}, ${t.sci}, on the ${config.institution} campus.`,
    base, body, depth: 1,
  });
}

/** Every species, for someone browsing rather than searching. */
export function renderSpeciesIndex(taxa, { base, config }) {
  const sorted = [...taxa].sort((a, b) => a.common.localeCompare(b.common));
  const items = sorted.map((t) => `<li>
    <a href="${encodeURIComponent(t.id)}/">
      <span class="idx-common">${esc(t.common)}</span>
      <span class="idx-sci">${esc(t.sci)}</span>
    </a>
    <span class="idx-count">${t.count ? `${t.count} mapped` : ''}</span>
  </li>`).join('');

  const mapped = taxa.filter((t) => t.count > 0).length;
  const body = `<main class="page">
  <h1>Species</h1>
  <p class="label">${taxa.length} in the list &middot; ${mapped} mapped on campus so far</p>
  <ul class="index">${items}</ul>
</main>`;

  return shell({
    title: `Species — ${config.siteName}`,
    description: `Every tree, shrub and vine in the ${config.siteName} species list.`,
    base, body, depth: 0,
  });
}

/** One stylesheet for all of them, rather than a copy inlined in each. */
export const SPECIES_CSS = `:root {
  --green: #154734; --green-light: #1f6f4a; --gold: #ffd100;
  --bg: #fff; --sunk: #f4f6f4; --border: #dfe3df; --ink: #1b201d; --dim: #5d665f;
  --font: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #141816; --sunk: #1c221f; --border: #2e3733; --ink: #e7ece9; --dim: #9aa8a1; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--font); line-height: 1.55; }

.bar {
  display: flex; align-items: center; gap: 1rem;
  padding: .7rem 1rem; background: var(--green); border-bottom: 3px solid var(--gold);
}
.bar a { color: #fff; text-decoration: none; }
.bar-home { font-weight: 700; }
.bar-link { margin-left: auto; font-size: .9rem; opacity: .9; }
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
.shots span { display: block; font-size: .76rem; color: var(--dim); margin-top: .25rem; }
.shots a { color: inherit; }

.facts { margin: 0; display: grid; gap: .45rem; }
.fact { display: grid; grid-template-columns: 10rem 1fr; gap: .6rem; font-size: .88rem; }
.fact dt { color: var(--dim); }
.fact dd { margin: 0; }

.btn {
  display: inline-block; margin: .3rem .4rem .3rem 0; padding: .45rem .8rem;
  font-size: .87rem; text-decoration: none; color: inherit;
  background: var(--sunk); border: 1px solid var(--border); border-radius: 8px;
}
.btn:hover { border-color: var(--green-light); }

.index { list-style: none; padding: 0; margin: 1.2rem 0 0; }
.index li {
  display: flex; align-items: baseline; gap: .6rem;
  padding: .5rem 0; border-bottom: 1px solid var(--border);
}
.index a { color: inherit; text-decoration: none; }
.index a:hover .idx-common { text-decoration: underline; }
.idx-common { font-weight: 600; }
.idx-sci { font-style: italic; color: var(--dim); font-size: .88rem; margin-left: .4rem; }
.idx-count { margin-left: auto; font-size: .78rem; color: var(--dim); white-space: nowrap; }

.foot { margin-top: 2rem; font-size: .8rem; color: var(--dim); }

@media (max-width: 30rem) {
  .fact { grid-template-columns: 1fr; gap: 0; }
  .fact dt { font-size: .78rem; }
}
`;
