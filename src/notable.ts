/**
 * What makes a tree stand out, worked out from the inventory itself each
 * time the page loads, so it stays true as trees are measured, added and
 * removed. Three kinds of note:
 *
 * - its trunk is among the ten largest measured on campus;
 * - its trunk is the largest of its species on campus;
 * - it is the only one of its species on campus.
 *
 * Trunks are "measured", never just "largest": more than half the trees have
 * no measurement yet, and most measurements date from 2014, so a bigger tree
 * may simply not have been measured. Only standing trees count. No DOM here,
 * so the rules can be tested.
 */

import type { Plant } from './types';

type Item = Pick<Plant, 'id' | 'dbhIn' | 'status'> & { taxon: Pick<Plant['taxon'], 'id' | 'species'> };

/** How many of the biggest trunks on campus get a note. */
const TOP = 10;

export function notableFacts(plants: Item[]): Map<string, string[]> {
  const facts = new Map<string, string[]>();
  const add = (id: string, text: string) => facts.set(id, [...(facts.get(id) ?? []), text]);
  const standing = plants.filter((p) => p.status === 'active');
  const measured = standing.filter((p) => p.dbhIn !== null).sort((a, b) => b.dbhIn! - a.dbhIn!);

  // Campus-wide: a rank is the number of trunks bigger than this one, plus one,
  // so equal trunks share it.
  measured.forEach((p) => {
    const rank = measured.findIndex((q) => q.dbhIn! === p.dbhIn!) + 1;
    if (rank > TOP) return;
    const tied = measured.filter((q) => q.dbhIn === p.dbhIn).length > 1;
    add(p.id, rank === 1
      ? `${tied ? 'Tied for the largest' : 'Largest'} trunk measured on campus`
      : `${tied ? 'Tied for ' : ''}No. ${rank} of the ${measured.length.toLocaleString()} trunks measured on campus`);
  });

  const byTaxon = new Map<string, Item[]>();
  for (const p of standing) byTaxon.set(p.taxon.id, [...(byTaxon.get(p.taxon.id) ?? []), p]);
  for (const group of byTaxon.values()) {
    // One of a kind. Not for a tree named only to genus ("Elm"), which may
    // well be the same species as others.
    if (group.length === 1 && group[0]!.taxon.species) {
      add(group[0]!.id, 'The only one on campus');
      continue;
    }
    const sized = group.filter((p) => p.dbhIn !== null).sort((a, b) => b.dbhIn! - a.dbhIn!);
    // A "largest" needs a few trees and more than one measured to mean anything.
    if (group.length < 3 || sized.length < 2) continue;
    const top = sized[0]!.dbhIn!;
    const leaders = sized.filter((p) => p.dbhIn === top);
    for (const p of leaders) {
      // The campus-wide note already says more about the very biggest.
      if (facts.get(p.id)?.some((f) => f.includes('Largest trunk measured on campus'))) continue;
      add(p.id, `${leaders.length > 1 ? 'Tied for the largest' : 'Largest'} trunk of the ${group.length} on campus`);
    }
  }
  return facts;
}
