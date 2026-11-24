import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from '../pages/BasePage';
import { ROUTES } from '../locators';

export class CurrencyMasterPage extends BasePage {
  readonly path = ROUTES.currencyMaster;
  readonly name = 'Currency Master';

  constructor(page: Page) { super(page); }

  get currencyTable(): Locator { return this.page.locator('table.crm-currency-table'); }
  get currencyRows(): Locator { return this.currencyTable.locator('tbody tr'); }
  get currencySearch(): Locator { return this.page.getByPlaceholder('Search code, name, symbol'); }
  get exchangeRateTable(): Locator { return this.page.locator('.crm-table').last(); }
  get exchangeRateRows(): Locator { return this.exchangeRateTable.locator('tbody tr'); }

  async open() {
    await super.open();
    await expect(this.heading(), 'Currency Master page heading').toBeVisible();
    await expect(this.page.locator('.crm-currency-kpi-card'), 'Currency summary cards').toHaveCount(4);
    await expect(this.currencyTable, 'Currency register').toBeVisible();
  }

  async openTab(name: 'Currencies' | 'Policy' | 'Exchange Rates') {
    await this.page.locator('button.crm-tab-button')
      .filter({ hasText: new RegExp(`^${name}`) })
      .click();
  }
}
