// Resolving free-text species names to a taxon_id.
//
// Every source of plant records writes species names as prose: UVM's ArcGIS
// layer has "White pine", "Scot's pine" and "Scots pine", Burlington's
// inventory has "Acer platenoides", and a surveyor with a clipboard will invent
// a third spelling of anything. taxa.csv holds one canonical name per taxon, so
// something has to sit between them.
//
// That something is data/species-aliases.csv rather than code: a new alias is a
// line in a CSV, not a deploy, and the reasoning behind each judgement call
// survives in its note column.
//
// Pure and dependency-free so the test suite can exercise it directly.

/**
 * Fold a name down to something comparable. Lowercase, strip accents, turn
 * every kind of punctuation into a space, collapse the result.
 *
 * The apostrophe matters more than it looks: "Scot's pine" arrives with a
 * curly apostrophe from one keyboard and a straight one from another, and
 * "Scots pine" with neither. All three are the same tree.
 */
export function normalizeName(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // NFD decomposes accents but not ligatures, and older botanical writing
    // still uses them: Cratægus phænopyrum for Crataegus phaenopyrum.
    .replace(/\u00e6/g, 'ae')
    .replace(/\u0153/g, 'oe')
    // Apostrophes are deleted, not spaced: turning them into spaces makes
    // "Scot's pine" into "scot s pine", which no longer matches "Scots pine".
    // Real data, from UVM's layer, which holds both.
    .replace(/['\u2018\u2019\u02bc]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Build a lookup from taxa rows plus alias rows.
 *
 * Canonical names win over aliases: an alias that contradicts taxa.csv is a
 * mistake in the alias file, and silently letting it override the real name
 * would be the hardest kind of mistake to find.
 */
export function buildSpeciesLookup(taxaRows, aliasRows = []) {
  const byId = new Map();
  const lookup = new Map();
  const conflicts = [];

  for (const row of taxaRows) {
    const id = String(row.taxon_id ?? '').trim();
    if (!id) continue;
    byId.set(id, row);
    for (const field of ['taxon_id', 'scientific_name', 'common_name']) {
      const key = normalizeName(row[field]);
      if (key) lookup.set(key, id);
    }
  }

  for (const row of aliasRows) {
    const key = normalizeName(row.alias);
    const id = String(row.taxon_id ?? '').trim();
    if (!key) continue;
    // A blank taxon_id is a deliberate "seen this, cannot resolve it" — an
    // ambiguous genus, or an entry that is not a species at all. Recorded so it
    // reports as known-unresolvable rather than as a name nobody has looked at.
    if (!id) { lookup.set(key, null); continue; }
    if (!byId.has(id)) { conflicts.push({ alias: row.alias, reason: `no taxon "${id}"` }); continue; }
    const existing = lookup.get(key);
    if (existing !== undefined && existing !== id) {
      conflicts.push({ alias: row.alias, reason: `already resolves to "${existing}"` });
      continue;
    }
    lookup.set(key, id);
  }

  return { lookup, conflicts, byId };
}

/**
 * A taxon_id, or null if the name is known but deliberately unresolved, or
 * undefined if nobody has seen this name before. The three are different and
 * an importer should treat them differently.
 */
export function resolveSpecies(name, lookup) {
  return lookup.get(normalizeName(name));
}

/** Split names into resolved, deliberately unresolved, and unseen. */
export function classifyNames(names, lookup) {
  const resolved = new Map();
  const unresolved = [];
  const unknown = [];
  for (const name of names) {
    const hit = resolveSpecies(name, lookup);
    if (hit === undefined) unknown.push(name);
    else if (hit === null) unresolved.push(name);
    else resolved.set(name, hit);
  }
  return { resolved, unresolved, unknown };
}
