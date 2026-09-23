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

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "2026-09-01" as "Sep 2026", for the line under a photo.
 *
 * The month is as precise as this wants to be. A reader wants to know how old
 * the picture is, not which Tuesday it was taken on — and a photo with no
 * date gets no line rather than a guess, because a caption is the one place a
 * guess would be invisible.
 *
 * The date is the survey's, which is the photo's: the photo on a plant is
 * always the one from its latest observation, so a later survey recording no
 * photo shows none at all rather than an older one under a newer date.
 *
 * Mirrored by photoTaken() in scripts/lib/species-pages.mjs, which cannot
 * import this — src/ is TypeScript compiled by Vite, scripts/ is plain .mjs.
 */
export function photoTaken(date: string | null): string {
  const m = /^(\d{4})-(\d{2})/.exec(date ?? '');
  if (!m) return '';
  const month = MONTHS[Number(m[2])];
  return month ? `${month} ${m[1]}` : '';
}
