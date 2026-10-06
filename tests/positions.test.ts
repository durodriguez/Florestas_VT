import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';
import {
  applyMove, movedMeters, movesToCsv, reconcile, today, MOVE_COLUMNS,
  type Moves,
} from '../src/positions/moves';
// @ts-expect-error — plain .mjs, no type declarations
import { applyPositions, STALE_M } from '../scripts/lib/positions.mjs';

/** About a metre of latitude. */
const M = 1 / 111_320;
const A: [number, number] = [44.4726, -73.1947];
const north = (m: number): [number, number] => [A[0] + m * M, A[1]];

describe('applyMove', () => {
  it('records where the tree was and where it went', () => {
    const moves = applyMove({}, 'UVM-3326', A, north(10), '2026-10-06');
    expect(moves['UVM-3326']).toEqual({ id: 'UVM-3326', from: A, to: north(10), on: '2026-10-06' });
    expect(movedMeters(moves['UVM-3326']!)).toBeCloseTo(10, 0);
  });

  it('keeps the original position across a second move', () => {
    let moves = applyMove({}, 'UVM-3326', A, north(10));
    moves = applyMove(moves, 'UVM-3326', north(10), north(12));
    expect(moves['UVM-3326']!.from).toEqual(A);
    expect(movedMeters(moves['UVM-3326']!)).toBeCloseTo(12, 0);
  });

  it('forgets a tree put back where it started', () => {
    let moves = applyMove({}, 'UVM-3326', A, north(10));
    moves = applyMove(moves, 'UVM-3326', north(10), north(0.05));
    expect(moves).toEqual({});
  });
});

describe('reconcile', () => {
  const moves: Moves = {
    a: { id: 'a', from: A, to: north(10), on: '2026-10-06' },
    b: { id: 'b', from: A, to: north(10), on: '2026-10-06' },
    c: { id: 'c', from: A, to: north(10), on: '2026-10-06' },
    d: { id: 'd', from: A, to: north(10), on: '2026-10-06' },
  };
  const current = new Map<string, [number, number]>([
    ['a', A], // not applied yet
    ['b', north(10)], // already applied
    ['c', north(30)], // moved by something else since
  ]);
  const r = reconcile(moves, current);

  it('keeps a move not yet applied', () => expect(r.moves.a).toBeDefined());
  it('drops a move the data already reflects', () => {
    expect(r.applied).toEqual(['b']);
    expect(r.moves.b).toBeUndefined();
  });
  it('marks a move made against a position that has since changed', () => {
    expect(r.stale).toEqual(['c']);
    expect(r.moves.c).toBeDefined();
  });
  it('drops a move for a tree no longer on the map', () => expect(r.missing).toEqual(['d']));
});

describe('movesToCsv', () => {
  it('writes the columns npm run positions reads', () => {
    const csv = movesToCsv(
      [{ id: 'UVM-3326', from: A, to: north(10), on: '2026-10-06' }],
      () => ({ tag: '3326', species: 'Fraxinus sp.' }),
    );
    const { data, meta } = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
    expect(meta.fields).toEqual(MOVE_COLUMNS);
    expect(data[0]).toMatchObject({ plant_id: 'UVM-3326', tag: '3326', from_lat: '44.472600', moved_m: '10.0', moved_on: '2026-10-06' });
  });
});

describe('today', () => {
  it('is the local date', () => expect(today(new Date(2026, 9, 6, 23, 30))).toBe('2026-10-06'));
});

describe('applyPositions', () => {
  const plant = { plant_id: 'UVM-3326', tag: '3326', lat: A[0].toFixed(6), lng: A[1].toFixed(6), geolocation_notes: 'Mapped in ArcGIS', collection_id: 'athletic' };
  const move = (over: Record<string, string> = {}) => ({
    plant_id: 'UVM-3326', from_lat: A[0].toFixed(6), from_lng: A[1].toFixed(6),
    lat: north(10)[0].toFixed(6), lng: A[1].toFixed(6), moved_on: '2026-10-06', ...over,
  });
  const bounds = [[44.44, -73.23], [44.5, -73.155]];

  it('changes the position and its note, and nothing about the survey', () => {
    const r = applyPositions([plant], [move()], { bounds });
    expect(r.issues).toEqual([]);
    expect(r.updates).toHaveLength(1);
    // Only these keys: no observation, no condition, no surveyed_on. A desk
    // correction is not a visit, and the public map must not show one.
    expect(Object.keys(r.updates[0].changes).sort()).toEqual(['geolocation_notes', 'lat', 'lng']);
    expect(r.updates[0].changes.geolocation_notes).toBe('Position corrected on imagery, 2026-10-06');
  });

  it(`refuses a move made against a position that has changed by more than ${STALE_M} m`, () => {
    const moved = { ...plant, lat: north(5)[0].toFixed(6) };
    const r = applyPositions([moved], [move()], { bounds });
    expect(r.updates).toHaveLength(0);
    expect(r.issues[0].message).toMatch(/has moved 5\.0 m since this file was made/);
  });

  it('refuses an unknown tree, a repeated tree and a position off campus', () => {
    const r = applyPositions([plant], [move({ plant_id: 'UVM-9999' }), move(), move(), move({ plant_id: 'UVM-3326', lat: '45.0' })], { bounds });
    const msgs = r.issues.map((i: { message: string }) => i.message).join('\n');
    expect(msgs).toMatch(/UVM-9999 is not in plants.csv/);
    expect(msgs).toMatch(/UVM-3326 appears twice/);
  });

  it('flags a very long move but still applies it', () => {
    const r = applyPositions([plant], [move({ lat: north(233)[0].toFixed(6) })], { bounds });
    expect(r.updates).toHaveLength(1);
    expect(r.issues).toEqual([{ level: 'warning', message: expect.stringMatching(/moves 233 m/) }]);
  });

  it('skips a move too small to be one', () => {
    expect(applyPositions([plant], [move({ lat: A[0].toFixed(6) })], { bounds }).updates).toHaveLength(0);
  });
});
