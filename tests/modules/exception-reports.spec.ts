/** Exception Reports card → /reports/exceptions. Run alone: npm run test:exception-reports */
import { test, expect, expected, note } from '../pages/fixtures';
import * as check from './checks';

/** Detail lists on screen stop at this many rows. */
const LIST_CAP = 100;

test.describe('Exception Reports', { tag: ['@pages', '@exception-reports'] }, () => {
  test('EXC-01 Opens from its card on the hub', expected(check.EXPECT.opensFromHub), ({ hub, exceptions }) => check.opensFromHub(hub, exceptions));
  test('EXC-02 Every KPI shows a valid value', expected(check.EXPECT.kpisValid), ({ exceptions }) => check.kpisValid(exceptions));
  test('EXC-03 Every table renders without errors', expected(check.EXPECT.tablesRender), ({ exceptions }) => check.tablesRender(exceptions));
  test('EXC-04 Every period reloads the report', expected(check.EXPECT.periodsReload), ({ exceptions }) => check.periodsReload(exceptions));
  test('EXC-05 Opens on "This month"', expected(check.EXPECT.opensOnThisMonth), ({ exceptions }) => check.opensOnThisMonth(exceptions));
  test('EXC-06 Custom date range', expected(check.EXPECT.customRange), ({ exceptions }) => check.customRange(exceptions));
  test('EXC-07 Filters narrow the results', expected(check.EXPECT.filtersNarrow), ({ exceptions }) => check.filtersNarrow(exceptions));
  test('EXC-08 Views narrow the results', expected(check.EXPECT.viewsNarrow), ({ exceptions }) => check.viewsNarrow(exceptions));
  test('EXC-09 Reset filters', expected(check.EXPECT.resetRestores), ({ exceptions }) => check.resetRestores(exceptions));
  test('EXC-10 Panel exports match the tables', expected(check.EXPECT.exportsMatchTables), ({ exceptions }) => check.exportsMatchTables(exceptions));
  test('EXC-11 Tab bar and breadcrumb', expected(check.EXPECT.navigation), ({ exceptions, sales }) => check.navigation(exceptions, sales));

  test('EXC-12 Exception Summary adds up to Open exceptions', expected('The "Open" column of the Exception Summary adds up to Open exceptions'), async ({ exceptions }) => {
    await exceptions.openWith();
    await check.kpiEqualsColumn(exceptions, 'Open exceptions', exceptions.summary, 'Open');
  });

  test('EXC-13 KPI cards equal their summary rows', expected('Overdue instalments and Reservations past expiry KPIs equal their rows in the Exception Summary'), async ({ exceptions }) => {
    await exceptions.openWith();
    const summary = await exceptions.summaryCounts();
    note('summary', JSON.stringify(summary));
    for (const label of ['Overdue instalments', 'Reservations past expiry']) {
      expect.soft(summary[label], `Summary "${label}" = KPI`).toBe(await exceptions.kpi(label));
    }
  });

  test('EXC-14 Detail lists match the summary counts', expected('Each detail list has as many rows as its summary count (lists capped at 100 rows show at most that many)'), async ({ exceptions }) => {
    await exceptions.openWith();
    const summary = await exceptions.summaryCounts();
    for (const list of exceptions.detailLists) {
      if (!(list in summary)) continue;
      const rows = await exceptions.table(list).rowCount();
      if (rows < LIST_CAP) expect.soft(rows, `"${list}" rows = summary`).toBe(summary[list]);
      else expect.soft(rows, `"${list}" rows ≤ summary (capped)`).toBeLessThanOrEqual(summary[list]);
    }
  });

  test('EXC-15 Reservations past expiry agrees with Reservation Reports', expected('Exception Reports "Reservations past expiry" = Reservation Reports "Past expiry, still active"'), async ({ exceptions, reservations }) => {
    await exceptions.openWith();
    const here = await exceptions.kpi('Reservations past expiry');
    await reservations.openWith();
    expect(here).toBe(await reservations.kpi('Past expiry, still active'));
  });
});
