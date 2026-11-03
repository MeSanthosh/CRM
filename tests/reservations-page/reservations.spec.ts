/**
 * Reservations page (RSV-001 … RSV-022). One worker, in this order: register & cards, ERP sync of the approved
 * reservation built by the test, then cancellation of that reservation.
 */
import { test, expect, rsv, note, DATA, S, runDeal, rsvRows, cards, expectedCard, byStatus, openReservation, rsvAction } from './shared';
import { XP, at } from '../locators';
import { findUnit } from '../sales-chain/inventory';
import { runValue } from '../sales-chain/data';

const lower = (s: string) => s.toLowerCase();
const RSV = /\bRSV-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/;

test.describe('Reservations · Register & cards', () => {
  test.describe.configure({ timeout: 300_000 });

  test(...rsv('RSV-001'), async ({ reservations, page }) => {
    await reservations.open();
    const title = await reservations.title();
    note('title', title);
    expect.soft(title, 'Page title').toContain(S('Page Title'));
    for (const c of DATA.cardRules()) note(`card ${c.card}`, await reservations.kpiText(c.card));
    expect.soft(await page.locator('main').innerText(), 'Approvals table').toContain(S('Pending Heading'));
    expect.soft(await reservations.headers(), 'Register columns').toEqual(DATA.sheet('Register Columns').map(r => r['Column']));
    for (const b of [S('New Reservation Button'), S('Export Button')]) expect.soft(await page.locator('main').getByRole('button', { name: b, exact: true }).count(), `${b} button`).toBeGreaterThan(0);
  });

  test(...rsv('RSV-002'), async ({ reservations }) => {
    const c = await cards(reservations);
    const total = await reservations.pagerTotal();
    note('All Reservations / listed', `${c['All Reservations']} / ${total}`);
    expect(c['All Reservations'], 'All Reservations card = reservations in the register ("of N reservations")').toBe(total);
  });

  test(...rsv('RSV-003'), async ({ reservations }) => {
    const c = await cards(reservations);
    note('cards', JSON.stringify(c));
    note('formula shown', await reservations.kpiText('All Reservations'));
    expect(c['All Reservations'], 'All Reservations = Active + Converted + Cancelled').toBe(c['Active'] + c['Converted'] + c['Cancelled']);
  });

  test(...rsv('RSV-004'), async ({ reservations }) => {
    const c = await cards(reservations);
    const rows = await rsvRows(reservations);
    note('register by status', byStatus(rows));
    for (const rule of DATA.cardRules().filter(r => r.statuses.length)) {
      expect.soft(c[rule.card], `${rule.card} card = reservations with status ${rule.statuses.join(' / ')}`).toBe(expectedCard(rule.card, rows));
    }
  });

  test(...rsv('RSV-005'), async ({ reservations, page }) => {
    const rows = await rsvRows(reservations);
    await reservations.open();
    const heading = (await page.locator('main').innerText()).match(new RegExp(`${S('Pending Heading')}\\s*\\((\\d+)\\)`));
    const pending = (await at(page, XP.tableRowsAfter(S('Pending Heading'))).allInnerTexts()).map(t => t.match(RSV)?.[0] ?? '').filter(Boolean);
    const requested = rows.filter(r => r.status === S('Requested Status'));
    const statusOf = (n: string) => rows.find(r => r.number === n)?.status ?? 'not in the register';
    note('pending / requested', `${pending.length} rows (heading ${heading?.[1] ?? '?'}) / ${requested.length} Requested`);
    expect.soft(pending.filter(n => statusOf(n) !== S('Requested Status')).map(n => `${n}: ${statusOf(n)}`), 'Pending rows whose register status is not Requested').toEqual([]);
    if (heading) expect.soft(Number(heading[1]), 'Number in the heading = pending rows').toBe(pending.length);
    expect(pending.length, 'Pending My Approval rows = Requested reservations').toBe(requested.length);
  });

  test(...rsv('RSV-006'), async ({ reservations, chain }) => {
    const d = await runDeal(chain);
    for (const text of [d.reservation!, d.buyer.name, d.unit!.code]) {
      await reservations.open();
      await reservations.search(S('Search Placeholder'), text);
      const rows = await reservations.rows();
      note(`search "${text}"`, `${rows.length} rows: ${rows.slice(0, 5).map(r => r.lines[0]).join(', ')}`);
      expect.soft(rows.some(r => r.text.includes(d.reservation!)), `Search "${text}" lists ${d.reservation}`).toBeTruthy();
      expect.soft(rows.filter(r => !lower(r.text).includes(lower(text))).map(r => r.lines[0]), `Rows of search "${text}" that do not contain it`).toEqual([]);
    }
  });

  test(...rsv('RSV-007'), async ({ reservations }) => {
    const rows = await rsvRows(reservations);
    await reservations.open();
    const file = await reservations.export(S('Export Button'));
    const cells = new Set(file.rows.flatMap(r => Object.values(r)));
    note('export', `${file.name}: ${file.rows.length} rows; register ${rows.length}`);
    expect.soft(file.rows.length, 'Rows in the export = reservations in the register').toBe(rows.length);
    expect(rows.map(r => r.number).filter(n => !cells.has(n)), 'Every reservation number is in the export').toEqual([]);
  });
});

test.describe('Reservations · ERP sync', () => {
  test.describe.configure({ timeout: 1_200_000 });

  test(...rsv('RSV-021'), async ({ reservations, chain }) => {
    const d = await runDeal(chain);
    const panel = await openReservation(reservations, d.reservation!);
    const status = await panel.status();
    const erp = await panel.summary(S('Erp Sync Caption'));
    note('reservation', `${d.reservation} · status ${status} · ${S('Erp Sync Caption')}: ${erp}`);
    note('history', (await panel.block('History')).join(' · ').slice(0, 600));
    expect.soft(status, 'Reservation status').toBe(S('Approved Status'));
    expect(erp, `${S('Erp Sync Caption')} of an approved reservation`).not.toMatch(new RegExp(S('Not Sent Pattern'), 'i'));
    await panel.close();
  });

  test(...rsv('RSV-022'), async ({ reservations, chain }) => {
    const d = await runDeal(chain);
    const panel = await openReservation(reservations, d.reservation!);
    const before = await panel.summary(S('Erp Sync Caption'));
    const offered = await panel.canPress(S('Erp Retry Button'));
    note('ERP sync before', `${before} · "${S('Erp Retry Button')}" ${offered ? 'offered' : 'not offered'}`);
    test.skip(!offered, `"${S('Erp Retry Button')}" is not offered on ${d.reservation} (ERP SYNC: ${before}); the app shows it only after a sync that did not go through`);
    const seen = await panel.act(S('Erp Retry Button'));
    note('retry pop-ups', seen.map(n => `${n.title}: ${n.text}`).join(' | ') || 'none');
    const after = await panel.summary(S('Erp Sync Caption'));
    note('ERP sync after', after);
    expect.soft(seen.find(n => n.kind === 'error')?.text, 'Retry error').toBeUndefined();
    expect(seen.length > 0 || after !== before, 'Retry confirmed by a message or a new ERP SYNC state').toBeTruthy();
    await panel.close();
  });
});

test.describe('Reservations · Cancellation', () => {
  test.describe.configure({ timeout: 900_000 });

  test(...rsv('RSV-011'), async ({ reservations, chain }) => {
    const d = await runDeal(chain);
    test.skip(runValue.get<boolean>('reservations-cancelled') === true, 'The reservation was already cancelled in this run');
    const panel = await openReservation(reservations, d.reservation!);
    const seen = await rsvAction(panel, 'Cancel Without Reason');
    const status = await panel.status();
    note('status after', status);
    expect.soft(seen.length, 'A message (or a disabled button) asks for the cancellation reason').toBeGreaterThan(0);
    expect(status, 'Reservation not cancelled without a reason').not.toBe(S('Cancelled Status'));
    await panel.close();
  });

  test(...rsv('RSV-012'), async ({ reservations, chain, page }) => {
    const d = await runDeal(chain);
    const reason = DATA.action('Reservation Actions', 'Cancel Reservation').fields['Cancellation reason'];
    if (!runValue.get<boolean>('reservations-cancelled')) {
      const before = await cards(reservations);
      const panel = await openReservation(reservations, d.reservation!);
      const seen = await rsvAction(panel, 'Cancel Reservation');
      expect.soft(seen.find(n => n.kind === 'error')?.text, 'Cancel Reservation error').toBeUndefined();
      await expect.poll(() => panel.status(), { timeout: 20_000, message: 'Status after Cancel Reservation' }).toBe(S('Cancelled Status'));
      const history = (await panel.block('History')).join(' · ');
      note('history', history.slice(0, 600));
      expect.soft(history, 'History records the cancellation reason').toContain(reason);
      await panel.close();
      runValue.set('reservations-cancelled', true);
      const after = await cards(reservations);
      note('cards Cancel Reservation', `before ${JSON.stringify(before)} → after ${JSON.stringify(after)}`);
      for (const [card, change] of Object.entries(DATA.countChanges('Cancel Reservation'))) {
        if (card in before) expect.soft(after[card] - before[card], `${card} card after Cancel Reservation`).toBe(Number(change));
      }
    }
    const unit = await findUnit(page, DATA, d.unit!.code);
    note('unit row', unit?.text.replace(/\s+/g, ' ') ?? 'not listed');
    expect(unit?.cells['Status'], `Status of ${d.unit!.code} after the cancellation`).toBe(S('Unit Status After Cancel'));
  });
});
