/**
 * Reading a GNSS receiver's NMEA sentences: the plain-text lines a Trimble
 * R1 (or almost any receiver) sends over its Bluetooth serial port.
 *
 * Two sentences matter. GGA carries the position, what kind of fix it is and
 * how many satellites are in use. GST carries the receiver's own error
 * estimate in metres, which is what Trimble Mobile Manager shows as
 * "Horizontal precision (RMS)". Without GST the accuracy is estimated from
 * GGA's HDOP, and is marked as an estimate.
 *
 * No browser here: this file is the testable half of src/gnss/receiver.ts.
 */

export interface Gga {
  lat: number;
  lng: number;
  /** NMEA fix quality: 0 none, 1 GPS, 2 differential (SBAS), 4 RTK fixed, 5 RTK float… */
  quality: number;
  satellites: number;
  hdop: number;
  /** UTC time of the fix, as sent ("hhmmss.ss"), to pair it with its GST. */
  time: string;
}

export interface Gst {
  /** One-sigma horizontal error in metres: root-sum-square of the latitude and longitude errors. */
  horizontal: number;
  time: string;
}

/** The checksum after '*' must match: a line garbled in transit is dropped, not believed. */
export function checksumOk(line: string): boolean {
  const m = /^\$([^*]*)\*([0-9A-Fa-f]{2})\s*$/.exec(line);
  if (!m) return false;
  let sum = 0;
  for (const ch of m[1]!) sum ^= ch.charCodeAt(0);
  return sum === parseInt(m[2]!, 16);
}

/** "4428.5863" with "N" → 44.476438…; "07311.6838" with "W" → -73.19473… */
function coord(value: string, hemi: string, degDigits: number): number | null {
  if (!value || value.length <= degDigits) return null;
  const deg = Number(value.slice(0, degDigits));
  const min = Number(value.slice(degDigits));
  if (!Number.isFinite(deg) || !Number.isFinite(min)) return null;
  const v = deg + min / 60;
  return hemi === 'S' || hemi === 'W' ? -v : v;
}

const fields = (line: string): string[] => line.slice(1, line.indexOf('*')).split(',');

/** GGA from any talker ($GPGGA, $GNGGA…), or null if it is not one, is garbled, or has no fix. */
export function parseGga(line: string): Gga | null {
  if (!checksumOk(line)) return null;
  const f = fields(line);
  if (!/^..GGA$/.test(f[0] ?? '')) return null;
  const quality = Number(f[6]);
  if (!quality) return null;
  const lat = coord(f[2] ?? '', f[3] ?? '', 2);
  const lng = coord(f[4] ?? '', f[5] ?? '', 3);
  if (lat === null || lng === null) return null;
  return { lat, lng, quality, satellites: Number(f[7]) || 0, hdop: Number(f[8]) || 0, time: f[1] ?? '' };
}

/** GST from any talker, or null. */
export function parseGst(line: string): Gst | null {
  if (!checksumOk(line)) return null;
  const f = fields(line);
  if (!/^..GST$/.test(f[0] ?? '')) return null;
  const latErr = Number(f[6]);
  const lngErr = Number(f[7]);
  if (!f[6] || !f[7] || !Number.isFinite(latErr) || !Number.isFinite(lngErr)) return null;
  return { horizontal: Math.hypot(latErr, lngErr), time: f[1] ?? '' };
}

/** What a fix quality means, in the words Trimble Mobile Manager uses where it can. */
export function qualityLabel(q: number): string {
  switch (q) {
    case 1: return 'Autonomous';
    case 2: case 9: return 'SBAS';
    case 3: return 'PPS';
    case 4: return 'RTK fixed';
    case 5: return 'RTK float';
    case 6: return 'Dead reckoning';
    default: return `Fix type ${q}`;
  }
}

/**
 * Without GST, a rough horizontal error from HDOP. The multiplier is a
 * deliberately cautious guess at the receiver's ranging error; the result is
 * shown as an estimate, never as the receiver's own figure.
 */
export const HDOP_TO_M = 4;

/** Splits a stream of text chunks into whole lines, keeping a partial line for the next chunk. */
export class LineSplitter {
  private rest = '';
  push(chunk: string): string[] {
    const parts = (this.rest + chunk).split(/\r?\n/);
    this.rest = parts.pop() ?? '';
    // A receiver that never sends a newline must not grow this without end.
    if (this.rest.length > 4096) this.rest = '';
    return parts.map((p) => p.trim()).filter(Boolean);
  }
}
