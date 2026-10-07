/**
 * Crown peaks from the April 2023 LiDAR, and which mapped tree each belongs to.
 *
 * A peak is the top of a crown seen from the air (scripts/lidar/crown_peaks.py,
 * docs/LIDAR.md). It says a tree stood there; it does not say which one. So
 * this pairs trees and peaks one to one, nearest pairs first: the closest
 * tree gets a peak, and a second tree a few metres further off does not get
 * the same one. Burlington's street trees take part as well, so a city
 * tree's crown is never offered to a UVM tree beside it.
 *
 * The pairing is a suggestion for a person to accept or ignore. Nothing here
 * moves a tree.
 */

import { distanceMeters } from '../geo';

export interface Peak {
  id: string;
  lat: number;
  lng: number;
  height: number;
}

export interface Claimant {
  id: string;
  lat: number;
  lng: number;
}

export interface PeaksFile {
  fields: string[];
  rows: unknown[][];
}

/** Further than this, a tree and a peak are not the same tree. */
export const MATCH_M = 8;
/**
 * Closer than this, the record and the LiDAR agree. City street trees, whose
 * positions are surveyed, sit a median 1.3 m from their crown peak: a crown's
 * top is not exactly over its trunk, so this is the method's own error.
 */
export const AGREE_M = 2;

export function parsePeaks(file: PeaksFile): Peak[] {
  const col = Object.fromEntries(file.fields.map((f, i) => [f, i])) as Record<string, number>;
  return file.rows.map((r) => ({
    id: String(r[col.id!]),
    lat: Number(r[col.lat!]),
    lng: Number(r[col.lng!]),
    height: Number(r[col.height_m!]),
  }));
}

export interface Pairing {
  /** Each claimant's peak and how far it is. */
  byTree: Map<string, { peak: Peak; distance: number }>;
  /** Peaks with no mapped tree of any kind within MATCH_M: a tree nobody has mapped, perhaps. */
  orphans: Peak[];
}

export function pairPeaks(claimants: Claimant[], peaks: Peak[], radius = MATCH_M): Pairing {
  // Buckets one radius wide, so each claimant only looks at nine of them.
  const latStep = radius / 111_320;
  const lat0 = peaks[0]?.lat ?? 0;
  const lngStep = radius / (111_320 * Math.cos((lat0 * Math.PI) / 180));
  const key = (lat: number, lng: number) => `${Math.floor(lat / latStep)},${Math.floor(lng / lngStep)}`;
  const buckets = new Map<string, number[]>();
  peaks.forEach((p, i) => {
    const k = key(p.lat, p.lng);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(i);
  });
  const near = (lat: number, lng: number): number[] => {
    const by = Math.floor(lat / latStep);
    const bx = Math.floor(lng / lngStep);
    const out: number[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) out.push(...(buckets.get(`${by + dy},${bx + dx}`) ?? []));
    }
    return out;
  };

  const pairs: Array<{ d: number; t: number; p: number }> = [];
  const hasNeighbour = new Uint8Array(peaks.length);
  claimants.forEach((c, t) => {
    for (const p of near(c.lat, c.lng)) {
      const d = distanceMeters(c.lat, c.lng, peaks[p]!.lat, peaks[p]!.lng);
      if (d > radius) continue;
      pairs.push({ d, t, p });
      hasNeighbour[p] = 1;
    }
  });
  // Nearest first; ties broken by order so the result never depends on sort stability.
  pairs.sort((a, b) => a.d - b.d || a.t - b.t || a.p - b.p);

  const byTree: Pairing['byTree'] = new Map();
  const takenPeak = new Uint8Array(peaks.length);
  for (const { d, t, p } of pairs) {
    const id = claimants[t]!.id;
    if (takenPeak[p] || byTree.has(id)) continue;
    takenPeak[p] = 1;
    byTree.set(id, { peak: peaks[p]!, distance: d });
  }
  return { byTree, orphans: peaks.filter((_, i) => !hasNeighbour[i]) };
}
