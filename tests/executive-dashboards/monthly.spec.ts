/**
 * Monthly Sales & Marketing tab (EXD-032…047), period This month: tiles, the 12 report sections and the notes, against
 * the snapshot API and the Inventory, Reservations, SPA / Sales Contracts and Currency modules. Read only.
 * Run: npx playwright test tests/executive-dashboards/monthly.spec.ts
 */
import { test, expect } from './fixtures';
import { tc, note, shown, expectShows, expectRate, expectSameShown, fmt, within } from './shared';
import { tilesMatchApi, narrativesQuoteTiles } from './checks';
import type { DashboardsPage, Table } from './DashboardsPage';

const TAB = 'Monthly Sales & Marketing';
const range = (dash: DashboardsPage) => ({ from: dash.api.snapshot.metadata.fromDate as string, to: dash.api.snapshot.metadata.toDate as string });
const v = async (dash: DashboardsPage, label: string) => shown(await dash.tileValue(label)).value;
const dump = (t: Table) => [t.headers.join(' | '), ...t.rows.map(r => r.join(' | '))].join(' // ');
const totalRow = (t: Table) => t.rows.find(r => /^TOTAL$/i.test(r[0]));
const body = (t: Table) => t.rows.filter(r => !/^TOTAL$/i.test(r[0]));
const col = (t: Table, c: string) => t.headers.findIndex(h => h.toUpperCase().startsWith(c.toUpperCase()));

test.describe('Executive Dashboards · Monthly Sales & Marketing', () => {
  test.beforeEach(async ({ dash }) => { await dash.open(TAB, 'this_month'); });

  test(...tc('EXD-032'), async ({ dash }) => { await tilesMatchApi(dash, TAB); });

  test(...tc('EXD-033'), async ({ dash, src }) => {
    const s = (await src.units()).summary;
    const sold = (s.byStatus as any[]).find(x => x.code === 'SOLD')?.count ?? 0;
    note('Inventory', `total ${s.total}, available ${s.available}, reserved ${s.reserved}, sold ${sold}`);
    expectShows(await dash.tileValue('TOTAL INVENTORY'), s.total, 'Total Inventory = Inventory units');
    expectShows(await dash.tileValue('UNITS AVAILABLE'), s.available, 'Units Available = Inventory available');
    expectShows(await dash.tileValue('UNITS RESERVED'), s.reserved, 'Units Reserved = Inventory reserved');
    expect.soft(await v(dash, 'TOTAL INVENTORY'), 'Total = Available + Reserved + Sold').toBe(s.available + s.reserved + sold);
  });

  test(...tc('EXD-034'), async ({ dash, src }) => {
    const year = range(dash).to.slice(0, 4);
    const signed = (await src.contracts()).items.filter(c => c.contractStatus?.code === 'SIGNED' && within(c.contractDate, { from: `${year}-01-01`, to: range(dash).to }));
    const c = await src.collections();
    note('contracts this year / collections', `${signed.length} signed, ${fmt(signed.reduce((s, x) => s + Number(x.contractValue), 0))} / received ${fmt(c.totals.amountReceived)}`);
    expectShows(await dash.tileValue('UNITS SOLD (YTD)'), signed.length, 'Units Sold (YTD) = contracts signed this year');
    expectShows(await dash.tileValue('GROSS SALES (YTD)'), signed.reduce((s, x) => s + Number(x.contractValue), 0), 'Gross Sales (YTD) = value of contracts signed this year');
    expectShows(await dash.tileValue('COLLECTIONS (YTD)'), c.totals.amountReceived, 'Collections (YTD) = collections received (SPA / Sales Contracts)');
  });

  test(...tc('EXD-035'), async ({ dash, src }) => {
    const t = await dash.table('1. SALES SUMMARY');
    note('table', dump(t));
    expect(t.rows.length, 'Sales Summary rows').toBeGreaterThan(0);
    expectShows(t.get('Units Sold', 'This Month'), await v(dash, 'UNITS SOLD (PERIOD)'), 'Units Sold this month = tile');
    expectSameShown(t.get('Gross Sales', 'This Month'), await dash.tileValue('GROSS SALES (PERIOD)'), 'Gross Sales this month = tile');
    expectSameShown(t.get('Collections', 'This Month'), await dash.tileValue('COLLECTIONS (PERIOD)'), 'Collections this month = tile');
    for (const r of t.rows) {
      const [metric, now, prior, change] = r;
      const N = shown(now).value, P = shown(prior).value;
      if (/rate/i.test(metric)) expectShows(change, N - P, `${metric}: change in points = this − prior`, shown(now).tol + shown(prior).tol);
      else if (P) expectShows(change, ((N - P) / P) * 100, `${metric}: Var % = (this − prior) ÷ prior`, 100 * (shown(now).tol + shown(prior).tol) / P + 0.05);
    }
    const m = dash.api.snapshot.metadata;
    const prior = (await src.contracts()).items.filter(c => c.contractStatus?.code === 'SIGNED' && within(c.contractDate, { from: m.priorStartDate, to: m.priorEndDate }));
    note('contracts signed last month', `${m.priorStartDate} → ${m.priorEndDate}: ${prior.map(c => `${c.contractNo} ${fmt(c.contractValue)}`).join(' | ')}`);
    expectShows(t.get('Units Sold', 'Prior Month'), prior.length, 'Prior month units = contracts signed last month');
    expectShows(t.get('Gross Sales', 'Prior Month'), prior.reduce((s, c) => s + Number(c.contractValue), 0), 'Prior month gross sales = value of contracts signed last month');
  });

  test(...tc('EXD-036'), async ({ dash }) => {
    const ls = await dash.section('2. SALES PERFORMANCE');
    const cards: { name: string; actual: string; target: string; pct: string }[] = [];
    for (let i = 0; i + 3 < ls.length; i++) if (!/\d/.test(ls[i]) && /\d/.test(ls[i + 1]) && /Target/i.test(ls[i + 2]) && /%$/.test(ls[i + 3])) { cards.push({ name: ls[i], actual: ls[i + 1], target: ls[i + 2], pct: ls[i + 3] }); i += 3; }
    note('cards', cards.map(c => `${c.name}: ${c.actual} · ${c.target} · ${c.pct}`).join(' | '));
    expect(cards.length, 'Performance cards read').toBeGreaterThan(3);
    const k = (code: string) => dash.kpi(code);
    const want: Record<string, [number, number]> = {
      'Units Sold': [k('MONTH_UNITS_SOLD').actualValue, k('MONTH_UNITS_SOLD').budgetValue], 'Sales Value': [k('MONTH_SALES_VALUE').actualValue, k('MONTH_SALES_VALUE').budgetValue],
      'Collections': [k('MONTH_COLLECTIONS').actualValue, k('MONTH_COLLECTIONS').budgetValue], 'Avg. Selling Price': [k('AVG_PRICE').actualValue, k('AVG_PRICE').budgetValue],
    };
    for (const c of cards) {
      if (want[c.name]) expectRate(c.pct, want[c.name][0], want[c.name][1], `${c.name}: % of target = actual ÷ target`);
      if (/Collection Rate/i.test(c.name)) {
        expectRate(c.actual, k('MONTH_COLLECTIONS').actualValue, k('MONTH_SALES_VALUE').actualValue, 'Collection Rate = Collections ÷ Gross Sales');
        expectRate(c.pct, shown(c.actual).value, shown(c.target).value, 'Collection Rate: % of target');
      }
    }
  });

  test(...tc('EXD-037'), async ({ dash }) => {
    const t = await dash.table('4. SALES BY DEVELOPMENT');
    note('table', dump(t));
    const tot = totalRow(t), rows = body(t);
    expect(tot, 'Total row').toBeTruthy();
    expect.soft(rows.reduce((s, r) => s + shown(r[1]).value, 0), 'Units add up to the Total row').toBe(shown(tot?.[1] ?? '').value);
    expectShows(tot?.[1], await v(dash, 'UNITS SOLD (PERIOD)'), 'Total units = Units Sold (Period)');
    expectSameShown(tot?.[3], await dash.tileValue('GROSS SALES (PERIOD)'), 'Total value = Gross Sales (Period)');
    const total = shown(tot?.[1] ?? '').value;
    for (const r of rows) if (total) expectRate(r[2], shown(r[1]).value, total, `${r[0]} % Share`);
    const api = dash.api.snapshot.breakdowns.TOP_PROJECTS as any[];
    for (const r of rows) {
      const p = api.find(x => x.itemLabel === r[0]);
      expect.soft(p, `${r[0]} is listed in Top Projects of Commercial / Sales`).toBeTruthy();
      if (p) { expectShows(r[1], p.countValue, `${r[0]} units = Top Projects`); expectShows(r[3], p.amountValue, `${r[0]} value = Top Projects`); }
    }
  });

  test(...tc('EXD-038'), async ({ dash, src }) => {
    const t = await dash.table('5. SALES BY UNIT TYPE');
    const units = (await src.units()).items;
    note('table', dump(t));
    const tot = totalRow(t);
    for (const r of body(t)) {
      const mine = units.filter(u => u.unitType?.name === r[0]);
      expect.soft(shown(r[col(t, 'Inv')]).value, `${r[0]}: Inv = Inventory units of that type`).toBe(mine.length);
      expect.soft(shown(r[col(t, 'Avail')]).value, `${r[0]}: Avail = available units of that type`).toBe(mine.filter(u => u.availabilityStatus?.code === 'AVAILABLE').length);
      if (shown(r[col(t, 'Inv')]).value) expectRate(r[col(t, 'Sold %')], shown(r[col(t, 'Sold')]).value, shown(r[col(t, 'Inv')]).value, `${r[0]}: Sold % = Sold ÷ Inv`);
    }
    expectShows(tot?.[col(t, 'Inv')], await v(dash, 'TOTAL INVENTORY'), 'TOTAL Inv = Total Inventory');
    expectShows(tot?.[col(t, 'Avail')], await v(dash, 'UNITS AVAILABLE'), 'TOTAL Avail = Units Available');
    expectShows(tot?.[col(t, 'Sold')], await v(dash, 'UNITS SOLD (PERIOD)'), 'TOTAL Sold = Units Sold (Period)');
    expectSameShown(tot?.[col(t, 'Sales Value')], await dash.tileValue('GROSS SALES (PERIOD)'), 'TOTAL Sales Value = Gross Sales (Period)');
  });

  test(...tc('EXD-039'), async ({ dash, src }) => {
    const ls = await dash.section('6. UNIT INVENTORY STATUS');
    const total = shown(ls[0]).value;
    const parts = (await dash.pairs('6. UNIT INVENTORY STATUS')).map(p => ({ ...p, count: Number(p.label.match(/\((\d+)\)\s*$/)?.[1] ?? NaN) }));
    const s = (await src.units()).summary;
    note('status / Inventory', `${ls[0]} · ${parts.map(p => `${p.label} ${p.value}`).join(' | ')} / ${JSON.stringify(s.byStatus)}`);
    expect.soft(parts.reduce((a, p) => a + (Number.isNaN(p.count) ? 0 : p.count), 0), 'Counts add up to TOTAL UNITS').toBe(total);
    for (const p of parts) {
      const pct = p.value.match(/\(([\d.]+%)\)/)?.[1];
      if (pct && total) expectRate(pct, p.count, total, `${p.label}: % of units`);
      const code = /^Available/i.test(p.label) ? 'AVAILABLE' : /^Reserved/i.test(p.label) ? 'RESERVED' : /^Sold/i.test(p.label) ? 'SOLD' : '';
      const inv = (s.byStatus as any[]).find(x => x.code === code);
      if (inv) { expect.soft(p.count, `${p.label}: count = Inventory`).toBe(inv.count); expectShows(p.value, inv.value, `${p.label}: value = Inventory value`); }
    }
  });

  test(...tc('EXD-040'), async ({ dash, src }) => {
    const t = await dash.table('7. COLLECTIONS SUMMARY');
    const c = await src.collections();
    const amt = (codes: string[]) => (c.aging as any[]).filter(a => codes.includes(a.code)).reduce((s, a) => s + a.amount, 0);
    note('table / contracts', `${dump(t)} / aging ${JSON.stringify(c.aging.map((a: any) => [a.code, a.amount]))}`);
    expectSameShown(t.get('Gross Sales', 'This Month'), await dash.tileValue('GROSS SALES (PERIOD)'), 'Gross Sales this month = tile');
    expectSameShown(t.get('Collections Received', 'This Month'), await dash.tileValue('COLLECTIONS (PERIOD)'), 'Collections this month = tile');
    expectSameShown(t.get('Collections Received', 'YTD'), await dash.tileValue('COLLECTIONS (YTD)'), 'Collections YTD = tile');
    for (const row of ['Gross Sales', 'Collections Received', 'Net Collections']) {
      const now = shown(t.get(row, 'This Month') ?? ''), tg = shown(t.get(row, 'Target') ?? '');
      if (tg.value) expectShows(t.get(row, 'Achiev'), (now.value / tg.value) * 100, `${row}: Achiev. = this month ÷ target`, 100 * (now.tol + tg.tol) / tg.value + 0.5);
    }
    expectRate(t.get('Collection Rate', 'This Month'), dash.kpi('MONTH_COLLECTIONS').actualValue, dash.kpi('MONTH_SALES_VALUE').actualValue, 'Collection Rate = Collections ÷ Gross Sales');
    expectShows(t.get('Overdue > 30', 'YTD'), amt(['OVERDUE_31_60', 'OVERDUE_61_90', 'OVERDUE_90_PLUS']), 'Overdue > 30 days = contracts overdue more than 30 days');
    expectShows(t.get('Overdue > 60', 'YTD'), amt(['OVERDUE_61_90', 'OVERDUE_90_PLUS']), 'Overdue > 60 days = contracts overdue more than 60 days');
  });

  test(...tc('EXD-041'), async ({ dash }) => {
    const t = await dash.table('8. LEAD SOURCE PERFORMANCE');
    note('table', dump(t));
    const tot = totalRow(t), rows = body(t);
    expectShows(tot?.[1], dash.kpi('TOTAL_LEADS').actualValue, 'TOTAL Leads = Total Leads of the period');
    expectShows(tot?.[2], dash.api.snapshot.metadata.convertedLeads, 'TOTAL Conv. = converted leads of the period');
    expect.soft(rows.reduce((s, r) => s + shown(r[1]).value, 0), 'Leads add up to TOTAL').toBe(shown(tot?.[1] ?? '').value);
    expect.soft(rows.reduce((s, r) => s + shown(r[2]).value, 0), 'Conv. add up to TOTAL').toBe(shown(tot?.[2] ?? '').value);
    for (const r of [...rows, ...(tot ? [tot] : [])]) if (shown(r[1]).value) expectRate(r[3], shown(r[2]).value, shown(r[1]).value, `${r[0]}: Conv % = Conv ÷ Leads`);
  });

  test(...tc('EXD-042'), async ({ dash }) => {
    const t = await dash.table('9. TOP PERFORMING AGENTS');
    note('table', dump(t));
    const tot = totalRow(t), rows = body(t);
    expect.soft(rows.reduce((s, r) => s + shown(r[1]).value, 0), 'Units add up to TOTAL').toBe(shown(tot?.[1] ?? '').value);
    expectShows(tot?.[1], await v(dash, 'UNITS SOLD (PERIOD)'), 'TOTAL units = Units Sold (Period)');
    expectSameShown(tot?.[2], await dash.tileValue('GROSS SALES (PERIOD)'), 'TOTAL sales = Gross Sales (Period)');
    expectSameShown(tot?.[3], await dash.tileValue('COLLECTIONS (PERIOD)'), 'TOTAL collections = Collections (Period)');
  });

  test(...tc('EXD-043'), async ({ dash }) => {
    const t = await dash.table('10. RESERVATIONS BY MARKET');
    note('table', dump(t));
    const tot = totalRow(t), rows = body(t);
    expectShows(tot?.[1], await v(dash, 'UNITS RESERVED'), 'TOTAL units = Units Reserved');
    const total = shown(tot?.[1] ?? '').value;
    for (const r of rows) if (total) expectRate(r[2], shown(r[1]).value, total, `${r[0]}: % Share`);
  });

  test(...tc('EXD-044'), async ({ dash, src }) => {
    const r = range(dash);
    const cancelled = (await src.reservations()).items.filter(x => x.reservationStatus?.code === 'CANCELLED' && within(x.updatedAt, r));
    const t = await dash.table('11. CANCELLATION ANALYSIS');
    note('cancelled reservations (last update in the period)', `${cancelled.map(x => `${x.reservationNo} ${x.updatedAt.slice(0, 10)}`).join(' | ') || 'none'} · table: ${dump(t)}`);
    expectShows(await dash.tileValue('CANCELLATIONS (PERIOD)'), cancelled.length, `Cancellations (Period) = reservations cancelled ${r.from} → ${r.to} (Reservations module)`);
    expectShows(totalRow(t)?.[1], cancelled.length, 'Cancellation Analysis TOTAL = reservations cancelled in the period');
  });

  test(...tc('EXD-045'), async ({ dash }) => {
    const t = await dash.table('12. MARKETING CAMPAIGNS PERFORMANCE');
    note('table', dump(t));
    const tot = totalRow(t), rows = body(t);
    const L = col(t, 'Leads');
    expect.soft(rows.reduce((s, r) => s + shown(r[L]).value, 0), 'Leads add up to TOTAL').toBe(shown(tot?.[L] ?? '').value);
    expectShows(tot?.[L], dash.kpi('TOTAL_LEADS').actualValue, 'TOTAL leads = every lead of the period (Total Leads)');
  });

  test(...tc('EXD-046'), async ({ dash }) => { await narrativesQuoteTiles(dash, TAB); });

  test(...tc('EXD-047'), async ({ dash, src }) => {
    const ls = await dash.lines();
    const i = ls.findIndex(l => l === 'USD / KES');
    const rate = ls[i + 1];
    const kes = await src.usdToKes();
    const notes = (await dash.section('NOTES')).join(' ');
    const r = range(dash);
    note('notes', `USD / KES ${rate} · Currency Master 1 USD = ${kes.toFixed(4)} KES · ${notes}`);
    expectShows(rate, kes, 'USD / KES = Currency Master rate (1 USD in KES)');
    expect.soft(notes, 'Period window = dates of the tiles').toContain(`${r.from} → ${r.to}`);
    expect.soft(notes, 'Notes quote the same rate').toContain(`KES ${rate}`.replace(/0$/, ''));
  });
});
