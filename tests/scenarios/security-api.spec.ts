/**
 * Workbook areas: Login, Permission and Security (RA-084…091), API and Error Handling (RA-092…098).
 * Error handling is tested by intercepting the Sales report API in the browser (page.route), so no
 * backend is broken for anyone else.
 */
import 'dotenv/config';
import { test, expect, Page, Route } from '../auth';
import { kpi, kpiText, open, act, collectJson, numbersIn, matchesApi, watchErrors } from '../helpers';
import { ROUTES, REPORT_PAGES, XP, at } from '../locators';
import { login } from '../global-setup';
import { scenario, manual, note, openReport, setPeriod, expectClean, ERROR_TEXT } from './support';

const R = ROUTES.reports;
const API = process.env.CRM_API_URL ?? 'https://crm-be-93614024352.asia-southeast1.run.app';
const SALES_API = '**/api/v1/reports/business/sales**';
const NO_AUTH = { cookies: [], origins: [] };

/** Report endpoints the pages call (captured from the live app). */
const ENDPOINTS = [
  '/api/v1/dashboard/summary?period=this_month&view=all',
  '/api/v1/leads?limit=25&offset=0',
  '/api/v1/reports/leads/overview?period=last_12_months',
  ...['sales', 'inventory', 'customers', 'brokers', 'marketing', 'reservations', 'spa', 'collections', 'exceptions']
    .map(m => `/api/v1/reports/business/${m}?period=last_12_months`),
];

/** Whatever KPI values are on screen (none when the report didn't load) are not broken values. */
async function salesKpisClean(page: Page) {
  await expectClean(page, 'Sales');
  const values = await page.locator('main article.crm-card .crm-kpi').allInnerTexts();
  expect.soft(values.filter(v => /NaN|undefined|Infinity/.test(v)), 'Broken KPI values').toEqual([]);
}

test.describe('Scenarios · Login, Permission and Security', () => {
  test(...scenario('RA-084', 'A logged-in administrator opens the hub and all 10 report modules with no 401/403 responses'), async ({ page }) => {
    const denied: string[] = [];
    page.on('response', r => { if ([401, 403].includes(r.status())) denied.push(`${r.status()} ${r.url()}`); });
    await open(page, ROUTES.hub);
    await expect(page.getByRole('heading', { name: 'Reports & Analytics' })).toBeVisible();
    for (const [name, def] of Object.entries(REPORT_PAGES)) {
      await open(page, def.path);
      await expect.soft(page.getByRole('heading', { name, exact: true }), name).toBeVisible();
    }
    expect.soft(denied, 'Denied API calls').toEqual([]);
  });

  test.describe('without a login', () => {
    test.use({ storageState: NO_AUTH });

    test(...scenario('RA-085', 'Without a login, the hub and every report module redirect to the login page and show no report data'), async ({ page }) => {
      const data: string[] = [];
      page.on('response', r => { if (/\/api\/v1\/(reports|dashboard|leads)/.test(r.url()) && r.ok()) data.push(r.url()); });
      for (const path of [ROUTES.hub, ...Object.values(REPORT_PAGES).map(d => d.path)]) {
        await page.goto(path);
        await expect.soft(page, `${path} redirects to login`).toHaveURL(/\/login/);
      }
      expect.soft(data, 'Report data returned without a login').toEqual([]);
    });
  });

  test(...manual('RA-086', 'needs login details for users with restricted roles (only an administrator account is configured)'));
  test(...manual('RA-087', 'needs login details for users with restricted roles (only an administrator account is configured)'));
  test(...manual('RA-088', 'needs a second, non-admin user so "Mine" and "You and your team" can be compared per user'));

  test(...scenario('RA-089', 'Every report API returns 401/403 when called directly without a token'), async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: API });
    const open_: string[] = [];
    for (const path of ENDPOINTS) {
      const r = await api.get(path);
      if (![401, 403].includes(r.status())) open_.push(`${r.status()} ${path}`);
    }
    await api.dispose();
    expect.soft(open_, 'Endpoints that did not refuse an anonymous call').toEqual([]);
  });

  test(...scenario('RA-090', 'Log Out ends the session (back to login; report pages and Back no longer show data); a removed session token also sends the user to login'), async ({ browser, baseURL }) => {
    const user = process.env.CRM_USERNAME;
    const pass = process.env.CRM_PASSWORD;
    test.skip(!user || !pass, 'Set CRM_USERNAME / CRM_PASSWORD in .env');
    // A separate login, so logging out does not end the session the other tests share.
    const ctx = await browser.newContext({ baseURL, storageState: NO_AUTH });
    const page = await ctx.newPage();

    // Session expiry: the same as the session token being gone from the browser.
    await login(page, user!, pass!);
    await page.evaluate(() => localStorage.clear());
    await page.goto(R.sales);
    await expect.soft(page, 'Without a session token').toHaveURL(/\/login/);

    await login(page, user!, pass!);
    await open(page, R.sales);
    await at(page, XP.userMenu).click();
    await at(page, XP.logout).click();
    await expect(page, 'After Log Out').toHaveURL(/\/login/);
    await page.goBack();
    await expect.soft(page, 'Back after Log Out').toHaveURL(/\/login/);
    await page.goto(R.sales);
    await expect.soft(page, 'Report page after Log Out').toHaveURL(/\/login/);
    // keys may stay with an emptied state; what must be gone is any token (JWT)
    const stored = await page.evaluate(() => Object.keys(localStorage).filter(k => /eyJ[\w-]+\.[\w-]+\.[\w-]+/.test(localStorage.getItem(k) ?? '')));
    expect.soft(stored, 'Storage keys still holding a session token after Log Out').toEqual([]);
    await ctx.close();
  });

  test(...scenario('RA-091', 'Anonymous API calls return no lead, customer or financial data (no lead numbers, emails or phone numbers in the response)'), async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: API });
    const leaks: string[] = [];
    for (const path of ENDPOINTS) {
      const body = await (await api.get(path)).text();
      if (/LD-\d|CUST-\d|OPP-\d|[\w.+-]+@[\w-]+\.\w+|\+\d[\d ]{7,}/.test(body)) leaks.push(`${path}: ${body.slice(0, 120)}`);
    }
    await api.dispose();
    expect.soft(leaks, 'Responses containing personal or business data').toEqual([]);
  });
});

/** Opens Sales Reports with the report API answered by `handler` (only the report data call). */
async function salesWith(page: Page, handler: (route: Route) => Promise<void>) {
  await page.route(SALES_API, handler);
  await page.goto(R.sales);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
}

test.describe('Scenarios · API and Error Handling', () => {
  test(...scenario('RA-092', 'Every Sales count and amount KPI shows the value from the API response'), async ({ page }) => {
    const bodies = collectJson(page);
    await openReport(page, R.sales);
    const api = numbersIn(bodies.filter(b => b.url.includes('/reports/business/sales')));
    for (const label of ['Open opportunities', 'Pipeline value', 'Weighted pipeline', 'Won in period', 'Won value', 'Past expected close']) {
      const v = await kpi(page, label);
      expect.soft(matchesApi(v, api), `${label}=${v} in API response`).toBeTruthy();
    }
  });

  test(...scenario('RA-093', 'When the report API fails (HTTP 500), the page shows an error message and no made-up values'), async ({ page }) => {
    await salesWith(page, r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Internal Server Error"}' }));
    await expect.soft(page.locator('main').getByText(ERROR_TEXT).first(), 'Error message shown').toBeVisible({ timeout: 20_000 });
    await salesKpisClean(page);
    note('page text', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(-400));
  });

  test(...scenario('RA-094', 'When the report API times out, the page stops loading and shows an error (no endless spinner, no broken values)'), async ({ page }) => {
    await salesWith(page, r => r.abort('timedout'));
    await expect.soft(page.locator('main').getByText(ERROR_TEXT).first(), 'Error message shown').toBeVisible({ timeout: 20_000 });
    await expect.soft(page.locator('main').getByText(/^\s*loading/i), 'Still loading').toHaveCount(0);
    await salesKpisClean(page);
  });

  test(...scenario('RA-095', 'When the API response is missing fields, the page shows no NaN / undefined and no JavaScript errors'), async ({ page }) => {
  const errors = watchErrors(page);
  await salesWith(page, async route => {
    const res = await route.fetch();
    const body = await res.json();
    const partial = Object.fromEntries(Object.entries(body).filter((_, i) => i % 2 === 0));
    note('kept keys', Object.keys(partial).join(', '));
    await route.fulfill({ response: res, json: partial });
  });
    await salesKpisClean(page);
    expect.soft(errors.errors, 'JavaScript errors').toEqual([]);
  });

  test(...scenario('RA-096', 'Opening every report, switching tabs, periods and views raises no JavaScript errors and no failed API calls'), async ({ page }) => {
    const w = watchErrors(page);
    for (const def of Object.values(REPORT_PAGES)) {
      await open(page, def.path);
      await setPeriod(page, 'last_month');
    }
    await open(page, R.sales);
    for (const v of ['You and your team', 'Mine', 'All'] as const) await act(page, () => at(page, XP.viewSegment(v)).click());
    await open(page, R.leads);
    for (const tab of ['Source & Channel', 'Aging & Follow-up', 'Qualification & Conversion', 'Salesperson Scorecard']) {
      await act(page, () => at(page, XP.reportTab(tab)).click());
    }
    expect.soft(w.errors, 'JavaScript errors').toEqual([]);
    expect.soft(w.failed, 'Failed API calls').toEqual([]);
  });

  test(...scenario('RA-097', 'An empty API response ({} or no content) shows an empty-state message (or zero values), not a blank page, NaN / undefined or a crash'), async ({ page }) => {
    const errors = watchErrors(page);
    const EMPTY_STATE = /no data|no records|nothing to show|no results|not available|empty/i;
    for (const [name, handler] of [
      ['{}', (r: Route) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })],
      ['204 No Content', (r: Route) => r.fulfill({ status: 204, body: '' })],
    ] as const) {
      await page.unroute(SALES_API);
      await salesWith(page, handler);
      await salesKpisClean(page);
      const cards = await page.locator('main article.crm-card').count();
      const message = await page.locator('main').getByText(EMPTY_STATE).count();
      expect.soft(cards > 0 || message > 0, `${name}: report shows KPI cards or an empty-state message`).toBeTruthy();
    }
    expect.soft(errors.errors, 'JavaScript errors').toEqual([]);
  });

  test(...scenario('RA-098', 'After an API failure, retrying (Retry button or reload) loads the real data'), async ({ page }) => {
    await salesWith(page, r => r.fulfill({ status: 500, body: '{}' }));
    await page.unroute(SALES_API);
    const retry = page.locator('main').getByRole('button', { name: /retry|try again|reload/i });
    if (await retry.count()) await act(page, () => retry.first().click());
    else await page.reload();
    await page.waitForLoadState('networkidle').catch(() => {});
    note('retry', (await retry.count()) ? 'Retry button' : 'Page reload (no Retry button)');
    expect.soft(await kpiText(page, 'Open opportunities')).toMatch(/^\d/);
    await salesKpisClean(page);
  });
});
