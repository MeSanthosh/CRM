/**
 * Collection Reports workbook: common rows come from module-workbooks/common.ts; this file adds the page's own rows
 * (page:…), the record-link map row and the question observations. Values are read live (exports give exact amounts).
 */
import { test, expect, note } from '../pages/fixtures';
import { num, sum } from '../helpers';
import { declareCommon, declareCoverage } from '../module-workbooks/common';
import { shownTolerance, expectRecordOpens, sameDay } from '../module-workbooks/helpers';
import type { CollectionReportsPage } from '../pages/CollectionReportsPage';
import { WB, CFG } from './workbook';

declareCommon(WB, CFG);
declareCoverage(WB, 'tests/collection-reports');

const n = (v: unknown) => Number(v ?? 0);
/** Age rows of instalments that are not due yet ("Due in more than 30 days", "Due within 30 days"). */
const NOT_DUE = /^due\b/i;

/** Exact figures from the Age and Project exports. */
async function exact(c: CollectionReportsPage) {
  await c.openWith('last_12_months');
  const aging = await c.byAge.export();
  const projects = await c.byProject.export();
  return { aging, projects, total: projects.total ?? {} };
}

/** A shown amount equals an exact one within its display rounding. */
function expectShownClose(shown: string, exactValue: number, what: string) {
  expect.soft(Math.abs(num(shown) - exactValue), `${what}: shown ${shown} vs ${exactValue}`).toBeLessThanOrEqual(shownTolerance(shown) + 0.01);
}

async function openFirstContract(c: CollectionReportsPage) {
  await c.openWith('last_12_months');
  const rows = (await c.overdue.root.count()) ? await c.overdue.rows() : [];
  test.skip(!rows.length, 'No overdue instalments');
  const href = await expectRecordOpens(c.page, c.overdue.links.first(), rows[0]['SPA']);
  expect.soft(href, 'Link target').toMatch(/^\/spa-contracts\?selected=/);
}

test.describe('Collection Reports · Page checks', () => {
  test(...WB.key('page:outstanding'), async ({ collections }) => {
    const { projects, total } = await exact(collections);
    expectShownClose(await collections.shown('Outstanding'), n(total['Scheduled (USD)']) - n(total['Received (USD)']), 'Outstanding card = Scheduled − Received');
    for (const r of [...projects.rows, total]) {
      expect.soft(Math.abs(n(r['Outstanding (USD)']) - (n(r['Scheduled (USD)']) - n(r['Received (USD)']))), `${r['Project']}: Outstanding = Scheduled − Received`).toBeLessThanOrEqual(0.01);
    }
  });

  test(...WB.key('page:collection-rate'), async ({ collections }) => {
    const { aging, total } = await exact(collections);
    const notDue = sum(aging.rows.filter(r => NOT_DUE.test(String(r['Age']))).map(r => n(r['Amount (USD)'])));
    const dueToDate = n(total['Scheduled (USD)']) - notDue;
    const received = n(total['Received (USD)']);
    const rate = await collections.shown('Collection rate');
    const expected = dueToDate ? (received / dueToDate) * 100 : NaN;
    note('values', `Received ${received} ÷ due to date ${dueToDate} (Scheduled ${total['Scheduled (USD)']} − not yet due ${notDue}) = ${expected.toFixed(2)}% | card ${rate}`);
    expect(Math.abs(num(rate) - expected), 'Collection rate = Received ÷ amount due to date').toBeLessThanOrEqual(0.1);
  });

  test(...WB.key('page:aging'), async ({ collections }) => {
    const { aging } = await exact(collections);
    const overdueRows = aging.rows.filter(r => !NOT_DUE.test(String(r['Age'])));
    note('rows', aging.rows.map(r => `${r['Age']} ${r['Amount (USD)']}`).join(' | '));
    expectShownClose(await collections.shown('Overdue'), sum(overdueRows.map(r => n(r['Amount (USD)']))), 'Overdue rows add up to Overdue');
    const within = aging.rows.find(r => /within 30 days/i.test(String(r['Age'])));
    if (within) expectShownClose(await collections.shown('Due in next 30 days'), n(within['Amount (USD)']), '"Due within 30 days" = Due in next 30 days');
    const all = n(aging.total?.['Amount (USD)']);
    for (const r of aging.rows) if (all) expect.soft(Math.abs(n(r['Share %']) - (n(r['Amount (USD)']) / all) * 100), `${r['Age']}: Share %`).toBeLessThanOrEqual(0.1);
  });

  test(...WB.key('page:overdue-list'), async ({ collections }) => {
    const { total } = await exact(collections);
    const list = await collections.overdue.export();
    const today = new Date(new Date().toDateString());
    const days = list.rows.map(r => n(r['Days Overdue']));
    note('values', `${list.rows.length} overdue instalments, ${sum(list.rows.map(r => n(r['Amount (USD)'])))} | project Total ${total['Overdue Instalments']} instalments, ${total['Overdue (USD)']}`);
    expect.soft(list.rows.length, 'Rows = Overdue Instalments total').toBe(n(total['Overdue Instalments']));
    expect.soft(Math.abs(sum(list.rows.map(r => n(r['Amount (USD)']))) - n(total['Overdue (USD)'])), 'Amounts add up to Overdue').toBeLessThanOrEqual(1);
    expect.soft(days, 'Most overdue first').toEqual([...days].sort((a, b) => b - a));
    const wrong = list.rows.filter(r => typeof r['Due Date'] === 'number' && !sameDay((r['Due Date'] as number) + n(r['Days Overdue']), today)
      && !sameDay((r['Due Date'] as number) + n(r['Days Overdue']) + 1, today) && !sameDay((r['Due Date'] as number) + n(r['Days Overdue']) - 1, today));
    expect.soft(wrong.map(r => `${r['SPA']} ${r['Milestone']}: due ${r['Due Date']}, ${r['Days Overdue']} d`).slice(0, 10), 'Days Overdue = today − Due Date (±1)').toEqual([]);
  });

  test(...WB.key('page:contract-link'), async ({ collections }) => {
    await openFirstContract(collections);
  });

  test(...WB.key('page:project-rows'), async ({ collections }) => {
    await collections.openWith('last_12_months');
    const rows = new Map((await collections.byProject.rows()).map(r => [r['Project'], r]));
    const diffs: string[] = [];
    for (const [i, label] of (await collections.filterOptions('All projects')).entries()) {
      await collections.setFilterIndex('All projects', i + 1);
      const row = rows.get(label);
      if (!row) continue;
      for (const [card, col] of [['Scheduled', 'Scheduled (USD)'], ['Received', 'Received (USD)'], ['Outstanding', 'Outstanding (USD)'], ['Overdue', 'Overdue (USD)']]) {
        const shown = await collections.shown(card);
        if (Math.abs(num(shown) - num(row[col])) > shownTolerance(shown) + shownTolerance(row[col])) diffs.push(`${label}: ${card} ${shown} vs row ${row[col]}`);
      }
    }
    expect(diffs).toEqual([]);
  });

  test(...WB.key('page:dashboard'), async ({ collections, executive }) => {
    await collections.open();
    const received = await collections.shown('Received'), outstanding = await collections.shown('Outstanding');
    await executive.open();
    const dashReceived = await executive.kpiText('Collections Received'), dashOutstanding = await executive.kpiText('Outstanding Amount');
    note('values', `Collection Reports ${received} / ${outstanding} | dashboard ${dashReceived} / ${dashOutstanding}`);
    expect.soft(Math.abs(num(dashReceived) - num(received)), 'Collections Received = Received').toBeLessThanOrEqual(shownTolerance(received) + shownTolerance(dashReceived));
    expect.soft(Math.abs(num(dashOutstanding) - num(outstanding)), 'Outstanding Amount = Outstanding').toBeLessThanOrEqual(shownTolerance(outstanding) + shownTolerance(dashOutstanding));
  });
});

test.describe('Collection Reports · Clickable Map and observations', () => {
  test(...WB.mapKey('map:record'), async ({ collections }) => {
    await openFirstContract(collections);
  });

  test(...WB.obs('OBS-03'), async ({ collections }) => {
    await collections.open();
    const by: string[] = [];
    for (const p of ['this_month', 'last_12_months'] as const) { await collections.setPeriod(p); by.push(`${p}: ${JSON.stringify(await collections.shownAll())}`); }
    note('finding', by.join(' | '));
  });

  test(...WB.obs('OBS-04'), async ({ collections }) => {
    await collections.open();
    const k = await collections.shownAll();
    note('finding', `Scheduled ${k['Scheduled']}, Received ${k['Received']}, Overdue ${k['Overdue']}, Collection rate ${k['Collection rate']}`);
  });
});
