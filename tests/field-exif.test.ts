import { describe, it, expect } from 'vitest';
import { exifDateToIso, photoTakenOn } from '../src/field/exif';

/**
 * A minimal JPEG: SOI, an APP1 Exif block with IFD0 (DateTime, and a pointer
 * to an Exif IFD holding DateTimeOriginal), then SOS. Built by hand so the
 * test shows exactly what is being read.
 */
function jpeg(opts: { little?: boolean; original?: string; changed?: string; exif?: boolean } = {}): ArrayBuffer {
  const { little = true, original = '2026:10:15 14:03:22', changed = '2026:11:01 09:00:00', exif = true } = opts;
  const tiff: number[] = [];
  const u16 = (v: number) => (little ? [v & 255, v >> 8] : [v >> 8, v & 255]);
  const u32 = (v: number) => (little ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24] : [v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255]);
  const str = (s: string) => [...s].map((c) => c.charCodeAt(0)).concat(0); // 20 bytes for a date
  // Layout: header(8) | IFD0 at 8: 2 entries (2+24+4=30) → 38 | Exif IFD at 38: 1 entry (2+12+4=18) → 56 | dates at 56, 76
  const ifd0At = 8, exifAt = 38, changedAt = 56, originalAt = 76;
  tiff.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(ifd0At));
  tiff.push(...u16(2));
  tiff.push(...u16(0x0132), ...u16(2), ...u32(20), ...u32(changedAt));
  tiff.push(...u16(0x8769), ...u16(4), ...u32(1), ...u32(exif ? exifAt : 0));
  tiff.push(...u32(0));
  tiff.push(...u16(1), ...u16(0x9003), ...u16(2), ...u32(20), ...u32(originalAt), ...u32(0));
  tiff.push(...str(changed), ...str(original));
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]; // "Exif\0\0"
  const len = app1.length + 2;
  const bytes = [0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255, ...app1, 0xff, 0xda, 0, 2];
  return new Uint8Array(bytes).buffer;
}

describe('photoTakenOn', () => {
  it('reads the shutter date, little-endian (most phones)', () => {
    expect(photoTakenOn(jpeg())).toBe('2026-10-15');
  });
  it('reads it big-endian too', () => {
    expect(photoTakenOn(jpeg({ little: false }))).toBe('2026-10-15');
  });
  it('falls back to the file date when the shutter date is unreadable', () => {
    expect(photoTakenOn(jpeg({ original: '0000:00:00 00:00:00' }))).toBe('2026-11-01');
  });
  it('knows nothing when there is no JPEG or no EXIF', () => {
    expect(photoTakenOn(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBeNull();
    expect(photoTakenOn(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer)).toBeNull();
  });
  it('survives a truncated block', () => {
    expect(photoTakenOn(jpeg().slice(0, 30))).toBeNull();
  });
});

describe('exifDateToIso', () => {
  it('rejects impossible dates', () => {
    expect(exifDateToIso('2026:02:30 10:00:00')).toBeNull();
    expect(exifDateToIso('')).toBeNull();
  });
});
