/**
 * Customer Reports workbook — "Observations" sheet. Each test checks the behaviour the observation asks for:
 *  - defects (the page should change) assert the expected behaviour, so they fail until fixed;
 *  - questions / info items record what the page does now (pass, with the finding in the report).
 */
import { test, expect, note } from '../pages/fixtures';
import { num, kpi } from '../helpers';
import { XP, at, ROUTES } from '../locators';
import { ALL_TIME_KPIS, PROJECTS, SALESPEOPLE } from '../pages/CustomerReportsPage';
import { crObs, OBSERVATIONS } from './catalog';
import { shownDate } from './shared';

const CHECKED = ['OBS-01', 'OBS-02', 'OBS-03', 'OBS-04', 'OBS-05', 'OBS-06', 'OBS-07', 'OBS-08', 'OBS-09', 'OBS-10', 'OBS-11', 'OBS-12', 'OBS-13'];
/** Values that are regions or cities rather than countries. */
const NOT_COUNTRIES = /^(europe|asia|africa|middle east|gcc|dubai|abu dhabi|london)$/i;

test.describe('Customer Reports · Observations', () => {
  test('CR-OBS-00 Every observation on the sheet has a check', { tag: '@customer-workbook' }, () => {
    expect(OBSERVATIONS.map(o => o.id).filter(id => !CHECKED.includes(id)), 'Observations without a check').toEqual([]);
  });

  test(...crObs('OBS-01'), async ({ customers }) => {
    await customers.open();
    expect(await customers.period(), 'Default period').toBe('this_month');
  });

  test(...crObs('OBS-02'), async ({ customers, page }) => {
    await customers.open();
    const unlabelled: string[] = [];
    for (const k of ALL_TIME_KPIS) if (!/all time|as of today|overall|to date/i.test(await at(page, XP.kpiCard(k)).innerText())) unlabelled.push(k);
    expect(unlabelled, 'Cards that ignore the period but do not say so').toEqual([]);
  });

  test(...crObs('OBS-03'), async ({ customers, page }) => {
    await customers.open();
    const report = await customers.kpi('Active customers');
    await page.goto(ROUTES.customers);
    const active = await kpi(page, 'Active Customers');
    note('values', `Customer Reports ${report} | Customers page Active Customers ${active} | Customers ${await kpi(page, 'Customers')}`);
    expect(report, 'Same number of active customers').toBe(active);
  });

  test(...crObs('OBS-04'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    const countries = await customers.byResidence.column('Country');
    const lower = countries.map(c => c.toLowerCase());
    const dupes = countries.filter((c, i) => lower.indexOf(lower[i]) !== i);
    const regions = countries.filter(c => NOT_COUNTRIES.test(c));
    note('countries', countries.join(', '));
    expect.soft(dupes, 'Countries listed under more than one spelling').toEqual([]);
    expect.soft(regions, 'Regions or cities listed as countries').toEqual([]);
  });

  test(...crObs('OBS-05'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    const parts: string[] = [];
    for (const { table, group } of customers.breakdowns) {
      const unspecified = (await table.rows()).find(r => r[group] === 'Unspecified');
      parts.push(`${group}: ${unspecified?.['Customers'] ?? 0} of ${(await table.total())?.['Customers']} unspecified`);
    }
    note('finding', parts.join(' | '));
  });

  test(...crObs('OBS-06'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    const ids = await customers.newCustomers.column('Customer');
    const formats = [...new Set(ids.map(id => id.replace(/\d/g, '9').replace(/-[A-Z0-9]{4}$/, '-XXXX')))];
    note('formats', formats.join(' | '));
    expect(formats.length, 'Customer ID formats').toBe(1);
  });

  test(...crObs('OBS-07'), async ({ customers, page }) => {
    await customers.openWith('last_12_months');
    const report = new Map((await customers.newCustomers.rows()).map(r => [r['Customer'], r['Created']]));
    await page.goto(ROUTES.customers);
    const rows = at(page, XP.customerRegisterRows);
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    const register = await rows.evaluateAll(trs => trs.map(tr => [...tr.children].map(td => (td as HTMLElement).innerText.trim())));
    const differ = register.map(cells => ({ id: cells[0].split('\n')[1]?.trim(), created: cells[cells.length - 1] }))
      .filter(r => report.has(r.id) && shownDate(report.get(r.id)!).getTime() !== shownDate(r.created.split(',')[0]).getTime())
      .map(r => `${r.id}: report ${report.get(r.id)} vs Customers ${r.created}`);
    expect(differ, 'Customers whose Created date differs between the pages').toEqual([]);
  });

  test(...crObs('OBS-08'), async ({ customers }) => {
    await customers.open();
    const names = await customers.filterOptions(SALESPEOPLE);
    expect(names.filter((v, i, a) => a.indexOf(v) !== i), 'Salesperson names that appear more than once').toEqual([]);
  });

  test(...crObs('OBS-09'), async ({ customers, page }) => {
    await customers.openWith('last_12_months');
    await customers.newCustomers.links.first().click();
    const form = at(page, XP.customerRecordForm);
    await expect(form).toBeVisible({ timeout: 15_000 });
    const editable = await form.locator('input:not([readonly]):not([disabled])').count();
    note('finding', `Customer ID opens "${(await form.locator('h2, h3').first().innerText().catch(() => '')).trim() || 'a form'}" with ${editable} editable fields (question open)`);
    await form.getByRole('button', { name: 'Close' }).first().click();
  });

  test(...crObs('OBS-10'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    const sheet = await customers.byResidence.export();
    note('sheet', `"${sheet.sheetName}" (${sheet.sheetName?.length} characters)`);
    const truncated = sheet.sheetName !== customers.byResidence.heading && customers.byResidence.heading.startsWith(sheet.sheetName ?? '');
    expect(truncated, 'Sheet name is cut off').toBe(false);
  });

  test(...crObs('OBS-11'), async ({ customers, page }) => {
    await customers.open();
    await customers.setPeriod('this_month');
    await customers.setFilterIndex(PROJECTS, 1);
    await customers.setView('Mine');
    const url = page.url().replace(/^https?:\/\/[^/]+/, '');
    note('finding', `URL after choosing a period, project and view: ${url} (${/[?&]/.test(url) ? 'selection kept in the URL' : 'selection not in the URL'})`);
  });

  test(...crObs('OBS-12'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    const parts: string[] = [];
    for (const [i, label] of (await customers.filterOptions(PROJECTS)).entries()) {
      await customers.setFilterIndex(PROJECTS, i + 1);
      parts.push(`${label}: Active customers ${await customers.kpi('Active customers')}, with SPA ${await customers.kpi('Customers with SPA')}`);
    }
    note('finding', parts.join(' | '));
  });

  test(...crObs('OBS-13'), async ({ customers }) => {
    test.setTimeout(180_000);
    await customers.openWith('last_12_months');
    const all = await customers.kpi('Active customers');
    const names = await customers.filterOptions(SALESPEOPLE);
    let total = 0;
    for (let i = 1; i <= names.length; i++) { await customers.setFilterIndex(SALESPEOPLE, i); total += await customers.kpi('Active customers'); }
    note('values', `All ${all} | sum over ${names.length} salespeople ${total} | "Unassigned" option: ${names.some(n => /unassigned/i.test(n)) ? 'yes' : 'no'}`);
    expect(names.some(n => /unassigned/i.test(n)) || total === all, 'Every customer can be found through the Salesperson filter').toBe(true);
  });
});
