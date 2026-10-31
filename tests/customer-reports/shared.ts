/** Helpers shared by the Customer Reports workbook specs. Nothing here holds report figures: values are read live. */
import { test, expect, TestDetails } from '../auth';
import { cr, TAG } from './catalog';
import { num, ymd } from '../helpers';
import type { Period } from '../pages/ReportModulePage';
import type { Locator } from '@playwright/test';
import type { CustomerReportsPage } from '../pages/CustomerReportsPage';

export type Row = Record<string, string>;

/** A workbook case that cannot run in this environment: still listed, Skipped with the reason. */
export function crSkipped(id: string, reason: string): [string, TestDetails, () => void] {
  const [title, d] = cr(id);
  return [title, { ...d, tag: [TAG, '@manual'] }, () => test.skip(true, reason)];
}

/** The calendar month before the current one, as yyyy-mm-dd From / To. */
export function previousMonth(): [string, string] {
  const now = new Date();
  return [ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), ymd(new Date(now.getFullYear(), now.getMonth(), 0))];
}

/** January of next year: a range with no customers created yet. */
export function futureRange(): [string, string] {
  const y = new Date().getFullYear() + 1;
  return [`${y}-01-01`, `${y}-01-31`];
}

/** First and last day a period covers (local calendar). Last 12 months is taken loosely (13 months back). */
export function periodRange(p: Exclude<Period, 'custom'>, now = new Date()): [Date, Date] {
  const y = now.getFullYear(), m = now.getMonth(), q = Math.floor(m / 3) * 3;
  const end = new Date(y, m, now.getDate());
  switch (p) {
    case 'this_month': return [new Date(y, m, 1), end];
    case 'last_month': return [new Date(y, m - 1, 1), new Date(y, m, 0)];
    case 'this_quarter': return [new Date(y, q, 1), end];
    case 'last_quarter': return [new Date(y, q - 3, 1), new Date(y, q, 0)];
    case 'ytd': return [new Date(y, 0, 1), end];
    case 'last_12_months': return [new Date(y - 1, m - 1, 1), end];
  }
}

/** "17 Oct 2026" → Date (local midnight). */
export function shownDate(text: string): Date {
  const d = new Date(`${text.trim()} 00:00`);
  if (Number.isNaN(d.getTime())) throw new Error(`Not a date: "${text}"`);
  return d;
}

/** Excel serial day number → "17 Oct 2026" (the format the screen uses). */
export function excelDay(serial: number): string {
  const d = new Date(Math.round((serial - 25569) * 86400_000));
  return `${d.getUTCDate()} ${d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })} ${d.getUTCFullYear()}`;
}

/** Inside [from − 1 day, to + 1 day]: the report shows UTC dates, so a customer can fall a day either side (see OBS-07). */
export const inRange = (d: Date, [from, to]: [Date, Date]) => d.getTime() >= from.getTime() - 86400_000 && d.getTime() <= to.getTime() + 86400_000;

/** Half a unit of the last shown digit: "1.91M USD" → 5,000; "0 USD" → 0.5. */
export function shownTolerance(text: string): number {
  const m = text.replace(/,/g, '').match(/-?\d+(?:\.(\d+))?\s*([KMB])?/i);
  if (!m) return 0;
  const mult: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9 };
  return 0.5 * 10 ** -(m[1]?.length ?? 0) * (mult[(m[2] ?? '').toUpperCase()] ?? 1);
}

/** A shown amount equals an exact amount within its display rounding. */
export function expectShown(text: string, exact: number, what: string) {
  expect.soft(Math.abs(num(text) - exact), `${what}: shown ${text} vs ${exact}`).toBeLessThanOrEqual(shownTolerance(text) + 0.01);
}

/** Customers of the list grouped by a column: customers, with SPA, SPAs, SPA value. */
export function groupList(rows: Row[], column: string) {
  const out: Record<string, { customers: number; withSpa: number; spas: number; value: number }> = {};
  for (const r of rows) {
    const g = (out[r[column]] ??= { customers: 0, withSpa: 0, spas: 0, value: 0 });
    g.customers += 1;
    g.withSpa += num(r['SPAs']) > 0 ? 1 : 0;
    g.spas += num(r['SPAs']);
    g.value += num(r['SPA Value (USD)']);
  }
  return out;
}

/**
 * Opens the report on the period whose New Customers list holds every customer (New in period = Active customers),
 * trying Last 12 months, then Year to date. Returns false (and the test should skip) when there is none.
 */
export async function openWithFullList(customers: CustomerReportsPage): Promise<boolean> {
  for (const p of ['last_12_months', 'ytd'] as const) {
    await customers.openWith(p);
    if ((await customers.kpi('New in period')) === (await customers.kpi('Active customers'))) return true;
  }
  return false;
}

export const NO_FULL_LIST = 'No period whose New Customers list holds every customer (some customers were created over 12 months ago)';

/** Count cards that every view or filter can only narrow. */
export const COUNT_KPIS = ['Active customers', 'New in period', 'Customers with SPA', 'Repeat buyers'];

/** Clicks `target` and checks that nothing happens: same URL, same panels, no dialog, no download. */
export async function expectNothingHappens(c: CustomerReportsPage, target: Locator, what: string) {
  const page = c.page;
  const url = page.url();
  const panels = await page.locator('main section').count();
  const download = page.waitForEvent('download', { timeout: 1500 }).then(() => true).catch(() => false);
  await target.click({ timeout: 5000 });
  await page.waitForTimeout(800);
  expect.soft(page.url(), `${what}: no navigation`).toBe(url);
  expect.soft(await page.locator('main section').count(), `${what}: no list or panel opens`).toBe(panels);
  expect.soft(await page.locator('[role=dialog], .crm-modal').count(), `${what}: no dialog`).toBe(0);
  expect.soft(await download, `${what}: no download`).toBe(false);
}
