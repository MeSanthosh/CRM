import { test, expect, note } from './fixtures';
import { currencyCase } from './catalog';

test.describe('Currency Master · exchange rates', () => {
  test(...currencyCase('CUR-014'), async ({ currency }) => {
    await currency.open();
    await currency.openTab('Exchange Rates');
    await expect(currency.page.getByRole('heading', { name: 'Exchange Rate Register' })).toBeVisible();
    const headers = await currency.exchangeRateTable.locator('thead th').allTextContents();
    note('exchange rate columns', headers);
    expect(headers.map(header => header.replace(/[▲▼↕↑↓]/g, '').trim())).toEqual([
      'Pair', 'Rate', 'Status', 'Rate Date', 'Source', 'Created By', 'Created Date',
    ]);
    await expect(currency.page.getByText(/Base Anchor:/)).toBeVisible();
  });

  test(...currencyCase('CUR-015'), async ({ currency }) => {
    await currency.open();
    await currency.openTab('Exchange Rates');
    const row = currency.exchangeRateRows.first();
    test.skip(!(await row.count()), 'No exchange-rate records are available to search.');
    const pair = (await row.locator('td').first().locator('strong').innerText()).trim();
    await currency.page.getByPlaceholder('Search pair (e.g. KES to USD, EUR)').fill(pair);
    await expect(currency.exchangeRateRows.first(), 'Searching by currency pair returns the matching rate').toContainText(pair);
  });

  test(...currencyCase('CUR-016'), async ({ currency }) => {
    await currency.open();
    await currency.openTab('Exchange Rates');
    await currency.page.locator('label').filter({ hasText: 'Active Rates only' }).locator('input[type="checkbox"]').check();
    const rows = await currency.exchangeRateRows.all();
    for (const row of rows) await expect(row, 'Active-rate results contain an active status').toContainText(/ACTIVE|LATEST/i);
  });

  test(...currencyCase('CUR-017'), async ({ currency, page }) => {
    const writes: string[] = [];
    page.on('request', request => {
      if (request.method() !== 'GET' && /\/api\/v1\/currencies\/exchange-rates(?:\?|$)/.test(request.url())) writes.push(request.url());
    });
    await currency.open();
    await currency.openTab('Exchange Rates');
    await page.getByRole('button', { name: /Add Exchange Rate/ }).click();
    await expect(page.getByPlaceholder('e.g. 1.08500000')).toBeVisible();
    await expect(page.getByPlaceholder('e.g. Central Bank, Reuters, Manual Entry')).toBeVisible();
    await expect(page.getByPlaceholder('e.g. Daily bulletin, Market quote #, Reference ID')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(writes, 'Canceling a new exchange rate does not send a write request').toEqual([]);
  });
});
