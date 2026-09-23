/**
 * Whether there is a tree here at all.
 *
 * A different question from condition, which describes a tree that is here:
 * "dead" still means a standing trunk with a diameter to measure. An absent
 * tree has no condition, and the form says so by disabling the control.
 *
 * Mirrors STATUSES in scripts/lib/vocab.mjs — src/ is TypeScript compiled by
 * Vite and scripts/ is plain .mjs, with nothing in between, the same reason
 * the accession and tag rules are written twice.
 */
export const STATUSES = ['active', 'removed', 'not-found'] as const;

export type Status = (typeof STATUSES)[number];

/**
 * What the buttons say. Short enough for three across a phone, and phrased as
 * what the surveyor can see rather than what it means — standing on the spot,
 * a tree removed years ago and one that was never there look identical, and
 * only the stump tells them apart.
 */
export const STATUS_LABELS: Record<string, string> = {
  active: 'Still here',
  removed: 'Gone',
  'not-found': 'Nothing here',
};

/** True when the record says no tree is standing at this spot. */
export const absent = (status: string): boolean => status !== 'active';
