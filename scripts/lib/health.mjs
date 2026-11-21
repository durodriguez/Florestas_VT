/**
 * Collection health: what the inventory says about the collection as a
 * whole, for Grounds and whoever plans the planting. How diverse it is, which
 * pests and diseases it is exposed to, how much of it is invasive, and how
 * complete and how fresh the survey is, campus by campus.
 *
 * Worked out at build time from the same data as the map, so it is never out
 * of date, and written to public/data/health.json for the steward console
 * (/steward/#health), which lays it out. collectionHealth() does the counting
 * and is tested. Exposure is not damage: the page says which trees belong to
 * the genera a pest attacks, not which are infested.
 */

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
