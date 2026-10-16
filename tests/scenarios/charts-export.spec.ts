/**
 * Workbook areas: Charts and Graphs (RA-071…076), Export Scenarios (RA-077…083).
 * The only charts in the reports are on Lead Reports: the lead funnel and the 12-month trend (CSS bars).
 */
import { test, expect } from '../auth';
import { kpi, open, tableRows, tableColumn, listCount } from '../helpers';
import { ROUTES, XP, at } from '../locators';
import {
  scenario, note, num, sum, expectNear, openReport, setCustomRange, setFilter, filterOptions, funnel, trend,
  exportPanel, download, expectClean,
} from './support';

const R = ROUTES.reports;
const FUNNEL = ['Captured', 'Contacted', 'Qualified', 'Opportunity'];

test.describe('Scenarios · Charts and Graphs', () => {
  test(...scenario('RA-071', 'The lead funnel lists Captured → Contacted → Qualified → Opportunity … with counts that never increase down the funnel'), async ({ page }) => {
    await openReport(page, R.leads);
    const steps = await funnel(page);
    note('funnel', steps.map(s => `${s.label} ${s.count} (${s.rate}%)`).join(' → '));
    expect.soft(steps.slice(0, FUNNEL.length).map(s => s.label), 'Funnel steps').toEqual(FUNNEL);
    for (let i = 1; i < steps.length; i++) {
      expect.soft(steps[i].count, `${steps[i].label} ≤ ${steps[i - 1].label}`).toBeLessThanOrEqual(steps[i - 1].count);
    }
  });

  test(...scenario('RA-072', 'Funnel and trend match the KPI cards: Captured = Leads Captured, step rates = Contact / Qualification / Opportunity rates, 12-month trend total = Leads Captured'), async ({ page }) => {
    await openReport(page, R.leads);
    const steps = await funnel(page);
    const by = Object.fromEntries(steps.map(s => [s.label, s]));
    const captured = await kpi(page, 'Leads Captured');
    expect.soft(by['Captured']?.count, 'Funnel Captured = Leads Captured').toBe(captured);
    expectNear(by['Contacted']?.rate ?? NaN, await kpi(page, 'Contact Rate'), 'Contacted rate vs Contact Rate', 0, 0.1);
    expectNear(by['Qualified']?.rate ?? NaN, await kpi(page, 'Qualification Rate'), 'Qualified rate vs Qualification Rate', 0, 0.1);
    expectNear(by['Opportunity']?.rate ?? NaN, await kpi(page, 'Opportunity Conversion'), 'Opportunity rate vs Opportunity Conversion', 0, 0.1);
    const spaStep = steps.find(s => /SPA/i.test(s.label));
    if (spaStep) expect.soft(spaStep.count, 'Funnel SPA step = SPA Signed').toBe(await kpi(page, 'SPA Signed'));
    const months = await trend(page);
    note('trend', months.map(m => `${m.label}: ${m.value}`).join(', '));
    expect.soft(sum(months.map(m => m.value)), '12-month trend total = Leads Captured (Last 12 months)').toBe(captured);
  });

  test(...scenario('RA-073', 'After filtering by salesperson, the funnel Captured count follows the new Leads Captured KPI'), async ({ page }) => {
    await openReport(page, R.leads);
    const before = (await funnel(page))[0].count;
    const person = (await filterOptions(page, 'All salespeople'))[0];
    await setFilter(page, 'All salespeople', person);
    const after = (await funnel(page))[0].count;
    const k = await kpi(page, 'Leads Captured');
    note('values', `All ${before} | ${person} ${after} | KPI ${k}`);
    expect.soft(after, 'Funnel Captured = KPI after filter').toBe(k);
    expect.soft(after, 'Filtered ≤ unfiltered').toBeLessThanOrEqual(before);
  });

  test(...scenario('RA-074', 'For This month, Last month and Last 12 months, the funnel Captured count equals Leads Captured for that period'), async ({ page }) => {
    await open(page, R.leads);
    for (const period of ['this_month', 'last_month', 'last_12_months']) {
      await openReport(page, R.leads, period);
      const f = (await funnel(page))[0].count;
      const k = await kpi(page, 'Leads Captured');
      expect.soft(f, `${period}: funnel Captured = Leads Captured`).toBe(k);
    }
  });

  test(...scenario('RA-075', 'Every funnel step and trend month has a label, a number and a bar sized to its value'), async ({ page }) => {
    await openReport(page, R.leads);
    const steps = await funnel(page);
    const top = steps[0].count;
    for (const s of steps) {
      expect.soft(s.label, 'Step label').not.toBe('');
      expect.soft(Number.isInteger(s.count), `${s.label} count is a number`).toBeTruthy();
      expect.soft(s.rate, `${s.label} rate`).not.toBeNull();
      if (top) expectNear(s.rate ?? NaN, (s.count / top) * 100, `${s.label} rate = count ÷ Captured`, 0, 0.1);
      expectNear(s.width, s.rate ?? NaN, `${s.label} bar width = rate`, 0, 0.5);
    }
    const months = await trend(page);
    expect.soft(months.length, '12 months in the trend').toBe(12);
    const max = Math.max(...months.map(m => m.value));
    for (const m of months) {
      expect.soft(m.label, 'Month label').toMatch(/^[A-Z][a-z]{2} \d{2}$/);
      expect.soft(m.detail, `${m.label} detail`).toMatch(/^\d+ opp · \d+ SPA$/);
      if (max) expectNear(m.height, (m.value / max) * 100, `${m.label} bar height`, 0, 15);
    }
    const now = new Date();
    const last = now.toLocaleString('en-GB', { month: 'short' }) + ' ' + String(now.getFullYear()).slice(2);
    expect.soft(months.at(-1)?.label, 'Trend ends with the current month').toBe(last);
  });

  test(...scenario('RA-076', 'With a date range that has no data, the funnel shows zeros and empty bars (no NaN, no errors)'), async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await open(page, R.leads);
    await setCustomRange(page, '2000-01-01', '2000-01-31');
    const steps = await funnel(page);
    note('funnel', JSON.stringify(steps));
    for (const s of steps) {
      expect.soft(s.count, `${s.label} count`).toBe(0);
      expect.soft(Number.isNaN(s.width) ? 0 : s.width, `${s.label} bar width`).toBe(0);
    }
    expect.soft(await kpi(page, 'Leads Captured')).toBe(0);
    await expectClean(page);
    expect.soft(errors, 'JavaScript errors').toEqual([]);
  });
});

/** First table panel on each module that has exports. */
const FIRST_PANEL: [string, string][] = [
  [R.sales, 'Open Pipeline by Stage'], [R.inventory, 'Inventory by Project'], [R.customers, 'Customers by Type'],
  [R.brokers, 'Broker Performance'], [R.marketing, 'Campaign Performance'], [R.reservations, 'Reservations by Project'],
  [R.spa, 'SPAs by Project'], [R.collections, 'Collections by Project'], [R.exceptions, 'Exception Summary'],
];

test.describe('Scenarios · Export Scenarios', () => {
  test(...scenario('RA-077', 'Every report module\'s panel export downloads an .xlsx with a header row and the panel\'s rows'), async ({ page }) => {
    for (const [path, panel] of FIRST_PANEL) {
      await openReport(page, path);
      const rows = await tableRows(page, panel);
      const sheet = await exportPanel(page, panel);
      expect.soft(sheet.name, `${panel} file`).toMatch(/\.xlsx$/i);
      expect.soft(sheet.header.length, `${panel} header`).toBeGreaterThan(1);
      expect.soft(sheet.rows.length, `${panel}: exported rows = table rows`).toBe(rows);
    }
  });

  test(...scenario('RA-078', 'With a salesperson filter applied, the Open Opportunities export contains only the filtered rows'), async ({ page }) => {
    await openReport(page, R.sales);
    await setFilter(page, 'All salespeople', (await tableColumn(page, 'Open Opportunities', 'Salesperson'))[0]);
    const rows = await tableRows(page, 'Open Opportunities');
    const sheet = await exportPanel(page, 'Open Opportunities');
    note('values', `Table ${rows} | export ${sheet.rows.length}`);
    expect.soft(sheet.rows.length, 'Exported rows = filtered table rows').toBe(rows);
  });

  test(...scenario('RA-079', 'With "Last month" selected, exports contain that period\'s rows (New Customers in Period, SPAs by Salesperson)'), async ({ page }) => {
    for (const [path, panel] of [[R.customers, 'New Customers in Period'], [R.spa, 'SPAs by Salesperson']] as const) {
      await openReport(page, path, 'last_month');
      const rows = await tableRows(page, panel);
      const sheet = await exportPanel(page, panel);
      expect.soft(sheet.rows.length, `${panel}: exported rows = table rows (Last month)`).toBe(rows);
    }
  });

  test(...scenario('RA-080', 'For every Sales and Inventory panel, exported rows = rows shown in the table'), async ({ page }) => {
    const panels: [string, string[]][] = [
      [R.sales, ['Open Pipeline by Stage', 'Salesperson Pipeline', 'Open Opportunities']],
      [R.inventory, ['Inventory by Project', 'Inventory by Unit Type', 'Inventory by Bedrooms', 'Available Units']],
    ];
    for (const [path, list] of panels) {
      await openReport(page, path);
      for (const panel of list) {
        const rows = await tableRows(page, panel);
        const sheet = await exportPanel(page, panel);
        expect.soft(sheet.rows.length, `${panel}: exported rows = table rows`).toBe(rows);
      }
    }
  });

  test(...scenario('RA-081', 'Totals in the Open Pipeline by Stage export equal the Open opportunities, Pipeline value and Weighted pipeline KPIs'), async ({ page }) => {
    await openReport(page, R.sales);
    const sheet = await exportPanel(page, 'Open Pipeline by Stage');
    const col = (name: string) => sum(sheet.rows.map(r => Number(r[name] ?? 0)));
    const total = (name: string) => Number(sheet.total?.[name] ?? NaN);
    const [opps, value, weighted] = [await kpi(page, 'Open opportunities'), await kpi(page, 'Pipeline value'), await kpi(page, 'Weighted pipeline')];
    expect.soft(col('Opportunities'), 'Sum of stage rows: Opportunities').toBe(opps);
    expectNear(col('Value (USD)'), value, 'Sum of stage rows: Value vs Pipeline value');
    expectNear(col('Weighted (USD)'), weighted, 'Sum of stage rows: Weighted vs Weighted pipeline');
    expect.soft(sheet.total, 'Export has a Total row').toBeTruthy();
    expect.soft(total('Opportunities'), 'Total row: Opportunities').toBe(opps);
    expectNear(total('Value (USD)'), value, 'Total row: Value vs Pipeline value');
    expectNear(total('Weighted (USD)'), weighted, 'Total row: Weighted vs Weighted pipeline');
  });

  test(...scenario('RA-082', 'The Open Opportunities export has the same columns and the same records (reference, customer, stage) as the table'), async ({ page }) => {
    await openReport(page, R.sales);
    const refs = await tableColumn(page, 'Open Opportunities', 'Opportunity'); // waits for the table to render
    const headers = (await at(page, XP.reportTable('Open Opportunities')).locator('thead th').allInnerTexts()).map(h => h.replace(/[↕▼▲]/g, '').trim());
    const sheet = await exportPanel(page, 'Open Opportunities');
    expect.soft(sheet.header, 'Export columns').toEqual(headers);
    const exported = sheet.rows.map(r => String(r['Opportunity'] ?? ''));
    expect.soft([...exported].sort(), 'Same opportunities').toEqual([...refs].sort());
    const tableFirst = (await at(page, XP.reportTableRows('Open Opportunities')).first().innerText()).split('\t').map(s => s.trim());
    const row = sheet.rows.find(r => r['Opportunity'] === tableFirst[0]);
    expect.soft(row?.['Customer'], 'Customer of the first record').toBe(tableFirst[1]);
    expect.soft(row?.['Stage'], 'Stage of the first record').toBe(tableFirst[2]);
  });

  test(...scenario('RA-083', 'Large exports complete within 60 s and contain every record (all leads; all overdue instalments)'), async ({ page }) => {
    await open(page, ROUTES.leads);
    const total = await listCount(page);
    let t = Date.now();
    const leads = await download(page, at(page, XP.leadsExport), 60_000);
    note('leads export', `${leads.rows.length} rows in ${Date.now() - t} ms`);
    expect.soft(leads.rows.length, 'All leads exported').toBe(total);
    await openReport(page, R.collections);
    const shown = await tableRows(page, 'Overdue Instalments');
    t = Date.now();
    const overdue = await exportPanel(page, 'Overdue Instalments');
    note('overdue export', `${overdue.rows.length} rows (table shows ${shown}) in ${Date.now() - t} ms`);
    expect.soft(overdue.rows.length, 'Export has at least the rows in the table').toBeGreaterThanOrEqual(shown);
    const count = sum((await tableColumn(page, 'Collections by Project', 'Overdue Instalments')).map(num));
    expect.soft(overdue.rows.length, 'Export has every overdue instalment').toBe(count);
  });
});
