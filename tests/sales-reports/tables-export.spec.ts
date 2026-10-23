/** Sales Reports workbook — KPI cards (SR-054…057), the three tables (SR-058…075) and Export (SR-076…081). */
import { test, expect, note } from '../pages/fixtures';
import { num, download } from '../helpers';
import * as check from '../modules/checks';
import {
  SalesReportsPage, SALES_FILTERS, STAGE_COLUMNS, SALESPERSON_COLUMNS, OPPORTUNITY_COLUMNS, parseDay,
} from '../pages/SalesReportsPage';
import { sr } from './catalog';
import { DASH, futureRange, today, filterToSalesperson } from './shared';

const MONEY = /^\d+(\.\d{1,2})?[KMB]? USD$|^\d{1,3}(,\d{3})*(\.\d{1,2})? USD$/;
const MONEY_KPIS = ['Pipeline value', 'Weighted pipeline', 'Won value'];
const MONEY_COLUMNS: [string, string[]][] = [
  ['Open Pipeline by Stage', ['Value (USD)', 'Weighted (USD)']],
  ['Salesperson Pipeline', ['Pipeline (USD)', 'Weighted (USD)', 'Won Value (USD)']],
  ['Open Opportunities', ['Value (USD)']],
];

/** Picks a salesperson option that has no rows at all (empty tables), or undefined. */
async function filterToNobody(sales: SalesReportsPage): Promise<string | undefined> {
  const listed = new Set((await sales.salespersonRows()).map(r => r['Salesperson']));
  const nobody = (await sales.options(sales.filterSelect(SALES_FILTERS.Salesperson))).slice(1).find(o => !listed.has(o.label));
  if (nobody) await sales.setFilterValue(SALES_FILTERS.Salesperson, nobody.value);
  return nobody?.label;
}

test.describe('Sales Reports · KPI cards', () => {
  test(...sr('SR-054'), async ({ sales }) => {
    await check.kpisValid(sales);
  });

  test(...sr('SR-055'), async ({ sales }) => {
    await sales.openWith('last_12_months');
    for (const k of MONEY_KPIS) expect.soft(await sales.kpiShown(k), k).toMatch(MONEY);
    for (const [heading, columns] of MONEY_COLUMNS) {
      for (const c of columns) {
        const bad = (await sales.table(heading).column(c)).map(s => s.trim()).filter(s => !MONEY.test(s));
        expect.soft(bad, `${heading} › ${c} formatted as "<n><K|M|B> USD"`).toEqual([]);
      }
    }
  });

  test(...sr('SR-056'), async ({ sales }) => {
    await sales.openWith('last_12_months');
    const rate = await sales.kpiShown('Win rate');
    note('Win rate', rate);
    if (!DASH.test(rate)) expect.soft(rate, 'Percentage with at most 1 decimal').toMatch(/^\d{1,3}(\.\d)?%$/);
    await sales.setCustomRange(...futureRange());
    expect.soft(await sales.kpiShown('Win rate'), 'No won or lost deals → "—"').toMatch(DASH);
  });

  test(...sr('SR-057'), async ({ sales }) => {
    await sales.openWith('last_12_months');
    const days = await sales.kpiShown('Average days to win');
    note('Average days to win', days);
    if (await sales.kpi('Won in period')) expect.soft(days, 'Whole days with "d"').toMatch(/^\d+ d$/);
    await sales.setCustomRange(...futureRange());
    expect.soft(await sales.kpiShown('Average days to win'), 'No won deals → "—"').toMatch(DASH);
  });
});

test.describe('Sales Reports · Open Pipeline by Stage', () => {
  test(...sr('SR-058'), async ({ sales }) => {
    await sales.open();
    expect(await sales.stageTable.headers()).toEqual(STAGE_COLUMNS);
  });

  test(...sr('SR-059'), async ({ sales }) => {
    await sales.open();
    const stages = (await sales.stageRows()).map(r => r['Stage']);
    note('stages', stages.join(' | '));
    expect.soft(stages.filter((s, i) => stages.indexOf(s) !== i), 'Each stage once').toEqual([]);
    expect.soft(stages.filter(s => /won|lost|closed|cancel/i.test(s)), 'No closed stage').toEqual([]);
    const zero = (await sales.stageRows()).filter(r => num(r['Opportunities']) === 0).map(r => r['Stage']);
    expect.soft(zero, 'No stage listed with 0 opportunities').toEqual([]);
  });

  test(...sr('SR-060'), async ({ sales }) => {
    await sales.open();
    const stages = (await sales.stageRows()).map(r => r['Stage']);
    const first = (await sales.opportunityRows())[0];
    test.skip(!first, 'No open opportunity to read the pipeline order from');
    await sales.openOpportunity(first['Opportunity']);
    const workflow = (await sales.readDetail()).workflow;
    const known = stages.filter(s => workflow.includes(s));
    note('order', `table: ${stages.join(' → ')} | workflow: ${workflow.join(' → ')}`);
    expect.soft(known, 'Stages follow the pipeline (workflow) order').toEqual([...known].sort((a, b) => workflow.indexOf(a) - workflow.indexOf(b)));
    expect.soft(stages.filter(s => !workflow.includes(s)), 'Stages not in the opportunity workflow (order undefined)').toEqual([]);
  });

  test(...sr('SR-061'), async ({ sales, page }) => {
    await sales.open();
    const total = await sales.totalRow('Open Pipeline by Stage');
    expect(total, 'Total row').not.toBeNull();
    note('Total row', JSON.stringify(total));
    expect.soft(total!['Stage'], 'First cell').toBe('Total');
    expect.soft(total!['Share of Value %'], 'Share').toBe('100%');
    const weight = await page.locator('xpath=' + `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Open Pipeline by Stage']]//tfoot/tr/td[1]`)
      .evaluate(td => Number(getComputedStyle(td).fontWeight));
    expect.soft(weight, 'Bold').toBeGreaterThanOrEqual(600);
    const lastBody = await sales.stageTable.root.locator('tbody tr').last().innerText();
    expect.soft(lastBody, 'Total is not inside the body rows').not.toMatch(/^Total/);
  });

  test(...sr('SR-062'), async ({ sales }) => {
    await sales.open();
    const zeroShares = (await sales.stageRows()).filter(r => num(r['Value (USD)']) > 0 && num(r['Share of Value %']) === 0)
      .map(r => `${r['Stage']} (${r['Value (USD)']} → ${r['Share of Value %']})`);
    expect(zeroShares, 'Stages with value shown as 0%').toEqual([]);
  });
});

test.describe('Sales Reports · Salesperson Pipeline', () => {
  test(...sr('SR-063'), async ({ sales }) => {
    await sales.open();
    expect(await sales.salespersonTable.headers()).toEqual(SALESPERSON_COLUMNS);
  });

  test(...sr('SR-064'), async ({ sales }) => {
    await sales.openWith('last_12_months');
    const rows = await sales.salespersonRows();
    expect.soft(rows.filter(r => num(r['Open']) === 0 && num(r['Won']) + num(r['Lost']) === 0).map(r => r['Salesperson']), 'No row without open, won or lost').toEqual([]);
    for (const r of rows.filter(x => num(x['Open']) === 0)) {
      note('won / lost only', JSON.stringify(r));
      expect.soft([num(r['Pipeline (USD)']), num(r['Weighted (USD)'])], `${r['Salesperson']}: Pipeline and Weighted 0`).toEqual([0, 0]);
    }
  });

  test(...sr('SR-065'), async ({ sales }) => {
    await sales.openWith('last_12_months');
    const rows = (await sales.salespersonRows()).filter(r => num(r['Won']) + num(r['Lost']) === 0);
    test.skip(!rows.length, 'Every salesperson has won or lost deals in the period');
    for (const r of rows) expect.soft(r['Win %'], `${r['Salesperson']}: Win %`).toMatch(DASH);
  });

  test(...sr('SR-066'), async ({ sales }) => {
    await sales.open();
    for (const period of ['last_12_months', 'this_month'] as const) {
      await sales.setPeriod(period);
      const rows = await sales.salespersonRows();
      const sorted = [...rows].sort((a, b) => num(b['Pipeline (USD)']) - num(a['Pipeline (USD)']) || a['Salesperson'].localeCompare(b['Salesperson']));
      note(period, rows.map(r => `${r['Salesperson']} ${r['Pipeline (USD)']}`).join(' | '));
      expect.soft(rows.map(r => r['Salesperson']), `${period}: sorted by Pipeline descending`).toEqual(sorted.map(r => r['Salesperson']));
    }
  });

  test(...sr('SR-067'), async ({ sales }) => {
    await sales.open();
    expect(await sales.totalRow('Salesperson Pipeline'), 'Salesperson Pipeline has a Total row').not.toBeNull();
  });
});

test.describe('Sales Reports · Open Opportunities', () => {
  test(...sr('SR-068'), async ({ sales }) => {
    await sales.open();
    expect(await sales.opportunitiesTable.headers()).toEqual(OPPORTUNITY_COLUMNS);
  });

  test(...sr('SR-069'), async ({ sales }) => {
    await sales.open();
    const dates = (await sales.opportunityRows()).map(r => r['Expected Close']);
    const firstBlank = dates.findIndex(d => !parseDay(d));
    if (firstBlank >= 0) expect.soft(dates.slice(firstBlank).filter(d => parseDay(d)), 'Rows without a date come last').toEqual([]);
    const days = dates.map(parseDay).filter((d): d is Date => !!d).map(d => d.getTime());
    const out = days.map((d, i) => (i && d < days[i - 1] ? `${dates[i - 1]} before ${dates[i]}` : '')).filter(Boolean);
    expect(out, 'Expected Close ascending').toEqual([]);
  });

  test(...sr('SR-070'), async ({ sales }) => {
    await sales.open();
    const rows = await sales.opportunityRows();
    const stages = (await sales.stageRows()).map(r => r['Stage']);
    const people = (await sales.salespersonRows()).map(r => r['Salesperson']);
    const bad: string[] = [];
    const refs = rows.map(r => r['Opportunity']);
    for (const r of rows) {
      const id = r['Opportunity'];
      if (!/^OPP-[A-Z0-9-]+$/.test(id)) bad.push(`reference "${id}"`);
      if (!r['Customer']) bad.push(`${id}: no customer`);
      if (!stages.includes(r['Stage'])) bad.push(`${id}: stage "${r['Stage']}" not in the stage table`);
      if (!people.includes(r['Salesperson'])) bad.push(`${id}: salesperson "${r['Salesperson']}" not in Salesperson Pipeline`);
      if (!(num(r['Value (USD)']) > 0)) bad.push(`${id}: value "${r['Value (USD)']}"`);
      const p = num(r['Probability %']);
      if (!(p >= 0 && p <= 100) || !/%$/.test(r['Probability %'])) bad.push(`${id}: probability "${r['Probability %']}"`);
      if (!parseDay(r['Expected Close']) && !DASH.test(r['Expected Close'])) bad.push(`${id}: date "${r['Expected Close']}"`);
    }
    expect.soft(refs.filter((x, i) => refs.indexOf(x) !== i), 'References unique').toEqual([]);
    expect(bad, 'Invalid rows').toEqual([]);
  });

  test(...sr('SR-071'), async ({ sales }) => {
    await sales.open();
    const closed = (await sales.opportunityRows()).filter(r => /won|lost|closed|cancel/i.test(r['Stage'])).map(r => `${r['Opportunity']} (${r['Stage']})`);
    expect(closed).toEqual([]);
  });

  test(...sr('SR-072'), async ({ sales }) => {
    await sales.open();
    const row = (await sales.opportunityRows())[0];
    test.skip(!row, 'No open opportunity');
    note('row', JSON.stringify(row));
    await sales.openOpportunity(row['Opportunity']);
    const d = await sales.readDetail();
    note('detail', JSON.stringify({ ...d, text: undefined }));
    for (const v of [row['Opportunity'], row['Customer'], row['Stage']]) expect.soft(d.text, `Detail shows "${v}"`).toContain(v);
    expect.soft(num(d.budget), `Budget ${d.budget} = ${row['Value (USD)']}`).toBeCloseTo(num(row['Value (USD)']), -3);
    expect.soft(d.probability, 'Probability').toBe(row['Probability %']);
    const close = parseDay(row['Expected Close']);
    if (close) {
      const shown = d.expectedClose.match(/^(\d{4})-(\d{2})-(\d{2})/);
      const day = shown ? new Date(+shown[1], +shown[2] - 1, +shown[3]) : parseDay(d.expectedClose);
      expect.soft(day?.getTime(), `Expected close "${d.expectedClose}" = ${row['Expected Close']}`).toBe(close.getTime());
      expect.soft(d.expectedClose, 'Expected close shown as a date, not a raw timestamp').not.toMatch(/T\d{2}:\d{2}/);
    }
  });

  test(...sr('SR-073'), async ({ sales }) => {
    await sales.open();
    const rows = await sales.opportunityRows();
    const looks = await sales.opportunitiesTable.root.locator('tbody tr').evaluateAll(trs => trs.map(tr => {
      const cs = getComputedStyle(tr);
      const cells = [...tr.children].map(td => { const c = getComputedStyle(td); return `${c.color}|${c.backgroundColor}|${c.fontWeight}`; }).join(';');
      return `${tr.className}|${cs.backgroundColor}|${cells}|${tr.querySelector('[class*=badge],[class*=warning],[class*=overdue]') ? 'flag' : ''}`;
    }));
    const past = rows.map((r, i) => ({ past: (parseDay(r['Expected Close'])?.getTime() ?? Infinity) < today().getTime(), look: looks[i] }));
    // ignore zebra striping: compare each overdue row with on-time rows of the same parity
    const unflagged = past.filter((p, i) => p.past && past.some((q, j) => !q.past && j % 2 === i % 2 && q.look === p.look));
    test.skip(!past.some(p => p.past) || past.every(p => p.past), 'Needs both overdue and on-time rows');
    expect(unflagged.length, 'Overdue rows that look like on-time rows').toBe(0);
  });

  test(...sr('SR-074'), async ({ sales, page }) => {
    await sales.open();
    const rows = (await sales.opportunityRows()).length;
    const open = await sales.kpi('Open opportunities');
    const capNote = await page.locator('main').getByText(/showing (the )?first \d+/i).count();
    note('rows', `${rows} rows, Open opportunities ${open}, cap message ${capNote ? 'shown' : 'none'}`);
    if (rows < open) expect.soft(capNote, 'A cap message is shown when rows are cut').toBeGreaterThan(0);
    else expect.soft(rows, 'Every open opportunity is listed').toBe(open);
    const sheet = await sales.opportunitiesTable.export();
    expect.soft(sheet.rows.length, 'Export has every open opportunity').toBe(open);
  });

  test(...sr('SR-075'), async ({ sales }) => {
    await sales.openWith('last_12_months');
    const who = await filterToNobody(sales);
    test.skip(!who, 'Every salesperson option has data');
    note('salesperson', who!);
    await expect(sales.emptyMessage('Open Opportunities'), 'Empty-state message').toBeVisible();
    await expect.soft(sales.opportunitiesTable.exportButton, 'Export still shown').toBeVisible();
  });
});

test.describe('Sales Reports · Export', () => {
  for (const [id, heading] of [['SR-076', 'Open Pipeline by Stage'], ['SR-077', 'Salesperson Pipeline'], ['SR-078', 'Open Opportunities']] as const) {
    test(...sr(id), async ({ sales }) => {
      await sales.openWith('last_12_months');
      const table = sales.table(heading);
      const [headers, rows] = [await table.headers(), (await sales.rowsOf(heading)).length];
      const sheet = await table.export();
      note('file', `${sheet.name}: ${sheet.rows.length} rows${sheet.total ? ' + Total' : ''}`);
      expect.soft(sheet.name, 'An .xlsx file').toMatch(/\.xlsx$/i);
      expect.soft(sheet.header, 'Columns = table headers').toEqual(headers);
      if (heading === 'Open Opportunities') expect.soft(sheet.rows.length, 'Rows ≥ table rows').toBeGreaterThanOrEqual(rows);
      else expect.soft(sheet.rows.length, 'Rows = table rows').toBe(rows);
      if (heading === 'Open Pipeline by Stage') expect.soft(sheet.total, 'Includes the Total row').toBeTruthy();
    });
  }

  test(...sr('SR-079'), async ({ sales }) => {
    await sales.openWith('last_12_months');
    const row = (await sales.salespersonRows()).filter(r => num(r['Open']) > 0).slice(-1)[0];
    test.skip(!row, 'No salesperson has open opportunities');
    await filterToSalesperson(sales, row);
    const name = row['Salesperson'];
    const opps = await sales.opportunitiesTable.export();
    expect.soft(opps.rows.length, `Open Opportunities export has ${name}'s ${row['Open']} rows`).toBe(num(row['Open']));
    expect.soft(opps.rows.filter(r => r['Salesperson'] !== name).length, `Only ${name}`).toBe(0);
    const people = await sales.salespersonTable.export();
    expect.soft(people.rows.map(r => String(r['Salesperson'])), 'Salesperson export').toEqual([name]);
  });

  test(...sr('SR-080'), async ({ sales, page }) => {
    await sales.openWith('last_12_months');
    const who = await filterToNobody(sales);
    test.skip(!who, 'Every salesperson option has data');
    const button = sales.opportunitiesTable.exportButton;
    if (await button.isDisabled()) return note('Export', 'disabled for an empty table');
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    const sheet = await download(page, button, 15_000).catch(() => null);
    note('Export', sheet ? `downloaded ${sheet.name} (${sheet.rows.length} rows)` : 'no file');
    if (sheet) expect.soft(sheet.rows.length, 'Headers only').toBe(0);
    await expect.soft(page.locator('main').getByText(/error|failed|went wrong/i), 'No error shown').toHaveCount(0);
    expect.soft(errors, 'No JavaScript error').toEqual([]);
  });

  test(...sr('SR-081'), async ({ sales }) => {
    await sales.openWith('last_12_months');
    const names: string[] = [];
    for (const t of sales.tableHeadings) names.push((await sales.table(t).export()).name);
    note('files', names.join(' | '));
    const d = new Date();
    const date = new RegExp(`${d.getFullYear()}[-_]?${String(d.getMonth() + 1).padStart(2, '0')}[-_]?${String(d.getDate()).padStart(2, '0')}`);
    for (const [i, n] of names.entries()) {
      const words = sales.tableHeadings[i].toLowerCase().split(' ').filter(w => w.length > 3);
      expect.soft(words.some(w => n.toLowerCase().includes(w)) || /sales/i.test(n), `"${n}" names the panel or report`).toBeTruthy();
      expect.soft(n, `"${n}" contains today's date`).toMatch(date);
    }
    expect.soft(new Set(names).size, 'Three different file names').toBe(3);
  });
});

