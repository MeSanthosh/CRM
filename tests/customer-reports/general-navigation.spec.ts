/** Customer Reports workbook — General (CR-001…006) and Module tab bar (CR-007…009). */
import { test, expect } from '../pages/fixtures';
import { opensFromHub } from '../modules/checks';
import { MODULE_TABS } from '../pages/CustomerReportsPage';
import { cr } from './catalog';

const NO_AUTH = { cookies: [], origins: [] };
const BAD = /\bNaN\b|undefined|Infinity|\[object Object\]/;

test.describe('Customer Reports · General', () => {
  test(...cr('CR-001'), async ({ hub, customers }) => {
    await opensFromHub(hub, customers);
    await expect(customers.page).toHaveURL(/\/reports\/customers(\?.*)?$/);
    await expect.soft(customers.page.locator('main'), 'Intro text').toContainText('Customers by nationality, residence and type');
  });

  test(...cr('CR-002'), async ({ customers }) => {
    customers.watchErrors();
    await customers.open();
    for (const k of customers.kpiLabels) expect.soft(await customers.shown(k), k).not.toMatch(/^\s*$|NaN|undefined/);
    for (const t of customers.tableHeadings) await expect.soft(customers.table(t).root, t).toBeVisible();
    await customers.expectNoBrokenValues();
    customers.expectNoErrors();
  });

  test(...cr('CR-003'), async ({ customers }) => {
    await customers.open();
    await customers.backToHub();
  });

  test.describe('signed out', () => {
    test.use({ storageState: NO_AUTH });
    test(...cr('CR-004'), async ({ page }) => {
      await page.goto('/reports/customers');
      await expect(page, 'Sent to the login page').toHaveURL(/\/login/, { timeout: 20_000 });
      await expect(page.locator('main article.crm-card'), 'No KPI cards').toHaveCount(0);
    });
  });

  test(...cr('CR-005'), async ({ customers }) => {
    customers.watchErrors();
    await customers.open();
    await customers.setPeriod('this_month');
    await customers.setFilterIndex('All projects', 1);
    await customers.setView('Mine');
    await customers.setView('All');
    customers.expectNoErrors();
  });

  test(...cr('CR-006'), async ({ customers }) => {
    await customers.open();
    await expect.soft(customers.page.locator('main'), 'Intro').toContainText('Values in base currency');
    for (const k of ['SPA value', 'Average value per buyer']) expect.soft(await customers.shown(k), k).toMatch(/^\d[\d,.]*\s?[KMB]?\s?USD$|^—$/);
    for (const { table } of customers.breakdowns) {
      expect.soft(await table.headers(), table.heading).toContain('SPA Value (USD)');
      const values = await table.column('SPA Value (USD)');
      expect.soft(values.filter(v => !/USD$/.test(v)), `${table.heading}: values without USD`).toEqual([]);
    }
    await customers.expectNoBrokenValues();
    expect.soft(await customers.page.locator('main').innerText()).not.toMatch(BAD);
  });
});

test.describe('Customer Reports · Module tab bar', () => {
  test(...cr('CR-007'), async ({ customers }) => {
    await customers.open();
    expect(await customers.moduleTabLabels(), 'Tabs in order').toEqual(Object.keys(MODULE_TABS));
    await expect(customers.moduleTab('Customers'), 'Customers is active').toHaveClass(/is-active/);
  });

  test(...cr('CR-008'), async ({ customers, page }) => {
    for (const [tab, path] of Object.entries(MODULE_TABS).filter(([t]) => t !== 'Customers')) {
      await customers.open();
      await customers.moduleTab(tab).click();
      await expect.soft(page, `${tab} opens ${path}`).toHaveURL(new RegExp(`${path}(\\?.*)?$`));
    }
  });

  test(...cr('CR-009'), async ({ customers, page }) => {
    await customers.open();
    await customers.moduleTab('Sales').click();
    await expect(page).toHaveURL(/\/reports\/sales/);
    await page.goBack();
    await expect(page, 'Back returns to Customer Reports').toHaveURL(/\/reports\/customers/);
    await expect(customers.heading()).toBeVisible();
    expect(await customers.kpi('Active customers')).toBeGreaterThanOrEqual(0);
  });
});
