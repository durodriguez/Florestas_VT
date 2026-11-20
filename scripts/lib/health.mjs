/**
 * The collection-health page (/health/): what the inventory says about the
 * collection as a whole, for Grounds and whoever plans the planting. How
 * diverse it is, which pests and diseases it is exposed to, how much of it is
 * invasive, and how complete and how fresh the survey is, campus by campus.
 *
 * Worked out at build time from the same data as the map, so it is never out
 * of date. collectionHealth() does the counting and is tested; the page only
 * lays it out. Exposure is not damage: the page says which trees belong to
 * the genera a pest attacks, not which are infested.
 */

import { esc, row, shell } from './species-pages.mjs';
import { STATUSES, UNKNOWN_TAXON } from './vocab.mjs';

/**
 * The guideline often used for urban tree diversity (Santamour, 1990): no
 * species more than 10% of the trees, no genus more than 20%, no family more
 * than 30%.
 */
export const DIVERSITY_LIMITS = { species: 0.1, genus: 0.2, family: 0.3 };

/**
 * Well-known pests and diseases of the northeast, and the genera they attack.
 * Hosts only: whether a pest is on campus, or in a given tree, is for a
 * person to say.
 */
export const THREATS = [
  { name: 'Emerald ash borer', hosts: ['Fraxinus'], label: 'ashes' },
  { name: 'Dutch elm disease', hosts: ['Ulmus'], label: 'elms' },
  { name: 'Oak wilt and spongy moth', hosts: ['Quercus'], label: 'oaks' },
  { name: 'Fire blight', hosts: ['Malus', 'Pyrus', 'Crataegus'], label: 'crabapples, apples, pears and hawthorns' },
  { name: 'Beech bark disease', hosts: ['Fagus'], label: 'beeches' },
  { name: 'Hemlock woolly adelgid', hosts: ['Tsuga'], label: 'hemlocks' },
];

const share = (n, of) => (of ? n / of : 0);

function tally(items, key) {
  const m = new Map();
  for (const it of items) {
    const k = key(it);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m].sort((a, b) => b[1] - a[1]);
}

/**
 * @param {{ taxa: any[], collections: any[] }} dataset
 * @param {{ fields: string[], rows: any[][] }} plants
 * @param {number} year  the current year, for how old measurements are
 */
export function collectionHealth(dataset, plants, year) {
  const f = (name) => plants.fields.indexOf(name);
  const active = plants.rows
    .filter((r) => r[f('status')] === STATUSES.indexOf('active'))
    .map((r) => {
      const taxon = dataset.taxa[r[f('taxon')]];
      const area = r[f('collection')] === null ? null : dataset.collections[r[f('collection')]]?.name ?? null;
      const dbh = r[f('dbh_in')];
      const measured = dbh === null ? null : String(r[f('dbh_on')] ?? r[f('surveyed_on')] ?? '');
      return { taxon, area, measured, photo: Boolean(r[f('photo')]), condition: r[f('condition')], surveyed: r[f('surveyed_on')] };
    });
  const n = active.length;
  // Diversity counts identified plants only: the "Don't know yet" placeholder
  // is not a species, and counting it as one would flatter the figures.
  const known = active.filter((p) => p.taxon.id !== UNKNOWN_TAXON);

  const ranked = {
    species: tally(known, (p) => p.taxon.common),
    genus: tally(known, (p) => p.taxon.genus),
    family: tally(known, (p) => p.taxon.family),
  };
  const diversity = Object.fromEntries(Object.entries(ranked).map(([level, list]) => {
    const [name, count] = list[0] ?? ['', 0];
    const top = share(count, known.length);
    return [level, { name, count, share: top, limit: DIVERSITY_LIMITS[level], within: top <= DIVERSITY_LIMITS[level] }];
  }));

  const genusCount = new Map(ranked.genus);
  const threats = THREATS.map((t) => ({ ...t, trees: t.hosts.reduce((s, g) => s + (genusCount.get(g) ?? 0), 0) }))
    .filter((t) => t.trees > 0);

  const invasive = tally(active.filter((p) => p.taxon.origin === 'vermont-invasive'), (p) => p.taxon.common);
  const origins = tally(active, (p) => p.taxon.origin || 'not assessed');
  const conditions = dataset.vocab.conditions.map((c, i) => [c, active.filter((p) => p.condition === i).length]);
  const unrated = active.filter((p) => p.condition === null || p.condition < 0).length;

  const age = { recent: 0, older: 0, old: 0, none: 0 };
  for (const p of active) {
    if (!p.measured) { age.none++; continue; }
    const years = year - Number(p.measured.slice(0, 4));
    if (years < 5) age.recent++;
    else if (years <= 10) age.older++;
    else age.old++;
  }

  const areas = tally(active, (p) => p.area).map(([area, trees]) => {
    const here = active.filter((p) => p.area === area);
    return {
      area, trees,
      measured: here.filter((p) => p.measured).length,
      photo: here.filter((p) => p.photo).length,
      species: here.filter((p) => p.taxon.species).length,
      recent: here.filter((p) => p.surveyed && Number(p.surveyed.slice(0, 4)) >= year - 1).length,
    };
  });

  return {
    trees: n,
    taxa: new Set(known.map((p) => p.taxon.id)).size,
    genusOnly: active.filter((p) => !p.taxon.species && p.taxon.id !== UNKNOWN_TAXON).length,
    unknown: active.length - known.length,
    measured: active.filter((p) => p.measured).length,
    photo: active.filter((p) => p.photo).length,
    diversity, top: { species: ranked.species.slice(0, 10), genus: ranked.genus.slice(0, 10), family: ranked.family.slice(0, 10) },
    knownTrees: known.length,
    threats, invasive, origins, conditions, unrated, age, areas,
  };
}

const fmt = (x) => x.toLocaleString('en-US');
const pct = (x, digits = 0) => `${(x * 100).toFixed(digits)}%`;
const ORIGIN_NAMES = { 'vermont-native': 'Native to Vermont', introduced: 'Introduced', 'vermont-invasive': 'Marked invasive in Vermont', 'not assessed': 'Not assessed' };

/** A bar for a share, with the guideline's limit marked on it. */
function limitBar(d, level) {
  const scale = 0.35;
  return `<div class="hbar" role="img" aria-label="${esc(`${level}: ${pct(d.share, 1)}, limit ${pct(d.limit)}`)}">
    <span class="hbar-fill${d.within ? '' : ' over'}" style="width:${Math.min(100, (d.share / scale) * 100).toFixed(1)}%"></span>
    <span class="hbar-limit" style="left:${((d.limit / scale) * 100).toFixed(1)}%"></span>
  </div>`;
}

function table(head, rows) {
  return `<div class="table-wrap"><table class="htable">
    <thead><tr>${head.map((h, i) => `<th${i ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${i ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

export function renderHealthPage(h, { base, config, today }) {
  const levels = [['species', 'Species'], ['genus', 'Genus'], ['family', 'Family']];
  const body = `<main class="page health">
  <h1>Collection health</h1>
  <p class="label">What the inventory says about the campus collection as a whole, as of ${esc(today)}</p>

  <p class="desc">
    Worked out from the same data as the map, each time it is updated: ${fmt(h.trees)} standing trees,
    shrubs and vines in UVM's collection. Burlington's street trees are not counted.
  </p>

  <h2>At a glance</h2>
  <dl class="facts">
    ${row('Plants', fmt(h.trees))}
    ${row('Species and other kinds', `${fmt(h.taxa)}`)}
    ${row('Trunk measured', `${fmt(h.measured)} (${pct(h.measured / h.trees)})`)}
    ${row('Named to species', `${fmt(h.trees - h.genusOnly - h.unknown)} (${pct((h.trees - h.genusOnly - h.unknown) / h.trees)}); ${fmt(h.genusOnly)} to genus only${h.unknown ? `, ${fmt(h.unknown)} not yet identified` : ''}`)}
    ${row('Photographed', `${fmt(h.photo)} (${pct(h.photo / h.trees, 1)})`)}
  </dl>

  <h2>Diversity</h2>
  <p class="desc">
    A common guideline for resilient urban trees: no more than 10% of them one species, 20% one genus,
    30% one family, so that one pest or disease cannot take out a large share at once. The red line marks
    each limit. Counted over the ${fmt(h.knownTrees)} identified plants; a genus named without a species
    (${fmt(h.genusOnly)} plants) counts as one species, so the species figure is, if anything, high.
  </p>
  <div class="limits">
    ${levels.map(([k, label]) => {
      const d = h.diversity[k];
      return `<div class="limit-row"><span>${label}</span>${limitBar(d, label)}<span class="limit-note">${pct(d.share, 1)} ${esc(d.name)} <em class="${d.within ? 'ok' : 'over'}">${d.within ? 'within' : 'over'} ${pct(d.limit)}</em></span></div>`;
    }).join('')}
  </div>
  <details class="more"><summary>The ten most common species, genera and families</summary>
    ${levels.map(([k, label]) => `<h3>${label}</h3>${table([label, 'Plants', 'Share'], h.top[k].map(([name, c]) => [esc(name), fmt(c), pct(c / h.knownTrees, 1)]))}`).join('')}
  </details>

  <h2>Pest and disease exposure</h2>
  <p class="desc">
    Plants of the genera that some well-known pests and diseases of the northeast attack. This is
    exposure, not damage: it says where a pest would find hosts, not which trees are affected.
  </p>
  ${table(['Pest or disease', 'Host plants on campus'], h.threats.map((t) => [`${esc(t.name)} <span class="quiet">(${esc(t.label)})</span>`, fmt(t.trees)]))}

  <h2>Origin</h2>
  ${table(['Origin', 'Plants', 'Share'], h.origins.map(([o, c]) => [esc(ORIGIN_NAMES[o] ?? o), fmt(c), pct(c / h.trees, 1)]))}
  ${h.invasive.length ? `<p class="desc">Species the inventory marks as invasive in Vermont: ${h.invasive.map(([name, c]) => `${esc(name)} (${fmt(c)})`).join(', ')}.</p>` : ''}

  <h2>Condition</h2>
  ${table(['Latest rating', 'Plants'], [...h.conditions.map(([c, k]) => [esc(c.charAt(0).toUpperCase() + c.slice(1)), fmt(k)]), ...(h.unrated ? [['Not rated', fmt(h.unrated)]] : [])])}
  <p class="desc quiet">
    Ratings come from different surveys on different scales: the 2014 inventory, the 2023–24 ArcGIS layer
    and visits since. Until more trees have two ratings from the same kind of survey, a change in rating is
    weak evidence of a change in the tree.
  </p>

  <h2>How fresh the measurements are</h2>
  ${table(['Trunk measured', 'Plants'], [
    ['Within 5 years', fmt(h.age.recent)],
    ['5 to 10 years ago', fmt(h.age.older)],
    ['More than 10 years ago', fmt(h.age.old)],
    ['Not measured yet', fmt(h.age.none)],
  ])}

  <h2>Survey progress by campus</h2>
  ${table(['Campus', 'Plants', 'Trunk measured', 'Photo', 'Named to species', 'Visited since last year'],
    h.areas.map((a) => [esc(a.area), fmt(a.trees), pct(a.measured / a.trees), pct(a.photo / a.trees), pct(a.species / a.trees), fmt(a.recent)]))}
  <p class="desc quiet">"Visited since last year" counts plants whose latest survey is from this year or last.</p>

  <p class="actions"><a class="btn" href="${esc(base)}">Back to the map</a></p>
</main>`;
  return shell({
    title: `Collection health — ${config.siteName}`,
    description: `Diversity, pest exposure, origin, condition and survey progress for ${config.siteName}.`,
    base, body, root: '../',
  });
}
