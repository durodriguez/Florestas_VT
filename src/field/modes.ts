/**
 * The two kinds of visit, and which cards each one asks for.
 *
 * Asked first because the map now comes from the 2023-24 inventory: most
 * visits are to a tree that is already on it, and the question is which one.
 * The order is the surveyor's, not the database's — a new tree starts with
 * what it is, a mapped one with which one it is and whether it still stands.
 */
export type Mode = 'new' | 'update';

export const CARDS: Record<Mode, readonly string[]> = {
  new: ['card-tag', 'card-species', 'card-dedication', 'card-position', 'card-photo', 'measurements-card', 'card-notes'],
  update: ['card-tag', 'card-position', 'card-status', 'card-species', 'card-dedication', 'card-photo', 'measurements-card', 'card-notes'],
};

export const ALL_CARDS: readonly string[] = [...new Set([...CARDS.new, ...CARDS.update])];

/**
 * The cards on screen, in order, below the question itself.
 *
 * - Before a choice: only the map, so whether the tree is already mapped is
 *   something the surveyor can see before they answer.
 * - An update with no tree picked yet: only the ways of picking one. Every
 *   answer after that is an answer about one particular tree.
 */
export function visibleCards(mode: Mode | null, picked: boolean): readonly string[] {
  if (!mode) return ['card-position'];
  if (mode === 'update' && !picked) return ['card-tag', 'card-position'];
  return CARDS[mode];
}
