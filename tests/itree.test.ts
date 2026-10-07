import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain .mjs, no type declarations
import { itreeName, itreeCondition } from '../scripts/lib/itree.mjs';

const t = (over: Record<string, string>) => ({
  taxon_id: 'x', scientific_name: '', genus: '', species: '', infraspecific: '', cultivar: '', ...over,
});

describe('itreeName', () => {
  it('passes a plain species through untouched', () => {
    expect(itreeName(t({ genus: 'Celtis', species: 'occidentalis' }))).toEqual({ name: 'Celtis occidentalis', note: '' });
  });
  it('models a cultivar as its species, and says so', () => {
    const r = itreeName(t({ genus: 'Ulmus', species: 'americana', cultivar: 'Princeton' }));
    expect(r.name).toBe('Ulmus americana');
    expect(r.note).toMatch(/Princeton/);
  });
  it('keeps hybrid epithets', () => {
    expect(itreeName(t({ genus: 'Acer', species: 'x freemanii', cultivar: 'Autumn Blaze' })).name).toBe('Acer x freemanii');
  });
  it('falls back to the genus when there is no species', () => {
    expect(itreeName(t({ genus: 'Malus', cultivar: 'Donald Wyman' })).name).toBe('Malus');
  });
  it('writes thornless honeylocust as var. inermis', () => {
    expect(itreeName(t({ genus: 'Gleditsia', species: 'triacanthos', infraspecific: 'f. inermis' })).name)
      .toBe('Gleditsia triacanthos var. inermis');
  });
  it('maps names newer than i-Tree\'s list back', () => {
    expect(itreeName(t({ taxon_id: 'scandosorbus-intermedia', genus: 'Scandosorbus', species: 'intermedia' })).name)
      .toBe('Sorbus intermedia');
  });
});

describe('itreeCondition', () => {
  it('carries the city\'s words across as i-Tree\'s classes', () => {
    expect(['excellent', 'good', 'fair', 'poor', '', 'odd'].map(itreeCondition)).toEqual(['Excellent', 'Good', 'Fair', 'Poor', '', '']);
  });
});
