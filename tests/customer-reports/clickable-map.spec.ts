/**
 * Customer Reports workbook — "Clickable Map" sheet: one test per row. Each checks that the element is (or is not)
 * clickable as the sheet says, and does what the sheet describes. Rows are matched by position (CR-MAP-01 = row 1).
 */
import { test, expect } from '../pages/fixtures';
import { ymd } from '../helpers';
import { XP, at } from '../locators';
import { PERIODS } from '../pages/ReportModulePage';
import { CustomerReportsPage, MODULE_TABS, LIST_COLUMNS, PROJECTS, SALESPEOPLE } from '../pages/CustomerReportsPage';
import type { ReportTable } from '../pages/ReportTable';
import { MAP_ROWS, crMap } from './catalog';
import { expectNothingHappens, previousMonth } from './shared';
import { todayInFileName } from '../module-workbooks/helpers';

/** Runs `fn` and expects a report request whose URL matches `param`. */
async function expectReload(c: CustomerReportsPage, param: RegExp, fn: () => Promise<unknown>) {
  const req = c.page.waitForRequest(r => r.url().includes('/reports/business/customers') && param.test(r.url()), { timeout: 15_000 }).catch(() => null);
  await fn();
  expect(await req, `Reloads with ${param}`).not.toBeNull();
}

async function expectExport(table: ReportTable, file: string) {
  const sheet = await table.export();
  expect(sheet.name).toMatch(new RegExp(`^customers-report-${file}-${todayInFileName()}\\.xlsx$`));
}

const CHECKS: Record<number, (c: CustomerReportsPage) => Promise<void>> = {
  1: async c => { await c.open(); await c.backToHub(); },
  2: async c => {
    await c.open();
    for (const [v, p] of [['You and your team', 'team'], ['Mine', 'self'], ['All', 'all']] as const) {
      await expectReload(c, new RegExp(`view=${p}`), () => c.setView(v));
      await expect(c.viewButton(v)).toHaveClass(/is-active/);
    }
  },
  3: async c => {
    for (const [tab, path] of Object.entries(MODULE_TABS).filter(([t]) => !['Customers', 'Leads'].includes(t))) {
      await c.open();
      await c.moduleTab(tab).click();
      await expect.soft(c.page, `${tab} → ${path}`).toHaveURL(new RegExp(`${path}(\\?.*)?$`));
    }
  },
  4: async c => {
    await c.open();
    await c.moduleTab('Customers').click();
    await expect(c.page).toHaveURL(/\/reports\/customers(\?.*)?$/);
    await expect(c.moduleTab('Customers')).toHaveClass(/is-active/);
  },
  5: async c => {
    await c.open();
    expect(await c.moduleTab('Leads').evaluate(e => e.tagName), 'Leads is a link').toBe('A');
    await c.moduleTab('Leads').click();
    await expect(c.page).toHaveURL(/\/reports\/leads(\?.*)?$/);
  },
  6: async c => {
    await c.open();
    expect(await c.periodOptions()).toEqual([...PERIODS]);
    await expectReload(c, /period=this_month/, () => c.setPeriod('this_month'));
  },
  7: async c => {
    const [from, to] = previousMonth();
    await c.open();
    await c.setPeriod('custom');
    await expect(c.fromInput).toBeEditable();
    await expect(c.toInput).toBeEditable();
    await expectReload(c, new RegExp(`from=${from}.*to=${to}|to=${to}.*from=${from}`), () => c.setCustomRange(from, to));
    await c.fromInput.fill(to);
    await c.toInput.fill(from);
    await expect(c.dateError, 'Message when To is before From').toBeVisible();
  },
  8: async c => { await c.open(); await expectReload(c, /projectCode=/, () => c.setFilterIndex(PROJECTS, 1)); },
  9: async c => { await c.open(); await expectReload(c, /ownerUserId=/, () => c.setFilterIndex(SALESPEOPLE, 1)); },
  10: async c => {
    await c.open();
    const period = await c.period();
    await expect(c.resetButton, 'Disabled when nothing is changed').toBeDisabled();
    await c.setFilterIndex(PROJECTS, 1);
    await expect(c.resetButton, 'Enabled after a change').toBeEnabled();
    await c.resetFilters();
    expect(await c.period()).toBe(period);
    expect(await c.filterSelect(PROJECTS).inputValue()).toBe('');
  },
  11: async c => { await c.open(); for (const k of c.kpiLabels) await expectNothingHappens(c, at(c.page, XP.kpiCard(k)), k); },
  12: async c => {
    await c.openWith('last_12_months');
    for (const { table } of c.breakdowns) {
      const order = await table.column(table === c.byType ? 'Customer Type' : table === c.byResidence ? 'Country' : 'Nationality');
      for (let i = 0; i < 6; i++) await expectNothingHappens(c, table.root.locator('thead th').nth(i), `${table.heading} header ${i + 1}`);
      expect.soft(await table.column(order.length ? (table === c.byType ? 'Customer Type' : table === c.byResidence ? 'Country' : 'Nationality') : 'Customers'), `${table.heading}: order unchanged`).toEqual(order);
    }
  },
  13: async c => {
    await c.openWith('last_12_months');
    for (const { table } of c.breakdowns) {
      await expect.soft(table.root.locator('tbody a, tbody button'), `${table.heading}: no links`).toHaveCount(0);
      for (let i = 1; i < 6; i++) await expectNothingHappens(c, table.root.locator('tbody tr').first().locator('td').nth(i), `${table.heading} cell ${i + 1}`);
    }
  },
  14: async c => {
    await c.openWith('last_12_months');
    for (const { table } of c.breakdowns) await expectNothingHappens(c, at(c.page, XP.reportTableTotal(table.heading)).locator('td, th').nth(1), `${table.heading} Total`);
  },
  15: async c => {
    await c.openWith('last_12_months');
    await expectExport(c.byNationality, 'byNationality');
    await expectExport(c.byResidence, 'byResidence');
    await expectExport(c.byType, 'byType');
  },
  16: async c => {
    await c.openWith('last_12_months');
    const link = c.newCustomers.links.first();
    expect(await link.getAttribute('href')).toMatch(/^\/customers\?selected=/);
    await link.click();
    await expect(c.page).toHaveURL(/\/customers/);
    const form = at(c.page, XP.customerRecordForm);
    await expect(form).toBeVisible({ timeout: 15_000 });
    await expect(form).toContainText('Edit Customer');
    await form.getByRole('button', { name: 'Close' }).first().click();
    await expect(form).toBeHidden();
  },
  17: async c => {
    await c.openWith('last_12_months');
    const row = c.newCustomers.root.locator('tbody tr').first();
    for (let i = 1; i < LIST_COLUMNS.length; i++) await expectNothingHappens(c, row.locator('td').nth(i), LIST_COLUMNS[i]);
  },
  18: async c => {
    await c.openWith('last_12_months');
    const order = await c.newCustomers.column('Customer');
    for (let i = 0; i < LIST_COLUMNS.length; i++) await expectNothingHappens(c, c.newCustomers.root.locator('thead th').nth(i), `${LIST_COLUMNS[i]} header`);
    expect(await c.newCustomers.column('Customer'), 'Order unchanged').toEqual(order);
  },
  19: async c => { await c.openWith('last_12_months'); await expectExport(c.newCustomers, 'newList'); },
};

test.describe('Customer Reports · Clickable Map', () => {
  test('CR-MAP-00 Every row of the Clickable Map has a check', { tag: '@customer-workbook' }, () => {
    expect(MAP_ROWS.length, 'Rows on the sheet').toBe(Object.keys(CHECKS).length);
  });

  MAP_ROWS.forEach((_, i) => {
    test(...crMap(i + 1), async ({ customers }) => {
      test.setTimeout(180_000);
      const check = CHECKS[i + 1];
      expect(check, `No check for Clickable Map row ${i + 1}`).toBeTruthy();
      await check(customers);
    });
  });
});
