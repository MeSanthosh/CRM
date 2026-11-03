/** Unit Reservations · List & cards (UR-001…008) and Detail (UR-017…024). Read-only. */
import { test, expect, note, writesOf } from './fixtures';
import { ur } from './catalog';
import { ROUTES } from '../locators';
import { parseNum } from '../helpers';
import { halfUnit } from '../sales-reports/shared';
import { ReservationsPage } from './ReservationsPage';

const BAD = /^\s*$|NaN|undefined|Infinity|null/;
const CARD_STATUSES: Record<string, string[]> = {
  Active: ['Approved', 'Requested'], Converted: ['Converted to Contract'], Cancelled: ['Cancelled'],
};
/** Register total: the pager's, or the rows when the pager is hidden. */
async function total(rsv: ReservationsPage) {
  return (await rsv.pagerInfo())?.total ?? (await rsv.rows()).length;
}

test.describe('Reservations · List & cards', () => {
  // ── UR-001 · Reservations opens from the side menu
  // Area: List & cards › Navigation
  // Checks: URL is /reservations; eyebrow "RESERVATIONS", heading "Unit Reservations"; the menu item is
  //   highlighted
  test(...ur('UR-001'), async ({ rsv, page }) => {
    await page.goto(ROUTES.dashboard);
    await page.getByRole('link', { name: 'Reservations', exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.reservations}(\\?.*)?$`));
    await expect(rsv.heading()).toBeVisible();
    await expect.soft(page.locator('main .crm-module-header .crm-eyebrow'), 'Eyebrow').toHaveText(/reservations/i);
    const active = await page.getByRole('link', { name: 'Reservations', exact: true }).first()
      .evaluate(e => e.getAttribute('aria-current') === 'page' || /active/.test(e.className));
    expect.soft(active, 'Reservations menu item highlighted').toBe(true);
  });

  // ── UR-002 · Register loads without errors and shows every column
  // Area: List & cards › Register
  // Checks: Columns Reservation, Customer, Unit, Status, Date, Amount, Created Date; every row shows an RSV-…
  //   number with its OPP-… number; no JavaScript errors, failed API calls, NaN or undefined
  test(...ur('UR-002'), async ({ rsv }) => {
    rsv.watchErrors();
    await rsv.open();
    expect.soft(await rsv.headers(), 'Register columns').toEqual(rsv.columns);
    const rows = await rsv.rows();
    expect(rows.length, 'rows on page 1').toBeGreaterThan(0);
    for (const r of rows) {
      // QA also holds older-style numbers such as RES-2026-0001
      expect.soft(r.rsv, 'Reservation number').toMatch(/^(RSV-\d{14}-[A-Z0-9]{4}|RES-\d{4}-\d{4})$/);
      expect.soft(r.opp, `${r.rsv} opportunity`).toMatch(/^OPP-[\w-]+$/);
      for (const k of ['customer', 'unit', 'status', 'amount'] as const) expect.soft(r[k], `${r.rsv} ${k}`).not.toMatch(BAD);
    }
    await rsv.expectNoBrokenValues();
    rsv.expectNoErrors();
  });

  // ── UR-003 · Cards show loaded values
  // Area: List & cards › KPI cards
  // Checks: Every card shows a value (not blank or —); Amount is in the base currency named in "All amounts
  //   in"; "All Reservations" is selected by default
  test(...ur('UR-003'), async ({ rsv, page }) => {
    await rsv.open();
    for (const c of rsv.cards) expect.soft(await rsv.cardValue(c), c).toBeGreaterThanOrEqual(0);
    const currency = (await page.locator('main .crm-module-header .crm-currency-label strong').innerText()).trim();
    note('cards', { ...Object.fromEntries(await Promise.all(rsv.cards.map(async c => [c, await rsv.cardValue(c)]))), Amount: await rsv.amountText(), currency });
    expect.soft(await rsv.amountText(), 'Amount in the base currency').toContain(currency);
    await expect.soft(rsv.card('All Reservations'), 'All Reservations selected').toHaveAttribute('aria-pressed', 'true');
  });

  // ── UR-004 · Every reservation is counted in one status card
  // Area: List & cards › KPI cards
  // Checks: All Reservations = Active + Converted + Cancelled (every reservation, including Requested and
  //   Superseded ones, falls in one of the status cards)
  test(...ur('UR-004'), async ({ rsv }) => {
    let v: Record<string, number> = {};
    for (let attempt = 0; attempt < 3; attempt++) { // re-read if a reservation is created meanwhile
      await rsv.open();
      v = Object.fromEntries(await Promise.all(rsv.cards.map(async c => [c, await rsv.cardValue(c)])));
      await rsv.open();
      if (await rsv.cardValue('All Reservations') === v['All Reservations']) break;
    }
    note('cards', v);
    expect(v['All Reservations'], `All ${v['All Reservations']} = Active ${v.Active} + Converted ${v.Converted} + Cancelled ${v.Cancelled}`)
      .toBe(v.Active + v.Converted + v.Cancelled);
  });

  // ── UR-005 · Status cards filter the register
  // Area: List & cards › KPI cards
  // Checks: The clicked card is pressed; the pager total equals the card value; Active lists Approved /
  //   Requested reservations, Converted lists "Converted to Contract", Cancelled lists "Cancelled"
  test(...ur('UR-005'), async ({ rsv }) => {
    await rsv.open();
    for (const c of ['Active', 'Converted', 'Cancelled', 'All Reservations']) {
      const value = await rsv.cardValue(c);
      await rsv.clickCard(c);
      const statuses = [...new Set((await rsv.rows()).map(r => r.status))];
      note(c, { card: value, listed: await total(rsv), statuses });
      expect.soft(await total(rsv), `${c}: register total vs card`).toBe(value);
      if (CARD_STATUSES[c]) expect.soft(statuses.filter(s => !CARD_STATUSES[c].includes(s)), `${c}: other statuses listed`).toEqual([]);
    }
  });

  // ── UR-006 · Amount card equals the amounts in the register
  // Area: List & cards › KPI cards
  // Checks: Amount card = sum of the listed amounts (within each value's display rounding)
  test(...ur('UR-006'), async ({ rsv }) => {
    test.setTimeout(180_000);
    let card = '', rows: Awaited<ReturnType<ReservationsPage['allRows']>> = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      await rsv.open();
      card = await rsv.amountText();
      await rsv.sortTo('Created Date', 'ascending');
      rows = await rsv.allRows();
      await rsv.open();
      if (await rsv.amountText() === card) break;
    }
    const sum = rows.reduce((a, r) => a + parseNum(r.amount), 0);
    const tol = halfUnit(card) + rows.reduce((a, r) => a + halfUnit(r.amount), 0);
    note('amount', { card, sumOfRows: Math.round(sum), rows: rows.length, tolerance: Math.round(tol) });
    expect(Math.abs(parseNum(card) - sum), `Amount ${card} vs sum of ${rows.length} rows ${Math.round(sum)} (±${Math.round(tol)})`).toBeLessThanOrEqual(tol);
  });

  // ── UR-007 · Pagination covers every reservation
  // Area: List & cards › Register
  // Checks: N = All Reservations; Previous disabled on page 1; Next / Previous move one page; the last page
  //   ends at N and Next is disabled there; N rows in all, none repeated
  test(...ur('UR-007'), async ({ rsv }) => {
    test.setTimeout(180_000);
    await rsv.open();
    const all = await rsv.cardValue('All Reservations');
    const p1 = (await rsv.pagerInfo())!;
    note('pager', p1.text);
    expect.soft(p1.total, 'Pager total vs All Reservations').toBe(all);
    expect.soft([p1.from, p1.page], 'Starts at row 1, page 1').toEqual([1, 1]);
    await expect.soft(rsv.pagerButton('Previous'), 'Previous disabled on page 1').toBeDisabled();
    test.skip(p1.pages < 2, 'Only one page of reservations');
    const size = p1.to - p1.from + 1;
    await rsv.reload(() => rsv.pagerButton('Next').click());
    expect.soft([(await rsv.pagerInfo())!.from, (await rsv.pagerInfo())!.page], 'Next → page 2').toEqual([size + 1, 2]);
    await rsv.reload(() => rsv.pagerButton('Previous').click());
    expect.soft((await rsv.pagerInfo())!.page, 'Previous → page 1').toBe(1);
    await rsv.sortTo('Created Date', 'ascending'); // a reservation created meanwhile lands on the last page
    const rows = await rsv.allRows();
    const last = (await rsv.pagerInfo())!;
    await expect.soft(rsv.pagerButton('Next'), 'Next disabled on the last page').toBeDisabled();
    expect.soft(last.to, 'Last page ends at the total').toBe(last.total);
    expect.soft(rows.length, 'Rows across all pages').toBe(last.total);
    expect.soft(new Set(rows.map(r => r.rsv)).size, 'No reservation listed twice').toBe(rows.length);
  });

  // ── UR-008 · Viewing does not change data
  // Area: List & cards › Register
  // Checks: No create / update / delete request (POST, PUT, PATCH, DELETE) to reservation, document, approval
  //   or opportunity endpoints
  test(...ur('UR-008'), async ({ rsv, page }) => {
    const writes = writesOf(page);
    await rsv.open();
    for (const c of ['Active', 'Converted', 'Cancelled', 'All Reservations']) await rsv.clickCard(c);
    await rsv.sortBy('Amount');
    await rsv.openFirst();
    await rsv.closeDetail();
    expect(writes, 'Requests that change data while only viewing').toEqual([]);
  });
});

test.describe('Reservations · Detail', () => {
  // ── UR-017 · Opening a reservation shows its details
  // Area: Detail › Reservation Detail
  // Checks: Same number, customer, opportunity, unit, project, amount, date, expiry and status as the row and
  //   the API; opening it does not modify the record
  test(...ur('UR-017'), async ({ rsv, api }) => {
    await rsv.open();
    const row = (await rsv.rows())[0];
    const rec = await rsv.openRecord(row.rsv);
    const f = await rsv.facts();
    note('detail', f);
    expect.soft(f.number, 'Number').toBe(row.rsv);
    expect.soft(f.customer, 'Customer').toBe(row.customer);
    expect.soft(f.Opportunity, 'Opportunity').toBe(row.opp);
    expect.soft(f.Unit, 'Unit').toBe(row.unit);
    expect.soft(f.Amount, 'Amount').toBe(row.amount);
    expect.soft(f.Date, 'Date').toBe(row.date);
    expect.soft(f.status, 'Status').toBe(row.status);
    expect.soft(f.Project, 'Project').not.toMatch(BAD);
    // a reservation saved without an expiry (see UR-068) shows "-"; otherwise the date is shown
    expect.soft(f.Expiry, 'Expiry').toMatch(rec.expiryDate ? /^\d{2} \w{3,4} \d{4}$/ : /^-$/);
    expect.soft([rec.reservationNo, rec.customer?.name, rec.unit?.unitCode, rec.reservationStatus?.name], 'API record')
      .toEqual([row.rsv, row.customer, row.unit, row.status]);
    expect.soft((await api.get(`/reservations/${rec.id}`)).body.updatedAt, 'Opening it did not modify the record').toBe(rec.updatedAt);
  });

  // ── UR-018 · Opportunity and unit links open their records
  // Area: Detail › Reservation Detail
  // Checks: The opportunity link opens that Opportunity Detail; the unit link opens that unit in Inventory
  test(...ur('UR-018'), async ({ rsv, opps, page }) => {
    await rsv.open();
    const row = (await rsv.rows())[0];
    await rsv.openRecord(row.rsv);
    await rsv.fact('Opportunity').locator('a').click();
    await opps.detailLoaded(row.opp);
    await rsv.open();
    await rsv.openRecord(row.rsv);
    await rsv.fact('Unit').locator('a').click();
    await expect(page, 'Unit link opens Inventory').toHaveURL(/\/inventory/);
    await expect(page.locator('section[role="dialog"]').first(), 'Unit detail').toContainText(row.unit, { timeout: 20_000 });
  });

  // ── UR-019 · An Approved reservation shows its next steps
  // Area: Detail › Reservation Detail
  // Checks: Status Approved; workflow Requested and Approved Done; ERP SYNC and DEPOSIT RECEIVED shown; actions
  //   Cancel Reservation, Replace Reservation and Move to Proposal
  test(...ur('UR-019'), async ({ rsv }) => {
    await rsv.open();
    await rsv.clickCard('Active');
    const row = (await rsv.rows()).find(r => r.status === 'Approved');
    test.skip(!row, 'No Approved reservation');
    await rsv.openRecord(row!.rsv);
    await expect.soft(rsv.status, 'Status').toHaveText('Approved');
    const steps = await rsv.workflow();
    note('workflow', steps);
    expect.soft(steps.slice(0, 2).map(s => `${s.name}:${s.text}`), 'Requested and Approved done').toEqual(['Requested:Done', 'Approved:Done']);
    expect.soft(await rsv.fact('ERP Sync').innerText(), 'ERP Sync shown').not.toMatch(BAD);
    expect.soft(await rsv.fact('Deposit Received').innerText(), 'Deposit shown').not.toMatch(BAD);
    expect.soft(await rsv.actions(), 'Actions').toEqual(expect.arrayContaining(['Cancel Reservation', 'Replace Reservation', 'Move to Proposal']));
  });

  // ── UR-020 · A Converted reservation can only be cancelled or replaced
  // Area: Detail › Reservation Detail
  // Checks: Status "Converted to Contract"; every workflow step Done; actions only Cancel Reservation and
  //   Replace Reservation; Quick notes say "Required before cancelling."
  test(...ur('UR-020'), async ({ rsv }) => {
    await rsv.open();
    await rsv.clickCard('Converted');
    const row = await rsv.openFirst();
    test.skip(!row, 'No converted reservation');
    await expect.soft(rsv.status, 'Status').toHaveText('Converted to Contract');
    expect.soft((await rsv.workflow()).filter(s => s.text !== 'Done').map(s => s.name), 'Steps not Done').toEqual([]);
    expect.soft(await rsv.actions(), 'Actions').toEqual(['Cancel Reservation', 'Replace Reservation']);
    await expect.soft(rsv.detail, 'Quick notes hint').toContainText('Required before cancelling.');
  });

  // ── UR-021 · A Cancelled reservation offers no actions
  // Area: Detail › Reservation Detail
  // Checks: Status Cancelled; workflow steps On hold; no Cancel, Replace, Approve or Move to Proposal action
  test(...ur('UR-021'), async ({ rsv }) => {
    await rsv.open();
    await rsv.clickCard('Cancelled');
    const row = await rsv.openFirst();
    test.skip(!row, 'No cancelled reservation');
    await expect.soft(rsv.status, 'Status').toHaveText('Cancelled');
    expect.soft((await rsv.workflow()).filter(s => !/on hold/i.test(s.text)).map(s => `${s.name}:${s.text}`), 'Steps not On hold').toEqual([]);
    expect.soft((await rsv.actions()).filter(a => /Cancel Reservation|Replace Reservation|Approve Reservation|Move to Proposal/.test(a)), 'Actions on a cancelled reservation').toEqual([]);
  });

  // ── UR-022 · History lists the changes with user and time
  // Area: Detail › History
  // Checks: The last entry is "Created" with a user and date-time; status changes are listed as "Reservation
  //   status Requested → Approved"; Refresh reloads the list
  test(...ur('UR-022'), async ({ rsv, page }) => {
    await rsv.open();
    await rsv.clickCard('Active');
    const row = (await rsv.rows()).find(r => r.status === 'Approved');
    test.skip(!row, 'No Approved reservation');
    await rsv.openRecord(row!.rsv);
    const entries = await rsv.historyEntries();
    note('history', entries);
    expect.soft(entries.at(-1), 'Last entry is Created with user and time').toMatch(/^Created .+ · \d{2} \w{3,4} \d{4}, \d{2}:\d{2}$/);
    expect.soft(entries.some(e => /Reservation status Requested → changed to Approved/.test(e)), 'Status change Requested → Approved listed').toBe(true);
    const refreshed = page.waitForResponse(r => /\/audit\/records\/RESERVATION\//.test(r.url()));
    await rsv.history.getByRole('button', { name: 'Refresh' }).click();
    expect.soft((await refreshed).status(), 'Refresh reloads the history').toBe(200);
  });

  // ── UR-023 · Record link (?selected=id) opens and keeps the reservation open
  // Area: Detail › Reservation Detail
  // Checks: That reservation's detail opens and stays open until closed
  test(...ur('UR-023'), async ({ rsv, page }) => {
    await rsv.open();
    const row = (await rsv.rows())[0];
    await page.goto(row.href);
    await rsv.detailLoaded(row.rsv);
    await page.waitForTimeout(3_000);
    await expect(rsv.detail, `${row.href} keeps ${row.rsv} open`).toBeVisible();
  });

  // ── UR-024 · Link to a missing reservation shows a message
  // Area: Detail › Reservation Detail
  // Checks: A message says the reservation was not found (no endless loading, no silent close)
  test(...ur('UR-024'), async ({ page }) => {
    await page.goto(`${ROUTES.reservations}?selected=00000000-0000-0000-0000-000000000000`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByText(/not found|no longer (exists|available)|does not exist|unavailable|could not be (found|loaded)|no access/i).first(),
      'A message says the reservation was not found').toBeVisible({ timeout: 10_000 });
  });
});
