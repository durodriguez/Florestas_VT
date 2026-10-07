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
 * i-Tree Eco's condition classes are crown-dieback bands named Excellent,
 * Good, Fair, Poor, Critical, Dying and Dead — the city's four words are a
 * subset, so they carry across as they are.
 */
export function itreeCondition(c) {
  const v = String(c ?? '').trim().toLowerCase();
  return { excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor', critical: 'Critical', dying: 'Dying', dead: 'Dead' }[v] ?? '';
}
