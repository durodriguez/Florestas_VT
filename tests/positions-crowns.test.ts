import { describe, it, expect } from 'vitest';
import { isVermontFeet, nearRings, parseDbf, parseShpPoints, vermontFeetToLatLng } from '../src/positions/crowns';

describe('vermontFeetToLatLng', () => {
  // Reference values from PROJ (pyproj) for points in SAL's own file.
  const cases: Array<[number, number, number, number]> = [
    [1439357.2197952457, 744213.9335997403, 44.5391524533962, -73.27111267313606],
    [1439862.15710558, 738619.4241194874, 44.52382104860802, -73.26897434114522],
    [1454980.554362163, 710099.4014352411, 44.44597102078666, -73.21006178452193],
  ];
  it.each(cases)('agrees with PROJ to a centimetre (%f, %f)', (x, y, lat, lng) => {
    const [a, b] = vermontFeetToLatLng(x, y);
    expect(Math.abs(a - lat) * 111_320).toBeLessThan(0.01);
    expect(Math.abs(b - lng) * 111_320 * Math.cos((lat * Math.PI) / 180)).toBeLessThan(0.01);
  });
});

describe('isVermontFeet', () => {
  it('accepts SAL’s projection and refuses others', () => {
    const sal = 'PROJCS["NAD_1983_Vermont_State_Planes_US_Foot",GEOGCS["GCS_North_American_1983",DATUM["D_North_American_1983",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",1640416.66666667],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",-72.5],PARAMETER["Scale_Factor",0.9999642857],PARAMETER["Latitude_Of_Origin",42.5],UNIT["US survey foot",0.3048006096012192]]';
    expect(isVermontFeet(sal)).toBe(true);
    expect(isVermontFeet(sal.replace(/US_Foot/g, 'Meter').replace('US survey foot', 'Meter'))).toBe(false);
    expect(isVermontFeet('GEOGCS["GCS_WGS_1984"]')).toBe(false);
  });
});

/** A two-point PointZ shapefile and its table, built byte by byte. */
function sample() {
  const shp = new DataView(new ArrayBuffer(100 + 2 * (8 + 36)));
  shp.setInt32(0, 9994, false);
  shp.setInt32(32, 11, true);
  [[100, 200], [300, 400]].forEach(([x, y], i) => {
    const at = 100 + i * 44;
    shp.setInt32(at, i + 1, false);
    shp.setInt32(at + 4, 18, false);         // 36 bytes of content, in 16-bit words
    shp.setInt32(at + 8, 11, true);
    shp.setFloat64(at + 12, x!, true);
    shp.setFloat64(at + 20, y!, true);
  });
  const fields = [['Height', 19], ['Radius', 19]] as const;
  const headerLen = 32 + 32 * fields.length + 1;
  const recordLen = 1 + 19 + 19;
  const dbf = new Uint8Array(headerLen + 2 * recordLen);
  const v = new DataView(dbf.buffer);
  v.setUint32(4, 2, true);
  v.setUint16(8, headerLen, true);
  v.setUint16(10, recordLen, true);
  fields.forEach(([name, len], i) => {
    dbf.set(new TextEncoder().encode(name), 32 + i * 32);
    dbf[32 + i * 32 + 11] = 'F'.charCodeAt(0);
    dbf[32 + i * 32 + 16] = len;
  });
  dbf[32 + 32 * fields.length] = 0x0d;
  [['16.5', '5.25'], ['20', '7']].forEach((vals, r) => {
    const start = headerLen + r * recordLen;
    dbf[start] = 0x20;
    vals.forEach((val, i) => dbf.set(new TextEncoder().encode(val.padStart(19)), start + 1 + i * 19));
  });
  return { shp: shp.buffer, dbf: dbf.buffer };
}

describe('shapefile reading', () => {
  it('reads point coordinates, ignoring Z', () => {
    expect(parseShpPoints(sample().shp)).toEqual([[100, 200], [300, 400]]);
  });
  it('reads the attribute table by field name', () => {
    expect(parseDbf(sample().dbf)).toEqual([{ Height: '16.5', Radius: '5.25' }, { Height: '20', Radius: '7' }]);
  });
  it('refuses a file that is not a shapefile', () => {
    expect(() => parseShpPoints(new ArrayBuffer(100))).toThrow(/not a shapefile/);
  });
});

describe('nearRings', () => {
  // A 100 m square near campus.
  const lat0 = 44.475, lng0 = -73.19;
  const dLat = 100 / 111_320, dLng = 100 / (111_320 * Math.cos((lat0 * Math.PI) / 180));
  const square: Array<[number, number]> = [[lng0, lat0], [lng0 + dLng, lat0], [lng0 + dLng, lat0 + dLat], [lng0, lat0 + dLat], [lng0, lat0]];
  const near = nearRings([square], 30);
  it('keeps crowns inside and just outside, and drops ones well away', () => {
    expect(near(lat0 + dLat / 2, lng0 + dLng / 2)).toBe(true);
    expect(near(lat0 + dLat / 2, lng0 - dLng * 0.2)).toBe(true);    // 20 m outside
    expect(near(lat0 + dLat / 2, lng0 - dLng * 0.5)).toBe(false);   // 50 m outside
  });
});
