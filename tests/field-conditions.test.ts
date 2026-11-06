import { describe, it, expect } from 'vitest';
import { CONDITIONS as APP, CONDITION_MEANINGS, conditionLabel } from '../src/field/conditions';
// @ts-expect-error — plain .mjs with no type declarations
import { CONDITIONS as DATA } from '../scripts/lib/vocab.mjs';

describe('condition grades', () => {
  it('match the grades the data accepts, in the same order', () => {
    expect([...APP]).toEqual(DATA);
  });
  it('each have a meaning and a label', () => {
    for (const c of APP) {
      expect(CONDITION_MEANINGS[c].length).toBeGreaterThan(10);
      expect(conditionLabel(c)[0]).toBe(conditionLabel(c)[0]!.toUpperCase());
    }
  });
});
