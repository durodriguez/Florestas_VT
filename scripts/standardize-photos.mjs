#!/usr/bin/env node
// Brings every photo in public/photos/ to the one standard: WebP, at most
// 1200 px on the long edge, quality 72 — what the field app writes.
//
// The field app falls back to JPEG on a phone that cannot write WebP (Safari
// before 17), and early photos were taken before the standard existed, so
// photos can arrive in other forms. This converts them and rewrites every
// reference in data/plants.csv and data/observations.csv to the new name.
//
// Usage:
//   npm run photos              # dry run: lists what would change
//   npm run photos -- --write   # convert, rewrite the references, delete the originals

import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { PHOTO_EXT, MAX_EDGE, QUALITY, needsStandardizing, standardName } from './lib/photos.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'public', 'photos');
const write = process.argv.includes('--write');

const files = readdirSync(dir).filter((f) => /\.(jpe?g|png|webp|heic|heif|gif|tiff?)$/i.test(f));
const todo = [];
for (const f of files) {
  const meta = await sharp(join(dir, f)).metadata();
  if (needsStandardizing(f, meta)) todo.push({ from: f, to: standardName(f), meta });
}

if (!todo.length) {
  console.log(`✓ all ${files.length} photos are already ${PHOTO_EXT}, ≤ ${MAX_EDGE} px`);
  process.exit(0);
}

const clash = todo.find((t) => t.to !== t.from && existsSync(join(dir, t.to)));
if (clash) {
  console.error(`✗ ${clash.from} would become ${clash.to}, which already exists — rename one first`);
  process.exit(1);
}

// Every CSV column that can name a photo.
const sources = [
  { path: join(root, 'data', 'observations.csv'), column: 'photo' },
  { path: join(root, 'data', 'plants.csv'), column: 'photo' },
].filter((s) => existsSync(s.path));

let before = 0;
let after = 0;
for (const t of todo) {
  const src = join(dir, t.from);
  before += readFileSync(src).length;
  // rotate() with no angle bakes in the EXIF orientation, as the field app does.
  const buf = await sharp(src)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer({ resolveWithObject: true });
  after += buf.data.length;
  console.log(`  ${t.from} (${t.meta.format}, ${t.meta.width}×${t.meta.height}, ${kb(readFileSync(src).length)})`
    + ` → ${t.to} (${buf.info.width}×${buf.info.height}, ${kb(buf.data.length)})`);
  if (write) {
    writeFileSync(join(dir, t.to), buf.data);
    if (t.to !== t.from) unlinkSync(src);
  }
}

// Rewrite references by exact cell value, line by line, so nothing else in the
// file is re-quoted or reformatted.
const renamed = new Map(todo.filter((t) => t.to !== t.from).map((t) => [t.from, t.to]));
let refs = 0;
for (const s of sources) {
  const text = readFileSync(s.path, 'utf8');
  const lines = text.split('\n');
  const header = lines[0].split(',');
  if (!header.includes(s.column)) continue;
  let changed = 0;
  const out = lines.map((line, i) => {
    if (i === 0) return line;
    for (const [from, to] of renamed) {
      if (line.includes(from)) {
        changed++;
        return line.split(from).join(to);
      }
    }
    return line;
  });
  refs += changed;
  if (changed) console.log(`  ${basename(s.path)}: ${changed} reference(s) renamed`);
  if (write && changed) writeFileSync(s.path, out.join('\n'));
}

console.log(`\n${todo.length} photo(s), ${kb(before)} → ${kb(after)}; ${refs} reference(s)`);
console.log(write ? '✓ written. Run `npm run data` to rebuild.' : 'Dry run — nothing written. Add --write to apply.');

function kb(n) {
  return `${Math.round(n / 1024)} kB`;
}
