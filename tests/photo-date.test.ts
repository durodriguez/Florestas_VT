import { describe, it, expect } from 'vitest';
import { photoTaken } from '../src/photos';

describe('photoTaken', () => {
  it('reads a survey date as the month the photo was taken', () => {
    expect(photoTaken('2026-09-01')).toBe('Sep 2026');
    expect(photoTaken('2023-10-22')).toBe('Oct 2023');
    expect(photoTaken('2024-01-31')).toBe('Jan 2024');
    expect(photoTaken('2024-12-05')).toBe('Dec 2024');
  });

  it('says nothing rather than something wrong for a date it cannot read', () => {
    // A caption is the one place a guess would be invisible: "Jan 2026" under
    // a photo looks exactly as authoritative whether or not anybody recorded
    // a date. Better to print no line at all.
    expect(photoTaken(null)).toBe('');
    expect(photoTaken('')).toBe('');
    expect(photoTaken('sometime')).toBe('');
    expect(photoTaken('2026')).toBe('');
  });

  it('gives nothing for a month number that is not a month', () => {
    expect(photoTaken('2026-00-01')).toBe('');
    expect(photoTaken('2026-13-01')).toBe('');
  });
});
