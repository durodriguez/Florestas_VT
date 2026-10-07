// Translating this project's taxa into the names i-Tree Eco looks up.
//
// i-Tree models at species level (genus where that is all there is), so a
// cultivar is its species: 'Princeton' is an American elm to the model, and
// a growth rate does not change with a trade name. A few names this project
// uses are newer than i-Tree's species list; those are mapped back, and every
// translation is reported so it can be checked in i-Tree's species step.

/** Names i-Tree knows by an older or different form. */
const RENAMED = {
  'scandosorbus-intermedia': ['Sorbus intermedia', 'Scandosorbus is a recent split from Sorbus'],
  'quercus-x-warei': ['Quercus', 'a hybrid i-Tree is unlikely to list; modelled as oak'],
};

/**
 * @param {{taxon_id: string, scientific_name: string, genus: string, species: string, infraspecific: string, cultivar: string}} t
 * @returns {{ name: string, note: string }}
 */
export function itreeName(t) {
  const renamed = RENAMED[t.taxon_id];
  if (renamed) return { name: renamed[0], note: renamed[1] };

  const genus = String(t.genus ?? '').trim();
  const species = String(t.species ?? '').trim();
  const infra = String(t.infraspecific ?? '').trim();
  const cultivar = String(t.cultivar ?? '').trim();

  // Genus only ("Malus sp."): i-Tree has genus-level entries.
  if (!species) return { name: genus, note: cultivar ? `cultivar '${cultivar}' modelled as its genus` : 'genus only' };

  let name = `${genus} ${species}`;
  const notes = [];
  // Thornless honeylocust is var. inermis in most species lists, including
  // the USDA's; this project writes f. inermis, after the Morton Arboretum.
  if (infra === 'f. inermis') {
    name += ' var. inermis';
    notes.push('f. inermis written as var. inermis');
  } else if (infra) {
    notes.push(`${infra} modelled as the species`);
  }
  if (cultivar) notes.push(`cultivar '${cultivar}' modelled as its species`);
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
