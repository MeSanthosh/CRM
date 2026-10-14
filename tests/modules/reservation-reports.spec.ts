/** Reservation Reports card → /reports/reservations. Run alone: npm run test:reservation-reports */
import { test, expect, expected, note } from '../pages/fixtures';
import { num, expectNear } from '../helpers';
import * as check from './checks';

test.describe('Reservation Reports', { tag: ['@pages', '@reservation-reports'] }, () => {
  test('RES-01 Opens from its card on the hub', expected(check.EXPECT.opensFromHub), ({ hub, reservations }) => check.opensFromHub(hub, reservations));
  test('RES-02 Every KPI shows a valid value', expected(check.EXPECT.kpisValid), ({ reservations }) => check.kpisValid(reservations));
  test('RES-03 Every table renders without errors', expected(check.EXPECT.tablesRender), ({ reservations }) => check.tablesRender(reservations));
  test('RES-04 Every period reloads the report', expected(check.EXPECT.periodsReload), ({ reservations }) => check.periodsReload(reservations));
  test('RES-05 Opens on "This month"', expected(check.EXPECT.opensOnThisMonth), ({ reservations }) => check.opensOnThisMonth(reservations));
  test('RES-06 Custom date range', expected(check.EXPECT.customRange), ({ reservations }) => check.customRange(reservations));
  test('RES-07 Filters narrow the results', expected(check.EXPECT.filtersNarrow), ({ reservations }) => check.filtersNarrow(reservations));
  test('RES-08 Views narrow the results', expected(check.EXPECT.viewsNarrow), ({ reservations }) => check.viewsNarrow(reservations));
  test('RES-09 Reset filters', expected(check.EXPECT.resetRestores), ({ reservations }) => check.resetRestores(reservations));
  test('RES-10 Panel exports match the tables', expected(check.EXPECT.exportsMatchTables), ({ reservations }) => check.exportsMatchTables(reservations));
  test('RES-11 Tab bar and breadcrumb', expected(check.EXPECT.navigation), ({ reservations, spa }) => check.navigation(reservations, spa));

  test('RES-12 Month, project and salesperson tables add up to the KPIs', expected('Each table adds up to Reservations in period, Reservation amount and Converted to SPA; project and salesperson tables add up to Active now'), async ({ reservations }) => {
    await reservations.openWith();
    for (const t of [reservations.byMonth, reservations.byProject, reservations.bySalesperson]) {
      await check.kpiEqualsColumn(reservations, 'Reservations in period', t, 'Made in Period');
      await check.kpiEqualsColumn(reservations, 'Reservation amount', t, 'Amount (USD)', 0.01);
      await check.kpiEqualsColumn(reservations, 'Converted to SPA', t, 'Converted to SPA');
    }
    for (const t of [reservations.byProject, reservations.bySalesperson]) await check.kpiEqualsColumn(reservations, 'Active now', t, 'Active Now');
  });

  test('RES-13 Conversion rate', expected('Conversion rate = Converted to SPA ÷ Reservations in period'), async ({ reservations }) => {
    await reservations.openWith();
    const made = await reservations.kpi('Reservations in period');
    if (made) expectNear(await reservations.kpi('Conversion rate'), ((await reservations.kpi('Converted to SPA')) / made) * 100, 'Conversion rate', 0, 0.1);
  });

  test('RES-14 Active Reservations list matches the expiry KPIs', expected('Rows = Active now; rows with negative Days Left = "Past expiry, still active"; rows with 0–7 days left = "Expiring in 7 days"'), async ({ reservations }) => {
    await reservations.openWith();
    const rows = await reservations.active.rows();
    expect.soft(rows.length, 'Rows = Active now').toBe(await reservations.kpi('Active now'));
    const days = rows.map(r => num(r['Days Left']));
    expect.soft(days.filter(d => d < 0).length, 'Past expiry').toBe(await reservations.kpi('Past expiry, still active'));
    expect.soft(days.filter(d => d >= 0 && d <= 7).length, 'Expiring in 7 days').toBe(await reservations.kpi('Expiring in 7 days'));
    note('deposit states', [...new Set(rows.map(r => r['Deposit']))].join(', '));
  });
});
