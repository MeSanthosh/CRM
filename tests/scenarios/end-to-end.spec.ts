/**
 * Workbook areas: Create / Edit / Delete Scenarios (RA-066…070), End-to-End Scenarios (RA-127…133).
 * Scenarios that create, change or delete CRM records are kept manual: the suite only reads QA data,
 * so it can run any time without leaving test records behind.
 */
import { test, expect } from '../auth';
import { kpi, open, tableRows, tableColumn } from '../helpers';
import { ROUTES } from '../locators';
import { scenario, manual, note, colSum, openReport, setCustomRange, setFilter, exportPanel, ymd } from './support';

const R = ROUTES.reports;
const WRITES = 'creates or changes CRM records; the automated suite only reads QA data. Run manually, or approve test-data writes on QA first';

test.describe('Scenarios · Create / Edit / Delete Scenarios', () => {
  test(...manual('RA-066', WRITES));
  test(...manual('RA-067', WRITES));
  test(...manual('RA-068', WRITES));
  test(...manual('RA-069', WRITES));
  test(...manual('RA-070', WRITES));
});

test.describe('Scenarios · End-to-End Scenarios', () => {
  test(...manual('RA-127', WRITES));
  test(...manual('RA-128', WRITES));
  test(...manual('RA-129', WRITES));
  test(...manual('RA-130', WRITES));

  test(...scenario('RA-131', 'After filtering Sales by salesperson: the KPI, the stage totals and the Open Opportunities rows all show only that salesperson\'s data'), async ({ page }) => {
    await openReport(page, R.sales);
    const all = await kpi(page, 'Open opportunities');
    const person = (await tableColumn(page, 'Open Opportunities', 'Salesperson'))[0];
    await setFilter(page, 'All salespeople', person);
    const k = await kpi(page, 'Open opportunities');
    note('values', `All ${all} | ${person} ${k}`);
    expect.soft(k, 'Filtered ≤ all').toBeLessThanOrEqual(all);
    expect.soft(await colSum(page, 'Open Pipeline by Stage', 'Opportunities'), 'Stage total = KPI').toBe(k);
    expect.soft(await tableRows(page, 'Open Opportunities'), 'Rows = KPI').toBe(k);
    expect.soft([...new Set(await tableColumn(page, 'Open Opportunities', 'Salesperson'))], 'Salespeople in rows').toEqual([person]);
    expect.soft([...new Set(await tableColumn(page, 'Salesperson Pipeline', 'Salesperson'))], 'Salesperson Pipeline rows').toEqual([person]);
  });

  test(...scenario('RA-132', 'A custom range from the 1st of this month to today gives the same values as "This month" on Sales, SPA and the hub snapshot, and the export follows the range'), async ({ page }) => {
    const now = new Date();
    const from = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
    const to = ymd(now);
    const rows: string[] = [];
    const checks: [string, string[]][] = [
      [R.sales, ['Won in period', 'Won value']],
      [R.spa, ['SPAs signed in period', 'Signed value']],
    ];
    for (const [path, labels] of checks) {
      await openReport(page, path, 'this_month');
      const month = await Promise.all(labels.map(l => kpi(page, l)));
      await setCustomRange(page, from, to);
      const custom = await Promise.all(labels.map(l => kpi(page, l)));
      labels.forEach((l, i) => {
        rows.push(`${path} ${l}: This month ${month[i]} | ${from}…${to} ${custom[i]}`);
        expect.soft(custom[i], `${path} ${l}`).toBe(month[i]);
      });
      if (path === R.spa) {
        const signed = custom[1];
        await open(page, ROUTES.hub);
        expect.soft(await kpi(page, 'SPA Value Signed (This Month)'), 'Hub SPA Value Signed = custom range').toBe(signed);
        await openReport(page, R.spa, 'this_month');
        await setCustomRange(page, from, to);
        const shown = await tableRows(page, 'SPAs by Salesperson');
        const sheet = await exportPanel(page, 'SPAs by Salesperson');
        expect.soft(sheet.rows.length, 'Export rows for the custom range = table rows').toBe(shown);
      }
    }
    note('values', rows.join('\n'));
  });

  test(...manual('RA-133', 'needs login details for each role (only an administrator account is configured)'));
});
