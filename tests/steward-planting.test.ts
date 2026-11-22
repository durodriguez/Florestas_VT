import { describe, it, expect } from 'vitest';
import { plantingCandidates, replacementSites, sizeOf, zoneRange } from '../src/steward/planting';
import type { Plant, Taxon } from '../src/types';

const taxon = (id: string, over: Partial<Taxon> = {}) => ({
  id, common: id, genus: 'G' + id, family: 'F' + id, species: 'sp', infra: '', cultivar: '', type: 'deciduous-tree',
  origin: 'introduced', zones: '4-8', matureHeightFt: 40, ...over,
}) as Taxon;
const plant = (t: Taxon, over: Record<string, unknown> = {}) => ({ id: 'P' + Math.random(), status: 'active', condition: 'good', taxon: t, ...over }) as unknown as Plant;
const many = (t: Taxon, n: number) => Array.from({ length: n }, () => plant(t));

describe('planting plan: species to plant more of', () => {
  const pine = taxon('pine', { genus: 'Pinus', family: 'Pinaceae', type: 'evergreen-tree' });
  const oak = taxon('oak', { genus: 'Quercus', family: 'Fagaceae', origin: 'vermont-native' });
  const tupelo = taxon('tupelo', { genus: 'Nyssa', family: 'Nyssaceae', origin: 'vermont-native' });
  const ginkgo = taxon('ginkgo', { genus: 'Ginkgo', family: 'Ginkgoaceae' });
  const threats = [{ name: 'Oak wilt', hosts: ['Quercus'] }];
  const filler = taxon('filler', { genus: 'Filler', family: 'Fillerae' });
  // 102 trees: pines 29% (past the genus limit), oaks 10%, ginkgos 2%.
  const campus = [...many(pine, 30), ...many(oak, 10), ...many(ginkgo, 2), ...many(filler, 60)];

  it('natives first, then the families and genera campus has least of; pest hosts last', () => {
    const c = plantingCandidates(campus, [pine, oak, tupelo, ginkgo], threats).map((x) => x.taxon.id);
    expect(c).toEqual(['tupelo', 'ginkgo', 'oak']);
  });
  it('never toward a limit already reached', () => {
    // Pines are 30 of 102 here, past 20% of one genus.
    expect(plantingCandidates(campus, [pine], []).map((x) => x.taxon.id)).toEqual([]);
  });
  it('only hardy species trees, never cultivars or ones marked invasive', () => {
    const list = [
      taxon('tender', { zones: '7-10' }), taxon('cultivar', { cultivar: "'Red'" }), taxon('shrub', { type: 'shrub' }),
      taxon('genus-only', { species: '' }), taxon('invasive', { origin: 'vermont-invasive' }), taxon('ok'),
    ];
    expect(plantingCandidates(campus, list, []).map((x) => x.taxon.id)).toEqual(['ok']);
  });
  it('flags a species rated hardy only to zone 5 as at its cold limit, and keeps it', () => {
    const list = [taxon('edge', { zones: '5-9' }), taxon('hardy', { zones: '3-7' })];
    const c = plantingCandidates(campus, list, []);
    expect(c.map((x) => [x.taxon.id, x.atLimit])).toEqual([['edge', true], ['hardy', false]]);
  });
  it('reads zones and sizes', () => {
    expect(zoneRange('4-8')).toEqual([4, 8]);
    expect(zoneRange('')).toBeNull();
    expect(sizeOf({ matureHeightFt: 25 })).toBe('small');
    expect(sizeOf({ matureHeightFt: 70 })).toBe('large');
    expect(sizeOf({ matureHeightFt: null })).toBeNull();
  });
});

describe('planting plan: places that need a tree', () => {
  it('dead first, then removed and missing, then poor; good trees not at all', () => {
    const t = taxon('x');
    const sites = replacementSites([
      plant(t, { id: 'A', condition: 'poor' }), plant(t, { id: 'B', status: 'removed' }),
      plant(t, { id: 'C', condition: 'dead' }), plant(t, { id: 'D' }), plant(t, { id: 'E', status: 'not-found' }),
    ]);
    expect(sites.map((s) => [s.plant.id, s.why])).toEqual([
      ['C', 'Standing, rated dead'], ['B', 'Removed'], ['E', 'Not found on a survey'], ['A', 'Rated poor'],
    ]);
  });
});
