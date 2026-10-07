// The one standard for photos in public/photos/: the field app's own output.
// src/field/photo.ts holds the same numbers for the phone side.

export const PHOTO_EXT = '.webp';
export const MAX_EDGE = 1200;
export const QUALITY = 72;

/** Same stem, standard extension: 493-1788288876530.jpg → 493-1788288876530.webp */
export function standardName(file) {
  return file.replace(/\.[^.]+$/, '') + PHOTO_EXT;
}

/**
 * @param {string} file
 * @param {{ format?: string, width?: number, height?: number }} meta  as sharp reports it
 */
export function needsStandardizing(file, meta) {
  if (!file.toLowerCase().endsWith(PHOTO_EXT) || meta.format !== 'webp') return true;
  return Math.max(meta.width ?? 0, meta.height ?? 0) > MAX_EDGE;
}
