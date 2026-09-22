// What became of the 2,502 trees the 2014 inventory tagged.
//
// Only 950 of them are on the map. That is a startling number until it is
// broken down, and breaking it down is what this module does.
//
// The shape of the question: a 2014 tag can be absent from the map because the
// tree is gone, because the tree is there but lost its tag, because the tree
// was given a NEW tag and is on the map under that instead, or because nobody
// walked that part of campus in 2023. Those are four different problems and
// only one of them is a data problem. Nothing here can tell them apart on its
// own — the 2014 sheet carries no coordinates — so this reports the evidence
// and points at the cheapest place to go and look.

/** Accessions at or above this were minted here for trees with no tag. */
export const UNTAGGED_BLOCK_START = 4001;

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

/** Metres between two points. */
export function haversine(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Consecutive integers grouped into runs: [1,2,3,7,8] -> [[1,2,3],[7,8]]. */
export function runsOf(sorted) {
  const runs = [];
  for (const n of sorted) {
    const last = runs[runs.length - 1];
    if (last && n === last[last.length - 1] + 1) last.push(n);
    else runs.push([n]);
  }
  return runs;
}

/**
 * Which era a map accession belongs to.
 *
 * `legacy`   a number the 2014 inventory also used
 * `new-tag`  a real metal tag above everything 2014 issued — put on the tree
 *            by somebody between 2014 and the 2023 survey
 * `untagged` no readable tag; the number was minted here
 */
export function tagEra(n, { highestLegacy, untaggedFrom = UNTAGGED_BLOCK_START } = {}) {
  if (n >= untaggedFrom) return 'untagged';
  return n > highestLegacy ? 'new-tag' : 'legacy';
}

/**
 * @param {object} args
 * @param {object[]} args.plants     data/plants.csv rows
 * @param {object[]} args.reference  public/field/reference.csv rows
 */
export function coverage({ plants, reference, untaggedFrom = UNTAGGED_BLOCK_START }) {
  const legacyTags = [...new Set(
    reference.map((r) => Number(String(r.Tree ?? '').trim())).filter(Number.isInteger),
  )].sort((a, b) => a - b);
  const highestLegacy = legacyTags[legacyTags.length - 1] ?? 0;
  const legacySet = new Set(legacyTags);

  const onMap = new Map();
  for (const row of plants) {
    const m = String(row.plant_id ?? '').match(/^UVM-(\d+)$/);
    if (!m) continue;
    onMap.set(Number(m[1]), { lat: Number(row.lat), lng: Number(row.lng), area: row.collection_id ?? '' });
  }

  const era = (n) => tagEra(n, { highestLegacy, untaggedFrom });
  const counts = { legacy: 0, 'new-tag': 0, untagged: 0 };
  const byArea = {};
  for (const [n, p] of onMap) {
    const e = era(n);
    counts[e] += 1;
    const a = p.area || '(unfiled)';
    byArea[a] = byArea[a] ?? { legacy: 0, 'new-tag': 0, untagged: 0 };
    byArea[a][e] += 1;
  }

  // The check that says whether any renumbering happened INSIDE the 2014
  // range. If a 2014 tree had simply been given another number below 2555 we
  // would see a map tag in that range that 2014 never issued.
  const unknownInRange = [...onMap.keys()]
    .filter((n) => n <= highestLegacy && !legacySet.has(n));

  const missing = legacyTags.filter((n) => !onMap.has(n));
  const runs = runsOf(missing);

  // A gap is worth walking when its two surviving neighbours are close
  // together: 80 missing numbers between two trees 93 m apart is a short
  // stretch of path where the answer is standing in front of you.
  const nearest = (n, dir) => {
    for (let d = 1; d <= 400; d += 1) {
      const c = n + dir * d;
      if (onMap.has(c) && era(c) === 'legacy') return c;
    }
    return null;
  };
  // What the 2014 sheet said the missing trees were. This is what tells a
  // vanished planting from an unwalked path: 33 species across 192 numbers is
  // somebody's whole afternoon route, while nine paper birches in a row is one
  // planting — or one clump-form tree whose stems were each given a tag.
  const refByTag = new Map();
  for (const row of reference) {
    const n = Number(String(row.Tree ?? '').trim());
    if (Number.isInteger(n)) refByTag.set(n, row);
  }
  const describe = (run) => {
    const species = new Map();
    let young = 0;
    let known = 0;
    for (const n of run) {
      const row = refByTag.get(n);
      if (!row) continue;
      known += 1;
      const name = String(row.Common_Name ?? '').trim() || '(unnamed)';
      species.set(name, (species.get(name) ?? 0) + 1);
      if (/young|new planting/i.test(String(row.Age_Class ?? ''))) young += 1;
    }
    const top = [...species].sort((a, b) => b[1] - a[1])[0];
    return {
      distinctSpecies: species.size,
      dominant: top ? top[0] : '',
      dominantShare: known ? top[1] / known : 0,
      youngShare: known ? young / known : 0,
    };
  };

  const gaps = runs.map((run) => {
    const before = nearest(run[0], -1);
    const after = nearest(run[run.length - 1], +1);
    if (before === null || after === null) return null;
    const span = haversine(onMap.get(before), onMap.get(after));
    return {
      from: run[0],
      to: run[run.length - 1],
      count: run.length,
      before,
      after,
      span,
      area: onMap.get(before).area,
      ...describe(run),
      // Missing tags per metre of path. High means a lot of unanswered
      // numbers packed into a short walk.
      density: span > 0 ? run.length / span : Infinity,
    };
  }).filter(Boolean);

  return {
    highestLegacy,
    counts,
    byArea,
    unknownInRange,
    missing,
    runs,
    gaps,
    summary: {
      legacyTags: legacyTags.length,
      onMap: onMap.size,
      matched: counts.legacy,
      missing: missing.length,
      // The most that renumbering could possibly explain.
      renumberCeiling: counts['new-tag'] + counts.untagged,
      // What is left over even then, and cannot be explained by renumbering.
      unaccounted: missing.length - (counts['new-tag'] + counts.untagged),
      inRunsOf10: runs.filter((r) => r.length >= 10).reduce((n, r) => n + r.length, 0),
      singletons: runs.filter((r) => r.length === 1).length,
    },
  };
}
