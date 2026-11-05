import { describe, expect, it } from 'vitest';
import { clampSideHeight, MIN_MAP_PX, MIN_SIDE_PX } from '../src/positions/split';

describe('clampSideHeight', () => {
  it('keeps a height inside the limits as it is', () => {
    expect(clampSideHeight(300, 700)).toBe(300);
  });
  it('never lets the panel vanish', () => {
    expect(clampSideHeight(0, 700)).toBe(MIN_SIDE_PX);
    expect(clampSideHeight(-50, 700)).toBe(MIN_SIDE_PX);
  });
  it('always leaves room for the map', () => {
    expect(clampSideHeight(10000, 700)).toBe(700 - MIN_MAP_PX);
  });
  it('keeps the panel minimum on a screen too short for both', () => {
    expect(clampSideHeight(100, 150)).toBe(MIN_SIDE_PX);
  });
  it('rounds to whole pixels', () => {
    expect(clampSideHeight(250.6, 700)).toBe(251);
  });
});
