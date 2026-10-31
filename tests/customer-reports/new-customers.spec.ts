/** Customer Reports workbook — New Customers in Period (CR-056…063). */
import { test, expect, note } from '../pages/fixtures';
import { num } from '../helpers';
import { XP, at, ROUTES } from '../locators';
import { LIST_COLUMNS } from '../pages/CustomerReportsPage';
import { cr } from './catalog';
import { shownDate, expectNothingHappens } from './shared';

const ID_FORMAT = /^CUST-\d{14}-[A-Z0-9]{4}$/;

test.describe('Customer Reports · New Customers in Period', () => {
  test(...cr('CR-056'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    expect(await customers.newCustomers.headers()).toEqual(LIST_COLUMNS);
  });

  test(...cr('CR-057'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    const rows = await customers.newCustomers.rows();
    const ids = rows.map(r => r['Customer']);
    note('rows', `${rows.length} customers listed`);
    expect.soft(rows.length, 'Rows = New in period').toBe(await customers.kpi('New in period'));
    expect.soft(ids.filter((v, i) => ids.indexOf(v) !== i), 'Customer IDs listed twice').toEqual([]);
    expect.soft(rows.filter(r => !r['Customer'] || !r['Name'] || !r['Created']).map(r => r['Customer'] || r['Name']), 'Rows without ID, name or Created date').toEqual([]);
  });

  test(...cr('CR-058'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    const dates = (await customers.newCustomers.column('Created')).map(d => shownDate(d).getTime());
    const up = dates.map((d, i) => (i && d > dates[i - 1] ? i : -1)).filter(i => i > 0);
    expect(up.slice(0, 10), 'Rows whose Created date is newer than the row above').toEqual([]);
  });

  test(...cr('CR-059'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    const ids = await customers.newCustomers.column('Customer');
    const odd = ids.filter(id => !ID_FORMAT.test(id.trim()));
    note('formats', `${ids.length - odd.length} of ${ids.length} as CUST-yyyymmddhhmmss-XXXX${odd.length ? `; others: ${odd.slice(0, 5).join(', ')}` : ''}`);
    expect(odd.slice(0, 10), 'Customer IDs in another format').toEqual([]);
  });

  test(...cr('CR-060'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    const bad = (await customers.newCustomers.rows()).filter(r => (num(r['SPAs']) === 0) !== (num(r['SPA Value (USD)']) === 0));
    expect(bad.map(r => `${r['Customer']}: SPAs ${r['SPAs']}, SPA Value ${r['SPA Value (USD)']}`).slice(0, 10)).toEqual([]);
  });

  test(...cr('CR-061'), async ({ customers, page }) => {
    await customers.openWith('last_12_months');
    const row = (await customers.newCustomers.rows())[0];
    const link = customers.newCustomers.links.first();
    expect(await link.innerText(), 'Link text = Customer ID').toBe(row['Customer']);
    expect.soft(await link.getAttribute('href'), 'Link target').toMatch(new RegExp(`^${ROUTES.customers}\\?selected=`));
    await link.click();
    await expect(page, 'Opens the Customers page').toHaveURL(/\/customers(\?.*)?$/);
    const form = at(page, XP.customerRecordForm);
    await expect(form, 'The customer\'s record opens').toBeVisible({ timeout: 15_000 });
    const values = await form.locator('input').evaluateAll(is => is.map(i => (i as HTMLInputElement).value.trim()).filter(Boolean));
    note('record', `${row['Customer']} ${row['Name']} → form fields: ${values.slice(0, 4).join(' | ')}`);
    expect.soft(values.some(v => v === row['Name']) || values.join(' ').includes(row['Name']), `Form shows ${row['Name']}`).toBeTruthy();
    // read-only suite: close without saving
    await form.getByRole('button', { name: 'Close' }).first().click();
    await expect(form, 'Closed without saving').toBeHidden();
  });

  test(...cr('CR-062'), async ({ customers, page }) => {
    await customers.openWith('last_12_months');
    const report = new Map((await customers.newCustomers.rows()).map(r => [r['Customer'], r]));
    await page.goto(ROUTES.customers);
    const rows = at(page, XP.customerRegisterRows);
    await expect(rows.first(), 'Customer Register').toBeVisible({ timeout: 15_000 });
    const register = await rows.evaluateAll(trs => trs.map(tr => [...tr.children].map(td => (td as HTMLElement).innerText.trim())));
    const diffs: string[] = [];
    let compared = 0;
    for (const cells of register) {
      const [name, id] = cells[0].split('\n').map(s => s.trim());
      const r = report.get(id);
      if (!r) continue;
      compared++;
      const created = cells[cells.length - 1].split(',')[0].trim();
      if (r['Name'] !== name) diffs.push(`${id}: name "${r['Name']}" vs "${name}"`);
      if (shownDate(r['Created']).getTime() !== shownDate(created).getTime()) diffs.push(`${id}: Created ${r['Created']} vs ${cells[cells.length - 1]}`);
    }
    note('compared', `${compared} customers on the register's first page`);
    expect.soft(compared, 'Customers found in both').toBeGreaterThan(0);
    expect(diffs.slice(0, 10), 'Report vs Customers register').toEqual([]);
  });

  test(...cr('CR-063'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    const row = customers.newCustomers.root.locator('tbody tr').first();
    await expect.soft(row.locator('a'), 'One link per row (the Customer ID)').toHaveCount(1);
    for (const [i, name] of LIST_COLUMNS.entries()) {
      if (i === 0) continue;
      await expectNothingHappens(customers, row.locator('td').nth(i), name);
    }
  });
});
