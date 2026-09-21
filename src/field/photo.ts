/**
 * Shrinks a camera photo before it is stored.
 *
 * A modern phone camera produces roughly 4 MB and 12 megapixels per shot. At
 * a few hundred trees that fills the browser's storage quota mid-survey, makes
 * the export zip unwieldy, and would eventually outgrow what a static site can
 * carry. The record panel on the map displays a photo a few hundred pixels
 * wide, so the sizes below are still generous.
 *
 * Orientation matters as much as size: phones store a portrait shot as a
 * landscape frame plus an EXIF rotation flag. Drawing to a canvas discards that
 * flag, so the rotation has to be baked in — otherwise every photo comes out
 * sideways. `createImageBitmap` with `imageOrientation: 'from-image'` applies
 * it before we draw.
 *
 * Format is WebP where the device can write it, which at matched quality runs
 * roughly 25-35% under JPEG. Across a few thousand trees that is the difference
 * between something a static site can carry and something it cannot.
 */

/**
 * Long edge in pixels, and JPEG/WebP quality.
 *
 * Measured on a real survey photo rather than guessed: 1600 px at 0.82 is
 * 540 kB, and 1200 px at 0.72 is 228 kB — 58% less for an image the record
 * panel displays a few hundred pixels wide, and which still has pixels to
 * spare on a high-density phone screen.
 *
 * Across 2,500 trees that is the difference between 1.3 GB and 0.5 GB for one
 * photo each, and it is the cheapest lever there is: two numbers, no new
 * infrastructure, and it applies to every photo taken from here on.
 */
export const MAX_EDGE = 1200;
export const QUALITY = 0.72;

export interface Shrunk {
  blob: Blob;
  width: number;
  height: number;
  originalBytes: number;
}

/**
 * Encode, preferring WebP.
 *
 * The guard is not optional. A browser asked for a type it cannot write does
 * not fail — it quietly returns PNG, which for a photograph is several times
 * *larger* than the JPEG we were trying to beat. Safari only learned to write
 * WebP from a canvas in 17, and iPhones are most of what will be in a
 * surveyor's hand, so this path is the common one, not the edge case.
 */
async function encode(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const asType = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));

  const webp = await asType('image/webp');
  if (webp && webp.type === 'image/webp') return webp;
  return asType('image/jpeg');
}

/** The extension that matches what the encoder actually produced. */
export function extensionFor(blob: Blob): string {
  if (blob.type === 'image/webp') return 'webp';
  if (blob.type === 'image/png') return 'png';
  return 'jpg';
}

export async function shrinkPhoto(file: Blob): Promise<Shrunk> {
  const originalBytes = file.size;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Older engine, or an image it cannot decode: keep the original rather
    // than risk writing a rotated or corrupted copy.
    return { blob: file, width: 0, height: 0, originalBytes };
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return { blob: file, width: 0, height: 0, originalBytes };
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await encode(canvas);
  // If re-encoding somehow produced nothing, or made it bigger, keep the original.
  if (!blob || blob.size >= originalBytes) {
    return { blob: file, width: 0, height: 0, originalBytes };
  }
  return { blob, width, height, originalBytes };
}

export const kb = (bytes: number): string =>
  bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} kB`;
