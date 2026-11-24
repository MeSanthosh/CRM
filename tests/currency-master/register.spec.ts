import { test, expect, note } from './fixtures';
import { currencyCase } from './catalog';

test.describe('Currency Master · register', () => {
  test(...currencyCase('CUR-001'), async ({ currency }) => {
    await currency.open();
    const cards = currency.page.locator('.crm-currency-kpi-card');
    const labels = await cards.locator('h3').allTextContents();
    note('currency summary', labels);
    expect(labels.map(label => label.trim())).toEqual(['Currencies', 'Active', 'Payment', 'Contract']);
  });

  test(...currencyCase('CUR-002'), async ({ currency }) => {
    await currency.open();
    const headers = await currency.currencyTable.locator('thead th').allTextContents();
    note('currency register columns', headers);
    expect(headers.map(header => header.replace(/[▲▼↕↑↓]/g, '').trim())).toEqual([
      'Currency', 'Policy Roles', 'Decimals', 'Status', 'Created Date', 'Actions',
    ]);
  });

  test(...currencyCase('CUR-003'), async ({ currency }) => {
    await currency.open();
    const anchor = currency.currencyRows.filter({ hasText: 'Base Anchor' });
    await expect(anchor, 'The base currency is identified as the Base Anchor').toHaveCount(1);
    await expect(anchor, 'The base anchor currency is active').toContainText('ACTIVE');
  });

  test(...currencyCase('CUR-004'), async ({ currency }) => {
    await currency.open();
    const firstCell = await currency.currencyRows.first().locator('td').first().innerText();
    const code = firstCell.trim().split(/\s+/)[0];
    await currency.currencySearch.fill(code.toLowerCase());
    await expect(currency.currencyRows, 'Searching by currency code is case-insensitive').toHaveCount(1);
    await expect(currency.currencyRows.first()).toContainText(code);
  });

  test(...currencyCase('CUR-005'), async ({ currency }) => {
    await currency.open();
    const firstCell = await currency.currencyRows.first().locator('td').first().innerText();
    const names = firstCell.split('\n').map(line => line.trim()).filter(Boolean);
    const name = names[names.length - 1];
    test.skip(!name, 'No currency name is available in the register to search for.');
    await currency.currencySearch.fill(name!);
    await expect(currency.currencyRows.first(), 'Searching by currency name returns its row').toContainText(name!);
  });

  test(...currencyCase('CUR-006'), async ({ currency }) => {
    await currency.open();
    await currency.page.locator('label').filter({ hasText: 'Active only' }).locator('input[type="checkbox"]').check();
    const rows = await currency.currencyRows.all();
    expect(rows.length, 'Active-only filter returns currencies').toBeGreaterThan(0);
    for (const row of rows) await expect(row, 'Every filtered currency is active').toContainText('ACTIVE');
  });

  test(...currencyCase('CUR-007'), async ({ currency }) => {
    await currency.open();
    await currency.page.getByRole('button', { name: 'New Currency' }).click();
    await expect(currency.page.getByRole('heading', { name: 'New Currency' })).toBeVisible();
    await expect(currency.page.getByPlaceholder('e.g. USD, EUR, KES')).toHaveValue('');
    await expect(currency.page.getByPlaceholder('e.g. United States Dollar')).toHaveValue('');
    await expect(currency.page.locator('input[name="decimalPlaces"]')).toHaveValue('2');
    await expect(currency.page.locator('select[name="status"]')).toHaveValue('ACTIVE');
    await expect(currency.page.getByLabel('Active in System')).toBeChecked();
  });

  test(...currencyCase('CUR-008'), async ({ currency, page }) => {
    const writes: string[] = [];
    page.on('request', request => {
      if (request.method() !== 'GET' && /\/api\/v1\/currencies(?:\?|$)/.test(request.url())) writes.push(request.url());
    });
    await currency.open();
    await page.getByRole('button', { name: 'New Currency' }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'New Currency' })).toHaveCount(0);
    expect(writes, 'Canceling a new currency does not send a write request').toEqual([]);
  });

  test(...currencyCase('CUR-009'), async ({ currency, page }) => {
    const writes: string[] = [];
    page.on('request', request => {
      if (request.method() !== 'GET' && /\/api\/v1\/currencies(?:\?|$)/.test(request.url())) writes.push(request.url());
    });
    await currency.open();
    await page.getByRole('button', { name: 'New Currency' }).click();
    await page.getByRole('button', { name: 'Create Currency' }).click();
    await expect(page.getByRole('heading', { name: 'New Currency' })).toBeVisible();
    await expect(page.getByPlaceholder('e.g. USD, EUR, KES')).toHaveValue('');
    expect(writes, 'The required empty currency form is not submitted').toEqual([]);
  });

  test(...currencyCase('CUR-010'), async ({ currency }) => {
    await currency.open();
    const row = currency.currencyRows.first();
    const code = (await row.locator('td').first().innerText()).trim().split(/\s+/)[0];
    await row.getByRole('button', { name: 'Edit' }).click();
    await expect(currency.page.getByRole('heading', { name: /Edit Currency/ })).toBeVisible();
    await expect(currency.page.getByPlaceholder('e.g. USD, EUR, KES')).toHaveValue(code);
    await expect(currency.page.getByPlaceholder('e.g. United States Dollar')).not.toHaveValue('');
  });
});
