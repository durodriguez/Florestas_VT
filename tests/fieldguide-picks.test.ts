import { describe, it, expect } from 'vitest';
import { aroundYou, whyVisit } from '../src/fieldguide/picks';
import type { Plant } from '../src/types';

const HERE = { lat: 44.478, lng: -73.199 };
const taxon = (id: string, over: Record<string, unknown> = {}) => ({
  id, common: id, type: 'deciduous-tree', flowerMonths: [] as number[], flowerColor: '', fruitMonths: [] as number[], fruitColor: '', fallColor: '', ...over,
});
/** A plant `north` units of 0.0001° (about 11 m) north of HERE. */
const plant = (id: string, north: number, t: ReturnType<typeof taxon>, over: Partial<Plant> = {}) =>
  ({ id, lat: HERE.lat + north * 0.0001, lng: HERE.lng, status: 'active', photo: null, taxon: t, ...over }) as unknown as Plant;

const crab = taxon('crabapple', { flowerColor: 'pink', flowerMonths: [5], fruitColor: 'red', fruitMonths: [9, 10, 11] });
const oak = taxon('oak');
const ginkgo = taxon('ginkgo');

describe('why a tree is worth the walk', () => {
  it('a note first, then what it is doing this month, then a photo', () => {
    expect(whyVisit(plant('A', 0, oak, { notable: ['Largest trunk measured on campus'] }), 11)).toEqual({ kind: 'notable', reason: 'Largest trunk measured on campus' });
    expect(whyVisit(plant('B', 0, crab), 11)).toEqual({ kind: 'season', reason: 'In fruit now' });
    expect(whyVisit(plant('C', 0, oak, { photo: 'c.webp' }), 11)).toEqual({ kind: 'photo', reason: 'Photographed' });
    expect(whyVisit(plant('D', 0, oak), 11)).toBeNull();
  });
});

describe('around you', () => {
  it('picks the best nearby, one of each kind of tree, and lists them nearest first', () => {
    const trees = [
      plant('OAK1', 5, oak, { notable: ['No. 4 of the 940 trunks measured on campus'] }),
      plant('OAK2', 2, oak, { notable: ['No. 9 of the 940 trunks measured on campus'] }),
      plant('CRAB', 1, crab), plant('GINKGO', 3, ginkgo, { photo: 'g.webp' }), plant('PLAIN', 1, taxon('elm')),
    ];
    const r = aroundYou(trees, HERE, 11);
    expect(r.picks.map((p) => p.plant.id)).toEqual(['CRAB', 'OAK2', 'GINKGO']);
    expect(r.picks[1]!.heading).toBe('north');
    expect(r.within).toBe(5);
  });
  it('keeps a place for each sort of tree, even when notable ones could fill them all', () => {
    const notables = ['a', 'b', 'c', 'd'].map((id, i) => plant(id, i + 1, taxon(id), { notable: ['Largest trunk of the 5 on campus'] }));
    const r = aroundYou([...notables, plant('CRAB', 8, crab), plant('PHOTO', 9, ginkgo, { photo: 'g.webp' })], HERE, 11);
    expect(r.picks.map((p) => p.kind).sort()).toEqual(['notable', 'notable', 'photo', 'season']);
  });
  it('widens the search when too few are close', () => {
    const far = [plant('A', 20, oak, { photo: 'a' }), plant('B', 22, crab), plant('C', 25, ginkgo, { photo: 'c' })];
    const r = aroundYou(far, HERE, 11);
    expect(r.radius).toBe(300);
    expect(r.picks).toHaveLength(3);
  });
  it('leaves out trees that are gone', () => {
    const r = aroundYou([plant('A', 1, crab, { status: 'removed' })], HERE, 11);
    expect(r.picks).toEqual([]);
  });
});
