import { describe, it, expect } from 'vitest';
import { checklist, completeness, summary, progressMarkdown } from '../scripts/lib/completeness.mjs';

const base = { id: 'x', sci: 'X y', common: 'X', family: 'Aceraceae', genus: 'X', species: 'y', infra: '', cultivar: '', type: 'deciduous-tree',
  description: 'd', funFact: 'f', flowerColor: 'red', flowerMonths: [4], fruitColor: 'red', fruitMonths: [6], fallColor: 'red',
  matureHeightFt: 40, matureSpreadFt: 30, zones: '3-9', bark: 'gray' };
const photo = { image: 'i' };
const full = { habitat: { text: 'h' }, crownForm: 'oval', photos: { bark: photo, leaves: photo, flowers: photo, fruit: photo } };

describe('species page completeness', () => {
  it('scores a full tree page complete, and names what a bare one lacks', () => {
    expect(checklist(base, full).every((i) => i.state === 'done')).toBe(true);
    const bare = checklist({ ...base, fallColor: '' }, {});
    const missing = bare.filter((i) => i.state === 'missing').map((i) => i.item);
    expect(missing).toEqual(['growing details', 'where it grows wild', 'crown shape', 'bark photo', 'leaves photo', 'flowers photo', 'fruit photo']);
    expect(bare.find((i) => i.item === 'growing details')?.detail).toBe('fall color');
  });

  it('leaves out what does not apply: a fern\'s bark, flowers and fruit; fruit on a fruitless clone; a genus page\'s photos', () => {
    const fern = checklist({ ...base, family: 'Dryopteridaceae', type: 'perennial', flowerColor: '', flowerMonths: [], fruitColor: '', fruitMonths: [], fallColor: '', bark: '' }, { habitat: { text: 'h' }, photos: { leaves: photo } });
    expect(fern.every((i) => i.state === 'done')).toBe(true);
    expect(checklist({ ...base, fruitColor: 'none', fruitMonths: [] }, full).some((i) => i.item === 'fruit photo')).toBe(false);
    expect(checklist({ ...base, species: '' }, { kin: [{}] }).map((i) => i.item)).toEqual(['description', 'fun fact', '"Which one?" leaves']);
  });

  it('counts a borrowed photo as filled, and sorts campus pages first, least complete first', () => {
    const borrowed = checklist({ ...base, cultivar: 'C' }, { ...full, photos: { ...full.photos, inherited: true, bark: { ...photo, inherited: true } } });
    expect(borrowed.find((i) => i.item === 'bark photo')?.state).toBe('borrowed');
    const taxa = [{ ...base, id: 'a' }, { ...base, id: 'b' }, { ...base, id: 'c' }];
    const extras = new Map<string, object>([['a', full], ['b', {}], ['c', {}]]);
    const rows = completeness(taxa, extras, { a: 5, b: 1 });
    expect(rows.map((r) => r.id)).toEqual(['b', 'a', 'c']);
    expect(summary(rows).complete).toBe(1);
    expect(progressMarkdown(rows, '2026-01-01')).toContain('- [ ] **X** (`b`, 1 on campus)');
  });
});
