/**
 * Turns the day's records into the two files the desk workflow expects:
 * a CSV that `npm run import` understands, and a zip of the photos that go
 * into public/photos/.
 */

import JSZip from 'jszip';
import type { SurveyRecord, PhotoBlob } from './db';
import { speciesChanged } from './species';

/** Column names match survey/mapping.json, so the importer needs no config. */
const COLUMNS: Array<[string, (r: SurveyRecord) => string]> = [
  ['tag', (r) => r.tag],
  // Both, deliberately. taxon_id is what the importer matches on, and the name
  // is what makes the file readable by the person reviewing it.
  ['taxon_id', (r) => r.taxonId ?? ''],
  ['species', (r) => r.species],
  ['lat', (r) => (r.lat === null ? '' : r.lat.toFixed(6))],
  ['lng', (r) => (r.lng === null ? '' : r.lng.toFixed(6))],
  ['area', () => ''],
  ['dbh_in', (r) => (r.dbhIn === null ? '' : String(r.dbhIn))],
  ['height_ft', (r) => (r.heightFt === null ? '' : String(r.heightFt))],
  ['spread_ft', (r) => (r.spreadFt === null ? '' : String(r.spreadFt))],
  ['condition', (r) => r.condition],
  ['planted_year', (r) => (r.plantedYear === null ? '' : String(r.plantedYear))],
  ['surveyor', (r) => r.surveyor],
  ['date', (r) => r.surveyedOn],
  ['photo', (r) => r.photoName ?? ''],
  ['geolocation_notes', (r) => geolocationNotesFor(r)],
  ['dedication_label', (r) => r.dedication ?? ''],
  ['notes', (r) => notesFor(r)],
];

/**
 * How this position was arrived at — which is about the coordinates, not about
 * the tree, and so belongs beside them in plants.csv rather than in the notes
 * on one visit. It is also the line a visitor reading the public record has no
 * use for, which is a second reason to keep it out of the surveyor's notes.
 */
function geolocationNotesFor(r: SurveyRecord): string {
  if (r.accuracy !== null) {
    return `GPS ±${r.accuracy.toFixed(0)} m${r.pinAdjusted ? ', pin adjusted on imagery' : ''}`;
  }
  return r.pinAdjusted ? 'Position set by pin on imagery' : '';
}

/**
 * What the surveyor saw. Field observations that have no column of their own
 * are folded in here, so nothing they flagged is silently dropped on export.
 */
function notesFor(r: SurveyRecord): string {
  const parts: string[] = [];
  // Trim a trailing stop so joining does not produce "bark.. Planting year…".
  if (r.notes.trim()) parts.push(r.notes.trim().replace(/\.\s*$/, ''));
  if (r.plantedUnknown) {
    parts.push('Planting year recorded as unknown');
  }
  // Detected, not declared: the surveyor corrected the species, and that *is*
  // the finding. Nothing here asks them to also say so.
  if (speciesChanged(r.referenceSpecies, r.referenceTaxonId, r.species, r.taxonId)) {
    parts.push(
      `SPECIES CHANGED: 2014 record for tag ${r.tag || '(none)'} says ` +
      `${r.referenceSpecies}; recorded as ${r.species}`,
    );
  }
  // A name the species list did not recognise is either a new taxon for
  // taxa.csv or a typo, and only someone at a desk can tell which.
  if (!r.taxonId) {
    parts.push(`SPECIES NOT ON LIST: "${r.species}" was typed by hand — check it`);
  }
  return parts.join('. ');
}

const escape = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(records: SurveyRecord[]): string {
  const lines = [COLUMNS.map(([h]) => h).join(',')];
  for (const r of records) lines.push(COLUMNS.map(([, get]) => escape(get(r))).join(','));
  return lines.join('\n') + '\n';
}

export async function toPhotoZip(photos: PhotoBlob[]): Promise<Blob> {
  const zip = new JSZip();
  for (const p of photos) zip.file(p.name, p.blob);
  return zip.generateAsync({ type: 'blob' });
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke late: some browsers abort the save if the URL dies too soon.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const stamp = (): string => new Date().toISOString().slice(0, 10);
