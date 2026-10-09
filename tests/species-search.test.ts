import { describe, it, expect } from 'vitest';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { rankSpecies, SPECIES_SEARCH_JS, MAX_RESULTS } from '../scripts/lib/species-search.mjs';
import { normalizeName } from '../scripts/lib/species.mjs';

const entry = (id: string, sci: string, common: string, n: number, alt: string[] = []) => ({
  id, sci, common, n, k: [sci, common, ...alt].map(normalizeName),
});
const entries = [
  entry('acer-saccharum', 'Acer saccharum', 'Sugar maple', 40, ['hard maple']),
  entry('acer-saccharinum', 'Acer saccharinum', 'Silver maple', 12),
  entry('acer-rubrum', 'Acer rubrum', 'Red maple', 30),
  entry('ginkgo-biloba', 'Ginkgo biloba', 'Ginkgo', 27),
];
const rank = (q: string) => rankSpecies(q, entries, normalizeName, MAX_RESULTS).map((e: { id: string }) => e.id);

describe('rankSpecies', () => {
  it('finds by common name, scientific name or alias', () => {
    expect(rank('ginkgo')).toEqual(['ginkgo-biloba']);
    expect(rank('Acer rub')).toEqual(['acer-rubrum']);
    expect(rank('hard maple')).toEqual(['acer-saccharum']);
  });

  it('matches word starts, and ranks species with more trees first', () => {
    expect(rank('map')).toEqual(['acer-saccharum', 'acer-rubrum', 'acer-saccharinum']);
    expect(rank('sug map')).toEqual(['acer-saccharum']);
  });

  it('ignores case, accents and stray punctuation, and waits for two letters', () => {
    expect(rank('GÍNKGO!')).toEqual(['ginkgo-biloba']);
    expect(rank('g')).toEqual([]);
  });
});

describe('species/search.js', () => {
  it('is valid JavaScript carrying the same functions', () => {
    expect(() => new Function(SPECIES_SEARCH_JS)).not.toThrow();
    expect(SPECIES_SEARCH_JS).toContain(normalizeName.toString());
    expect(SPECIES_SEARCH_JS).toContain(rankSpecies.toString());
  });
});
