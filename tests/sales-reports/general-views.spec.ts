/** Sales Reports workbook — General (SR-001…011) and Views (SR-012…016). */
import { test, expect, note } from '../pages/fixtures';
import { ROUTES } from '../locators';
import * as check from '../modules/checks';
import { SalesReportsPage, SALES_FILTERS, SALES_PERIOD_LABEL, MODULE_TABS, Row } from '../pages/SalesReportsPage';
import { sr, srSkipped } from './catalog';
import { BAD } from './shared';

const INTRO = 'Open pipeline by stage and salesperson, weighted forecast, win rate and opportunities past their close date. Values in base currency.';
const CAPTIONS: Record<string, string> = {
  'Open opportunities': '', 'Pipeline value': 'Budget of open opportunities', 'Weighted pipeline': 'Value × probability',
  'Won in period': 'SPA signed in the period', 'Won value': '', 'Win rate': 'Won ÷ (won + lost) in the period',
  'Average days to win': '', 'Past expected close': '',
};
const NOTES: Record<string, string> = {
  'Open Pipeline by Stage': 'Open opportunities today. The period does not apply.',
  'Salesperson Pipeline': 'Open figures are as of today; won and lost are for the selected period.',
  'Open Opportunities': 'Sorted by expected close date.',
};
/** KPIs that are counts or amounts (a narrower view can only lower them); rates and averages can go either way. */
const ADDITIVE = ['Open opportunities', 'Pipeline value', 'Weighted pipeline', 'Won in period', 'Won value', 'Past expected close'];

async function additiveKpis(sales: SalesReportsPage) {
  const out: Record<string, number> = {};
  for (const k of ADDITIVE) out[k] = await sales.kpi(k);
  return out;
}
const names = (rows: Row[]) => rows.map(r => r['Salesperson']);

test.describe('Sales Reports · General', () => {
  test(...sr('SR-001'), async ({ hub, sales, page }) => {
    await check.opensFromHub(hub, sales);
    await expect(page).toHaveURL(new RegExp(`${ROUTES.reports.sales}(\\?.*)?$`));
    await expect.soft(sales.tab('Sales'), 'Sales tab active').toHaveClass(/is-active/);
    await expect.soft(page.locator('main a[href="/reports-analytics"]').first(), 'Breadcrumb').toHaveText(/reports & analytics/i);
  });

  test(...sr('SR-002'), async ({ sales }) => {
    sales.watchErrors();
    await sales.open();
    await expect(sales.heading()).toBeVisible();
    for (const k of sales.kpiLabels) expect.soft(await sales.kpiText(k), k).not.toMatch(BAD);
    for (const t of sales.tableHeadings) await expect.soft(sales.table(t).root, `Table ${t}`).toBeVisible();
    await sales.expectNoBrokenValues();
    sales.expectNoErrors();
  });

  test(...sr('SR-003'), async ({ sales }) => {
    await sales.open();
    await sales.backToHub();
  });

  test(...sr('SR-004'), async ({ sales }) => {
    await sales.open();
    expect.soft(await sales.moduleTabs(), 'Tab bar').toEqual(MODULE_TABS);
    await expect(sales.tab('Sales'), 'Sales highlighted').toHaveClass(/is-active/);
  });

  test(...sr('SR-005'), async ({ sales, inventory, page }) => {
    await sales.open();
    await sales.tab('Inventory').click();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.reports.inventory}(\\?.*)?$`));
    await expect.soft(inventory.tab('Inventory'), 'Inventory highlighted').toHaveClass(/is-active/);
    await inventory.tab('Sales').click();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.reports.sales}(\\?.*)?$`));
    await expect.soft(sales.tab('Sales'), 'Sales highlighted again').toHaveClass(/is-active/);
    expect.soft(await sales.kpiText(sales.mainKpi)).not.toMatch(BAD);
  });

  test(...sr('SR-006'), async ({ sales }) => {
    await sales.open();
    await expect.soft(sales.intro, 'Intro text').toHaveText(INTRO);
    expect.soft(await sales.filterLabels(), 'Filter bar').toEqual([SALES_PERIOD_LABEL, ...Object.keys(SALES_FILTERS)]);
    await expect.soft(sales.resetButton, 'Reset filters').toBeVisible();
    expect.soft(await sales.kpiTitles(), 'KPI cards in order').toEqual(sales.kpiLabels);
    expect.soft(await sales.panelHeadings(), 'Panels in order').toEqual(sales.tableHeadings);
    for (const t of sales.tableHeadings) await expect.soft(sales.table(t).exportButton, `${t} › Export`).toBeVisible();
  });

  test(...sr('SR-007'), async ({ sales }) => {
    await sales.open();
    for (const [label, caption] of Object.entries(CAPTIONS)) expect.soft(await sales.kpiCaption(label), `${label} caption`).toBe(caption);
  });

  test(...sr('SR-008'), async ({ sales }) => {
    await sales.open();
    for (const [heading, text] of Object.entries(NOTES)) expect.soft(await sales.panelNote(heading), `${heading} note`).toBe(text);
  });

  test(...sr('SR-009'), async ({ sales, page }) => {
    for (const round of ['first load', 'after reload']) {
      if (round === 'first load') await sales.open(); else { await page.reload(); await page.waitForLoadState('networkidle').catch(() => {}); }
      const shown: string[] = [];
      for (const k of sales.kpiLabels) {
        const t = await sales.kpiText(k); // waits until the placeholder is replaced
        shown.push(`${k}: ${t}`);
        expect.soft(t, `${round} › ${k}`).not.toMatch(BAD);
      }
      note(round, shown.join(' | '));
      await sales.expectNoBrokenValues(round);
    }
  });

  test(...sr('SR-010'), async ({ browser }) => {
    const baseURL = test.info().project.use.baseURL;
    const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto(ROUTES.reports.sales);
    await page.waitForLoadState('networkidle').catch(() => {});
    note('signed out', page.url());
    await expect.soft(page.locator('input[type="password"]').first(), 'Login form shown').toBeVisible({ timeout: 15_000 });
    expect.soft(await new SalesReportsPage(page).kpiValue('Open opportunities').count(), 'No report data before login').toBe(0);
    await context.close();
  });

  test(...srSkipped('SR-011', 'Needs a user without the Reports & Analytics permission (set one up and run manually)'));
});

test.describe('Sales Reports · Views', () => {
  test(...sr('SR-012'), async ({ sales, page }) => {
    await sales.open();
    expect.soft((await page.locator('main button.crm-dashboard-view-segment-button').allInnerTexts()).map(s => s.trim())).toEqual(['All', 'You and your team', 'Mine']);
    await expect(sales.viewButton('All'), 'All active for the administrator').toHaveClass(/is-active/);
  });

  test(...sr('SR-013'), async ({ sales, page }) => {
    await sales.openWith('last_12_months');
    const all = await additiveKpis(sales);
    const allNames = names(await sales.salespersonRows());
    const req = page.waitForRequest(r => r.url().includes('view=team'), { timeout: 10_000 });
    await sales.setView('You and your team');
    await req;
    const team = await additiveKpis(sales);
    note('KPIs', `All ${JSON.stringify(all)} | Team ${JSON.stringify(team)}`);
    for (const k of ADDITIVE) expect.soft(team[k], `${k}: team ≤ All`).toBeLessThanOrEqual(all[k]);
    const extra = names(await sales.salespersonRows()).filter(n => !allNames.includes(n));
    expect.soft(extra, 'Team salespeople all appear in the All view').toEqual([]);
  });

  test(...sr('SR-014'), async ({ sales }) => {
    await sales.openWith('last_12_months');
    const me = await sales.userName();
    await sales.setView('You and your team');
    const team = await additiveKpis(sales);
    await sales.setView('Mine');
    const mine = await additiveKpis(sales);
    note('KPIs', `Team ${JSON.stringify(team)} | Mine ${JSON.stringify(mine)} (user ${me})`);
    for (const k of ADDITIVE) expect.soft(mine[k], `${k}: Mine ≤ team`).toBeLessThanOrEqual(team[k]);
    const people = [...new Set(names(await sales.salespersonRows()))];
    expect.soft(people.filter(n => n !== me), `Salesperson Pipeline only has ${me}`).toEqual([]);
    const others = (await sales.opportunityRows()).filter(r => r['Salesperson'] !== me).map(r => r['Opportunity']);
    expect.soft(others, `Every open opportunity belongs to ${me}`).toEqual([]);
  });

  test(...sr('SR-015'), async ({ sales }) => {
    await sales.openWith('last_12_months');
    const before = await sales.snapshot();
    await sales.setView('Mine');
    await sales.setView('All');
    const after = await sales.snapshot();
    expect.soft(after.kpis, 'KPIs back to All').toEqual(before.kpis);
    expect.soft(after.salesperson, 'Salesperson Pipeline back to All').toEqual(before.salesperson);
    expect.soft(after.opportunities.length, 'Open Opportunities rows back to All').toBe(before.opportunities.length);
  });

  test(...srSkipped('SR-016', 'Needs Sales Manager and Salesperson accounts (log in as each and run manually)'));
});

