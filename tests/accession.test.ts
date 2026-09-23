import { describe, it, expect } from 'vitest';
import { indexByTag, normalizeTag } from '../src/accession';

describe('normalizeTag', () => {
  it('reads a tag the way the metal reads it', () => {
    expect(normalizeTag('763')).toBe('763');
    expect(normalizeTag('0763')).toBe('763');
    expect(normalizeTag(' 763 ')).toBe('763');
  });

  it('refuses what is not a tag number', () => {
    expect(normalizeTag('')).toBeNull();
    expect(normalizeTag('12345')).toBeNull();
    expect(normalizeTag('1818 or 1942')).toBeNull();
    expect(normalizeTag('UVM-0763')).toBeNull();
  });
});

describe('indexByTag', () => {
  const plants = [
    { id: 'UVM-0763', tag: '763' },
    // The case the whole split exists for: found wearing 3497, still
    // accessioned UVM-0105 because that is what a label and a link encode.
    { id: 'UVM-0105', tag: '3497' },
    { id: 'UVM-4001', tag: '' },
    { id: 'UVM-4002', tag: null },
  ];

  it('finds a tree by the tag it wears', () => {
    expect(indexByTag(plants).get('763')?.id).toBe('UVM-0763');
  });

  it('finds a tree whose tag and accession disagree', () => {
    const index = indexByTag(plants);
    expect(index.get('3497')?.id).toBe('UVM-0105');
    // And 105 is on no trunk any more, so it finds nothing. Under the old
    // rule this was the one number guaranteed to work.
    expect(index.get('105')).toBeUndefined();
  });

  it('leaves untagged trees out entirely', () => {
    const index = indexByTag(plants);
    expect(index.has('')).toBe(false);
    expect(index.size).toBe(2);
    // Never reachable by the digits of an accession this project invented.
    expect(index.get('4001')).toBeUndefined();
  });

  it('normalizes padding, so an index built from padded data still answers', () => {
    expect(indexByTag([{ id: 'UVM-0007', tag: '0007' }]).get('7')?.id).toBe('UVM-0007');
  });
});
