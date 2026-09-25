import { describe, it, expect } from 'vitest';
import { clampFiltersHeight } from '../src/panel-split';

describe('clampFiltersHeight', () => {
  it('passes a height inside the limits straight through', () => {
    expect(clampFiltersHeight(300, 700)).toBe(300);
  });

  it('never lets the filters vanish', () => {
    expect(clampFiltersHeight(0, 700)).toBe(40);
    expect(clampFiltersHeight(-50, 700)).toBe(40);
  });

  it('always leaves room for the result count and a row of results', () => {
    expect(clampFiltersHeight(10_000, 700)).toBe(590);
  });

  it('keeps the minimum even in a panel too short to honour both', () => {
    expect(clampFiltersHeight(500, 100)).toBe(40);
  });
});
