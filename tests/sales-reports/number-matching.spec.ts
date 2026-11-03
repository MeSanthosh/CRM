/**
 * Sales Reports workbook — Number matching (SR-082…109). Every expected figure is derived from the page itself
 * (another KPI, a column, the export, another period or filter); no figure is hard-coded.
 * Shown amounts are rounded ("1.65B USD"), so amount checks allow each value's display rounding (≥ 0.5%).
 */
import { test, expect, note } from '../pages/fixtures';
import { num, sum } from '../helpers';
import { SalesReportsPage, SALES_FILTERS, parseDay, Row } from '../pages/SalesReportsPage';
import { sr, srSkipped } from './catalog';
import {
  expectSum, expectSame, expectRate, cell, countBy, today, previousMonth, thisMonthToDate, lastQuarterMonths,
  filterToSalesperson, eachOption,
} from './shared';
import { Period } from '../pages/ReportModulePage';

const col = (rows: Row[], name: string) => rows.map(r => r[name]);
const totalLost = (rows: Row[]) => sum(SalesReportsPage.col(rows, 'Lost'));

/** Opens Last 12 months with all filters and view All, and reads KPIs + tables once. */
async function load(sales: SalesReportsPage) {
  await sales.openWith('last_12_months');
  const kpis: Record<string, string> = {};
  for (const k of sales.kpiLabels) kpis[k] = await sales.kpiShown(k);
  return {
    kpis, stage: await sales.stageRows(), total: await sales.totalRow('Open Pipeline by Stage'),
    people: await sales.salespersonRows(), opps: await sales.opportunityRows(),
  };
}

/** Won, Won value and Lost for the current period. */
async function wonFigures(sales: SalesReportsPage) {
  return { won: num(await sales.kpiShown('Won in period')), wonValue: num(await sales.kpiShown('Won value')), lost: totalLost(await sales.salespersonRows()) };
}

test.describe('Sales Reports · Number matching', () => {
  test(...sr('SR-082'), async ({ sales }) => {
    const d = await load(sales);
    expect(d.total, 'Stage table has a Total row').not.toBeNull();
    expect(num(d.total!['Opportunities']), `Open opportunities ${d.kpis['Open opportunities']} = Total`).toBe(num(d.kpis['Open opportunities']));
  });

  test(...sr('SR-083'), async ({ sales }) => {
    const d = await load(sales);
    note('Open', col(d.people, 'Open').join(' + '));
    expect(sum(SalesReportsPage.col(d.people, 'Open'))).toBe(num(d.kpis['Open opportunities']));
  });

  test(...sr('SR-084'), async ({ sales }) => {
    const d = await load(sales);
    expect(d.opps.length, 'List rows = Open opportunities').toBe(num(d.kpis['Open opportunities']));
  });

  test(...sr('SR-085'), async ({ sales }) => {
    const d = await load(sales);
    const sheet = await sales.opportunitiesTable.export();
    const byStage = countBy(sheet.rows, 'Stage');
    note('export per stage', JSON.stringify(byStage));
    for (const r of d.stage) expect.soft(byStage[r['Stage']] ?? 0, `${r['Stage']}: rows in the list`).toBe(num(r['Opportunities']));
    expect.soft(Object.keys(byStage).filter(s => !d.stage.some(r => r['Stage'] === s)), 'Stages in the list missing from the stage table').toEqual([]);
  });

  test(...sr('SR-086'), async ({ sales }) => {
    const d = await load(sales);
    const sheet = await sales.opportunitiesTable.export();
    const byPerson = countBy(sheet.rows, 'Salesperson');
    note('export per salesperson', JSON.stringify(byPerson));
    // names can repeat: compare the totals per name
    const tableByName: Record<string, number> = {};
    for (const r of d.people) tableByName[r['Salesperson']] = (tableByName[r['Salesperson']] ?? 0) + num(r['Open']);
    for (const [name, open] of Object.entries(tableByName)) expect.soft(byPerson[name] ?? 0, `${name}: rows in the list`).toBe(open);
    expect.soft(Object.keys(byPerson).filter(n => !(n in tableByName)), 'Salespeople in the list missing from the table').toEqual([]);
  });

  test(...sr('SR-087'), async ({ sales }) => {
    const d = await load(sales);
    expectSame(d.kpis['Pipeline value'], d.total!['Value (USD)'], 'Pipeline value = Total row');
    expectSum(d.kpis['Pipeline value'], col(d.stage, 'Value (USD)'), 'Pipeline value = Σ stage values');
    expectSum(d.total!['Value (USD)'], col(d.stage, 'Value (USD)'), 'Total row = Σ stage values');
  });

  test(...sr('SR-088'), async ({ sales }) => {
    const d = await load(sales);
    expectSum(d.kpis['Pipeline value'], col(d.people, 'Pipeline (USD)'), 'Pipeline value = Σ Salesperson Pipeline');
  });

  test(...sr('SR-089'), async ({ sales }) => {
    const d = await load(sales);
    const sheet = await sales.opportunitiesTable.export();
    const values = sheet.rows.map(r => cell(r['Value (USD)']));
    note('export', `${sheet.rows.length} rows, Σ Value ${sum(values).toLocaleString('en')}`);
    expectSame(d.kpis['Pipeline value'], sum(values), 'Pipeline value = Σ list Value');
    for (const r of d.stage) expectSame(r['Value (USD)'], sum(sheet.rows.filter(x => x['Stage'] === r['Stage']).map(x => cell(x['Value (USD)']))), `${r['Stage']}: Value = Σ its rows`);
  });

  test(...sr('SR-090'), async ({ sales }) => {
    const d = await load(sales);
    expectSame(d.kpis['Weighted pipeline'], d.total!['Weighted (USD)'], 'Weighted pipeline = Total row');
    expectSum(d.kpis['Weighted pipeline'], col(d.stage, 'Weighted (USD)'), 'Weighted pipeline = Σ stage weighted');
  });

  test(...sr('SR-091'), async ({ sales }) => {
    const d = await load(sales);
    expectSum(d.kpis['Weighted pipeline'], col(d.people, 'Weighted (USD)'), 'Weighted pipeline = Σ Salesperson Weighted');
  });

  test(...sr('SR-092'), async ({ sales }) => {
    const d = await load(sales);
    const sheet = await sales.opportunitiesTable.export();
    const w = (rows: Record<string, unknown>[]) => sum(rows.map(r => (cell(r['Value (USD)']) * cell(r['Probability %'])) / 100));
    note('Σ Value × Probability', w(sheet.rows).toLocaleString('en'));
    expectSame(d.kpis['Weighted pipeline'], w(sheet.rows), 'Weighted pipeline = Σ Value × Probability');
    for (const r of d.stage) expectSame(r['Weighted (USD)'], w(sheet.rows.filter(x => x['Stage'] === r['Stage'])), `${r['Stage']}: Weighted`);
    const names = [...new Set(d.people.map(r => r['Salesperson']))].filter(n => d.people.filter(r => r['Salesperson'] === n).length === 1);
    for (const n of names) expectSame(d.people.find(r => r['Salesperson'] === n)!['Weighted (USD)'], w(sheet.rows.filter(x => x['Salesperson'] === n)), `${n}: Weighted`);
  });

  test(...sr('SR-093'), async ({ sales }) => {
    const d = await load(sales);
    const over: string[] = [];
    const le = (w: string, v: string, what: string) => { if (num(w) > num(v) * 1.005) over.push(`${what}: ${w} > ${v}`); };
    le(d.kpis['Weighted pipeline'], d.kpis['Pipeline value'], 'KPI');
    for (const r of d.stage) le(r['Weighted (USD)'], r['Value (USD)'], r['Stage']);
    for (const r of d.people) le(r['Weighted (USD)'], r['Pipeline (USD)'], r['Salesperson']);
    expect(over, 'Weighted above Pipeline').toEqual([]);
  });

  test(...sr('SR-094'), async ({ sales }) => {
    const d = await load(sales);
    const values = SalesReportsPage.col(d.stage, 'Value (USD)');
    const whole = sum(values);
    for (const [i, r] of d.stage.entries()) {
      // the shown Value is rounded, so the share can differ by that rounding too
      const tol = 0.05 + (100 * 0.005 * (r['Value (USD)'].includes('B') ? 1e9 : 1e6)) / whole;
      expect.soft(Math.abs(num(r['Share of Value %']) - (values[i] / whole) * 100), `${r['Stage']}: ${r['Share of Value %']} vs ${((values[i] / whole) * 100).toFixed(2)}%`).toBeLessThanOrEqual(tol);
    }
    expect.soft(Math.abs(sum(SalesReportsPage.col(d.stage, 'Share of Value %')) - 100), 'Shares add up to 100%').toBeLessThanOrEqual(0.15);
  });

  test(...sr('SR-095'), async ({ sales }) => {
    const d = await load(sales);
    expect(d.total, 'Total row').not.toBeNull();
    expect.soft(num(d.total!['Opportunities']), 'Total Opportunities = Σ').toBe(sum(SalesReportsPage.col(d.stage, 'Opportunities')));
    expectSum(d.total!['Value (USD)'], col(d.stage, 'Value (USD)'), 'Total Value = Σ');
    expectSum(d.total!['Weighted (USD)'], col(d.stage, 'Weighted (USD)'), 'Total Weighted = Σ');
  });

  test(...sr('SR-096'), async ({ sales }) => {
    const d = await load(sales);
    note('Won', col(d.people, 'Won').join(' + '));
    expect(sum(SalesReportsPage.col(d.people, 'Won'))).toBe(num(d.kpis['Won in period']));
  });

  test(...sr('SR-097'), async ({ sales }) => {
    const d = await load(sales);
    expectSum(d.kpis['Won value'], col(d.people, 'Won Value (USD)'), 'Won value = Σ Salesperson Won Value');
  });

  test(...sr('SR-098'), async ({ sales }) => {
    const d = await load(sales);
    const won = sum(SalesReportsPage.col(d.people, 'Won'));
    const lost = totalLost(d.people);
    note('rate', `${won} ÷ (${won} + ${lost}) vs ${d.kpis['Win rate']}`);
    expectRate(d.kpis['Win rate'], won, won + lost, 'Win rate');
  });

  test(...sr('SR-099'), async ({ sales }) => {
    const d = await load(sales);
    for (const r of d.people) expectRate(r['Win %'], num(r['Won']), num(r['Won']) + num(r['Lost']), r['Salesperson']);
  });

  test(...sr('SR-100'), async ({ sales }) => {
    const d = await load(sales);
    const sheet = await sales.opportunitiesTable.export();
    const dates = d.opps.length >= sheet.rows.length ? d.opps.map(r => r['Expected Close']) : sheet.rows.map(r => String(r['Expected Close'] ?? ''));
    const toDay = (s: string) => parseDay(s) ?? (/^\d{4}-\d{2}-\d{2}/.test(s) ? new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) : null);
    const past = dates.filter(s => (toDay(s)?.getTime() ?? Infinity) < today().getTime()).length;
    note('past', `${past} of ${dates.length} rows before ${today().toDateString()}`);
    expect.soft(past, 'Rows before today = Past expected close').toBe(num(d.kpis['Past expected close']));
    expect.soft(num(d.kpis['Past expected close']), 'Past expected close ≤ Open opportunities').toBeLessThanOrEqual(num(d.kpis['Open opportunities']));
  });

  test(...srSkipped('SR-101', 'Needs created and won dates of each won deal (Opportunities page or the database); not shown on Sales Reports'));

  test(...sr('SR-102'), async ({ sales }) => {
    await sales.open();
    const f: Record<string, Awaited<ReturnType<typeof wonFigures>>> = {};
    for (const p of ['this_month', 'last_month', 'this_quarter', 'last_quarter', 'ytd', 'last_12_months'] as Period[]) {
      await sales.setPeriod(p);
      f[p] = await wonFigures(sales);
    }
    note('won / value / lost', JSON.stringify(f));
    const chains = [['this_month', 'this_quarter', 'ytd', 'last_12_months'], ['last_month', 'last_quarter']];
    // Last quarter is inside Year to date unless it was in the previous year (January–March)
    if (today().getMonth() >= 3) chains[1].push('ytd');
    for (const chain of chains) for (let i = 1; i < chain.length; i++) {
      const [a, b] = [f[chain[i - 1]], f[chain[i]]];
      expect.soft(a.won, `Won: ${chain[i - 1]} ≤ ${chain[i]}`).toBeLessThanOrEqual(b.won);
      expect.soft(a.lost, `Lost: ${chain[i - 1]} ≤ ${chain[i]}`).toBeLessThanOrEqual(b.lost);
      expect.soft(a.wonValue, `Won value: ${chain[i - 1]} ≤ ${chain[i]}`).toBeLessThanOrEqual(b.wonValue * 1.005);
    }
  });

  test(...sr('SR-103'), async ({ sales }) => {
    const months = lastQuarterMonths();
    const cases: [Period, [string, string]][] = [['this_month', thisMonthToDate()], ['last_month', previousMonth()], ['last_quarter', [months[0][0], months[2][1]]]];
    await sales.open();
    for (const [preset, [from, to]] of cases) {
      await sales.setPeriod(preset);
      const a: string[] = [];
      for (const k of ['Won in period', 'Won value', 'Win rate', 'Average days to win']) a.push(await sales.kpiShown(k));
      await sales.setCustomRange(from, to);
      const b: string[] = [];
      for (const k of ['Won in period', 'Won value', 'Win rate', 'Average days to win']) b.push(await sales.kpiShown(k));
      note(preset, `${a.join(', ')} | custom ${from} → ${to}: ${b.join(', ')}`);
      expect.soft(b, `Custom ${from} → ${to} = ${preset}`).toEqual(a);
    }
  });

  test(...sr('SR-104'), async ({ sales }) => {
    await sales.open();
    const parts = [];
    for (const [from, to] of lastQuarterMonths()) {
      await sales.setCustomRange(from, to);
      parts.push({ ...(await wonFigures(sales)), value: await sales.kpiShown('Won value') });
    }
    await sales.setPeriod('last_quarter');
    const q = { ...(await wonFigures(sales)), value: await sales.kpiShown('Won value') };
    note('months → quarter', `${JSON.stringify(parts)} → ${JSON.stringify(q)}`);
    expect.soft(sum(parts.map(p => p.won)), 'Won: months add up to the quarter').toBe(q.won);
    expect.soft(sum(parts.map(p => p.lost)), 'Lost: months add up to the quarter').toBe(q.lost);
    expectSum(q.value, parts.map(p => p.value), 'Won value: months add up to the quarter');
  });

  test(...sr('SR-105'), async ({ sales }) => {
    const d = await load(sales);
    const row = d.people.filter(r => num(r['Open']) > 0).slice(-1)[0];
    test.skip(!row, 'No salesperson has open opportunities');
    expect(await filterToSalesperson(sales, row), `Option for ${row['Salesperson']}`).toBeTruthy();
    note('row', JSON.stringify(row));
    expect.soft(await sales.kpiShown('Open opportunities'), 'Open opportunities = row Open').toBe(row['Open']);
    expect.soft(await sales.kpiShown('Pipeline value'), 'Pipeline value = row').toBe(row['Pipeline (USD)']);
    expect.soft(await sales.kpiShown('Weighted pipeline'), 'Weighted pipeline = row').toBe(row['Weighted (USD)']);
    expect.soft(await sales.kpiShown('Won in period'), 'Won in period = row').toBe(row['Won']);
    expect.soft(await sales.kpiShown('Won value'), 'Won value = row').toBe(row['Won Value (USD)']);
    expect.soft(await sales.kpiShown('Win rate'), 'Win rate = row').toBe(row['Win %']);
    const total = await sales.totalRow('Open Pipeline by Stage');
    expect.soft(total?.['Opportunities'], 'Stage Total = row Open').toBe(row['Open']);
  });

  test(...sr('SR-106'), async ({ sales }) => {
    const d = await load(sales);
    const read = async () => ({ open: num(await sales.kpiShown('Open opportunities')), pipeline: num(await sales.kpiShown('Pipeline value')), won: num(await sales.kpiShown('Won in period')) });
    const per = await eachOption(sales, SALES_FILTERS.Project, read);
    const s = { open: sum(per.map(p => p.value.open)), pipeline: sum(per.map(p => p.value.pipeline)), won: sum(per.map(p => p.value.won)) };
    note('per project', JSON.stringify(per));
    const all = { open: num(d.kpis['Open opportunities']), pipeline: num(d.kpis['Pipeline value']), won: num(d.kpis['Won in period']) };
    expect.soft(s.open, 'Σ projects ≤ total (no opportunity in two projects)').toBeLessThanOrEqual(all.open);
    expect.soft(s.open, `Open opportunities: Σ projects = total (gap = ${all.open - s.open} without a project)`).toBe(all.open);
    expect.soft(s.won, `Won in period: Σ projects = total (gap = ${all.won - s.won})`).toBe(all.won);
    expectSame(d.kpis['Pipeline value'], s.pipeline, 'Pipeline value: Σ projects = total');
  });

  test(...sr('SR-107'), async ({ sales }) => {
    const d = await load(sales);
    const total = num(d.kpis['Open opportunities']);
    for (const name of ['Broker', 'Campaign']) {
      const per = await eachOption(sales, SALES_FILTERS[name], async () => num(await sales.kpiShown('Open opportunities')));
      const s = sum(per.map(p => p.value));
      note(name, `${per.map(p => `${p.label}: ${p.value}`).join(' | ')} → Σ ${s} of ${total}`);
      expect.soft(s, `${name}s: Σ Open opportunities ≤ total`).toBeLessThanOrEqual(total);
    }
  });

  test(...sr('SR-108'), async ({ sales }) => {
    const d = await load(sales);
    const me = await sales.userName();
    const mine = d.people.filter(r => r['Salesperson'] === me);
    test.skip(mine.length !== 1, `"${me}" is not exactly one row of Salesperson Pipeline`);
    const row = mine[0];
    await sales.setView('Mine');
    note('row', JSON.stringify(row));
    expect.soft(await sales.kpiShown('Open opportunities'), 'Open opportunities').toBe(row['Open']);
    expect.soft(await sales.kpiShown('Pipeline value'), 'Pipeline value').toBe(row['Pipeline (USD)']);
    expect.soft(await sales.kpiShown('Weighted pipeline'), 'Weighted pipeline').toBe(row['Weighted (USD)']);
    expect.soft(await sales.kpiShown('Won in period'), 'Won in period').toBe(row['Won']);
    expect.soft(await sales.kpiShown('Won value'), 'Won value').toBe(row['Won Value (USD)']);
    expect.soft(await sales.kpiShown('Win rate'), 'Win rate').toBe(row['Win %']);
  });

  test(...sr('SR-109'), async ({ sales }) => {
    const d = await load(sales);
    const stage = await sales.stageTable.export();
    const people = await sales.salespersonTable.export();
    const opps = await sales.opportunitiesTable.export();
    const text = [...stage.rows, ...people.rows, ...opps.rows].flatMap(r => Object.entries(r))
      .filter(([k, v]) => /USD|Opportunities|Open|Won|Lost/.test(k) && typeof v === 'string' && /\d\s*[KMB]?\s*USD|^\d/.test(v)).map(([k, v]) => `${k}=${v}`);
    expect.soft(text.slice(0, 5), 'Exported numbers are plain numbers, not display text').toEqual([]);
    const total = (sheet: typeof stage, c: string) => sum(sheet.rows.map(r => cell(r[c])));
    expect.soft(total(stage, 'Opportunities'), 'Stage export: Σ Opportunities').toBe(num(d.kpis['Open opportunities']));
    expectSame(d.kpis['Pipeline value'], total(stage, 'Value (USD)'), 'Stage export: Σ Value');
    expectSame(d.kpis['Weighted pipeline'], total(stage, 'Weighted (USD)'), 'Stage export: Σ Weighted');
    if (stage.total) expect.soft(cell(stage.total['Opportunities']), 'Stage export Total row').toBe(num(d.kpis['Open opportunities']));
    expect.soft(total(people, 'Won'), 'Salesperson export: Σ Won').toBe(num(d.kpis['Won in period']));
    expectSame(d.kpis['Won value'], total(people, 'Won Value (USD)'), 'Salesperson export: Σ Won Value');
    expectSame(d.kpis['Pipeline value'], total(opps, 'Value (USD)'), 'Open Opportunities export: Σ Value');
  });
});
