/** Customer Reports workbook — Exports (CR-064…068) and Cross-page (CR-069…071). */
import * as XLSX from 'xlsx';
import { test, expect, note } from '../pages/fixtures';
import { num, ymd, kpi, expectNear } from '../helpers';
import { ROUTES } from '../locators';
import { CustomerReportsPage, PROJECTS } from '../pages/CustomerReportsPage';
import type { ReportTable } from '../pages/ReportTable';
import { cr } from './catalog';
import { excelDay, shownTolerance, shownDate } from './shared';
import { todayInFileName } from '../module-workbooks/helpers';

/** An Excel serial day and a shown date are the same calendar day. */
const sameDay = (serial: number, d: Date) => {
  const f = new Date(Math.round((serial - 25569) * 86400_000));
  return f.getUTCFullYear() === d.getFullYear() && f.getUTCMonth() === d.getMonth() && f.getUTCDate() === d.getDate();
};

const FILES: Record<string, string> = {
  'Customers by Nationality': 'byNationality', 'Customers by Country of Residence': 'byResidence',
  'Customers by Type': 'byType', 'New Customers in Period': 'newList',
};
const COUNTS = ['Customers', 'New in Period', 'With SPA', 'SPAs'];
const VALUE = 'SPA Value (USD)';
const fileName = (heading: string) => new RegExp(`^customers-report-${FILES[heading]}-${todayInFileName()}\\.xlsx$`);

/** The breakdown export has the table's columns, rows (in order) and Total row, with equal values. */
async function expectExportMatches(table: ReportTable) {
  const screen = await table.rows();
  const total = (await table.total())!;
  const sheet = await table.export();
  note('export', `${sheet.name} (sheet "${sheet.sheetName}"): ${sheet.rows.length} rows + ${sheet.total ? 'Total row' : 'no Total row'}`);
  expect.soft(sheet.name, 'File name').toMatch(fileName(table.heading));
  expect.soft(sheet.header, 'Columns').toEqual(await table.headers());
  expect.soft(sheet.rows.length, 'Rows').toBe(screen.length);
  const group = sheet.header[0];
  const diffs: string[] = [];
  const compare = (s: Record<string, string>, f: Record<string, unknown> | undefined, label: string) => {
    if (!f) { diffs.push(`${label}: missing in the file`); return; }
    if (String(f[group]).trim() !== s[group]) diffs.push(`${label}: label "${f[group]}" vs "${s[group]}"`);
    for (const c of COUNTS) if (Number(f[c]) !== num(s[c])) diffs.push(`${label}: ${c} ${f[c]} vs ${s[c]}`);
    if (Math.abs(Number(f[VALUE]) - num(s[VALUE])) > shownTolerance(s[VALUE]) + 0.01) diffs.push(`${label}: ${VALUE} ${f[VALUE]} vs ${s[VALUE]}`);
  };
  screen.forEach((s, i) => compare(s, sheet.rows[i], `row ${i + 1} ${s[group]}`));
  compare(total, sheet.total, 'Total row');
  expect.soft(diffs.slice(0, 15), 'Export vs table').toEqual([]);
}

test.describe('Customer Reports · Export', () => {
  for (const [id, i] of [['CR-064', 0], ['CR-065', 1], ['CR-066', 2]] as const) {
    test(...cr(id), async ({ customers }) => {
      await customers.openWith('last_12_months');
      await expectExportMatches(customers.breakdowns[i].table);
    });
  }

  test(...cr('CR-067'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    const screen = new Map((await customers.newCustomers.rows()).map(r => [r['Customer'], r]));
    const sheet = await customers.newCustomers.export();
    expect.soft(sheet.name, 'File name').toMatch(fileName('New Customers in Period'));
    expect.soft(sheet.header, 'Columns').toEqual(await customers.newCustomers.headers());
    expect.soft(sheet.rows.map(r => String(r['Customer'])).sort(), 'Same customers').toEqual([...screen.keys()].sort());
    // Created must be a real date cell, shown as dd-mmm-yyyy
    const ws = XLSX.readFile(sheet.path!, { cellNF: true }).Sheets[sheet.sheetName!];
    const col = XLSX.utils.encode_col(sheet.header.indexOf('Created'));
    const cell = ws[`${col}2`];
    note('Created cell', `type ${cell?.t}, format ${cell?.z}, value ${cell?.v} (${cell?.w})`);
    expect.soft(cell?.t, 'Created is a date number').toBe('n');
    expect.soft(String(cell?.z ?? ''), 'Created has a date format').toMatch(/d.*m.*y/i);
    const diffs: string[] = [];
    for (const f of sheet.rows) {
      const s = screen.get(String(f['Customer']));
      if (!s) continue;
      if (typeof f['Created'] !== 'number' || !sameDay(f['Created'] as number, shownDate(s['Created']))) diffs.push(`${f['Customer']}: Created ${f['Created']} (${typeof f['Created'] === 'number' ? excelDay(f['Created'] as number) : '?'}) vs ${s['Created']}`);
      if (typeof f[VALUE] !== 'number') diffs.push(`${f['Customer']}: ${VALUE} is not a number (${f[VALUE]})`);
      else if (Math.abs((f[VALUE] as number) - num(s[VALUE])) > shownTolerance(s[VALUE]) + 0.01) diffs.push(`${f['Customer']}: ${VALUE} ${f[VALUE]} vs ${s[VALUE]}`);
      if (Number(f['SPAs']) !== num(s['SPAs'])) diffs.push(`${f['Customer']}: SPAs ${f['SPAs']} vs ${s['SPAs']}`);
      if (String(f['Name']).trim() !== s['Name']) diffs.push(`${f['Customer']}: Name ${f['Name']} vs ${s['Name']}`);
    }
    expect.soft(diffs.slice(0, 10), 'Export vs list').toEqual([]);
  });

  test(...cr('CR-068'), async ({ customers }) => {
    await customers.openWith('this_month');
    await customers.setFilterIndex(PROJECTS, 1);
    const k = await customers.kpis(['Active customers', 'New in period', 'Customers with SPA']);
    note('filtered cards', JSON.stringify(k));
    for (const { table } of customers.breakdowns) {
      if (!k['Active customers']) break;
      const sheet = await table.export();
      expect.soft(Number(sheet.total?.['Customers']), `${table.heading} export Total Customers`).toBe(k['Active customers']);
      expect.soft(Number(sheet.total?.['New in Period']), `${table.heading} export Total New in Period`).toBe(k['New in period']);
      expect.soft(Number(sheet.total?.['With SPA']), `${table.heading} export Total With SPA`).toBe(k['Customers with SPA']);
    }
    if (k['New in period']) expect.soft((await customers.newCustomers.export()).rows.length, 'New Customers export rows').toBe(k['New in period']);
  });
});

/** Customers page (/customers) card, e.g. "Customers", "Active Customers". */
async function customersPageCard(c: CustomerReportsPage, label: string) {
  await c.page.goto(ROUTES.customers);
  return kpi(c.page, label);
}

test.describe('Customer Reports · Cross-page', () => {
  test(...cr('CR-069'), async ({ customers }) => {
    await customers.open();
    const report = await customers.kpi('Active customers');
    const page = await customersPageCard(customers, 'Customers');
    note('values', `Customer Reports Active customers ${report} | Customers page "Customers" ${page}`);
    expect(report).toBe(page);
  });

  test(...cr('CR-070'), async ({ customers }) => {
    await customers.open();
    const report = await customers.kpi('Active customers');
    const page = await customersPageCard(customers, 'Active Customers');
    note('values', `Customer Reports Active customers ${report} | Customers page "Active Customers" ${page}`);
    expect(report).toBe(page);
  });

  test(...cr('CR-071'), async ({ customers, spa }) => {
    await customers.open();
    const spas = num((await customers.byNationality.total())?.['SPAs'] ?? '0');
    const value = await customers.kpi('SPA value');
    await spa.open();
    await spa.setCustomRange('2000-01-01', ymd(new Date()));
    const k = await spa.kpis(['SPAs signed in period', 'Signed value', 'Average SPA value']);
    note('values', `Customer Reports SPAs ${spas}, SPA value ${value} | SPA Reports (all time) ${JSON.stringify(k)}`);
    expect.soft(k['SPAs signed in period'], 'SPAs signed = SPAs Total').toBe(spas);
    expectNear(k['Signed value'], value, 'Signed value = SPA value', 0.005, 0);
    if (spas) expectNear(k['Average SPA value'], value / spas, 'Average SPA value = SPA value ÷ SPAs', 0.01, 0);
  });
});
