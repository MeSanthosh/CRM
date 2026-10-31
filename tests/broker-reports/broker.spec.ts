/**
 * Broker Reports workbook: common rows come from module-workbooks/common.ts; this file adds the page's own rows
 * (page:…), the record-link map row and the question observations. Values are read live.
 */
import { test, expect, note } from '../pages/fixtures';
import { num, kpi } from '../helpers';
import { XP, at, ROUTES } from '../locators';
import { declareCommon, declareCoverage } from '../module-workbooks/common';
import { expectRequest } from '../module-workbooks/helpers';
import type { BrokerReportsPage } from '../pages/BrokerReportsPage';
import { labelOf, expectRate } from '../lead-reports/shared';
import { WB, CFG } from './workbook';

declareCommon(WB, CFG);
declareCoverage(WB, 'tests/broker-reports');

const BROKERS = 'All brokers';
const SPA_LIST = 'Broker SPAs in Period';

/** Broker Performance rows for Last 12 months. */
async function performance(b: BrokerReportsPage) {
  await b.openWith('last_12_months');
  return b.performance.rows();
}

/** Opens the first Broker ID and checks its form, then closes it without saving. */
async function openFirstBroker(b: BrokerReportsPage) {
  const row = (await performance(b))[0];
  const link = b.performance.links.first();
  expect(await link.innerText(), 'Link text = Broker ID').toBe(row['Broker']);
  expect.soft(await link.getAttribute('href'), 'Link target').toMatch(/^\/customers\?tab=brokers&selected=/);
  await link.click();
  await expect(b.page, 'Opens Customers › Brokers').toHaveURL(/\/customers\?tab=brokers/);
  const form = at(b.page, XP.customerRecordForm);
  await expect(form, 'The broker\'s form opens').toBeVisible({ timeout: 15_000 });
  const values = await form.locator('input').evaluateAll(is => is.map(i => (i as HTMLInputElement).value.trim()).filter(Boolean));
  note('record', `${row['Broker']} ${row['Name']} → ${(await form.locator('h2, h3').first().innerText().catch(() => '')).trim()}: ${values.slice(0, 3).join(' | ')}`);
  expect.soft(values.includes(row['Name']), `Form shows ${row['Name']}`).toBeTruthy();
  const editable = await form.locator('input:not([readonly]):not([disabled])').count();
  // read-only suite: close without saving
  await form.getByRole('button', { name: 'Close' }).first().click();
  await expect(form, 'Closed without saving').toBeHidden();
  return { row, editable };
}

test.describe('Broker Reports · Page checks', () => {
  test(...WB.key('page:all-brokers'), async ({ brokers }) => {
    const rows = await performance(brokers);
    const ids = rows.map(r => r['Broker']);
    expect.soft(rows.length, 'Rows = Active brokers').toBe(await brokers.kpi('Active brokers'));
    expect.soft(ids.filter((v, i) => ids.indexOf(v) !== i), 'Broker IDs listed twice').toEqual([]);
    expect.soft(ids.filter(id => !/^BRK-\d{3}$/.test(id)), 'Broker IDs in another format').toEqual([]);
  });

  test(...WB.key('page:lead-to-spa'), async ({ brokers }) => {
    const rows = await performance(brokers);
    const total = (await brokers.performance.total())!;
    for (const r of [...rows, total]) {
      const leads = num(r['Leads']);
      if (!leads) { expect.soft(r['Lead to SPA %'], `${r['Broker']}: no leads ⇒ — or 0%`).toMatch(/^(—|0%)$/); continue; }
      expectRate(num(r['Lead to SPA %']), num(r['SPAs']), leads, `${r['Broker']}: Lead to SPA %`);
    }
  });

  test(...WB.key('page:row-rules'), async ({ brokers }) => {
    const bad: string[] = [];
    for (const r of await performance(brokers)) {
      for (const c of ['Leads', 'Opportunities', 'Reservations', 'SPAs']) if (!/^\d[\d,]*$/.test(r[c])) bad.push(`${r['Broker']}: ${c} "${r[c]}"`);
      if ((num(r['SPAs']) === 0) !== (num(r['SPA Value (USD)']) === 0)) bad.push(`${r['Broker']}: SPAs ${r['SPAs']} but SPA Value ${r['SPA Value (USD)']}`);
    }
    expect(bad).toEqual([]);
  });

  test(...WB.key('page:brokers-with-spa'), async ({ brokers }) => {
    const rows = await performance(brokers);
    const card = await brokers.kpi('Brokers with SPA');
    expect.soft(rows.filter(r => num(r['SPAs']) > 0).length, 'Rows with SPAs > 0').toBe(card);
    expect.soft(card, 'Brokers with SPA ≤ Active brokers').toBeLessThanOrEqual(await brokers.kpi('Active brokers'));
  });

  test(...WB.key('page:share'), async ({ brokers, spa }) => {
    test.setTimeout(180_000);
    for (const p of ['last_12_months', 'ytd', 'this_month'] as const) {
      await brokers.openWith(p);
      const brokerSpas = await brokers.kpi('Broker SPAs');
      const share = await brokers.shown('Broker share of SPAs');
      await spa.openWith(p);
      const all = await spa.kpi('SPAs signed in period');
      note(p, `Broker SPAs ${brokerSpas} of ${all} SPAs signed | share ${share}`);
      if (!all) expect.soft(share, `${p}: no SPAs ⇒ —`).toMatch(/^[—–-]$/);
      else expectRate(num(share), brokerSpas, all, `${p}: Broker share of SPAs`);
    }
  });

  test(...WB.key('page:broker-filter'), async ({ brokers }) => {
    await brokers.openWith('last_12_months');
    for (const [i, label] of (await brokers.filterOptions(BROKERS)).slice(0, 3).entries()) {
      await expectRequest(brokers, CFG.api, /brokerId=/, () => brokers.setFilterIndex(BROKERS, i + 1));
      expect.soft((await brokers.performance.rows()).map(r => r['Name']), `${label}: only that broker`).toEqual([label]);
      expect.soft(await brokers.kpi('Active brokers'), `${label}: Active brokers`).toBe(1);
    }
  });

  test(...WB.key('page:broker-link'), async ({ brokers }) => {
    await openFirstBroker(brokers);
  });

  test(...WB.key('page:spa-list'), async ({ brokers }) => {
    const list = brokers.table(SPA_LIST);
    for (const p of ['last_12_months', 'ytd', 'this_month'] as const) {
      await brokers.openWith(p);
      const card = await brokers.kpi('Broker SPAs');
      const rows = (await list.root.count()) ? (await list.rows()).length : 0;
      note(p, `Broker SPAs ${card} | list rows ${rows}`);
      expect.soft(rows, `${p}: list rows = Broker SPAs`).toBe(card);
      if (!card) {
        await expect.soft(at(brokers.page, XP.reportPanel(SPA_LIST)), `${p}: empty message`).toContainText('Nothing matches these filters.');
        await expect.soft(list.exportButton, `${p}: Export disabled`).toBeDisabled();
      }
    }
  });

  test(...WB.key('page:customers-page'), async ({ brokers, page }) => {
    await brokers.open();
    const active = await brokers.kpi('Active brokers');
    await page.goto(ROUTES.customers);
    const all = await kpi(page, 'Brokers'), activePage = await kpi(page, 'Active Brokers');
    note('values', `Broker Reports Active brokers ${active} | Customers page Brokers ${all}, Active Brokers ${activePage}`);
    expect.soft(active, 'Active brokers = Customers page "Active Brokers"').toBe(activePage);
    expect.soft(active, 'Active brokers ≤ Customers page "Brokers"').toBeLessThanOrEqual(all);
  });

  test(...WB.key('page:lead-reports-leads'), async ({ brokers, leadReports }) => {
    const rows = await performance(brokers);
    const total = await brokers.kpi('Broker leads');
    await leadReports.openWith('last_12_months');
    await leadReports.openTab('Source & Channel');
    await leadReports.groupBy('Broker');
    const lead = new Map((await leadReports.breakdown.rows()).map(r => [labelOf(r), num(r['Leads'])]));
    const diffs = rows.filter(r => num(r['Leads']) !== (lead.get(r['Name']) ?? 0)).map(r => `${r['Name']}: ${r['Leads']} vs Lead Reports ${lead.get(r['Name']) ?? 0}`);
    const named = [...lead.entries()].filter(([k]) => !/^(Unspecified|Unassigned)$/.test(k)).reduce((a, [, v]) => a + v, 0);
    note('values', `Broker leads ${total} | Lead Reports named brokers ${named}`);
    expect.soft(diffs, 'Leads per broker').toEqual([]);
    expect.soft(total, 'Broker leads = Lead Reports named brokers').toBe(named);
  });

  test(...WB.key('page:lead-reports-stages'), async ({ brokers, leadReports }) => {
    const rows = await performance(brokers);
    await leadReports.openWith('last_12_months');
    await leadReports.openTab('Source & Channel');
    await leadReports.groupBy('Broker');
    const lead = new Map((await leadReports.breakdown.rows()).map(r => [labelOf(r), r]));
    const diffs: string[] = [];
    for (const r of rows) {
      const l = lead.get(r['Name']);
      if (!l) continue;
      for (const [bc, lc] of [['Opportunities', 'Opportunity'], ['Reservations', 'Reserved'], ['SPAs', 'SPA Signed']]) {
        if (num(r[bc]) !== num(l[lc])) diffs.push(`${r['Name']}: ${bc} ${r[bc]} vs Lead Reports ${lc} ${l[lc]}`);
      }
    }
    expect(diffs.slice(0, 15), 'Broker Reports vs Lead Reports per broker').toEqual([]);
  });

  test(...WB.key('page:reservation-reports'), async ({ brokers, reservations }) => {
    test.setTimeout(240_000);
    const rows = new Map((await performance(brokers)).map(r => [r['Name'], num(r['Reservations'])]));
    await reservations.openWith('last_12_months');
    const diffs: string[] = [];
    for (const [i, label] of (await reservations.filterOptions(BROKERS)).slice(0, 6).entries()) {
      await reservations.setFilterIndex(BROKERS, i + 1);
      const n = await reservations.kpi('Reservations in period');
      if (n !== (rows.get(label) ?? 0)) diffs.push(`${label}: Reservation Reports ${n} vs Broker Reports ${rows.get(label) ?? 0}`);
    }
    expect(diffs).toEqual([]);
  });
});

test.describe('Broker Reports · Clickable Map and observations', () => {
  test(...WB.mapKey('map:record'), async ({ brokers }) => {
    await openFirstBroker(brokers);
  });

  test(...WB.obs('OBS-02'), async ({ brokers }) => {
    await brokers.openWith('last_12_months');
    const t = (await brokers.performance.total())!;
    note('finding', `Last 12 months: Leads ${t['Leads']}, Opportunities ${t['Opportunities']}, Reservations ${t['Reservations']}, SPAs ${t['SPAs']} (see ${WB.id('page:lead-reports-stages')} for the Lead Reports comparison)`);
  });

  test(...WB.obs('OBS-03'), async ({ brokers }) => {
    const types = (await performance(brokers)).reduce<Record<string, number>>((a, r) => ({ ...a, [r['Type']]: (a[r['Type']] ?? 0) + 1 }), {});
    note('finding', `Broker types: ${JSON.stringify(types)}`);
  });

  test(...WB.obs('OBS-05'), async ({ brokers }) => {
    const { editable } = await openFirstBroker(brokers);
    note('finding', `Broker ID opens the Edit Broker form with ${editable} editable fields (question open)`);
  });

  test(...WB.obs('OBS-06'), async ({ brokers }) => {
    await brokers.openWith('last_12_months');
    const parts = [`All: ${await brokers.kpi('Active brokers')}`];
    for (const all of ['All projects', 'All salespeople', BROKERS]) {
      await brokers.setFilterIndex(all, 1);
      parts.push(`${all} → first value: ${await brokers.kpi('Active brokers')}`);
      await brokers.setFilterIndex(all, 0);
    }
    note('finding', `Active brokers — ${parts.join(' | ')}`);
  });
});
