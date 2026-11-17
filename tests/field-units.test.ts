import { describe, it, expect } from 'vitest';
import { fromStored, labels, toStored, type Entered, type MeasurePrefs } from '../src/field/units';

const IMP_D: MeasurePrefs = { units: 'imperial', trunk: 'diameter' };
const IMP_C: MeasurePrefs = { units: 'imperial', trunk: 'circumference' };
const MET_D: MeasurePrefs = { units: 'metric', trunk: 'diameter' };
const MET_C: MeasurePrefs = { units: 'metric', trunk: 'circumference' };

describe('toStored', () => {
  it('keeps inches of diameter and feet as typed', () => {
    expect(toStored({ trunk: 12.3, height: 40, spread: 25 }, IMP_D)).toEqual({ dbhIn: 12.3, heightFt: 40, spreadFt: 25 });
  });
  it('turns a circumference into a diameter', () => {
    // 31.4 in round the trunk is a 10 in trunk.
    expect(toStored({ trunk: 31.4, height: null, spread: null }, IMP_C).dbhIn).toBe(10);
  });
  it('turns centimetres and metres into inches and feet', () => {
    expect(toStored({ trunk: 25.4, height: 12, spread: 6 }, MET_D)).toEqual({ dbhIn: 10, heightFt: 39.4, spreadFt: 19.7 });
  });
  it('handles a metric circumference: 100 cm round is 12.5 in across', () => {
    expect(toStored({ trunk: 100, height: null, spread: null }, MET_C).dbhIn).toBe(12.5);
  });
  it('leaves blanks blank and refuses nonsense', () => {
    expect(toStored({ trunk: null, height: Number.NaN, spread: -3 }, MET_C)).toEqual({ dbhIn: null, heightFt: null, spreadFt: null });
  });
});

describe('fromStored', () => {
  it('shows a saved DBH in whatever tape is chosen', () => {
    const saved = { dbhIn: 10, heightFt: 40, spreadFt: null };
    expect(fromStored(saved, IMP_C).trunk).toBe(31.4);
    expect(fromStored(saved, MET_D)).toEqual({ trunk: 25.4, height: 12.2, spread: null });
    expect(fromStored(saved, MET_C).trunk).toBe(79.8);
  });
  it('round-trips closely enough that switching back and forth does not drift', () => {
    let entered: Entered = { trunk: 47, height: 18, spread: 9 };
    let prefs = MET_C;
    for (const next of [IMP_D, MET_D, IMP_C, MET_C]) {
      entered = fromStored(toStored(entered, prefs), next);
      prefs = next;
    }
    expect(Math.abs(entered.trunk! - 47)).toBeLessThan(0.6);
    expect(Math.abs(entered.height! - 18)).toBeLessThan(0.1);
  });
});

describe('labels', () => {
  it('names the box after the tape', () => {
    expect(labels(IMP_D).trunk).toBe('DBH (in)');
    expect(labels(MET_C)).toEqual({ trunk: 'Circ. (cm)', height: 'Height (m)', spread: 'Spread (m)' });
  });
});

describe('multi-trunk trees', async () => {
  const { functionalSize, multiStemTrunk, convertTrunk, guidance } = await import('../src/field/units');
  it('adds trunks by area: square, sum, square root', () => {
    expect(functionalSize([30, 40])).toBe(50);
    expect(functionalSize([20, 20, 20, 20])).toBe(40);
  });
  it('needs at least two trunks', () => {
    expect(functionalSize([30])).toBeNull();
    expect(functionalSize([30, null])).toBeNull();
  });
  it('records the smaller of the waist and the functional size', () => {
    expect(multiStemTrunk(45, [30, 40])).toEqual({ functional: 50, used: 45, from: 'waist' });
    expect(multiStemTrunk(60, [30, 40])).toEqual({ functional: 50, used: 50, from: 'stems' });
  });
  it('uses whichever was measured when only one was', () => {
    expect(multiStemTrunk(null, [30, 40]).used).toBe(50);
    expect(multiStemTrunk(45, [30]).used).toBe(45);
    expect(multiStemTrunk(null, []).used).toBeNull();
  });
  it('converts a trunk reading between tapes', () => {
    expect(convertTrunk(31.4, IMP_C, IMP_D)).toBe(10);
    expect(convertTrunk(10, IMP_D, MET_D)).toBe(25.4);
  });
  it('comes back to the same reading after switching units there and back', () => {
    for (const v of [30, 40, 20, 45]) expect(convertTrunk(convertTrunk(v, IMP_C, MET_C), MET_C, IMP_C)).toBe(v);
  });
  it('says what to measure for each box', () => {
    expect(guidance('height', IMP_D)).toMatch(/highest point on the tree straight down to the ground/);
    expect(guidance('spread', MET_C)).toMatch(/dripline to the dripline on the opposite side of the crown/);
    expect(guidance('trunk', MET_C)).toBe('Circumference: Around the trunk at 1.37 m above the ground, on the uphill side.');
    expect(guidance('trunk', IMP_D)).toBe('Diameter: Across the trunk at 4.5 ft above the ground, on the uphill side.');
  });
});
