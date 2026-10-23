/** Customers & Brokers · Broker Register (CB-030…033) and New Broker validation (CB-034…038). Nothing is saved. */
import { test, expect, note, writesOf } from './fixtures';
import { cb } from './catalog';
import { BrokerRow } from './CustomersBrokersPage';

const digits = (s: string) => s.replace(/\D/g, '');
const creates = (w: string[]) => w.filter(x => /^POST .*\/api\/v1\/brokers$/.test(x));
const has = (r: BrokerRow, term: string) => [r.name, r.code, r.email, r.phone].some(v => v.toLowerCase().includes(term.toLowerCase())) || (!!digits(term) && digits(r.phone).includes(digits(term)));

test.describe('Customers & Brokers · Broker Register', () => {
  // ── CB-030 · Broker Register loads and shows every column
  // Area: Broker register › Register
  // Checks: Columns Broker, Contact, City, Plan, Status, Created Date; each row shows a name with its BRK-…
  //   code, phone and email
  test(...cb('CB-030'), async ({ cbp }) => {
    await cbp.open();
    await cbp.showTab('Brokers');
    expect.soft(await cbp.headers(), 'Columns').toEqual(cbp.brokerColumns);
    const rows = await cbp.brokerRows();
    expect(rows.length, 'Rows').toBeGreaterThan(0);
    for (const r of rows) {
      expect.soft(r.code, `${r.name} code`).toMatch(/^BRK-[\w-]+$/);
      expect.soft(r.name, `${r.code} name`).not.toBe('');
      expect.soft(r.status, `${r.code} status`).toMatch(/^[A-Z]+$/);
    }
  });

  // ── CB-031 · Search brokers by name, phone and email
  // Area: Broker register › Search
  // Checks: Each search lists that broker; a term with no match shows no rows
  test(...cb('CB-031'), async ({ cbp }) => {
    await cbp.open();
    await cbp.showTab('Brokers');
    const target = (await cbp.brokerRows())[0];
    // the phone is searched as typed (no spaces); searching it with the spaces shown on screen finds nothing
    for (const term of [target.name, target.phone.replace(/\s+/g, ''), target.email].filter(t => t && t !== '-')) {
      await cbp.search(term);
      const rows = await cbp.brokerRows();
      note(`search "${term}"`, rows.length);
      expect.soft(rows.map(r => r.code), `"${term}" finds ${target.code}`).toContain(target.code);
      expect.soft(rows.filter(r => !has(r, term)).map(r => r.name), `Rows not matching "${term}"`).toEqual([]);
    }
    await cbp.search(`zz-no-such-broker-${Date.now()}`);
    expect.soft(await cbp.brokerRows(), 'No match → no rows').toEqual([]);
  });

  // ── CB-032 · Sort brokers by name and Created Date
  // Area: Broker register › Sort
  // Checks: Default is newest first (Created Date ▼); Broker sorts alphabetically both ways
  test(...cb('CB-032'), async ({ cbp }) => {
    await cbp.open();
    await cbp.showTab('Brokers');
    expect.soft(await cbp.sortHeader('Created Date').getAttribute('aria-sort'), 'Default sort').toBe('descending');
    const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const dir of ['ascending', 'descending'] as const) {
      await cbp.sortTo('Broker', dir);
      const names = (await cbp.brokerRows()).map(r => r.name);
      const bad = names.slice(1).map((n, i) => [names[i], n]).filter(([a, b]) => (dir === 'ascending' ? 1 : -1) * key(a).localeCompare(key(b), 'en') > 0);
      expect.soft(bad.map(([a, b]) => `${a} before ${b}`), `Broker ${dir}`).toEqual([]);
    }
  });

  // ── CB-033 · Opening a broker shows its details
  // Area: Broker register › Edit Broker
  // Checks: Edit Broker shows the same name, mobile, email, city and commission plan as the row
  test(...cb('CB-033'), async ({ cbp }) => {
    await cbp.open();
    await cbp.showTab('Brokers');
    const row = (await cbp.brokerRows())[0];
    await cbp.openBroker(row.code);
    const form = {
      name: await cbp.brokerField('name').inputValue(), mobile: await cbp.brokerField('mobileNo').inputValue(),
      email: await cbp.brokerField('email').inputValue(), city: await cbp.brokerField('city').inputValue(), plan: await cbp.brokerField('commissionPlanCode').inputValue(),
    };
    note('form', { row, form });
    expect.soft(form.name, 'Name').toBe(row.name);
    expect.soft(digits(form.mobile), 'Mobile').toBe(digits(row.phone));
    expect.soft(form.email || '-', 'Email').toBe(row.email || '-');
    expect.soft(form.city || '-', 'City').toBe(row.city);
    expect.soft(form.plan || '-', 'Commission plan').toBe(row.plan);
  });
});

test.describe('Customers & Brokers · New Broker validation', () => {
  // ── CB-034 · New Broker opens the form
  // Area: Broker form › Create Broker
  // Checks: Form "Create Broker" with Broker Name (required), Registration No, Tax ID, Mobile, Email, Country,
  //   City, Commission Plan / %, Preferred Communication and Remarks
  test(...cb('CB-034'), async ({ cbp }) => {
    await cbp.open();
    await cbp.openNewBroker();
    const labels = (await cbp.brokerForm.locator('label .crm-label').allInnerTexts()).map(t => t.trim());
    note('fields', labels);
    expect.soft(labels, 'Fields').toEqual(['Broker Name', 'Registration No', 'Tax ID', 'Mobile', 'Email', 'Country', 'City', 'Commission Plan / %', 'Preferred Communication', 'Remarks']);
    await expect.soft(cbp.brokerForm.locator('.crm-label-required'), 'Only Broker Name is required').toHaveText(['Broker Name']);
  });

  for (const [id, fill, message] of [
    // ── CB-035 · Broker Name is required
    // Area: Broker form › Validation
    // Checks: "Broker Name is required."; nothing is saved
    ['CB-035', {}, 'Broker Name is required.'],
    // ── CB-036 · An invalid broker email is refused
    // Area: Broker form › Validation
    // Checks: "Email must be a valid email address (e.g. name@example.com)."; nothing is saved
    ['CB-036', { name: 'Automated test - not saved', email: 'not-an-email' }, 'Email must be a valid email address (e.g. name@example.com).'],
    // ── CB-037 · Commission must be between 0 and 100
    // Area: Broker form › Validation
    // Checks: "Commission must be a number between 0 and 100 (percent)."; nothing is saved
    ['CB-037', { name: 'Automated test - not saved', commissionPlanCode: '150%' }, 'Commission must be a number between 0 and 100 (percent).'],
  ] as const) {
    test(...cb(id), async ({ cbp, page }) => {
      await cbp.open();
      await cbp.openNewBroker();
      for (const [k, v] of Object.entries(fill)) await cbp.brokerField(k).fill(v);
      const writes = writesOf(page);
      expect(await cbp.submitBroker(3_000), 'Nothing saved').toBeNull();
      expect.soft(await cbp.brokerErrors(), 'Message').toContain(message);
      expect.soft(creates(writes), 'No broker created').toEqual([]);
    });
  }

  // ── CB-038 · Closing the form creates nothing
  // Area: Broker form › Create Broker
  // Checks: "Discard changes?" is asked; Keep editing keeps the name; Discard closes the form; nothing is sent
  //   and the Brokers card is unchanged
  test(...cb('CB-038'), async ({ cbp, page }) => {
    await cbp.open();
    const before = await cbp.card('Brokers');
    await cbp.openNewBroker();
    await cbp.brokerField('name').fill('Automated test - not saved');
    const writes = writesOf(page);
    await cbp.brokerForm.getByRole('button', { name: 'Close', exact: true }).click();
    const ask = await cbp.readNotice();
    expect.soft(ask.title, 'Asks before discarding').toBe('Discard changes?');
    await cbp.noticeButton('Keep editing');
    await expect.soft(cbp.brokerField('name'), 'Keep editing keeps the name').toHaveValue('Automated test - not saved');
    await cbp.brokerForm.getByRole('button', { name: 'Close', exact: true }).click();
    await cbp.noticeButton('Discard');
    await expect(cbp.brokerForm, 'Discard closes the form').toHaveCount(0);
    expect.soft(creates(writes), 'No broker created').toEqual([]);
    await cbp.open();
    expect.soft(await cbp.card('Brokers'), 'Brokers card unchanged').toBe(before);
  });
});
