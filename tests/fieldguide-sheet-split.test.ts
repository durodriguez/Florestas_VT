import { describe, it, expect } from 'vitest';
import { clampSheetHeight, MIN_SHEET_PX, MAX_SHEET_SHARE } from '../src/fieldguide/sheet-split';

describe('the tour sheet divider', () => {
  it('keeps the sheet tall enough for the stop and its Next button', () => {
    expect(clampSheetHeight(20, 800)).toBe(MIN_SHEET_PX);
  });
  it('always leaves some map above the sheet', () => {
    expect(clampSheetHeight(5000, 800)).toBe(Math.floor(800 * MAX_SHEET_SHARE));
  });
  it('takes any height in between', () => {
    expect(clampSheetHeight(400.4, 800)).toBe(400);
  });
  it('stops at the height of its contents, so no empty space opens under them', () => {
    expect(clampSheetHeight(600, 800, 420)).toBe(420);
  });
  it('never goes below the minimum on a very short screen', () => {
    expect(clampSheetHeight(100, 120)).toBe(MIN_SHEET_PX);
  });
});
