import { test as base, expect } from '../auth';
import { ReferenceDataPage } from './ReferenceDataPage';

export { expect };

export const test = base.extend<{ referenceData: ReferenceDataPage }>({
  referenceData: async ({ page }, use) => use(new ReferenceDataPage(page)),
});

export const note = (type: string, description: unknown) =>
  test.info().annotations.push({
    type,
    description: typeof description === 'string' ? description : JSON.stringify(description),
  });
