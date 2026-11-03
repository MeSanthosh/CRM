/**
 * Customers & Brokers · saves on live QA data — runs in order in one worker:
 *   edit one customer's Remarks and put them back (CB-024, CB-025) → KYC validation, upload and delete
 *   (CB-026…029) → the test broker: create it only if it does not exist yet (CB-039, CB-040), then edit it and
 *   put the values back (CB-041).
 * Every change is undone in a finally block, through the UI first and the API as a fallback, so a failing step
 * leaves nothing behind. Creating a broker also creates a broker portal login, so only one test broker is ever made.
 */
import { Response } from '@playwright/test';
import { test, expect, note, writesOf, editable, testFile, restoreRemarks, state, save, TEST_BROKER, EDIT_MARK } from './fixtures';
import { cb, cbSkipped } from './catalog';
import { CustomersBrokersPage } from './CustomersBrokersPage';
import { CrmApi } from '../opportunities/api';

test.describe.configure({ mode: 'default' });

const isDelete = (r: Response) => /\/api\/v1\/kyc\/documents\/[0-9a-f-]{36}$/.test(r.url()) && r.request().method() === 'DELETE';

/** The customer the KYC steps use (the one CB-024 edited, or the first editable one). */
async function kycCustomer(cbp: CustomersBrokersPage) {
  const s = state();
  if (s.customerCode) return s.customerCode;
  await cbp.open();
  const row = (await cbp.customerRows()).find(editable);
  test.skip(!row, 'No customer with a letters-only name on page 1');
  save({ customerCode: row!.code });
  return row!.code;
}

/** Removes any document this run uploaded (matched by its AUTOTEST number) through the API. */
async function cleanupKyc(api: CrmApi, customerId: string | undefined, number: string | undefined) {
  if (!customerId || !number) return;
  const docs = (await api.get(`/kyc/customers/${customerId}`)).body?.documents ?? [];
  for (const d of docs.filter((x: any) => x.documentNumber === number)) {
    const r = await api.call('DELETE', `/kyc/documents/${d.id}`);
    note('cleanup', `deleted KYC document ${number}: ${r.status}`);
  }
}

test.describe('Customers & Brokers · Saves (live QA data)', () => {
  // ── CB-024 · Editing a customer saves the change
  // Area: Customer edit › Edit Customer
  // Checks: PATCH succeeds and the window closes; reopened, the remarks show the change, Updated moves on and
  //   History lists the remarks change; the original text is restored afterwards
  test(...cb('CB-024'), async ({ cbp, api, page }) => {
    await cbp.open();
    const row = (await cbp.customerRows()).find(editable);
    test.skip(!row, 'No customer with a letters-only name on page 1');
    const rec = await cbp.openCustomer(row!.code);
    save({ customerId: rec.id, customerCode: row!.code });
    const original = await cbp.customerField('remarks').inputValue();
    const updatedBefore = (await cbp.customerDialog.locator('dt', { hasText: /^Updated$/ }).locator('xpath=following-sibling::dd').innerText()).trim();
    try {
      await cbp.customerField('remarks').fill(`${original}${EDIT_MARK}`);
      const res = await cbp.saveCustomer();
      expect(res?.status(), 'PATCH /customers/<id>').toBeLessThan(300);
      await expect.soft(cbp.customerDialog, 'Window closes after saving').toHaveCount(0, { timeout: 10_000 });
      await page.waitForTimeout(1_000); // the minute shown in Updated must be able to move on
      await cbp.open();
      await cbp.openCustomer(row!.code);
      await expect.soft(cbp.customerField('remarks'), 'Saved remarks').toHaveValue(`${original}${EDIT_MARK}`);
      const updatedAfter = (await cbp.customerDialog.locator('dt', { hasText: /^Updated$/ }).locator('xpath=following-sibling::dd').innerText()).trim();
      note('updated', { before: updatedBefore, after: updatedAfter });
      await cbp.customerSection('History').getByRole('button', { name: 'Refresh' }).click().catch(() => {});
      await expect.soft(cbp.customerSection('History'), 'History lists the change').toContainText(/Remarks/, { timeout: 10_000 });
      // put the original text back through the form
      await cbp.customerField('remarks').fill(original);
      expect.soft((await cbp.saveCustomer())?.status(), 'Original remarks saved back').toBeLessThan(300);
    } finally {
      await restoreRemarks(api, rec.id, original);
    }
  });

  // ── CB-025 · A customer created from a lead can be edited
  // Area: Customer edit › Edit Customer
  // Checks: The change is saved — the name the system gave the customer must not block other edits
  test(...cb('CB-025'), async ({ cbp, api }) => {
    await cbp.open();
    const row = (await cbp.customerRows()).find(r => /\d/.test(r.name)) ?? (await (async () => { await cbp.search('Enquiry'); return (await cbp.customerRows()).find(r => /\d/.test(r.name)); })());
    test.skip(!row, 'No customer created from a lead with digits in its name');
    note('customer', `${row!.code} "${row!.name}"`);
    const rec = await cbp.openCustomer(row!.code);
    const original = await cbp.customerField('remarks').inputValue();
    try {
      await cbp.customerField('remarks').fill(`${original}${EDIT_MARK}`);
      const res = await cbp.saveCustomer(5_000);
      if (!res && await cbp.notice.count()) {
        const n = await cbp.readNotice();
        note('refused', n.body);
        await cbp.noticeButton(n.title === 'Invalid Entry' ? 'OK' : (await cbp.notice.getByRole('button').last().innerText()).trim());
      }
      expect(res?.status(), 'Remarks of a customer created from a lead can be saved').toBeLessThan(300);
    } finally {
      await restoreRemarks(api, rec.id, original);
    }
  });

  // ── CB-026 · KYC upload validation
  // Area: KYC › Upload
  // Checks: "Choose the document type." then "Enter the Passport number."; nothing is uploaded
  test(...cb('CB-026'), async ({ cbp, page }) => {
    const code = await kycCustomer(cbp);
    await cbp.open();
    await cbp.openCustomer(code);
    const writes = writesOf(page);
    expect.soft(await cbp.uploadKyc({}, 3_000), 'Nothing uploaded without a type').toBeNull();
    await expect.soft(cbp.kycSection, 'No type').toContainText('Choose the document type.');
    expect.soft(await cbp.uploadKyc({ type: 'Passport' }, 3_000), 'Nothing uploaded without a number').toBeNull();
    await expect.soft(cbp.kycSection, 'No number').toContainText('Enter the Passport number.');
    expect.soft(writes, 'Nothing sent').toEqual([]);
  });

  // ── CB-027 · KYC accepts only PDF, JPG or PNG
  // Area: KYC › Upload
  // Checks: The file is refused with a message; nothing is uploaded
  test(...cb('CB-027'), async ({ cbp, api }) => {
    const code = await kycCustomer(cbp);
    const number = `AUTOTEST-TXT-${Date.now()}`;
    await cbp.open();
    const rec = await cbp.openCustomer(code);
    try {
      const res = await cbp.uploadKyc({ type: 'Passport', number, expiryNextMonthDay: 15, file: testFile('notes.txt') }, 5_000);
      const told = (await cbp.kycSection.locator('.crm-field-error, .crm-error-text, [role="alert"]').allInnerTexts()).join(' ')
        || ((await cbp.notice.count()) ? (await cbp.readNotice()).body : '');
      note('message', told || '(none)');
      expect.soft(res === null || res.status() >= 400, `.txt refused (got ${res?.status() ?? 'no request'})`).toBe(true);
      expect.soft(told, 'Message about the file type').toMatch(/pdf|jpg|png|file/i);
      if (await cbp.notice.count()) await cbp.notice.getByRole('button').last().click();
    } finally {
      await cleanupKyc(api, rec.id, number);
    }
  });

  // ── CB-028 · Uploading a KYC document
  // Area: KYC › Upload
  // Checks: The document is listed as "Passport · <number>", "Expires <date>", file name and size, "Pending
  //   review", with Verify, Reject and Delete; KYC status becomes "Under Review"
  test(...cb('CB-028'), async ({ cbp, api }) => {
    const code = await kycCustomer(cbp);
    const number = `AUTOTEST-${Date.now()}`;
    await cbp.open();
    const rec = await cbp.openCustomer(code);
    save({ customerId: rec.id, customerCode: code, kycNumber: number });
    const res = await cbp.uploadKyc({ type: 'Passport', number, expiryNextMonthDay: 15, file: testFile('kyc-passport.pdf') });
    expect(res?.status(), 'POST /kyc/customers/<id>/documents').toBeLessThan(300);
    const item = cbp.kycSection.locator('li, .crm-kyc-document, .crm-document-item').filter({ hasText: number }).first();
    await expect(item, 'Document listed').toBeVisible();
    note('document', (await item.innerText()).replace(/\s+/g, ' '));
    await expect.soft(item, 'Type and number').toContainText(`Passport · ${number}`);
    await expect.soft(item, 'Expiry').toContainText(/Expires \d{2} \w{3,4} \d{4}/);
    await expect.soft(item, 'File').toContainText(/kyc-passport\.pdf \(\d+ B\)/);
    await expect.soft(item, 'Review state').toContainText('Pending review');
    for (const b of ['Verify', 'Reject', 'Delete']) await expect.soft(item.getByRole('button', { name: b }), b).toBeVisible();
    await expect.soft(cbp.kycBadge, 'KYC status').toHaveText('KYC: Under Review');
    expect.soft((await api.get(`/kyc/customers/${rec.id}`)).body?.status?.name, 'API KYC status').toBe('Under Review');
  });

  // ── CB-029 · Deleting a KYC document
  // Area: KYC › Delete
  // Checks: "Delete KYC document? … Keep / Delete"; Keep leaves it; Delete removes it and KYC goes back to "Not
  //   Started"
  test(...cb('CB-029'), async ({ cbp, api, page }) => {
    const s = state();
    test.skip(!s.kycNumber || !s.customerCode, 'Not run: depends on CB-028 (upload a KYC document), which did not complete in this run. Fix that step first; this test case was not checked.');
    await cbp.open();
    const rec = await cbp.openCustomer(s.customerCode!);
    try {
      const item = () => cbp.kycSection.locator('li, .crm-kyc-document, .crm-document-item').filter({ hasText: s.kycNumber! }).first();
      await item().getByRole('button', { name: 'Delete' }).click();
      const ask = await cbp.readNotice();
      expect.soft(ask.title, 'Confirmation').toBe('Delete KYC document?');
      expect.soft(ask.body, 'Names the document').toContain(`Passport ${s.kycNumber}`);
      await cbp.noticeButton('Keep');
      await expect.soft(item(), 'Keep leaves it').toBeVisible();
      await item().getByRole('button', { name: 'Delete' }).click();
      const deleted = page.waitForResponse(isDelete);
      await cbp.noticeButton('Delete');
      expect((await deleted).status(), 'DELETE /kyc/documents/<id>').toBeLessThan(300);
      await expect.soft(item(), 'Removed').toHaveCount(0);
      const docs = (await api.get(`/kyc/customers/${rec.id}`)).body?.documents ?? [];
      if (!docs.length) await expect.soft(cbp.kycBadge, 'KYC back to Not Started').toHaveText('KYC: Not Started');
    } finally {
      await cleanupKyc(api, rec.id, s.kycNumber);
    }
  });

  // ── CB-039 · Creating a broker (one test broker, reused)
  // Area: Broker save › Create Broker
  // Checks: If created: POST succeeds, the broker is listed ACTIVE with its BRK code and values, Brokers +1. If
  //   it already exists, the existing test broker is checked instead (no new broker, so no new portal login)
  test(...cb('CB-039'), async ({ cbp, api }) => {
    await cbp.open();
    const before = await cbp.card('Brokers');
    await cbp.showTab('Brokers');
    await cbp.search(TEST_BROKER);
    const existing = (await cbp.brokerRows()).find(r => r.name.startsWith(TEST_BROKER));
    if (existing) {
      const rec = ((await api.get(`/brokers?search=${encodeURIComponent(existing.code)}&limit=5&offset=0`)).body.items ?? []).find((b: any) => b.brokerCode === existing.code);
      save({ brokerCode: existing.code, brokerId: rec?.id, brokerCreated: false });
      note('reused', `${existing.name} (${existing.code}) already exists, so no new broker or portal login was created`);
      expect.soft(existing.status, 'Test broker active').toBe('ACTIVE');
      expect.soft(existing.code, 'Broker code').toMatch(/^BRK-[\w-]+$/);
      return;
    }
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 12);
    const name = `${TEST_BROKER} ${stamp}`;
    await cbp.openNewBroker();
    await cbp.brokerField('name').fill(name);
    await cbp.brokerField('mobileNo').fill('+254700000000');
    await cbp.brokerField('email').fill(`autotest.${stamp}@example.com`);
    await cbp.brokerField('commissionPlanCode').fill('2');
    await cbp.brokerField('remarks').fill('Automated test - Customers & Brokers');
    const res = await cbp.submitBroker();
    expect(res?.status(), 'POST /brokers').toBeLessThan(300);
    const body = await res!.json();
    save({ brokerCode: body.brokerCode, brokerId: body.id, brokerCreated: true });
    // the portal credentials dialog appears right away: record it for CB-040, then close it
    await expect(cbp.credentials, 'Broker Portal Credentials').toBeVisible();
    const c = cbp.credentials;
    const username = (await c.getByText(/^brk-/i).first().innerText()).trim();
    const masked = (await c.getByText(/^•+$/).first().innerText().catch(() => '')).trim();
    await c.getByRole('button', { name: 'Show' }).click();
    const revealed = (await c.innerText()).match(/Temporary Password:\s*(\S+)/)?.[1] ?? '';
    save({ ...state(), credentials: { username, masked: /^•+$/.test(masked), revealed: !!revealed && !/^•+$/.test(revealed), note: (await c.innerText()).includes('First Login Requirement'), copy: await c.getByRole('button', { name: 'Copy Credentials' }).count() > 0 } } as any);
    await c.getByRole('button', { name: 'Done' }).click();
    await expect(c).toHaveCount(0);
    await cbp.open();
    expect.soft(await cbp.card('Brokers'), 'Brokers +1').toBe(before + 1);
    await cbp.showTab('Brokers');
    await cbp.search(name);
    const row = (await cbp.brokerRows())[0];
    note('created', row);
    expect.soft([row?.name, row?.code, row?.plan, row?.status], 'Listed with its values').toEqual([name, body.brokerCode, '2', 'ACTIVE']);
  });

  // ── CB-040 · Creating a broker shows the portal credentials
  // Area: Broker save › Portal login
  // Checks: Username = the BRK code in lower case; the temporary password is masked until Show; "First Login
  //   Requirement" note; Copy Credentials and Done
  test(...cb('CB-040'), async () => {
    const s = state() as any;
    test.skip(s.brokerCreated !== true, 'The portal credentials appear only when a broker is created; the test broker already existed, so none was created in this run (CB-039 reuses it to avoid a new portal login).');
    const c = s.credentials ?? {};
    note('credentials', c);
    expect.soft(c.username, 'Username = broker code in lower case').toBe(String(s.brokerCode).toLowerCase());
    expect.soft(c.masked, 'Password masked').toBe(true);
    expect.soft(c.revealed, 'Show reveals it').toBe(true);
    expect.soft(c.note, '"First Login Requirement" note').toBe(true);
    expect.soft(c.copy, 'Copy Credentials offered').toBe(true);
  });

  // ── CB-041 · Editing a broker saves the change
  // Area: Broker save › Edit Broker
  // Checks: PATCH succeeds; the register shows the new city; reopened, the form shows the new values; the
  //   original values are restored afterwards
  test(...cb('CB-041'), async ({ cbp, api }) => {
    const s = state();
    test.skip(!s.brokerCode, 'Not run: depends on CB-039 (find or create the test broker), which did not complete in this run. Fix that step first; this test case was not checked.');
    await cbp.open();
    await cbp.openBroker(s.brokerCode!);
    const original = { city: await cbp.brokerField('city').inputValue(), remarks: await cbp.brokerField('remarks').inputValue() };
    const city = original.city === 'Watamu' ? 'Malindi' : 'Watamu';
    try {
      await cbp.brokerField('city').fill(city);
      await cbp.brokerField('remarks').fill(`${original.remarks}${EDIT_MARK}`);
      const res = await cbp.submitBroker();
      expect(res?.status(), 'PATCH /brokers/<id>').toBeLessThan(300);
      await cbp.open();
      await cbp.showTab('Brokers');
      await cbp.search(s.brokerCode!);
      expect.soft((await cbp.brokerRows())[0]?.city, 'Register shows the new city').toBe(city);
      await cbp.openBroker(s.brokerCode!);
      await expect.soft(cbp.brokerField('city'), 'Saved city').toHaveValue(city);
      await expect.soft(cbp.brokerField('remarks'), 'Saved remarks').toHaveValue(`${original.remarks}${EDIT_MARK}`);
      // put the original values back through the form
      await cbp.brokerField('city').fill(original.city);
      await cbp.brokerField('remarks').fill(original.remarks);
      expect.soft((await cbp.submitBroker())?.status(), 'Original values saved back').toBeLessThan(300);
    } finally {
      const id = s.brokerId;
      if (id) {
        const cur = (await api.get(`/brokers/${id}`)).body;
        if ((cur.city ?? '') !== original.city || (cur.remarks ?? '') !== original.remarks) {
          const r = await api.call('PATCH', `/brokers/${id}`, { city: original.city || null, remarks: original.remarks });
          note('restored broker', r.status);
        }
      }
    }
  });

  // ── CB-045 · Verify and Reject a KYC document
  // Area: KYC › Review
  // Checks: Verify sets the document Verified and the KYC status follows; Reject asks for a reason and marks it
  //   Rejected
  test(...cbSkipped('CB-045', 'Verify / Reject would change a real customer\'s KYC review status, which the test cannot undo.'));
});
