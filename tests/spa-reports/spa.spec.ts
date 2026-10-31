/**
 * SPA Reports workbook: common rows come from module-workbooks/common.ts; this file adds the page's own rows
 * (page:…), the record-link map row and the remaining observations. Values are read live.
 */
import { test, expect, note } from '../pages/fixtures';
import { num, ymd } from '../helpers';
import { declareCommon, declareCoverage } from '../module-workbooks/common';
import { shownTolerance, expectRecordOpens, expectMonthRows } from '../module-workbooks/helpers';
import type { SpaReportsPage } from '../pages/SpaReportsPage';
import { expectRate } from '../lead-reports/shared';
import { WB, CFG, BREAKDOWNS } from './workbook';

declareCommon(WB, CFG);
declareCoverage(WB, 'tests/spa-reports');

const HANDED_OFF = /HANDED|SENT|DONE|COMPLETE|SYNC|POSTED/i;

/** SPAs Needing Action rows (as of today). */
async function attention(s: SpaReportsPage) {
  await s.openWith('last_12_months');
  return (await s.needingAction.root.count()) ? s.needingAction.rows() : [];
}

/** First SPA number in SPAs Needing Action opens its contract. */
async function openFirstContract(s: SpaReportsPage) {
  const rows = await attention(s);
  test.skip(!rows.length, 'No SPA needs action');
  const href = await expectRecordOpens(s.page, s.needingAction.links.first(), rows[0]['SPA']);
  expect.soft(href, 'Link target').toMatch(/^\/spa-contracts\?selected=/);
}

test.describe('SPA Reports · Page checks', () => {
  test(...WB.key('page:average'), async ({ spa }) => {
    await spa.openWith('last_12_months');
    const n = await spa.kpi('SPAs signed in period');
    const avg = await spa.shown('Average SPA value');
    if (!n) { expect(avg, 'No SPA ⇒ —').toMatch(/^[—–-]$/); return; }
    const value = await spa.shown('Signed value');
    note('values', `${value} ÷ ${n} vs ${avg}`);
    expect(Math.abs(num(avg) - num(value) / n), 'Average SPA value = Signed value ÷ SPAs').toBeLessThanOrEqual(shownTolerance(avg) + shownTolerance(value) / n + 0.01);
  });

  test(...WB.key('page:handed-off'), async ({ spa }) => {
    await spa.open();
    await spa.setCustomRange('2000-01-01', ymd(new Date()));
    const signed = await spa.kpi('SPAs signed in period');
    const pending = num((await spa.byProject.total())?.['ERP Handoff Pending'] ?? '0');
    const rate = await spa.shown('Handed off to ERP');
    note('values', `all signed ${signed} | ERP handoff pending ${pending} | card ${rate}`);
    expectRate(num(rate), signed - pending, signed, 'Handed off to ERP');
  });

  test(...WB.key('page:months'), async ({ spa }) => {
    await expectMonthRows(spa, spa.byMonth);
  });

  test(...WB.key('page:row-rules'), async ({ spa }) => {
    await spa.openWith('last_12_months');
    const bad: string[] = [];
    for (const h of BREAKDOWNS) {
      const signedCol = h === 'SPAs Signed by Month' ? 'Signed' : 'Signed in Period';
      for (const r of await spa.table(h).rows()) if ((num(r[signedCol]) === 0) !== (num(r['Value (USD)']) === 0)) bad.push(`${h} ${Object.values(r)[0]}: Signed ${r[signedCol]}, Value ${r['Value (USD)']}`);
    }
    expect(bad).toEqual([]);
  });

  test(...WB.key('page:project-rows'), async ({ spa }) => {
    await spa.openWith('last_12_months');
    const rows = new Map((await spa.byProject.rows()).map(r => [r['Project'], r]));
    const diffs: string[] = [];
    for (const [i, label] of (await spa.filterOptions('All projects')).entries()) {
      await spa.setFilterIndex('All projects', i + 1);
      const row = rows.get(label), n = await spa.kpi('SPAs signed in period'), value = await spa.shown('Signed value');
      if (!row) { if (n) diffs.push(`${label}: ${n} SPAs but no row`); continue; }
      if (n !== num(row['Signed in Period'])) diffs.push(`${label}: filter ${n} vs row ${row['Signed in Period']}`);
      if (Math.abs(num(value) - num(row['Value (USD)'])) > shownTolerance(value) + shownTolerance(row['Value (USD)'])) diffs.push(`${label}: value ${value} vs ${row['Value (USD)']}`);
    }
    expect(diffs).toEqual([]);
  });

  test(...WB.key('page:salesperson-rows'), async ({ spa }) => {
    test.setTimeout(180_000);
    await spa.openWith('last_12_months');
    const byName = (await spa.bySalesperson.rows()).reduce<Record<string, number>>((a, r) => ({ ...a, [r['Salesperson']]: (a[r['Salesperson']] ?? 0) + num(r['Signed in Period']) }), {});
    const filtered: Record<string, number> = {};
    for (const [i, label] of (await spa.filterOptions('All salespeople')).entries()) {
      await spa.setFilterIndex('All salespeople', i + 1);
      filtered[label] = (filtered[label] ?? 0) + await spa.kpi('SPAs signed in period');
    }
    note('values', `table ${JSON.stringify(byName)} | filter ${JSON.stringify(filtered)}`);
    for (const name of new Set([...Object.keys(byName), ...Object.keys(filtered)])) expect.soft(filtered[name] ?? 0, `${name}: filter = row`).toBe(byName[name] ?? 0);
  });

  test(...WB.key('page:needing-action'), async ({ spa }) => {
    const rows = await attention(spa);
    const k = await spa.kpis(['Awaiting signature', 'Signed, KYC not approved']);
    const pending = num((await spa.byProject.total())?.['ERP Handoff Pending'] ?? '0');
    const signed = (r: Record<string, string>) => /^signed$/i.test(r['Status']);
    const notSigned = rows.filter(r => !signed(r)), kyc = rows.filter(r => signed(r) && !/^approved$/i.test(r['KYC'])), erp = rows.filter(r => signed(r) && !HANDED_OFF.test(r['ERP']));
    note('values', `${rows.length} rows: not signed ${notSigned.length}, KYC ${kyc.length}, ERP ${erp.length} | cards ${JSON.stringify(k)}, ERP pending ${pending} | statuses ${[...new Set(rows.map(r => r['Status']))].join(', ')}; ERP ${[...new Set(rows.map(r => r['ERP']))].join(', ')}`);
    expect.soft(notSigned.length, 'Not signed = Awaiting signature').toBe(k['Awaiting signature']);
    expect.soft(kyc.length, 'KYC not approved = card').toBe(k['Signed, KYC not approved']);
    expect.soft(erp.length, 'Not handed off = ERP Handoff Pending').toBe(pending);
    expect.soft(rows.filter(r => signed(r) && /^approved$/i.test(r['KYC']) && HANDED_OFF.test(r['ERP'])).map(r => r['SPA']), 'Rows that need no action').toEqual([]);
    const ids = rows.map(r => r['SPA']);
    expect.soft(ids.filter((v, i) => ids.indexOf(v) !== i), 'SPAs listed twice').toEqual([]);
  });

  test(...WB.key('page:contract-link'), async ({ spa }) => {
    await openFirstContract(spa);
  });

  test(...WB.key('page:exception-reports'), async ({ spa, exceptions }) => {
    await spa.open();
    const k = await spa.kpis(['Awaiting signature', 'Signed, KYC not approved']);
    const pending = num((await spa.byProject.total())?.['ERP Handoff Pending'] ?? '0');
    await exceptions.open();
    const open = await exceptions.summaryCounts();
    note('values', `SPA Reports ${JSON.stringify(k)}, ERP pending ${pending} | Exception Summary ${JSON.stringify(open)}`);
    expect.soft(open['Signed SPAs with KYC not approved'] ?? 0, 'KYC not approved').toBe(k['Signed, KYC not approved']);
    expect.soft(open['SPAs not signed after 14 days'] ?? 0, 'Unsigned > 14 days ≤ Awaiting signature').toBeLessThanOrEqual(k['Awaiting signature']);
    expect.soft(open['Signed SPAs not handed off to ERP after 3 days'] ?? 0, 'Not handed off after 3 days ≤ ERP Handoff Pending').toBeLessThanOrEqual(pending);
  });
});

test.describe('SPA Reports · Clickable Map and observations', () => {
  test(...WB.mapKey('map:record'), async ({ spa }) => {
    await openFirstContract(spa);
  });

  test(...WB.obs('OBS-03'), async ({ spa }) => {
    const rows = await attention(spa);
    const erp = rows.filter(r => /^signed$/i.test(r['Status']) && !HANDED_OFF.test(r['ERP']));
    note('finding', `${erp.length} signed SPAs not handed off to ERP (values: ${[...new Set(erp.map(r => r['ERP']))].join(', ')})`);
  });

  test(...WB.obs('OBS-04'), async ({ spa }) => {
    const ids = (await attention(spa)).map(r => r['SPA']);
    const formats = [...new Set(ids.map(id => id.replace(/\d/g, '9').replace(/-[A-Z0-9]{4}$/, '-XXXX')))];
    note('formats', formats.join(' | '));
    expect(formats.length, 'SPA number formats').toBe(1);
  });

  test(...WB.obs('OBS-05'), async ({ spa }) => {
    test.setTimeout(180_000);
    await spa.openWith('last_12_months');
    const parts: string[] = [];
    for (const [i, label] of (await spa.filterOptions('All brokers')).entries()) {
      await spa.setFilterIndex('All brokers', i + 1);
      parts.push(`${label} ${await spa.kpi('SPAs signed in period')}`);
    }
    note('finding', `SPAs per broker (Last 12 months): ${parts.join(', ')}`);
  });
});
