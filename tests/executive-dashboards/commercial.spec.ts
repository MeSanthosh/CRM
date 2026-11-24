/**
 * Commercial / Sales tab (EXD-011…031), period This month. Tiles, charts and tables are checked against the API they come
 * from and against the modules that hold the records (Leads, Opportunities, Inventory, Reservations, SPA / Sales Contracts).
 * Read only. Run: npx playwright test tests/executive-dashboards/commercial.spec.ts
 */
import { test, expect } from './fixtures';
import { tc, note, shown, displays, expectShows, expectRate, expectSameShown, fmt, within } from './shared';
import { tilesMatchApi, narrativesQuoteTiles } from './checks';
import type { DashboardsPage } from './DashboardsPage';

const TAB = 'Commercial / Sales';
/** The period the figures cover, from the API (metadata fromDate / toDate). */
const range = (dash: DashboardsPage) => ({ from: dash.api.snapshot.metadata.fromDate as string, to: dash.api.snapshot.metadata.toDate as string });
const v = async (dash: DashboardsPage, label: string) => shown(await dash.tileValue(label)).value;
/** "29 (11%)" → { count: 29, pct: '11%' } */
const countPct = (s: string) => ({ count: shown(s).value, pct: s.match(/\(([\d.]+%)\)/)?.[1] ?? '' });

test.describe('Executive Dashboards · Commercial / Sales', () => {
  test.beforeEach(async ({ dash }) => { await dash.open(TAB, 'this_month'); });

  test(...tc('EXD-011'), async ({ dash }) => { await tilesMatchApi(dash, TAB); });

  test(...tc('EXD-012'), async ({ dash, src }) => {
    const r = range(dash);
    const leads = (await src.leads()).items.filter(l => within(l.capturedAt, r));
    const qualified = leads.filter(l => l.leadStatus?.code === 'QUALIFIED');
    note('Leads module', `${leads.length} captured ${r.from} → ${r.to}; ${qualified.length} of them Qualified`);
    expectShows(await dash.tileValue('TOTAL LEADS'), leads.length, 'Total Leads = leads captured in the period (Leads module)');
    expectShows(await dash.tileValue('QUALIFIED LEADS'), qualified.length, 'Qualified Leads = leads captured in the period with status Qualified');
  });

  test(...tc('EXD-013'), async ({ dash, src }) => {
    const r = range(dash);
    const visits = (await src.siteVisits()).filter(x => within(x.visitDate, r));
    note('site visits on opportunities', visits.map(x => `${x.opportunityNo} ${x.visitDate.slice(0, 10)} ${x.visitType} ${x.status}`).join(' | ') || 'none');
    expectShows(await dash.tileValue('SITE VISITS'), visits.length, `Site Visits = site visits logged on opportunities ${r.from} → ${r.to}`);
  });

  test(...tc('EXD-014'), async ({ dash, src }) => {
    const res = (await src.reservations()).summary, units = (await src.units()).summary;
    note('modules', `Reservations active ${res.active} · Inventory reserved ${units.reserved}`);
    expectShows(await dash.tileValue('RESERVATIONS'), res.active, 'Reservations = active reservations (Reservations module)');
    expectShows(await dash.tileValue('RESERVATIONS'), units.reserved, 'Reservations = reserved units (Inventory)');
  });

  test(...tc('EXD-015'), async ({ dash, src }) => {
    const r = range(dash);
    const signed = (await src.contracts()).items.filter(c => c.contractStatus?.code === 'SIGNED' && within(c.contractDate, r));
    const value = signed.reduce((s, c) => s + Number(c.contractValue), 0);
    note('contracts signed in the period', signed.map(c => `${c.contractNo} ${c.contractDate.slice(0, 10)} ${fmt(c.contractValue)}`).join(' | ') || 'none');
    expectShows(await dash.tileValue('UNITS SOLD'), signed.length, 'Units Sold = contracts signed in the period');
    expectShows(await dash.tileValue('SALES VALUE'), value, 'Sales Value = value of contracts signed in the period');
  });

  test(...tc('EXD-016'), async ({ dash }) => {
    const tile = await dash.tile('CONVERSION RATE');
    const m = tile?.tooltip.match(/\[(\d+)\][^[]*\[(\d+)\]/);
    note('tooltip', tile?.tooltip ?? '');
    expect.soft(m, 'Tooltip quotes converted and total leads').toBeTruthy();
    if (m) {
      expectRate(tile!.value, Number(m[1]), Number(m[2]), 'Conversion Rate = converted ÷ total leads');
      expect.soft(Number(m[2]), 'Tooltip total = Total Leads tile').toBe(await v(dash, 'TOTAL LEADS'));
    }
  });

  test(...tc('EXD-017'), async ({ dash }) => {
    const ls = await dash.section('SALES FUNNEL');
    const stages: { name: string; count: number; pct: string; step: string }[] = [];
    for (let i = 0; i < ls.length; i++) {
      if (/\d/.test(ls[i]) || /^conversion$/i.test(ls[i])) continue;
      const c = countPct(ls[i + 1] ?? '');
      const step = /^\d+(\.\d+)?%$/.test(ls[i + 2] ?? '') ? ls[i + 2] : '';
      stages.push({ name: ls[i], count: c.count, pct: c.pct, step });
    }
    note('funnel', stages.map(s => `${s.name} ${s.count} (${s.pct}) step ${s.step}`).join(' | '));
    const by = (n: string) => stages.find(s => s.name.toUpperCase() === n.toUpperCase());
    expectShows(String(by('Leads')?.count ?? ''), await v(dash, 'TOTAL LEADS'), 'Funnel Leads = Total Leads');
    expectShows(String(by('Qualified Leads')?.count ?? ''), await v(dash, 'QUALIFIED LEADS'), 'Funnel Qualified = Qualified Leads');
    expectShows(String(by('Reservations')?.count ?? ''), await v(dash, 'RESERVATIONS'), 'Funnel Reservations = Reservations');
    expectShows(String(by('Units Sold')?.count ?? ''), await v(dash, 'UNITS SOLD'), 'Funnel Units Sold = Units Sold');
    const leads = stages[0]?.count ?? 0;
    stages.slice(1).forEach((s, i) => {
      if (s.pct) expectRate(s.pct, s.count, leads, `${s.name} (x%) = ${s.name} ÷ Leads`);
      if (s.step) expectRate(s.step, s.count, stages[i].count, `${s.name} conversion = ${s.name} ÷ ${stages[i].name}`);
    });
  });

  test(...tc('EXD-018'), async ({ dash, src }) => {
    const pts = await dash.monthly('SALES VALUE TREND', 1);
    const series = dash.api.snapshot.series.SALES_VALUE_TREND as { periodBucket: string; year: number }[];
    const contracts = (await src.contracts()).items.filter(c => c.contractStatus?.code === 'SIGNED');
    note('trend', pts.map(p => `${p.month} ${p.values[0]}`).join(', '));
    expect(pts.length, 'Trend points read').toBeGreaterThan(0);
    for (const p of pts) {
      const year = series.find(s => s.periodBucket === p.month)?.year;
      const m = new Date(`${p.month} 1, ${year}`).getMonth();
      const sum = contracts.filter(c => new Date(c.contractDate).getFullYear() === year && new Date(c.contractDate).getMonth() === m).reduce((s, c) => s + Number(c.contractValue), 0) / 1e6;
      expect.soft(displays(String(p.values[0]), sum), `${p.month} ${year}: trend ${p.values[0]} = contracts signed that month (${sum.toFixed(3)} M)`).toBeTruthy();
    }
    expectSameShown(`${pts[pts.length - 1]?.values[0]}M`, await dash.tileValue('SALES VALUE'), 'Last month of the trend = Sales Value');
  });

  test(...tc('EXD-019'), async ({ dash, src }) => {
    const ls = await dash.section('SALES BY PRODUCT TYPE');
    const total = ls[0];
    const parts = await dash.pairs('SALES BY PRODUCT TYPE');
    note('product types', `${total} · ${parts.map(p => `${p.label} ${p.value}`).join(' | ')}`);
    expectSameShown(total, await dash.tileValue('SALES VALUE'), 'TOTAL SALES = Sales Value');
    const sum = parts.reduce((s, p) => s + shown(p.value).value, 0);
    expect.soft(Math.abs(sum - shown(total).value) <= shown(total).tol * 2 + parts.length * 5e3, `Parts add up to TOTAL SALES (${fmt(sum)} vs ${total})`).toBeTruthy();
    for (const p of parts) { const pct = p.value.match(/\(([\d.]+%)\)/)?.[1]; if (pct) expectRate(pct, shown(p.value).value, shown(total).value, `${p.label} %`); }
    const r = range(dash);
    const units = new Map((await src.units()).items.map(u => [u.id, u.unitType?.name]));
    const byType: Record<string, number> = {};
    for (const c of (await src.contracts()).items.filter(c => c.contractStatus?.code === 'SIGNED' && within(c.contractDate, r))) byType[units.get(c.unit?.id) ?? '?'] = (byType[units.get(c.unit?.id) ?? '?'] ?? 0) + Number(c.contractValue);
    note('contracts by unit type', JSON.stringify(byType));
    for (const p of parts) expectShows(p.value, byType[p.label] ?? 0, `${p.label} = contracts of that unit type in the period`);
  });

  test(...tc('EXD-020'), async ({ dash }) => {
    const ls = await dash.section('SALES BY MARKET');
    const parts = await dash.pairs('SALES BY MARKET');
    const shares = parts.map(p => shown(p.value).value);
    const axis = ls.filter(l => /^\d+%$/.test(l)).map(l => shown(l).value).filter(x => !shares.includes(x) || x === 0);
    note('market', `${parts.map(p => `${p.label} ${p.value}`).join(' | ')} · axis ${axis.join(', ')}`);
    expect.soft(Math.abs(shares.reduce((a, b) => a + b, 0) - 100) <= parts.length * 0.5, 'Shares add up to 100 %').toBeTruthy();
    if (axis.length) expect.soft(Math.max(...axis), `Axis (up to ${Math.max(...axis)}%) reaches the largest bar (${Math.max(...shares)}%)`).toBeGreaterThanOrEqual(Math.max(...shares));
  });

  test(...tc('EXD-021'), async ({ dash }) => {
    const t = await dash.table('SALES PERFORMANCE');
    note('table', [t.headers.join(' | '), ...t.rows.map(r => r.join(' | '))].join(' // '));
    expect(t.rows.length, 'Sales Performance rows').toBeGreaterThan(0);
    for (const row of t.rows) {
      const [metric, a, b, varc, ach] = row;
      const A = shown(a).value, B = shown(b).value;
      expectShows(varc, A - B, `${metric}: Variance = Actual − Budget`, shown(a).tol + shown(b).tol);
      if (B) expectShows(ach, (A / B) * 100, `${metric}: Achievement = Actual ÷ Budget`, 100 * (shown(a).tol / B) + 0.5);
    }
    expectSameShown(`${t.get('Sales Value', 'Actual')}M`, await dash.tileValue('SALES VALUE'), 'Sales Value actual = tile');
    expectShows(t.get('Units Sold', 'Actual'), await v(dash, 'UNITS SOLD'), 'Units Sold actual = tile');
    expectSameShown(`${t.get('Collections', 'Actual')}M`, await dash.tileValue('COLLECTIONS'), 'Collections actual = tile');
    const units = await v(dash, 'UNITS SOLD');
    if (units) expectShows(t.get('Avg. Selling Price', 'Actual'), dash.source('kpi:SALES_VALUE') / units, 'Avg. Selling Price = Sales Value ÷ Units Sold');
  });

  test(...tc('EXD-022'), async ({ dash, src }) => {
    const t = await dash.table('SALES PERFORMANCE');
    const targets = (await src.get('/dashboard/summary?period=this_month&view=audience')).salesVelocity.targets;
    note('budgets / published targets', `units ${t.get('Units Sold', 'Budget')}, sales ${t.get('Sales Value', 'Budget')} M / units ${targets.monthlyUnitsBudget}, revenue ${fmt(targets.monthlyRevenueBudgetUsd)}`);
    expectShows(t.get('Units Sold', 'Budget'), targets.monthlyUnitsBudget, 'Units budget = published Monthly Units Budget (Sales Velocity Targets)');
    expectShows(`${t.get('Sales Value', 'Budget')}M`, targets.monthlyRevenueBudgetUsd, 'Sales Value budget = published Monthly Revenue Budget (Sales Velocity Targets)');
  });

  test(...tc('EXD-023'), async ({ dash }) => {
    const trend = await dash.monthly('SALES VALUE TREND', 1);
    const cmp = await dash.monthly('MONTHLY SALES COMPARISON', 2);
    note('comparison', cmp.map(p => `${p.month} prior ${p.values[0]} actual ${p.values[1]}`).join(', '));
    expect(cmp.length, 'Comparison points read').toBeGreaterThan(0);
    for (const p of cmp) {
      const t = trend.find(x => x.month === p.month);
      expect.soft(p.values[1], `${p.month}: Actual = Sales Value Trend`).toBe(t?.values[0]);
    }
  });

  test(...tc('EXD-024'), async ({ dash }) => {
    const trend = await dash.monthly('SALES VALUE TREND', 1);
    const cs = await dash.monthly('COLLECTIONS VS SALES', 2, true);
    const k = dash.kpi('COLLECTIONS');
    const ytd = dash.api.snapshot.metadata.ytdCollectionsValue;
    note('collections vs sales', `${cs.map(p => `${p.month} sales ${p.values[0]} coll ${p.values[1]}`).join(', ')} · this month ${k.actualValue}, prior month ${k.priorValue}, YTD ${ytd}`);
    expect(cs.length, 'Chart points read').toBeGreaterThan(1);
    for (const p of cs) expect.soft(p.values[0], `${p.month}: Sales = Sales Value Trend`).toBe(trend.find(x => x.month === p.month)?.values[0]);
    const last = cs[cs.length - 1], prev = cs[cs.length - 2];
    expect.soft(displays(String(last.values[1]), k.actualValue / 1e6), `${last.month}: collections ${last.values[1]} M = Collections (${fmt(k.actualValue)})`).toBeTruthy();
    expect.soft(displays(String(prev.values[1]), k.priorValue / 1e6), `${prev.month}: collections ${prev.values[1]} M = prior month collections (${fmt(k.priorValue)})`).toBeTruthy();
    const sum = cs.reduce((s, p) => s + p.values[1], 0);
    expect.soft(Math.abs(sum - ytd / 1e6) <= cs.length * 0.005, `Months add up to Collections YTD (${sum.toFixed(2)} M vs ${fmt(ytd)})`).toBeTruthy();
  });

  test(...tc('EXD-025'), async ({ dash, src }) => {
    const ls = await dash.section('RECEIVABLES AGING');
    const outstanding = ls[0];
    const parts = await dash.pairs('RECEIVABLES AGING');
    const c = await src.collections();
    const amt = (code: string) => (c.aging as any[]).filter(a => a.code === code).reduce((s, a) => s + a.amount, 0);
    note('aging / contracts', `${outstanding} · ${parts.map(p => `${p.label} ${p.value}`).join(' | ')} / outstanding ${fmt(c.totals.outstanding)}, overdue ${fmt(c.totals.overdue)}, aging ${JSON.stringify(c.aging.map((a: any) => [a.code, a.amount]))}`);
    expectShows(outstanding, c.totals.outstanding, 'OUTSTANDING = outstanding of SPA / Sales Contracts');
    const sum = parts.reduce((s, p) => s + shown(p.value).value, 0);
    expect.soft(Math.abs(sum - shown(outstanding).value) <= shown(outstanding).tol * 2, 'Buckets add up to OUTSTANDING').toBeTruthy();
    const bucket = (re: RegExp) => parts.find(p => re.test(p.label))?.value;
    expectShows(bucket(/^31/), amt('OVERDUE_31_60'), '31–60 days = overdue 31–60 days (contracts)');
    expectShows(bucket(/^61/), amt('OVERDUE_61_90'), '61–90 days = overdue 61–90 days (contracts)');
    expectShows(bucket(/90/), amt('OVERDUE_90_PLUS'), '>90 days = overdue 90+ days (contracts)');
  });

  test(...tc('EXD-026'), async ({ dash }) => {
    const parts = await dash.pairs('TOP SALES CHANNELS');
    const total = dash.source('kpi:SALES_VALUE');
    note('channels', parts.map(p => `${p.label} ${p.value}`).join(' | '));
    const sum = parts.reduce((s, p) => s + shown(p.value).value, 0);
    expect.soft(Math.abs(sum - total) <= parts.length * 5e3 + 5e3, `Channels add up to Sales Value (${fmt(sum)} vs ${fmt(total)})`).toBeTruthy();
    for (const p of parts) { const pct = p.value.match(/\(([\d.]+%)\)/)?.[1]; if (pct) expectRate(pct, shown(p.value).value, total, `${p.label} %`); }
  });

  test(...tc('EXD-027'), async ({ dash }) => {
    const spend = await dash.valueBefore('MARKETING ROI', 'Marketing Spend');
    const roi = await dash.valueBefore('MARKETING ROI', 'Return on Investment');
    const revenue = await dash.valueBefore('MARKETING ROI', 'Revenue Generated');
    note('ROI', `spend ${spend} · ROI ${roi} · revenue ${revenue}`);
    expectSameShown(revenue, await dash.tileValue('SALES VALUE'), 'Revenue Generated = Sales Value');
    const S0 = shown(spend).value, R = shown(revenue).value;
    if (S0 > 0) expectShows(roi, ((R - S0) / S0) * 100, 'ROI = (Revenue − Spend) ÷ Spend', 0.5);
    else expect.soft(/\d/.test(roi) && R > 0, `ROI with no spend shows "—" / N/A, not "${roi}"`).toBeFalsy();
  });

  test(...tc('EXD-028'), async ({ dash, src }) => {
    const t = await dash.table('TOP PROJECTS BY SALES VALUE');
    const projects = (await src.projects()).items.map(p => p.name);
    note('projects', `${t.rows.map(r => r.join(' / ')).join(' | ')} · Inventory: ${projects.join(', ')}`);
    const total = dash.source('kpi:SALES_VALUE');
    const sum = t.rows.reduce((s, r) => s + shown(r[1]).value, 0);
    expect.soft(Math.abs(sum - total) <= t.rows.length * 5e3 + 5e3, 'Sales Value adds up to the tile').toBeTruthy();
    expect.soft(t.rows.reduce((s, r) => s + shown(r[2]).value, 0), 'Units Sold add up to the tile').toBe(await v(dash, 'UNITS SOLD'));
    for (const r of t.rows) {
      expect.soft(projects, `${r[0]} is an Inventory project`).toContain(r[0]);
      const amount = (dash.api.snapshot.breakdowns.TOP_PROJECTS as any[]).find(x => x.itemLabel === r[0])?.amountValue ?? shown(r[1]).value;
      if (total) expectRate(r[3], amount, total, `${r[0]} % of Total`);
    }
  });

  test(...tc('EXD-029'), async ({ dash, src }) => {
    const ls = await dash.section('SALES PIPELINE');
    const expected = ls[0];
    const parts = Object.fromEntries((await dash.pairs('SALES PIPELINE')).map(p => [p.label, p.value]));
    const opp = await src.opportunities(), res = (await src.reservations()).summary;
    const weighted = opp.items.filter(o => o.status === 'OPEN').reduce((s, o) => s + Number(o.budgetAmount ?? 0) * Number(o.probabilityPercent ?? 0) / 100, 0);
    note('pipeline / modules', `${expected} · ${JSON.stringify(parts)} / open budget ${fmt(opp.summary.totalBudget)}, weighted ${fmt(weighted)}, active reservations ${fmt(res.activeAmount)}`);
    expectShows(expected, shown(parts['Reservations in Hand']).value + shown(parts['Open Opportunities']).value, 'Expected = Reservations in Hand + Open Opportunities', shown(parts['Reservations in Hand'] ?? '').tol + shown(parts['Open Opportunities'] ?? '').tol);
    expectShows(parts['Open Opportunities'], opp.summary.totalBudget, 'Open Opportunities = Opportunities Pipeline Value');
    // Weighted Pipeline is only recorded: an opportunity listed as WON can still count as open, so Σ budget × probability is not a clean source
    expectShows(parts['Reservations in Hand'], res.activeAmount, 'Reservations in Hand = active reservation amount (Reservations module)');
  });

  test(...tc('EXD-030'), async ({ dash }) => { await narrativesQuoteTiles(dash, TAB); });

  test(...tc('EXD-031'), async ({ dash }) => {
    const gauge = (await dash.section('SALES TARGET'))[0];
    const t = await dash.table('SALES PERFORMANCE');
    note('gauge / achievement', `${gauge} / ${t.get('Sales Value', 'Achievement')}`);
    expect.soft(gauge, 'Gauge = Sales Value achievement').toBe(t.get('Sales Value', 'Achievement'));
  });
});
