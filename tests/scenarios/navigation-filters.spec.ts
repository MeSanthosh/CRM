/** Workbook areas: Report Module Navigation (RA-019…031), Report Filters and Views (RA-044…050). */
import { test, expect, Page } from '../auth';
import { kpi, open, act, listCount, tableRows, tableColumn } from '../helpers';
import { ROUTES, HUB_MODULES, XP, at } from '../locators';
import {
  scenario, note, periodSelect, setPeriod, openReport, setFilter, filterSelect, filterOptions,
  reportResponse, expectClean,
} from './support';

const R = ROUTES.reports;

test.describe('Scenarios · Report Module Navigation', () => {
  // RA-019 … RA-029 follow the order of the module cards on the hub.
  HUB_MODULES.forEach((m, i) => {
    const id = `RA-${String(19 + i).padStart(3, '0')}`;
    test(...scenario(id, `Clicking the "${m.name}" card opens ${m.href} and the page loads without errors`), async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      await open(page, ROUTES.hub);
      await at(page, XP.moduleCard(m.href)).click();
      await expect(page).toHaveURL(new RegExp(`${m.href.replace(/\//g, '\\/')}(\\?.*)?$`));
      await page.waitForLoadState('networkidle').catch(() => {});
      if (m.href === ROUTES.dashboard) await expect(page.locator('main')).toContainText('Active Leads');
      else await expect(page.getByRole('heading', { name: m.name, exact: true })).toBeVisible();
      await expectClean(page, m.name);
      expect.soft(errors, 'JavaScript errors').toEqual([]);
    });
  });

  test(...scenario('RA-030', 'Every module card links to its own module page and is named after it'), async ({ page }) => {
    await open(page, ROUTES.hub);
    const cards = page.locator('a.crm-module-hub-card');
    expect(await cards.count()).toBe(HUB_MODULES.length);
    for (const m of HUB_MODULES) {
      const card = at(page, XP.moduleCard(m.href));
      await expect.soft(card, `${m.name} card`).toHaveCount(1);
      await expect.soft(card, `${m.name} card text`).toContainText(m.name);
    }
  });

  test(...scenario('RA-031', 'From a module, the "Reports & Analytics" breadcrumb and the browser Back button both return to the hub'), async ({ page }) => {
    await open(page, ROUTES.hub);
    await at(page, XP.moduleCard(R.sales)).click();
    await expect(page).toHaveURL(/\/reports\/sales/);
    await at(page, XP.reportHubLink).first().click();
    await expect(page, 'Breadcrumb back to hub').toHaveURL(/\/reports-analytics$/);
    await at(page, XP.moduleCard(R.inventory)).click();
    await expect(page).toHaveURL(/\/reports\/inventory/);
    await page.goBack();
    await expect(page, 'Browser Back to hub').toHaveURL(/\/reports-analytics$/);
    await expect(page.getByRole('heading', { name: 'Reports & Analytics' })).toBeVisible();
  });
});

/** Reads a set of Sales KPIs. */
async function salesKpis(page: Page) {
  return { open: await kpi(page, 'Open opportunities'), pipeline: await kpi(page, 'Pipeline value'), won: await kpi(page, 'Won in period') };
}

async function setView(page: Page, name: 'All' | 'You and your team' | 'Mine') {
  await act(page, () => at(page, XP.viewSegment(name)).click());
  await expect(at(page, XP.viewSegment(name))).toHaveClass(/is-active/);
}

test.describe('Scenarios · Report Filters and Views', () => {
  test(...scenario('RA-044', 'Leads campaign filter: "Campaign leads only" ≤ all leads, and the per-campaign counts add up to "Campaign leads only"'), async ({ page }) => {
    await open(page, ROUTES.leads);
    const all = await listCount(page);
    const campaign = at(page, XP.leadsCampaignFilter);
    await act(page, () => campaign.selectOption('any'));
    const any = await listCount(page);
    const names = (await campaign.locator('option').allInnerTexts()).map(o => o.trim()).slice(2);
    const per: string[] = [];
    let total = 0;
    for (const name of names) {
      await act(page, () => campaign.selectOption({ label: name }));
      const n = await listCount(page);
      per.push(`${name}: ${n}`);
      total += n;
      expect.soft(n, `${name} ≤ campaign leads`).toBeLessThanOrEqual(any);
    }
    note('values', `All ${all} | Campaign leads only ${any} | ${per.join(', ')}`);
    expect.soft(any, 'Campaign leads ≤ all leads').toBeLessThanOrEqual(all);
    expect.soft(total, 'Sum of campaigns = Campaign leads only').toBe(any);
  });

  test(...scenario('RA-045', '"You and your team" view: KPIs reload and are ≤ the "All" view'), async ({ page }) => {
    await openReport(page, R.sales);
    const all = await salesKpis(page);
    await setView(page, 'You and your team');
    const team = await salesKpis(page);
    note('values', `All ${JSON.stringify(all)} | Team ${JSON.stringify(team)}`);
    for (const k of Object.keys(all) as (keyof typeof all)[]) expect.soft(team[k], `Team ${k} ≤ All`).toBeLessThanOrEqual(all[k]);
    await expectClean(page);
  });

  test(...scenario('RA-046', '"Mine" view: KPIs reload and are ≤ the "You and your team" view'), async ({ page }) => {
    await openReport(page, R.sales);
    await setView(page, 'You and your team');
    const team = await salesKpis(page);
    await setView(page, 'Mine');
    const mine = await salesKpis(page);
    note('values', `Team ${JSON.stringify(team)} | Mine ${JSON.stringify(mine)}`);
    for (const k of Object.keys(team) as (keyof typeof team)[]) expect.soft(mine[k], `Mine ${k} ≤ Team`).toBeLessThanOrEqual(team[k]);
    await expectClean(page);
  });

  test(...scenario('RA-047', 'Each report tab opens its module (URL and heading change) without errors'), async ({ page }) => {
    const tabs: [string, string, string][] = [
      ['Inventory', R.inventory, 'Inventory Reports'], ['Customers', R.customers, 'Customer Reports'],
      ['Brokers', R.brokers, 'Broker Reports'], ['Marketing', R.marketing, 'Marketing Reports'],
      ['Reservations', R.reservations, 'Reservation Reports'], ['SPA', R.spa, 'SPA Reports'],
      ['Collections', R.collections, 'Collection Reports'], ['Exceptions', R.exceptions, 'Exception Reports'],
      ['Sales', R.sales, 'Sales Reports'],
    ];
    await open(page, R.sales);
    for (const [tab, path, heading] of tabs) {
      await act(page, () => at(page, XP.reportTab(tab)).click());
      await expect.soft(page, `${tab} tab URL`).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}(\\?.*)?$`));
      await expect.soft(page.getByRole('heading', { name: heading, exact: true }), `${tab} heading`).toBeVisible();
      await expect.soft(at(page, XP.reportTab(tab)), `${tab} tab active`).toHaveClass(/is-active/);
    }
  });

  test(...scenario('RA-048', 'Project + Salesperson together narrow the results: KPI ≤ each single filter, table rows = KPI, rows show only that salesperson'), async ({ page }) => {
    await openReport(page, R.sales);
    const all = await kpi(page, 'Open opportunities');
    const project = (await filterOptions(page, 'All projects'))[0];
    await setFilter(page, 'All projects', project);
    const byProject = await kpi(page, 'Open opportunities');
    // the salesperson with the most open opportunities, so the check isn't trivially 0
    const people = await tableColumn(page, 'Salesperson Pipeline', 'Salesperson');
    const open_ = await tableColumn(page, 'Salesperson Pipeline', 'Open');
    const person = people[open_.map(Number).indexOf(Math.max(...open_.map(Number)))] ?? (await filterOptions(page, 'All salespeople'))[0];
    await setFilter(page, 'All salespeople', person);
    const both = await kpi(page, 'Open opportunities');
    note('values', `All ${all} | ${project} ${byProject} | + ${person} ${both}`);
    expect.soft(byProject, 'Project ≤ All').toBeLessThanOrEqual(all);
    expect.soft(both, 'Project + Salesperson ≤ Project').toBeLessThanOrEqual(byProject);
    expect.soft(await tableRows(page, 'Open Opportunities'), 'Open Opportunities rows = KPI').toBe(both);
    const owners = new Set(await tableColumn(page, 'Open Opportunities', 'Salesperson'));
    expect.soft([...owners].filter(o => o !== person), `Rows for other salespeople than ${person}`).toEqual([]);
  });

  test(...scenario('RA-049', '"Reset filters" puts period, project and salesperson back to their defaults and restores the original values'), async ({ page }) => {
    await open(page, R.sales);
    const defaultPeriod = await periodSelect(page).inputValue();
    const before = await salesKpis(page);
    await setPeriod(page, defaultPeriod === 'last_month' ? 'this_month' : 'last_month');
    await setFilter(page, 'All projects', (await filterOptions(page, 'All projects'))[0]);
    await act(page, () => at(page, XP.reportResetFilters).click());
    expect.soft(await periodSelect(page).inputValue(), 'Period after reset').toBe(defaultPeriod);
    expect.soft(await filterSelect(page, 'All projects').inputValue(), 'Project after reset').toBe('');
    expect.soft(await filterSelect(page, 'All salespeople').inputValue(), 'Salesperson after reset').toBe('');
    const after = await salesKpis(page);
    expect.soft(after, 'KPIs after reset equal the original values').toEqual(before);
  });

  test(...scenario('RA-050', 'The selected period stays selected when switching to another report tab'), async ({ page }) => {
    await openReport(page, R.sales, 'last_month');
    const resp = reportResponse(page, u => u.includes('/business/inventory'));
    await at(page, XP.reportTab('Inventory')).click();
    const url = (await resp).url();
    await page.waitForLoadState('networkidle').catch(() => {});
    note('request', url);
    expect.soft(await periodSelect(page).inputValue(), 'Period on Inventory after switching tab').toBe('last_month');
    expect.soft(url, 'Inventory data requested for last_month').toContain('period=last_month');
  });
});
