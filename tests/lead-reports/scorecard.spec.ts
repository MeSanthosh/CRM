/** Lead Reports workbook — Salesperson Scorecard (LR-126…138). */
import { test, expect, note } from '../pages/fixtures';
import { num, sum } from '../helpers';
import { SCORECARD_COLUMNS, SCORECARD_LINK_COLUMNS } from '../pages/LeadReportsPage';
import type { Row } from '../pages/LeadTable';
import { lr } from './catalog';
import { expectRate, rowWithData, labelOf } from './shared';

const ACTIVITY = ['Calls', 'Meetings', 'Tasks Done'];
const AS_OF_TODAY = ['Open Now', 'Idle > 30 d', 'Never Contacted'];

/** Column totals per salesperson name (two salespeople can share a name). */
const byName = (rows: Row[], column: string) =>
  rows.reduce<Record<string, number>>((a, r) => ({ ...a, [labelOf(r)]: (a[labelOf(r)] ?? 0) + num(r[column]) }), {});

test.describe('Lead Reports · Salesperson Scorecard', () => {
  test(...lr('LR-126'), async ({ leadReports }) => {
    await leadReports.openAt('scorecard', 'last_12_months');
    expect.soft(await leadReports.scorecard.headers(), 'Columns').toEqual(SCORECARD_COLUMNS);
    expect.soft((await leadReports.scorecard.rows()).length, 'One row per salesperson').toBeGreaterThan(0);
    await expect.soft(leadReports.panel('Salesperson Scorecard'), 'Note on period vs today').toContainText(/as of today/i);
  });

  test(...lr('LR-127'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const k = await leadReports.kpis(['Leads Captured', 'SPA Signed', 'Open Leads Now']);
    await leadReports.openTab('Aging & Follow-up');
    const agingOpen = byName(await leadReports.agingBySalesperson.rows(), 'Open');
    await leadReports.openTab('Salesperson Scorecard');
    const rows = await leadReports.scorecard.rows();
    note('totals', `KPIs ${JSON.stringify(k)} | scorecard Leads ${sum(rows.map(r => num(r['Leads'])))}`);
    expect.soft(sum(rows.map(r => num(r['Leads']))), 'Leads = Leads Captured').toBe(k['Leads Captured']);
    expect.soft(sum(rows.map(r => num(r['SPA Signed']))), 'SPA Signed = card').toBe(k['SPA Signed']);
    expect.soft(sum(rows.map(r => num(r['Open Now']))), 'Open Now = Open Leads Now').toBe(k['Open Leads Now']);
    const scoreOpen = byName(rows, 'Open Now');
    for (const [name, open] of Object.entries(agingOpen)) expect.soft(scoreOpen[name] ?? 0, `${name}: Open Now = Aging Open`).toBe(open);
  });

  test(...lr('LR-128'), async ({ leadReports }) => {
    await leadReports.openAt('scorecard', 'last_12_months');
    for (const r of await leadReports.scorecard.rows()) {
      const leads = num(r['Leads']);
      if (!leads) continue;
      expectRate(num(r['Conv. %']), num(r['Opportunity']), leads, `${labelOf(r)} Conv. %`);
      expectRate(num(r['Win %']), num(r['SPA Signed']), leads, `${labelOf(r)} Win %`);
    }
  });

  // LR-129 … LR-136: each count column opens that salesperson's leads (the busiest salesperson with a count)
  SCORECARD_LINK_COLUMNS.forEach((col, i) => {
    test(...lr(`LR-${129 + i}`), async ({ leadReports }) => {
      await leadReports.openAt('scorecard', 'last_12_months');
      const headers = await leadReports.scorecard.headers();
      const row = rowWithData(await leadReports.scorecard.rows(), col);
      test.skip(!row, `No "${col}" count above 0`);
      const { drill } = await leadReports.drill.verify(leadReports.scorecard.link(row!, col, headers), { rowLabel: labelOf(row!) });
      if (AS_OF_TODAY.includes(col)) expect.soft(drill.asOfToday, 'Marked "as of today"').toBeTruthy();
    });
  });

  test(...lr('LR-137'), async ({ leadReports }) => {
    await leadReports.openAt('scorecard', 'last_12_months');
    const yearRows = await leadReports.scorecard.rows();
    await leadReports.setPeriod('this_month');
    const monthRows = await leadReports.scorecard.rows();
    // two salespeople can share a name, so compare per-name totals
    for (const c of ACTIVITY) {
      const y = byName(yearRows, c), m = byName(monthRows, c);
      for (const name of Object.keys(m)) expect.soft(m[name], `${name} ${c}: This month ≤ Last 12 months`).toBeLessThanOrEqual(y[name] ?? 0);
    }
    for (const c of AS_OF_TODAY) {
      const y = byName(yearRows, c), m = byName(monthRows, c);
      for (const name of new Set([...Object.keys(y), ...Object.keys(m)])) {
        expect.soft(m[name] ?? 0, `${name} ${c} does not change with the period`).toBe(y[name] ?? 0);
      }
    }
  });

  test(...lr('LR-138'), async ({ leadReports }) => {
    await leadReports.openAt('scorecard', 'last_12_months');
    // the export also carries the "Company average" row, like the screen
    const summary = await leadReports.scorecard.summaryRow();
    const rows = [...await leadReports.scorecard.rows(), ...(summary ? [summary] : [])];
    const sheet = await leadReports.scorecard.export();
    note('export', `${sheet.name}: ${sheet.rows.length} rows; columns ${sheet.header.join(' | ')}`);
    expect.soft(sheet.name).toMatch(/^lead-report-scorecard-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect.soft(sheet.rows.length, 'One row per salesperson (plus the average row)').toBe(rows.length);
    // names can repeat, so compare the whole set of rows (name + figures) rather than looking rows up by name
    const COLS = ['Leads', 'Contacted', 'Qualified', 'Opportunity', 'SPA Signed', 'Open Now', 'Never Contacted'];
    const screen = rows.map(r => [labelOf(r), ...COLS.map(c => num(r[c]))].join(' | ')).sort();
    const file = sheet.rows.map(r => [String(r['Salesperson']), ...COLS.map(c => Number(r[c] ?? 0))].join(' | ')).sort();
    expect.soft(file, `Export rows (${COLS.join(', ')}) = table rows`).toEqual(screen);
  });
});
