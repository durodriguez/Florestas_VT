import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { SIZE, frameFor, europeRangeSvg, europeBaseSvg } from '../scripts/lib/europe-range-map.mjs';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { SIZE as US_SIZE } from '../scripts/lib/range-map.mjs';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { nativeFiles } from '../scripts/fetch-ranges-europe.mjs';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { renderSpeciesPage } from '../scripts/lib/species-pages.mjs';

type Range = { species: string; source: string; range: number[][][][]; absent: unknown[]; points: number[][] };
const dir = 'data/ranges/europe';
const range = (name: string): Range => JSON.parse(readFileSync(`${dir}/${name}.json`, 'utf8'));
const basemap = JSON.parse(readFileSync(`${dir}/basemap.json`, 'utf8'));
const names = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'basemap.json').map((f) => f.replace(/\.json$/, ''));

describe('European range maps', () => {
  it('has the 36 European species Little does not map, and none he does', () => {
    expect(names).toHaveLength(36);
    expect(names).toContain('picea-abies');
    for (const n of names) expect(existsSync(`data/ranges/${n}.json`)).toBe(false);
  });

  it('reads only the native files, the coast-clipped copy over the uncut one', () => {
    expect(nativeFiles(['Picea_abies_plg', 'Picea_abies_plg_clip', 'Picea_abies_pnt', 'Picea_abies_syn_plg', 'Picea_abies_syn_plg_clip', 'Picea_abies_syn_pnt']))
      .toEqual(['Picea_abies_plg_clip', 'Picea_abies_pnt']);
    // Version 19's two misspellings: an introduced file spelled _sym_, left
    // out; a native one spelled _png, kept.
    expect(nativeFiles(['Acer_pseudoplatanus_pnt', 'Acer_pseudoplatanus_sym_pnt'])).toEqual(['Acer_pseudoplatanus_pnt']);
    expect(nativeFiles(['Cedrus_atlantica_png', 'Cedrus_atlantica_pnt'])).toEqual(['Cedrus_atlantica_png', 'Cedrus_atlantica_pnt']);
    // Subspecies are put together.
    expect(nativeFiles(['Pinus_nigra_nigra_plg', 'Pinus_nigra_nigra_plg_clip', 'Pinus_nigra_laricio_plg'])).toEqual(['Pinus_nigra_nigra_plg_clip', 'Pinus_nigra_laricio_plg']);
  });

  it('is the size of the US maps, so the page lays out the same', () => {
    expect(SIZE).toEqual(US_SIZE);
  });

  it('fits every range inside its frame, with room around it', () => {
    for (const n of names) {
      const r = range(n);
      const frame = frameFor(r);
      const pts = [...r.range.flatMap((poly) => poly[0]!), ...r.points].map(([lng, lat]) => frame.project(lng, lat));
      for (const [x, y] of pts) {
        expect(x, n).toBeGreaterThan(0);
        expect(x, n).toBeLessThan(SIZE.width);
        expect(y, n).toBeGreaterThan(0);
        expect(y, n).toBeLessThan(SIZE.height);
      }
    }
  });

  it('frames a small range in its part of Europe, not filling the map', () => {
    // Serbian spruce grows in a few valleys of the Drina; its frame still
    // reaches from Venice to Sofia.
    const frame = frameFor(range('picea-omorika'));
    const [vx] = frame.project(12.3, 45.4);
    const [sx] = frame.project(23.3, 42.7);
    expect(vx).toBeGreaterThan(0);
    expect(sx).toBeLessThan(SIZE.width);
  });

  it('frames a wide range whole: Scotch pine from Spain to the Pacific', () => {
    const frame = frameFor(range('pinus-sylvestris'));
    const [mx] = frame.project(-3.7, 40.4); // Madrid
    const [ox] = frame.project(143, 59.4); // the Sea of Okhotsk's shore
    expect(mx).toBeGreaterThan(0);
    expect(ox).toBeLessThan(SIZE.width);
  });

  it('draws isolated stands as dots, and an area too small to see as one', () => {
    const r = range('picea-omorika');
    const svg = europeRangeSvg(r, frameFor(r));
    expect((svg.match(/<circle/g) ?? []).length).toBeGreaterThanOrEqual(r.points.length);
    const speck = { ...r, range: [[[[19.3, 43.9], [19.31, 43.9], [19.31, 43.91], [19.3, 43.9]]]], points: [] };
    expect(europeRangeSvg(speck, frameFor(r))).toContain('<circle');
  });

  it('draws the land of the frame and nothing from the far side of the globe', () => {
    const svg = europeBaseSvg(frameFor(range('cedrus-atlantica')), basemap);
    expect(svg).toContain('class="land"');
    const coords = [...svg.matchAll(/(-?\d+\.\d),(-?\d+\.\d)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    for (const [x, y] of coords) {
      expect(x).toBeGreaterThanOrEqual(-7);
      expect(x).toBeLessThanOrEqual(SIZE.width + 7);
      expect(y).toBeGreaterThanOrEqual(-7);
      expect(y).toBeLessThanOrEqual(SIZE.height + 7);
    }
  });
});

describe('a European range on its species page', () => {
  const config = { siteName: 'UVM Trees', institution: 'University of Vermont', contactEmail: 'campustrees@uvm.edu' };
  const taxon = { id: 'picea-abies', sci: 'Picea abies', common: 'Norway spruce', genus: 'Picea', species: 'abies', family: 'Pinaceae', type: 'evergreen-tree', origin: 'introduced', flowerMonths: [], fruitMonths: [], description: '', funFact: '' };
  const r = range('picea-abies');
  const map = { base: '../ranges/picea-abies-base.svg?v=1', lines: '../ranges/picea-abies-lines.svg?v=1', fill: europeRangeSvg(r, frameFor(r)) };
  const page = (over: Record<string, unknown>) => renderSpeciesPage(taxon, { photos: [], areas: [], base: '/', config, range: r, ...over });

  it('shows its own map, says it is not native here, and credits the dataset', () => {
    const html = page({ maps: { range: map } });
    expect(html).toContain('<h2>Where it grows wild</h2>');
    expect(html).toContain('picea-abies-base.svg');
    expect(html).toContain('Not native to North America');
    expect(html).toContain('Small isolated stands');
    expect(html).toContain('<b>Map credit.</b>');
    expect(html).toContain('Chorological maps for the main European woody species');
    expect(html).not.toContain('Burlington</span>');
    expect(html).not.toContain('Atlas of United States Trees');
    expect(html).not.toContain('range-base.svg');
  });

  it('leaves out the dots in the key when a range has none', () => {
    expect(renderSpeciesPage(taxon, { photos: [], areas: [], base: '/', config, range: { ...r, points: [] }, maps: { range: map } }))
      .not.toContain('Small isolated stands');
  });

  it('draws no map without its own, rather than the US one', () => {
    const html = page({ maps: {} });
    expect(html).not.toContain('class="range-map"');
  });
});
