import { test, expect, note } from './fixtures';
import { referenceCase } from './shared';

test.describe('Reference Data Management', () => {
  test(...referenceCase('RDM-001'), async ({ referenceData }) => {
    await referenceData.open();
    const labels = await referenceData.summaryCards.locator('h3').allTextContents();
    const values = await referenceData.summaryCards.locator('.crm-kpi').allTextContents();
    note('reference data summary', Object.fromEntries(labels.map((label, index) => [label.trim(), values[index]?.trim()])));
    expect(labels.map(label => label.trim()), 'Summary card labels').toEqual(['Values', 'Categories', 'Families', 'Inactive']);
    for (const value of values) expect(value.trim(), 'Summary cards show whole-number counts').toMatch(/^\d+$/);
  });

  test(...referenceCase('RDM-002'), async ({ referenceData }) => {
    await referenceData.open();
    const headers = await referenceData.register.locator('thead th').allTextContents();
    note('reference register columns', headers);
    expect(headers.map(header => header.replace(/[▲▼↕↑↓]/g, '').trim()), 'Reference Register columns').toEqual([
      'Category', 'Group', 'Value Code', 'Value Name', 'Order', 'Status', 'Created Date', 'Actions',
    ]);
  });

  test(...referenceCase('RDM-003'), async ({ referenceData }) => {
    await referenceData.open();
    expect(await referenceData.categoryFilter.locator('option').count(), 'Category filter has configured options').toBeGreaterThan(1);
    expect(await referenceData.groupFilter.locator('option').count(), 'Group filter has configured options').toBeGreaterThan(1);
    await expect(referenceData.categoryFilter.locator('option').first()).toHaveText('All categories');
    await expect(referenceData.groupFilter.locator('option').first()).toHaveText('All groups');
  });

  test(...referenceCase('RDM-004'), async ({ referenceData }) => {
    await referenceData.open();
    const rowCount = await referenceData.rows.count();
    test.skip(!rowCount, 'No reference values are available to verify category and group filters.');
    const first = referenceData.rows.first();
    const category = (await first.locator('td').nth(0).innerText()).trim();
    const group = (await first.locator('td').nth(1).innerText()).trim().split(/\s+/)[0];
    note('filter values', { category, group });
    await referenceData.categoryFilter.selectOption(category);
    await expect(referenceData.rows.first().locator('td').nth(0), 'Selected category filters the register').toHaveText(category);
    await referenceData.groupFilter.selectOption(group);
    await expect(referenceData.rows, 'Category and group filters retain matching rows').not.toHaveCount(0);
    for (const row of await referenceData.rows.all()) {
      await expect(row.locator('td').nth(0), 'Every filtered row belongs to the selected category').toHaveText(category);
      await expect(row.locator('td').nth(1), 'Every filtered row belongs to the selected group').toContainText(group);
    }
  });

  test(...referenceCase('RDM-005'), async ({ referenceData }) => {
    await referenceData.open();
    const rowCount = await referenceData.rows.count();
    test.skip(!rowCount, 'No reference values are available to verify search.');
    const code = (await referenceData.rows.first().locator('td').nth(2).innerText()).trim();
    note('searched reference value code', code);
    await referenceData.search.fill(code.toLowerCase());
    await expect(referenceData.rows, 'Searching by a reference value code returns a result').not.toHaveCount(0);
    await expect(referenceData.rows.first().locator('td').nth(2), 'Search result contains the requested code').toContainText(code);
  });

  test(...referenceCase('RDM-006'), async ({ referenceData }) => {
    await referenceData.open();
    await referenceData.activeOnly.check();
    const rows = await referenceData.rows.all();
    note('active-only result count', rows.length);
    for (const row of rows) await expect(row.locator('td').nth(5), 'Active-only results have ACTIVE status').toHaveText('ACTIVE');
  });

  test(...referenceCase('RDM-007'), async ({ referenceData }) => {
    await referenceData.open();
    const pager = referenceData.page.getByText(/Showing .* values · Page \d+ of \d+/);
    await expect(pager, 'Reference register pagination summary').toBeVisible();
    const summary = await pager.innerText();
    const pageCount = Number(summary.match(/Page \d+ of (\d+)/)?.[1] ?? 1);
    test.skip(pageCount < 2, 'The live reference register fits on one page.');
    await referenceData.page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(pager, 'Next shows the following register page').toContainText(/Page 2 of/);
    await referenceData.page.getByRole('button', { name: 'Previous', exact: true }).click();
    await expect(pager, 'Previous returns to the first register page').toContainText(/Page 1 of/);
  });

  test(...referenceCase('RDM-008'), async ({ referenceData }) => {
    await referenceData.open();
    await referenceData.openForm('New Category');
    await expect(referenceData.page.locator('input[name="referenceCategory"]')).toHaveValue('');
    await expect(referenceData.page.locator('input[name="level1Code"]')).toHaveValue('');
    await expect(referenceData.page.locator('input[name="level1Name"]')).toHaveValue('');
    await expect(referenceData.page.locator('input[name="level2Code"]')).toHaveValue('');
    await expect(referenceData.page.locator('input[name="level2Name"]')).toHaveValue('');
    await expect(referenceData.page.locator('input[name="sortOrder"]')).toHaveValue('0');
    await expect(referenceData.page.locator('select[name="status"]')).toHaveValue('ACTIVE');
    await expect(referenceData.page.getByLabel('Available for application use')).toBeChecked();
    await referenceData.cancelForm();
  });

  test(...referenceCase('RDM-009'), async ({ referenceData }) => {
    await referenceData.open();
    await referenceData.openForm('New Group');
    expect(await referenceData.page.locator('select[name="referenceCategory"] option').count(), 'New Group lists configured categories').toBeGreaterThan(1);
    await expect(referenceData.page.locator('input[name="level1Code"]')).toHaveValue('');
    await expect(referenceData.page.locator('input[name="level1Name"]')).toHaveValue('');
    await expect(referenceData.page.locator('input[name="level2Code"]')).toHaveValue('');
    await expect(referenceData.page.locator('input[name="level2Name"]')).toHaveValue('');
    await expect(referenceData.page.locator('input[name="sortOrder"]')).toHaveValue('0');
    await referenceData.cancelForm();
  });

  test(...referenceCase('RDM-010'), async ({ referenceData }) => {
    await referenceData.open();
    const rowCount = await referenceData.rows.count();
    test.skip(!rowCount, 'No reference values are available to choose a category with a group.');
    const categoryName = (await referenceData.rows.first().locator('td').nth(0).innerText()).trim();
    await referenceData.openForm('New Reference Value');
    const category = referenceData.page.locator('select[name="referenceCategory"]');
    await expect(category.locator('option'), 'New Reference Value lists configured categories').not.toHaveCount(1);
    await category.selectOption({ label: categoryName });
    await expect.poll(
      () => referenceData.page.locator('select[name="level1Code"] option').count(),
      { message: 'Selecting a category loads its groups' },
    ).toBeGreaterThan(1);
    await expect(referenceData.page.locator('input[name="level2Code"]')).toHaveValue('');
    await expect(referenceData.page.locator('input[name="level2Name"]')).toHaveValue('');
    await expect(referenceData.page.locator('input[name="sortOrder"]')).toHaveValue('0');
    await referenceData.cancelForm();
  });

  test(...referenceCase('RDM-011'), async ({ referenceData, page }) => {
    const writes: string[] = [];
    page.on('request', request => {
      if (request.method() !== 'GET' && /\/api\/v1\/reference-data(?:[/?]|$)/.test(request.url())) writes.push(request.url());
    });
    await referenceData.open();
    await referenceData.openForm('New Category');
    await referenceData.cancelForm();
    await expect(page.getByRole('heading', { name: 'New Category', exact: true })).toHaveCount(0);
    expect(writes, 'Canceling New Category does not send a write request').toEqual([]);
  });

  test(...referenceCase('RDM-012'), async ({ referenceData, page }) => {
    const writes: string[] = [];
    page.on('request', request => {
      if (request.method() !== 'GET' && /\/api\/v1\/reference-data(?:[/?]|$)/.test(request.url())) writes.push(request.url());
    });
    await referenceData.open();
    await referenceData.openForm('New Group');
    await referenceData.cancelForm();
    await expect(page.getByRole('heading', { name: 'New Group', exact: true })).toHaveCount(0);
    expect(writes, 'Canceling New Group does not send a write request').toEqual([]);
  });

  test(...referenceCase('RDM-013'), async ({ referenceData, page }) => {
    const writes: string[] = [];
    page.on('request', request => {
      if (request.method() !== 'GET' && /\/api\/v1\/reference-data(?:[/?]|$)/.test(request.url())) writes.push(request.url());
    });
    await referenceData.open();
    await referenceData.openForm('New Reference Value');
    await referenceData.cancelForm();
    await expect(page.getByRole('heading', { name: 'New Reference Value', exact: true })).toHaveCount(0);
    expect(writes, 'Canceling New Reference Value does not send a write request').toEqual([]);
  });

  test(...referenceCase('RDM-014'), async ({ referenceData }) => {
    await referenceData.open();
    const rowCount = await referenceData.rows.count();
    test.skip(!rowCount, 'No reference values are available to verify the edit form.');
    const row = referenceData.rows.first();
    const code = (await row.locator('td').nth(2).innerText()).trim();
    await row.getByRole('button', { name: 'Edit' }).click();
    await expect(referenceData.page.getByRole('heading', { name: /Edit Reference Value/ })).toBeVisible();
    await expect(referenceData.page.locator('input[name="level2Code"]'), 'Edit form loads the selected value code').toHaveValue(code);
    await expect(referenceData.page.locator('input[name="level2Name"]'), 'Edit form loads the selected value name').not.toHaveValue('');
    await referenceData.cancelForm();
  });
});
