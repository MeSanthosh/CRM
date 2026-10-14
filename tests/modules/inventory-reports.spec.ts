/** Inventory Reports card → /reports/inventory. Run alone: npm run test:inventory-reports */
import { test, expect, expected } from '../pages/fixtures';
import { num, expectNear } from '../helpers';
import * as check from './checks';

test.describe('Inventory Reports', { tag: ['@pages', '@inventory-reports'] }, () => {
  test('INV-01 Opens from its card on the hub', expected(check.EXPECT.opensFromHub), ({ hub, inventory }) => check.opensFromHub(hub, inventory));
  test('INV-02 Every KPI shows a valid value', expected(check.EXPECT.kpisValid), ({ inventory }) => check.kpisValid(inventory));
  test('INV-03 Every table renders without errors', expected(check.EXPECT.tablesRender), ({ inventory }) => check.tablesRender(inventory));
  test('INV-04 Every period reloads the report', expected(check.EXPECT.periodsReload), ({ inventory }) => check.periodsReload(inventory));
  test('INV-05 Opens on "This month"', expected(check.EXPECT.opensOnThisMonth), ({ inventory }) => check.opensOnThisMonth(inventory));
  test('INV-06 Custom date range', expected(check.EXPECT.customRange), ({ inventory }) => check.customRange(inventory));
  test('INV-07 Filters narrow the results', expected(check.EXPECT.filtersNarrow), ({ inventory }) => check.filtersNarrow(inventory));
  test('INV-08 Views narrow the results', expected(check.EXPECT.viewsNarrow), ({ inventory }) => check.viewsNarrow(inventory));
  test('INV-09 Reset filters', expected(check.EXPECT.resetRestores), ({ inventory }) => check.resetRestores(inventory));
  test('INV-10 Panel exports match the tables', expected(check.EXPECT.exportsMatchTables), ({ inventory }) => check.exportsMatchTables(inventory));
  test('INV-11 Tab bar and breadcrumb', expected(check.EXPECT.navigation), ({ inventory, customers }) => check.navigation(inventory, customers));

  test('INV-12 Unit status totals and Sold %', expected('Available + Reserved + Sold ≤ Total units; Sold % = Sold ÷ Total'), async ({ inventory }) => {
    await inventory.openWith();
    const k = await inventory.kpis(['Total units', 'Available', 'Reserved', 'Sold']);
    expect.soft(k['Available'] + k['Reserved'] + k['Sold'], `${JSON.stringify(k)}`).toBeLessThanOrEqual(k['Total units']);
    expectNear(await inventory.kpi('Sold %'), (k['Sold'] / k['Total units']) * 100, 'Sold %', 0, 0.1);
  });

  test('INV-13 Project, unit-type and bedroom tables add up to the KPIs', expected('In each breakdown table: Units = Total units, Available / Reserved / Sold = their KPIs, Available Value = Available value'), async ({ inventory }) => {
    await inventory.openWith();
    for (const t of [inventory.byProject, inventory.byUnitType, inventory.byBedrooms]) {
      await check.kpiEqualsColumn(inventory, 'Total units', t, 'Units');
      await check.kpiEqualsColumn(inventory, 'Available', t, 'Available');
      await check.kpiEqualsColumn(inventory, 'Reserved', t, 'Reserved');
      await check.kpiEqualsColumn(inventory, 'Sold', t, 'Sold');
      await check.kpiEqualsColumn(inventory, 'Available value', t, 'Available Value (USD)', 0.01);
    }
  });

  test('INV-14 Available Units list', expected('Rows = Available; list prices add up to Available value; Average available price = value ÷ units; every unit has a project and a price'), async ({ inventory }) => {
    await inventory.openWith();
    const units = await inventory.availableUnits.rows();
    const available = await inventory.kpi('Available');
    expect.soft(units.length, 'Rows = Available').toBe(available);
    await check.kpiEqualsColumn(inventory, 'Available value', inventory.availableUnits, 'List Price (USD)', 0.01);
    if (available) expectNear(await inventory.kpi('Average available price'), (await inventory.kpi('Available value')) / available, 'Average available price');
    expect.soft(units.filter(u => !u['Unit'] || !u['Project'] || !(num(u['List Price (USD)']) > 0)).map(u => u['Unit']), 'Incomplete units').toEqual([]);
  });

  test('INV-15 Availability Summary grouping', expected('"By product" and "By bedrooms" both show the availability matrix; its Available column adds up to the Available KPI'), async ({ inventory }) => {
    await inventory.openWith();
    for (const mode of ['By bedrooms', 'By product'] as const) {
      await inventory.groupAvailabilityBy(mode);
      expect.soft(await inventory.availability.rowCount(), `${mode}: rows`).toBeGreaterThan(0);
      await check.kpiEqualsColumn(inventory, 'Available', inventory.availability, 'Available');
      await inventory.expectNoBrokenValues(mode);
    }
  });
});
