/**
 * Helpers for the workbook scenarios (RA-001 … RA-133).
 *
 * Every scenario test is declared as `test(...scenario(id, expected), fn)` or `test(...manual(id, reason))`
 * (the `test()` call stays in the spec so reports point at the right file and line). That gives it:
 *  - the workbook ID and wording as its title ("RA-013 Verify the default reporting period is This Month.")
 *  - the @scenario tag (run them alone with `npm run test:scenarios`)
 *  - an "expected" annotation that the Excel report shows as the Expected Result
 */
import { test, expect, Page, TestDetails } from '../auth';
import { SCENARIOS } from './catalog';
import { act, open, tableColumn, num, sum, near, expectNear, download, ymd } from '../helpers';
import { XP, at } from '../locators';

// generic helpers now live in ../helpers (shared with the page objects); re-exported for the scenario specs
export { num, sum, near, expectNear, download, ymd };
export type { Sheet } from '../helpers';

export const TAG = '@scenario';

/** Title for a scenario: its ID followed by the workbook text. */
export function sc(id: string): string {
  const s = SCENARIOS[id];
  if (!s) throw new Error(`Scenario ${id} is not in the workbook`);
  return `${id} ${s.scenario}`;
}

/** Title and details for an automated scenario. `expected` is what the test asserts, in plain words. */
export function scenario(id: string, expected: string): [string, TestDetails] {
  return [sc(id), { tag: TAG, annotation: { type: 'expected', description: expected } }];
}

/** A scenario that is not automated. It still appears in every report as Skipped, with the reason. */
export function manual(id: string, reason: string): [string, TestDetails, () => void] {
  return [sc(id), { tag: [TAG, '@manual'] }, () => test.skip(true, `Manual: ${reason}`)];
}

export const note = (type: string, description: string) => test.info().annotations.push({ type, description });

/** Sum of a report table column, by panel heading and column header. */
export async function colSum(page: Page, heading: string, column: string): Promise<number> {
  return sum((await tableColumn(page, heading, column)).map(num));
}

// ── Report period and filters ───────────────────────────────────────────────
export const periodSelect = (page: Page) => at(page, XP.reportPeriod);
export const filterSelect = (page: Page, allOption: string) => at(page, XP.reportFilter(allOption));

/** Waits for the report's data request (any GET under /api/v1/reports/) that matches `match`. */
export function reportResponse(page: Page, match: (url: string) => boolean = () => true) {
  return page.waitForResponse(
    r => r.request().method() === 'GET' && /\/api\/v1\/reports\/(business|leads)\/(?!options)/.test(r.url()) && match(r.url()),
    { timeout: 30_000 },
  );
}

/**
 * Selects a period and waits for its data. The app caches each period's data, so going back to a
 * period it already loaded sends no request; then the wait gives up after 5 s and moves on.
 */
export async function setPeriod(page: Page, value: string) {
  if ((await periodSelect(page).inputValue()) === value) return;
  if (value === 'custom') return act(page, () => periodSelect(page).selectOption(value));
  const resp = page.waitForResponse(r => r.url().includes(`period=${value}`), { timeout: 5_000 }).catch(() => null);
  await periodSelect(page).selectOption(value);
  await resp;
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(300);
}

/** Opens a report module with an explicit period, so tests don't depend on the page default. */
export async function openReport(page: Page, path: string, period = 'last_12_months') {
  await open(page, path);
  await setPeriod(page, period);
}

/** Selects "Custom dates" and fills From / To (yyyy-mm-dd), waiting for the matching data request. */
export async function setCustomRange(page: Page, from: string, to: string) {
  await setPeriod(page, 'custom');
  const resp = reportResponse(page, u => u.includes(`from=${from}`) && u.includes(`to=${to}`));
  await at(page, XP.reportFrom).fill(from);
  await at(page, XP.reportTo).fill(to);
  await resp;
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(300);
}

/** Picks a filter option by its label and waits for the report to reload. */
export async function setFilter(page: Page, allOption: string, label: string) {
  const resp = reportResponse(page);
  await filterSelect(page, allOption).selectOption({ label });
  await resp.catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(300);
}

/** Labels of a filter's options, without the leading "All …" option. */
export async function filterOptions(page: Page, allOption: string): Promise<string[]> {
  return (await filterSelect(page, allOption).locator('option').allInnerTexts()).map(o => o.trim()).slice(1);
}

/**
 * Text of a report's load-error message ("Internal Server Error", "CRM backend is not reachable…").
 * The app retries a failed report call 3 times (about 7 s) before showing it, so wait up to 20 s.
 */
export const ERROR_TEXT = /error|failed|unable|could not|couldn't|not reachable|try again|went wrong|problem|not available/i;

/** No broken values rendered anywhere in the page body. */
export async function expectClean(page: Page, where = 'page') {
  const crash = page.getByText('Unexpected Application Error');
  if (await crash.count()) {
    const detail = (await page.locator('body').innerText()).split('\n').slice(0, 3).join(' | ');
    expect.soft(detail, `${where}: the app crashed to its error screen`).toBe('');
    return;
  }
  await expect.soft(page.locator('main'), `${where}: no NaN / undefined / Infinity`).not.toContainText(/\bNaN\b|undefined|Infinity|\[object Object\]/);
}

// ── Exports ──────────────────────────────────────────────────────────────────
export const exportPanel = (page: Page, heading: string) => download(page, at(page, XP.reportPanelExport(heading)));

// ── Leads list ───────────────────────────────────────────────────────────────
export const leadRows = (page: Page) =>
  at(page, XP.leadsTableRows).filter({ has: page.locator('a.crm-record-link') });

/** Lead numbers (LD-…) shown on the current page of the Leads list. */
export async function leadNumbers(page: Page): Promise<string[]> {
  return (await leadRows(page).allInnerTexts()).map(t => t.match(/LD-[A-Z0-9-]+/)?.[0] ?? '').filter(Boolean);
}

/** Cell texts of one Leads list column (by header text) on the current page. */
export async function leadColumn(page: Page, header: string): Promise<string[]> {
  const headers = (await at(page, XP.leadsTable).locator('thead th').allInnerTexts()).map(h => h.replace(/[↕▼▲]/g, '').trim());
  const idx = headers.findIndex(h => h.toLowerCase() === header.toLowerCase());
  if (idx < 0) throw new Error(`Leads column "${header}" not found (${headers.join(' | ')})`);
  return (await leadRows(page).locator(`> :nth-child(${idx + 1})`).allInnerTexts()).map(t => t.trim());
}

// ── Lead Reports charts ──────────────────────────────────────────────────────
export type FunnelStep = { label: string; count: number; rate: number | null; width: number };

export async function funnel(page: Page): Promise<FunnelStep[]> {
  await expect(at(page, XP.reportFunnelStep).first()).toBeVisible();
  return at(page, XP.reportFunnelStep).evaluateAll(steps => steps.map(s => {
    const q = (c: string) => (s.querySelector(c) as HTMLElement | null)?.innerText.trim() ?? '';
    const rate = q('.crm-report-funnel-rate').match(/^(-?[\d.]+)%/);
    return {
      label: q('.crm-report-funnel-label'),
      count: Number(q('.crm-report-funnel-count').replace(/,/g, '')),
      rate: rate ? Number(rate[1]) : null,
      width: parseFloat((s.querySelector('.crm-report-bar-fill') as HTMLElement | null)?.style.width ?? 'NaN'),
    };
  }));
}

export type TrendMonth = { label: string; value: number; detail: string; height: number };

export async function trend(page: Page): Promise<TrendMonth[]> {
  return at(page, XP.reportTrendMonth).evaluateAll(months => months.map(m => {
    const q = (c: string) => (m.querySelector(c) as HTMLElement | null)?.innerText.trim() ?? '';
    return {
      label: q('.crm-report-trend-label'),
      value: Number(q('.crm-report-trend-value').replace(/,/g, '')),
      detail: q('small'),
      height: parseFloat((m.querySelector('.crm-report-trend-fill') as HTMLElement | null)?.style.height ?? 'NaN'),
    };
  }));
}
