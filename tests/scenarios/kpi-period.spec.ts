/** Workbook areas: Executive Snapshot / KPI Validation (RA-001…012), Reporting Period Scenarios (RA-013…018). */
import { test, expect, Page } from '../auth';
import { kpi, kpiText, open, collectJson, numbersIn, matchesApi, parseNum } from '../helpers';
import { ROUTES, HUB_SNAPSHOT, REPORT_PAGES, XP, at } from '../locators';
import { dbConfigured, dbNumber, sameValue } from '../db';
import { DB_CHECKS } from '../db-queries';
import {
  scenario, note, near, expectNear, colSum, periodSelect, setPeriod, openReport, setCustomRange, reportResponse, expectClean,
} from './support';

const R = ROUTES.reports;

/** Where each Executive snapshot card is also shown on a report module (compared with period "This month"). */
const MODULE_SOURCE: Record<string, { page: string; label: string }> = {
  'Active Leads': { page: R.leads, label: 'Open Leads Now' },
  'Open Opportunities': { page: R.sales, label: 'Open opportunities' },
  'Units Available': { page: R.inventory, label: 'Available' },
  'Units Reserved': { page: R.inventory, label: 'Reserved' },
  'Units Sold': { page: R.inventory, label: 'Sold' },
  'Pipeline Value': { page: R.sales, label: 'Pipeline value' },
  'Weighted Pipeline': { page: R.sales, label: 'Weighted pipeline' },
  'SPA Value Signed (This Month)': { page: R.spa, label: 'Signed value' },
};

const isCount = (label: string) => !/Value|Pipeline/.test(label);

/** Opens the hub and returns the card value plus every number in the dashboard API response. */
async function hubCard(page: Page, label: string) {
  const bodies = collectJson(page);
  await open(page, ROUTES.hub);
  const text = await kpiText(page, label);
  return { text, value: parseNum(text), api: numbersIn(bodies) };
}

async function checkSnapshotCard(page: Page, label: string) {
  const { text, value, api } = await hubCard(page, label);
  expect.soft(text, `${label} shows a number`).toMatch(/^\d/);
  expect.soft(value, `${label} ≥ 0`).toBeGreaterThanOrEqual(0);
  if (isCount(label)) expect.soft(Number.isInteger(value), `${label} is a whole number ("${text}")`).toBeTruthy();
  expect.soft(matchesApi(value, api), `${label}=${value} is in the dashboard API response`).toBeTruthy();

  const src = MODULE_SOURCE[label];
  await openReport(page, src.page, 'this_month');
  const other = await kpi(page, src.label);
  note('values', `Hub "${text}" | ${src.page} "${src.label}" (This month) ${other}`);
  expectNear(value, other, `Hub ${label} vs ${src.page} ${src.label}`, 0.005, 0);
  return { value, other };
}

test.describe('Scenarios · Executive Snapshot / KPI Validation', () => {
  test(...scenario('RA-001', 'Active Leads is a whole number ≥ 0, is in the API response, and equals "Open Leads Now" on Lead Reports'), async ({ page }) => { await checkSnapshotCard(page, 'Active Leads'); });

  test(...scenario('RA-002', 'Open Opportunities is a whole number ≥ 0, is in the API response, and equals Sales Reports "Open opportunities" (This month)'), async ({ page }) => { await checkSnapshotCard(page, 'Open Opportunities'); });

  test(...scenario('RA-003', 'Units Available is a whole number ≥ 0, is in the API response, and equals Inventory Reports "Available"'), async ({ page }) => { await checkSnapshotCard(page, 'Units Available'); });

  test(...scenario('RA-004', 'Units Reserved is a whole number ≥ 0, is in the API response, and equals Inventory Reports "Reserved"'), async ({ page }) => { await checkSnapshotCard(page, 'Units Reserved'); });

  test(...scenario('RA-005', 'Units Sold is a whole number ≥ 0, is in the API response, and equals Inventory Reports "Sold"'), async ({ page }) => { await checkSnapshotCard(page, 'Units Sold'); });

  test(...scenario('RA-006', 'Pipeline Value equals Sales "Pipeline value" and the sum of "Value (USD)" in Open Pipeline by Stage'), async ({ page }) => {
    const { value } = await checkSnapshotCard(page, 'Pipeline Value');
    expectNear(await colSum(page, 'Open Pipeline by Stage', 'Value (USD)'), value, 'Sum of stage values vs hub Pipeline Value');
  });

  test(...scenario('RA-007', 'Weighted Pipeline equals the sum of Weighted (USD) by stage, and is ≤ Pipeline Value'), async ({ page }) => {
    const { value } = await checkSnapshotCard(page, 'Weighted Pipeline');
    expectNear(await colSum(page, 'Open Pipeline by Stage', 'Weighted (USD)'), value, 'Sum of weighted stage values vs hub Weighted Pipeline');
    expect.soft(value, 'Weighted ≤ Pipeline value').toBeLessThanOrEqual(await kpi(page, 'Pipeline value'));
  });

  test(...scenario('RA-008', 'SPA Value Signed (This Month) equals SPA Reports "Signed value" for This month'), async ({ page }) => { await checkSnapshotCard(page, 'SPA Value Signed (This Month)'); });

  test(...scenario('RA-009', 'All 8 snapshot values appear in the dashboard API response'), async ({ page }) => {
    const bodies = collectJson(page);
    await open(page, ROUTES.hub);
    const api = numbersIn(bodies);
    expect(api.length, 'API numbers captured').toBeGreaterThan(0);
    for (const label of HUB_SNAPSHOT) {
      const v = await kpi(page, label);
      expect.soft(matchesApi(v, api), `${label}=${v} in API response`).toBeTruthy();
    }
  });

  test(...scenario('RA-010', 'Each snapshot value equals the database result (runs only when the database is configured)'), async ({ page }) => {
    test.skip(!dbConfigured, 'Database tests off (SKIP_DB_TESTS=true) or not configured — see .env');
    await open(page, ROUTES.hub);
    for (const c of DB_CHECKS.filter(c => c.page === 'reports' && c.ui.kind === 'card')) {
      const ui = await kpi(page, (c.ui as { label: string }).label);
      const db = await dbNumber(c.sql);
      expect.soft(sameValue(ui, db), `${c.title}: UI ${ui} | DB ${db}`).toBeTruthy();
    }
  });

  test(...scenario('RA-011', 'Amounts show as "<number>[K|M|B] <currency>" with one currency everywhere; counts show as plain whole numbers'), async ({ page }) => {
    const MONEY = /^\d{1,3}(,\d{3})*(\.\d+)?\s?[KMB]?\s([A-Z]{3})$/;
    const currencies = new Set<string>();
    await open(page, ROUTES.hub);
    for (const label of HUB_SNAPSHOT) {
      const t = await kpiText(page, label);
      if (isCount(label)) expect.soft(t, `${label} is a plain whole number`).toMatch(/^\d{1,3}(,\d{3})*$/);
      else {
        expect.soft(t, `${label} money format`).toMatch(MONEY);
        currencies.add(t.match(MONEY)?.[3] ?? '?');
      }
    }
    const money: [string, string[]][] = [
      [R.sales, ['Pipeline value', 'Weighted pipeline', 'Won value']],
      [R.spa, ['Signed value', 'Average SPA value']],
      [R.collections, ['Scheduled', 'Received', 'Outstanding', 'Overdue']],
    ];
    for (const [path, labels] of money) {
      await openReport(page, path, 'last_12_months');
      for (const label of labels) {
        const t = await kpiText(page, label);
        expect.soft(t, `${path} ${label} money format`).toMatch(MONEY);
        currencies.add(t.match(MONEY)?.[3] ?? '?');
      }
    }
    note('currencies', [...currencies].join(', '));
    expect.soft([...currencies], 'One currency across all amounts').toHaveLength(1);
  });

  test(...scenario('RA-012', 'Changing the period reloads the KPIs with that period; "Won in period" for Last 12 months ≥ This month'), async ({ page }) => {
    const bodies = collectJson(page);
    await openReport(page, R.sales, 'this_month');
    const month = await kpi(page, 'Won in period');
    await setPeriod(page, 'last_12_months');
    const year = await kpi(page, 'Won in period');
    note('values', `Won in period: This month ${month} | Last 12 months ${year}`);
    expect.soft(year, 'Last 12 months ≥ This month').toBeGreaterThanOrEqual(month);
    const api = numbersIn(bodies.filter(b => /business\/sales.*period=last_12_months/.test(b.url)));
    expect.soft(matchesApi(year, api), 'KPI shows the Last 12 months value from the API').toBeTruthy();
  });
});

test.describe('Scenarios · Reporting Period Scenarios', () => {
  test(...scenario('RA-013', 'Every report module opens with the period set to "This month"'), async ({ page }) => {
    const seen: string[] = [];
    for (const [name, def] of Object.entries(REPORT_PAGES)) {
      await open(page, def.path);
      const value = await periodSelect(page).inputValue();
      seen.push(`${name}: ${value}`);
      expect.soft(value, `${name} default period`).toBe('this_month');
    }
    note('default periods', seen.join(' | '));
  });

  test(...scenario('RA-014', 'Selecting "Last month" requests period=last_month and every KPI shows a valid value'), async ({ page }) => {
    await open(page, R.sales);
    const resp = reportResponse(page, u => u.includes('period=last_month'));
    await periodSelect(page).selectOption('last_month');
    expect((await resp).ok(), 'Report request for last_month succeeded').toBeTruthy();
    await page.waitForTimeout(500);
    for (const label of REPORT_PAGES['Sales Reports'].kpis) {
      expect.soft(await kpiText(page, label), label).not.toMatch(/NaN|undefined|^\s*$/);
    }
    await expectClean(page);
  });

  test(...scenario('RA-015', 'Custom dates shows From / To; filling both requests period=custom with those dates and the KPIs reload'), async ({ page }) => {
    await open(page, R.sales);
    await setCustomRange(page, '2026-09-01', '2026-09-30');
    for (const label of REPORT_PAGES['Sales Reports'].kpis) {
      expect.soft(await kpiText(page, label), label).not.toMatch(/NaN|undefined|^\s*$/);
    }
    await expectClean(page);
  });

  test(...scenario('RA-016', 'A To date before the From date is rejected: a message is shown or no request is sent with from > to'), async ({ page }) => {
    await open(page, R.sales);
    await setPeriod(page, 'custom');
    const sent: string[] = [];
    page.on('request', r => { if (r.url().includes('period=custom')) sent.push(r.url()); });
    await at(page, XP.reportFrom).fill('2026-09-30');
    await at(page, XP.reportTo).fill('2026-09-01');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(800);
    const bad = sent.filter(u => {
      const f = u.match(/from=([\d-]+)/)?.[1];
      const t = u.match(/to=([\d-]+)/)?.[1];
      return f && t && f > t;
    });
    const message = await page.locator('main').getByText(/before|after|invalid|must be/i).count();
    note('requests', sent.join(' | ') || 'none');
    expect(bad.length === 0 || message > 0, `Invalid range sent without a message: ${bad.join(' | ')}`).toBeTruthy();
  });

  test(...scenario('RA-017', 'For This month, Last month and Last 12 months, each count/amount KPI equals the value in that period\'s API response'), async ({ page }) => {
    const bodies = collectJson(page);
    await open(page, R.sales);
    for (const period of ['this_month', 'last_month', 'last_12_months']) {
      await setPeriod(page, period);
      const api = numbersIn(bodies.filter(b => new RegExp(`business/sales.*period=${period}`).test(b.url)));
      expect.soft(api.length, `${period}: API response captured`).toBeGreaterThan(0);
      for (const label of ['Open opportunities', 'Pipeline value', 'Weighted pipeline', 'Won in period', 'Won value', 'Past expected close']) {
        const v = await kpi(page, label);
        expect.soft(matchesApi(v, api), `${period}: ${label}=${v} in API response`).toBeTruthy();
      }
    }
  });

  test(...scenario('RA-018', 'With the same period selected, metrics shared between modules agree (Last month and Last 12 months)'), async ({ page }) => {
    const pairs: [string, string, string, string][] = [
      [R.leads, 'Won Value', R.sales, 'Won value'],
      [R.leads, 'SPA Signed', R.spa, 'SPAs signed in period'],
      [R.inventory, 'Sold in period', R.spa, 'SPAs signed in period'],
      [R.customers, 'SPA value', R.spa, 'Signed value'],
    ];
    const rows: string[] = [];
    for (const period of ['last_month', 'last_12_months']) {
      for (const [p1, l1, p2, l2] of pairs) {
        await openReport(page, p1, period);
        const a = await kpi(page, l1);
        await openReport(page, p2, period);
        const b = await kpi(page, l2);
        rows.push(`${period}: ${p1} ${l1}=${a} | ${p2} ${l2}=${b}`);
        expect.soft(near(a, b, 0.005, 0), `${period}: ${p1} "${l1}" ${a} vs ${p2} "${l2}" ${b}`).toBeTruthy();
      }
    }
    note('values', rows.join('\n'));
  });
});

