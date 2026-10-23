/** Customers & Brokers · Customer Register (CB-006…014), Customer detail (CB-015…019), edit validation (CB-020…023). Nothing is saved. */
import { test, expect, note, writesOf, editable } from './fixtures';
import { cb } from './catalog';
import { ROUTES, CB } from '../locators';
import { download, ymd } from '../helpers';
import { CustomerRow } from './CustomersBrokersPage';

const BAD = /^\s*$|NaN|undefined|Infinity|null/;
const digits = (s: string) => s.replace(/\D/g, '');
const patches = (w: string[]) => w.filter(x => /^PATCH /.test(x));
const EXPORT_COLUMNS = ['Customer Code', 'ERP Customer ID', 'Name', 'Mobile', 'WhatsApp', 'Email', 'City', 'Nationality', 'Country', 'Buyer Type',
  'Funding Source', 'Preferred Communication', 'Default Currency', 'Default Project', 'Status', 'Created At'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const when = (t: string) => { const m = t.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4}),?\s*(\d{1,2}):(\d{2})/)!; return new Date(+m[3], MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()), +m[1], +m[4], +m[5]).getTime(); };
const has = (r: CustomerRow, term: string) => [r.name, r.code, r.email, r.phone, digits(r.phone)].some(v => v.toLowerCase().includes(term.toLowerCase()));

test.describe('Customers & Brokers · Customer Register', () => {
  // ── CB-006 · Customer Register loads and shows every column
  // Area: Customer register › Register
  // Checks: Columns Customer, Contact, Buyer Type, Project, Status, Created Date; each row shows a name with
  //   its CUST-… code, phone and email; no JavaScript errors, failed API calls, NaN or undefined
  test(...cb('CB-006'), async ({ cbp }) => {
    cbp.watchErrors();
    await cbp.open();
    expect.soft(await cbp.headers(), 'Columns').toEqual(cbp.customerColumns);
    const rows = await cbp.customerRows();
    expect(rows.length, 'Rows on page 1').toBeGreaterThan(0);
    for (const r of rows) {
      expect.soft(r.code, 'Customer code').toMatch(/^CUST-[\w-]+$/);
      for (const k of ['name', 'phone', 'status', 'created'] as const) expect.soft(r[k], `${r.code} ${k}`).not.toMatch(BAD);
    }
    await cbp.expectNoBrokenValues();
    cbp.expectNoErrors();
  });

  // ── CB-007 · Pagination covers every customer
  // Area: Customer register › Register
  // Checks: N = Customers card; the last page ends at N and Next is disabled; N rows in all, none repeated
  test(...cb('CB-007'), async ({ cbp }) => {
    test.setTimeout(240_000);
    await cbp.open();
    const card = await cbp.card('Customers');
    expect.soft((await cbp.pagerInfo())?.total, 'Pager total = Customers card').toBe(card);
    await cbp.sortTo('Created Date', 'ascending');
    const rows = await cbp.allCustomerRows();
    const last = await cbp.pagerInfo();
    await expect.soft(cbp.pagerButton('Next'), 'Next disabled on the last page').toBeDisabled();
    expect.soft(last?.to, 'Last page ends at the total').toBe(last?.total);
    expect.soft(rows.length, 'Rows across all pages').toBe(last?.total);
    expect.soft(new Set(rows.map(r => r.code)).size, 'No customer listed twice').toBe(rows.length);
  });

  // ── CB-008 · Search by name, code, phone and email
  // Area: Customer register › Search
  // Checks: Each search lists that customer, and every row matches the term
  test(...cb('CB-008'), async ({ cbp }) => {
    await cbp.open();
    const target = (await cbp.customerRows())[1];
    // the phone is searched as typed (no spaces), e.g. "+254759994492"
    for (const term of [target.name, target.code, target.phone.replace(/\s+/g, ''), target.email].filter(Boolean)) {
      await cbp.search(term);
      const rows = await cbp.customerRows();
      note(`search "${term}"`, rows.length);
      expect.soft(rows.map(r => r.code), `"${term}" finds ${target.code}`).toContain(target.code);
      expect.soft(rows.filter(r => !has(r, term) && !has(r, digits(term) || term)).map(r => `${r.code} ${r.name}`), `Rows not matching "${term}"`).toEqual([]);
    }
  });

  // ── CB-009 · Search with no match shows an empty register
  // Area: Customer register › Search
  // Checks: No rows, an empty-state message, and Export disabled
  test(...cb('CB-009'), async ({ cbp }) => {
    await cbp.open();
    await cbp.search(`zz-no-such-customer-${Date.now()}`);
    expect(await cbp.customerRows(), 'No rows').toEqual([]);
    const empty = await cbp.emptyText();
    note('empty state', empty);
    expect.soft(empty, 'Empty-state message').toMatch(/no .*customers?|nothing/i);
    await expect.soft(cbp.exportButton, 'Export disabled').toBeDisabled();
  });

  // ── CB-010 · Clearing the search restores the register
  // Area: Customer register › Search
  // Checks: The box is empty and the total and page 1 are as before
  test(...cb('CB-010'), async ({ cbp }) => {
    await cbp.open();
    const total = await cbp.total(), page1 = (await cbp.customerRows()).map(r => r.code);
    await cbp.search((await cbp.customerRows())[0].name);
    await cbp.clearSearch();
    await expect.soft(cbp.searchBox, 'Search box emptied').toHaveValue('');
    expect.soft(await cbp.total(), 'Total as before').toBe(total);
    expect.soft((await cbp.customerRows()).map(r => r.code), 'Same page 1').toEqual(page1);
  });

  // ── CB-011 · Sort by Customer and Created Date
  // Area: Customer register › Sort
  // Checks: Default is newest first (Created Date ▼); Customer sorts alphabetically both ways; ascending
  //   Created Date gives oldest first
  test(...cb('CB-011'), async ({ cbp }) => {
    await cbp.open();
    expect.soft(await cbp.sortHeader('Created Date').getAttribute('aria-sort'), 'Default sort').toBe('descending');
    const created = (await cbp.customerRows()).map(r => when(r.created));
    expect.soft(created.slice(1).filter((t, i) => t > created[i]).length, 'Newest first').toBe(0);
    const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const dir of ['ascending', 'descending'] as const) {
      await cbp.sortTo('Customer', dir);
      const names = (await cbp.customerRows()).map(r => r.name);
      const bad = names.slice(1).map((n, i) => [names[i], n]).filter(([a, b]) => (dir === 'ascending' ? 1 : -1) * key(a).localeCompare(key(b), 'en') > 0);
      expect.soft(bad.map(([a, b]) => `${a} before ${b}`), `Customer ${dir}`).toEqual([]);
    }
    await cbp.sortTo('Created Date', 'ascending');
    const asc = (await cbp.customerRows()).map(r => when(r.created));
    expect.soft(asc.slice(1).filter((t, i) => t < asc[i]).length, 'Oldest first').toBe(0);
  });

  // ── CB-012 · Export downloads the Customer Register
  // Area: Customer register › Export
  // Checks: File "customers-<today>.xlsx" with columns Customer Code, ERP Customer ID, Name, Mobile, WhatsApp,
  //   Email, City, Nationality, Country, Buyer Type, Funding Source, Preferred Communication, Default Currency,
  //   Default Project, Status, Created At, and one row per customer (= Customers card)
  test(...cb('CB-012'), async ({ cbp, page }) => {
    await cbp.open();
    const card = await cbp.card('Customers');
    const file = await download(page, cbp.exportButton);
    note('file', { name: file.name, rows: file.rows.length, card });
    expect.soft(file.name, 'File name').toBe(`customers-${ymd(new Date())}.xlsx`);
    expect.soft(file.header, 'Columns').toEqual(EXPORT_COLUMNS);
    expect.soft(file.rows.length, 'One row per customer').toBe(card);
    expect.soft(new Set(file.rows.map(r => String(r['Customer Code']))).size, 'No customer twice').toBe(file.rows.length);
  });

  // ── CB-013 · Export follows the search
  // Area: Customer register › Export
  // Checks: The file holds exactly the customers listed for the search
  test(...cb('CB-013'), async ({ cbp, page }) => {
    await cbp.open();
    const term = (await cbp.customerRows())[1].name;
    await cbp.search(term);
    const listed = (await cbp.customerRows()).map(r => r.code).sort();
    const file = await download(page, cbp.exportButton);
    note('search export', { term, listed: listed.length, exported: file.rows.length });
    expect.soft(file.rows.map(r => String(r['Customer Code'])).sort(), `Exported for "${term}"`).toEqual(listed);
  });

  // ── CB-014 · Customers cannot be created by hand
  // Area: Customer register › Create
  // Checks: New Customer is disabled with the tooltip "Customers are created automatically through Lead
  //   qualification and conversion. Direct manual customer creation is disabled."
  test(...cb('CB-014'), async ({ cbp, page }) => {
    await cbp.open();
    const btn = page.locator(`xpath=${CB.newCustomer}`);
    await expect(btn, 'New Customer disabled').toBeDisabled();
    await expect.soft(btn, 'Explains why').toHaveAttribute('title', 'Customers are created automatically through Lead qualification and conversion. Direct manual customer creation is disabled.');
  });
});

test.describe('Customers & Brokers · Customer detail', () => {
  // ── CB-015 · Opening a customer shows its details
  // Area: Customer detail › Edit Customer
  // Checks: Edit Customer shows the same display name, mobile, email and buyer type as the row and the record;
  //   Created and Updated are shown; opening it changes nothing
  test(...cb('CB-015'), async ({ cbp, api }) => {
    await cbp.open();
    const row = (await cbp.customerRows())[0];
    const rec = await cbp.openCustomer(row.code);
    const form = {
      display: await cbp.customerField('displayName').inputValue(), mobile: await cbp.customerField('mobileNo').inputValue(),
      email: await cbp.customerField('email').inputValue(), buyer: (await cbp.customerField('buyerTypeRefId').locator('option:checked').innerText()).trim(),
    };
    note('form', form);
    expect.soft(form.display, 'Display name').toBe(row.name);
    expect.soft(digits(form.mobile), 'Mobile').toBe(digits(row.phone));
    expect.soft(form.email, 'Email').toBe(row.email);
    expect.soft(form.buyer, 'Buyer type').toBe(row.buyerType);
    expect.soft([rec.crmCustomerCode, rec.displayName], 'API record').toEqual([row.code, row.name]);
    await expect.soft(cbp.customerDialog.locator('dt', { hasText: /^Created$/ }), 'Created').toBeVisible();
    await expect.soft(cbp.customerDialog.locator('dt', { hasText: /^Updated$/ }), 'Updated').toBeVisible();
    expect.soft((await api.get(`/customers/${rec.id}`)).body.updatedAt, 'Opening it changed nothing').toBe(rec.updatedAt);
  });

  // ── CB-016 · Customer detail shows every section
  // Area: Customer detail › Edit Customer
  // Checks: Sections All Units, Agreed Packs, Payments & statement, Documents & KYC (with a "KYC: …" status),
  //   Communications and History
  test(...cb('CB-016'), async ({ cbp }) => {
    await cbp.open();
    await cbp.openCustomer((await cbp.customerRows())[0].code);
    for (const s of ['All Units', 'Agreed Packs', 'Payments & statement', 'Documents & KYC', 'Communications', 'History']) {
      await expect.soft(cbp.customerSection(s).first(), s).toBeVisible();
    }
    await expect.soft(cbp.kycBadge, 'KYC status').toHaveText(/^KYC: .+/);
  });

  // ── CB-017 · All Units lists the customer's opportunities
  // Area: Customer detail › All Units
  // Checks: Every opportunity of the customer is listed with its number, stage and lead
  test(...cb('CB-017'), async ({ cbp, api }) => {
    await cbp.open();
    let found = false;
    for (const row of (await cbp.customerRows()).slice(0, 6)) {
      const rec = await cbp.openCustomer(row.code);
      const shown = [...new Set(((await cbp.customerSection('All Units').innerText()).match(/OPP-[\w-]+/g) ?? []))].sort();
      if (shown.length) {
        const units = JSON.stringify((await api.get(`/customers/${rec.id}/units`)).body);
        const fromApi = [...new Set(units.match(/OPP-\d{14}-[A-Z0-9]{4}|OPP-\d{4}-\d{4}/g) ?? [])].sort();
        note('opportunities', { customer: row.code, shown, fromApi });
        expect.soft(shown, `${row.code}: All Units vs the customer's units`).toEqual(fromApi);
        found = true;
        break;
      }
      await cbp.closeCustomer();
    }
    test.skip(!found, 'None of the first customers has an opportunity');
  });

  // ── CB-018 · Record link (?selected=id) opens and keeps the customer open
  // Area: Customer detail › Edit Customer
  // Checks: That customer's window opens and stays open
  test(...cb('CB-018'), async ({ cbp, page }) => {
    await cbp.open();
    const row = (await cbp.customerRows())[0];
    await page.goto(row.href);
    await expect(cbp.customerDialog, 'Edit Customer opens').toBeVisible({ timeout: 20_000 });
    await expect(cbp.customerField('displayName')).toHaveValue(row.name);
    await page.waitForTimeout(3_000);
    await expect(cbp.customerDialog, 'Still open').toBeVisible();
  });

  // ── CB-019 · Link to a missing customer shows a message
  // Area: Customer detail › Edit Customer
  // Checks: A message says the customer was not found
  test(...cb('CB-019'), async ({ page }) => {
    await page.goto(`${ROUTES.customers}?selected=00000000-0000-0000-0000-000000000000`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByText(/not found|no longer (exists|available)|does not exist|unavailable|could not be (found|loaded)|no access/i).first(),
      'A message says the customer was not found').toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Customers & Brokers · Customer edit validation', () => {
  /** Opens the first customer whose names pass the form's rules. */
  async function openEditable(cbp: import('./CustomersBrokersPage').CustomersBrokersPage) {
    await cbp.open();
    const row = (await cbp.customerRows()).find(editable);
    test.skip(!row, 'No customer with a letters-only name on page 1');
    await cbp.openCustomer(row!.code);
    return row!;
  }

  // ── CB-020 · Mobile is required
  // Area: Customer edit › Validation
  // Checks: "Required Fields Missing — Mobile"; nothing is saved
  test(...cb('CB-020'), async ({ cbp, page }) => {
    await openEditable(cbp);
    const writes = writesOf(page);
    await cbp.customerField('mobileNo').fill('');
    expect(await cbp.saveCustomer(3_000), 'Nothing saved').toBeNull();
    const n = await cbp.readNotice();
    expect.soft(n.title, 'Notice').toBe('Required Fields Missing');
    expect.soft(n.body, 'Names Mobile').toContain('Mobile');
    await cbp.noticeButton('OK');
    expect.soft(patches(writes), 'No update sent').toEqual([]);
  });

  // ── CB-021 · Names may only contain letters
  // Area: Customer edit › Validation
  // Checks: "First Name may contain letters, spaces, apostrophes, and hyphens only."; nothing is saved
  test(...cb('CB-021'), async ({ cbp, page }) => {
    await openEditable(cbp);
    const writes = writesOf(page);
    const first = cbp.customerField('firstName');
    await first.fill(`${await first.inputValue()}2`);
    expect(await cbp.saveCustomer(3_000), 'Nothing saved').toBeNull();
    const n = await cbp.readNotice();
    expect.soft(n.body, 'Message').toContain('First Name may contain letters, spaces, apostrophes, and hyphens only.');
    await cbp.noticeButton('OK');
    expect.soft(patches(writes), 'No update sent').toEqual([]);
  });

  // ── CB-022 · An invalid email is refused
  // Area: Customer edit › Validation
  // Checks: A message asks for a valid email; nothing is saved
  test(...cb('CB-022'), async ({ cbp, page }) => {
    await openEditable(cbp);
    const writes = writesOf(page);
    const email = cbp.customerField('email');
    await email.fill('bad-email');
    expect(await cbp.saveCustomer(3_000), 'Nothing saved').toBeNull();
    const shown = (await cbp.notice.count()) ? (await cbp.readNotice()).body
      : (await email.evaluate(e => (e as HTMLInputElement).validationMessage)) || (await cbp.customerDialog.locator('.crm-field-error').allInnerTexts()).join(' ');
    note('message', shown || '(none)');
    expect.soft(shown, 'A message asks for a valid email').toMatch(/email|@/i);
    expect.soft(patches(writes), 'No update sent').toEqual([]);
  });

  // ── CB-023 · Closing without saving discards changes
  // Area: Customer edit › Edit Customer
  // Checks: "Discard changes? — You have unsaved changes in this form. Close it and discard them?"; Keep
  //   editing keeps the change; Discard closes the window; nothing is sent and the original remarks are shown
  //   again
  test(...cb('CB-023'), async ({ cbp, page }) => {
    const row = await openEditable(cbp);
    const original = await cbp.customerField('remarks').inputValue();
    const writes = writesOf(page);
    await cbp.customerField('remarks').fill(`${original} [unsaved]`);
    await cbp.page.locator(`xpath=${CB.customerClose}`).first().click();
    const ask = await cbp.readNotice();
    expect.soft(ask.title, 'Asks before discarding').toBe('Discard changes?');
    expect.soft(ask.body, 'Explains').toContain('You have unsaved changes in this form. Close it and discard them?');
    await cbp.noticeButton('Keep editing');
    await expect.soft(cbp.customerField('remarks'), 'Keep editing keeps the change').toHaveValue(`${original} [unsaved]`);
    await cbp.page.locator(`xpath=${CB.customerClose}`).first().click();
    await cbp.noticeButton('Discard');
    await expect(cbp.customerDialog, 'Discard closes the window').toHaveCount(0);
    await cbp.openCustomer(row.code);
    await expect.soft(cbp.customerField('remarks'), 'Original remarks').toHaveValue(original);
    expect.soft(patches(writes), 'Nothing sent').toEqual([]);
  });
});
