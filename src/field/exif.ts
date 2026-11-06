/**
 * The date a photo was taken, read from the EXIF block a camera writes into
 * a JPEG. Used to date a survey from a photo taken on an earlier day.
 *
 * Only the date is read, and only from JPEG, which is what a phone hands a
 * web page (an iPhone converts HEIC on the way). DateTimeOriginal is the
 * shutter time; DateTimeDigitized and the file's DateTime are fallbacks. The
 * time is the camera's local clock, which is what a survey date means.
 *
 * Returns null for anything else: no EXIF, a phone that stripped it, a
 * malformed block. The caller then knows nothing, rather than something wrong.
 */

const DATE_TIME = 0x0132;          // IFD0: when the file was last changed
const EXIF_IFD = 0x8769;           // IFD0: pointer to the Exif IFD
const DATE_TIME_ORIGINAL = 0x9003; // Exif IFD: when the shutter fired
const DATE_TIME_DIGITIZED = 0x9004;

/** "2026:10:15 14:03:22" → "2026-10-15", or null if it is not a real date. */
export function exifDateToIso(value: string): string | null {
  const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (Number(y) < 1990 || date.getUTCMonth() !== Number(mo) - 1 || date.getUTCDate() !== Number(d)) return null;
  return `${y}-${mo}-${d}`;
}

export function photoTakenOn(buffer: ArrayBuffer): string | null {
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // not a JPEG
    let at = 2;
    while (at + 4 <= view.byteLength) {
      if (view.getUint8(at) !== 0xff) return null;
      const marker = view.getUint8(at + 1);
      const length = view.getUint16(at + 2);
      if (marker === 0xe1 && readAscii(view, at + 4, 6) === 'Exif\0\0') {
        return fromTiff(view, at + 10);
      }
      if (marker === 0xda) return null; // image data: no EXIF before it
      at += 2 + length;
    }
    return null;
  } catch {
    return null;
  }
}

function fromTiff(view: DataView, tiff: number): string | null {
  const order = view.getUint16(tiff);
  const little = order === 0x4949; // "II"; "MM" is big-endian
  if (!little && order !== 0x4d4d) return null;
  const u16 = (o: number) => view.getUint16(tiff + o, little);
  const u32 = (o: number) => view.getUint32(tiff + o, little);

  const tags = (ifd: number): Map<number, number> => {
    const out = new Map<number, number>(); // tag → offset of its 12-byte entry
    const count = u16(ifd);
    for (let i = 0; i < count; i++) out.set(u16(ifd + 2 + i * 12), ifd + 2 + i * 12);
    return out;
  };
  const ascii = (entry: number): string | null => {
    if (u16(entry + 2) !== 2) return null; // type ASCII
    const n = u32(entry + 4);
    const where = n <= 4 ? entry + 8 : u32(entry + 8);
    return readAscii(view, tiff + where, n).replace(/\0+$/, '');
  };

  const ifd0 = tags(u32(4));
  const exifPtr = ifd0.get(EXIF_IFD);
  if (exifPtr !== undefined) {
    const exif = tags(u32(exifPtr + 8));
    for (const tag of [DATE_TIME_ORIGINAL, DATE_TIME_DIGITIZED]) {
      const entry = exif.get(tag);
      const iso = entry === undefined ? null : exifDateToIso(ascii(entry) ?? '');
      if (iso) return iso;
    }
  }
  const changed = ifd0.get(DATE_TIME);
  return changed === undefined ? null : exifDateToIso(ascii(changed) ?? '');
}

function readAscii(view: DataView, at: number, n: number): string {
  let s = '';
  for (let i = 0; i < n && at + i < view.byteLength; i++) s += String.fromCharCode(view.getUint8(at + i));
  return s;
}
