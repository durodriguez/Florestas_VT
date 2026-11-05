import { describe, expect, it } from 'vitest';
import { accuracyLabel } from '../src/positions/accuracy';

describe('accuracyLabel', () => {
  it('rounds to whole meters, never below one', () => {
    expect(accuracyLabel(4.4)).toBe('±4 m');
    expect(accuracyLabel(0.3)).toBe('±1 m');
  });

  it('warns once the circle is wider than the corrections being made', () => {
    expect(accuracyLabel(15)).toBe('±15 m');
    expect(accuracyLabel(40)).toBe('±40 m — too rough to place trees by');
  });
});
