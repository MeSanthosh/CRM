/** Lead Reports workbook — Source & Channel (LR-080…102). Totals and percentages are checked against the page's own figures. */
import { test, expect, note } from '../pages/fixtures';
import { num, expectNear, sum } from '../helpers';
import { GROUPINGS, BREAKDOWN_COLUMNS, BREAKDOWN_LINK_COLUMNS, LeadReportsPage } from '../pages/LeadReportsPage';
import { lr } from './catalog';
import { expectRate, rowWithData, labelOf } from './shared';

const COUNT_COLUMNS = ['Leads', 'Contacted', 'Qualified', 'Opportunity', 'Reserved', 'SPA Signed', 'Lost'];

/** Overview figures the Total row must repeat. */
async function overviewTotals(lead: LeadReportsPage) {
  await lead.openWith('last_12_months');
  const funnel = Object.fromEntries((await lead.funnel()).map(s => [s.label, s.count]));
  return {
    Leads: await lead.kpi('Leads Captured'), Contacted: funnel['Contacted'], Qualified: funnel['Qualified'], Opportunity: funnel['Opportunity'],
    Reserved: funnel['Reserved'], 'SPA Signed': await lead.kpi('SPA Signed'), 'Won Value': await lead.kpi('Won Value'),
    'Contact %': await lead.kpi('Contact Rate'), 'Qual. %': await lead.kpi('Qualification Rate'), 'Conv. %': await lead.kpi('Opportunity Conversion'),
  };
}

async function expectTotalsMatch(lead: LeadReportsPage, o: Awaited<ReturnType<typeof overviewTotals>>, where: string) {
  const t = await lead.breakdown.total();
  expect(t, `${where}: Total row`).toBeTruthy();
  for (const k of ['Leads', 'Contacted', 'Qualified', 'Opportunity', 'Reserved', 'SPA Signed'] as const) expect.soft(num(t![k]), `${where} Total ${k}`).toBe(o[k]);
  for (const k of ['Contact %', 'Qual. %', 'Conv. %'] as const) expectNear(num(t![k]), o[k], `${where} Total ${k}`, 0, 0.1);
  expectNear(num(t!['Won Value']), o['Won Value'], `${where} Total Won Value`, 0.005, 0);
}

test.describe('Lead Reports · Source & Channel', () => {
  test(...lr('LR-080'), async ({ leadReports }) => {
    await leadReports.openAt('source');
    expect(await leadReports.subTabs()).toEqual(GROUPINGS.map(g => g.name));
    await expect(leadReports.subTab('Lead Source')).toHaveClass(/is-active/);
    expect(await leadReports.breakdown.title()).toBe('Performance by Lead Source');
  });

  // LR-081 … LR-087: every grouping except Lead Source
  GROUPINGS.slice(1).forEach((g, i) => {
    test(...lr(`LR-0${81 + i}`), async ({ leadReports, page }) => {
      const o = await overviewTotals(leadReports);
      await leadReports.openTab('Source & Channel');
      const req = page.waitForRequest(r => r.url().includes('/reports/leads/breakdown') && r.url().includes(`dimension=${g.dimension}`), { timeout: 30_000 });
      await leadReports.groupBy(g.name);
      await req;
      expect(await leadReports.breakdown.title()).toBe(`Performance by ${g.name}`);
      expect.soft((await leadReports.breakdown.headers())[0], 'First column').toBe(g.name);
      expect.soft((await leadReports.breakdown.rows()).length, 'Rows').toBeGreaterThan(0);
      await expectTotalsMatch(leadReports, o, g.name);
    });
  });

  test(...lr('LR-088'), async ({ leadReports }) => {
    const o = await overviewTotals(leadReports);
    await leadReports.openTab('Source & Channel');
    expect.soft(await leadReports.breakdown.headers(), 'Columns').toEqual(['Lead Source', ...BREAKDOWN_COLUMNS]);
    await expectTotalsMatch(leadReports, o, 'Lead Source');
  });

  test(...lr('LR-089'), async ({ leadReports }) => {
    test.setTimeout(180_000);
    await leadReports.openAt('source', 'last_12_months');
    for (const g of GROUPINGS) {
      await leadReports.groupBy(g.name);
      const rows = await leadReports.breakdown.rows();
      const total = (await leadReports.breakdown.total())!;
      for (const c of COUNT_COLUMNS) expect.soft(sum(rows.map(r => num(r[c]))), `${g.name}: ${c} rows = Total`).toBe(num(total[c]));
      expectNear(sum(rows.map(r => num(r['Won Value']))), num(total['Won Value']), `${g.name}: Won Value rows vs Total`);
    }
  });

  test(...lr('LR-090'), async ({ leadReports }) => {
    test.setTimeout(180_000);
    await leadReports.openAt('source', 'last_12_months');
    for (const g of GROUPINGS) {
      await leadReports.groupBy(g.name);
      for (const r of [...await leadReports.breakdown.rows(), (await leadReports.breakdown.total())!]) {
        const leads = num(r['Leads']);
        const label = `${g.name} › ${labelOf(r)}`;
        if (!leads) continue;
        expectRate(num(r['Contact %']), num(r['Contacted']), leads, `${label} Contact %`);
        expectRate(num(r['Qual. %']), num(r['Qualified']), leads, `${label} Qual. %`);
        expectRate(num(r['Conv. %']), num(r['Opportunity']), leads, `${label} Conv. %`);
        expectRate(num(r['Win %']), num(r['SPA Signed']), leads, `${label} Win %`);
      }
    }
  });

  test(...lr('LR-091'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const source = (await leadReports.dataCompleteness()).find(r => r.label === 'Lead source recorded')!;
    await leadReports.openTab('Source & Channel');
    const unspecified = (await leadReports.breakdown.rows()).find(r => labelOf(r) === 'Unspecified');
    const missing = source.total - source.filled;
    note('values', `Lead source recorded ${source.filled}/${source.total} | Unspecified row ${unspecified?.['Leads'] ?? 'none'}`);
    if (missing > 0) expect(num(unspecified?.['Leads'] ?? '0'), 'Unspecified = leads without a lead source').toBe(missing);
    else expect(unspecified, 'No Unspecified row when every lead has a source').toBeUndefined();
  });

  // LR-092 … LR-098: each count column opens its leads (first row with data, preferring a named row)
  BREAKDOWN_LINK_COLUMNS.forEach((col, i) => {
    test(...lr(`LR-0${92 + i}`), async ({ leadReports }) => {
      await leadReports.openAt('source', 'last_12_months');
      const headers = await leadReports.breakdown.headers();
      const row = rowWithData(await leadReports.breakdown.rows(), col);
      test.skip(!row, `No "${col}" count above 0`);
      const { drill } = await leadReports.drill.verify(leadReports.breakdown.link(row!, col, headers), { rowLabel: labelOf(row!) });
      expect.soft(drill.title, 'Title names the column and the row').toContain(`Lead Source: ${labelOf(row!)}`);
    });
  });

  test(...lr('LR-099'), async ({ leadReports }) => {
    await leadReports.openAt('source', 'last_12_months');
    const bad: string[] = [];
    for (const r of await leadReports.breakdown.rows()) {
      for (const c of ['Avg First Contact', 'Cost / Lead', 'Won Value', 'Contact %', 'Qual. %', 'Conv. %', 'Win %']) {
        if (/^\s*$|NaN|undefined|Infinity/.test(r[c])) bad.push(`${labelOf(r)} › ${c} = "${r[c]}"`);
      }
    }
    expect(bad, 'Blank or broken cells (missing values must show "—")').toEqual([]);
  });

  test(...lr('LR-100'), async ({ leadReports }) => {
    await leadReports.openAt('source', 'last_12_months');
    const rows = await leadReports.breakdown.rows();
    const sheet = await leadReports.breakdown.export();
    note('export', `${sheet.name}: ${sheet.rows.length} rows; columns ${sheet.header.join(' | ')}`);
    expect.soft(sheet.name, 'File name').toMatch(/^lead-report-breakdown-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect.soft(sheet.rows.length, 'One row per table row').toBe(rows.length);
    const byLabel = Object.fromEntries(sheet.rows.map(r => [String(r[sheet.header[0]]), r]));
    for (const r of rows) {
      const x = byLabel[labelOf(r)];
      expect.soft(x, `"${labelOf(r)}" in the export`).toBeTruthy();
      if (x) for (const c of COUNT_COLUMNS) expect.soft(Number(x[c]), `${labelOf(r)} › ${c}`).toBe(num(r[c]));
    }
  });

  test(...lr('LR-101'), async ({ leadReports }) => {
    await leadReports.openAt('source', 'last_12_months');
    await leadReports.groupBy('Capture Channel');
    const rows = await leadReports.breakdown.rows();
    const sheet = await leadReports.breakdown.export();
    expect.soft(sheet.header[0], 'Grouped by Capture Channel').toBe('Capture Channel');
    expect.soft(sheet.rows.map(r => String(r['Capture Channel'])).sort(), 'Same rows as the table').toEqual(rows.map(labelOf).sort());
  });

  test(...lr('LR-102'), async ({ leadReports }) => {
    await leadReports.openAt('source', 'last_12_months');
    const before = (await leadReports.breakdown.rows()).map(labelOf);
    await leadReports.breakdown.table.locator('thead th').nth(1).click();
    await leadReports.page.waitForTimeout(500);
    expect((await leadReports.breakdown.rows()).map(labelOf), 'Row order after clicking "Leads"').toEqual(before);
  });
});
