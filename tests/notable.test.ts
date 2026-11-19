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
    const trees = Array.from({ length: 32 }, (_, i) => p(`T${i}`, `sp${i % 3}`, { dbh: 50 - i }));
    const f = notableFacts(trees);
    expect(f.get('T0')).toContain('Largest trunk measured on campus');
    expect(f.get('T1')).toContain('No. 2 of the 32 trunks measured on campus');
    expect(f.get('T9')).toContain('No. 10 of the 32 trunks measured on campus');
    expect(f.get('T11')?.some((x) => x.startsWith('No.'))).toBeFalsy();
  });
  it('names the largest of each species, but not twice for the campus leader', () => {
    const species = (name: string, sizes: number[]) => sizes.map((d, i) => p(`${name}${i}`, name, { dbh: d }));
    const f = notableFacts([...filler(30, () => ({ dbh: 1 })),
      ...species('oak', [40, 30, 20, 10, 5]), ...species('ginkgo', [25, 20, 9, 8, 2])]);
    expect(f.get('oak0')).toEqual(['Largest trunk measured on campus']);
    expect(f.get('ginkgo0')).toContain('Largest trunk of the 5 on campus');
    expect(f.get('oak1')?.some((x) => x.includes('of the 5'))).toBeFalsy();
  });
  it('needs five of a species, every one measured', () => {
    const f = notableFacts([...filler(30, (i) => ({ dbh: 100 - i })),
      ...['A', 'B', 'C', 'D'].map((id, i) => p(id, 'elm', { dbh: 10 - i })),
      ...['E', 'F', 'G', 'H', 'I'].map((id, i) => p(id, 'yew', { dbh: i === 4 ? null : 10 - i }))]);
    expect(f.get('A')).toBeUndefined();
    expect(f.get('E')).toBeUndefined();
  });
  it('makes no campus-wide claim with fewer than thirty trees measured', () => {
    const f = notableFacts([...filler(27, () => ({ dbh: 1 })), p('A', 'a', { dbh: 30 }), p('B', 'b', { dbh: 20 })]);
    expect(f.get('A')).toEqual(['The only one on campus']);
  });
  it('counts standing trees only, and shares a rank between equal trunks', () => {
    const f = notableFacts([...filler(30, () => ({ dbh: 1 })),
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
  it('names the tallest, widest and highest-scoring on campus once thirty are measured', () => {
    const base = filler(30, () => ({ dbh: 10, h: 30, s: 20 }));
    const f = notableFacts([...base, p('T', 'oak', { dbh: 12, h: 90, s: 40 }), p('W', 'maple', { dbh: 11, h: 50, s: 70 })]);
    expect(f.get('T')).toEqual(expect.arrayContaining(['Largest trunk measured on campus', 'Tallest measured on campus', 'Most champion points measured on campus']));
    expect(f.get('W')).toContain('Widest crown measured on campus');
  });
  it('makes no height claim until thirty heights are measured', () => {
    const f = notableFacts([...filler(28, () => ({ dbh: 10, h: 20 })), p('T', 'oak', { dbh: 5, h: 90 })]);
    expect(f.get('T')?.some((x) => x.startsWith('Tallest'))).toBeFalsy();
  });
  it('names the tallest of a species once all five have a height', () => {
    const pines = [70, 60, 50, 40, 30].map((h, i) => p(`P${i}`, 'pine', { h }));
    expect(notableFacts(pines).get('P0')).toEqual(['Tallest of the 5 on campus']);
    expect(notableFacts(pines).get('P1')).toBeUndefined();
    const oneMissing = notableFacts([...pines.slice(0, 4), p('P4', 'pine')]);
    expect(oneMissing.get('P0')).toBeUndefined();
  });
});

describe("the city's trees", async () => {
  const { CITY_WORDING } = await import('../src/notable');
  it('are ranked among themselves, and say so', () => {
    const trees = [...filler(30, () => ({ dbh: 10, h: 30, s: 20 })), p('OAK', 'oak', { dbh: 40, h: 65, s: 40 })];
    const f = notableFacts(trees, CITY_WORDING);
    expect(f.get('OAK')).toEqual(expect.arrayContaining([
      "Largest trunk of the city's trees on campus",
      "Tallest of the city's trees on campus",
      "Most champion points of the city's trees on campus",
    ]));
    expect(f.get('F0')).toContain("The city's only one on campus");
  });
});
