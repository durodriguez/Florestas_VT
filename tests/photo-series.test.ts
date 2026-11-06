import { describe, it, expect } from 'vitest';
import { photoSeries } from '../src/photos';

const visit = (surveyedOn: string, photo: string | null = null) => ({ surveyedOn, photo });

describe('photoSeries', () => {
  it('lists every photo, newest first, with its visit date', () => {
    const plant = {
      photo: 'c.webp', photoOn: null, surveyedOn: '2026-09-01',
      history: [visit('2014'), visit('2023-06-01', 'a.webp'), visit('2025-04-24', 'b.webp'), visit('2025-10-01'), visit('2026-09-01', 'c.webp')],
    };
    expect(photoSeries(plant)).toEqual([
      { file: 'c.webp', on: '2026-09-01' }, { file: 'b.webp', on: '2025-04-24' }, { file: 'a.webp', on: '2023-06-01' },
    ]);
  });

  it('gives one photo for a plant with a single visit, which has no history', () => {
    expect(photoSeries({ photo: 'a.webp', photoOn: null, surveyedOn: '2026-09-01', history: [] }))
      .toEqual([{ file: 'a.webp', on: '2026-09-01' }]);
  });

  it('gives none for a plant with no photo', () => {
    expect(photoSeries({ photo: null, photoOn: null, surveyedOn: '2026-09-01', history: [visit('2026-09-01')] })).toEqual([]);
  });
});
