/**
 * Reservation Reports workbook: common rows come from module-workbooks/common.ts; this file adds the page's own rows
 * (page:…), the record-link map row and the remaining observations. Values are read live.
 */
import { test, expect, note } from '../pages/fixtures';
import { num } from '../helpers';
import { XP, at } from '../locators';
import { declareCommon, declareCoverage } from '../module-workbooks/common';
import { shownDate, shownTolerance } from '../module-workbooks/helpers';
import type { ReservationReportsPage } from '../pages/ReservationReportsPage';
import { expectRate } from '../lead-reports/shared';
import { WB, CFG, BREAKDOWNS } from './workbook';

declareCommon(WB, CFG);
declareCoverage(WB, 'tests/reservation-reports');

const DAY = 86400_000;
const PAID = /^(RECEIVED|PAID|CLEARED|COMPLETE|COMPLETED)$/i;
const today = () => new Date(new Date().toDateString()).getTime();

/** Active Reservations rows (they do not depend on the period). */
async function activeRows(r: ReservationReportsPage) {
  await r.openWith('last_12_months');
  return (await r.active.root.count()) ? r.active.rows() : [];
}

/** Opens the first reservation number and checks its detail, then closes it. */
async function openFirstReservation(r: ReservationReportsPage) {
  const rows = await activeRows(r);
  test.skip(!rows.length, 'No active reservations');
  const link = r.active.links.first();
  expect(await link.innerText(), 'Link text = reservation number').toBe(rows[0]['Reservation']);
  expect.soft(await link.getAttribute('href'), 'Link target').toMatch(/^\/reservations\?selected=/);
  await link.click();
  await expect(r.page, 'Opens Reservations').toHaveURL(/\/reservations/);
  const detail = at(r.page, XP.recordDetail('Reservation Detail')).first();
  await expect(detail, 'Reservation Detail opens').toBeVisible({ timeout: 15_000 });
  await expect.soft(detail, 'Same reservation').toContainText(rows[0]['Reservation']);
  await expect.soft(detail, 'Same customer').toContainText(rows[0]['Customer']);
  note('record', `${rows[0]['Reservation']} ${rows[0]['Customer']} → Reservation Detail`);
  await detail.getByRole('button', { name: 'Close' }).first().click();
  await expect(detail, 'Closed').toBeHidden();
}

test.describe('Reservation Reports · Page checks', () => {
  test(...WB.key('page:conversion'), async ({ reservations }) => {
    await reservations.openWith('last_12_months');
    const made = await reservations.kpi('Reservations in period');
    const rate = await reservations.shown('Conversion rate');
    if (!made) expect.soft(rate, 'No reservations ⇒ —').toMatch(/^[—–-]$/);
    else expectRate(num(rate), await reservations.kpi('Converted to SPA'), made, 'Conversion rate card');
    for (const h of BREAKDOWNS) {
      for (const row of await reservations.table(h).rows()) {
        const m = num(row['Made in Period']);
        const label = Object.values(row)[0];
        if (!m) { expect.soft(row['Conversion %'], `${h} ${label}: nothing made ⇒ —`).toMatch(/^[—–-]$/); continue; }
        expectRate(num(row['Conversion %']), num(row['Converted to SPA']), m, `${h} ${label}`);
      }
    }
  });

  test(...WB.key('page:months'), async ({ reservations }) => {
    const now = new Date();
    const label = (d: Date) => d.toLocaleString('en-GB', { month: 'short', year: 'numeric' }).replace('Sept', 'Sep');
    const expected = Array.from({ length: 12 }, (_, i) => label(new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)));
    await reservations.openWith('last_12_months');
    const months = (await reservations.byMonth.column('Month')).map(m => m.replace('Sept', 'Sep'));
    expect.soft(months, 'Last 12 months: the 12 months ending this month, oldest first').toEqual(expected);
    await reservations.setPeriod('this_month');
    expect.soft((await reservations.byMonth.column('Month')).map(m => m.replace('Sept', 'Sep')), 'This month: only this month').toEqual([label(now)]);
  });

  test(...WB.key('page:row-rules'), async ({ reservations }) => {
    await reservations.openWith('last_12_months');
    const bad: string[] = [];
    for (const h of BREAKDOWNS) {
      for (const row of await reservations.table(h).rows()) {
        const label = `${h} ${Object.values(row)[0]}`;
        const [made, conv, amount] = [num(row['Made in Period']), num(row['Converted to SPA']), num(row['Amount (USD)'])];
        if (conv > made) bad.push(`${label}: Converted ${conv} > Made ${made}`);
        if (!made && amount) bad.push(`${label}: Amount ${row['Amount (USD)']} with nothing made`);
      }
    }
    expect(bad).toEqual([]);
  });

  test(...WB.key('page:project-rows'), async ({ reservations }) => {
    await reservations.openWith('last_12_months');
    const rows = new Map((await reservations.byProject.rows()).map(r => [r['Project'], r]));
    const diffs: string[] = [];
    for (const [i, label] of (await reservations.filterOptions('All projects')).entries()) {
      await reservations.setFilterIndex('All projects', i + 1);
      const row = rows.get(label);
      const made = await reservations.kpi('Reservations in period');
      if (!row) { if (made) diffs.push(`${label}: ${made} reservations but no row`); continue; }
      if (made !== num(row['Made in Period'])) diffs.push(`${label}: filter ${made} vs row ${row['Made in Period']}`);
      if ((await reservations.kpi('Converted to SPA')) !== num(row['Converted to SPA'])) diffs.push(`${label}: Converted differs`);
      const amount = await reservations.shown('Reservation amount');
      if (Math.abs(num(amount) - num(row['Amount (USD)'])) > shownTolerance(amount) + shownTolerance(row['Amount (USD)'])) diffs.push(`${label}: Amount ${amount} vs ${row['Amount (USD)']}`);
    }
    expect(diffs).toEqual([]);
  });

  test(...WB.key('page:salesperson-rows'), async ({ reservations }) => {
    test.setTimeout(180_000);
    await reservations.openWith('last_12_months');
    const byName = (await reservations.bySalesperson.rows()).reduce<Record<string, number>>((a, r) => ({ ...a, [r['Salesperson']]: (a[r['Salesperson']] ?? 0) + num(r['Made in Period']) }), {});
    const filtered: Record<string, number> = {};
    for (const [i, label] of (await reservations.filterOptions('All salespeople')).entries()) {
      await reservations.setFilterIndex('All salespeople', i + 1);
      filtered[label] = (filtered[label] ?? 0) + await reservations.kpi('Reservations in period');
    }
    note('values', `table ${JSON.stringify(byName)} | filter ${JSON.stringify(filtered)}`);
    for (const name of new Set([...Object.keys(byName), ...Object.keys(filtered)])) {
      expect.soft(filtered[name] ?? 0, `${name}: filter = table row`).toBe(byName[name] ?? 0);
    }
  });

  test(...WB.key('page:active-list'), async ({ reservations }) => {
    const rows = await activeRows(reservations);
    const k = await reservations.kpis(['Active now', 'Past expiry, still active', 'Expiring in 7 days', 'Deposit not received']);
    const days = rows.map(r => num(r['Days Left']));
    note('values', `${rows.length} rows | ${JSON.stringify(k)} | deposits ${[...new Set(rows.map(r => r['Deposit']))].join(', ')}`);
    expect.soft(rows.length, 'Rows = Active now').toBe(k['Active now']);
    expect.soft(days.filter(d => d < 0).length, 'Days Left < 0 = Past expiry, still active').toBe(k['Past expiry, still active']);
    expect.soft(days.filter(d => d >= 0 && d <= 7).length, '0–7 Days Left = Expiring in 7 days').toBe(k['Expiring in 7 days']);
    expect.soft(rows.filter(r => !PAID.test(r['Deposit'])).length, 'Deposit not received').toBe(k['Deposit not received']);
  });

  test(...WB.key('page:days-left'), async ({ reservations }) => {
    const rows = await activeRows(reservations);
    const bad: string[] = [];
    for (const r of rows) {
      const reserved = shownDate(r['Reserved']).getTime(), expiry = shownDate(r['Expiry']).getTime();
      if (expiry < reserved) bad.push(`${r['Reservation']}: Expiry ${r['Expiry']} before Reserved ${r['Reserved']}`);
      const left = Math.round((expiry - today()) / DAY);
      if (Math.abs(left - num(r['Days Left'])) > 1) bad.push(`${r['Reservation']}: Days Left ${r['Days Left']} vs ${left}`);
    }
    const expiries = rows.map(r => shownDate(r['Expiry']).getTime());
    expect.soft(expiries, 'Sorted by Expiry, earliest first').toEqual([...expiries].sort((a, b) => a - b));
    const ids = rows.map(r => r['Reservation']);
    expect.soft(ids.filter((v, i) => ids.indexOf(v) !== i), 'Reservations listed twice').toEqual([]);
    expect(bad.slice(0, 10)).toEqual([]);
  });

  test(...WB.key('page:reservation-link'), async ({ reservations }) => {
    await openFirstReservation(reservations);
  });

  test(...WB.key('page:exception-reports'), async ({ reservations, exceptions }) => {
    await reservations.open();
    const k = await reservations.kpis(['Past expiry, still active', 'Expiring in 7 days']);
    await exceptions.open();
    const e = await exceptions.kpis(['Reservations past expiry', 'Expiring in 7 days']);
    note('values', `Reservation Reports ${JSON.stringify(k)} | Exception Reports ${JSON.stringify(e)}`);
    expect.soft(k['Past expiry, still active'], 'Past expiry = Exception Reports "Reservations past expiry"').toBe(e['Reservations past expiry']);
    expect.soft(k['Expiring in 7 days'], 'Expiring in 7 days = Exception Reports').toBe(e['Expiring in 7 days']);
  });
});

test.describe('Reservation Reports · Clickable Map and observations', () => {
  test(...WB.mapKey('map:record'), async ({ reservations }) => {
    await openFirstReservation(reservations);
  });

  test(...WB.obs('OBS-02'), async ({ reservations }) => {
    await reservations.open();
    const past = await reservations.kpi('Past expiry, still active');
    const worst = Math.min(0, ...(await activeRows(reservations)).map(r => num(r['Days Left'])));
    note('finding', `${past} active reservations past expiry (oldest ${-worst} days)`);
    expect(past, 'Active reservations past their expiry date').toBe(0);
  });

  test(...WB.obs('OBS-03'), async ({ reservations }) => {
    const rows = await activeRows(reservations);
    const deposits = rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r['Deposit']]: (a[r['Deposit']] ?? 0) + 1 }), {});
    note('finding', `Deposit status of ${rows.length} active reservations: ${JSON.stringify(deposits)}`);
  });

  test(...WB.obs('OBS-04'), async ({ reservations }) => {
    const ids = (await activeRows(reservations)).map(r => r['Reservation']);
    const formats = [...new Set(ids.map(id => id.replace(/\d/g, '9').replace(/-[A-Z0-9]{4}$/, '-XXXX')))];
    note('formats', formats.join(' | '));
    expect(formats.length, 'Reservation number formats').toBe(1);
  });

  test(...WB.obs('OBS-06'), async ({ reservations }) => {
    await reservations.openWith('last_12_months');
    const { futureRange } = await import('../module-workbooks/helpers');
    await reservations.setCustomRange(...futureRange());
    const total = await reservations.byMonth.total();
    note('finding', `Next-year range: Made ${total?.['Made in Period']}, Active Now ${total?.['Active Now']} (Active Now is as of today)`);
  });

  test(...WB.obs('OBS-07'), async ({ reservations }) => {
    test.setTimeout(180_000);
    await reservations.openWith('last_12_months');
    const parts: string[] = [];
    for (const [i, label] of (await reservations.filterOptions('All brokers')).entries()) {
      await reservations.setFilterIndex('All brokers', i + 1);
      parts.push(`${label} ${await reservations.kpi('Reservations in period')}`);
    }
    note('finding', `Reservations per broker (Last 12 months): ${parts.join(', ')}`);
  });
});
