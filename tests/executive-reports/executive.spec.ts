/**
 * Executive Reports (the dashboard at /) workbook: Testcase/Executive_Reports_Test_Cases.xlsx. The dashboard is not a
 * report module, so every row is a page check here. Four views: Commercial / Sales and Monthly Sales & Marketing
 * (monthly snapshots), Executive Operations and Lead Dashboard (live). Data-changing actions are never clicked.
 */
import 'dotenv/config';
import { test, expect, note } from '../pages/fixtures';
import { num, parseNum, sum } from '../helpers';
import { XP, at, ROUTES } from '../locators';
import { readWorkbook } from '../module-workbooks/catalog';
import { declareCoverage } from '../module-workbooks/common';
import { shownTolerance, expectNothingHappens } from '../module-workbooks/helpers';
import { ExecutiveReportsPage, DASHBOARD_VIEWS, DASHBOARD_PERIODS, DashboardView } from '../pages/ExecutiveReportsPage';
import { ERROR_TEXT } from '../scenarios/support';
import { labelOf } from '../lead-reports/shared';

const WB = readWorkbook('Executive_Reports_Test_Cases.xlsx', 'ER', '@executive-workbook');
declareCoverage(WB, 'tests/executive-reports');

const NO_AUTH = { cookies: [], origins: [] };
const BUDGET = Number(process.env.PERF_BUDGET_MS ?? 5000);
const BAD = /^\s*$|NaN|undefined|Infinity/;
const COMMERCIAL_TILES = ['Total Leads', 'Qualified Leads', 'Site Visits', 'Reservations', 'Units Sold', 'Sales Value', 'Collections', 'Conversion Rate'];
const MONTHLY_TILES = ['Total Inventory', 'Units Available', 'Units Reserved', 'Units Sold (Month)', 'Gross Sales (Month)', 'Collections (Month)', 'Cancellations (Month)'];
const PERIOD_CARDS = ['Converted Leads', 'SPAs Executed', 'Sales Value (SPAs)', 'Won Opportunities'];
const ASOF_CARDS = ['Active Leads', 'Open Opportunities', 'Reserved Units', 'Units Available', 'Collections Received', 'Outstanding Amount'];
/** What each view shows (a heading or tile that only that view has). */
const VIEW_MARK: Record<DashboardView, string> = {
  commercial_executive: XP.dashboardHeading('Sales Funnel (This Month)'), monthly_sales_marketing: XP.dashboardLabel('Total Inventory'),
  operations: XP.dashboardHeading('Executive Operations Dashboard'), audience: XP.dashboardHeading('Lead & Customer Insights'),
};

/** "label | number" pairs in a panel's text (e.g. Lead Source Mix). */
async function pairs(x: ExecutiveReportsPage, heading: string) {
  const lines = (await x.panel(heading).innerText()).split('\n').map(s => s.trim()).filter(Boolean).slice(1);
  const out: Record<string, number> = {};
  for (let i = 0; i < lines.length - 1; i++) if (!/^\d/.test(lines[i]) && /^\d[\d,]*$/.test(lines[i + 1])) { out[lines[i]] = num(lines[i + 1]); i++; }
  return out;
}

/** Commercial current-period tiles against the live reports for this month. */
async function commercialVsLive(x: ExecutiveReportsPage, spa: import('../pages/SpaReportsPage').SpaReportsPage,
  reservations: import('../pages/ReservationReportsPage').ReservationReportsPage, collections: import('../pages/CollectionReportsPage').CollectionReportsPage) {
  await x.openView('commercial_executive');
  const t: Record<string, string> = {};
  for (const k of ['Units Sold', 'Sales Value', 'Reservations', 'Collections']) t[k] = await x.tile(k);
  await spa.openWith('this_month');
  const spas = await spa.kpi('SPAs signed in period'), signed = await spa.shown('Signed value');
  await reservations.openWith('this_month');
  const res = await reservations.kpi('Reservations in period');
  await collections.open();
  const received = await collections.shown('Received');
  note('values', `Commercial ${JSON.stringify(t)} | SPA Reports this month ${spas} SPAs, ${signed} | Reservations ${res} | Collections received ${received}`);
  expect.soft(parseNum(t['Units Sold']), 'Units Sold = SPAs signed this month').toBe(spas);
  expect.soft(Math.abs(parseNum(t['Sales Value']) - num(signed)), `Sales Value ${t['Sales Value']} = Signed value ${signed}`).toBeLessThanOrEqual(shownTolerance(t['Sales Value']) + shownTolerance(signed));
  expect.soft(parseNum(t['Reservations']), 'Reservations = Reservation Reports this month').toBe(res);
  expect.soft(Math.abs(parseNum(t['Collections']) - num(received)), `Collections ${t['Collections']} = Received ${received}`).toBeLessThanOrEqual(shownTolerance(t['Collections']) + shownTolerance(received));
}

async function responsive(x: ExecutiveReportsPage, views: DashboardView[]) {
  const wide: string[] = [];
  for (const [name, size] of Object.entries({ tablet: { width: 768, height: 1024 }, phone: { width: 390, height: 844 } })) {
    await x.page.setViewportSize(size);
    for (const v of views) {
      await x.openView(v);
      const px = await x.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (px > 1) wide.push(`${name} ${DASHBOARD_VIEWS[v]}: ${px}px too wide`);
    }
  }
  expect(wide, 'Views wider than the screen').toEqual([]);
}

test.describe('Executive Reports · General and views', () => {
  test(...WB.key('page:hub'), async ({ hub, page }) => {
    await hub.open();
    await hub.openModule(ROUTES.dashboard);
    await expect(page).toHaveURL(/\/(\?.*)?$/);
    await expect(at(page, XP.dashboardView), 'Dashboard View').toBeVisible();
  });

  test(...WB.key('page:url'), async ({ executive }) => {
    executive.watchErrors();
    await executive.openView('commercial_executive');
    for (const k of COMMERCIAL_TILES) expect.soft(await executive.tile(k), k).not.toMatch(BAD);
    await executive.expectNoBrokenValues();
    executive.expectNoErrors();
  });

  test.describe('signed out', () => {
    test.use({ storageState: NO_AUTH });
    test(...WB.key('page:login'), async ({ page }) => {
      await page.goto('/');
      await expect(page, 'Sent to the login page').toHaveURL(/\/login/, { timeout: 20_000 });
    });
  });

  test(...WB.key('page:views'), async ({ executive }) => {
    await executive.openView('commercial_executive');
    const options = await executive.viewSelect.locator('option').evaluateAll(os => os.map(o => `${(o as HTMLOptionElement).value}=${(o as HTMLOptionElement).text.trim()}`));
    expect(options).toEqual(Object.entries(DASHBOARD_VIEWS).map(([v, l]) => `${v}=${l}`));
    for (const v of Object.keys(DASHBOARD_VIEWS) as DashboardView[]) {
      await executive.setView(v);
      await expect.soft(at(executive.page, VIEW_MARK[v]).first(), `${DASHBOARD_VIEWS[v]} shows its panels`).toBeVisible({ timeout: 15_000 });
    }
  });

  test(...WB.key('page:default-view'), async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle').catch(() => {});
    const view = await at(page, XP.dashboardView).inputValue();
    note('default view', DASHBOARD_VIEWS[view as DashboardView] ?? view);
    expect(view).toBe('commercial_executive');
  });
});

test.describe('Executive Reports · Executive Operations', () => {
  test(...WB.key('page:ops-kpis'), async ({ executive }) => {
    await executive.open();
    await executive.waitForKpis();
    for (const k of executive.kpiLabels) {
      expect.soft(await executive.kpiText(k), k).not.toMatch(BAD);
      expect.soft(await executive.kpiCard(k).innerText(), `${k}: note under the value`).toMatch(/as of|this month|current|receipts|payment plans|reservations/i);
    }
  });

  test(...WB.key('page:ops-periods'), async ({ executive }) => {
    await executive.open();
    expect(await executive.periodOptions()).toEqual([...DASHBOARD_PERIODS]);
    for (const p of DASHBOARD_PERIODS) {
      await executive.setPeriod(p);
      for (const k of executive.kpiLabels) expect.soft(await executive.kpiText(k), `${p} › ${k}`).not.toMatch(BAD);
    }
  });

  test(...WB.key('page:ops-follows'), async ({ executive }) => {
    await executive.open();
    const by: Record<string, Record<string, number>> = {};
    for (const p of DASHBOARD_PERIODS) { await executive.setPeriod(p); by[p] = await executive.kpis(PERIOD_CARDS); }
    note('values', JSON.stringify(by));
    for (const k of PERIOD_CARDS) {
      expect.soft(by.this_month[k], `${k}: This month ≤ This quarter`).toBeLessThanOrEqual(by.this_quarter[k] * 1.005);
      expect.soft(by.this_quarter[k], `${k}: This quarter ≤ Year to date`).toBeLessThanOrEqual(by.ytd[k] * 1.005);
    }
  });

  test(...WB.key('page:ops-asof'), async ({ executive }) => {
    await executive.open();
    const by: Record<string, string>[] = [];
    for (const p of DASHBOARD_PERIODS) {
      await executive.setPeriod(p);
      const row: Record<string, string> = {};
      for (const k of ASOF_CARDS) row[k] = await executive.kpiText(k);
      by.push(row);
    }
    for (const row of by.slice(1)) expect.soft(row, 'As-of cards unchanged').toEqual(by[0]);
  });

  test(...WB.key('page:ops-panels'), async ({ executive }) => {
    await executive.open();
    const k = await executive.kpis(['Converted Leads', 'Open Opportunities', 'SPAs Executed', 'Units Available', 'Reserved Units']);
    const pipe = await pairs(executive, 'Sales Pipeline');
    note('Sales Pipeline', JSON.stringify(pipe));
    expect.soft(pipe['Converted'], 'Pipeline Converted').toBe(k['Converted Leads']);
    expect.soft(pipe['Opportunities'], 'Pipeline Opportunities').toBe(k['Open Opportunities']);
    expect.soft(pipe['SPAs Executed'], 'Pipeline SPAs Executed').toBe(k['SPAs Executed']);
    const inv = (await executive.panel('Inventory Overview').innerText()).replace(/\s+/g, ' ');
    const grab = (re: RegExp) => Number(inv.match(re)?.[1] ?? NaN);
    const total = grab(/Inventory Overview (\d+)/), avail = grab(/Available (\d+)/), reserved = grab(/Reserved (\d+)/), sold = grab(/SPA \/ Sold (\d+)/);
    note('Inventory Overview', inv);
    expect.soft(avail, 'Inventory Available = Units Available').toBe(k['Units Available']);
    expect.soft(reserved, 'Inventory Reserved = Reserved Units').toBe(k['Reserved Units']);
    expect.soft(avail + reserved + sold, 'Available + Reserved + SPA / Sold = total').toBe(total);
    await expect.soft(executive.panel('Sales Trend (SPAs Value)'), 'Sales Trend = Sales Value (SPAs)').toContainText(await executive.kpiText('Sales Value (SPAs)'));
  });

  test(...WB.key('page:ops-collections'), async ({ executive }) => {
    await executive.open();
    const text = await executive.panel('Collections Summary').innerText();
    note('Collections Summary', text.replace(/\s+/g, ' '));
    await expect.soft(executive.panel('Collections Summary'), 'Shows Collections Received').toContainText(await executive.kpiText('Collections Received'));
    await expect.soft(executive.panel('Collections Summary'), 'Shows Outstanding Amount').toContainText(await executive.kpiText('Outstanding Amount'));
  });

  test(...WB.key('page:ops-kpi-links'), async ({ executive, page }) => {
    const seen: string[] = [];
    for (const k of executive.kpiLabels) {
      await executive.open();
      const href = await executive.openKpi(k);
      seen.push(`${k} → ${href}`);
      expect.soft(href, `${k} links somewhere`).toBeTruthy();
      expect.soft(new URL(page.url()).pathname, `${k} opens its records`).not.toBe('/');
    }
    note('links', seen.join(' | '));
  });

  test(...WB.key('page:ops-cross'), async ({ executive, hub, spa, collections }) => {
    await executive.open();
    const d = await executive.kpis(['Active Leads', 'Open Opportunities', 'Units Available', 'SPAs Executed']);
    const sales = await executive.kpiText('Sales Value (SPAs)'), received = await executive.kpiText('Collections Received'), outstanding = await executive.kpiText('Outstanding Amount');
    await hub.open();
    const h = await hub.kpis(['Active Leads', 'Open Opportunities', 'Units Available']);
    await spa.openWith('this_month');
    const spas = await spa.kpi('SPAs signed in period'), signed = await spa.shown('Signed value');
    await collections.open();
    const cRec = await collections.shown('Received'), cOut = await collections.shown('Outstanding');
    note('values', `dashboard ${JSON.stringify(d)} ${sales} ${received} ${outstanding} | hub ${JSON.stringify(h)} | SPA ${spas} ${signed} | collections ${cRec} ${cOut}`);
    for (const k of ['Active Leads', 'Open Opportunities', 'Units Available']) expect.soft(d[k], `${k} = hub`).toBe(h[k]);
    expect.soft(d['SPAs Executed'], 'SPAs Executed = SPA Reports this month').toBe(spas);
    expect.soft(Math.abs(num(sales) - num(signed)), 'Sales Value = Signed value this month').toBeLessThanOrEqual(shownTolerance(sales) + shownTolerance(signed));
    expect.soft(Math.abs(num(received) - num(cRec)), 'Collections Received = Received').toBeLessThanOrEqual(shownTolerance(received) + shownTolerance(cRec));
    expect.soft(Math.abs(num(outstanding) - num(cOut)), 'Outstanding Amount = Outstanding').toBeLessThanOrEqual(shownTolerance(outstanding) + shownTolerance(cOut));
  });
});

test.describe('Executive Reports · Lead Dashboard', () => {
  test(...WB.key('page:lead-kpis'), async ({ executive }) => {
    await executive.openView('audience');
    const k = await executive.kpis(['Leads Captured', 'Converted']);
    const rate = await executive.kpiText('Period Conversion');
    note('values', `${JSON.stringify(k)} | Period Conversion ${rate} | Overall ${await executive.kpiText('Overall Conversion')}`);
    if (k['Leads Captured']) expect(Math.abs(num(rate) - (k['Converted'] / k['Leads Captured']) * 100), 'Period Conversion = Converted ÷ Leads Captured').toBeLessThanOrEqual(0.5 + shownTolerance(rate));
  });

  test(...WB.key('page:lead-mix'), async ({ executive }) => {
    await executive.openView('audience');
    const captured = await executive.kpi('Leads Captured');
    for (const p of ['Lead Source Mix', 'Capture Channel']) {
      const mix = await pairs(executive, p);
      note(p, JSON.stringify(mix));
      expect.soft(sum(Object.values(mix)), `${p} adds up to Leads Captured`).toBe(captured);
    }
  });

  test(...WB.key('page:lead-cross'), async ({ executive, leadReports }) => {
    await executive.openView('audience');
    const captured = await executive.kpi('Leads Captured');
    const mix = await pairs(executive, 'Lead Source Mix');
    await leadReports.openWith('this_month');
    const lr = await leadReports.kpi('Leads Captured');
    await leadReports.openTab('Source & Channel');
    await leadReports.groupBy('Lead Source');
    const rows = Object.fromEntries((await leadReports.breakdown.rows()).map(r => [labelOf(r) === 'Unspecified' ? 'Not specified' : labelOf(r), num(r['Leads'])]));
    note('values', `dashboard ${captured} ${JSON.stringify(mix)} | Lead Reports ${lr} ${JSON.stringify(rows)}`);
    expect.soft(captured, 'Leads Captured = Lead Reports this month').toBe(lr);
    expect.soft(mix, 'Lead Source Mix = Lead Reports by Lead Source').toEqual(Object.fromEntries(Object.entries(rows).filter(([, v]) => v > 0)));
  });
});

test.describe('Executive Reports · Commercial and Monthly views', () => {
  test(...WB.key('page:com-period'), async ({ executive, page }) => {
    await executive.openView('commercial_executive');
    const values = await executive.reportPeriodSelect.locator('option').evaluateAll(os => os.map(o => (o as HTMLOptionElement).value));
    note('periods', values.join(', '));
    expect.soft(values[0], 'Current Period first').toBe('current');
    const months = values.slice(1);
    expect.soft(months, 'Past months, newest first').toEqual([...months].sort().reverse());
    const pick = months[1] ?? months[0];
    const req = page.waitForRequest(r => r.url().includes(`/analytics/snapshots/${pick}`), { timeout: 15_000 }).catch(() => null);
    await executive.reportPeriodSelect.selectOption(pick);
    expect(await req, `Loads the ${pick} snapshot`).not.toBeNull();
  });

  test(...WB.key('page:com-kpis'), async ({ executive }) => {
    await executive.openView('commercial_executive');
    const t: Record<string, string> = {};
    for (const k of COMMERCIAL_TILES) { t[k] = await executive.tile(k); expect.soft(t[k], k).toMatch(/\d/); }
    note('tiles', JSON.stringify(t));
  });

  test(...WB.key('page:com-funnel'), async ({ executive }) => {
    await executive.openView('commercial_executive');
    const lines = await executive.sectionLines('Sales Funnel (This Month)');
    const step = (label: string) => { const i = lines.findIndex(l => l.toLowerCase() === label.toLowerCase()); return i >= 0 ? num(lines[i + 1]) : NaN; };
    for (const [funnel, tile] of [['Leads', 'Total Leads'], ['Qualified Leads', 'Qualified Leads'], ['Site Visits', 'Site Visits'], ['Reservations', 'Reservations'], ['Units Sold', 'Units Sold']]) {
      expect.soft(step(funnel), `Funnel ${funnel} = tile ${tile}`).toBe(parseNum(await executive.tile(tile)));
    }
  });

  test(...WB.key('page:com-tables'), async ({ executive }) => {
    await executive.openView('commercial_executive');
    const bad: string[] = [];
    for (const r of await executive.tableAfter('Sales Performance (YTD)')) {
      const [a, b, v, ach] = [num(r['Actual']), num(r['Budget']), num(r['Variance']), num(r['Achievement'])];
      if (Math.abs(a - b - v) > Math.max(0.051, Math.abs(b) * 0.001)) bad.push(`${r['Metric']}: Variance ${r['Variance']} vs ${a} − ${b}`);
      if (b && Math.abs((a / b) * 100 - ach) > 1) bad.push(`${r['Metric']}: Achievement ${r['Achievement']} vs ${((a / b) * 100).toFixed(1)}%`);
    }
    const share = sum((await executive.tableAfter('Top 5 Projects by Sales Value (YTD)')).map(r => num(r['% of Total'])));
    if (share > 100.5) bad.push(`Top 5 projects % of Total adds up to ${share}%`);
    expect(bad).toEqual([]);
  });

  test(...WB.key('page:com-live-data'), async ({ executive, spa, reservations, collections }) => {
    await commercialVsLive(executive, spa, reservations, collections);
  });

  test(...WB.key('page:com-projects'), async ({ executive, spa }) => {
    await executive.openView('commercial_executive');
    const shown = (await executive.tableAfter('Top 5 Projects by Sales Value (YTD)')).map(r => r['Project / Phase']);
    await spa.open();
    const projects = await spa.filterOptions('All projects');
    note('values', `dashboard: ${shown.join(', ')} | CRM projects: ${projects.join(', ')}`);
    expect(shown.filter(p => !projects.includes(p)), 'Projects that are not in the CRM').toEqual([]);
  });

  test(...WB.key('page:monthly-kpis'), async ({ executive }) => {
    await executive.openView('monthly_sales_marketing');
    const t: Record<string, string> = {};
    for (const k of MONTHLY_TILES) { t[k] = await executive.tile(k); expect.soft(t[k], k).toMatch(/\d/); }
    note('tiles', JSON.stringify(t));
  });

  test(...WB.key('page:monthly-live-data'), async ({ executive, inventory }) => {
    await executive.openView('monthly_sales_marketing');
    const t = { total: parseNum(await executive.tile('Total Inventory')), avail: parseNum(await executive.tile('Units Available')), reserved: parseNum(await executive.tile('Units Reserved')) };
    await inventory.open();
    const i = await inventory.kpis(['Total units', 'Available', 'Reserved']);
    note('values', `Monthly view ${JSON.stringify(t)} | Inventory Reports ${JSON.stringify(i)}`);
    expect.soft(t.total, 'Total Inventory = Total units').toBe(i['Total units']);
    expect.soft(t.avail, 'Units Available = Available').toBe(i['Available']);
    expect.soft(t.reserved, 'Units Reserved = Reserved').toBe(i['Reserved']);
  });

  test(...WB.key('page:monthly-mom'), async ({ executive }) => {
    await executive.openView('monthly_sales_marketing');
    const table = at(executive.page, XP.tableWithHeader('MoM %')).first();
    await expect(table).toBeVisible();
    const headers = (await table.locator('thead th').allInnerTexts()).map(h => h.trim());
    const rows = await table.locator('tbody tr').evaluateAll(trs => trs.map(tr => [...tr.children].map(td => (td as HTMLElement).innerText.trim())));
    const bad: string[] = [];
    for (const r of rows) {
      const [cur, prev, mom] = [num(r[1]), num(r[2]), r[3]];
      if (!prev || !/\d/.test(mom)) continue;
      // rates change in percentage points ("0.8pp"), the rest in % of last month
      const pp = /pp\s*$/i.test(mom);
      const expected = pp ? cur - prev : ((cur - prev) / prev) * 100;
      const tol = 0.15 + (pp ? shownTolerance(r[1]) + shownTolerance(r[2]) : (100 * (shownTolerance(r[1]) + shownTolerance(r[2]))) / prev);
      const shown = Math.abs(Number(mom.replace(/,/g, '').match(/\d+(\.\d+)?/)?.[0] ?? NaN)) * (/▼|-/.test(mom) ? -1 : 1);
      if (Number.isNaN(shown)) { bad.push(`${r[0]}: MoM "${mom}" is not a number`); continue; }
      if (Math.abs(shown - expected) > tol) bad.push(`${r[0]}: ${mom} vs ${expected.toFixed(1)}${pp ? 'pp' : '%'} (${r[1]} vs ${r[2]})`);
    }
    note('table', headers.join(' | '));
    expect(bad).toEqual([]);
  });
});

test.describe('Executive Reports · Non-functional', () => {
  test(...WB.key('page:responsive'), async ({ executive }) => {
    await responsive(executive, Object.keys(DASHBOARD_VIEWS) as DashboardView[]);
  });

  test(...WB.key('page:actions'), async ({ executive }) => {
    await executive.openView('commercial_executive');
    // shown and usable, but never clicked: they may change data
    for (const a of ['Data Movement', 'AI Insights', 'Edit Targets']) await expect.soft(executive.actionButton(a), a).toBeEnabled();
  });

  test(...WB.skipped(WB.id('page:actions-manual')!, 'Manual: Data Movement and Edit Targets change data and AI Insights calls an AI service; run with approval'));

  test(...WB.key('page:performance'), async ({ executive, page }) => {
    let t = Date.now();
    await page.goto('/');
    await executive.tile('Total Leads');
    const first = Date.now() - t;
    t = Date.now();
    await executive.setView('operations');
    await executive.waitForKpis();
    const ops = Date.now() - t;
    note('timings', `default view ${first} ms | operations ${ops} ms (budget ${BUDGET} ms)`);
    expect.soft(first, 'Default view within budget').toBeLessThanOrEqual(BUDGET);
    expect.soft(ops, 'Operations within budget').toBeLessThanOrEqual(BUDGET);
  });

  test(...WB.key('page:api-error'), async ({ executive, page }) => {
    await page.route('**/api/v1/dashboard/summary**', r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Internal Server Error"}' }));
    await page.goto('/');
    // the view may still switch to Executive Operations, or the whole dashboard may show the error
    if (await executive.viewSelect.isVisible({ timeout: 10_000 }).catch(() => false)) await executive.viewSelect.selectOption('operations').catch(() => {});
    await expect(page.locator('main').getByText(ERROR_TEXT).first(), 'Error message').toBeVisible({ timeout: 20_000 });
    note('screen', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 200));
    expect.soft(await executive.crashed(), 'No crash screen').toBeFalsy();
    await executive.expectNoBrokenValues();
  });
});

test.describe('Executive Reports · Clickable Map and observations', () => {
  test(...WB.mapKey('map:view'), async ({ executive, page }) => {
    await executive.openView('commercial_executive');
    for (const v of ['operations', 'audience'] as const) {
      const req = page.waitForRequest(r => r.url().includes('/dashboard/summary') && r.url().includes(`view=${v}`), { timeout: 15_000 }).catch(() => null);
      await executive.setView(v);
      expect.soft(await req, `${v}: /dashboard/summary?view=${v}`).not.toBeNull();
    }
  });

  test(...WB.mapKey('map:report-period'), async ({ executive, page }) => {
    await executive.openView('monthly_sales_marketing');
    const pick = (await executive.reportPeriodSelect.locator('option').evaluateAll(os => os.map(o => (o as HTMLOptionElement).value)))[2];
    const req = page.waitForRequest(r => r.url().includes(`/analytics/snapshots/${pick}`), { timeout: 15_000 }).catch(() => null);
    await executive.reportPeriodSelect.selectOption(pick);
    expect(await req).not.toBeNull();
  });

  test(...WB.mapKey('map:period'), async ({ executive, page }) => {
    await executive.open();
    const req = page.waitForRequest(r => r.url().includes('/dashboard/summary') && r.url().includes('period=this_quarter'), { timeout: 15_000 }).catch(() => null);
    await executive.periodSelect.selectOption('this_quarter');
    expect(await req).not.toBeNull();
  });

  test(...WB.mapKey('map:kpi-links'), async ({ executive }) => {
    await executive.open();
    for (const k of executive.kpiLabels) expect.soft(await executive.kpiCard(k).getAttribute('href'), `${k} is a link`).toBeTruthy();
  });

  test(...WB.mapKey('map:com-cells'), async ({ executive, spa }) => {
    await executive.openView('commercial_executive');
    for (const target of [at(executive.page, XP.dashboardLabel('Total Leads')).first(), at(executive.page, XP.dashboardHeading('Sales Funnel (This Month)')).first(),
      at(executive.page, XP.dashboardTableAfter('Sales Performance (YTD)')).locator('tbody td').first()]) {
      // the dashboard is not a report module; a plain URL / dialog check is enough
      const url = executive.page.url();
      await target.click();
      await executive.page.waitForTimeout(600);
      expect.soft(executive.page.url(), 'No navigation').toBe(url);
    }
    void spa; void expectNothingHappens;
  });

  test(...WB.mapKey('map:actions'), async ({ executive }) => {
    await executive.openView('commercial_executive');
    for (const a of ['Data Movement', 'AI Insights', 'Edit Targets']) await expect.soft(executive.actionButton(a), `${a} shown (not clicked)`).toBeVisible();
  });

  test(...WB.obs('OBS-01'), async ({ executive, spa, reservations, collections }) => {
    await commercialVsLive(executive, spa, reservations, collections);
  });

  test(...WB.obs('OBS-02'), async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle').catch(() => {});
    note('finding', `Default view: ${await at(page, XP.dashboardView).locator('option:checked').innerText()}`);
  });

  test(...WB.obs('OBS-03'), async ({ executive }) => {
    await executive.open();
    const soon = (await executive.page.locator('main').innerText()).split('\n').filter(l => /coming soon/i.test(l));
    note('finding', soon.join(' | ') || 'No "coming soon" placeholders');
  });

  test(...WB.obs('OBS-04'), async ({ executive }) => {
    await responsive(executive, ['commercial_executive']);
  });

  test(...WB.obs('OBS-05'), async ({ executive }) => {
    await executive.openView('commercial_executive');
    const shown: string[] = [];
    for (const a of ['Data Movement', 'AI Insights', 'Edit Targets']) if (await executive.actionButton(a).isVisible()) shown.push(a);
    note('finding', `Actions shown to the CRM Administrator: ${shown.join(', ')} (other roles not checked: needs their logins)`);
  });
});
