import { describe, it, expect } from 'vitest';
import { typesInUse } from '../src/palette';

const ALL = ['deciduous-tree', 'evergreen-tree', 'shrub', 'perennial', 'annual', 'vine', 'grass'];
const of = (...types: string[]) => types.map((type) => ({ taxon: { type } }));

describe('typesInUse', () => {
  it('lists only the types something on the map has, in the vocabulary order', () => {
    expect(typesInUse(ALL, of('shrub', 'deciduous-tree', 'shrub', 'grass'))).toEqual(['deciduous-tree', 'shrub', 'grass']);
  });
  it('leaves out a type nothing uses, and brings it back once something does', () => {
    expect(typesInUse(ALL, of('deciduous-tree'))).not.toContain('annual');
    expect(typesInUse(ALL, of('deciduous-tree', 'annual'))).toContain('annual');
  });
});
