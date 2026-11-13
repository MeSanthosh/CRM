import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from '../pages/BasePage';
import { ROUTES } from '../locators';

export class ReferenceDataPage extends BasePage {
  readonly path = ROUTES.referenceData;
  readonly name = 'Reference Data Management';

  constructor(page: Page) { super(page); }

  get summaryCards(): Locator { return this.page.locator('main .crm-card').filter({ has: this.page.locator('h3') }); }
  get register(): Locator { return this.page.locator('table.crm-reference-table'); }
  get rows(): Locator { return this.register.locator('tbody tr'); }
  get categoryFilter(): Locator { return this.page.locator('main .crm-reference-filter-row select').nth(0); }
  get groupFilter(): Locator { return this.page.locator('main .crm-reference-filter-row select').nth(1); }
  get activeOnly(): Locator { return this.page.getByLabel('Active only'); }
  get search(): Locator { return this.page.getByPlaceholder('Search category, group, code, name'); }

  async open() {
    await super.open();
    await expect(this.heading(), 'Reference Data Management page heading').toBeVisible();
    await expect(this.summaryCards, 'Reference Data summary cards').toHaveCount(4);
    await expect(this.register, 'Reference Register table').toBeVisible();
  }

  async openForm(name: 'New Category' | 'New Group' | 'New Reference Value') {
    await this.page.getByRole('button', { name, exact: true }).click();
    await expect(this.page.getByRole('heading', { name, exact: true }), `${name} form opens`).toBeVisible();
  }

  async cancelForm() {
    await this.page.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
}
