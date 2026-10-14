/** Executive Reports card → Executive Dashboard (/). Run alone: npm run test:executive-reports */
import { test, expect, expected, note } from '../pages/fixtures';
import { near } from '../helpers';
import { DASHBOARD_PERIODS } from '../pages/ExecutiveReportsPage';
import * as check from './checks';

const BAD = /NaN|undefined|Infinity|^\s*$/;

test.describe('Executive Reports', { tag: ['@pages', '@executive-reports'] }, () => {
  test('EXE-01 Opens from its card on the hub', expected(check.EXPECT.opensFromHub), ({ hub, executive }) =>
    check.opensFromHub(hub, executive, executive.pageTitle));

  test('EXE-02 Every KPI shows a valid value', expected('All 10 KPI cards show a valid, non-negative value'), async ({ executive }) => {
    await executive.open();
    const shown: string[] = [];
    for (const label of executive.kpiLabels) {
      const text = await executive.kpiText(label);
      shown.push(`${label}: ${text}`);
      expect.soft(text, label).not.toMatch(BAD);
      expect.soft(await executive.kpi(label), `${label} ≥ 0`).toBeGreaterThanOrEqual(0);
    }
    note('KPIs', shown.join(' | '));
  });

  test('EXE-03 All panels render without errors', expected('Sales Pipeline, Inventory Overview, Sales Trend, Top Performing Brokers, Unit Holds, Collections Summary and Priority Alerts are shown; no errors'), async ({ executive }) => {
    executive.watchErrors();
    await executive.open();
    for (const p of executive.panels) await expect.soft(executive.panel(p), `Panel "${p}"`).toBeVisible();
    await executive.expectNoBrokenValues();
    executive.expectNoErrors();
  });

  test('EXE-04 Every period reloads the dashboard', expected('Period lists This month, Last 30 days, This quarter, Year to date; each reloads the KPIs with valid values'), async ({ executive }) => {
    await executive.open();
    expect.soft(await executive.periodOptions(), 'Period options').toEqual([...DASHBOARD_PERIODS]);
    for (const period of [...DASHBOARD_PERIODS.slice(1), DASHBOARD_PERIODS[0]]) {
      await executive.setPeriod(period);
      for (const label of executive.kpiLabels) expect.soft(await executive.kpiText(label), `${period}: ${label}`).not.toMatch(BAD);
    }
  });

  test('EXE-05 Lead Dashboard view', expected('Switching Dashboard View to "Lead Dashboard" shows the lead panels; switching back shows the Executive Dashboard'), async ({ executive, page }) => {
    await executive.open();
    await executive.setView('audience');
    await expect.soft(page).toHaveURL(/view=audience/);
    for (const p of executive.leadPanels) await expect.soft(page.getByRole('heading', { name: p }).first(), `Lead panel "${p}"`).toBeVisible();
    await executive.expectNoBrokenValues('Lead Dashboard');
    await executive.setView('operations');
    await executive.expectOnDashboard();
  });

  test('EXE-06 Collections Summary agrees with the KPI cards', expected('Collections Summary "Amount Received" = Collections Received and "Outstanding" = Outstanding Amount'), async ({ executive }) => {
    await executive.open();
    const summary = await executive.collectionsSummary();
    const received = await executive.kpi('Collections Received');
    const outstanding = await executive.kpi('Outstanding Amount');
    note('values', `Summary ${JSON.stringify(summary)} | KPIs received ${received}, outstanding ${outstanding}`);
    expect.soft(near(summary.received, received, 0.005), 'Amount Received').toBeTruthy();
    expect.soft(near(summary.outstanding, outstanding, 0.005), 'Outstanding').toBeTruthy();
  });

  test('EXE-07 KPIs agree with the hub snapshot', expected('Active Leads, Open Opportunities, Units Available, Reserved Units and Sales Value (SPAs) equal the hub snapshot (both This month)'), async ({ executive, hub }) => {
    const pairs: [string, string][] = [
      ['Active Leads', 'Active Leads'], ['Open Opportunities', 'Open Opportunities'], ['Units Available', 'Units Available'],
      ['Reserved Units', 'Units Reserved'], ['Sales Value (SPAs)', 'SPA Value Signed (This Month)'],
    ];
    await executive.open();
    const dash = await executive.kpis(pairs.map(p => p[0]));
    await hub.open();
    for (const [d, h] of pairs) {
      const v = await hub.kpi(h);
      expect.soft(near(dash[d], v, 0.005, 0), `${d} ${dash[d]} vs hub ${h} ${v}`).toBeTruthy();
    }
  });

  test('EXE-08 KPI cards open their records', expected('Each KPI card is a link that opens a CRM page (not the login page, no crash)'), async ({ executive, page }) => {
    test.setTimeout(240_000); // opens 10 pages
    const opened: string[] = [];
    for (const label of executive.kpiLabels) {
      await executive.open();
      await executive.waitForKpis();
      const href = await executive.openKpi(label);
      opened.push(`${label} → ${href}`);
      expect.soft(href, `${label} has a link`).toBeTruthy();
      await expect.soft(page, `${label} does not log out`).not.toHaveURL(/\/login/);
      expect.soft(await executive.crashed(), `${label} page crashed`).toBeFalsy();
    }
    note('links', opened.join(' | '));
  });
});
