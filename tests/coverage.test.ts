import { describe, it, expect } from 'vitest';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { coverage, runsOf, haversine, tagEra, UNTAGGED_BLOCK_START } from '../scripts/lib/coverage.mjs';

describe('runsOf', () => {
  it('groups consecutive numbers and breaks on a gap', () => {
    expect(runsOf([1, 2, 3, 7, 8, 11])).toEqual([[1, 2, 3], [7, 8], [11]]);
  });

  it('copes with nothing missing at all', () => {
    expect(runsOf([])).toEqual([]);
  });
});

describe('haversine', () => {
  it('measures a short campus distance in metres', () => {
    // UVM-0808 and UVM-0819, the eleven-metre gap on the central green.
    const d = haversine({ lat: 44.473859, lng: -73.192573 }, { lat: 44.473926, lng: -73.192670 });
    expect(d).toBeGreaterThan(9);
    expect(d).toBeLessThan(13);
  });

  it('is zero for a point against itself', () => {
    expect(haversine({ lat: 44.47, lng: -73.19 }, { lat: 44.47, lng: -73.19 })).toBe(0);
  });
});

describe('tagEra', () => {
  const opts = { highestLegacy: 2555 };

  it('calls a number the 2014 inventory used a legacy tag', () => {
    expect(tagEra(105, opts)).toBe('legacy');
    expect(tagEra(2555, opts)).toBe('legacy');
  });

  it('calls a real tag above the 2014 range a new tag', () => {
    // Tree 105 now wears tag 3497. Tags in this range are metal, and were on
    // the trees before the 2023 survey started.
    expect(tagEra(3497, opts)).toBe('new-tag');
    expect(tagEra(2556, opts)).toBe('new-tag');
  });

  it('calls an accession from the untagged block untagged, not a tag', () => {
    // UVM-4001 and up were minted here for trees with nothing on the trunk.
    // Reading them as tags in the 4000s would invent a re-tagging campaign
    // that never happened.
    expect(tagEra(UNTAGGED_BLOCK_START, opts)).toBe('untagged');
    expect(tagEra(4567, opts)).toBe('untagged');
  });
});

describe('coverage', () => {
  const ref = (Tree: number, over: Record<string, string> = {}) => ({
    Tree: String(Tree), Common_Name: 'Maple-Sugar', Botanical: 'Acer saccharum',
    DBH: '10', Age_Class: 'Mature', Condition: 'Good', ...over,
  });
  const plant = (n: number, over: Record<string, string> = {}) => ({
    plant_id: `UVM-${String(n).padStart(4, '0')}`, taxon_id: 'acer-saccharum',
    lat: '44.4750', lng: '-73.1930', collection_id: 'central', ...over,
  });

  it('counts a 2014 tag that is on the map as matched', () => {
    const r = coverage({ plants: [plant(105)], reference: [ref(105)] });
    expect(r.summary.matched).toBe(1);
    expect(r.summary.missing).toBe(0);
  });

  it('counts a 2014 tag that is not on the map as missing', () => {
    const r = coverage({ plants: [plant(105)], reference: [ref(105), ref(106)] });
    expect(r.summary.missing).toBe(1);
    expect(r.missing).toEqual([106]);
  });

  it('separates real new tags from the untagged block', () => {
    // The distinction the whole question turns on: 3497 is metal on a trunk,
    // 4001 is a number this project invented.
    const r = coverage({ plants: [plant(105), plant(3497), plant(4001)], reference: [ref(105)] });
    expect(r.counts).toEqual({ legacy: 1, 'new-tag': 1, untagged: 1 });
  });

  it('reports a map tag inside the old range that 2014 never issued', () => {
    // If this is ever non-empty, something WAS renumbered inside the old
    // range, and the "2014 numbering is intact" claim stops being true.
    const r = coverage({ plants: [plant(500)], reference: [ref(105), ref(2555)] });
    expect(r.unknownInRange).toEqual([500]);
  });

  it('caps what renumbering could explain, and says what is left over', () => {
    // Three missing, but only one candidate to have absorbed them.
    const r = coverage({
      plants: [plant(4001)],
      reference: [ref(105), ref(106), ref(107)],
    });
    expect(r.summary.renumberCeiling).toBe(1);
    expect(r.summary.unaccounted).toBe(2);
  });

  it('brackets a gap with the surviving tags either side and measures the walk', () => {
    const r = coverage({
      plants: [plant(808), plant(819, { lat: '44.473926', lng: '-73.192670' })],
      reference: [ref(808), ...[809, 810, 811].map((n) => ref(n)), ref(819)],
    });
    expect(r.gaps).toHaveLength(1);
    expect(r.gaps[0]).toMatchObject({ from: 809, to: 811, count: 3, before: 808, after: 819 });
  });

  it('does not bracket a gap against a new tag, only against a 2014 neighbour', () => {
    // A 2556+ tag says nothing about where the old numbering ran, so using one
    // as a bracket would invent a stretch of path.
    const r = coverage({ plants: [plant(3000)], reference: [ref(105), ref(106)] });
    expect(r.gaps).toHaveLength(0);
  });

  it('describes what the missing trees were, so a planting reads differently from a route', () => {
    const r = coverage({
      plants: [plant(808), plant(819)],
      reference: [
        ref(808),
        ...[809, 810, 811].map((n) => ref(n, { Common_Name: 'Birch-Paper', Age_Class: 'Young' })),
        ref(819),
      ],
    });
    expect(r.gaps[0]).toMatchObject({ distinctSpecies: 1, dominant: 'Birch-Paper' });
    expect(r.gaps[0].youngShare).toBe(1);
  });

  it('files the map by campus area', () => {
    const r = coverage({
      plants: [plant(105), plant(4001, { collection_id: 'redstone' })],
      reference: [ref(105)],
    });
    expect(r.byArea.central).toMatchObject({ legacy: 1, untagged: 0 });
    expect(r.byArea.redstone).toMatchObject({ legacy: 0, untagged: 1 });
  });

  it('ignores a city tree', () => {
    const r = coverage({ plants: [{ plant_id: 'BTV-886', lat: '44.47', lng: '-73.19' }], reference: [ref(105)] });
    expect(r.summary.onMap).toBe(0);
  });

  it('counts long runs, because a tag does not fall off 192 trees in a row', () => {
    const tags = Array.from({ length: 30 }, (_, i) => ref(i + 1));
    const r = coverage({ plants: [plant(1), plant(30)], reference: tags });
    expect(r.summary.inRunsOf10).toBe(28);
    expect(r.summary.singletons).toBe(0);
  });
});
