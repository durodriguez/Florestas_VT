import { describe, it, expect } from 'vitest';
import {
  matchExact, resolveExact, searchSpecies, speciesChanged, type SpeciesEntry,
} from '../src/field/species';

/** Shaped exactly as `npm run data` writes public/field/species.json. */
const entry = (
  id: string, sci: string, common: string, n = 0, extra: string[] = [],
): SpeciesEntry => ({
  id, sci, common, n,
  k: [sci.toLowerCase(), common.toLowerCase(), id.replace(/-/g, ' '), ...extra],
});

const list: SpeciesEntry[] = [
  entry('acer-saccharum', 'Acer saccharum', 'Sugar maple', 120),
  entry('acer-rubrum', 'Acer rubrum', 'Red maple', 40),
  entry('acer-griseum', 'Acer griseum', 'Paperbark maple', 2),
  entry('acer-sp', 'Acer sp.', 'Maple', 0),
  entry('pinus-strobus', 'Pinus strobus', 'Eastern white pine', 30, ['white pine']),
  entry('quercus-rubra', 'Quercus rubra', 'Northern red oak', 15),
];

const ids = (q: string, limit?: number) =>
  searchSpecies(q, list, limit).map((s) => s.entry.id);

describe('searchSpecies', () => {
  it('says nothing until there is something to go on', () => {
    // One letter matches a third of the list; showing that is not a suggestion.
    expect(searchSpecies('a', list)).toEqual([]);
    expect(searchSpecies('', list)).toEqual([]);
  });

  it('matches a scientific name by prefix', () => {
    expect(ids('acer sacc')[0]).toBe('acer-saccharum');
  });

  it('matches a common name by prefix', () => {
    expect(ids('sugar')[0]).toBe('acer-saccharum');
  });

  it('matches part-words across the name, so "sug map" finds sugar maple', () => {
    expect(ids('sug map')[0]).toBe('acer-saccharum');
  });

  it('matches a word in the middle of a name', () => {
    expect(ids('rubra')).toContain('quercus-rubra');
  });

  it('ignores case, spacing and punctuation the way the importer does', () => {
    expect(ids('  ACER   Saccharum ')[0]).toBe('acer-saccharum');
  });

  it('finds a taxon by an alias carried in its search keys', () => {
    expect(ids('white pine')[0]).toBe('pinus-strobus');
  });

  it('lets a whole-name match beat a word buried in a longer name', () => {
    // Typing "maple" and nothing else is a genus-level answer, so the
    // genus-level taxon leads. The species follow, commonest first.
    expect(ids('maple')).toEqual([
      'acer-sp', 'acer-saccharum', 'acer-rubrum', 'acer-griseum',
    ]);
  });

  it('puts the commonest tree first among matches that score the same', () => {
    // 2,000 trees and a long tail: four taxa prefix-match "acer s" equally, and
    // the inventory already knows which of them the surveyor is most likely
    // standing under.
    expect(ids('acer s')).toEqual(['acer-saccharum', 'acer-sp']);
  });

  it('ranks a prefix match above a match buried mid-name', () => {
    const order = ids('red');
    expect(order.indexOf('acer-rubrum')).toBeLessThan(order.indexOf('quercus-rubra'));
  });

  it('falls back to the shorter name when nothing has been mapped yet', () => {
    const fresh = list.map((e) => ({ ...e, n: 0 }));
    // Acer sp. sorts above its own species when the counts cannot separate them.
    expect(searchSpecies('acer', fresh).map((s) => s.entry.id)[0]).toBe('acer-sp');
  });

  it('caps the list rather than handing back something to scroll', () => {
    expect(ids('acer', 2)).toHaveLength(2);
  });

  it('returns nothing for a species that is genuinely not on the list', () => {
    expect(searchSpecies('Metasequoia glyptostroboides', list)).toEqual([]);
  });
});

describe('resolveExact', () => {
  it('resolves a name the 2014 inventory supplies', () => {
    expect(resolveExact('Pinus strobus', list)?.id).toBe('pinus-strobus');
  });

  it('resolves through an alias', () => {
    expect(resolveExact('White Pine', list)?.id).toBe('pinus-strobus');
  });

  it('does not resolve a partial name — that would be a guess, not a match', () => {
    expect(resolveExact('Pinus', list)).toBeUndefined();
  });

  it('returns undefined for a blank', () => {
    expect(resolveExact('  ', list)).toBeUndefined();
  });

  it('resolves a species whose cultivars share the start of its name', () => {
    // Real case: taxa.csv carries both Metasequoia glyptostroboides and
    // M. glyptostroboides 'Amber Glow'. The plain name is the plain species.
    const withCultivar = [
      ...list,
      entry('metasequoia-glyptostroboides', 'Metasequoia glyptostroboides', 'Dawn redwood'),
      entry('metasequoia-amber-glow', "Metasequoia glyptostroboides 'Amber Glow'", 'Amber Glow dawn redwood'),
    ];
    expect(resolveExact('Metasequoia glyptostroboides', withCultivar)?.id)
      .toBe('metasequoia-glyptostroboides');
  });

  it('refuses a name two taxa share rather than picking one', () => {
    // "Swedish whitebeam" is the common name of both Sorbus intermedia and
    // Sorbus hybrida, and taxa.csv carries both.
    const ambiguous = [
      ...list,
      entry('sorbus-intermedia', 'Sorbus intermedia', 'Swedish whitebeam'),
      entry('sorbus-hybrida', 'Sorbus hybrida', 'Swedish whitebeam'),
    ];
    expect(matchExact('Swedish whitebeam', ambiguous)).toHaveLength(2);
    expect(resolveExact('Swedish whitebeam', ambiguous)).toBeUndefined();
    // ...and both are still offered, so the surveyor can choose.
    expect(searchSpecies('Swedish whitebeam', ambiguous)).toHaveLength(2);
  });
});

describe('speciesChanged', () => {
  it('is false when the surveyor confirmed what 2014 said', () => {
    expect(speciesChanged('Picea abies', 'picea-abies', 'Picea abies', 'picea-abies')).toBe(false);
  });

  it('is true when they recorded a different taxon', () => {
    expect(speciesChanged('Picea abies', 'picea-abies', 'Picea pungens', 'picea-pungens')).toBe(true);
  });

  it('is false when two names mean one taxon', () => {
    // The surveyor picked "Norway spruce" from the list; 2014 wrote the
    // botanical name. A plain string compare would call that a correction.
    expect(speciesChanged('Picea abies', 'picea-abies', 'Norway spruce', 'picea-abies')).toBe(false);
  });

  it('falls back to the folded names when 2014 used a name taxa.csv lacks', () => {
    expect(speciesChanged('Picea obovata', '', 'Picea abies', 'picea-abies')).toBe(true);
    expect(speciesChanged('Picea obovata', '', '  picea   OBOVATA ', '')).toBe(false);
  });

  it('is false for a tree with no tag and no 2014 record', () => {
    expect(speciesChanged('', '', 'Picea abies', 'picea-abies')).toBe(false);
  });

  it('is false before anything has been typed', () => {
    // The tag has just been entered and the species box is still filling in.
    expect(speciesChanged('Picea abies', 'picea-abies', '', '')).toBe(false);
  });
});
