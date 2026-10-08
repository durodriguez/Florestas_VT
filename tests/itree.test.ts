import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
// @ts-expect-error — plain .mjs, no type declarations
import { itreeName, itreeCondition, readItreeResults } from '../scripts/lib/itree.mjs';
// @ts-expect-error — plain .mjs, no type declarations
import { renderItreePage } from '../scripts/lib/itree-page.mjs';
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

describe('readItreeResults', () => {
  const city = [
    { city_id: 'BTV-886', lat: '44.474829', lng: '-73.190863', dbh_in: '14' },
    { city_id: 'BTV-887', lat: '44.474706', lng: '-73.19083', dbh_in: '8' },
  ];
  // As i-Tree Eco v6 writes them: thousands commas, N/A, and a non-breaking
  // space in one header.
  const result = (over: Record<string, string> = {}) => ({
    'Tree ID': '1', 'Species Name': 'Quercus macrocarpa', 'DBH (in)': '14.0',
    'Replacement Value ($)': '2,139.42', 'Carbon Storage (lb)': '1,247.2', 'Carbon Storage ($)': '166.32',
    'Gross Carbon Sequestration (lb/yr)': '14.3', 'Gross Carbon Sequestration ($/yr)': '3.09',
    'Avoided Runoff (gal/yr)': '204.6', 'Avoided Runoff ($/yr)': '1.83',
    'Carbon Avoided (lb/yr)': 'N/A', 'Carbon Avoided ($/yr)': 'N/A',
    'Pollution Removal (oz/yr)': '3.2', 'Pollution Removal ($/yr)': '1.15',
    'Oxygen Production\u00a0(lb/yr)': '38.1', 'Energy Savings ($/yr)': 'N/A',
    'Total Annual Benefits ($/yr)': '6.08',
    xCoordinate: '-73.190863', yCoordinate: '44.474829', 'User ID': 'BTV-886',
    ...over,
  });
  const second = { 'User ID': 'BTV-887', 'DBH (in)': '8.0', xCoordinate: '-73.19083', yCoordinate: '44.474706' };

  it('keeps the estimates, by city_id, as plain numbers', () => {
    const { rows, errors } = readItreeResults([result(), result(second)], city);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ city_id: 'BTV-886', replacement_usd: '2139.42', carbon_storage_lb: '1247.2', oxygen_lb_yr: '38.1' });
    expect(rows[0]).not.toHaveProperty('energy_savings_usd_yr');
  });

  it('refuses a file without the User ID column', () => {
    const { 'User ID': _, ...noId } = result();
    expect(readItreeResults([noId], city).errors[0]).toMatch(/User Tree ID ticked/);
  });

  it('refuses unknown, repeated and missing trees', () => {
    const errors = readItreeResults([result({ 'User ID': 'BTV-1' }), result(), result()], city).errors.join('\n');
    expect(errors).toMatch(/BTV-1" is not in/);
    expect(errors).toMatch(/BTV-886 appears twice/);
    expect(errors).toMatch(/1 tree\(s\) sent to i-Tree have no result: BTV-887/);
  });

  it('refuses a tree i-Tree has somewhere else, or at another size', () => {
    const errors = readItreeResults([result({ yCoordinate: '44.475' }), result({ ...second, 'DBH (in)': '9.0' })], city).errors;
    expect(errors).toEqual([
      'row 2: BTV-886 is not where data/city-trees.csv puts it',
      'row 3: BTV-887 has DBH 9.0 in i-Tree but 8 here',
    ]);
  });

  it('refuses a value that is not a number', () => {
    const errors = readItreeResults([result({ 'Carbon Storage (lb)': 'N/A' }), result(second)], city).errors;
    expect(errors).toEqual(['row 2: BTV-886 has "N/A" for Carbon Storage (lb)']);
  });
});

describe('renderItreePage', () => {
  const run = {
    model: 'i-Tree Eco v6.0.41', resultsDate: '2026-10-08', weatherYear: 2024, weatherStation: '726170-14742',
    pollutionYear: 2024, pollutionStations: 'Chittenden County', prices: "i-Tree's defaults", notEstimated: 'Energy savings',
  };
  const est = (over: Record<string, string> = {}) => ({
    city_id: 'BTV-1', carbon_storage_lb: '1000', carbon_sequestration_lb_yr: '10', avoided_runoff_gal_yr: '100',
    pollution_removal_oz_yr: '2', oxygen_lb_yr: '20', total_benefits_usd_yr: '4.5', ...over,
  });
  const html = renderItreePage(run, [est(), est({ city_id: 'BTV-2' })], { base: '/site/', config: { siteName: 'UVM Trees' } });

  it('explains the estimates, with the run they came from', () => {
    expect(html).toContain('<h1>i-Tree estimates</h1>');
    expect(html).toContain('By i-Tree Eco v6.0.41, based on species');
    expect(html).toContain("Burlington's 2024");
    expect(html).toContain('It underestimates total value.');
    expect(html).toContain('the 2 <strong>City of Burlington street trees</strong>');
  });

  it('totals the trees it covers', () => {
    expect(html).toContain('<dd>2,000 lb</dd>');
    expect(html).toContain('<dd>$9 a year</dd>');
  });

  it('sits one folder below the site, beside the species pages', () => {
    expect(html).toContain('href="../species/species.css"');
    expect(html).toContain('src="../uvm-mark.png"');
    expect(html).toContain('Powered by <a href="https://www.itreetools.org/">i-Tree</a>');
  });
});
