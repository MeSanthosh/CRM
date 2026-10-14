/** Customer Reports card → /reports/customers. Run alone: npm run test:customer-reports */
import { test, expect, expected } from '../pages/fixtures';
import { expectNear } from '../helpers';
import * as check from './checks';

test.describe('Customer Reports', { tag: ['@pages', '@customer-reports'] }, () => {
  test('CUS-01 Opens from its card on the hub', expected(check.EXPECT.opensFromHub), ({ hub, customers }) => check.opensFromHub(hub, customers));
  test('CUS-02 Every KPI shows a valid value', expected(check.EXPECT.kpisValid), ({ customers }) => check.kpisValid(customers));
  test('CUS-03 Every table renders without errors', expected(check.EXPECT.tablesRender), ({ customers }) => check.tablesRender(customers));
  test('CUS-04 Every period reloads the report', expected(check.EXPECT.periodsReload), ({ customers }) => check.periodsReload(customers));
  test('CUS-05 Opens on "This month"', expected(check.EXPECT.opensOnThisMonth), ({ customers }) => check.opensOnThisMonth(customers));
  test('CUS-06 Custom date range', expected(check.EXPECT.customRange), ({ customers }) => check.customRange(customers));
  test('CUS-07 Filters narrow the results', expected(check.EXPECT.filtersNarrow), ({ customers }) => check.filtersNarrow(customers));
  test('CUS-08 Views narrow the results', expected(check.EXPECT.viewsNarrow), ({ customers }) => check.viewsNarrow(customers));
  test('CUS-09 Reset filters', expected(check.EXPECT.resetRestores), ({ customers }) => check.resetRestores(customers));
  test('CUS-10 Panel exports match the tables', expected(check.EXPECT.exportsMatchTables), ({ customers }) => check.exportsMatchTables(customers));
  test('CUS-11 Tab bar and breadcrumb', expected(check.EXPECT.navigation), ({ customers, brokers }) => check.navigation(customers, brokers));

  test('CUS-12 Breakdown tables add up to the KPIs', expected('Nationality, residence and type tables each add up to Active customers, New in period, Customers with SPA and SPA value'), async ({ customers }) => {
    await customers.openWith();
    for (const t of [customers.byNationality, customers.byResidence, customers.byType]) {
      await check.kpiEqualsColumn(customers, 'Active customers', t, 'Customers');
      await check.kpiEqualsColumn(customers, 'New in period', t, 'New in Period');
      await check.kpiEqualsColumn(customers, 'Customers with SPA', t, 'With SPA');
      await check.kpiEqualsColumn(customers, 'SPA value', t, 'SPA Value (USD)', 0.01);
    }
  });

  test('CUS-13 New customers list and average value', expected('New Customers in Period rows = New in period, with no duplicates; Average value per buyer = SPA value ÷ Customers with SPA'), async ({ customers }) => {
    await customers.openWith();
    const refs = await customers.newCustomers.column('Customer');
    expect.soft(refs.length, 'Rows = New in period').toBe(await customers.kpi('New in period'));
    expect.soft(refs.filter((v, i, a) => a.indexOf(v) !== i), 'Duplicate customers').toEqual([]);
    const buyers = await customers.kpi('Customers with SPA');
    if (buyers) expectNear(await customers.kpi('Average value per buyer'), (await customers.kpi('SPA value')) / buyers, 'Average value per buyer');
  });

  test('CUS-14 SPA value follows the period', expected('With "Last month" selected, SPA value equals SPA Reports "Signed value" for Last month'), async ({ customers, spa }) => {
    await customers.openWith('last_month');
    const value = await customers.kpi('SPA value');
    await spa.openWith('last_month');
    const signed = await spa.kpi('Signed value');
    expectNear(value, signed, `Customers SPA value ${value} vs SPA Signed value ${signed}`, 0.005, 0);
  });
});
