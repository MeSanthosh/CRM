/** Unit Reservations · Export (UR-059…063). Read-only: downloads the register and reads the file. */
import { test, expect, note } from './fixtures';
import { ur } from './catalog';
import { download, parseNum, ymd, Sheet } from '../helpers';
import { halfUnit } from '../sales-reports/shared';
import { ReservationsPage } from './ReservationsPage';

const COLUMNS = ['Reservation No', 'Customer', 'Opportunity No', 'Project', 'Unit', 'Status', 'Reservation Date', 'Expiry Date',
  'Amount', 'Currency', 'Broker', 'Created By', 'Created At', 'Remarks'];
const s = (v: unknown) => String(v ?? '').trim();

/** Register total: the pager's, or the rows when the pager is hidden. */
async function listed(rsv: ReservationsPage) {
  return (await rsv.pagerInfo())?.total ?? (await rsv.rows()).length;
}

test.describe('Reservations · Export', () => {
  // ── UR-059 · Export downloads the register as an Excel file
  // Area: Export › Export
  // Checks: A file "reservations-<today>.xlsx" downloads with columns Reservation No, Customer, Opportunity No,
  //   Project, Unit, Status, Reservation Date, Expiry Date, Amount, Currency, Broker, Created By, Created At,
  //   Remarks, and one row per reservation (= All Reservations)
  test(...ur('UR-059'), async ({ rsv, page }) => {
    let file!: Sheet, card = 0;
    for (let attempt = 0; attempt < 3; attempt++) { // export again if a reservation is created meanwhile
      await rsv.open();
      card = await rsv.cardValue('All Reservations');
      file = await download(page, rsv.exportButton);
      await rsv.open();
      if (await rsv.cardValue('All Reservations') === card) break;
    }
    note('file', { name: file.name, rows: file.rows.length, card, header: file.header });
    expect.soft(file.name, 'File name').toBe(`reservations-${ymd(new Date())}.xlsx`);
    expect.soft(file.header, 'Columns').toEqual(COLUMNS);
    expect.soft(file.rows.length, 'One row per reservation (= All Reservations)').toBe(card);
    expect.soft(new Set(file.rows.map(r => s(r['Reservation No']))).size, 'No reservation exported twice').toBe(file.rows.length);
  });

  // ── UR-060 · Exported rows match the register
  // Area: Export › Export
  // Checks: For each reservation: customer, opportunity, unit and status are the same, and the amount matches
  //   the shown amount (within its rounding)
  test(...ur('UR-060'), async ({ rsv, page }) => {
    await rsv.open();
    const rows = await rsv.rows();
    const file = await download(page, rsv.exportButton);
    const byNo = new Map(file.rows.map(r => [s(r['Reservation No']), r]));
    const diffs: string[] = [];
    let amounts = 0;
    for (const row of rows) {
      const x = byNo.get(row.rsv);
      if (!x) { diffs.push(`${row.rsv}: not in the file`); continue; }
      for (const [col, shown] of [['Customer', row.customer], ['Opportunity No', row.opp], ['Unit', row.unit], ['Status', row.status]] as const) {
        if (s(x[col]) !== shown) diffs.push(`${row.rsv} ${col}: file "${s(x[col])}" vs screen "${shown}"`);
      }
      // amounts in another currency are converted on screen, so only USD rows are compared
      if (s(x['Currency']) === 'USD' && /\d/.test(row.amount)) {
        amounts++;
        const fileAmt = Number(x['Amount'] ?? 0);
        if (Math.abs(fileAmt - parseNum(row.amount)) > halfUnit(row.amount) + 0.01) diffs.push(`${row.rsv} Amount: file ${fileAmt} vs screen "${row.amount}"`);
      }
    }
    note('compared', { rows: rows.length, amountsCompared: amounts });
    expect.soft(diffs, 'Differences between page 1 and the file').toEqual([]);
  });

  // ── UR-061 · Export follows the search
  // Area: Export › Export
  // Checks: The file holds exactly the reservations listed for the search (same count and numbers)
  test(...ur('UR-061'), async ({ rsv, page }) => {
    await rsv.open();
    const term = (await rsv.rows())[1].customer;
    await rsv.search(term);
    const shown = await listed(rsv);
    const numbers = (await rsv.rows()).map(r => r.rsv).sort();
    const file = await download(page, rsv.exportButton);
    note('search', { term, listed: shown, exported: file.rows.length });
    expect.soft(file.rows.length, `Rows exported for "${term}"`).toBe(shown);
    if (shown <= numbers.length) expect.soft(file.rows.map(r => s(r['Reservation No'])).sort(), 'Same reservations').toEqual(numbers);
  });

  // ── UR-062 · Export follows the selected status card
  // Area: Export › Export
  // Checks: The file holds only the Cancelled reservations, as many as the Cancelled card shows ("Download the
  //   current list (with its search and filters)")
  test(...ur('UR-062'), async ({ rsv, page }) => {
    await rsv.open();
    await rsv.clickCard('Cancelled');
    const card = await rsv.cardValue('Cancelled');
    const file = await download(page, rsv.exportButton);
    const statuses = [...new Set(file.rows.map(r => s(r['Status'])))];
    note('cancelled export', { card, listed: await listed(rsv), exported: file.rows.length, statuses });
    expect.soft(statuses.filter(x => x !== 'Cancelled'), 'Other statuses in the file').toEqual([]);
    expect.soft(file.rows.length, 'Rows = Cancelled card').toBe(card);
  });

  // ── UR-063 · Export is disabled when nothing is listed
  // Area: Export › Export
  // Checks: Export is disabled and nothing downloads
  test(...ur('UR-063'), async ({ rsv, page }) => {
    await rsv.open();
    await rsv.search(`zz-no-such-reservation-${Date.now()}`);
    expect(await rsv.rows(), 'Nothing listed').toEqual([]);
    await expect(rsv.exportButton, 'Export disabled').toBeDisabled();
    const downloaded = page.waitForEvent('download', { timeout: 3_000 }).then(() => true, () => false);
    await rsv.exportButton.click({ force: true }).catch(() => {});
    expect.soft(await downloaded, 'Nothing downloads').toBe(false);
  });
});
