/** Helpers shared by the Sales Reports workbook specs. Nothing here holds report figures: values are read live. */
import { expect } from '../auth';
import { num, parseNum, ymd } from '../helpers';
import { SalesReportsPage, SALES_FILTERS, Row } from '../pages/SalesReportsPage';

export const BAD = /^\s*$|NaN|undefined|Infinity|null/;
export const DASH = /^\s*[—–-]\s*$/;

export const today = () => new Date(new Date().toDateString());

/** yyyy-mm-dd From / To of the calendar month `back` months before the current one. */
export function monthRange(back: number): [string, string] {
  const n = today();
  return [ymd(new Date(n.getFullYear(), n.getMonth() - back, 1)), ymd(new Date(n.getFullYear(), n.getMonth() - back + 1, 0))];
}
export const previousMonth = () => monthRange(1);
/** 1st of this month → today ("This month"). */
export const thisMonthToDate = (): [string, string] => [ymd(new Date(today().getFullYear(), today().getMonth(), 1)), ymd(today())];
/** The three months of the previous calendar quarter, oldest first. */
export function lastQuarterMonths(): [string, string][] {
  const back = (today().getMonth() % 3) + 1; // months back to the quarter's last month
  return [back + 2, back + 1, back].map(monthRange);
}
/** January of next year: a range with no won or lost deals yet. */
export function futureRange(): [string, string] {
  const y = today().getFullYear() + 1;
  return [`${y}-01-01`, `${y}-01-31`];
}

/** Half of the last shown digit: "1.65B USD" → 5M, "97.5%" → 0.05, "39" → 0.5 (amounts show at most 2 decimals). */
export function halfUnit(text: string): number {
  const m = text.replace(/,/g, '').match(/-?\d+(?:\.(\d+))?\s*([KMB])?(?![a-z])/i);
  if (!m) return 0;
  if (m[2]) return 0.005 * { K: 1e3, M: 1e6, B: 1e9 }[m[2].toUpperCase() as 'K' | 'M' | 'B'];
  return 0.5 * 10 ** -(m[1]?.length ?? 0);
}

/** Shown total vs the sum of shown parts, allowing each value's display rounding (and at least 0.5%). */
export function expectSum(totalText: string, partTexts: string[], what: string) {
  const total = num(totalText);
  const parts = partTexts.reduce((a, t) => a + num(t), 0);
  const tol = Math.max(halfUnit(totalText) + partTexts.reduce((a, t) => a + halfUnit(t), 0), 0.005 * Math.abs(total));
  expect.soft(Math.abs(total - parts), `${what}: shown ${totalText} vs sum ${parts.toLocaleString('en')} (±${tol.toLocaleString('en')})`).toBeLessThanOrEqual(tol + 1e-6);
}

/** Two amounts equal within display rounding (both texts) and at least 0.5%. */
export function expectSame(aText: string, b: number | string, what: string) {
  const bText = typeof b === 'string' ? b : String(b);
  const [x, y] = [num(aText), typeof b === 'number' ? b : num(b)];
  const tol = Math.max(halfUnit(aText) + (typeof b === 'string' ? halfUnit(bText) : 0), 0.005 * Math.max(Math.abs(x), Math.abs(y)));
  expect.soft(Math.abs(x - y), `${what}: ${aText} vs ${bText}`).toBeLessThanOrEqual(tol + 1e-6);
}

/** A shown percentage equals part ÷ whole × 100 (one decimal); "—" when whole is 0. */
export function expectRate(shown: string, part: number, whole: number, what: string) {
  if (!whole) return expect.soft(shown, `${what}: no won or lost → "—"`).toMatch(DASH);
  expect.soft(Math.abs(num(shown) - (part / whole) * 100), `${what}: ${shown} vs ${part} ÷ ${whole}`).toBeLessThanOrEqual(0.05 + 1e-9);
}

/** Number from an export cell (numbers stay numbers, text like "1.1M USD" is parsed). */
export const cell = (v: unknown) => (typeof v === 'number' ? v : /\d/.test(String(v ?? '')) ? parseNum(String(v)) : 0);

/** Counts rows per value of `column`. */
export function countBy(rows: Record<string, unknown>[], column: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[String(r[column] ?? '')] = (out[String(r[column] ?? '')] ?? 0) + 1;
  return out;
}

/**
 * Applies the Salesperson filter for a row of the Salesperson Pipeline table. Names can repeat
 * ("Mahalakshmi" twice), so each option with that name is tried until the report matches the row.
 */
export async function filterToSalesperson(sales: SalesReportsPage, row: Row): Promise<string | undefined> {
  const all = SALES_FILTERS.Salesperson;
  const candidates = (await sales.options(sales.filterSelect(all))).filter(o => o.label === row['Salesperson']);
  for (const o of candidates) {
    await sales.setFilterValue(all, o.value);
    const shown = await sales.salespersonRows();
    if (candidates.length === 1 || (shown.length === 1 && shown[0]['Open'] === row['Open'] && shown[0]['Won'] === row['Won'] && shown[0]['Lost'] === row['Lost'])) return o.value;
  }
  return undefined;
}

/** Selects every option of a filter in turn and returns `read()` for each. */
export async function eachOption<T>(sales: SalesReportsPage, allOption: string, read: () => Promise<T>): Promise<{ label: string; value: T }[]> {
  const out: { label: string; value: T }[] = [];
  for (const o of (await sales.options(sales.filterSelect(allOption))).slice(1)) {
    await sales.setFilterValue(allOption, o.value);
    out.push({ label: o.label, value: await read() });
  }
  await sales.setFilterValue(allOption, '');
  return out;
}
