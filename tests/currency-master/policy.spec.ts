import { test, expect, note } from './fixtures';
import { currencyCase } from './catalog';

test.describe('Currency Master · policy', () => {
  test(...currencyCase('CUR-011'), async ({ currency }) => {
    await currency.open();
    await currency.openTab('Policy');
    await expect(currency.page.getByText('Organization Currency Policy', { exact: false })).toBeVisible();
    await expect(currency.page.getByRole('heading', { name: /Core Organization Currency/ })).toBeVisible();
    await expect(currency.page.getByText('Base Ledger:', { exact: false })).toBeVisible();
    await expect(currency.page.getByText('Contract Settlement:', { exact: false })).toBeVisible();
    await expect(currency.page.getByText('Local Operating:', { exact: false })).toBeVisible();
  });

  test(...currencyCase('CUR-012'), async ({ currency }) => {
    await currency.open();
    const contractText = await currency.page.locator('.crm-currency-kpi-card').filter({ hasText: 'Contract' }).innerText();
    const contractCurrencies = contractText.split('\n').map(line => line.trim()).filter(line => /^[A-Z]{3}$/.test(line));
    const contractCurrency = contractCurrencies[contractCurrencies.length - 1];
    await currency.openTab('Policy');
    const baseCurrency = currency.page.locator('select').first();
    await expect(baseCurrency, 'The operating currency policy has a selected currency').toHaveValue(/^[A-Z]{3}$/);
    const selected = await baseCurrency.locator('option:checked').innerText();
    note('base currency policy', { selected, contractCurrency });
    expect(await baseCurrency.inputValue(), 'The contract currency matches the operating currency policy').toBe(contractCurrency);
    expect(selected).toContain(await baseCurrency.inputValue());
  });

  test(...currencyCase('CUR-013'), async ({ currency }) => {
    await currency.open();
    await currency.openTab('Policy');
    await expect(currency.page.getByText('Payment Acceptance', { exact: false })).toBeVisible();
    await expect(currency.page.getByText('Reporting Currencies', { exact: true })).toBeVisible();
    await expect(currency.page.getByText('Max Reporting Currencies Limit', { exact: false })).toBeVisible();
  });
});
