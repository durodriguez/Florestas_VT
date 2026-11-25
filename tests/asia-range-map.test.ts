import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { SIZE, frameFor, europeRangeSvg } from '../scripts/lib/europe-range-map.mjs';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { renderSpeciesPage } from '../scripts/lib/species-pages.mjs';

type Range = { species: string; source: string; regions: string[]; places: number; range: number[][][][]; absent: unknown[]; points: number[][] };
const dir = 'data/ranges/asia';
const range = (name: string): Range => JSON.parse(readFileSync(`${dir}/${name}.json`, 'utf8'));
const names = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));

describe('East Asian range maps', () => {
  it('has the species native only to Japan, Korea and nearby, and none mapped elsewhere', () => {
    expect(names).toEqual(expect.arrayContaining(['acer-palmatum', 'magnolia-stellata', 'prunus-sargentii']));
    for (const n of names) {
      expect(existsSync(`data/ranges/${n}.json`), n).toBe(false);
      expect(existsSync(`data/ranges/europe/${n}.json`), n).toBe(false);
      const r = range(n);
      expect(r.source).toBe('gbif');
      // Nothing native to China: the specimens there are too few to draw from.
      expect(r.regions.filter((c) => c.startsWith('CH')), n).toEqual([]);
      expect(r.range.length + r.points.length, n).toBeGreaterThan(0);
    }
  });

  it('fits every range inside its frame', () => {
    for (const n of names) {
      const r = range(n);
      const frame = frameFor(r);
      for (const [lng, lat] of [...r.range.flatMap((poly) => poly[0]!), ...r.points]) {
        const [x, y] = frame.project(lng, lat);
        expect(x, n).toBeGreaterThan(0);
        expect(x, n).toBeLessThan(SIZE.width);
        expect(y, n).toBeGreaterThan(0);
        expect(y, n).toBeLessThan(SIZE.height);
      }
    }
  });

  it('keeps a flora\'s northern limit: no hinoki or sawara in Hokkaido', () => {
    for (const n of ['chamaecyparis-obtusa', 'chamaecyparis-pisifera']) {
      const r = range(n);
      const lats = [...r.range.flatMap((poly) => poly[0]!), ...r.points].map(([, lat]) => lat!);
      expect(Math.max(...lats), n).toBeLessThan(40);
    }
  });

  it('keeps Japanese white pine\'s rare Kyushu specimen as a dot', () => {
    const kyushu = range('pinus-parviflora').points.filter(([lng, lat]) => lng! < 132.2 && lat! > 31 && lat! < 34.3);
    expect(kyushu.length).toBeGreaterThan(0);
  });

  it('puts star magnolia around Ise Bay, not across Japan', () => {
    const r = range('magnolia-stellata');
    for (const [lng, lat] of r.range.flatMap((poly) => poly[0]!)) {
      expect(lng).toBeGreaterThan(135.5);
      expect(lng).toBeLessThan(138.5);
      expect(lat).toBeGreaterThan(34);
      expect(lat).toBeLessThan(36.5);
    }
  });
});

describe('an East Asian range on its species page', () => {
  const config = { siteName: 'UVM Trees', institution: 'University of Vermont', contactEmail: 'campustrees@uvm.edu' };
  const taxon = { id: 'prunus-sargentii', sci: 'Prunus sargentii', common: 'Sargent cherry', genus: 'Prunus', species: 'sargentii', family: 'Rosaceae', type: 'deciduous-tree', origin: 'introduced', flowerMonths: [], fruitMonths: [], description: '', funFact: '' };
  const r = range('prunus-sargentii');
  const map = { base: '../ranges/prunus-sargentii-base.svg?v=1', lines: '../ranges/prunus-sargentii-lines.svg?v=1', fill: europeRangeSvg(r, frameFor(r)) };

  it('shows its own map, calls its dots records, and credits GBIF and Kew', () => {
    const html = renderSpeciesPage(taxon, { photos: [], areas: [], base: '/', config, range: r, maps: { range: map } });
    expect(html).toContain('prunus-sargentii-base.svg');
    expect(html).toContain('Isolated records');
    expect(html).not.toContain('Small isolated stands');
    expect(html).toContain('<b>Map credit.</b>');
    expect(html).toContain('GBIF.org');
    expect(html).toContain('World Checklist of Vascular Plants');
    expect(html).not.toContain('Chorological maps');
    expect(html).not.toContain('range-base.svg');
  });

  it('draws no map without its own, rather than the US one', () => {
    expect(renderSpeciesPage(taxon, { photos: [], areas: [], base: '/', config, range: r, maps: {} })).not.toContain('class="range-map"');
  });
});
