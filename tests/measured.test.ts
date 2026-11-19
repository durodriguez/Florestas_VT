import { describe, it, expect } from 'vitest';
import { ageBand, measuredOn, whenText, yearsAgo } from '../src/measured';

const NOW = new Date(2026, 10, 20); // 20 November 2026

describe('how old a measurement is', () => {
  it('counts whole years, from mid-year for a bare year', () => {
    expect(yearsAgo('2014', NOW)).toBe(12);
    expect(yearsAgo('2022', NOW)).toBe(4);
    expect(yearsAgo('2026-09-25', NOW)).toBe(0);
    expect(yearsAgo('2024-11-25', NOW)).toBe(1);
  });
  it('says the age once it is two years or more', () => {
    expect(whenText('2014', NOW)).toBe('2014, 12 years ago');
    expect(whenText('2026-09-25', NOW)).toBe('Sep 2026');
    expect(whenText('2024-03-02', NOW)).toBe('Mar 2024, 2 years ago');
  });
  it('bands ages for the map', () => {
    expect(ageBand('2026-09-25', NOW)).toBe('recent');
    expect(ageBand('2022', NOW)).toBe('recent');
    expect(ageBand('2018-05-01', NOW)).toBe('older');
    expect(ageBand('2014', NOW)).toBe('old');
    expect(ageBand(null, NOW)).toBe('none');
  });
  it('dates each measurement: trunk from its own visit, height and spread from the latest', () => {
    expect(measuredOn({ dbhIn: 49, dbhOn: '2014', heightFt: 70, spreadFt: null, surveyedOn: '2026-09-01' }))
      .toEqual({ dbh: '2014', height: '2026-09-01', spread: null });
    expect(measuredOn({ dbhIn: 12, dbhOn: null, heightFt: null, spreadFt: null, surveyedOn: '2026-09-01' }).dbh).toBe('2026-09-01');
  });
});
