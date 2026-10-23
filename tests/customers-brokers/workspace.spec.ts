/** Customers & Brokers · Workspace (CB-001…005). Read-only. */
import { test, expect, note } from './fixtures';
import { cb } from './catalog';
import { ROUTES } from '../locators';
import { download } from '../helpers';

test.describe('Customers & Brokers · Workspace', () => {
  // ── CB-001 · Customers & Brokers opens from the side menu
  // Area: Workspace › Navigation
  // Checks: URL is /customers; eyebrow "CUSTOMERS & BROKERS", heading "Customer and Broker Workspace"; the
  //   Customers tab is selected
  test(...cb('CB-001'), async ({ cbp, page }) => {
    await page.goto(ROUTES.dashboard);
    await page.getByRole('link', { name: 'Customers & Brokers', exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.customers}(\\?.*)?$`));
    await expect(cbp.heading()).toBeVisible();
    await expect.soft(page.locator('main .crm-module-header .crm-eyebrow'), 'Eyebrow').toHaveText(/customers & brokers/i);
    await expect.soft(cbp.tab('Customers'), 'Customers tab selected').toHaveClass(/is-active/);
  });

  // ── CB-002 · Cards show loaded values
  // Area: Workspace › Cards
  // Checks: Every card shows a number; Active Customers ≤ Customers and Active Brokers ≤ Brokers
  test(...cb('CB-002'), async ({ cbp }) => {
    await cbp.open();
    const v = Object.fromEntries(await Promise.all(cbp.cards.map(async c => [c, await cbp.card(c)])));
    note('cards', v);
    for (const c of cbp.cards) expect.soft(v[c], c).toBeGreaterThanOrEqual(0);
    expect.soft(v['Active Customers'], 'Active Customers ≤ Customers').toBeLessThanOrEqual(v['Customers']);
    expect.soft(v['Active Brokers'], 'Active Brokers ≤ Brokers').toBeLessThanOrEqual(v['Brokers']);
  });

  // ── CB-003 · Customers and Brokers cards equal their registers
  // Area: Workspace › Cards
  // Checks: Customers card = Customer Register total; Brokers card = Broker Register total
  test(...cb('CB-003'), async ({ cbp }) => {
    await cbp.open();
    const customers = await cbp.card('Customers'), brokers = await cbp.card('Brokers');
    const listedCustomers = await cbp.total();
    await cbp.showTab('Brokers');
    const listedBrokers = await cbp.total();
    note('totals', { customers, listedCustomers, brokers, listedBrokers });
    expect.soft(listedCustomers, 'Customer Register total = Customers card').toBe(customers);
    expect.soft(listedBrokers, 'Broker Register total = Brokers card').toBe(brokers);
  });

  // ── CB-004 · Active cards count the active records
  // Area: Workspace › Cards
  // Checks: Active Customers = customers with status Active (not Prospect); Active Brokers = brokers with
  //   status ACTIVE
  test(...cb('CB-004'), async ({ cbp, page }) => {
    await cbp.open();
    const activeCustomers = await cbp.card('Active Customers'), activeBrokers = await cbp.card('Active Brokers');
    const file = await download(page, cbp.exportButton);
    const statuses = file.rows.reduce<Record<string, number>>((m, r) => { const k = String(r['Status'] ?? ''); m[k] = (m[k] ?? 0) + 1; return m; }, {});
    const active = Object.entries(statuses).filter(([k]) => /^active$/i.test(k)).reduce((a, [, n]) => a + n, 0);
    await cbp.showTab('Brokers');
    const info = await cbp.pagerInfo();
    const brokers = await cbp.brokerRows();
    note('statuses', { customers: statuses, activeCustomers, activeBrokers, brokersListed: brokers.length });
    expect.soft(active, 'Customers with status Active in the export = Active Customers').toBe(activeCustomers);
    if (!info || info.pages === 1) expect.soft(brokers.filter(b => b.status === 'ACTIVE').length, 'ACTIVE brokers = Active Brokers').toBe(activeBrokers);
  });

  // ── CB-005 · Tabs switch between the registers
  // Area: Workspace › Tabs
  // Checks: Brokers shows "Broker Register" with New Broker and the Brokers tab highlighted; Customers shows
  //   "Customer Register" again; the URL stays /customers
  test(...cb('CB-005'), async ({ cbp, page }) => {
    await cbp.open();
    await cbp.showTab('Brokers');
    await expect.soft(cbp.tab('Brokers'), 'Brokers highlighted').toHaveClass(/is-active/);
    await expect.soft(cbp.register.locator('h3'), 'Broker Register').toHaveText('Broker Register');
    await expect.soft(page.getByRole('button', { name: 'New Broker' }), 'New Broker').toBeVisible();
    await cbp.showTab('Customers');
    await expect.soft(cbp.tab('Customers'), 'Customers highlighted').toHaveClass(/is-active/);
    await expect.soft(cbp.register.locator('h3'), 'Customer Register').toHaveText('Customer Register');
    await expect.soft(page, 'URL unchanged').toHaveURL(new RegExp(`${ROUTES.customers}(\\?.*)?$`));
  });
});
