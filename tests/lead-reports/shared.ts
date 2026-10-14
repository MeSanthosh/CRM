/** Helpers shared by the Lead Reports workbook specs. Nothing here holds report figures: values are read live. */
import { test, expect, TestDetails } from '../auth';
import { lr, TAG } from './catalog';
import { num, ymd } from '../helpers';
import type { Row } from '../pages/LeadTable';

/** A workbook case that cannot run in this environment: still listed, Skipped with the reason. */
export function lrSkipped(id: string, reason: string): [string, TestDetails, () => void] {
  const [title, d] = lr(id);
  return [title, { ...d, tag: [TAG, '@manual'] }, () => test.skip(true, reason)];
}

/** The calendar month before the current one, as yyyy-mm-dd From / To. */
export function previousMonth(): [string, string] {
  const now = new Date();
  return [ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), ymd(new Date(now.getFullYear(), now.getMonth(), 0))];
}

/** January of next year: a range that cannot contain captured leads yet. */
export function futureRange(): [string, string] {
  const y = new Date().getFullYear() + 1;
  return [`${y}-01-01`, `${y}-01-31`];
}

/** Displayed % values have one decimal: allow that rounding. */
export function expectRate(actual: number | null | undefined, part: number, whole: number, what: string) {
  if (!whole) return;
  expect.soft(Math.abs((actual ?? NaN) - (part / whole) * 100), `${what}: ${actual}% vs ${part} ÷ ${whole}`).toBeLessThanOrEqual(0.1);
}

export const isTotalOrUnspecified = (label: string) => /^(Total|Unspecified|Unassigned|Not rated)$/i.test(label);

/** First row (preferring a named one over "Unspecified") whose `column` count is above 0. */
export function rowWithData(rows: Row[], column: string, first = Object.keys(rows[0] ?? {})[0]): Row | undefined {
  const withData = rows.filter(r => num(r[column] ?? '') > 0);
  return withData.find(r => !isTotalOrUnspecified(r[first])) ?? withData[0];
}

/** Rows that have a count above 0 in `column` (count links only exist for those). */
export const rowsWithData = (rows: Row[], column: string) => rows.filter(r => num(r[column] ?? '') > 0);

export const labelOf = (row: Row) => Object.values(row)[0];
