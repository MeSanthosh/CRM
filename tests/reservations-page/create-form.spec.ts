/** Unit Reservations · New Reservation form and unit picker (UR-025…030). Nothing is saved. */
import { test, expect, note, writesOf } from './fixtures';
import { ur } from './catalog';
import { RSV } from '../locators';
import { ymd } from '../helpers';

const creates = (writes: string[]) => writes.filter(w => /^POST .*\/api\/v1\/reservations$/.test(w));

test.describe('Reservations · New Reservation form', () => {
  // ── UR-025 · New Reservation opens the form with defaults
  // Area: Create form › Create Reservation
  // Checks: Dialog "Create Reservation" with "Only opportunities at Reservation Ready stage can be reserved.";
  //   fields Opportunity *, Unit * (Choose Unit), Amount (USD), Currency = USD (read-only), Expiry = today + 30
  //   days, Remarks; buttons Close and Create Reservation
  test(...ur('UR-025'), async ({ rsv }) => {
    await rsv.open();
    await rsv.openNew();
    const f = rsv.createForm;
    await expect.soft(f, 'Hint').toContainText('Only opportunities at Reservation Ready stage can be reserved.');
    const labels = (await f.locator('label .crm-label').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
    note('fields', labels);
    expect.soft(labels, 'Fields').toEqual(['Opportunity *', 'Unit *', 'Amount (USD)', 'Currency', 'Expiry', 'Remarks']);
    await expect.soft(f.locator(RSV.formCurrency), 'Currency').toHaveValue('USD');
    await expect.soft(f.locator(RSV.formCurrency), 'Currency read-only').not.toBeEditable();
    const expiry = new Date(); expiry.setDate(expiry.getDate() + 30);
    await expect.soft(f.locator(RSV.formExpiry), 'Expiry = today + 30 days').toHaveValue(ymd(expiry));
    await expect.soft(f.locator(RSV.formChooseUnit), 'Choose Unit').toBeVisible();
    await expect.soft(f.getByRole('button', { name: 'Create Reservation' }), 'Create button').toBeVisible();
  });

  // ── UR-026 · Submitting an empty form is refused
  // Area: Create form › Validation
  // Checks: Notice "Opportunity Required — Select a reservation-ready opportunity."; no request is sent
  test(...ur('UR-026'), async ({ rsv, page }) => {
    await rsv.open();
    await rsv.openNew();
    const writes = writesOf(page);
    expect(await rsv.submit(rsv.createForm, 3_000), 'No request').toBeNull();
    const n = await rsv.readNotice();
    expect.soft(n.title, 'Notice').toBe('Opportunity Required');
    expect.soft(n.body, 'Message').toContain('Select a reservation-ready opportunity.');
    await rsv.noticeButton('OK');
    expect.soft(creates(writes), 'No reservation created').toEqual([]);
  });

  // ── UR-027 · Only Reservation Ready opportunities are offered
  // Area: Create form › Validation
  // Checks: Every listed opportunity is at stage Reservation Ready
  test(...ur('UR-027'), async ({ rsv, api }) => {
    await rsv.open();
    await rsv.openNew();
    const options = (await rsv.opportunityOptions(rsv.createForm)).slice(0, 10);
    test.skip(!options.length, 'No opportunity is Reservation Ready');
    const stages: string[] = [];
    for (const o of options) {
      const no = o.label.split(' - ')[0];
      const rec = (await api.searchOpportunities(no)).find(x => x.opportunityNo === no);
      stages.push(`${no}: ${rec?.opportunityStage?.name ?? 'not found'}`);
    }
    note('stages', stages);
    expect.soft(stages.filter(s => !s.endsWith(': Reservation Ready')), 'Offered opportunities not at Reservation Ready').toEqual([]);
  });

  // ── UR-028 · A unit is required
  // Area: Create form › Validation
  // Checks: A message asks for the unit; no request is sent
  test(...ur('UR-028'), async ({ rsv, page }) => {
    await rsv.open();
    await rsv.openNew();
    const opt = (await rsv.opportunityOptions(rsv.createForm))[0];
    test.skip(!opt, 'No opportunity is Reservation Ready');
    await rsv.createForm.locator(RSV.formOpportunity).selectOption(opt.value);
    const writes = writesOf(page);
    expect(await rsv.submit(rsv.createForm, 3_000), 'No request').toBeNull();
    const told = (await rsv.notice.count()) ? (await rsv.readNotice()).body : (await rsv.createForm.locator('.crm-field-error').allInnerTexts()).join(' ');
    note('message', told);
    expect.soft(told, 'Message asks for the unit').toMatch(/unit/i);
    expect.soft(creates(writes), 'No reservation created').toEqual([]);
  });

  // ── UR-029 · Unit picker lists available units and hides units on hold
  // Area: Create form › Unit picker
  // Checks: Dialog "Select Available Unit" with filters Project, Type, Bedrooms, View, Min / Max price; each
  //   row shows unit, project, type, beds, floor, area, price, status; ticking "Hide units on hold" never adds
  //   units
  test(...ur('UR-029'), async ({ rsv }) => {
    await rsv.open();
    await rsv.openNew();
    await rsv.openPicker(rsv.createForm);
    await expect.soft(rsv.picker.locator('h3'), 'Title').toHaveText('Select Available Unit');
    const filters = (await rsv.picker.locator('.crm-unit-picker-filters .crm-label').allInnerTexts()).map(t => t.trim());
    expect.soft(filters, 'Filters').toEqual(['Project', 'Type', 'Bedrooms', 'View', 'Min price', 'Max price']);
    const all = await rsv.pickerUnits();
    note('units', { listed: all.length, statuses: [...new Set(all.map(u => u.status))] });
    expect(all.length, 'Units listed').toBeGreaterThan(0);
    expect.soft(all.filter(u => u.status !== 'Available' && u.selectable).map(u => `${u.code} (${u.status})`), 'Units on hold that can be selected').toEqual([]);
    for (const u of all) expect.soft(u.price, `${u.code} price`).toMatch(/\d/);
    await rsv.setHideOnHold(true);
    const shown = await rsv.pickerUnits();
    expect.soft(shown.length, '"Hide units on hold" never adds units').toBeLessThanOrEqual(all.length);
    expect.soft(shown.filter(u => !all.some(a => a.code === u.code)).map(u => u.code), 'New units after hiding on-hold').toEqual([]);
    await rsv.closePicker();
  });

  // ── UR-064 · Required fields are marked
  // Area: Mandatory fields › Create Reservation
  // Checks: Opportunity and Unit are marked * (required); Amount (USD), Currency, Expiry and Remarks are not
  test(...ur('UR-064'), async ({ rsv }) => {
    await rsv.open();
    await rsv.openNew();
    const labels = (await rsv.createForm.locator('label .crm-label').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
    const required = labels.filter(l => l.endsWith('*')).map(l => l.replace(/\s*\*$/, ''));
    note('labels', labels);
    expect.soft(required, 'Fields marked required').toEqual(['Opportunity', 'Unit']);
    expect.soft(labels.filter(l => !l.endsWith('*')), 'Fields not marked').toEqual(['Amount (USD)', 'Currency', 'Expiry', 'Remarks']);
  });

  // ── UR-065 · Negative: a unit without an opportunity is refused
  // Area: Mandatory fields › Validation
  // Checks: Notice "Opportunity Required — Select a reservation-ready opportunity."; no request is sent
  test(...ur('UR-065'), async ({ rsv, page }) => {
    await rsv.open();
    await rsv.openNew();
    await rsv.pickUnit(rsv.createForm);
    await expect(rsv.createForm.locator(RSV.formOpportunity), 'No opportunity chosen').toHaveValue('');
    const writes = writesOf(page);
    expect(await rsv.submit(rsv.createForm, 3_000), 'No request').toBeNull();
    const n = await rsv.readNotice();
    expect.soft(n.title, 'Notice').toBe('Opportunity Required');
    expect.soft(n.body, 'Message').toContain('Select a reservation-ready opportunity.');
    await rsv.noticeButton('OK');
    expect.soft(creates(writes), 'No reservation created').toEqual([]);
  });

  // ── UR-030 · Closing the form creates nothing
  // Area: Create form › Create Reservation
  // Checks: The dialog closes, no request is sent and the register total is unchanged
  test(...ur('UR-030'), async ({ rsv, page }) => {
    await rsv.open();
    const before = await rsv.cardValue('All Reservations');
    await rsv.openNew();
    const opt = (await rsv.opportunityOptions(rsv.createForm))[0];
    if (opt) await rsv.createForm.locator(RSV.formOpportunity).selectOption(opt.value);
    const writes = writesOf(page);
    await rsv.createForm.getByRole('button', { name: 'Close', exact: true }).last().click();
    await expect(rsv.createForm, 'Form closed').toHaveCount(0);
    expect.soft(creates(writes), 'No reservation created').toEqual([]);
    await rsv.open();
    expect.soft(await rsv.cardValue('All Reservations'), 'Total unchanged').toBe(before);
  });
});
