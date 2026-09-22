/**
 * How a metal tag number relates to an accession.
 *
 * Shared by the map and the field app, which both have to turn a number
 * somebody read off a trunk into the record for that tree. The same rule
 * lives in `scripts/lib/arcgis.mjs` for the Node side, deliberately: src/ is
 * TypeScript compiled by Vite and scripts/ is plain .mjs with nothing in
 * between.
 */

/** Tag 763 is `UVM-0763`. Four digits, because that is what the tags say. */
export function accessionForTag(tag: string): string | null {
  const digits = tag.trim();
  if (!/^\d{1,4}$/.test(digits)) return null;
  return `UVM-${digits.padStart(4, '0')}`;
}
