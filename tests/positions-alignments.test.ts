import { describe, it, expect } from 'vitest';
import { alignmentsToJson, matchAlignments, parseAlignments, type Alignment } from '../src/positions/alignments';

const pair = (n: number) => ({ px: n * 100, py: n * 50, lat: 44.47 + n * 1e-4, lng: -73.19 - n * 1e-4 });
const a: Alignment = {
  id: 'UVM_Campus_MainSt', width: 8000, height: 4768,
  cam: { lat: 44.474, lng: -73.195, range: 880, tilt: 2.6, heading: 0 },
  pairs: [pair(1), pair(2), pair(3), pair(4)],
};

describe('alignments file', () => {
  it('round-trips the points, and carries no image', () => {
    const json = alignmentsToJson([a], new Date('2026-10-06T19:30:00Z'));
    expect(json).not.toMatch(/blob|data:image/);
    expect(parseAlignments(json)).toEqual([a]);
  });

  it('leaves out images with nothing aligned', () => {
    const json = alignmentsToJson([a, { ...a, id: 'Empty', pairs: [] }]);
    expect((parseAlignments(json) as Alignment[]).map((x) => x.id)).toEqual(['UVM_Campus_MainSt']);
  });

  it('says plainly when a file is not one', () => {
    expect(parseAlignments('not json')).toMatch(/not JSON/);
    expect(parseAlignments('{"plant_id": 1}')).toMatch(/not an alignments file/);
    expect(parseAlignments('{"kind":"uvm-tree-positions/alignments","version":2,"images":[]}')).toMatch(/version 2/);
  });

  it('drops a malformed point rather than the whole image', () => {
    const json = alignmentsToJson([a]).replace('"px": 100', '"px": "oops"');
    expect((parseAlignments(json) as Alignment[])[0]!.pairs).toHaveLength(3);
  });
});

describe('matchAlignments', () => {
  it('applies to an image of the same name and size, waits for one not added yet', () => {
    const r = matchAlignments([a, { ...a, id: 'Later' }], [{ id: a.id, width: 8000, height: 4768, pairs: [] }]);
    expect(r.apply.map((x) => x.id)).toEqual([a.id]);
    expect(r.wait.map((x) => x.id)).toEqual(['Later']);
    expect(r.replacing).toEqual([]);
  });

  it('refuses a same-named image of a different size', () => {
    const r = matchAlignments([a], [{ id: a.id, width: 4000, height: 2384, pairs: [] }]);
    expect(r.mismatched).toEqual([a.id]);
    expect(r.apply).toEqual([]);
  });

  it('says which images already have different points', () => {
    const r = matchAlignments([a], [{ id: a.id, width: 8000, height: 4768, pairs: [pair(9)] }]);
    expect(r.replacing).toEqual([a.id]);
    // Identical points are not a replacement worth asking about.
    expect(matchAlignments([a], [{ id: a.id, width: 8000, height: 4768, pairs: a.pairs }]).replacing).toEqual([]);
  });
});
