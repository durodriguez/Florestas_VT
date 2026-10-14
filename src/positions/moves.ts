/**
 * Position corrections made at a desk, on satellite imagery.
 *
 * A move is not a visit. Nobody stood at the tree, so it adds nothing to the
 * survey history and changes nothing the public map shows about the tree
 * except where its dot sits. It records where the tree was when it was moved
 * (`from`), so the import can refuse a move made against a position that has
 * since changed — an old export must never undo newer work.
 */

import { distanceMeters } from '../geo';

export interface Move {
  id: string;
  /** Where the record had the tree when it was picked up. */
  from: [number, number];
  /** Where it was put down. */
  to: [number, number];
  /** Local date of the last change, YYYY-MM-DD. */
  on: string;
}

export type Moves = Record<string, Move>;

/**
 * A tree marked as not there: nothing on the imagery where the record puts
 * it. Applied as a `not-found` observation, which takes it off the map and
 * keeps its history; the record itself is never erased.
 */
export interface Deletion {
  id: string;
  /** Where the record had the tree when it was marked. */
  at: [number, number];
  /** Local date it was marked, YYYY-MM-DD. */
  on: string;
}

export type Deletions = Record<string, Deletion>;

/** Under this, a drag is a slip of the mouse rather than a correction. */
export const MIN_MOVE_M = 0.1;

export const movedMeters = (m: Move): number =>
  distanceMeters(m.from[0], m.from[1], m.to[0], m.to[1]);

/** Today where the person is sitting, not in UTC. */
export function today(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * Record a tree put down at `to`. Moving it again keeps the original `from`:
 * the correction is from where the record had it, however many tries it took.
 * Putting it back where it started removes the move altogether.
 */
export function applyMove(
  moves: Moves,
  id: string,
  from: [number, number],
  to: [number, number],
  on = today(),
): Moves {
  const start = moves[id]?.from ?? from;
  const next = { ...moves };
  const m: Move = { id, from: start, to, on };
  if (movedMeters(m) < MIN_MOVE_M) delete next[id];
  else next[id] = m;
  return next;
}

/**
 * Reconcile saved moves with the data as it is now. A move whose tree already
 * stands at `to` has been applied and is dropped; one whose tree is at neither
 * end has been moved by something else since, and is kept but marked stale so
 * it is not exported over newer work.
 */
export function reconcile(
  moves: Moves,
  current: Map<string, [number, number]>,
): { moves: Moves; applied: string[]; stale: string[]; missing: string[] } {
  const near = (a: [number, number], b: [number, number]) =>
    distanceMeters(a[0], a[1], b[0], b[1]) < 0.5;
  const out: Moves = {};
  const applied: string[] = [];
  const stale: string[] = [];
  const missing: string[] = [];
  for (const m of Object.values(moves)) {
    const at = current.get(m.id);
    if (!at) { missing.push(m.id); continue; }
    if (near(at, m.to)) { applied.push(m.id); continue; }
    if (!near(at, m.from)) stale.push(m.id);
    out[m.id] = m;
  }
  return { moves: out, applied, stale, missing };
}

/** `action` is `move` or `delete`; a file without the column is all moves. */
export const MOVE_COLUMNS = ['plant_id', 'tag', 'species', 'from_lat', 'from_lng', 'lat', 'lng', 'moved_m', 'moved_on', 'action'];

const cell = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/**
 * The file `npm run positions` reads. Stale moves are left out by the caller.
 * A deletion is a row whose position is where the record has the tree and
 * whose action is `delete`.
 */
export function movesToCsv(
  moves: Move[],
  describe: (id: string) => { tag: string; species: string },
  deletions: Deletion[] = [],
): string {
  const row = (id: string, from: [number, number], to: [number, number], metres: number, on: string, action: string) => {
    const { tag, species } = describe(id);
    return [
      id, tag, species,
      from[0].toFixed(6), from[1].toFixed(6),
      to[0].toFixed(6), to[1].toFixed(6),
      metres.toFixed(1), on, action,
    ].map(cell).join(',');
  };
  const rows = [
    ...moves.map((m) => row(m.id, m.from, m.to, movedMeters(m), m.on, 'move')),
    ...deletions.map((d) => row(d.id, d.at, d.at, 0, d.on, 'delete')),
  ];
  return [MOVE_COLUMNS.join(','), ...rows].join('\n') + '\n';
}

/** Ids of the points inside a lat/lng box. */
export function idsInBox(
  points: Iterable<[string, [number, number]]>,
  a: [number, number],
  b: [number, number],
): string[] {
  const [s, n] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
  const [w, e] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
  const out: string[] = [];
  for (const [id, [lat, lng]] of points) if (lat >= s && lat <= n && lng >= w && lng <= e) out.push(id);
  return out;
}

/** Ids of the points within `radius` metres of `center`. */
export function idsInCircle(
  points: Iterable<[string, [number, number]]>,
  center: [number, number],
  radius: number,
): string[] {
  const out: string[] = [];
  for (const [id, [lat, lng]] of points) if (distanceMeters(center[0], center[1], lat, lng) <= radius) out.push(id);
  return out;
}
