/**
 * Executive Dashboards (/dashboards) and My Smart Workspace (/): workbook Testcase/Executive_Dashboards_Test_Cases.xlsx
 * (EXD-… and MSW-…) and data TestData/Executive_Dashboards_Test_Data.xlsx (built by scripts/build_executive_dashboards.py).
 */
import { makeCatalog } from '../leads-page/catalog';
import { dataBook } from '../leads-page/test-data';
import { test as base, expect } from '../auth';

export { expect };
export const ED = makeCatalog('Executive_Dashboards_Test_Cases.xlsx', '@executive-dashboards');
export const ED_CASES = ED.CASES;
export const TAG = ED.tag;
export const tc = ED.tc;
export const tcRow = ED.tcRow;

const BOOK = dataBook('Executive_Dashboards_Test_Data.xlsx', 'Executive_Dashboards');
export const sheet = BOOK.sheet;
export const S = (name: string): string => {
  const r = sheet('Settings').find(x => x['Setting'] === name);
  if (!r) throw new Error(`Setting "${name}" missing on the Settings sheet`);
  return r['Value'];
};
export const N = (name: string) => Number(S(name));

/** Records a value in the report's "observed values" column. */
export function note(type: string, description: string) {
  base.info().annotations.push({ type, description: description.slice(0, 1500) });
}

// ── numbers as the page shows them ──────────────────────────────────────────────────────────────────────────────────

export type Shown = { text: string; value: number; tol: number; percent: boolean };

/**
 * Reads a figure as displayed: "$2.12M", "5.07M USD", "USD 2.12 M", "396,309.25 USD", "212 K", "7%", "▲ 565.9%", "-0.88",
 * "29 (11%)" (first number). `tol` is half a unit of the last digit shown, so 2.12M matches 2,115,000 … 2,125,000.
 */
export function shown(text: string): Shown {
  const t = text.replace(/[▲▼]/g, '').replace(/−/g, '-');
  const m = t.replace(/,/g, '').match(/(-?\d+(?:\.(\d+))?)\s*([KMB](?![a-z]))?\s*(%|pp)?/i);
  if (!m) return { text, value: NaN, tol: 0, percent: false };
  const scale = ({ K: 1e3, M: 1e6, B: 1e9 } as Record<string, number>)[(m[3] ?? '').toUpperCase()] ?? 1;
  const dec = m[2]?.length ?? 0;
  return { text, value: Number(m[1]) * scale, tol: 0.5 * 10 ** -dec * scale + 1e-9, percent: !!m[4] };
}
/** True when `text` displays `value` (within the rounding the display implies). */
export const displays = (text: string, value: number, extra = 0) => { const s = shown(text); return Math.abs(s.value - value) <= s.tol + extra; };
/** Soft check that a displayed figure equals a value, with a message that names both. */
export function expectShows(text: string | undefined, value: number, what: string, extra = 0) {
  expect.soft(text !== undefined && displays(text, value, extra), `${what} — shown "${text ?? 'nothing'}", expected ${fmt(value)}`).toBeTruthy();
}
/** Soft check that two displayed figures agree within both roundings. */
export function expectSameShown(a: string | undefined, b: string | undefined, what: string) {
  const x = shown(a ?? ''), y = shown(b ?? '');
  expect.soft(Math.abs(x.value - y.value) <= x.tol + y.tol, `${what} — "${a ?? 'nothing'}" vs "${b ?? 'nothing'}"`).toBeTruthy();
}
/** A percentage computed from two counts, compared with the % shown (rounded as displayed). */
export function expectRate(text: string | undefined, part: number, whole: number, what: string) {
  const want = whole ? (part / whole) * 100 : 0;
  expectShows(text, want, `${what} (${part} ÷ ${whole})`, 0.05);
}
export const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 2 }));

/** Today's date (yyyy-mm-dd) in the browser's time zone. */
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** First and last day of a period key as the app counts it (from the data sheet "Periods"). */
export function periodRange(key: string, today = new Date()): { from: string; to: string } {
  const to = isoDay(today);
  const from = { today: to, this_month: `${to.slice(0, 7)}-01`, this_year: `${to.slice(0, 4)}-01-01`, upto_date: '1900-01-01' }[key] ?? `${to.slice(0, 7)}-01`;
  return { from, to };
}
/** True when an API date (ISO) falls in [from, to] by its calendar day. */
export const within = (iso: string | null | undefined, r: { from: string; to: string }) => !!iso && iso.slice(0, 10) >= r.from && iso.slice(0, 10) <= r.to;
export const BAD = /\bNaN\b|undefined|Infinity|\bnull\b/;
