/** Collection Reports card → /reports/collections. Run alone: npm run test:collection-reports */
import { test, expect, expected, note } from '../pages/fixtures';
import { expectNear } from '../helpers';
import * as check from './checks';

test.describe('Collection Reports', { tag: ['@pages', '@collection-reports'] }, () => {
  test('COL-01 Opens from its card on the hub', expected(check.EXPECT.opensFromHub), ({ hub, collections }) => check.opensFromHub(hub, collections));
  test('COL-02 Every KPI shows a valid value', expected(check.EXPECT.kpisValid), ({ collections }) => check.kpisValid(collections));
  test('COL-03 Every table renders without errors', expected(check.EXPECT.tablesRender), ({ collections }) => check.tablesRender(collections));
  test('COL-04 Every period reloads the report', expected(check.EXPECT.periodsReload), ({ collections }) => check.periodsReload(collections));
  test('COL-05 Opens on "This month"', expected(check.EXPECT.opensOnThisMonth), ({ collections }) => check.opensOnThisMonth(collections));
  test('COL-06 Custom date range', expected(check.EXPECT.customRange), ({ collections }) => check.customRange(collections));
  test('COL-07 Filters narrow the results', expected(check.EXPECT.filtersNarrow), ({ collections }) => check.filtersNarrow(collections));
  test('COL-08 Views narrow the results', expected(check.EXPECT.viewsNarrow), ({ collections }) => check.viewsNarrow(collections));
  test('COL-09 Reset filters', expected(check.EXPECT.resetRestores), ({ collections }) => check.resetRestores(collections));
  test('COL-10 Panel exports match the tables', expected(check.EXPECT.exportsMatchTables), ({ collections }) => check.exportsMatchTables(collections));
  test('COL-11 Tab bar and breadcrumb', expected(check.EXPECT.navigation), ({ collections, exceptions }) => check.navigation(collections, exceptions));

  test('COL-12 Scheduled − Received = Outstanding', expected('Scheduled − Received = Outstanding (to display rounding); Overdue ≤ Outstanding'), async ({ collections }) => {
    await collections.openWith();
    const k = await collections.kpis(['Scheduled', 'Received', 'Outstanding', 'Overdue']);
    note('values', JSON.stringify(k));
    expectNear(k['Scheduled'] - k['Received'], k['Outstanding'], 'Scheduled − Received vs Outstanding', 0.005);
    expect.soft(k['Overdue'], 'Overdue ≤ Outstanding').toBeLessThanOrEqual(k['Outstanding']);
  });

  test('COL-13 Aging and project tables add up', expected('Outstanding by Age amounts = Outstanding and shares = 100%; Collections by Project adds up to Scheduled, Received, Outstanding and Overdue'), async ({ collections }) => {
    await collections.openWith();
    await check.kpiEqualsColumn(collections, 'Outstanding', collections.byAge, 'Amount (USD)', 0.01);
    expectNear(await collections.byAge.sum('Share %'), 100, 'Aging shares', 0, 0.5);
    await check.kpiEqualsColumn(collections, 'Scheduled', collections.byProject, 'Scheduled (USD)', 0.01);
    await check.kpiEqualsColumn(collections, 'Received', collections.byProject, 'Received (USD)', 0.01);
    await check.kpiEqualsColumn(collections, 'Outstanding', collections.byProject, 'Outstanding (USD)', 0.01);
    await check.kpiEqualsColumn(collections, 'Overdue', collections.byProject, 'Overdue (USD)', 0.01);
  });

  test('COL-14 Collection rate', expected('Collection rate = Received ÷ Scheduled'), async ({ collections }) => {
    await collections.openWith();
    const k = await collections.kpis(['Scheduled', 'Received', 'Collection rate', 'Received of due in period']);
    note('values', JSON.stringify(k));
    if (k['Scheduled']) expectNear(k['Collection rate'], (k['Received'] / k['Scheduled']) * 100, 'Collection rate', 0, 0.1);
  });
});
