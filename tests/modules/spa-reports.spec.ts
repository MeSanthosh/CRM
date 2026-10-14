/** SPA Reports card → /reports/spa. Run alone: npm run test:spa-reports */
import { test, expected } from '../pages/fixtures';
import { expectNear } from '../helpers';
import * as check from './checks';

test.describe('SPA Reports', { tag: ['@pages', '@spa-reports'] }, () => {
  test('SPA-01 Opens from its card on the hub', expected(check.EXPECT.opensFromHub), ({ hub, spa }) => check.opensFromHub(hub, spa));
  test('SPA-02 Every KPI shows a valid value', expected(check.EXPECT.kpisValid), ({ spa }) => check.kpisValid(spa));
  test('SPA-03 Every table renders without errors', expected(check.EXPECT.tablesRender), ({ spa }) => check.tablesRender(spa));
  test('SPA-04 Every period reloads the report', expected(check.EXPECT.periodsReload), ({ spa }) => check.periodsReload(spa));
  test('SPA-05 Opens on "This month"', expected(check.EXPECT.opensOnThisMonth), ({ spa }) => check.opensOnThisMonth(spa));
  test('SPA-06 Custom date range', expected(check.EXPECT.customRange), ({ spa }) => check.customRange(spa));
  test('SPA-07 Filters narrow the results', expected(check.EXPECT.filtersNarrow), ({ spa }) => check.filtersNarrow(spa));
  test('SPA-08 Views narrow the results', expected(check.EXPECT.viewsNarrow), ({ spa }) => check.viewsNarrow(spa));
  test('SPA-09 Reset filters', expected(check.EXPECT.resetRestores), ({ spa }) => check.resetRestores(spa));
  test('SPA-10 Panel exports match the tables', expected(check.EXPECT.exportsMatchTables), ({ spa }) => check.exportsMatchTables(spa));
  test('SPA-11 Tab bar and breadcrumb', expected(check.EXPECT.navigation), ({ spa, collections }) => check.navigation(spa, collections));

  test('SPA-12 Month, project and salesperson tables add up to the KPIs', expected('Signed count and value add up in all three tables; Awaiting Signature and KYC Not Approved columns add up to their KPIs'), async ({ spa }) => {
    await spa.openWith();
    await check.kpiEqualsColumn(spa, 'SPAs signed in period', spa.byMonth, 'Signed');
    await check.kpiEqualsColumn(spa, 'Signed value', spa.byMonth, 'Value (USD)', 0.01);
    for (const t of [spa.byProject, spa.bySalesperson]) {
      await check.kpiEqualsColumn(spa, 'SPAs signed in period', t, 'Signed in Period');
      await check.kpiEqualsColumn(spa, 'Signed value', t, 'Value (USD)', 0.01);
      await check.kpiEqualsColumn(spa, 'Awaiting signature', t, 'Awaiting Signature');
      await check.kpiEqualsColumn(spa, 'Signed, KYC not approved', t, 'KYC Not Approved');
    }
  });

  test('SPA-13 Average SPA value', expected('Average SPA value = Signed value ÷ SPAs signed in period'), async ({ spa }) => {
    await spa.openWith();
    const n = await spa.kpi('SPAs signed in period');
    if (n) expectNear(await spa.kpi('Average SPA value'), (await spa.kpi('Signed value')) / n, 'Average SPA value');
  });
});
