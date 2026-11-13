import { test as base, expect } from '../auth';
import { ROUTES } from '../locators';
import { PreferencesPage } from '../pages/SecurityPages';

export { expect };

export const test = base.extend<{ preferences: PreferencesPage }>({
  preferences: async ({ page }, use) => use(new PreferencesPage(page, ROUTES.preferences)),
});

export const note = (type: string, description: unknown) =>
  test.info().annotations.push({
    type,
    description: typeof description === 'string' ? description : JSON.stringify(description),
  });
