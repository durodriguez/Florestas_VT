import { describe, it, expect } from 'vitest';
import { buildSpeciesLookup, classifyNames, normalizeName, resolutionQuality, resolveSpecies } from '../scripts/lib/species.mjs';

const taxa = [
  { taxon_id: 'pinus-strobus', scientific_name: 'Pinus strobus', common_name: 'Eastern white pine' },
  { taxon_id: 'acer-rubrum', scientific_name: 'Acer rubrum', common_name: 'Red maple' },
];
type AliasRow = Record<string, string>;
const aliases: AliasRow[] = [
  { alias: 'White pine', taxon_id: 'pinus-strobus', note: '' },
  { alias: 'ID Needed', taxon_id: '', note: 'Not a species' },
];
const build = (a: AliasRow[] = aliases) => buildSpeciesLookup(taxa, a);

describe('normalizeName', () => {
  it('folds case, spacing and punctuation together', () => {
    expect(normalizeName('  RED   Maple ')).toBe('red maple');
    expect(normalizeName('Acer x freemanii')).toBe('acer x freemanii');
  });

  // Real data: UVM's layer holds "Scots pine" and "Scot's pine" with a curly
  // apostrophe. Turning apostrophes into spaces would split "scots" into
  // "scot s" and the two would stop matching.
  it('deletes apostrophes rather than spacing them', () => {
    expect(normalizeName('Scot’s pine')).toBe('scots pine');
    expect(normalizeName("Scot's pine")).toBe('scots pine');
    expect(normalizeName('Scots pine')).toBe('scots pine');
  });

  it('strips accents', () => {
    expect(normalizeName('Crataegus phænopyrum')).toBe(normalizeName('Crataegus phaenopyrum'));
    expect(normalizeName('Élm')).toBe('elm');
  });

  it('survives nothing at all', () => {
    expect(normalizeName(undefined)).toBe('');
    expect(normalizeName(null)).toBe('');
  });
});

describe('buildSpeciesLookup', () => {
  it('resolves canonical names without any alias', () => {
    const { lookup } = build();
    expect(resolveSpecies('Pinus strobus', lookup)).toBe('pinus-strobus');
    expect(resolveSpecies('eastern WHITE pine', lookup)).toBe('pinus-strobus');
    expect(resolveSpecies('pinus-strobus', lookup)).toBe('pinus-strobus');
  });

  it('resolves an alias', () => {
    expect(resolveSpecies('white pine', build().lookup)).toBe('pinus-strobus');
  });

  it('reports an alias pointing at a taxon that does not exist', () => {
    const { conflicts } = build([{ alias: 'Ghost tree', taxon_id: 'nothing-here' }]);
    expect(conflicts[0]).toMatchObject({ alias: 'Ghost tree' });
    expect(conflicts[0]!.reason).toMatch(/no taxon/);
  });

  // An alias that contradicts taxa.csv is a mistake in the alias file, and
  // letting it win would be the hardest kind of mistake to find.
  it('refuses to let an alias override a canonical name', () => {
    const { lookup, conflicts } = build([{ alias: 'Red maple', taxon_id: 'pinus-strobus' }]);
    expect(resolveSpecies('Red maple', lookup)).toBe('acer-rubrum');
    expect(conflicts[0]!.reason).toMatch(/already resolves to "acer-rubrum"/);
  });

  it('reports two aliases fighting over the same name', () => {
    const { conflicts } = build([
      { alias: 'Big tree', taxon_id: 'pinus-strobus' },
      { alias: 'big TREE', taxon_id: 'acer-rubrum' },
    ]);
    expect(conflicts).toHaveLength(1);
  });

  it('accepts the same alias pointing twice at the same taxon', () => {
    const { conflicts } = build([
      { alias: 'White pine', taxon_id: 'pinus-strobus' },
      { alias: 'white  pine', taxon_id: 'pinus-strobus' },
    ]);
    expect(conflicts).toEqual([]);
  });
});

describe('classifyNames', () => {
  it('separates resolved, deliberately unresolved and never-seen', () => {
    const { lookup } = build();
    const r = classifyNames(['White pine', 'ID Needed', 'Wibble oak'], lookup);
    expect([...r.resolved]).toEqual([['White pine', 'pinus-strobus']]);
    expect(r.unresolved).toEqual(['ID Needed']);
    expect(r.unknown).toEqual(['Wibble oak']);
  });

  // The distinction that matters to an importer: "we looked and it cannot be
  // resolved" is a different problem from "nobody has looked".
  it('keeps a blank alias out of the unknown pile', () => {
    const { lookup } = build();
    expect(classifyNames(['ID Needed'], lookup).unknown).toEqual([]);
  });
});

describe('resolutionQuality', () => {
  const taxaById = new Map<string, Record<string, string>>([
    ['thuja-sp', { genus: 'Thuja', species: '', cultivar: '', infraspecific: '' }],
    ['thuja-occidentalis', { genus: 'Thuja', species: 'occidentalis', cultivar: '', infraspecific: '' }],
    ['thuja-green-giant', { genus: 'Thuja', species: '', cultivar: 'Green Giant', infraspecific: '' }],
    ['tsuga-canadensis', { genus: 'Tsuga', species: 'canadensis', cultivar: '', infraspecific: '' }],
  ]);
  const assumed = new Map([['cedar', 'Chose Thuja over Juniperus']]);
  const q = (name: string, id: string) => resolutionQuality(name, id, { taxaById, assumed });

  it('calls a name the source actually gave exact', () => {
    expect(q('White cedar', 'thuja-occidentalis').kind).toBe('exact');
  });

  it('calls a genus-deep resolution genus, and says nothing was invented', () => {
    expect(q('Ash', 'thuja-sp').kind).toBe('genus');
  });

  it('does not call a named cultivar vague just because it has no species', () => {
    // Thuja 'Green Giant' is a hybrid. Naming it is as specific as a species.
    expect(q('Green Giant Arborvitae', 'thuja-green-giant').kind).toBe('exact');
  });

  it('calls a marked alias an assumption and carries the reason through', () => {
    // This is the one that matters: "Cedar" resolved cleanly for 23 trees and
    // counted toward "99.5% resolved" while being a choice nobody was shown.
    expect(q('Cedar', 'thuja-sp')).toEqual({
      kind: 'assumed', reason: 'Chose Thuja over Juniperus',
    });
  });

  it('treats an assumption as an assumption even when the taxon is a species', () => {
    expect(q('Cedar', 'tsuga-canadensis').kind).toBe('assumed');
  });

  it('falls back to exact rather than guessing when it has no tables', () => {
    expect(resolutionQuality('Ash', 'thuja-sp', {}).kind).toBe('exact');
  });
});

describe('buildSpeciesLookup assumptions', () => {
  it('reads the assumed column, keyed the way names are looked up', () => {
    const { assumed } = buildSpeciesLookup(
      [{ taxon_id: 'thuja-sp', scientific_name: 'Thuja sp.', common_name: 'Arborvitae' }],
      [{ alias: 'Cedar', taxon_id: 'thuja-sp', assumed: 'Chose Thuja over Juniperus' }],
    );
    expect(assumed.get('cedar')).toBe('Chose Thuja over Juniperus');
  });

  it('leaves an ordinary alias out of it', () => {
    const { assumed } = buildSpeciesLookup(
      [{ taxon_id: 'thuja-sp', scientific_name: 'Thuja sp.', common_name: 'Arborvitae' }],
      [{ alias: 'Thuja', taxon_id: 'thuja-sp', note: 'just a name' }],
    );
    expect(assumed.size).toBe(0);
  });
});
