/** Marketing Reports card → /reports/marketing. Run alone: npm run test:marketing-reports */
import { test, expected } from '../pages/fixtures';
import { expectNear } from '../helpers';
import * as check from './checks';

test.describe('Marketing Reports', { tag: ['@pages', '@marketing-reports'] }, () => {
  test('MKT-01 Opens from its card on the hub', expected(check.EXPECT.opensFromHub), ({ hub, marketing }) => check.opensFromHub(hub, marketing));
  test('MKT-02 Every KPI shows a valid value', expected(check.EXPECT.kpisValid), ({ marketing }) => check.kpisValid(marketing));
  test('MKT-03 Every table renders without errors', expected(check.EXPECT.tablesRender), ({ marketing }) => check.tablesRender(marketing));
  test('MKT-04 Every period reloads the report', expected(check.EXPECT.periodsReload), ({ marketing }) => check.periodsReload(marketing));
  test('MKT-05 Opens on "This month"', expected(check.EXPECT.opensOnThisMonth), ({ marketing }) => check.opensOnThisMonth(marketing));
  test('MKT-06 Custom date range', expected(check.EXPECT.customRange), ({ marketing }) => check.customRange(marketing));
  test('MKT-07 Filters narrow the results', expected(check.EXPECT.filtersNarrow), ({ marketing }) => check.filtersNarrow(marketing));
  test('MKT-08 Views narrow the results', expected(check.EXPECT.viewsNarrow), ({ marketing }) => check.viewsNarrow(marketing));
  test('MKT-09 Reset filters', expected(check.EXPECT.resetRestores), ({ marketing }) => check.resetRestores(marketing));
  test('MKT-10 Panel exports match the tables', expected(check.EXPECT.exportsMatchTables), ({ marketing }) => check.exportsMatchTables(marketing));
  test('MKT-11 Tab bar and breadcrumb', expected(check.EXPECT.navigation), ({ marketing, reservations }) => check.navigation(marketing, reservations));

  test('MKT-12 Campaign and channel tables add up to the KPIs', expected('Both tables add up to Campaign budget, Campaign leads, Leads to SPA and Revenue'), async ({ marketing }) => {
    await marketing.openWith();
    for (const t of [marketing.campaigns, marketing.channels]) {
      await check.kpiEqualsColumn(marketing, 'Campaign budget', t, 'Budget (USD)', 0.01);
      await check.kpiEqualsColumn(marketing, 'Campaign leads', t, 'Leads');
      await check.kpiEqualsColumn(marketing, 'Leads to SPA', t, 'SPA');
      await check.kpiEqualsColumn(marketing, 'Revenue', t, 'Revenue (USD)', 0.01);
    }
  });

  test('MKT-13 Cost per lead and ROI', expected('Cost per lead = Campaign budget ÷ Campaign leads; ROI = (Revenue − Budget) ÷ Budget'), async ({ marketing }) => {
    await marketing.openWith();
    const k = await marketing.kpis(['Campaign budget', 'Campaign leads', 'Revenue']);
    if (k['Campaign leads']) expectNear(await marketing.kpi('Cost per lead'), k['Campaign budget'] / k['Campaign leads'], 'Cost per lead');
    if (k['Campaign budget']) expectNear(await marketing.kpi('ROI'), ((k['Revenue'] - k['Campaign budget']) / k['Campaign budget']) * 100, 'ROI %', 0.01, 0.5);
  });
});
