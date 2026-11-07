/**
 * Service Requests workbook — New request form: opening, fields, defaults, validation, Cancel (SR-032 … SR-045).
 * None of these tests creates a ticket; the create flow is in lifecycle.spec.ts.
 */
import { test, expect } from '../pages/fixtures';
import { SR_TEXT, SR_XP } from '../locators';
import type { NewRequest, ServiceRequestsPage } from '../pages/ServiceRequestsPage';
import { sr } from './catalog';

const SUBJECT = '[AUTO] validation check — not submitted';
const DESCRIPTION = 'Validation check from the Playwright suite (never submitted).';

/** Submits the form with one required field left out and checks only that field is reported. */
async function onlyMissing(srp: ServiceRequestsPage, missing: 'Customer' | 'Subject' | 'Description') {
  await srp.open();
  const creates = srp.countCreateCalls();
  await srp.openForm();
  const values: NewRequest = { customer: (await srp.customerOptions())[0], subject: SUBJECT, description: DESCRIPTION };
  delete values[missing.toLowerCase() as keyof NewRequest];
  await srp.fillForm(values);
  await srp.createButton.click();
  await expect(srp.fieldError(missing)).toHaveText(SR_TEXT.required(missing));
  for (const f of SR_TEXT.requiredFields.filter(f => f !== missing)) await expect.soft(srp.fieldError(f), `No message for ${f}`).toHaveCount(0);
  expect.soft(await srp.isInvalid(missing), `${missing} marked invalid`).toBeTruthy();
  expect(creates(), 'No ticket created (no POST)').toBe(0);
}

test.describe('Service Requests · New request', () => {
  test(...sr('SR-032'), async ({ serviceRequests: srp }) => {
    await srp.open();
    await srp.openForm('header');
    await expect.soft(srp.detailSubtitle).toHaveText(SR_TEXT.formSubtitle);
    await expect.soft(srp.cancelButton).toBeVisible();
  });

  test(...sr('SR-033'), async ({ serviceRequests: srp }) => {
    await srp.open();
    await srp.openForm('empty');
    await expect.soft(srp.detailSubtitle).toHaveText(SR_TEXT.formSubtitle);
  });

  test(...sr('SR-034'), async ({ serviceRequests: srp }) => {
    await srp.open();
    await srp.openForm();
    for (const f of SR_TEXT.formFields) {
      await expect.soft(srp.field(f), `Field ${f}`).toBeVisible();
      const label = srp.x(SR_XP.fieldLabel(f)).locator('span').first();
      if (SR_TEXT.requiredFields.includes(f)) await expect.soft(label, `${f} marked required`).toHaveClass(/crm-label-required/);
      else await expect.soft(label, `${f} not marked required`).not.toHaveClass(/crm-label-required/);
    }
    await expect.soft(srp.createButton).toHaveText('Create Request');
  });

  test(...sr('SR-035'), async ({ serviceRequests: srp }) => {
    await srp.open();
    await srp.openForm();
    const checked = (f: string) => srp.field(f).locator('option:checked');
    await expect.soft(checked('Customer'), 'Customer').toHaveText('Select customer');
    await expect.soft(checked('Type'), 'Type').toHaveText('General');
    await expect.soft(checked('Priority'), 'Priority').toHaveText('48 hours');
    await expect.soft(srp.field('Subject'), 'Subject').toHaveValue('');
    await expect.soft(srp.field('Description'), 'Description').toHaveValue('');
  });

  test(...sr('SR-036'), async ({ serviceRequests: srp }) => {
    await srp.open();
    await srp.openForm();
    const first = (await srp.options('Customer'))[0];
    const customers = await srp.customerOptions();
    expect.soft(first, 'First option').toBe('Select customer');
    expect(customers.length, 'At least one customer').toBeGreaterThan(0);
    expect.soft(customers.filter(c => !/^\S.* \([^()]+\)$/.test(c)), 'Not shown as "Name (Code)"').toEqual([]);
  });

  test(...sr('SR-037'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const [row] = await srp.rows();
    test.skip(!row, 'No ticket to compare with');
    await srp.openForm();
    const formTypes = (await srp.options('Type')).slice(1);
    const formPriorities = (await srp.options('Priority')).slice(1);
    await srp.openTicket(row.requestNo);
    const detailTypes = (await srp.options('Type')).slice(1);
    const detailPriorities = (await srp.options('Priority')).slice(1);
    expect.soft(formTypes, 'Type options = ticket detail').toEqual(detailTypes);
    expect.soft(formPriorities, 'Priority options = ticket detail').toEqual(detailPriorities);
    for (const p of ['24 hours', '48 hours']) expect.soft(formPriorities, `Priority includes "${p}"`).toContain(p);
    expect.soft(formTypes, 'Type includes "General"').toContain('General');
  });

  test(...sr('SR-038'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const creates = srp.countCreateCalls();
    await srp.openForm();
    await srp.createButton.click();
    for (const f of SR_TEXT.requiredFields) {
      await expect.soft(srp.fieldError(f), `${f} message`).toHaveText(SR_TEXT.required(f));
      expect.soft(await srp.isInvalid(f), `${f} marked invalid`).toBeTruthy();
    }
    await expect.soft(srp.field('Customer'), 'Focus moves to Customer').toBeFocused();
    await expect(srp.formTitle, 'Form stays open').toBeVisible();
    expect(creates(), 'No ticket created (no POST)').toBe(0);
  });

  test(...sr('SR-039'), ({ serviceRequests }) => onlyMissing(serviceRequests, 'Subject'));
  test(...sr('SR-040'), ({ serviceRequests }) => onlyMissing(serviceRequests, 'Description'));
  test(...sr('SR-041'), ({ serviceRequests }) => onlyMissing(serviceRequests, 'Customer'));

  test(...sr('SR-042'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const creates = srp.countCreateCalls();
    await srp.openForm();
    await srp.fillForm({ customer: (await srp.customerOptions())[0], subject: '   ', description: '   ' });
    await srp.createButton.click();
    await srp.page.waitForTimeout(1_000); // a POST, if any, is sent right away
    await expect.soft(srp.fieldError('Subject'), 'Subject message').toHaveText(SR_TEXT.required('Subject'));
    await expect.soft(srp.fieldError('Description'), 'Description message').toHaveText(SR_TEXT.required('Description'));
    expect(creates(), 'No ticket created (no POST)').toBe(0);
  });

  test(...sr('SR-043'), async ({ serviceRequests: srp }) => {
    await srp.open();
    await srp.openForm();
    await srp.createButton.click();
    await expect(srp.fieldError('Subject')).toBeVisible();
    await srp.field('Subject').fill('x');
    await expect.soft(srp.fieldError('Subject'), 'Subject message gone').toHaveCount(0);
    expect.soft(await srp.isInvalid('Subject'), 'Subject no longer invalid').toBeFalsy();
    await expect.soft(srp.fieldError('Customer'), 'Customer message stays').toBeVisible();
    await expect.soft(srp.fieldError('Description'), 'Description message stays').toBeVisible();
  });

  test(...sr('SR-044'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const count = await srp.queueCount();
    const creates = srp.countCreateCalls();
    await srp.openForm();
    await srp.fillForm({ customer: (await srp.customerOptions())[0], subject: SUBJECT, description: DESCRIPTION });
    await srp.cancelButton.click();
    await expect(srp.emptyState).toBeVisible();
    await expect(srp.formTitle).toBeHidden();
    await srp.page.waitForTimeout(1_000);
    expect.soft(await srp.queueCount(), 'Queue count unchanged').toBe(count);
    expect(creates(), 'No ticket created (no POST)').toBe(0);
  });

  test(...sr('SR-045'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const [row] = await srp.rows();
    test.skip(!row, 'No service requests in the queue');
    await srp.openForm();
    await srp.openTicket(row.requestNo);
    await expect(srp.formTitle).toBeHidden();
    await expect(srp.detailTitle).toHaveText(`${row.requestNo} — ${row.subject}`);
  });
});
