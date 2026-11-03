/** Helpers shared by the report-module workbook suites. Nothing here holds report figures: values are read live. */
import { expect, Locator, Page } from '@playwright/test';
import { XP, at } from '../locators';
import type { ReportTable } from '../pages/ReportTable';
import { num, ymd } from '../helpers';
import type { Period, ReportModulePage } from '../pages/ReportModulePage';

export type NamedPeriod = Exclude<Period, 'custom'>;

/** Export file names carry the app's (UTC) date: accept that or the local date (they differ around midnight). */
export function todayInFileName(): string {
  const local = ymd(new Date()), utc = new Date().toISOString().slice(0, 10);
  return local === utc ? local : `(?:${local}|${utc})`;
}
export const NAMED_PERIODS: NamedPeriod[] = ['this_month', 'last_month', 'this_quarter', 'last_quarter', 'ytd', 'last_12_months'];

/** The calendar month before the current one, as yyyy-mm-dd From / To. */
export function previousMonth(): [string, string] {
  const now = new Date();
  return [ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), ymd(new Date(now.getFullYear(), now.getMonth(), 0))];
}

/** January of next year: a range with nothing in it yet. */
export function futureRange(): [string, string] {
  const y = new Date().getFullYear() + 1;
  return [`${y}-01-01`, `${y}-01-31`];
}

/** First and last day a period covers (local calendar). Last 12 months is taken loosely (13 months back). */
export function periodRange(p: NamedPeriod, now = new Date()): [Date, Date] {
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
export const looksLikeDate = (text: string) => /^\d{1,2} [A-Z][a-z]{2,4} \d{4}$/.test(text.trim());

/** Inside [from − 1 day, to + 1 day] (dates are shown in UTC, so a record can fall a day either side). */
export const inRange = (d: Date, [from, to]: [Date, Date]) => d.getTime() >= from.getTime() - 86400_000 && d.getTime() <= to.getTime() + 86400_000;

/** An Excel serial day and a shown date are the same calendar day. */
export function sameDay(serial: number, d: Date) {
  const f = new Date(Math.round((serial - 25569) * 86400_000));
  return f.getUTCFullYear() === d.getFullYear() && f.getUTCMonth() === d.getMonth() && f.getUTCDate() === d.getDate();
}

/** Half a unit of the last shown digit: "1.91M USD" → 5,000; "0 USD" → 0.5; "74.5%" → 0.05. */
export function shownTolerance(text: string): number {
  const m = text.replace(/,/g, '').match(/-?\d+(?:\.(\d+))?\s*([KMB])?/i);
  if (!m) return 0;
  const mult: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9 };
  return 0.5 * 10 ** -(m[1]?.length ?? 0) * (mult[(m[2] ?? '').toUpperCase()] ?? 1);
}

export const isBlank = (text: string) => /^\s*[—–-]?\s*$/.test(text);

/** A shown cell and the same cell in an export agree (text, amount within display rounding, %, days or date). */
export function sameCell(shown: string, file: unknown): boolean {
  const s = shown.trim();
  if (isBlank(s)) return file === undefined || file === null || file === '' || file === 0 || String(file).trim() === s;
  if (typeof file === 'number') {
    if (looksLikeDate(s)) return sameDay(file, shownDate(s));
    if (!/\d/.test(s)) return false;
    return Math.abs(num(s) - file) <= shownTolerance(s) + 0.01;
  }
  return String(file ?? '').trim() === s;
}

/** Clicks `target` and checks that nothing happens: same URL, same panels, no dialog, no download. */
export async function expectNothingHappens(m: ReportModulePage, target: Locator, what: string) {
  const page = m.page;
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

/** Runs `fn` and expects a report request whose URL matches `param`. */
export async function expectRequest(m: ReportModulePage, api: string, param: RegExp, fn: () => Promise<unknown>) {
  const req = m.page.waitForRequest(r => r.url().includes(api) && param.test(r.url()), { timeout: 15_000 }).catch(() => null);
  await fn();
  expect.soft(await req, `Request to ${api} with ${param}`).not.toBeNull();
}

/** Clicks a record link (e.g. a contract number) and checks that its own record opens, then closes it without saving. */
export async function expectRecordOpens(page: Page, link: Locator, ref: string): Promise<string> {
  const href = (await link.getAttribute('href')) ?? '';
  const path = href.split('?')[0];
  await link.click();
  await expect(page, `${ref} opens ${path}`).toHaveURL(new RegExp(`${path}(\\?.*)?$`));
  const detail = at(page, XP.recordPanel).filter({ hasText: ref }).first();
  await expect(detail, `The record of ${ref} is shown`).toBeVisible({ timeout: 15_000 });
  // read-only suite: close, never save
  const close = detail.getByRole('button', { name: 'Close' }).first();
  if (await close.count()) await close.click(); else await page.keyboard.press('Escape');
  return href;
}

/** Month labels as the reports show them ("Oct 2026"), for comparing. */
const monthLabel = (d: Date) => d.toLocaleString('en-GB', { month: 'short', year: 'numeric' }).replace('Sept', 'Sep');

/** A by-month table lists the 12 months ending this month (Last 12 months) and only this month (This month). */
export async function expectMonthRows(m: ReportModulePage, table: ReportTable, column = 'Month') {
  const now = new Date();
  const expected = Array.from({ length: 12 }, (_, i) => monthLabel(new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)));
  await m.openWith('last_12_months');
  expect.soft((await table.column(column)).map(x => x.replace('Sept', 'Sep')), 'Last 12 months: the 12 months ending this month, oldest first').toEqual(expected);
  await m.setPeriod('this_month');
  expect.soft((await table.column(column)).map(x => x.replace('Sept', 'Sep')), 'This month: only this month').toEqual([monthLabel(now)]);
}
