import { test as base, expect } from '../auth';
import { CurrencyMasterPage } from './CurrencyMasterPage';

export { expect };

export const test = base.extend<{ currency: CurrencyMasterPage }>({
  currency: async ({ page }, use) => use(new CurrencyMasterPage(page)),
});

export const note = (type: string, description: unknown) =>
  test.info().annotations.push({
    type,
    description: typeof description === 'string' ? description : JSON.stringify(description),
  });
