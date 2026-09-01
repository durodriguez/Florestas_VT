/**
 * Shrinks a camera photo before it is stored.
 *
 * A modern phone camera produces roughly 4 MB and 12 megapixels per shot. At
 * a few hundred trees that fills the browser's storage quota mid-survey, makes
 * the export zip unwieldy, and would eventually outgrow what a static site can
 * carry. The record panel on the map displays a photo a few hundred pixels
 * wide, so a 1600 px long edge is already generous.
 *
 * Orientation matters as much as size: phones store a portrait shot as a
 * landscape frame plus an EXIF rotation flag. Drawing to a canvas discards that
 * flag, so the rotation has to be baked in — otherwise every photo comes out
 * sideways. `createImageBitmap` with `imageOrientation: 'from-image'` applies
 * it before we draw.
 */

export const MAX_EDGE = 1600;
export const QUALITY = 0.82;

export interface Shrunk {
  blob: Blob;
  width: number;
  height: number;
  originalBytes: number;
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

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  );
  // If re-encoding somehow produced nothing, or made it bigger, keep the original.
  if (!blob || blob.size >= originalBytes) {
    return { blob: file, width: 0, height: 0, originalBytes };
  }
  return { blob, width, height, originalBytes };
}

export const kb = (bytes: number): string =>
  bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} kB`;
