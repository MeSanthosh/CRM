/**
 * Workbook areas: Empty and Boundary Conditions (RA-099…105), Performance and Load (RA-106…111).
 * Load times are measured from navigation until the data is on screen. The budget defaults to 5 s per
 * page (PERF_BUDGET_MS) and 30 s per export (PERF_EXPORT_MS); set them in .env to match the agreed SLA.
 */
import 'dotenv/config';
import { test, expect, Page } from '../auth';
import { kpi, kpiText, open, act, listCount, waitForKpi } from '../helpers';
import { ROUTES, HUB_SNAPSHOT, REPORT_PAGES, XP, at } from '../locators';
import { scenario, manual, note, setCustomRange, leadNumbers, leadColumn, download, expectClean, ymd } from './support';

const R = ROUTES.reports;
const BUDGET = Number(process.env.PERF_BUDGET_MS ?? 5000);
const EXPORT_BUDGET = Number(process.env.PERF_EXPORT_MS ?? 30_000);
const EMPTY: [string, string] = ['2000-01-01', '2000-01-31'];

/** Leads Captured on Lead Reports for a custom date range. */
async function capturedBetween(page: Page, from: string, to: string) {
  await setCustomRange(page, from, to);
  return kpi(page, 'Leads Captured');
}

/** Milliseconds from navigation until every given KPI shows data. */
async function loadTime(page: Page, path: string, labels: string[]) {
  const t = Date.now();
  await page.goto(path);
  for (const l of labels) await waitForKpi(page, l);
  return Date.now() - t;
}

test.describe('Scenarios · Empty and Boundary Conditions', () => {
  test(...scenario('RA-099', 'A period with no records shows zeros and empty tables (no NaN / errors); a search with no match shows 0 leads'), async ({ page }) => {
    await open(page, R.sales);
    await setCustomRange(page, ...EMPTY);
    expect.soft(await kpi(page, 'Won in period'), 'Won in period').toBe(0);
    await expectClean(page, 'Sales (empty period)');
    await open(page, R.leads);
    expect.soft(await capturedBetween(page, ...EMPTY), 'Leads Captured').toBe(0);
    await expectClean(page, 'Lead Reports (empty period)');
    await open(page, ROUTES.leads);
    await act(page, () => at(page, XP.leadsSearch).fill('zzz-no-such-lead-xyz'));
    expect.soft(await listCount(page), 'Leads found').toBe(0);
    await expect.soft(page.locator('main'), 'Empty-state message').toContainText(/no leads/i);
  });

  test(...scenario('RA-100', 'Searching for one exact lead number shows exactly that one lead (count 1, no extra pages)'), async ({ page }) => {
    await open(page, ROUTES.leads);
    const leadNo = (await leadNumbers(page))[0];
    await act(page, () => at(page, XP.leadsSearch).fill(leadNo));
    expect.soft(await leadNumbers(page), `Search ${leadNo}`).toEqual([leadNo]);
    expect.soft(await listCount(page), 'Count').toBe(1);
    if (await at(page, XP.leadsPager).isVisible()) await expect.soft(at(page, XP.leadsPager), 'Single page').toContainText(/of 1\b/);
  });

  test(...scenario('RA-101', 'All leads can be paged through: pages = ceil(total ÷ 25), and the last page holds the remainder'), async ({ page }) => {
    test.setTimeout(240_000);
    await open(page, ROUTES.leads);
    const total = await listCount(page);
    const pages = Math.ceil(total / 25);
    await expect(at(page, XP.leadsPager)).toContainText(`of ${pages}`);
    let seen = (await leadNumbers(page)).length;
    for (let p = 2; p <= pages; p++) {
      await act(page, () => at(page, XP.leadsNext).click());
      await expect(at(page, XP.leadsPager)).toContainText(`Page ${p} of ${pages}`);
      seen += (await leadNumbers(page)).length;
    }
    note('values', `Total ${total} | pages ${pages} | rows seen ${seen}`);
    expect.soft(await leadNumbers(page), 'Last page rows').toHaveLength(total - 25 * (pages - 1));
    expect.soft(seen, 'Rows across all pages = total').toBe(total);
  });

  test(...scenario('RA-102', 'Zero values display as "0" (counts) and "0 <currency>" (amounts), never blank, "—" or NaN'), async ({ page }) => {
    await open(page, R.sales);
    await setCustomRange(page, ...EMPTY);
    for (const label of ['Won in period']) expect.soft(await kpiText(page, label), label).toBe('0');
    for (const label of ['Won value']) expect.soft(await kpiText(page, label), label).toMatch(/^0(\.0+)?\s?[KMB]?\s?[A-Z]{3}$/);
    // a rate has nothing to divide by when there are no deals, so "—" or "0%" are both acceptable
    const rate = (await at(page, XP.reportKpi('Win rate')).innerText()).trim();
    expect.soft(rate, 'Win rate with no deals').toMatch(/^(—|–|-|0(\.0+)?%)$/);
    note('values', `Win rate shows "${rate}"`);
  });

  test(...scenario('RA-103', 'No KPI on any report module shows a negative value'), async ({ page }) => {
    const negative: string[] = [];
    for (const [name, def] of Object.entries(REPORT_PAGES)) {
      await open(page, def.path);
      for (const label of def.kpis) {
        const t = await kpiText(page, label);
        if (/^\s*[-−]/.test(t)) negative.push(`${name} › ${label}: ${t}`);
      }
    }
    expect.soft(negative, 'Negative KPIs').toEqual([]);
  });

  test(...scenario('RA-104', 'A one-day range on the day the newest lead was captured counts exactly the leads captured that day'), async ({ page }) => {
    await open(page, ROUTES.leads);
    const dates = await leadColumn(page, 'Captured');
    const day = dates[0];
    const onDay = dates.filter(d => d === day).length;
    test.skip(onDay === dates.length, 'Every lead on page 1 has the same date; cannot count that day from page 1');
    const d = ymd(new Date(day));
    await open(page, R.leads);
    const n = await capturedBetween(page, d, d);
    note('values', `${day} (${d}): list ${onDay} | Lead Reports ${n}`);
    expect.soft(n, `Leads Captured on ${d}`).toBe(onDay);
  });

  test(...scenario('RA-105', 'Ranges across a month end and a year end equal the sum of their parts (no lead lost or counted twice at the boundary)'), async ({ page }) => {
    await open(page, R.leads);
    const cases: [string, string, string, string][] = [
      ['2026-08-15', '2026-08-31', '2026-09-01', '2026-09-15'],
      ['2025-12-15', '2025-12-31', '2026-01-01', '2026-01-15'],
    ];
    for (const [a, b, c, d] of cases) {
      const whole = await capturedBetween(page, a, d);
      const first = await capturedBetween(page, a, b);
      const second = await capturedBetween(page, c, d);
      note(`${a}…${d}`, `whole ${whole} | ${a}…${b} ${first} + ${c}…${d} ${second}`);
      expect.soft(first + second, `${a}…${d} = sum of both halves`).toBe(whole);
    }
  });
});

test.describe('Scenarios · Performance and Load', () => {
  test(...scenario('RA-106', `The Reports & Analytics hub shows all 8 snapshot values within ${BUDGET} ms`), async ({ page }) => {
    const ms = await loadTime(page, ROUTES.hub, HUB_SNAPSHOT);
    note('load time', `${ms} ms`);
    expect.soft(ms).toBeLessThanOrEqual(BUDGET);
  });

  test(...scenario('RA-107', `Each report module shows its KPIs within ${BUDGET} ms`), async ({ page }) => {
    const times: string[] = [];
    for (const [name, def] of Object.entries(REPORT_PAGES)) {
      const ms = await loadTime(page, def.path, def.kpis);
      times.push(`${name} ${ms} ms`);
      expect.soft(ms, name).toBeLessThanOrEqual(BUDGET);
    }
    note('load times', times.join(' | '));
  });

  test(...scenario('RA-108', `Pages with the most data (Leads list, Exceptions with 9 tables, Collections) load within ${BUDGET} ms`), async ({ page }) => {
    const times: string[] = [];
    const t = Date.now();
    await page.goto(ROUTES.leads);
    await expect(at(page, XP.leadsPager)).toBeVisible();
    times.push(`Leads ${Date.now() - t} ms`);
    expect.soft(Date.now() - t, 'Leads').toBeLessThanOrEqual(BUDGET);
    for (const [name, path] of [['Exceptions', R.exceptions], ['Collections', R.collections]]) {
      const ms = await loadTime(page, path, REPORT_PAGES[`${name === 'Exceptions' ? 'Exception' : 'Collection'} Reports`].kpis);
      times.push(`${name} ${ms} ms`);
      expect.soft(ms, name).toBeLessThanOrEqual(BUDGET);
    }
    note('load times', times.join(' | '));
  });

  test(...manual('RA-109', 'concurrent-user load needs a load-testing tool (e.g. k6 or JMeter), not a browser test'));

  test(...scenario('RA-110', `Exporting all leads finishes within ${EXPORT_BUDGET} ms`), async ({ page }) => {
    await open(page, ROUTES.leads);
    const t = Date.now();
    const sheet = await download(page, at(page, XP.leadsExport), EXPORT_BUDGET + 30_000);
    const ms = Date.now() - t;
    note('export', `${sheet.rows.length} rows in ${ms} ms`);
    expect.soft(ms).toBeLessThanOrEqual(EXPORT_BUDGET);
  });

  test(...manual('RA-111', 'stability under expected load needs a load-testing tool and an agreed load profile'));
});
