// Comparing two independent species claims for the same tree.
//
// The university has been inventoried twice. The 2014 walk-through
// (public/field/reference.csv, 2,502 tagged trees) and the ArcGIS mapping of
// 2023-24 (data/plants.csv) were done by different people, nine years apart,
// and roughly 950 tags appear in both. Nothing had ever compared what the two
// say about those 950.
//
// The import only ever checked ArcGIS against rows already in plants.csv, and
// at import time that file held six of them. So this is not a re-run of an
// existing check; it is the check that was missing.
//
// What this module does NOT do is decide who is right. Neither file is
// authoritative: 2014 is older but was done tree by tree on foot, ArcGIS is
// newer but was mapped at speed. The output is a list to walk, not a patch.

/** Ranks that make one name more specific than another, coarsest first. */
export const RANKS = ['genus', 'species', 'infraspecific', 'cultivar'];

const norm = (v) => String(v ?? '').trim().toLowerCase();

/**
 * How two taxon ids relate.
 *
 * - `same`       identical, or identical at every rank either one names
 * - `refinement` one names everything the other does and then some — "Cherry"
 *                against "Sargent cherry" is not a disagreement
 * - `conflict`   they name the same rank differently, which is a real
 *                disagreement about what the tree is
 * - `unknown`    a taxon id that is not in taxa.csv
 *
 * A conflict carries the coarsest rank at which they part, because that is
 * what says how serious it is: two oaks that disagree about the species are a
 * closer call than a spruce against a fir.
 */
export function compareTaxa(aId, bId, taxaById) {
  if (aId === bId) return { kind: 'same' };
  const a = taxaById?.get(aId);
  const b = taxaById?.get(bId);
  if (!a || !b) return { kind: 'unknown' };

  for (const rank of RANKS) {
    const av = norm(a[rank]);
    const bv = norm(b[rank]);
    // Only a rank that BOTH name can be disagreed about. One side leaving it
    // blank is silence, not contradiction.
    if (av && bv && av !== bv) return { kind: 'conflict', rank };
  }

  const filled = (t) => new Set(RANKS.filter((r) => norm(t[r])));
  const af = filled(a);
  const bf = filled(b);
  const covers = (x, y) => [...y].every((r) => x.has(r));

  if (covers(af, bf) && af.size > bf.size) return { kind: 'refinement', narrower: aId, broader: bId };
  if (covers(bf, af) && bf.size > af.size) return { kind: 'refinement', narrower: bId, broader: aId };
  // Same ranks filled, no rank differs, different ids: two taxa rows that say
  // the same thing. Worth knowing about, and not this script's business.
  return { kind: 'same' };
}

/**
 * Join data/plants.csv to the 2014 inventory on tag number and compare.
 *
 * The join key is the metal tag. `UVM-0712` and 2014's `712` are the same
 * number written two ways, and the accession rule (tag 763 -> UVM-0763) is
 * what makes that join sound. Accessions from UNTAGGED_BLOCK_START up carry
 * no tag and cannot join, which is correct — they were never in 2014.
 *
 * @param {object} args
 * @param {object[]} args.plants        data/plants.csv rows
 * @param {object[]} args.reference     public/field/reference.csv rows
 * @param {Map} args.speciesLookup      from buildSpeciesLookup
 * @param {Map} args.taxaById           taxa rows by id
 */
export function crossReference({ plants, reference, speciesLookup, taxaById, resolveSpecies }) {
  const byTag = new Map();
  for (const row of reference) {
    const tag = String(row.Tree ?? '').trim();
    if (/^\d+$/.test(tag)) byTag.set(String(Number(tag)), row);
  }

  const conflicts = [];
  const refinements = [];
  const unresolved = [];
  let joined = 0;
  let agree = 0;

  for (const plant of plants) {
    const m = String(plant.plant_id ?? '').match(/^UVM-(\d+)$/);
    if (!m) continue;
    const ref = byTag.get(String(Number(m[1])));
    if (!ref) continue;
    joined += 1;

    const botanical = String(ref.Botanical ?? '').trim();
    const refTaxon = botanical ? resolveSpecies(botanical, speciesLookup) : undefined;
    if (!refTaxon) {
      unresolved.push({ plant_id: plant.plant_id, name: botanical });
      continue;
    }

    const mapTaxon = String(plant.taxon_id ?? '').trim();
    const verdict = compareTaxa(mapTaxon, refTaxon, taxaById);
    // Everything the 2014 sheet knows about the tree, because it is what
    // decides whether a disagreement is a misidentification or a replanting:
    // a 2-inch sapling in 2014 may simply not be there any more.
    const entry = {
      plant_id: plant.plant_id,
      map: mapTaxon,
      ref: refTaxon,
      refCommon: String(ref.Common_Name ?? '').trim(),
      dbh_2014: String(ref.DBH ?? '').trim(),
      age_2014: String(ref.Age_Class ?? '').trim(),
      condition_2014: String(ref.Condition ?? '').trim(),
    };

    if (verdict.kind === 'same') agree += 1;
    else if (verdict.kind === 'refinement') refinements.push({ ...entry, ...verdict });
    else if (verdict.kind === 'conflict') conflicts.push({ ...entry, rank: verdict.rank });
    else unresolved.push({ plant_id: plant.plant_id, name: botanical });
  }

  // Worst first: a genus disagreement is a different kind of tree, a cultivar
  // disagreement is a label on the same one.
  const order = (r) => RANKS.indexOf(r);
  conflicts.sort((a, b) => order(a.rank) - order(b.rank) || a.plant_id.localeCompare(b.plant_id));
  refinements.sort((a, b) => a.plant_id.localeCompare(b.plant_id));

  return {
    conflicts,
    refinements,
    unresolved,
    summary: {
      plants: plants.length,
      reference: byTag.size,
      joined,
      agree,
      conflicts: conflicts.length,
      refinements: refinements.length,
      unresolved: unresolved.length,
    },
  };
}
