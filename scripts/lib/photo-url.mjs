/**
 * The same rule as src/photos.ts, for the build script.
 *
 * Duplicated rather than shared because src/ is TypeScript compiled by Vite and
 * scripts/ is plain .mjs run by Node, with no build step between them. Six
 * lines, and tests/photos.test.ts pins the behaviour both must follow.
 */
const ABSOLUTE = /^https?:\/\//i;

export function photoUrl(file, base, photoBaseUrl = '') {
  if (!file) return '';
  if (ABSOLUTE.test(file)) return file;
  const root = photoBaseUrl ? photoBaseUrl.replace(/\/+$/, '') + '/' : `${base}photos/`;
  return root + encodeURIComponent(file);
}
