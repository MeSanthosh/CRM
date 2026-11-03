/**
 * Exception Reports workbook: common rows come from module-workbooks/common.ts; this file adds the page's own rows
 * (page:…), the record-link map row and the remaining observations. Values are read live.
 */
import { test, expect, note } from '../pages/fixtures';
import { num } from '../helpers';
import { XP, at } from '../locators';
import { declareCommon, declareCoverage } from '../module-workbooks/common';
import { expectRecordOpens } from '../module-workbooks/helpers';
import type { ExceptionReportsPage } from '../pages/ExceptionReportsPage';
import { WB, CFG, LISTS } from './workbook';

declareCommon(WB, CFG);
declareCoverage(WB, 'tests/exception-reports');

/** Card → Exception Summary row it counts. */
const CARD_ROWS: Record<string, RegExp> = {
  'Overdue instalments': /^Overdue instalments$/i, 'Reservations past expiry': /^Reservations past expiry$/i,
  'Expiring in 7 days': /expir.*7 days/i, 'SPAs unsigned > 14 days': /not signed after 14 days/i, 'Leads not contacted': /^Leads not contacted/i,
};

/** Rows of a detail list on screen, and the full count it says it has ("Showing 100 of 209"). */
async function listState(x: ExceptionReportsPage, heading: string) {
  const panel = at(x.page, XP.reportPanel(heading));
  if (!(await panel.count())) return { present: false, shown: 0, of: 0 };
  const shown = (await x.table(heading).root.count()) ? await x.table(heading).rowCount() : 0;
  const m = (await panel.innerText()).match(/Showing\s+([\d,]+)\s+of\s+([\d,]+)/i);
  return { present: true, shown, of: m ? num(m[2]) : shown };
}

/** Every exception's Summary count against its detail list; returns the differences. */
async function listsAgainstSummary(x: ExceptionReportsPage, where: string) {
  const open = await x.summaryCounts();
  const diffs: string[] = [];
  for (const [name, count] of Object.entries(open)) {
    const s = await listState(x, name);
    if (!count) { if (s.present && s.of) diffs.push(`${where} ${name}: Summary 0 but the list has ${s.of}`); continue; }
    if (!s.present) { diffs.push(`${where} ${name}: Summary ${count} but no list`); continue; }
    if (s.of !== count) diffs.push(`${where} ${name}: Summary ${count} but the list has ${s.of}${s.of !== s.shown ? ` (${s.shown} shown)` : ''}`);
  }
  return diffs;
}

test.describe('Exception Reports · Page checks', () => {
  test(...WB.key('page:cards-summary'), async ({ exceptions }) => {
    await exceptions.open();
    const open = await exceptions.summaryCounts();
    const rows = Object.entries(open);
    expect.soft(await exceptions.kpi('Open exceptions'), 'Open exceptions = Summary Total').toBe(num((await exceptions.summary.total())?.['Open'] ?? '0'));
    for (const [card, re] of Object.entries(CARD_ROWS)) {
      const row = rows.find(([name]) => re.test(name));
      expect.soft(row, `${card}: has a Summary row`).toBeTruthy();
      if (row) expect.soft(await exceptions.kpi(card), `${card} = Summary "${row[0]}"`).toBe(row[1]);
    }
  });

  test(...WB.key('page:summary'), async ({ exceptions }) => {
    await exceptions.open();
    const bad: string[] = [];
    for (const r of await exceptions.summary.rows()) {
      if (!r['What to Do']) bad.push(`${r['Exception']}: no "What to Do"`);
      if (r['Oldest (Days)'] && !/^(\d+ d|—)$/.test(r['Oldest (Days)'])) bad.push(`${r['Exception']}: Oldest "${r['Oldest (Days)']}"`);
      const panel = at(exceptions.page, XP.reportPanel(r['Exception']));
      if (num(r['Open']) && (await panel.count()) && !(await panel.innerText()).includes(r['What to Do'])) bad.push(`${r['Exception']}: list description differs from "What to Do"`);
    }
    expect(bad).toEqual([]);
  });

  test(...WB.key('page:lists-match'), async ({ exceptions }) => {
    await exceptions.open();
    const diffs = await listsAgainstSummary(exceptions, 'No filter:');
    const open = await exceptions.summaryCounts();
    for (const l of LISTS) {
      if (!open[l.heading]) continue;
      const sheet = await exceptions.table(l.heading).export();
      if (sheet.rows.length !== open[l.heading]) diffs.push(`${l.heading}: export ${sheet.rows.length} rows vs Summary ${open[l.heading]}`);
    }
    expect(diffs).toEqual([]);
  });

  test(...WB.key('page:lists-filters'), async ({ exceptions }) => {
    test.setTimeout(300_000);
    await exceptions.open();
    const diffs: string[] = [];
    for (const [all, take] of [['All projects', 9], ['All salespeople', 3]] as const) {
      for (const [i, label] of (await exceptions.filterOptions(all)).slice(0, take).entries()) {
        await exceptions.setFilterIndex(all, i + 1);
        diffs.push(...await listsAgainstSummary(exceptions, `${label}:`));
      }
      await exceptions.setFilterIndex(all, 0);
    }
    expect(diffs.slice(0, 20)).toEqual([]);
  });

  test(...WB.key('page:lists-order'), async ({ exceptions }) => {
    test.setTimeout(240_000);
    await exceptions.open();
    const oldest = Object.fromEntries((await exceptions.summary.rows()).map(r => [r['Exception'], r['Oldest (Days)']]));
    const bad: string[] = [];
    for (const l of LISTS) {
      if (!(await exceptions.table(l.heading).root.count())) continue;
      const sheet = await exceptions.table(l.heading).export();
      const daysCol = sheet.header[sheet.header.length - 1];
      const days = sheet.rows.map(r => Number(r[daysCol] ?? 0));
      if (JSON.stringify(days) !== JSON.stringify([...days].sort((a, b) => b - a))) bad.push(`${l.heading}: not sorted by ${daysCol}, highest first`);
      // a contract can have several overdue instalments, so a row is reference + detail
      const refs = sheet.rows.map(r => `${r['Reference']} · ${r['Detail']}`);
      const dupes = refs.filter((v, i) => refs.indexOf(v) !== i);
      if (dupes.length) bad.push(`${l.heading}: listed twice: ${[...new Set(dupes)].slice(0, 5).join(', ')}`);
      if (oldest[l.heading] && days.length && num(oldest[l.heading]) !== Math.max(...days)) bad.push(`${l.heading}: Summary Oldest ${oldest[l.heading]} vs list ${Math.max(...days)} d`);
    }
    expect(bad).toEqual([]);
  });

  test(...WB.key('page:record-links'), async ({ exceptions }) => {
    test.setTimeout(240_000);
    const seen: string[] = [];
    for (const l of LISTS) {
      await exceptions.open();
      const table = exceptions.table(l.heading);
      if (!(await table.root.count())) continue;
      const ref = (await table.links.first().innerText()).trim();
      const href = await expectRecordOpens(exceptions.page, table.links.first(), ref);
      seen.push(`${l.heading}: ${ref} → ${href.split('?')[0]}`);
    }
    note('links', seen.join(' | '));
  });

  test(...WB.key('page:reservations'), async ({ exceptions, reservations }) => {
    await exceptions.open();
    const k = await exceptions.kpis(['Reservations past expiry', 'Expiring in 7 days']);
    const deposit = (await exceptions.summaryCounts())['Reservation deposit not received after 7 days'] ?? 0;
    await reservations.open();
    const r = await reservations.kpis(['Past expiry, still active', 'Expiring in 7 days', 'Deposit not received']);
    note('values', `Exceptions ${JSON.stringify(k)}, deposit ${deposit} | Reservations ${JSON.stringify(r)}`);
    expect.soft(k['Reservations past expiry'], 'Past expiry').toBe(r['Past expiry, still active']);
    expect.soft(k['Expiring in 7 days'], 'Expiring in 7 days').toBe(r['Expiring in 7 days']);
    expect.soft(deposit, 'Deposit list ≤ Deposit not received').toBeLessThanOrEqual(r['Deposit not received']);
  });

  test(...WB.key('page:collections'), async ({ exceptions, collections }) => {
    await exceptions.open();
    const overdue = await exceptions.kpi('Overdue instalments');
    await collections.open();
    const total = num((await collections.byProject.total())?.['Overdue Instalments'] ?? '0');
    note('values', `Exceptions ${overdue} | Collections by Project Total ${total}`);
    expect(overdue).toBe(total);
  });

  test(...WB.key('page:spa'), async ({ exceptions, spa }) => {
    await exceptions.open();
    const open = await exceptions.summaryCounts();
    await spa.open();
    const k = await spa.kpis(['Awaiting signature', 'Signed, KYC not approved']);
    const pending = num((await spa.byProject.total())?.['ERP Handoff Pending'] ?? '0');
    expect.soft(open['Signed SPAs with KYC not approved'] ?? 0, 'KYC list = Signed, KYC not approved').toBe(k['Signed, KYC not approved']);
    expect.soft(open['SPAs not signed after 14 days'] ?? 0, 'Unsigned list ≤ Awaiting signature').toBeLessThanOrEqual(k['Awaiting signature']);
    expect.soft(open['Signed SPAs not handed off to ERP after 3 days'] ?? 0, 'ERP list ≤ ERP Handoff Pending').toBeLessThanOrEqual(pending);
  });
});

test.describe('Exception Reports · Clickable Map and observations', () => {
  test(...WB.mapKey('map:record'), async ({ exceptions }) => {
    await exceptions.open();
    const table = exceptions.table(LISTS[0].heading);
    test.skip(!(await table.root.count()), 'No overdue instalments');
    await expectRecordOpens(exceptions.page, table.links.first(), (await table.links.first().innerText()).trim());
  });

  test(...WB.obs('OBS-01'), async ({ exceptions }) => {
    await exceptions.open();
    const seen: string[] = [];
    for (const p of ['this_month', 'last_12_months'] as const) { await exceptions.setPeriod(p); seen.push(`${p}: Open exceptions ${await exceptions.kpi('Open exceptions')}`); }
    note('finding', `Default period ${await exceptions.period()} | ${seen.join(' | ')} (the report says the period does not apply)`);
  });

  test(...WB.obs('OBS-03'), async ({ exceptions }) => {
    test.setTimeout(180_000);
    await exceptions.open();
    const diffs: string[] = [];
    for (const [i, label] of (await exceptions.filterOptions('All projects')).entries()) {
      await exceptions.setFilterIndex('All projects', i + 1);
      diffs.push(...await listsAgainstSummary(exceptions, `${label}:`));
    }
    expect(diffs, 'Lists that do not follow the Project filter').toEqual([]);
  });

  test(...WB.obs('OBS-04'), async ({ exceptions }) => {
    await exceptions.open();
    const open = await exceptions.summaryCounts();
    note('finding', `Open exceptions ${await exceptions.kpi('Open exceptions')} = ${Object.entries(open).map(([k, v]) => `${k} ${v}`).join(' + ')}`);
  });
});
