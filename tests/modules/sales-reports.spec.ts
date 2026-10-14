/** Sales Reports card → /reports/sales. Run alone: npm run test:sales-reports */
import { test, expect, expected, note } from '../pages/fixtures';
import { num, expectNear, sum } from '../helpers';
import * as check from './checks';

const today = new Date(new Date().toDateString());

test.describe('Sales Reports', { tag: ['@pages', '@sales-reports'] }, () => {
  test('SAL-01 Opens from its card on the hub', expected(check.EXPECT.opensFromHub), ({ hub, sales }) => check.opensFromHub(hub, sales));
  test('SAL-02 Every KPI shows a valid value', expected(check.EXPECT.kpisValid), ({ sales }) => check.kpisValid(sales));
  test('SAL-03 Every table renders without errors', expected(check.EXPECT.tablesRender), ({ sales }) => check.tablesRender(sales));
  test('SAL-04 Every period reloads the report', expected(check.EXPECT.periodsReload), ({ sales }) => check.periodsReload(sales));
  test('SAL-05 Opens on "This month"', expected(check.EXPECT.opensOnThisMonth), ({ sales }) => check.opensOnThisMonth(sales));
  test('SAL-06 Custom date range', expected(check.EXPECT.customRange), ({ sales }) => check.customRange(sales));
  test('SAL-07 Filters narrow the results', expected(check.EXPECT.filtersNarrow), ({ sales }) => check.filtersNarrow(sales));
  test('SAL-08 Views narrow the results', expected(check.EXPECT.viewsNarrow), ({ sales }) => check.viewsNarrow(sales));
  test('SAL-09 Reset filters', expected(check.EXPECT.resetRestores), ({ sales }) => check.resetRestores(sales));
  test('SAL-10 Panel exports match the tables', expected(check.EXPECT.exportsMatchTables), ({ sales }) => check.exportsMatchTables(sales));
  test('SAL-11 Tab bar and breadcrumb', expected(check.EXPECT.navigation), ({ sales, inventory }) => check.navigation(sales, inventory));

  test('SAL-12 Open Pipeline by Stage adds up to the KPIs', expected('Stage table: Opportunities = Open opportunities, Value = Pipeline value, Weighted = Weighted pipeline, shares = 100%'), async ({ sales }) => {
    await sales.openWith();
    await check.kpiEqualsColumn(sales, 'Open opportunities', sales.stageTable, 'Opportunities');
    await check.kpiEqualsColumn(sales, 'Pipeline value', sales.stageTable, 'Value (USD)', 0.01);
    await check.kpiEqualsColumn(sales, 'Weighted pipeline', sales.stageTable, 'Weighted (USD)', 0.01);
    expectNear(await sales.stageTable.sum('Share of Value %'), 100, 'Shares add up to 100%', 0, 0.5);
    expect.soft(await sales.kpi('Weighted pipeline'), 'Weighted ≤ Pipeline').toBeLessThanOrEqual(await sales.kpi('Pipeline value'));
  });

  test('SAL-13 Salesperson Pipeline adds up and Win rate is correct', expected('Salesperson table totals = Open opportunities, Pipeline, Won in period, Won value; Win rate = Won ÷ (Won + Lost)'), async ({ sales }) => {
    await sales.openWith();
    const t = sales.salespersonTable;
    await check.kpiEqualsColumn(sales, 'Open opportunities', t, 'Open');
    await check.kpiEqualsColumn(sales, 'Pipeline value', t, 'Pipeline (USD)', 0.01);
    await check.kpiEqualsColumn(sales, 'Won in period', t, 'Won');
    await check.kpiEqualsColumn(sales, 'Won value', t, 'Won Value (USD)', 0.01);
    const [won, lost] = [await t.sum('Won'), await t.sum('Lost')];
    if (won + lost) expectNear(await sales.kpi('Win rate'), (won / (won + lost)) * 100, 'Win rate', 0, 0.1);
  });

  test('SAL-14 Open Opportunities list', expected('Rows = Open opportunities; each row has a reference, customer, positive value, 0–100% probability; rows past their close date = "Past expected close"'), async ({ sales }) => {
    await sales.openWith();
    const rows = await sales.opportunitiesTable.rows();
    expect.soft(rows.length, 'Rows = Open opportunities').toBe(await sales.kpi('Open opportunities'));
    const bad: string[] = [];
    for (const o of rows) {
      if (!/^OPP-/.test(o['Opportunity'])) bad.push(`reference "${o['Opportunity']}"`);
      if (!o['Customer']) bad.push(`${o['Opportunity']}: no customer`);
      if (!(num(o['Value (USD)']) > 0)) bad.push(`${o['Opportunity']}: value "${o['Value (USD)']}"`);
      const p = num(o['Probability %']);
      if (p < 0 || p > 100) bad.push(`${o['Opportunity']}: probability ${p}`);
    }
    expect.soft(bad, 'Invalid rows').toEqual([]);
    const past = rows.filter(o => !/^[—–-]$/.test(o['Expected Close']) && new Date(o['Expected Close']) < today).length;
    expect.soft(past, 'Rows past close date = Past expected close').toBe(await sales.kpi('Past expected close'));
  });

  test('SAL-15 Stage export has the right totals', expected('The Open Pipeline by Stage export (rows and its Total row) adds up to the KPIs'), async ({ sales }) => {
    await sales.openWith();
    const sheet = await sales.stageTable.export();
    const col = (n: string) => sum(sheet.rows.map(r => Number(r[n] ?? 0)));
    const [opps, value] = [await sales.kpi('Open opportunities'), await sales.kpi('Pipeline value')];
    expect.soft(col('Opportunities'), 'Rows: Opportunities').toBe(opps);
    expectNear(col('Value (USD)'), value, 'Rows: Value');
    expect.soft(sheet.total, 'Export has a Total row').toBeTruthy();
    expect.soft(Number(sheet.total?.['Opportunities']), 'Total row: Opportunities').toBe(opps);
  });

  test('SAL-16 An opportunity opens from the list', expected('Clicking a reference opens the Opportunities page showing that reference and customer'), async ({ sales, page }) => {
    await sales.openWith();
    const first = (await sales.opportunitiesTable.rows())[0];
    note('record', JSON.stringify(first));
    await sales.openOpportunity(first['Opportunity']);
    await expect(page).toHaveURL(/\/opportunities/);
    await expect.soft(page.locator('main'), 'Shows the reference').toContainText(first['Opportunity']);
    await expect.soft(page.locator('main'), 'Shows the customer').toContainText(first['Customer']);
  });
});
