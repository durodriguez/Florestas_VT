// Translating this project's taxa into the names i-Tree Eco looks up.
//
// Checked against i-Tree's own species list (i-Tree_Eco_species_list_1.17.2023
// .csv, from the Eco resources page): every name this produces for the city's
// campus trees is on it. i-Tree models at species level, or variety where it
// lists one, so a cultivar is its species — 'Princeton' is an American elm to
// the model; growth does not change with a trade name. i-Tree writes varieties
// as "v.", not "var.". A few names here are newer than i-Tree's list and are
// mapped back. Every translation is reported, so the import can be checked.

/** Names i-Tree knows by an older or different form. */
const RENAMED = {
  'scandosorbus-intermedia': ['Sorbus intermedia', 'Scandosorbus is a recent split from Sorbus'],
  'quercus-x-warei': ['Quercus', 'Ware oak is not on i-Tree\'s list; modelled as oak'],
};

/**
 * @param {{taxon_id: string, scientific_name: string, genus: string, cultivar: string}} t
 * @returns {{ name: string, note: string }}
 */
export function itreeName(t) {
  const renamed = RENAMED[t.taxon_id];
  if (renamed) return { name: renamed[0], note: renamed[1] };

  const sci = String(t.scientific_name ?? '').trim();
  const cultivar = String(t.cultivar ?? '').trim() || (sci.match(/['‘’"]([^'‘’"]+)['‘’"]/)?.[1] ?? '');
  // The cultivar comes off, and "Malus sp." is the genus to i-Tree.
  const botanical = sci.replace(/\s*['‘’"][^'‘’"]+['‘’"]/g, '').replace(/\s+sp\.$/, '').trim() || String(t.genus ?? '');
  const genusOnly = !botanical.includes(' ');
  const notes = [];
  if (cultivar) notes.push(`cultivar '${cultivar}' modelled as its ${genusOnly ? 'genus' : 'species'}`);
  else if (genusOnly) notes.push('genus only');
  // i-Tree writes varieties "v.". Thornless honeylocust, a form here (f. inermis,
  // after the Morton Arboretum), is listed there as v. inermis.
  const name = botanical.replace(/ (?:var\.|f\.) /, ' v. ');
  if (name !== botanical) notes.push(`written "${name}" as on i-Tree's list`);
  return { name, note: notes.join('; ') };
}

/**
 * i-Tree Eco records crown health as one of 22 condition classes, each a band
 * of percent condition (100 minus percent dieback), written "90% - 95%". The
 * words Excellent, Good, Fair, Poor, Critical, Dying and Dead are only its
 * reporting groups, and an import that gives the words leaves the trees with
 * no condition. So each of the city's words becomes the input class in the
 * middle of its reporting group (Good is 90-99%, Fair 75-89%, Poor 50-74%);
 * for Good, i-Tree's own help calls 90% - 95% the good class.
 */
const CONDITION = {
  excellent: '100%',
  good: '90% - 95%',
  fair: '80% - 85%',
  poor: '60% - 65%',
  critical: '35% - 40%',
  dying: '10% - 15%',
  dead: '0%',
};

export function itreeCondition(c) {
  return CONDITION[String(c ?? '').trim().toLowerCase()] ?? '';
}

// ---- the results, coming back ----------------------------------------------

/**
 * i-Tree Eco's per-tree results report (Reports → Individual Level Results →
 * Tree Benefits and Costs → Summary), saved as CSV, against the column each
 * value is kept in here. The species name, DBH and coordinates i-Tree echoes
 * back are checked against data/city-trees.csv rather than kept.
 *
 * Carbon Avoided and Energy Savings are not kept: they need each tree's
 * distance and direction to a building, which the city did not record, and
 * i-Tree reports them as N/A for every tree.
 */
export const ITREE_RESULT_COLUMNS = [
  ['User ID', 'city_id'],
  ['Replacement Value ($)', 'replacement_usd'],
  ['Carbon Storage (lb)', 'carbon_storage_lb'],
  ['Carbon Storage ($)', 'carbon_storage_usd'],
  ['Gross Carbon Sequestration (lb/yr)', 'carbon_sequestration_lb_yr'],
  ['Gross Carbon Sequestration ($/yr)', 'carbon_sequestration_usd_yr'],
  ['Avoided Runoff (gal/yr)', 'avoided_runoff_gal_yr'],
  ['Avoided Runoff ($/yr)', 'avoided_runoff_usd_yr'],
  ['Pollution Removal (oz/yr)', 'pollution_removal_oz_yr'],
  ['Pollution Removal ($/yr)', 'pollution_removal_usd_yr'],
  ['Oxygen Production (lb/yr)', 'oxygen_lb_yr'],
  ['Total Annual Benefits ($/yr)', 'total_benefits_usd_yr'],
];

/** i-Tree writes "1,247.2"; a header may carry a non-breaking space. */
const itreeNumber = (v) => Number(String(v ?? '').replace(/,/g, '').trim());
const header = (h) => String(h).replace(/\s+/g, ' ').trim();

/**
 * Checks an i-Tree results file against the trees that were sent, and reduces
 * it to the columns kept. Nothing is half-imported: any error means the caller
 * writes nothing.
 *
 * @param {Record<string, string>[]} rows   the i-Tree CSV, parsed with headers
 * @param {Record<string, string>[]} cityRows  data/city-trees.csv
 * @returns {{ rows: Record<string, string>[], errors: string[] }}
 */
export function readItreeResults(rows, cityRows) {
  const errors = [];
  const city = new Map(cityRows.map((r) => [r.city_id, r]));
  const norm = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [header(k), v])));
  const present = new Set(norm.flatMap((r) => Object.keys(r)));
  for (const [col] of ITREE_RESULT_COLUMNS) {
    if (!present.has(col)) errors.push(`no "${col}" column — is this the Tree Benefits and Costs summary, with User Tree ID ticked?`);
  }
  if (errors.length) return { rows: [], errors };

  const seen = new Set();
  const out = [];
  norm.forEach((r, i) => {
    const where = `row ${i + 2}`;
    const id = String(r['User ID'] ?? '').trim();
    const tree = city.get(id);
    if (!tree) return errors.push(`${where}: "${id}" is not in data/city-trees.csv`);
    if (seen.has(id)) return errors.push(`${where}: ${id} appears twice`);
    seen.add(id);
    // The same tree, not just the same ID: i-Tree echoes back what it was sent.
    const far = Math.abs(itreeNumber(r.yCoordinate) - Number(tree.lat)) > 1e-5
      || Math.abs(itreeNumber(r.xCoordinate) - Number(tree.lng)) > 1e-5;
    if (far) errors.push(`${where}: ${id} is not where data/city-trees.csv puts it`);
    if (tree.dbh_in !== '' && itreeNumber(r['DBH (in)']) !== Number(tree.dbh_in)) {
      errors.push(`${where}: ${id} has DBH ${r['DBH (in)']} in i-Tree but ${tree.dbh_in} here`);
    }
    const row = { city_id: id };
    for (const [col, key] of ITREE_RESULT_COLUMNS.slice(1)) {
      const n = itreeNumber(r[col]);
      if (!Number.isFinite(n) || n < 0) errors.push(`${where}: ${id} has "${r[col]}" for ${col}`);
      row[key] = String(n);
    }
    out.push(row);
    return undefined;
  });
  const missing = [...city.keys()].filter((id) => !seen.has(id));
  if (missing.length) errors.push(`${missing.length} tree(s) sent to i-Tree have no result: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', …' : ''}`);
  return { rows: out, errors };
}
