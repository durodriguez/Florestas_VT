import { describe, it, expect } from 'vitest';
import { isPale, season, summarizeSeason, swatch } from '../src/season';
import type { Taxon } from '../src/types';

const t = (over: Partial<Taxon>): Taxon => ({
  id: 'x', sci: '', common: 'X', family: '', genus: '', species: '', infra: '', cultivar: '',
  type: 'deciduous-tree', origin: '', flowerColor: '', flowerMonths: [], fruitColor: '', fruitMonths: [],
  leafColor: '', fallColor: '', matureHeightFt: null, matureSpreadFt: null, bark: '', pests: '', soil: '', zones: '',
  wikipedia: '', description: '', funFact: '', alt: '', count: 1, parent: '', groupCount: 1, ...over,
});

const redMaple = t({ id: 'red-maple', flowerColor: 'red', flowerMonths: [3, 4], fruitColor: 'red', fruitMonths: [5, 6], fallColor: 'red' });
const crabapple = t({ id: 'crab', flowerColor: 'pink', flowerMonths: [5], fruitColor: 'red', fruitMonths: [9, 10, 11], fallColor: 'yellow' });
const pine = t({ id: 'pine', type: 'evergreen-tree', flowerColor: 'yellow', flowerMonths: [5], fruitColor: 'brown', fruitMonths: [9] });
const oak = t({ id: 'oak', flowerColor: 'yellow-green', flowerMonths: [5], fruitColor: 'brown', fruitMonths: [9, 10], fallColor: 'red' });
const yew = t({ id: 'yew', type: 'evergreen-tree', fruitColor: 'red', fruitMonths: [9, 10] });

describe('what a tree is doing in a month', () => {
  it('shows showy flowers in their color, even on bare branches', () => {
    expect(season(redMaple, 3)).toEqual({ state: 'flower', color: '#d8434e' });
    expect(season(crabapple, 5).state).toBe('flower');
  });
  it('puts fall color in October, ahead of fruit', () => {
    expect(season(crabapple, 10).state).toBe('fall');
    expect(season(oak, 10).state).toBe('fall');
  });
  it('shows showy fruit, on bare branches too', () => {
    expect(season(crabapple, 11)).toEqual({ state: 'fruit', color: '#c8323e' });
    expect(season(yew, 9).state).toBe('fruit');
  });
  it('leaves out inconspicuous flowers and brown fruit', () => {
    expect(season(oak, 5).state).toBe('leaf');
    expect(season(oak, 9).state).toBe('leaf');
    expect(season(pine, 5).state).toBe('evergreen');
  });
  it('is in leaf May to October and bare otherwise', () => {
    expect(season(oak, 7).state).toBe('leaf');
    expect(season(oak, 1).state).toBe('bare');
    expect(season(oak, 4).state).toBe('bare');
    expect(season(pine, 1).state).toBe('evergreen');
  });
});

describe('the season summary', () => {
  it('counts every state and names the showy species, most trees first', () => {
    const items = [crabapple, crabapple, crabapple, pine, oak, yew].map((taxon) => ({ taxon }));
    const s = summarizeSeason(items, 10);
    expect(s.counts).toEqual({ flower: 0, fall: 4, fruit: 1, evergreen: 1, leaf: 0, bare: 0 });
    expect(s.picks.map((p) => [p.taxon.id, p.n])).toEqual([['crab', 3], ['oak', 1], ['yew', 1]]);
    expect(s.colors.fall[0]).toBe('#f0c419');
  });
  it('builds a pie swatch for several colors', () => {
    expect(swatch(['#111111'])).toBe('#111111');
    expect(swatch(['#111111', '#222222'])).toBe('conic-gradient(#111111 0% 50%, #222222 50% 100%)');
  });
  it('flags pale fills that need a dark edge', () => {
    expect(isPale('#f7f4ea')).toBe(true);
    expect(isPale('#12501a')).toBe(false);
  });
});

describe('season — every showy color the species list uses', () => {
  const cal = (over: Record<string, unknown>) => ({
    type: 'deciduous-tree', flowerMonths: [] as number[], flowerColor: '', fruitMonths: [] as number[], fruitColor: '', fallColor: '', ...over,
  }) as Parameters<typeof season>[0];
  it('counts gold fall color, blended flowers and white berries, as the year table shows them', () => {
    expect(season(cal({ fallColor: 'gold' }), 10).state).toBe('fall');
    expect(season(cal({ flowerColor: 'pink-purple', flowerMonths: [5] }), 5).state).toBe('flower');
    expect(season(cal({ fruitColor: 'white', fruitMonths: [9] }), 9).state).toBe('fruit');
  });
  it('still leaves out green flowers and brown fruit', () => {
    expect(season(cal({ flowerColor: 'yellow-green', flowerMonths: [5] }), 5).state).toBe('leaf');
    expect(season(cal({ fruitColor: 'brown', fruitMonths: [9] }), 9).state).toBe('leaf');
  });
});
