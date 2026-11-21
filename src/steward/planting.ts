/**
 * The steward console's planting plan: which trees to plant more of, which
 * less, and the places the inventory already knows need one.
 *
 * Species are suggested from taxa.csv by the collection's own numbers: trees
 * hardy here, not marked invasive in Vermont, whose genus and family the
 * campus has least of, and that are not hosts of the pests the collection is
 * already exposed to (health.mjs). Natives first. These are starting points
 * for Grounds' judgment, checked only against the inventory: the site (soil,
 * light, space, wires), what nurseries can supply and Grounds' own plans
 * decide.
 *
 * Places are the trees the record says are gone, missing, dead or in poor
 * condition: where a tree stood, or soon may not. Open ground that could
 * take a tree needs building and pavement outlines the data does not have.
 * No DOM here, so it can be tested.
 */

import type { Plant, Taxon } from '../types';

/**
 * Burlington's USDA hardiness zone on the 2023 map (5b). A species is hardy
 * here when its recorded zones ("4-8") include 5.
 */
export const ZONE = 5;
export const LIMITS = { genus: 0.2, family: 0.3 };

export interface Threat { name: string; hosts: string[] }

export interface Candidate {
  taxon: Taxon;
  native: boolean;
  /** Standing plants of this species on campus now. */
  onCampus: number;
  genusShare: number;
  familyShare: number;
  /** The pests from the health list whose hosts include this genus. */
  hostOf: string[];
}

/** "4-8" → [4, 8]; null when not recorded or not a range. */
export function zoneRange(zones: string): [number, number] | null {
  const m = /^(\d{1,2})\s*-\s*(\d{1,2})$/.exec((zones ?? '').trim());
  return m ? [Number(m[1]), Number(m[2])] : null;
}

const isTree = (t: Taxon) => t.type === 'deciduous-tree' || t.type === 'evergreen-tree';

export function plantingCandidates(plants: Plant[], taxa: Taxon[], threats: Threat[]): Candidate[] {
  const known = plants.filter((p) => p.status === 'active' && p.taxon.id !== 'unknown');
  const n = known.length || 1;
  const count = (key: (p: Plant) => string) => {
    const m = new Map<string, number>();
    for (const p of known) m.set(key(p), (m.get(key(p)) ?? 0) + 1);
    return m;
  };
  const bySpecies = count((p) => p.taxon.id);
  const byGenus = count((p) => p.taxon.genus);
  const byFamily = count((p) => p.taxon.family);

  return taxa
    // A species, not a cultivar or variety of one, and a tree.
    .filter((t) => isTree(t) && t.species && !t.cultivar && !t.infra && t.origin !== 'vermont-invasive')
    .filter((t) => { const z = zoneRange(t.zones); return z !== null && z[0] <= ZONE && ZONE <= z[1]; })
    .map((t) => ({
      taxon: t,
      native: t.origin === 'vermont-native',
      onCampus: bySpecies.get(t.id) ?? 0,
      genusShare: (byGenus.get(t.genus) ?? 0) / n,
      familyShare: (byFamily.get(t.family) ?? 0) / n,
      hostOf: threats.filter((th) => th.hosts.includes(t.genus)).map((th) => th.name),
    }))
    // Never toward a limit already reached.
    .filter((c) => c.genusShare < LIMITS.genus && c.familyShare < LIMITS.family)
    .sort((a, b) =>
      Number(a.hostOf.length > 0) - Number(b.hostOf.length > 0)
      || Number(b.native) - Number(a.native)
      || a.familyShare - b.familyShare
      || a.genusShare - b.genusShare
      || a.taxon.common.localeCompare(b.taxon.common));
}

export type Size = 'small' | 'medium' | 'large';
/** By mature height: under 30 ft, 30 to 50, over 50. */
export function sizeOf(t: Pick<Taxon, 'matureHeightFt'>): Size | null {
  const h = t.matureHeightFt;
  if (!h) return null;
  return h < 30 ? 'small' : h <= 50 ? 'medium' : 'large';
}

/**
 * Places the inventory already knows need a tree, or soon will: where one was
 * removed or could not be found, and standing trees rated dead or poor.
 */
export function replacementSites(plants: Plant[]): Array<{ plant: Plant; why: string }> {
  const why = (p: Plant): string | null => {
    if (p.status === 'removed') return 'Removed';
    if (p.status === 'not-found') return 'Not found on a survey';
    if (p.status === 'active' && p.condition === 'dead') return 'Standing, rated dead';
    if (p.status === 'active' && p.condition === 'poor') return 'Rated poor';
    return null;
  };
  const order = ['Standing, rated dead', 'Removed', 'Not found on a survey', 'Rated poor'];
  return plants
    .map((plant) => ({ plant, why: why(plant) }))
    .filter((s): s is { plant: Plant; why: string } => s.why !== null)
    .sort((a, b) => order.indexOf(a.why) - order.indexOf(b.why) || a.plant.id.localeCompare(b.plant.id));
}
