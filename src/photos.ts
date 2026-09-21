/**
 * Where a photo actually lives.
 *
 * Photos are the one part of this project with no ceiling: every tree wants at
 * least one, many want several, and re-photographing is something you do
 * forever. A repository is the wrong container for that — it keeps every
 * version of every file permanently, so it grows by the size of every photo
 * there has *ever* been, and a published GitHub Pages site stops at 1 GB.
 *
 * So the address is configurable. Leave `photoBaseUrl` blank and photos come
 * from the site's own `photos/` folder, which is what happens today. Set it to
 * UVM web space or object storage and they come from there instead, at which
 * point the repository holds only filenames — about thirty characters each —
 * and stops growing however many photos exist.
 *
 * Moving them later is one line in data/config.json, not a migration.
 */

/** A photo already given as a full address is used as it stands. */
const ABSOLUTE = /^https?:\/\//i;

export function photoUrl(file: string, base: string, photoBaseUrl = ''): string {
  if (!file) return '';
  // Lets one collection mix sources — a species photo hosted elsewhere
  // alongside survey photos from the configured home.
  if (ABSOLUTE.test(file)) return file;
  const root = photoBaseUrl ? photoBaseUrl.replace(/\/+$/, '') + '/' : `${base}photos/`;
  return root + encodeURIComponent(file);
}
