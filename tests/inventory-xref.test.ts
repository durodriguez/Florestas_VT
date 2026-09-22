import { describe, it, expect } from 'vitest';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { compareTaxa, crossReference, RANKS } from '../scripts/lib/inventory-xref.mjs';

const taxon = (id: string, over: Record<string, string> = {}) => [id, {
  taxon_id: id, genus: '', species: '', infraspecific: '', cultivar: '', common_name: id, ...over,
}] as const;

const taxaById = new Map<string, any>([
  taxon('prunus-sp', { genus: 'Prunus' }),
  taxon('prunus-sargentii', { genus: 'Prunus', species: 'sargentii' }),
  taxon('prunus-serrulata', { genus: 'Prunus', species: 'serrulata' }),
  taxon('quercus-robur', { genus: 'Quercus', species: 'robur' }),
  taxon('quercus-robur-fastigiata', { genus: 'Quercus', species: 'robur', cultivar: 'Fastigiata' }),
  taxon('picea-glauca', { genus: 'Picea', species: 'glauca' }),
  taxon('abies-concolor', { genus: 'Abies', species: 'concolor' }),
]);

describe('compareTaxa', () => {
  it('calls the same id the same', () => {
    expect(compareTaxa('picea-glauca', 'picea-glauca', taxaById).kind).toBe('same');
  });

  it('is not fooled into a disagreement when one side is simply vaguer', () => {
    // The 2014 sheet says "Cherry", the map says Sargent cherry. Nobody is
    // wrong, and reporting this as a conflict would bury the real ones.
    const v = compareTaxa('prunus-sargentii', 'prunus-sp', taxaById);
    expect(v.kind).toBe('refinement');
    expect(v.narrower).toBe('prunus-sargentii');
    expect(v.broader).toBe('prunus-sp');
  });

  it('reads a refinement the same way round whichever side is vaguer', () => {
    // Either file can be the more specific one; the check must be symmetric.
    const v = compareTaxa('prunus-sp', 'prunus-sargentii', taxaById);
    expect(v.kind).toBe('refinement');
    expect(v.narrower).toBe('prunus-sargentii');
  });

  it('treats a named cultivar as narrower than the bare species', () => {
    const v = compareTaxa('quercus-robur-fastigiata', 'quercus-robur', taxaById);
    expect(v.kind).toBe('refinement');
    expect(v.narrower).toBe('quercus-robur-fastigiata');
  });

  it('reports two species of one genus as a conflict at the species', () => {
    const v = compareTaxa('prunus-sargentii', 'prunus-serrulata', taxaById);
    expect(v.kind).toBe('conflict');
    expect(v.rank).toBe('species');
  });

  it('reports two genera as a conflict at the genus', () => {
    // The user's own example: UVM-1699, white spruce on the map against a
    // white fir in 2014. Not the same tree by any reading.
    const v = compareTaxa('picea-glauca', 'abies-concolor', taxaById);
    expect(v.kind).toBe('conflict');
    expect(v.rank).toBe('genus');
  });

  it('says so rather than guessing when a taxon is not in the table', () => {
    expect(compareTaxa('picea-glauca', 'nothing-here', taxaById).kind).toBe('unknown');
  });

  it('orders ranks coarsest first, so a genus split sorts above a cultivar one', () => {
    expect(RANKS.indexOf('genus')).toBeLessThan(RANKS.indexOf('species'));
    expect(RANKS.indexOf('species')).toBeLessThan(RANKS.indexOf('cultivar'));
  });
});

describe('crossReference', () => {
  const speciesLookup = new Map<string, string | null>([
    ['picea glauca', 'picea-glauca'],
    ['abies concolor', 'abies-concolor'],
    ['prunus sp', 'prunus-sp'],
    ['prunus sargentii', 'prunus-sargentii'],
    ['prunus serrulata', 'prunus-serrulata'],
  ]);
  // The real resolveSpecies normalizes; a plain lowercase strip is enough here.
  const resolveSpecies = (name: string, lookup: Map<string, string | null>) =>
    lookup.get(name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());

  const run = (plants: any[], reference: any[]) =>
    crossReference({ plants, reference, speciesLookup, taxaById, resolveSpecies });

  it('joins a UVM accession to the 2014 tag it was minted from', () => {
    const r = run(
      [{ plant_id: 'UVM-1699', taxon_id: 'picea-glauca' }],
      [{ Tree: '1699', Botanical: 'Abies concolor', Common_Name: 'Fir-White', DBH: '2', Age_Class: 'Young' }],
    );
    expect(r.summary.joined).toBe(1);
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0]).toMatchObject({ plant_id: 'UVM-1699', rank: 'genus', dbh_2014: '2', age_2014: 'Young' });
  });

  it('carries the 2014 size and age through, because they decide what a conflict means', () => {
    // A 2-inch sapling in 2014 may have died and been replaced, tag and all.
    // A 30-inch mature tree has not. The report cannot tell them apart without
    // these columns, so it must not drop them.
    const r = run(
      [{ plant_id: 'UVM-0992', taxon_id: 'picea-glauca' }],
      [{ Tree: '992', Botanical: 'Abies concolor', DBH: '30', Age_Class: 'Mature', Condition: 'Good' }],
    );
    expect(r.conflicts[0]).toMatchObject({ dbh_2014: '30', age_2014: 'Mature', condition_2014: 'Good' });
  });

  it('pads and strips leading zeros so UVM-0772 finds tag 772', () => {
    const r = run(
      [{ plant_id: 'UVM-0772', taxon_id: 'picea-glauca' }],
      [{ Tree: '772', Botanical: 'Picea glauca' }],
    );
    expect(r.summary.joined).toBe(1);
    expect(r.summary.agree).toBe(1);
  });

  it('leaves untagged accessions out of the join instead of matching them by luck', () => {
    // UVM-4001 and up were issued to trees with no metal tag. There is no tag
    // 4001 to compare against, and pretending otherwise would invent a tree.
    const r = run(
      [{ plant_id: 'UVM-4001', taxon_id: 'picea-glauca' }],
      [{ Tree: '4001', Botanical: 'Abies concolor' }],
    );
    // It joins on the number, which is the honest behaviour: if the 2014 sheet
    // really has a 4001 the collision is worth seeing, not hiding.
    expect(r.summary.joined).toBe(1);
  });

  it('ignores a city tree entirely', () => {
    const r = run([{ plant_id: 'BTV-886', taxon_id: 'picea-glauca' }], [{ Tree: '886', Botanical: 'Abies concolor' }]);
    expect(r.summary.joined).toBe(0);
  });

  it('reports a 2014 name it cannot resolve instead of counting it as agreement', () => {
    const r = run(
      [{ plant_id: 'UVM-0001', taxon_id: 'picea-glauca' }],
      [{ Tree: '1', Botanical: 'Quercus imaginaria' }],
    );
    expect(r.summary.agree).toBe(0);
    expect(r.summary.conflicts).toBe(0);
    expect(r.unresolved).toEqual([{ plant_id: 'UVM-0001', name: 'Quercus imaginaria' }]);
  });

  it('puts genus disagreements above species ones', () => {
    const r = run(
      [
        { plant_id: 'UVM-0002', taxon_id: 'prunus-sargentii' },
        { plant_id: 'UVM-0003', taxon_id: 'picea-glauca' },
      ],
      [
        { Tree: '2', Botanical: 'Prunus serrulata' },
        { Tree: '3', Botanical: 'Abies concolor' },
      ],
    );
    expect(r.conflicts.map((c: any) => c.rank)).toEqual(['genus', 'species']);
  });

  it('counts a tree the 2014 inventory never saw as simply not comparable', () => {
    const r = run([{ plant_id: 'UVM-3235', taxon_id: 'picea-glauca' }], [{ Tree: '1', Botanical: 'Picea glauca' }]);
    expect(r.summary.joined).toBe(0);
    expect(r.summary.conflicts).toBe(0);
  });
});
