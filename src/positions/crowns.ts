/**
 * Tree crowns from a file kept on this computer: SAL's LiDAR tree centroids.
 *
 * The University of Vermont Spatial Analysis Laboratory's "Tree Centroids
 * Derived from LiDAR for Burlington, VT, 2023" gives each crown's centre, height
 * and radius. It is not published with this site: the person using the tool
 * loads the shapefile from their own disk, and it is kept in this browser
 * (IndexedDB) only, as "My imagery" is. Nothing is uploaded or committed.
 *
 * Read here without a GIS library: a point shapefile and its attribute table
 * are two short binary formats, and the projection is the one Vermont uses.
 */

import JSZip from 'jszip';

export interface Crown {
  lat: number;
  lng: number;
  /** Metres. */
  height: number;
  /** Metres; the radius of a circle with the crown's area. */
  radius: number;
}

const US_FOOT = 1200 / 3937;

// ---------------------------------------------------------------- projection

/**
 * Vermont State Plane (NAD83), in US survey feet, to latitude and longitude.
 * Transverse Mercator on GRS 80: origin 42.5°N 72.5°W, scale 0.9999642857,
 * false easting 500,000 m. Inverse series from Snyder, Map Projections — A
 * Working Manual (1987), p. 63; good to well under a centimetre across the state.
 */
export function vermontFeetToLatLng(xFt: number, yFt: number): [number, number] {
  const a = 6378137;
  const f = 1 / 298.257222101;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const k0 = 0.9999642857;
  const lat0 = (42.5 * Math.PI) / 180;
  const lng0 = (-72.5 * Math.PI) / 180;
  const meridian = (p: number) => a * (
    (1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * p
    - ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * p)
    + ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * p)
    - ((35 * e2 ** 3) / 3072) * Math.sin(6 * p));

  const x = xFt * US_FOOT - 500000;
  const y = yFt * US_FOOT;
  const mu = (meridian(lat0) + y / k0) / (a * (1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const p1 = mu + ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu)
    + ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu)
    + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu)
    + ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const s = Math.sin(p1);
  const c = Math.cos(p1);
  const t = Math.tan(p1);
  const C1 = ep2 * c * c;
  const T1 = t * t;
  const N1 = a / Math.sqrt(1 - e2 * s * s);
  const R1 = (a * (1 - e2)) / (1 - e2 * s * s) ** 1.5;
  const D = x / (N1 * k0);
  const lat = p1 - ((N1 * t) / R1) * (
    (D * D) / 2
    - ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4) / 24
    + ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6) / 720);
  const lng = lng0 + (
    D
    - ((1 + 2 * T1 + C1) * D ** 3) / 6
    + ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5) / 120) / c;
  return [(lat * 180) / Math.PI, (lng * 180) / Math.PI];
}

/** Only the projection above is understood; anything else is refused, not guessed. */
export function isVermontFeet(prj: string): boolean {
  return /Vermont/i.test(prj) && /Foot/i.test(prj) && /-72\.5\b/.test(prj) && /0\.9999642857/.test(prj);
}

// ---------------------------------------------------------------- shapefile

/** x, y of each record in a point shapefile (.shp); Z and M, if present, are ignored. */
export function parseShpPoints(buf: ArrayBuffer): Array<[number, number]> {
  const v = new DataView(buf);
  if (v.getInt32(0, false) !== 9994) throw new Error('not a shapefile (.shp)');
  const type = v.getInt32(32, true);
  if (type !== 1 && type !== 11 && type !== 21) throw new Error(`the .shp holds shape type ${type}, not points`);
  const out: Array<[number, number]> = [];
  for (let at = 100; at + 8 <= buf.byteLength;) {
    const words = v.getInt32(at + 4, false);
    const shape = v.getInt32(at + 8, true);
    out.push(shape === 0 ? [NaN, NaN] : [v.getFloat64(at + 12, true), v.getFloat64(at + 20, true)]);
    at += 8 + words * 2;
  }
  return out;
}

/** The attribute table (.dbf), each row as field name → text. */
export function parseDbf(buf: ArrayBuffer): Array<Record<string, string>> {
  const v = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const count = v.getUint32(4, true);
  const headerLen = v.getUint16(8, true);
  const recordLen = v.getUint16(10, true);
  const text = new TextDecoder('latin1');
  const fields: Array<{ name: string; offset: number; length: number }> = [];
  let offset = 1;                       // byte 0 of a record is its deletion flag
  for (let at = 32; bytes[at] !== 0x0d && at + 32 <= headerLen; at += 32) {
    const name = text.decode(bytes.subarray(at, at + 11)).replace(/\0.*$/s, '').trim();
    const length = bytes[at + 16]!;
    fields.push({ name, offset, length });
    offset += length;
  }
  const rows: Array<Record<string, string>> = [];
  for (let i = 0; i < count; i++) {
    const start = headerLen + i * recordLen;
    const row: Record<string, string> = {};
    for (const f of fields) row[f.name] = text.decode(bytes.subarray(start + f.offset, start + f.offset + f.length)).trim();
    rows.push(row);
  }
  return rows;
}

/**
 * Crowns from the files chosen: either the .zip as SAL sent it, or its .shp,
 * .dbf and .prj chosen together. Heights and radii are converted from feet.
 * `keep` filters as they are read, so a city-wide file costs only what is kept.
 */
export async function readCrownFiles(files: File[], keep: (c: Crown) => boolean): Promise<Crown[]> {
  const parts = new Map<string, ArrayBuffer | string>();
  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      for (const entry of Object.values(zip.files)) {
        const ext = entry.name.match(/\.(shp|dbf|prj)$/i)?.[1]?.toLowerCase();
        if (ext) parts.set(ext, ext === 'prj' ? await entry.async('string') : await entry.async('arraybuffer'));
      }
    } else {
      const ext = file.name.match(/\.(shp|dbf|prj)$/i)?.[1]?.toLowerCase();
      if (ext) parts.set(ext, ext === 'prj' ? await file.text() : await file.arrayBuffer());
    }
  }
  const shp = parts.get('shp');
  const dbf = parts.get('dbf');
  const prj = parts.get('prj');
  if (!(shp instanceof ArrayBuffer) || !(dbf instanceof ArrayBuffer) || typeof prj !== 'string') {
    throw new Error('needs the .shp, .dbf and .prj together (or the .zip they came in)');
  }
  if (!isVermontFeet(prj)) throw new Error('the .prj is not Vermont State Plane in US feet, the only projection this reads');

  const points = parseShpPoints(shp);
  const rows = parseDbf(dbf);
  if (rows.length !== points.length) throw new Error(`the .shp has ${points.length} points but the .dbf ${rows.length} rows`);
  if (!('Height' in (rows[0] ?? {})) || !('Radius' in (rows[0] ?? {}))) throw new Error('the table has no Height and Radius columns');

  const out: Crown[] = [];
  points.forEach(([x, y], i) => {
    if (!Number.isFinite(x)) return;
    const [lat, lng] = vermontFeetToLatLng(x, y);
    const crown = { lat, lng, height: Number(rows[i]!.Height) * US_FOOT, radius: Number(rows[i]!.Radius) * US_FOOT };
    if (keep(crown)) out.push(crown);
  });
  return out;
}

// ---------------------------------------------------------------- area

type Ring = Array<[number, number]>;     // [lng, lat], as GeoJSON has them

function inRing(lng: number, lat: number, ring: Ring): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[j]!;
    if ((y1 > lat) !== (y2 > lat) && lng < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) hit = !hit;
  }
  return hit;
}

/**
 * Inside any of the rings, or within `margin` metres of one: a crown whose
 * centre is just over the boundary can still shade a campus tree.
 */
export function nearRings(rings: Ring[], margin: number): (lat: number, lng: number) => boolean {
  const steps = [[0, 0], ...Array.from({ length: 8 }, (_, k) => [Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)])];
  return (lat, lng) => {
    const dLat = margin / 111_320;
    const dLng = margin / (111_320 * Math.cos((lat * Math.PI) / 180));
    return steps.some(([e, n]) => rings.some((r) => inRing(lng + e! * dLng, lat + n! * dLat, r)));
  };
}

// ---------------------------------------------------------------- storage

const DB = 'uvm-tree-positions/crowns';
const STORE = 'crowns';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface SavedCrowns { name: string; loaded: string; crowns: Crown[] }

export async function saveCrowns(saved: SavedCrowns | null): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    if (saved) t.objectStore(STORE).put(saved, 'current');
    else t.objectStore(STORE).delete('current');
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function loadCrowns(): Promise<SavedCrowns | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get('current');
    req.onsuccess = () => resolve((req.result as SavedCrowns | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}
