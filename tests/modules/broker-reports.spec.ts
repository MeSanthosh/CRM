/** Broker Reports card → /reports/brokers. Run alone: npm run test:broker-reports */
import { test, expect, expected } from '../pages/fixtures';
import { num } from '../helpers';
import * as check from './checks';

test.describe('Broker Reports', { tag: ['@pages', '@broker-reports'] }, () => {
  test('BRK-01 Opens from its card on the hub', expected(check.EXPECT.opensFromHub), ({ hub, brokers }) => check.opensFromHub(hub, brokers));
  test('BRK-02 Every KPI shows a valid value', expected(check.EXPECT.kpisValid), ({ brokers }) => check.kpisValid(brokers));
  test('BRK-03 Every table renders without errors', expected(check.EXPECT.tablesRender), ({ brokers }) => check.tablesRender(brokers));
  test('BRK-04 Every period reloads the report', expected(check.EXPECT.periodsReload), ({ brokers }) => check.periodsReload(brokers));
  test('BRK-05 Opens on "This month"', expected(check.EXPECT.opensOnThisMonth), ({ brokers }) => check.opensOnThisMonth(brokers));
  test('BRK-06 Custom date range', expected(check.EXPECT.customRange), ({ brokers }) => check.customRange(brokers));
  test('BRK-07 Filters narrow the results', expected(check.EXPECT.filtersNarrow), ({ brokers }) => check.filtersNarrow(brokers));
  test('BRK-08 Views narrow the results', expected(check.EXPECT.viewsNarrow), ({ brokers }) => check.viewsNarrow(brokers));
  test('BRK-09 Reset filters', expected(check.EXPECT.resetRestores), ({ brokers }) => check.resetRestores(brokers));
  test('BRK-10 Panel exports match the tables', expected(check.EXPECT.exportsMatchTables), ({ brokers }) => check.exportsMatchTables(brokers));
  test('BRK-11 Tab bar and breadcrumb', expected(check.EXPECT.navigation), ({ brokers, marketing }) => check.navigation(brokers, marketing));

  test('BRK-12 Broker Performance adds up to the KPIs', expected('Rows = Active brokers; Leads, Reservations, SPAs and SPA Value columns add up to their KPIs'), async ({ brokers }) => {
    await brokers.openWith();
    const t = brokers.performance;
    expect.soft(await t.rowCount(), 'Rows = Active brokers').toBe(await brokers.kpi('Active brokers'));
    await check.kpiEqualsColumn(brokers, 'Broker leads', t, 'Leads');
    await check.kpiEqualsColumn(brokers, 'Broker reservations', t, 'Reservations');
    await check.kpiEqualsColumn(brokers, 'Broker SPAs', t, 'SPAs');
    await check.kpiEqualsColumn(brokers, 'Broker SPA value', t, 'SPA Value (USD)', 0.01);
  });

  test('BRK-13 Brokers with SPA and share of SPAs', expected('"Brokers with SPA" = brokers whose SPAs > 0; Broker share of SPAs = Broker SPAs ÷ all SPAs signed (SPA Reports)'), async ({ brokers, spa }) => {
    await brokers.openWith();
    const withSpa = (await brokers.performance.column('SPAs')).map(num).filter(n => n > 0).length;
    expect.soft(withSpa, 'Brokers with SPA').toBe(await brokers.kpi('Brokers with SPA'));
    const [brokerSpas, share] = [await brokers.kpi('Broker SPAs'), await brokers.kpi('Broker share of SPAs')];
    await spa.openWith();
    const all = await spa.kpi('SPAs signed in period');
    if (all) expect.soft(Math.abs(share - (brokerSpas / all) * 100), `Share ${share}% vs ${brokerSpas}/${all}`).toBeLessThanOrEqual(0.1);
  });
});
