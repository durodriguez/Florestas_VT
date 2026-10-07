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
