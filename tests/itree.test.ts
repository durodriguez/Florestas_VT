import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
// @ts-expect-error — plain .mjs, no type declarations
import { itreeName, itreeCondition } from '../scripts/lib/itree.mjs';
// @ts-expect-error — plain .mjs, no type declarations
import { colName, excelDate, writeXlsx } from '../scripts/lib/xlsx.mjs';

const t = (over: Record<string, string>) => ({ taxon_id: 'x', scientific_name: '', genus: '', cultivar: '', ...over });

describe('itreeName', () => {
  it('passes a plain species through untouched', () => {
    expect(itreeName(t({ scientific_name: 'Celtis occidentalis', genus: 'Celtis' }))).toEqual({ name: 'Celtis occidentalis', note: '' });
  });
  it('models a cultivar as its species, and says so', () => {
    const r = itreeName(t({ scientific_name: "Ulmus americana 'Princeton'", genus: 'Ulmus', cultivar: 'Princeton' }));
    expect(r.name).toBe('Ulmus americana');
    expect(r.note).toMatch(/Princeton/);
  });
  it('keeps hybrid epithets', () => {
    expect(itreeName(t({ scientific_name: "Acer x freemanii 'Autumn Blaze'", cultivar: 'Autumn Blaze' })).name).toBe('Acer x freemanii');
  });
  it('falls back to the genus for "sp." and cultivar-only records', () => {
    expect(itreeName(t({ scientific_name: 'Malus sp.', genus: 'Malus' }))).toEqual({ name: 'Malus', note: 'genus only' });
    expect(itreeName(t({ scientific_name: "Malus 'Donald Wyman'", genus: 'Malus' })).name).toBe('Malus');
  });
  it('writes forms and varieties as "v.", as i-Tree\'s list does', () => {
    expect(itreeName(t({ scientific_name: "Gleditsia triacanthos f. inermis 'Skyline'", cultivar: 'Skyline' })).name)
      .toBe('Gleditsia triacanthos v. inermis');
    expect(itreeName(t({ scientific_name: 'Ulmus davidiana var. japonica' })).name).toBe('Ulmus davidiana v. japonica');
  });
  it('maps names i-Tree does not list back', () => {
    expect(itreeName(t({ taxon_id: 'scandosorbus-intermedia', scientific_name: 'Scandosorbus intermedia' })).name)
      .toBe('Sorbus intermedia');
    expect(itreeName(t({ taxon_id: 'quercus-x-warei', scientific_name: 'Quercus x warei' })).name).toBe('Quercus');
  });
});

describe('itreeCondition', () => {
  it('turns the city\'s words into i-Tree\'s percent condition classes', () => {
    expect(['excellent', 'Good', 'fair', 'poor', 'dead', '', 'odd'].map(itreeCondition))
      .toEqual(['100%', '90% - 95%', '80% - 85%', '60% - 65%', '0%', '', '']);
  });
});

describe('xlsx', () => {
  it('names columns as Excel does', () => {
    expect([0, 25, 26, 27, 701, 702].map(colName)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
  });
  it('counts dates from Excel\'s epoch', () => {
    expect(excelDate('1900-03-01')).toBe(61);
    expect(excelDate('2014-06-15')).toBe(41805);
  });
  it('writes each cell with its type', async () => {
    const buf = await writeXlsx(
      [{ header: 'Tree ID', type: 'number' }, { header: 'Name', type: 'text' }, { header: 'Date', type: 'date' }],
      [['7', 'A & B', '2014-06-15'], [8, '', null]],
    );
    const sheet = await (await JSZip.loadAsync(buf)).file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheet).toContain('<c r="A2"><v>7</v></c>');
    expect(sheet).toContain('<t>A &amp; B</t>');
    expect(sheet).toContain('<c r="C2" s="1"><v>41805</v></c>');
    expect(sheet).not.toContain('r="B3"');
  });
  it('refuses text in a number column rather than writing it as text', async () => {
    await expect(writeXlsx([{ header: 'DBH', type: 'number' }], [['12in']])).rejects.toThrow(/A2/);
  });
});
