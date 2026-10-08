import { describe, it, expect, vi } from 'vitest';

// detail.ts takes escapeHtml from map.ts, which loads Leaflet, which needs a
// browser. The panel is only a string, so the test needs only the escaping.
vi.mock('../src/map', () => ({
  escapeHtml: (v: string) => v.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!),
}));
import { renderCityDetail, roughly } from '../src/detail';
import type { CityTree, Taxon } from '../src/types';

const taxon = {
  id: 'celtis-occidentalis', sci: 'Celtis occidentalis', common: 'Hackberry', family: 'Cannabaceae',
  genus: 'Celtis', species: 'occidentalis', infra: '', cultivar: '', type: 'deciduous-tree', origin: 'native',
  flowerColor: '', flowerMonths: [], fruitColor: 'purple', fruitMonths: [9, 10], fallColor: 'yellow',
  matureHeightFt: 50, matureSpreadFt: 40, bark: 'Corky, warty ridges', pests: '', soil: '', zones: '3-9',
  wikipedia: '', description: '', funFact: '', alt: '', count: 0, parent: '', groupCount: 0,
} as Taxon;

const tree = (over: Partial<CityTree> = {}): CityTree => ({
  id: 'BTV-5989', lat: 44.480683, lng: -73.19931, taxon, collection: null, dbhIn: 6, heightFt: 20,
  spreadFt: 15, condition: 'good', plantedYear: null, address: '12 Colchester Ave', itree: null, search: '',
  ...over,
});

const estimates = {
  carbonStoredLb: 35.3, carbonPerYearLb: 2.2, runoffGalYr: 50.7, pollutionOzYr: 0.8, oxygenLbYr: 5.9, benefitsUsdYr: 1.22,
};

describe('renderCityDetail', () => {
  it('describes the species, as a UVM plant\'s panel does', () => {
    const html = renderCityDetail(tree(), '/');
    expect(html).toContain('About Hackberry');
    expect(html).toContain('Corky, warty ridges');
  });

  it('never counts the city tree as part of the UVM collection', () => {
    const html = renderCityDetail(tree(), '/');
    expect(html).toContain('In the UVM collection');
    expect(html).toContain('None mapped');
    expect(html).not.toContain('On campus</dt><dd>0');
  });

  it('shows each ecosystem service by amount, then the yearly total', () => {
    const html = renderCityDetail(tree({ itree: estimates }), '/', { model: 'i-Tree Eco v6.0.41', resultsDate: '2026-10-08', weatherYear: 2024 });
    expect(html).toContain('Ecosystem services');
    expect(html).toContain('about 35 lb');
    expect(html).toContain('about 2.2 lb a year');
    expect(html).toContain('about 51 gallons a year');
    expect(html).toContain('about 5.9 lb a year');
    expect(html).toContain('about $1 a year');
    expect(html).toContain('Powered by');
    expect(html).toContain('By i-Tree Eco v6.0.41, based on species');
    expect(html).toContain('2024 weather');
    expect(html.indexOf('Ecosystem services')).toBeLessThan(html.indexOf('About Hackberry'));
  });

  it('leaves the section out for a tree i-Tree has no estimate for', () => {
    expect(renderCityDetail(tree(), '/')).not.toContain('Ecosystem services');
  });
});

describe('roughly', () => {
  it('rounds to two significant figures, and says so', () => {
    expect(roughly(1438.1, 'lb')).toBe('about 1,400 lb');
    expect(roughly(0.8, 'oz')).toBe('about 0.8 oz');
    expect(roughly(0.04, 'oz')).toBe('less than 0.1 oz');
  });
});
