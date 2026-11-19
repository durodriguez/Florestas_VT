/**
 * What makes a tree stand out, worked out from the inventory itself each
 * time the page loads, so it stays true as trees are measured, added and
 * removed. The notes, each only where the data can back it:
 *
 * - its trunk is among the ten largest measured on campus;
 * - it is the tallest, has the widest crown, or has the most champion points
 *   measured on campus;
 * - it is the largest, tallest, widest or highest-scoring of its species;
 * - it is the only one of its species on campus.
 *
 * Every superlative says "measured": most trees have no measurement yet, and
 * a bigger one may simply not have been measured. A campus-wide claim needs
 * at least MIN_CAMPUS trees measured; a claim about a species needs at least
 * three of them on campus and two measured. Only standing trees count. No DOM
 * here, so the rules can be tested.
 */

import type { Plant } from './types';

type Item = Pick<Plant, 'id' | 'dbhIn' | 'heightFt' | 'spreadFt' | 'status'> & {
  taxon: Pick<Plant['taxon'], 'id' | 'species'>;
};

/** How many of the biggest trunks on campus get a ranked note. */
const TOP = 10;
/** Fewest trees measured before anything is called the most on campus. */
export const MIN_CAMPUS = 10;
/** Fewest trees of a species on campus, and measured, for "of the N". */
const MIN_SPECIES = 3;
const MIN_SPECIES_MEASURED = 2;

/**
 * American Forests' big-tree score, as used by the National Register of
 * Champion Trees: trunk circumference in inches, plus height in feet, plus a
 * quarter of the average crown spread in feet. Needs all three; rounded to a
 * whole point.
 */
export function championPoints(p: Pick<Plant, 'dbhIn' | 'heightFt' | 'spreadFt'>): number | null {
  if (p.dbhIn === null || p.heightFt === null || p.spreadFt === null) return null;
  return Math.round(Math.PI * p.dbhIn + p.heightFt + p.spreadFt / 4);
}

interface Measure {
  value: (p: Item) => number | null;
  /** Campus-wide, for the top tree. */
  campus: string;
  /** Of its species: "Largest trunk" + " of the 27 on campus". */
  species: string;
}

const MEASURES: Measure[] = [
  { value: (p) => p.dbhIn, campus: 'Largest trunk measured on campus', species: 'Largest trunk' },
  { value: (p) => p.heightFt, campus: 'Tallest measured on campus', species: 'Tallest' },
  { value: (p) => p.spreadFt, campus: 'Widest crown measured on campus', species: 'Widest crown' },
  { value: championPoints, campus: 'Most champion points measured on campus', species: 'Most champion points' },
];

/** "Largest trunk measured on campus" -> "Tied for the largest trunk measured on campus". */
const tiedFor = (text: string) => `Tied for the ${text.charAt(0).toLowerCase()}${text.slice(1)}`;

export function notableFacts(plants: Item[]): Map<string, string[]> {
  const facts = new Map<string, string[]>();
  const add = (id: string, text: string) => facts.set(id, [...(facts.get(id) ?? []), text]);
  const standing = plants.filter((p) => p.status === 'active');
  const ranked = (items: Item[], m: Measure) =>
    items.filter((p) => m.value(p) !== null).sort((a, b) => m.value(b)! - m.value(a)!);

  // Campus-wide. Trunks are ranked to ten; the rest name only the top tree.
  // A rank is the number of trees ahead of this one, plus one, so equal
  // measurements share it. A tree first on campus gets no species note for
  // the same measure: the campus one already says more.
  const campusFirst = new Map<Measure, Set<string>>();
  for (const m of MEASURES) {
    const list = ranked(standing, m);
    campusFirst.set(m, new Set());
    if (list.length < MIN_CAMPUS) continue;
    const top = m.value(list[0]!)!;
    const leaders = list.filter((p) => m.value(p) === top);
    for (const p of leaders) {
      add(p.id, leaders.length > 1 ? tiedFor(m.campus) : m.campus);
      campusFirst.get(m)!.add(p.id);
    }
    if (m !== MEASURES[0]) continue;
    for (const p of list) {
      const v = m.value(p)!;
      const rank = list.findIndex((q) => m.value(q) === v) + 1;
      if (rank === 1) continue;
      if (rank > TOP) break;
      const tied = list.filter((q) => m.value(q) === v).length > 1;
      add(p.id, `${tied ? 'Tied for ' : ''}No. ${rank} of the ${list.length.toLocaleString()} trunks measured on campus`);
    }
  }

  const byTaxon = new Map<string, Item[]>();
  for (const p of standing) byTaxon.set(p.taxon.id, [...(byTaxon.get(p.taxon.id) ?? []), p]);
  for (const group of byTaxon.values()) {
    // One of a kind. Not for a tree named only to genus ("Elm"), which may
    // well be the same species as others.
    if (group.length === 1 && group[0]!.taxon.species) {
      add(group[0]!.id, 'The only one on campus');
      continue;
    }
    if (group.length < MIN_SPECIES) continue;
    for (const m of MEASURES) {
      const list = ranked(group, m);
      if (list.length < MIN_SPECIES_MEASURED) continue;
      const top = m.value(list[0]!)!;
      const leaders = list.filter((p) => m.value(p) === top);
      const text = `${m.species} of the ${group.length} on campus`;
      for (const p of leaders) {
        if (campusFirst.get(m)!.has(p.id)) continue;
        add(p.id, leaders.length > 1 ? tiedFor(text) : text);
      }
    }
  }
  return facts;
}
