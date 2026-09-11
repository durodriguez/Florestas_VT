/**
 * Species autocomplete for the survey form.
 *
 * Most trees on campus have no metal tag, so the tag lookup cannot help with
 * them and the surveyor types the name. Typed names go wrong in every way a
 * name can: "Acer platenoides", "Sugar Maple ", "quercus rubra". Every one of
 * those is a row the importer stops on weeks later, by which time the tree is
 * a hundred miles away and nobody remembers which one it was.
 *
 * So the list comes to the field instead. The app suggests from the same
 * taxa.csv the importer resolves against, and records the `taxon_id` rather
 * than the text — at which point there is nothing left to resolve.
 *
 * Free text still saves. A surveyor who finds something not on the list is
 * reporting the most interesting thing they could report, and an autocomplete
 * that refuses unknown input would be worse than none at all.
 */

import { normalizeName } from '../../scripts/lib/species.mjs';

/** One taxon, as `npm run data` writes it to public/field/species.json. */
export interface SpeciesEntry {
  id: string;
  sci: string;
  common: string;
  /** Mapped plants of this taxon on campus — used to rank suggestions. */
  n: number;
  /** Normalised search keys: scientific name, common name, id, any aliases. */
  k: string[];
}

export interface Suggestion {
  entry: SpeciesEntry;
  /** Lower is better. Kept on the result so the tests can assert on ranking. */
  score: number;
}

/** Anything past this is scrolling, which one-handed in the field is not use. */
export const MAX_SUGGESTIONS = 8;

/**
 * Rank one entry against an already-normalised query.
 *
 *   0  a key begins with the whole query          "acer sacc" -> Acer saccharum
 *   1  every word of the query begins a word      "sug map"   -> Sugar maple
 *   2  a key contains the query anywhere          "rubrum"    -> Acer rubrum
 *
 * Returned as a number rather than a boolean because the ordering is the
 * feature: a surveyor typing four letters wants the obvious tree first, not a
 * list of everything those letters appear inside.
 */
function score(entry: SpeciesEntry, query: string, tokens: string[]): number | null {
  let best: number | null = null;
  for (const key of entry.k) {
    if (key.startsWith(query)) return 0;
    const words = key.split(' ');
    if (tokens.every((t) => words.some((w) => w.startsWith(t)))) {
      best = best === null ? 1 : Math.min(best, 1);
    } else if (key.includes(query)) {
      best = best === null ? 2 : Math.min(best, 2);
    }
  }
  return best;
}

/**
 * Suggestions for what the surveyor has typed so far, best first.
 *
 * Ties break on how many of that taxon are already mapped: with 2,000 trees
 * and a very long tail, "map" should reach sugar maple before it reaches
 * paperbark maple, and the inventory already knows which is which. Where the
 * count cannot separate them — early on, when everything is zero — the shorter
 * name wins, which puts a species above its own cultivars.
 */
export function searchSpecies(
  query: string,
  entries: SpeciesEntry[],
  limit = MAX_SUGGESTIONS,
): Suggestion[] {
  const q = normalizeName(query);
  if (q.length < 2) return [];
  const tokens = q.split(' ').filter(Boolean);

  const hits: Suggestion[] = [];
  for (const entry of entries) {
    const s = score(entry, q, tokens);
    if (s !== null) hits.push({ entry, score: s });
  }

  hits.sort(
    (a, b) =>
      a.score - b.score ||
      b.entry.n - a.entry.n ||
      a.entry.sci.length - b.entry.sci.length ||
      a.entry.common.localeCompare(b.entry.common),
  );
  return hits.slice(0, limit);
}

/**
 * Every taxon a name matches exactly. Usually none or one — but not always:
 * "Swedish whitebeam" is the common name of both *Sorbus intermedia* and
 * *Sorbus hybrida*, and taxa.csv carries both.
 */
export function matchExact(name: string, entries: SpeciesEntry[]): SpeciesEntry[] {
  const q = normalizeName(name);
  if (!q) return [];
  return entries.filter((e) => e.k.includes(q));
}

/**
 * The one taxon a name refers to, or undefined if it refers to none — or to
 * more than one, which is not a match but a question for the surveyor, who is
 * the only person in a position to answer it.
 *
 * Used for a name typed in full, and for the name the 2014 inventory supplies
 * for a tagged tree: that one comes from a real botanical source, so it usually
 * is a name we know, and resolving it means a tagged tree carries a taxon_id
 * too rather than only untagged ones benefiting from any of this.
 */
export function resolveExact(name: string, entries: SpeciesEntry[]): SpeciesEntry | undefined {
  const hits = matchExact(name, entries);
  return hits.length === 1 ? hits[0] : undefined;
}
