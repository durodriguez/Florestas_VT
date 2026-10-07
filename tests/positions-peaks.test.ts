import { describe, it, expect } from 'vitest';
import { parsePeaks } from '../src/positions/peaks';

describe('parsePeaks', () => {
  it('reads the build file by column name', () => {
    expect(parsePeaks({ fields: ['id', 'lat', 'lng', 'height_m'], rows: [['P0001', 44.48, -73.19, 22.3]] }))
      .toEqual([{ id: 'P0001', lat: 44.48, lng: -73.19, height: 22.3 }]);
  });
});
