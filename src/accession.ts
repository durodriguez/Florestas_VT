/**
 * How a metal tag number relates to an accession: it does not.
 *
 * It used to. Accessions were minted from tags, so `UVM-0763` meant "tag 763"
 * and finding a tree by the number on its trunk was a string transform. That
 * broke the moment the two were allowed to differ — which they already do.
 * Tree `UVM-0105` wears tag 3497.
 *
 * So a tag is looked up, not computed. `plants.csv` carries a `tag` column and
 * this builds the index over it. Shared by the map and the field app, which
 * both have to turn a number somebody read off a trunk into a record.
 *
 * The first 1,349 accessions still *look* like tags, and for most trees the
 * tag and the accession do still agree. That is history, not a rule, and
 * nothing here may rely on it.
 */

/** A tag as the metal reads it: 1–4 digits, no padding. */
export function normalizeTag(tag: string): string | null {
  const digits = tag.trim();
  return /^\d{1,4}$/.test(digits) ? String(Number(digits)) : null;
}

/**
 * Index anything carrying `{ tag }` by the number on its trunk.
 *
 * Built once per dataset rather than scanned per keystroke, and skipping the
 * 708 trees that wear no tag — an empty tag must never match an empty query.
 */
export function indexByTag<T extends { tag?: string | null }>(items: readonly T[]): Map<string, T> {
  const index = new Map<string, T>();
  for (const item of items) {
    const tag = normalizeTag(String(item.tag ?? ''));
    // First wins. The build refuses a duplicate tag outright, so reaching a
    // collision here would mean the payload disagrees with its own validator.
    if (tag && !index.has(tag)) index.set(tag, item);
  }
  return index;
}
