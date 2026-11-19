import { describe, it, expect } from 'vitest';
import { championPoints, notableFacts } from '../src/notable';

type M = { dbh?: number | null; h?: number | null; s?: number | null; status?: string; species?: string };
const p = (id: string, taxon: string, m: M = {}) => ({
  id, dbhIn: m.dbh ?? null, heightFt: m.h ?? null, spreadFt: m.s ?? null,
  status: m.status ?? 'active', taxon: { id: taxon, species: m.species ?? 'x' },
});
/** Small, measured trees of their own species each, so campus-wide claims have enough to go on. */
const filler = (n: number, m: (i: number) => M) => Array.from({ length: n }, (_, i) => p(`F${i}`, `filler${i}`, m(i)));

describe('trunks', () => {
  it('names the largest trunk on campus and ranks the next nine', () => {
    const trees = Array.from({ length: 12 }, (_, i) => p(`T${i}`, `sp${i % 3}`, { dbh: 50 - i }));
    const f = notableFacts(trees);
    expect(f.get('T0')).toContain('Largest trunk measured on campus');
    expect(f.get('T1')).toContain('No. 2 of the 12 trunks measured on campus');
    expect(f.get('T9')).toContain('No. 10 of the 12 trunks measured on campus');
    expect(f.get('T11')?.some((x) => x.startsWith('No.'))).toBeFalsy();
  });
  it('names the largest of each species, but not twice for the campus leader', () => {
    const f = notableFacts([...filler(10, () => ({ dbh: 1 })),
      p('A', 'oak', { dbh: 40 }), p('B', 'oak', { dbh: 30 }), p('C', 'oak'),
      p('D', 'ginkgo', { dbh: 25 }), p('E', 'ginkgo', { dbh: 20 }), p('F', 'ginkgo', { dbh: 2 })]);
    expect(f.get('A')).toEqual(['Largest trunk measured on campus']);
    expect(f.get('D')).toContain('Largest trunk of the 3 on campus');
    expect(f.get('B')?.some((x) => x.includes('of the 3'))).toBeFalsy();
  });
  it('says nothing about the largest of two, or with only one measured', () => {
    const f = notableFacts([...filler(12, (i) => ({ dbh: 100 - i })),
      p('A', 'elm', { dbh: 10 }), p('B', 'elm', { dbh: 8 }), p('C', 'yew', { dbh: 5 }), p('D', 'yew'), p('E', 'yew')]);
    expect(f.get('A')).toBeUndefined();
    expect(f.get('C')).toBeUndefined();
  });
  it('makes no campus-wide claim with fewer than ten trees measured', () => {
    const f = notableFacts([p('A', 'a', { dbh: 30 }), p('B', 'b', { dbh: 20 })]);
    expect(f.get('A')).toEqual(['The only one on campus']);
  });
  it('counts standing trees only, and shares a rank between equal trunks', () => {
    const f = notableFacts([...filler(10, () => ({ dbh: 1 })),
      p('A', 'a', { dbh: 30, status: 'removed' }), p('B', 'b', { dbh: 20 }), p('C', 'c', { dbh: 20 })]);
    expect(f.get('A')).toBeUndefined();
    expect(f.get('B')).toContain('Tied for the largest trunk measured on campus');
    expect(f.get('C')).toContain('Tied for the largest trunk measured on campus');
  });
});

describe('one of a kind', () => {
  it('marks it, except a tree named only to genus', () => {
    const f = notableFacts([p('A', 'zelkova'), p('B', 'elm-genus', { species: '' })]);
    expect(f.get('A')).toEqual(['The only one on campus']);
    expect(f.get('B')).toBeUndefined();
  });
});

describe('height, crown and champion points', () => {
  it('scores a tree only when it has all three measurements', () => {
    // 100 in round the trunk (31.83 in across) + 80 ft + 60 ft / 4 = 195.
    expect(championPoints({ dbhIn: 100 / Math.PI, heightFt: 80, spreadFt: 60 })).toBe(195);
    expect(championPoints({ dbhIn: 30, heightFt: 80, spreadFt: null })).toBeNull();
  });
  it('names the tallest, widest and highest-scoring on campus once ten are measured', () => {
    const base = filler(10, () => ({ dbh: 10, h: 30, s: 20 }));
    const f = notableFacts([...base, p('T', 'oak', { dbh: 12, h: 90, s: 40 }), p('W', 'maple', { dbh: 11, h: 50, s: 70 })]);
    expect(f.get('T')).toEqual(expect.arrayContaining(['Largest trunk measured on campus', 'Tallest measured on campus', 'Most champion points measured on campus']));
    expect(f.get('W')).toContain('Widest crown measured on campus');
  });
  it('makes no height claim until ten heights are measured', () => {
    const f = notableFacts([...filler(10, () => ({ dbh: 10 })), p('T', 'oak', { dbh: 5, h: 90 })]);
    expect(f.get('T')?.some((x) => x.startsWith('Tallest'))).toBeFalsy();
  });
  it('names the tallest of a species with three trees and two heights', () => {
    const f = notableFacts([p('A', 'pine', { h: 70 }), p('B', 'pine', { h: 60 }), p('C', 'pine')]);
    expect(f.get('A')).toEqual(['Tallest of the 3 on campus']);
    expect(f.get('B')).toBeUndefined();
  });
});
