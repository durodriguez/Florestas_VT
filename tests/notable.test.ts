import { describe, it, expect } from 'vitest';
import { notableFacts } from '../src/notable';

const p = (id: string, taxon: string, dbhIn: number | null, opts: { status?: string; species?: string } = {}) => ({
  id, dbhIn, status: opts.status ?? 'active', taxon: { id: taxon, species: opts.species ?? 'x' },
});

describe('notable trees', () => {
  it('names the largest trunk on campus and ranks the next nine', () => {
    const trees = Array.from({ length: 12 }, (_, i) => p(`T${i}`, `sp${i % 3}`, 50 - i));
    const f = notableFacts(trees);
    expect(f.get('T0')).toContain('Largest trunk measured on campus');
    expect(f.get('T1')).toContain('No. 2 of the 12 trunks measured on campus');
    expect(f.get('T9')).toContain('No. 10 of the 12 trunks measured on campus');
    expect(f.get('T11')?.some((x) => x.startsWith('No.'))).toBeFalsy();
  });
  it('names the largest of each species, but not twice for the campus leader', () => {
    const f = notableFacts([p('A', 'oak', 40), p('B', 'oak', 30), p('C', 'oak', null), p('D', 'ginkgo', 25), p('E', 'ginkgo', 20), p('F', 'ginkgo', 2)]);
    expect(f.get('A')).toEqual(['Largest trunk measured on campus']);
    expect(f.get('D')).toContain('Largest trunk of the 3 on campus');
    expect(f.get('B')?.some((x) => x.includes('of the 3'))).toBeFalsy();
  });
  it('says nothing about the largest of two, or with only one measured', () => {
    const many = Array.from({ length: 12 }, (_, i) => p(`Z${i}`, 'filler', 100 - i));
    const f = notableFacts([...many, p('A', 'elm', 10), p('B', 'elm', 8), p('C', 'yew', 5), p('D', 'yew', null), p('E', 'yew', null)]);
    expect(f.get('A')).toBeUndefined();
    expect(f.get('C')).toBeUndefined();
  });
  it('marks one of a kind, except a tree named only to genus', () => {
    const f = notableFacts([p('A', 'zelkova', null), p('B', 'elm-genus', null, { species: '' })]);
    expect(f.get('A')).toEqual(['The only one on campus']);
    expect(f.get('B')).toBeUndefined();
  });
  it('counts standing trees only, and shares a rank between equal trunks', () => {
    const f = notableFacts([p('A', 'a', 30, { status: 'removed' }), p('B', 'b', 20), p('C', 'c', 20)]);
    expect(f.get('A')).toBeUndefined();
    expect(f.get('B')).toContain('Tied for the largest trunk measured on campus');
    expect(f.get('C')).toContain('Tied for the largest trunk measured on campus');
  });
});
