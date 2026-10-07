import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import Papa from 'papaparse';
import { photoUrl } from '../src/photos';
// @ts-expect-error — plain .mjs, no type declarations
import { PHOTO_EXT, needsStandardizing, standardName } from '../scripts/lib/photos.mjs';

describe('photoUrl', () => {
  it('serves from the site itself when no base is configured', () => {
    expect(photoUrl('493-1788288876530.webp', '/Florestas_VT/'))
      .toBe('/Florestas_VT/photos/493-1788288876530.webp');
  });

  it('serves from the configured base when there is one', () => {
    // The whole point: photos move off the repository without any code change.
    expect(photoUrl('493.webp', '/', 'https://uvm.edu/trees/photos'))
      .toBe('https://uvm.edu/trees/photos/493.webp');
  });

  it('does not double the slash when the base carries one', () => {
    expect(photoUrl('493.webp', '/', 'https://uvm.edu/photos/'))
      .toBe('https://uvm.edu/photos/493.webp');
    expect(photoUrl('493.webp', '/', 'https://uvm.edu/photos///'))
      .toBe('https://uvm.edu/photos/493.webp');
  });

  it('leaves a photo that is already a full address alone', () => {
    // Lets one collection mix sources — a species photo hosted elsewhere
    // alongside survey photos from the configured home.
    const url = 'https://images.example.org/dawn-redwood-bark.webp';
    expect(photoUrl(url, '/', 'https://uvm.edu/photos')).toBe(url);
    expect(photoUrl(url, '/')).toBe(url);
  });

  it('escapes a filename that would otherwise break the URL', () => {
    expect(photoUrl('UVM 0493 (2).webp', '/')).toBe('/photos/UVM%200493%20(2).webp');
  });

  it('returns nothing for a plant with no photo', () => {
    expect(photoUrl('', '/', 'https://uvm.edu/photos')).toBe('');
  });
});

describe('the photo standard', () => {
  it('keeps the stem and changes only the extension', () => {
    expect(standardName('493-1788288876530.jpg')).toBe('493-1788288876530.webp');
    expect(standardName('untagged-1.JPEG')).toBe('untagged-1.webp');
  });
  it('passes a WebP within 1200 px, and nothing else', () => {
    expect(needsStandardizing('a.webp', { format: 'webp', width: 904, height: 1200 })).toBe(false);
    expect(needsStandardizing('a.webp', { format: 'webp', width: 1205, height: 1600 })).toBe(true);
    expect(needsStandardizing('a.jpg', { format: 'jpeg', width: 904, height: 1200 })).toBe(true);
    expect(needsStandardizing('a.webp', { format: 'jpeg', width: 904, height: 1200 })).toBe(true);
  });
});

describe('photos on file', () => {
  const dir = join(__dirname, '..', 'public', 'photos');
  const onDisk = readdirSync(dir).filter((f) => f !== 'README.md');
  const referenced = ['observations.csv', 'plants.csv']
    .map((f) => join(__dirname, '..', 'data', f))
    .filter(existsSync)
    .flatMap((p) => Papa.parse<Record<string, string>>(readFileSync(p, 'utf8'), { header: true, skipEmptyLines: 'greedy' }).data)
    .map((r) => (r.photo ?? '').trim())
    .filter((p) => p && !/^https?:\/\//.test(p));

  it('are all one type, WebP — `npm run photos -- --write` converts any that are not', () => {
    expect(onDisk.filter((f) => !f.endsWith(PHOTO_EXT))).toEqual([]);
    expect(referenced.filter((f) => !f.endsWith(PHOTO_EXT))).toEqual([]);
  });

  it('exist for every record that names one', () => {
    expect(referenced.filter((f) => !onDisk.includes(f))).toEqual([]);
  });
});
