import { describe, it, expect } from 'vitest';
import { needsOf, surveyDays, worklist } from '../src/steward/worklist';
import type { Plant } from '../src/types';

const NOW = new Date(2026, 10, 21);
const tree = (id: string, over: Record<string, unknown> = {}) => ({
  id, status: 'active', dbhIn: null, dbhOn: null, heightFt: null, spreadFt: null, surveyedOn: '2026-09-01', photo: null,
  taxon: { id: 'acer-rubrum', species: 'rubrum' }, collection: { name: 'Central Campus' }, history: [], ...over,
}) as unknown as Plant;

describe('what a tree still needs', () => {
  it('a trunk size, a photo, a species', () => {
    expect(needsOf(tree('A'), NOW)).toEqual(['trunk', 'photo']);
    expect(needsOf(tree('B', { dbhIn: 12, dbhOn: '2014', photo: 'b.webp' }), NOW)).toEqual(['stale']);
    expect(needsOf(tree('C', { dbhIn: 12, dbhOn: '2022', photo: 'c.webp' }), NOW)).toEqual([]);
    expect(needsOf(tree('D', { taxon: { id: 'malus-sp', species: '' } }), NOW)).toContain('species');
    expect(needsOf(tree('E', { taxon: { id: 'unknown', species: '' } }), NOW)).toContain('unknown');
    expect(needsOf(tree('E', { taxon: { id: 'unknown', species: '' } }), NOW)).not.toContain('species');
  });
  it('nothing for a tree that is gone', () => {
    expect(needsOf(tree('F', { status: 'removed' }), NOW)).toEqual([]);
  });
});

describe('worklists', () => {
  const trees = [
    tree('UVM-0200', { collection: { name: 'Redstone Campus' } }),
    tree('UVM-0100'),
    tree('UVM-0050', { dbhIn: 10, dbhOn: '2022' }),
  ];
  it('one campus or all, by campus then accession', () => {
    expect(worklist(trees, 'trunk', null, NOW).map((p) => p.id)).toEqual(['UVM-0100', 'UVM-0200']);
    expect(worklist(trees, 'trunk', 'Redstone Campus', NOW).map((p) => p.id)).toEqual(['UVM-0200']);
  });
});

describe('survey days', () => {
  it('newest first, counting visits, trunk sizes and photos, and leaving out the year-long inventories', () => {
    const obs = (surveyedOn: string, dbhIn: number | null = null, photo: string | null = null) => ({ surveyedOn, dbhIn, photo });
    const trees = [
      tree('A', { history: [obs('2014-12-31', 20), obs('2026-11-20', 21, 'a.webp')] }),
      tree('B', { history: [obs('2026-11-20')] }),
      tree('C', { history: [obs('2026-09-02', 5)] }),
    ];
    expect(surveyDays(trees)).toEqual([
      { date: '2026-11-20', visits: 2, measured: 1, photos: 1 },
      { date: '2026-09-02', visits: 1, measured: 1, photos: 0 },
    ]);
  });
});
