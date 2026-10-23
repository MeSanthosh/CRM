/** Unit Reservations · Search & sort (UR-009…016). Read-only. */
import { test, expect, note } from './fixtures';
import { ur } from './catalog';
import { parseNum } from '../helpers';
import { halfUnit } from '../sales-reports/shared';
import { ReservationsPage, RsvRow } from './ReservationsPage';

async function count(rsv: ReservationsPage) {
  return (await rsv.pagerInfo())?.total ?? (await rsv.rows()).length;
}
const has = (r: RsvRow, term: string) => [r.rsv, r.opp, r.customer, r.unit].some(v => v.toLowerCase().includes(term.toLowerCase()));
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** "30 Sept 2026" → epoch ms */
const day = (t: string) => { const m = t.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/)!; return new Date(+m[3], MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()), +m[1]).getTime(); };
/** Which status card counts a reservation with this status. */
const CARD_OF: Record<string, string> = { Approved: 'Active', Requested: 'Active', 'Converted to Contract': 'Converted', Cancelled: 'Cancelled' };

function expectOrdered<T>(values: T[], dir: 'ascending' | 'descending', what: string, cmp: (a: T, b: T) => number) {
  const bad = values.slice(1).map((v, i) => [values[i], v] as [T, T]).filter(([a, b]) => (dir === 'ascending' ? 1 : -1) * cmp(a, b) > 0);
  expect.soft(bad.map(([a, b]) => `${a} before ${b}`), `${what} ${dir}`).toEqual([]);
}
/** Amounts compared allowing each value's display rounding ("0.13M USD" ± 5K). */
const byAmount = (a: string, b: string) => { const d = parseNum(a) - parseNum(b); return Math.abs(d) <= halfUnit(a) + halfUnit(b) ? 0 : d; };

test.describe('Reservations · Search', () => {
  // ── UR-009 · Search by reservation number
  // Area: Search & sort › Search
  // Checks: Exactly that reservation is listed, with the same values as before
  test(...ur('UR-009'), async ({ rsv }) => {
    await rsv.open();
    const target = (await rsv.rows())[2];
    await rsv.search(target.rsv);
    const found = await rsv.rows();
    expect(found.map(r => r.rsv), `Search "${target.rsv}"`).toEqual([target.rsv]);
    expect.soft(found[0], 'Same row as before searching').toEqual(target);
  });

  // ── UR-010 · Search by customer and by unit
  // Area: Search & sort › Search
  // Checks: Every row matches the term (number, customer or unit) and the 2nd row is among them
  test(...ur('UR-010'), async ({ rsv }) => {
    await rsv.open();
    const target = (await rsv.rows())[1];
    for (const term of [target.customer, target.unit]) {
      await rsv.search(term);
      const rows = await rsv.rows();
      note(`search "${term}"`, `${rows.length} rows`);
      expect.soft(rows.map(r => r.rsv), `"${term}" finds ${target.rsv}`).toContain(target.rsv);
      expect.soft(rows.filter(r => !has(r, term)).map(r => `${r.rsv} ${r.customer} ${r.unit}`), `Rows not matching "${term}"`).toEqual([]);
    }
  });

  // ── UR-011 · Search with no match shows an empty register
  // Area: Search & sort › Search
  // Checks: No rows, an empty-state message, and Export disabled
  test(...ur('UR-011'), async ({ rsv }) => {
    await rsv.open();
    await rsv.search(`zz-no-such-reservation-${Date.now()}`);
    expect(await rsv.rows(), 'No rows').toEqual([]);
    const empty = await rsv.emptyText();
    note('empty state', empty);
    expect.soft(empty, 'Empty-state message').toMatch(/no .*reservations?|nothing/i);
    await expect.soft(rsv.exportButton, 'Export disabled').toBeDisabled();
  });

  // ── UR-012 · Clearing the search restores the register
  // Area: Search & sort › Search
  // Checks: The search narrows the list; after clearing, the box is empty and the total and page 1 are as
  //   before
  test(...ur('UR-012'), async ({ rsv }) => {
    await rsv.open();
    const before = await count(rsv), page1 = (await rsv.rows()).map(r => r.rsv);
    await rsv.search((await rsv.rows())[0].customer);
    expect.soft(await count(rsv), 'Search narrows the list').toBeLessThan(before);
    await rsv.clearSearch();
    await expect.soft(rsv.searchBox, 'Search box emptied').toHaveValue('');
    expect.soft(await count(rsv), 'All reservations again').toBe(before);
    expect.soft((await rsv.rows()).map(r => r.rsv), 'Same page 1').toEqual(page1);
  });

  // ── UR-013 · Cards follow the search
  // Area: Search & sort › KPI cards
  // Checks: All Reservations = 1 and Amount = that reservation's amount; the status card for its status shows 1
  test(...ur('UR-013'), async ({ rsv }) => {
    await rsv.open();
    const row = (await rsv.rows())[0];
    await rsv.search(row.rsv);
    const cards = Object.fromEntries(await Promise.all(rsv.cards.map(async c => [c, await rsv.cardValue(c)])));
    const amount = await rsv.amountText();
    note('cards for one reservation', { row: `${row.rsv} ${row.status} ${row.amount}`, ...cards, Amount: amount });
    expect.soft(cards['All Reservations'], 'All Reservations').toBe(1);
    expect.soft(byAmount(amount, row.amount), `Amount ${amount} vs ${row.amount}`).toBe(0);
    const card = CARD_OF[row.status];
    if (card) expect.soft(cards[card], `${card} card for a ${row.status} reservation`).toBe(1);
  });
});

test.describe('Reservations · Sort', () => {
  // ── UR-014 · Sort by Amount
  // Area: Search & sort › Sort
  // Checks: Amount sorts by the USD amount shown, both directions, across pages; the header shows the direction
  test(...ur('UR-014'), async ({ rsv }) => {
    await rsv.open();
    for (const dir of ['ascending', 'descending'] as const) {
      await rsv.sortTo('Amount', dir);
      const p1 = (await rsv.rows()).map(r => r.amount);
      expectOrdered(p1, dir, 'Amount, page 1', byAmount);
      if (await rsv.pagerButton('Next').isEnabled()) {
        await rsv.reload(() => rsv.pagerButton('Next').click());
        expectOrdered([p1[p1.length - 1], ...(await rsv.rows()).map(r => r.amount)], dir, 'Amount, page 1 → page 2', byAmount);
        await rsv.reload(() => rsv.pagerButton('Previous').click());
      }
      note(`amount ${dir}`, p1.slice(0, 6).join(' | '));
    }
  });

  // ── UR-015 · Sort by Created Date
  // Area: Search & sort › Sort
  // Checks: Default is newest first (Created Date ▼); ascending gives oldest first
  test(...ur('UR-015'), async ({ rsv }) => {
    await rsv.open();
    expect.soft(await rsv.sortHeader('Created Date').getAttribute('aria-sort'), 'Default sort').toBe('descending');
    expectOrdered((await rsv.rows()).map(r => r.created), 'descending', 'Created Date (default)', (a, b) => day(a) - day(b));
    await rsv.sortTo('Created Date', 'ascending');
    expectOrdered((await rsv.rows()).map(r => r.created), 'ascending', 'Created Date', (a, b) => day(a) - day(b));
  });

  // ── UR-016 · Sort by Date and Reservation number
  // Area: Search & sort › Sort
  // Checks: Rows follow the reservation date and the RSV number in both directions
  test(...ur('UR-016'), async ({ rsv }) => {
    await rsv.open();
    for (const dir of ['ascending', 'descending'] as const) {
      await rsv.sortTo('Date', dir);
      expectOrdered((await rsv.rows()).map(r => r.date), dir, 'Date', (a, b) => day(a) - day(b));
      await rsv.sortTo('Reservation', dir);
      expectOrdered((await rsv.rows()).map(r => r.rsv), dir, 'Reservation', (a, b) => a.localeCompare(b));
    }
  });
});
