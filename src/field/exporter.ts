/**
 * Turns the day's records into the two files the desk workflow expects:
 * a CSV that `npm run import` understands, and a zip of the photos that go
 * into public/photos/.
 */

import JSZip from 'jszip';
import type { SurveyRecord, PhotoBlob } from './db';

/** Column names match survey/mapping.json, so the importer needs no config. */
const COLUMNS: Array<[string, (r: SurveyRecord) => string]> = [
  ['tag', (r) => r.tag],
  ['species', (r) => r.species],
  ['lat', (r) => (r.lat === null ? '' : r.lat.toFixed(6))],
  ['lng', (r) => (r.lng === null ? '' : r.lng.toFixed(6))],
  ['area', () => ''],
  ['dbh_in', (r) => (r.dbhIn === null ? '' : String(r.dbhIn))],
  ['height_ft', (r) => (r.heightFt === null ? '' : String(r.heightFt))],
  ['spread_ft', (r) => (r.spreadFt === null ? '' : String(r.spreadFt))],
  ['condition', (r) => r.condition],
  ['surveyor', (r) => r.surveyor],
  ['date', (r) => r.surveyedOn],
  ['photo', (r) => r.photoName ?? ''],
  ['notes', (r) => notesFor(r)],
];

/**
 * Field observations that have no column of their own are folded into notes,
 * so nothing the surveyor flagged is silently dropped on export.
 */
function notesFor(r: SurveyRecord): string {
  const parts: string[] = [];
  // Trim a trailing stop so joining does not produce "bark.. GPS ±4 m".
  if (r.notes.trim()) parts.push(r.notes.trim().replace(/\.\s*$/, ''));
  if (r.speciesMismatch) {
    parts.push('SPECIES MISMATCH: does not match the 2014 record for this tag — verify.');
  }
  if (r.accuracy !== null) {
    parts.push(`GPS ±${r.accuracy.toFixed(0)} m${r.pinAdjusted ? ', pin adjusted on imagery' : ''}`);
  } else if (r.pinAdjusted) {
    parts.push('Position set by pin on imagery');
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
