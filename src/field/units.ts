/**
 * How the surveyor measures, and the conversion to what is saved.
 *
 * Crews carry different tapes: inches or centimetres, and either a diameter
 * tape (a "D-tape", marked in diameter) or an ordinary tape round the trunk,
 * which gives the circumference. The form takes whatever the tape reads;
 * the record always holds the trunk's diameter in inches and the height and
 * spread in feet, so the export, the importer and the map need not know which
 * tape it was. A D-tape is itself only a circumference tape printed in units
 * of π, so the two give the same diameter.
 *
 * No DOM here, so the arithmetic can be tested.
 */

export type Units = 'imperial' | 'metric';
export type Trunk = 'diameter' | 'circumference';
export interface MeasurePrefs {
  units: Units;
  trunk: Trunk;
}

export const DEFAULT_PREFS: MeasurePrefs = { units: 'imperial', trunk: 'diameter' };
const KEY = 'uvm-field/measure-prefs';

const CM_PER_IN = 2.54;
const M_PER_FT = 0.3048;

/** What the form's three boxes hold, in the surveyor's own units. */
export interface Entered {
  trunk: number | null;
  height: number | null;
  spread: number | null;
}

/** What a record holds. */
export interface Stored {
  dbhIn: number | null;
  heightFt: number | null;
  spreadFt: number | null;
}

const round = (v: number, places: number): number => {
  const k = 10 ** places;
  return Math.round(v * k) / k;
};
const ok = (v: number | null): v is number => v !== null && Number.isFinite(v) && v >= 0;

/**
 * The form's numbers as a record keeps them. DBH to a tenth of an inch;
 * height and spread to a tenth of a foot, so a metric reading is not rounded
 * to a coarser step than the surveyor gave it.
 */
export function toStored(e: Entered, p: MeasurePrefs): Stored {
  let dbh: number | null = null;
  if (ok(e.trunk)) {
    const inches = p.units === 'metric' ? e.trunk / CM_PER_IN : e.trunk;
    dbh = round(p.trunk === 'circumference' ? inches / Math.PI : inches, 1);
  }
  const ft = (v: number | null) => (ok(v) ? round(p.units === 'metric' ? v / M_PER_FT : v, 1) : null);
  return { dbhIn: dbh, heightFt: ft(e.height), spreadFt: ft(e.spread) };
}

/** The other way: a record's numbers as the form would show them, for switching units mid-entry. */
export function fromStored(s: Stored, p: MeasurePrefs): Entered {
  let trunk: number | null = null;
  if (ok(s.dbhIn)) {
    const along = p.trunk === 'circumference' ? s.dbhIn * Math.PI : s.dbhIn;
    trunk = round(p.units === 'metric' ? along * CM_PER_IN : along, 1);
  }
  const back = (v: number | null) => (ok(v) ? round(p.units === 'metric' ? v * M_PER_FT : v, 1) : null);
  return { trunk, height: back(s.heightFt), spread: back(s.spreadFt) };
}

/** The labels over the three boxes. */
export function labels(p: MeasurePrefs): { trunk: string; height: string; spread: string } {
  const small = p.units === 'metric' ? 'cm' : 'in';
  const big = p.units === 'metric' ? 'm' : 'ft';
  return {
    trunk: `${p.trunk === 'circumference' ? 'Circumference' : 'DBH'} (${small})`,
    height: `Height (${big})`,
    spread: `Spread (${big})`,
  };
}

/** Where on the trunk to measure, in the surveyor's units: breast height is 4.5 ft. */
export const breastHeight = (p: MeasurePrefs): string => (p.units === 'metric' ? '1.37 m' : '4.5 ft');

export function loadPrefs(): MeasurePrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<MeasurePrefs> | null;
    return {
      units: raw?.units === 'metric' ? 'metric' : 'imperial',
      trunk: raw?.trunk === 'circumference' ? 'circumference' : 'diameter',
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(p: MeasurePrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch { /* the choice lasts this visit only */ }
}
