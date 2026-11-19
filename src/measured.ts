/**
 * How old a measurement is. A trunk size from the 2014 inventory and one
 * from last week look the same as bare numbers; these say which is which.
 *
 * Dates come as the data keeps them: "2014" for the 2014 inventory, "2022"
 * for the 2022 dendrology class, an ISO date for a survey visit. Height and
 * spread always come from a tree's latest visit; a trunk size may be from an
 * earlier one, which the record says (Plant.dbhOn). No DOM here, so it can be
 * tested.
 */

import type { Plant } from './types';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** When each of a tree's measurements was taken, or null for none. */
export function measuredOn(p: Pick<Plant, 'dbhIn' | 'dbhOn' | 'heightFt' | 'spreadFt' | 'surveyedOn'>): {
  dbh: string | null; height: string | null; spread: string | null;
} {
  return {
    dbh: p.dbhIn === null ? null : p.dbhOn ?? p.surveyedOn,
    height: p.heightFt === null ? null : p.surveyedOn,
    spread: p.spreadFt === null ? null : p.surveyedOn,
  };
}

/** Whole years between a date and now; "2014" counts from the middle of 2014. */
export function yearsAgo(date: string, now = new Date()): number {
  const [y, m, d] = date.split('-').map(Number);
  const then = new Date(y!, m ? m - 1 : 6, d || 1);
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / (365.25 * 24 * 3600 * 1000)));
}

/**
 * "Sep 2026" for a recent measurement; "2014, 12 years ago" once it is two
 * or more years old, so the age is read without doing the arithmetic.
 */
export function whenText(date: string, now = new Date()): string {
  const [y, m] = date.split('-');
  const label = `${m ? `${MONTHS[Number(m)]} ` : ''}${y}`;
  const n = yearsAgo(date, now);
  return n >= 2 ? `${label}, ${n} years ago` : label;
}

export type AgeBand = 'recent' | 'older' | 'old' | 'none';

/** For "Color by measurement age": within 5 years, 5 to 10, more than 10, or never. */
export function ageBand(date: string | null, now = new Date()): AgeBand {
  if (date === null) return 'none';
  const n = yearsAgo(date, now);
  return n < 5 ? 'recent' : n <= 10 ? 'older' : 'old';
}
