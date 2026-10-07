/**
 * Crown peaks from the April 2023 LiDAR (scripts/lidar/crown_peaks.py,
 * docs/LIDAR.md): the top of a crown seen from the air. A peak says a tree
 * stood there, not which tree; the tool only draws them.
 */

export interface Peak {
  id: string;
  lat: number;
  lng: number;
  height: number;
}

export interface PeaksFile {
  fields: string[];
  rows: unknown[][];
}

export function parsePeaks(file: PeaksFile): Peak[] {
  const col = Object.fromEntries(file.fields.map((f, i) => [f, i])) as Record<string, number>;
  return file.rows.map((r) => ({
    id: String(r[col.id!]),
    lat: Number(r[col.lat!]),
    lng: Number(r[col.lng!]),
    height: Number(r[col.height_m!]),
  }));
}
