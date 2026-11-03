/**
 * Unit Reservations lifecycle on live QA data — runs in order in one worker:
 *   prepare a Reservation Ready opportunity (UR-031) → create a reservation (UR-032…038) → documents
 *   (UR-039…041) → replace it (UR-042…045) → approve the replacement, which sends the ERP sync
 *   (UR-046…049) → cancel it so its unit is released (UR-050…052).
 *
 * Every run uses up one qualified lead and leaves one opportunity at Reservation Ready with a
 * superseded and a cancelled reservation (remarks "Automated test - Reservations lifecycle…").
 * UR-052 also cancels anything this run left active, so no unit stays held.
 * State passes between tests through test-results/reservation-lifecycle.json.
 */
import { Locator, Response } from '@playwright/test';
import { test, expect, note, writesOf, testFile, lifecycle, saveLifecycle, need, Res } from './fixtures';
import { ur, urSkipped } from './catalog';
import { RSV } from '../locators';
import { CrmApi } from '../opportunities/api';
import { ReservationsPage } from './ReservationsPage';
import { reservationReadyOpportunity } from './prepare';

test.describe.configure({ mode: 'default' });

const REMARKS = 'Automated test - Reservations lifecycle';
const refused = (s: number) => s >= 400 && s < 500;
const isApprove = (r: Response) => /\/api\/v1\/reservations\/[0-9a-f-]{36}\/approve$/.test(r.url()) && r.request().method() === 'POST';
const isCancel = (r: Response) => /\/api\/v1\/reservations\/[0-9a-f-]{36}\/cancel$/.test(r.url()) && r.request().method() === 'POST';
const ACTIONS = /^(Cancel Reservation|Replace Reservation|Approve Reservation|Move to Proposal)$/;

const status = async (api: CrmApi, id: string) => (await api.get(`/reservations/${id}`)).body?.reservationStatus?.name as string;

/** Cancels a reservation this run created by mistake (when the app accepted something it should have refused). */
async function undo(api: CrmApi, id: string, why: string) {
  const r = await api.call('POST', `/reservations/${id}/cancel`, { remarks: `${REMARKS} - cleanup: ${why}` });
  note('cleanup', `cancelled ${id} (${why}): ${r.status}`);
}

/** Opens New Reservation with the test opportunity chosen (and, optionally, a unit picked). */
async function newFor(rsv: ReservationsPage, oppNo: string) {
  await rsv.open();
  await rsv.openNew();
  await rsv.chooseOpportunity(rsv.createForm, oppNo);
}

/** Replaces the filled-in amount with `value`, typed as a user would. */
async function typeAmount(form: Locator, value: string) {
  const a = form.locator(RSV.formAmount);
  await a.fill('');
  await a.pressSequentially(value);
}

/**
 * Fills New Reservation for the test opportunity and an available unit, applies `change` (the invalid input),
 * and submits. Returns the response (null if nothing was sent) and the message shown. A reservation the app
 * wrongly accepts is cancelled at once so its unit is released.
 */
async function tryCreate(rsv: ReservationsPage, api: CrmApi, oppNo: string, change: (form: Locator) => Promise<void>, why: string) {
  await newFor(rsv, oppNo);
  const f = rsv.createForm;
  await rsv.pickUnit(f);
  await rsv.filledAmount(f);
  await change(f);
  const res = await rsv.submit(f, 8_000);
  if (res && res.status() < 300) await undo(api, (await res.json()).id, why);
  const told = (await rsv.notice.isVisible().catch(() => false))
    ? (await rsv.readNotice()).body : (await f.locator('.crm-field-error').allInnerTexts()).join(' ');
  note('message', told || '(none)');
  if (await rsv.notice.isVisible().catch(() => false)) await rsv.notice.getByRole('button').last().click();
  return { res, told };
}

/** The unit's row in the unit picker of a New Reservation form (undefined when not listed). */
async function unitInPicker(rsv: ReservationsPage, code: string, hideOnHold = false) {
  await rsv.open();
  await rsv.openNew();
  await rsv.openPicker(rsv.createForm);
  await rsv.setHideOnHold(hideOnHold);
  const u = (await rsv.pickerUnits()).find(x => x.code === code);
  await rsv.closePicker();
  return u;
}

test.describe('Reservations · Lifecycle (live QA data)', () => {
  // ── UR-031 · A test opportunity is brought to Reservation Ready
  // Area: Create › Preparation
  // Checks: The opportunity is at Reservation Ready and is offered in New Reservation › Opportunity
  test(...ur('UR-031'), async ({ leads, opps, rsv }) => {
    test.setTimeout(240_000);
    const opp = await reservationReadyOpportunity(leads, opps);
    saveLifecycle(opp);
    note('opportunity', opp);
    await newFor(rsv, opp.oppNo); // throws if it is not offered
  });

  // ── UR-032 · Reservation amount is required
  // Area: Create › Validation
  // Checks: A message asks for the amount; no reservation is created
  test(...ur('UR-032'), async ({ rsv, api }) => {
    const s = need('oppNo');
    await newFor(rsv, s.oppNo);
    await rsv.pickUnit(rsv.createForm);
    await rsv.filledAmount(rsv.createForm);
    await rsv.createForm.locator(RSV.formAmount).fill('');
    const res = await rsv.submit(rsv.createForm, 5_000);
    if (res && res.status() < 300) {
      const body = await res.json();
      await undo(api, body.id, `saved without an amount as ${body.reservationNo} (${body.reservationAmount ?? 0})`);
      if (await rsv.notice.count()) await rsv.noticeButton('OK');
    }
    expect.soft(res === null || refused(res.status()), `No reservation without an amount (got ${res?.status() ?? 'no request'})`).toBe(true);
    const told = (await rsv.notice.count()) ? (await rsv.readNotice()).body : (await rsv.createForm.locator('.crm-field-error').allInnerTexts()).join(' ');
    expect.soft(told, 'Message asks for the amount').toMatch(/amount/i);
  });

  // ── UR-033 · Choosing a unit fills in the amount
  // Area: Create › Create Reservation
  // Checks: Unit shows the chosen code; Amount (USD) fills in with a value above 0
  test(...ur('UR-033'), async ({ rsv }) => {
    const s = need('oppNo');
    await newFor(rsv, s.oppNo);
    const unit = await rsv.pickUnit(rsv.createForm);
    const amount = await rsv.filledAmount(rsv.createForm);
    note('auto amount', { unit: unit.code, price: unit.price, amount });
    await expect.soft(rsv.createForm.locator(RSV.formUnitText), 'Unit shown').toHaveValue(new RegExp(unit.code));
    expect.soft(Number(amount), 'Amount filled in above 0').toBeGreaterThan(0);
    await rsv.createForm.getByRole('button', { name: 'Close', exact: true }).last().click();
  });

  // ── UR-034 · Creating a reservation
  // Area: Create › Create Reservation
  // Checks: POST /reservations succeeds; notice "Reservation Created"; the detail shows status Requested, the
  //   opportunity, unit, amount, expiry, "Not yet received · 0 USD" and "Not sent (sent on approval)"; workflow
  //   Requested In progress
  test(...ur('UR-034'), async ({ rsv }) => {
    const s = need('oppNo');
    await rsv.open();
    saveLifecycle({ allBefore: await rsv.cardValue('All Reservations') });
    await rsv.openNew();
    await rsv.chooseOpportunity(rsv.createForm, s.oppNo);
    const unit = await rsv.pickUnit(rsv.createForm);
    const amount = await rsv.filledAmount(rsv.createForm);
    await rsv.createForm.locator(RSV.formRemarks).fill(REMARKS);
    const res = await rsv.submit(rsv.createForm);
    expect(res?.status(), 'POST /reservations').toBeLessThan(300);
    const body = await res!.json();
    const r1: Res = { id: body.id, no: body.reservationNo, unit: unit.code };
    saveLifecycle({ r1, amount });
    note('reservation', { ...r1, amount: body.reservationAmount });
    const n = await rsv.readNotice();
    expect.soft(n.title, 'Notice').toBe('Reservation Created');
    await rsv.noticeButton('OK');
    if (!(await rsv.detail.count())) { await rsv.open(); await rsv.openRecord(r1.no); }
    await rsv.detailLoaded(r1.no);
    const f = await rsv.facts();
    note('detail', f);
    expect.soft(f.status, 'Status').toBe('Requested');
    expect.soft([f.Opportunity, f.Unit, f.customer], 'Opportunity, unit, customer').toEqual([s.oppNo, unit.code, s.customer]);
    expect.soft(Number(body.reservationAmount), 'Saved amount = filled amount').toBe(Number(amount));
    expect.soft(f['Deposit Received'], 'Deposit').toBe('Not yet received · 0 USD');
    expect.soft(f['ERP Sync'], 'ERP').toBe('Not sent (sent on approval)');
    expect.soft((await rsv.workflow())[0], 'Workflow').toEqual({ name: 'Requested', text: 'In progress' });
    expect.soft(await rsv.actions(), 'Actions').toEqual(['Cancel Reservation', 'Replace Reservation', 'Approve Reservation']);
  });

  // ── UR-035 · The new reservation is listed and counted
  // Area: Create › Register
  // Checks: The reservation is on page 1 with status Requested; search finds it; All Reservations +1
  test(...ur('UR-035'), async ({ rsv }) => {
    const s = need('r1', 'allBefore');
    await rsv.open();
    expect.soft((await rsv.rows()).find(r => r.rsv === s.r1.no)?.status, 'On page 1 as Requested').toBe('Requested');
    expect.soft(await rsv.cardValue('All Reservations'), 'All Reservations +1').toBe(s.allBefore + 1);
    await rsv.search(s.r1.no);
    expect.soft((await rsv.rows()).map(r => r.rsv), 'Search').toEqual([s.r1.no]);
  });

  // ── UR-036 · Pending My Approval lists the new reservation
  // Area: Create › Approvals
  // Checks: A row "Approve reservation" with the RSV number, customer, unit, requester and the remarks as
  //   reason
  test(...ur('UR-036'), async ({ rsv, page }) => {
    const s = need('r1');
    await rsv.open();
    const me = (await page.locator('.crm-user-menu-text strong').innerText()).trim();
    const row = (await rsv.pendingRows()).find(r => r[1] === s.r1.no);
    note('pending', row);
    expect(row, 'Listed in Pending My Approval').toBeTruthy();
    expect.soft(row![0], 'Request').toBe('Approve reservation');
    expect.soft([row![2], row![3]], 'Customer and unit').toEqual([s.customer, s.r1.unit]);
    expect.soft(row![4], 'Requested by').toContain(me);
    expect.soft(row![5], 'Reason').toBe(REMARKS);
  });

  // ── UR-037 · A reserved unit is no longer offered as available
  // Area: Create › Unit picker
  // Checks: The unit is not shown as Available with Select (and is hidden by "Hide units on hold")
  test(...ur('UR-037'), async ({ rsv }) => {
    const s = need('r1');
    const u = await unitInPicker(rsv, s.r1.unit);
    note('reserved unit in picker', u ?? 'not listed');
    expect.soft(!u || u.status !== 'Available' || !u.selectable, `${s.r1.unit} not offered as Available (${u?.status}, Select ${u?.selectable ? 'enabled' : 'disabled'})`).toBe(true);
    expect.soft(await unitInPicker(rsv, s.r1.unit, true), 'Hidden by "Hide units on hold"').toBeUndefined();
  });

  // ── UR-038 · A second reservation for the same opportunity is refused
  // Area: Create › Validation
  // Checks: Refused (4xx); the opportunity still has one active reservation
  test(...ur('UR-038'), async ({ rsv, api }) => {
    const s = need('r1', 'oppNo');
    await rsv.open();
    await rsv.openNew();
    const offered = (await rsv.opportunityOptions(rsv.createForm)).some(o => o.label.startsWith(`${s.oppNo} `));
    note('still offered', offered);
    test.skip(!offered, 'The opportunity is no longer offered, so a second reservation cannot be made');
    await rsv.chooseOpportunity(rsv.createForm, s.oppNo);
    await rsv.pickUnit(rsv.createForm, [s.r1.unit]);
    await rsv.filledAmount(rsv.createForm);
    await rsv.createForm.locator(RSV.formRemarks).fill(`${REMARKS} (second reservation)`);
    const res = await rsv.submit(rsv.createForm, 8_000);
    if (res && res.status() < 300) await undo(api, (await res.json()).id, 'second reservation for the same opportunity was accepted');
    expect.soft(res === null || refused(res.status()), `Second reservation refused (got ${res?.status() ?? 'no request'})`).toBe(true);
    if (await rsv.notice.count()) note('message', (await rsv.readNotice()).body);
  });

  // ── UR-039 · Upload validation
  // Area: Documents › Upload
  // Checks: "Choose a file to upload." then "Only PDF, JPG and PNG files can be uploaded."; nothing is uploaded
  test(...ur('UR-039'), async ({ rsv }) => {
    const s = need('r1');
    await rsv.open();
    await rsv.openRecord(s.r1.no);
    expect.soft(await rsv.upload(null, '', '', 3_000), 'No upload without a file').toBeNull();
    await expect.soft(rsv.documents, 'No file').toContainText('Choose a file to upload.');
    expect.soft(await rsv.upload(testFile('notes.txt'), '', '', 3_000), 'No upload of a .txt').toBeNull();
    await expect.soft(rsv.documents, 'Wrong type').toContainText('Only PDF, JPG and PNG files can be uploaded.');
    expect.soft(await rsv.documentList(), 'Nothing uploaded').toEqual([]);
  });

  // ── UR-040 · Uploading a PDF
  // Area: Documents › Upload
  // Checks: The document is listed with file name, type, description, size, uploader and time, and a Delete
  //   button
  test(...ur('UR-040'), async ({ rsv }) => {
    const s = need('r1');
    await rsv.open();
    await rsv.openRecord(s.r1.no);
    const res = await rsv.upload(testFile('deposit-proof.pdf'), 'DEPOSIT_PROOF', 'Automated test deposit proof');
    expect(res?.status(), 'POST /documents').toBeLessThan(300);
    await expect(rsv.documentItem('deposit-proof.pdf'), 'Listed').toBeVisible();
    const doc = (await rsv.documentList()).find(d => d.name === 'deposit-proof.pdf')!;
    note('document', doc);
    expect.soft(doc.meta[0], 'Type · description · size').toMatch(/^Deposit proof · Automated test deposit proof · \d+ B$/);
    expect.soft(doc.meta[1], 'Uploaded by … · time').toMatch(/^Uploaded by .+ · \d{2} \w{3,4} \d{4}, \d{2}:\d{2}$/);
    expect.soft(doc.canDelete, 'Delete offered').toBe(true);
  });

  // ── UR-041 · Deleting a document
  // Area: Documents › Delete
  // Checks: The document is removed from the list; the first document stays
  test(...ur('UR-041'), async ({ rsv, page }) => {
    const s = need('r1');
    await rsv.open();
    await rsv.openRecord(s.r1.no);
    expect((await rsv.upload(testFile('booking-form.pdf'), 'BOOKING_FORM', 'Automated test booking form'))?.status(), 'Second upload').toBeLessThan(300);
    await expect(rsv.documentItem('booking-form.pdf')).toBeVisible();
    const deleted = page.waitForResponse(r => /\/api\/v1\/documents\//.test(r.url()) && r.request().method() === 'DELETE');
    await rsv.documentItem('booking-form.pdf').getByRole('button', { name: 'Delete' }).click();
    if (await rsv.notice.isVisible().catch(() => false) || await rsv.notice.waitFor({ timeout: 2_000 }).then(() => true, () => false)) {
      note('confirmation', (await rsv.readNotice()).body);
      await rsv.notice.getByRole('button', { name: /^(Delete|Confirm|Remove|Yes)$/ }).click();
    }
    expect((await deleted).status(), 'DELETE document').toBeLessThan(300);
    await expect.soft(rsv.documentItem('booking-form.pdf'), 'Removed').toHaveCount(0);
    await expect.soft(rsv.documentItem('deposit-proof.pdf'), 'The other document stays').toBeVisible();
  });

  // ── UR-042 · Cancelling needs a reason
  // Area: Cancel › Validation
  // Checks: Notice "Reason Required — Enter the cancellation reason in the notes box before cancelling.";
  //   nothing is cancelled
  test(...ur('UR-042'), async ({ rsv, page }) => {
    const s = need('r1');
    await rsv.open();
    await rsv.openRecord(s.r1.no);
    await rsv.quickNotes.fill('');
    const writes = writesOf(page);
    await rsv.action('Cancel Reservation').click();
    const n = await rsv.readNotice();
    expect.soft(n.title, 'Notice').toBe('Reason Required');
    expect.soft(n.body, 'Message').toContain('Enter the cancellation reason in the notes box before cancelling.');
    await rsv.noticeButton('OK');
    expect.soft(writes.filter(w => /\/cancel$/.test(w)), 'Nothing cancelled').toEqual([]);
  });

  // ── UR-043 · Replace opens with the reservation's opportunity
  // Area: Replace › Replace Reservation
  // Checks: Dialog "Replace Reservation": "Prior reservation and linked proposals/contracts will be superseded.
  //   Latest becomes active."; the opportunity is preselected; Unit, Amount, Expiry and Remarks fields
  test(...ur('UR-043'), async ({ rsv }) => {
    const s = need('r1', 'oppId');
    await rsv.open();
    await rsv.openRecord(s.r1.no);
    await rsv.action('Replace Reservation').click();
    const f = rsv.replaceForm;
    await expect(f, 'Replace Reservation opens').toBeVisible();
    await expect.soft(f, 'Explanation').toContainText('Prior reservation and linked proposals/contracts will be superseded. Latest becomes active.');
    await expect.poll(() => f.locator(`${RSV.formOpportunity} option`).count(), { message: 'opportunity options load' }).toBeGreaterThan(1);
    await expect.soft(f.locator(RSV.formOpportunity), 'Opportunity preselected').toHaveValue(s.oppId, { timeout: 15_000 });
    for (const sel of [RSV.formChooseUnit, RSV.formAmount, RSV.formExpiryShown, RSV.formRemarks]) await expect.soft(f.locator(sel).first(), sel).toBeVisible();
  });

  // ── UR-044 · Replacing creates a new reservation and supersedes the old one
  // Area: Replace › Replace Reservation
  // Checks: Notice "Reservation Replaced"; a new RSV number is Requested for the new unit; the old reservation
  //   is Superseded
  test(...ur('UR-044'), async ({ rsv, api }) => {
    const s = need('r1');
    await rsv.open();
    await rsv.openRecord(s.r1.no);
    await rsv.quickNotes.fill(`${REMARKS} - replaced with another unit`);
    await rsv.action('Replace Reservation').click();
    const f = rsv.replaceForm;
    await expect(f).toBeVisible();
    const unit = await rsv.pickUnit(f, [s.r1.unit]);
    await rsv.filledAmount(f);
    await f.locator(RSV.formRemarks).fill(`${REMARKS} (replacement)`);
    const res = await rsv.submit(f);
    expect(res?.status(), 'POST …/supersede').toBeLessThan(300);
    const body = await res!.json();
    const r2: Res = { id: body.id, no: body.reservationNo, unit: unit.code };
    saveLifecycle({ r2 });
    note('replacement', r2);
    if (await rsv.notice.isVisible().catch(() => false) && (await rsv.readNotice()).title !== 'Reservation Replaced') {
      await rsv.notice.getByRole('button', { name: /^(Replace|Confirm)/ }).click();
    }
    const n = await rsv.readNotice();
    expect.soft(n.title, 'Notice').toBe('Reservation Replaced');
    expect.soft(n.body, 'Names the new reservation').toContain(r2.no);
    await rsv.noticeButton('OK');
    expect.soft(await status(api, r2.id), 'New reservation').toBe('Requested');
    expect.soft(await status(api, s.r1.id), 'Old reservation').toBe('Superseded');
  });

  // ── UR-045 · A superseded reservation is closed and its unit released
  // Area: Replace › Replace Reservation
  // Checks: The superseded reservation offers no Cancel, Replace or Approve; its unit is offered as Available
  //   again
  test(...ur('UR-045'), async ({ rsv }) => {
    const s = need('r1', 'r2');
    await rsv.open();
    await rsv.openRecord(s.r1.no);
    await expect.soft(rsv.status, 'Status').toHaveText('Superseded');
    expect.soft((await rsv.actions()).filter(a => ACTIONS.test(a)), 'Actions on a superseded reservation').toEqual([]);
    const u = await unitInPicker(rsv, s.r1.unit, true);
    expect.soft(u?.status === 'Available' && u.selectable, `${s.r1.unit} offered again`).toBe(true);
  });

  // ── UR-046 · Approving a reservation
  // Area: Approve › Approve Reservation
  // Checks: Go back changes nothing; Approve: POST …/approve succeeds; status Approved; workflow Requested and
  //   Approved Done; actions Cancel, Replace, Move to Proposal; it leaves Pending My Approval
  test(...ur('UR-046'), async ({ rsv, api, page }) => {
    const s = need('r2');
    await rsv.open();
    await rsv.openRecord(s.r2.no);
    await rsv.quickNotes.fill('Automated test - approved');
    await rsv.action('Approve Reservation').click();
    const ask = await rsv.readNotice();
    expect.soft(ask.title, 'Confirmation').toBe('Approve reservation?');
    expect.soft(ask.body, 'Names the reservation and unit').toContain(`${s.r2.no} (${s.r2.unit})`);
    await rsv.noticeButton('Go back');
    expect.soft(await status(api, s.r2.id), 'Go back changes nothing').toBe('Requested');
    await rsv.action('Approve Reservation').click();
    const approved = page.waitForResponse(isApprove);
    await rsv.noticeButton('Approve');
    expect((await approved).status(), 'POST …/approve').toBeLessThan(300);
    if (await rsv.notice.isVisible().catch(() => false)) { note('notice', (await rsv.readNotice()).body); await rsv.notice.getByRole('button').last().click(); }
    await rsv.open();
    await rsv.openRecord(s.r2.no);
    await expect.soft(rsv.status, 'Status').toHaveText('Approved');
    expect.soft((await rsv.workflow()).slice(0, 2).map(x => `${x.name}:${x.text}`), 'Workflow').toEqual(['Requested:Done', 'Approved:Done']);
    expect.soft(await rsv.actions(), 'Actions').toEqual(expect.arrayContaining(['Cancel Reservation', 'Replace Reservation', 'Move to Proposal']));
    await rsv.closeDetail();
    await rsv.open();
    expect.soft((await rsv.pendingRows()).map(r => r[1]), 'Left Pending My Approval').not.toContain(s.r2.no);
  });

  // ── UR-047 · Approval is recorded and sent to ERP
  // Area: Approve › ERP
  // Checks: ERP SYNC no longer "Not sent"; History lists "Reservation status Requested → Approved" by the
  //   approver and the ERP sync fields
  test(...ur('UR-047'), async ({ rsv }) => {
    const s = need('r2');
    await rsv.open();
    await rsv.openRecord(s.r2.no);
    const erp = (await rsv.fact('ERP Sync').innerText()).trim();
    const history = await rsv.historyEntries();
    note('erp', erp);
    note('history', history);
    expect.soft(erp, 'ERP sync started').not.toMatch(/Not sent/i);
    expect.soft(history.some(h => /Reservation status Requested → changed to Approved/.test(h)), 'History: Requested → Approved').toBe(true);
    expect.soft(history.some(h => /ERP sync status/.test(h)), 'History: ERP sync fields').toBe(true);
  });

  // ── UR-048 · The opportunity moves on once its reservation is approved
  // Area: Approve › Opportunity
  // Checks: The opportunity is no longer Reservation Ready ("Moved to Reservation" Done) and is no longer
  //   offered for a new reservation
  test(...ur('UR-048'), async ({ opps, rsv }) => {
    const s = need('r2', 'oppNo');
    await opps.open();
    await opps.openRecord(s.oppNo);
    const stage = (await opps.status.innerText()).trim();
    const moved = (await opps.workflow()).find(x => x.name === 'Moved to Reservation');
    note('opportunity', { stage, movedToReservation: moved?.state });
    expect.soft(stage, 'Stage after its reservation was approved').not.toBe('Reservation Ready');
    expect.soft(moved?.state, '"Moved to Reservation" step').toBe('done');
    await rsv.open();
    await rsv.openNew();
    expect.soft((await rsv.opportunityOptions(rsv.createForm)).map(o => o.label.split(' - ')[0]), 'Not offered for another reservation').not.toContain(s.oppNo);
  });

  // ── UR-049 · "Moved to Proposal" is not Done before a proposal exists
  // Area: Approve › Workflow
  // Checks: While the next step is "Move to Proposal", the "Moved to Proposal" step is not shown as Done
  test(...ur('UR-049'), async ({ rsv }) => {
    const s = need('r2');
    await rsv.open();
    await rsv.openRecord(s.r2.no);
    const step = (await rsv.workflow()).find(x => x.name === 'Moved to Proposal');
    const next = await rsv.actions();
    note('workflow', { movedToProposal: step?.text, actions: next });
    if (next.includes('Move to Proposal')) expect.soft(step?.text, '"Moved to Proposal" while no proposal exists yet').not.toBe('Done');
  });

  // ── UR-050 · Cancelling an approved reservation releases the unit
  // Area: Cancel › Cancel Reservation
  // Checks: Go back changes nothing; Confirm: notice "Reservation Cancelled … the unit released"; status
  //   Cancelled; History "Approved → Cancelled"; the unit is Available again
  test(...ur('UR-050'), async ({ rsv, api, page }) => {
    const s = need('r2');
    const reason = 'Automated test - cancelled to release the unit';
    await rsv.open();
    await rsv.openRecord(s.r2.no);
    await rsv.quickNotes.fill(reason);
    await rsv.action('Cancel Reservation').click();
    const ask = await rsv.readNotice();
    expect.soft(ask.title, 'Confirmation').toBe('Cancel reservation?');
    expect.soft(ask.body, 'Explains the effect and shows the reason').toMatch(new RegExp(`will be cancelled and the unit released.*Reason: ${reason}`));
    await rsv.noticeButton('Go back');
    expect.soft(await status(api, s.r2.id), 'Go back changes nothing').toBe('Approved');
    await rsv.action('Cancel Reservation').click();
    const cancelled = page.waitForResponse(isCancel);
    await rsv.noticeButton('Confirm');
    expect((await cancelled).status(), 'POST …/cancel').toBeLessThan(300);
    const done = await rsv.readNotice();
    expect.soft(done.title, 'Notice').toBe('Reservation Cancelled');
    expect.soft(done.body, 'Unit released').toContain('the unit released');
    await rsv.noticeButton('OK');
    await rsv.open();
    await rsv.openRecord(s.r2.no);
    await expect.soft(rsv.status, 'Status').toHaveText('Cancelled');
    expect.soft((await rsv.historyEntries()).some(h => /Reservation status Approved → changed to Cancelled/.test(h)), 'History: Approved → Cancelled').toBe(true);
    const u = await unitInPicker(rsv, s.r2.unit, true);
    expect.soft(u?.status === 'Available' && u.selectable, `${s.r2.unit} available again`).toBe(true);
  });

  // ── UR-051 · A cancelled reservation offers no further actions
  // Area: Cancel › Reservation Detail
  // Checks: No Cancel, Replace, Approve, Move to Proposal or "Retry ERP Sync"; workflow steps On hold
  test(...ur('UR-051'), async ({ rsv }) => {
    const s = need('r2');
    await rsv.open();
    await rsv.openRecord(s.r2.no);
    expect.soft((await rsv.actions()).filter(a => ACTIONS.test(a)), 'Actions on a cancelled reservation').toEqual([]);
    await expect.soft(rsv.detail.getByRole('button', { name: 'Retry ERP Sync' }), 'No ERP deposit retry for a cancelled reservation').toHaveCount(0);
    expect.soft((await rsv.workflow()).filter(x => !/on hold/i.test(x.text)).map(x => x.name), 'Steps not On hold').toEqual([]);
  });

  // ── UR-052 · Backend refuses to approve or cancel a cancelled reservation
  // Area: Cancel › API
  // Checks: Both refused (4xx); the reservation stays Cancelled
  test(...ur('UR-052'), async ({ api }) => {
    // first release anything this run left active (when an earlier step failed), so no unit stays held
    const st = lifecycle();
    for (const r of [st.r1, st.r2].filter(Boolean) as Res[]) {
      const now = await status(api, r.id);
      if (now === 'Requested' || now === 'Approved') await undo(api, r.id, `left ${now} by an earlier step`);
    }
    const s = need('r2');
    test.skip((await status(api, s.r2.id)) !== 'Cancelled', 'The replacement was not cancelled by UR-050');
    const approve = await api.call('POST', `/reservations/${s.r2.id}/approve`, { remarks: `${REMARKS} (approve after cancel)` });
    const cancel = await api.call('POST', `/reservations/${s.r2.id}/cancel`, { remarks: `${REMARKS} (cancel twice)` });
    note('api', { approve: approve.status, cancel: cancel.status });
    expect.soft(refused(approve.status), `Approve refused (got ${approve.status})`).toBe(true);
    expect.soft(refused(cancel.status), `Cancel again refused (got ${cancel.status})`).toBe(true);
    expect.soft(await status(api, s.r2.id), 'Still Cancelled').toBe('Cancelled');
  });

  // ── UR-066 · Negative: a negative amount is refused
  // Area: Mandatory fields › Validation
  // Checks: No reservation is created and a message says the amount must be 0 or more
  test(...ur('UR-066'), async ({ rsv, api }) => {
    const s = need('oppNo');
    const { res, told } = await tryCreate(rsv, api, s.oppNo, f => typeAmount(f, '-100'), 'negative amount was accepted');
    expect.soft(res === null || refused(res.status()), `Not created (got ${res?.status() ?? 'no request'})`).toBe(true);
    expect.soft(told, 'Message about the amount').toMatch(/amount/i);
  });

  // ── UR-067 · Negative: a non-numeric amount is refused
  // Area: Mandatory fields › Validation
  // Checks: No reservation is created and a message asks for a valid amount
  test(...ur('UR-067'), async ({ rsv, api }) => {
    const s = need('oppNo');
    const { res, told } = await tryCreate(rsv, api, s.oppNo, f => typeAmount(f, 'abc'), 'non-numeric amount was accepted');
    expect.soft(res === null || refused(res.status()), `Not created (got ${res?.status() ?? 'no request'})`).toBe(true);
    expect.soft(told, 'Message about the amount').toMatch(/amount/i);
  });

  // ── UR-068 · Negative: a reservation needs an expiry date
  // Area: Mandatory fields › Validation
  // Checks: No reservation is created and a message asks for the expiry date (a reservation without expiry
  //   would hold the unit indefinitely)
  test(...ur('UR-068'), async ({ rsv, api, page }) => {
    const s = need('oppNo');
    const { res, told } = await tryCreate(rsv, api, s.oppNo, async f => {
      await f.locator(RSV.formExpiryShown).click();
      await page.getByRole('button', { name: 'Clear', exact: true }).last().click();
      await expect(f.locator(RSV.formExpiry), 'Expiry cleared').toHaveValue('');
      if (await page.locator('button.crm-date-field-set-button').isVisible().catch(() => false)) await page.keyboard.press('Escape');
    }, 'reservation without an expiry date was accepted');
    expect.soft(res === null || refused(res.status()), `Not created (got ${res?.status() ?? 'no request'})`).toBe(true);
    expect.soft(told, 'Message about the expiry').toMatch(/expir/i);
  });

  // ── UR-069 · Positive: only the required fields are enough
  // Area: Mandatory fields › Create Reservation
  // Checks: Notice "Reservation Created"; the reservation is Requested with the chosen unit, the filled-in
  //   amount and the default expiry; Remarks are empty
  test(...ur('UR-069'), async ({ rsv, api }) => {
    const s = need('oppNo');
    await newFor(rsv, s.oppNo);
    const f = rsv.createForm;
    const unit = await rsv.pickUnit(f);
    const amount = await rsv.filledAmount(f);
    const expiry = await f.locator(RSV.formExpiry).inputValue();
    await expect(f.locator(RSV.formRemarks), 'Remarks left blank').toHaveValue('');
    const res = await rsv.submit(f);
    expect(res?.status(), 'POST /reservations').toBeLessThan(300);
    const body = await res!.json();
    try {
      const n = await rsv.readNotice();
      expect.soft(n.title, 'Notice').toBe('Reservation Created');
      await rsv.noticeButton('OK');
      const rec = (await api.get(`/reservations/${body.id}`)).body;
      note('created with required fields only', { no: rec.reservationNo, unit: rec.unit?.unitCode, amount: rec.reservationAmount, expiry: rec.expiryDate, remarks: rec.remarks });
      expect.soft(rec.reservationStatus?.name, 'Status').toBe('Requested');
      expect.soft(rec.unit?.unitCode, 'Unit').toBe(unit.code);
      expect.soft(Number(rec.reservationAmount), 'Amount = filled-in amount').toBe(Number(amount));
      expect.soft(String(rec.expiryDate ?? '').slice(0, 10), 'Expiry = default').toBe(expiry);
      expect.soft(rec.remarks ?? '', 'Remarks empty').toBe('');
    } finally {
      await undo(api, body.id, 'releasing the unit after the positive check');
    }
  });

  // ── UR-056 · Cancelling after a signed contract goes to the manager
  // Area: Cancel › Approvals
  // Checks: The cancellation becomes a request in the manager's "Pending My Approval" instead of cancelling at
  //   once
  test(...urSkipped('UR-056', 'Needs a reservation with a signed contract; cancelling it would affect a real deal.'));
  // ── UR-057 · Move to Proposal opens the proposal for the reservation
  // Area: Approve › Proposal
  // Checks: Proposals opens with the reservation's customer, unit and amount filled in
  test(...urSkipped('UR-057', 'Move to Proposal belongs to the Proposals module.'));
  // ── UR-058 · Retry ERP Sync resends the deposit
  // Area: Approve › ERP
  // Checks: The sync is sent again and ERP SYNC shows the new result
  test(...urSkipped('UR-058', 'Sends an extra ERP request on demand; the approval sync is covered by UR-047.'));
});

