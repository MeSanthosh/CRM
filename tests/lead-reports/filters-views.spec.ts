/** Lead Reports workbook — Filters (LR-016…035) and Views (LR-036…041). */
import { test, expect, note } from '../pages/fixtures';
import { num } from '../helpers';
import { PERIODS } from '../pages/ReportModulePage';
import { LeadReportsPage, LEAD_FILTERS } from '../pages/LeadReportsPage';
import { lr } from './catalog';
import { lrSkipped, previousMonth, futureRange, rowWithData, labelOf } from './shared';

const BAD = /^\s*$|NaN|undefined|Infinity/;

/** Picks a value of `grouping` that has leads (from Source & Channel), applies it as a header filter, returns both. */
async function applyGroupFilter(lead: LeadReportsPage, grouping: string) {
  const allOption = LEAD_FILTERS[grouping];
  await lead.openWith('last_12_months');
  const all = await lead.kpi('Leads Captured');
  await lead.openTab('Source & Channel');
  await lead.groupBy(grouping);
  const options = await lead.filterOptions(allOption);
  const rows = (await lead.breakdown.rows()).filter(r => options.includes(labelOf(r)));
  const row = rowWithData(rows, 'Leads');
  const value = row ? labelOf(row) : options[0];
  await lead.setFilter(allOption, value);
  await lead.openTab('Overview & Funnel');
  return { all, value, expectedLeads: row ? num(row['Leads']) : undefined, filtered: await lead.kpi('Leads Captured') };
}

test.describe('Lead Reports · Filters', () => {
  test(...lr('LR-016'), async ({ leadReports }) => {
    await leadReports.open();
    expect(Object.keys(await leadReports.filterState()), 'Period label').toContain('Period (lead captured)');
    expect(await leadReports.periodOptions()).toEqual([...PERIODS]);
  });

  test(...lr('LR-017'), async ({ leadReports }) => {
    await leadReports.open();
    expect(await leadReports.period(), 'Default period').toBe('this_month');
  });

  test(...lr('LR-018'), async ({ leadReports, page }) => {
    await leadReports.open();
    const seen: string[] = [];
    for (const period of PERIODS.filter(p => p !== 'custom')) {
      const req = page.waitForRequest(r => r.url().includes('/reports/leads/overview') && r.url().includes(`period=${period}`), { timeout: 5000 }).catch(() => null);
      await leadReports.setPeriod(period);
      await req;
      const captured = await leadReports.kpi('Leads Captured');
      seen.push(`${period}: ${captured}`);
      for (const k of leadReports.kpiLabels) expect.soft(await leadReports.kpiText(k), `${period} › ${k}`).not.toMatch(BAD);
      expect.soft((await leadReports.funnel())[0].count, `${period}: funnel Captured = Leads Captured`).toBe(captured);
    }
    note('Leads Captured', seen.join(' | '));
  });

  test(...lr('LR-019'), async ({ leadReports }) => {
    await leadReports.open();
    await expect(leadReports.fromInput).toHaveCount(0);
    await leadReports.setPeriod('custom');
    await expect(leadReports.fromInput).toBeVisible();
    await expect(leadReports.toInput).toBeVisible();
  });

  test(...lr('LR-020'), async ({ leadReports }) => {
    const [from, to] = previousMonth();
    await leadReports.open();
    await leadReports.setCustomRange(from, to);
    note('range', `${from} → ${to}: Leads Captured ${await leadReports.kpiText('Leads Captured')}`);
    for (const k of leadReports.kpiLabels) expect.soft(await leadReports.kpiText(k), k).not.toMatch(BAD);
    expect((await leadReports.funnel())[0].count).toBe(await leadReports.kpi('Leads Captured'));
  });

  test(...lr('LR-021'), async ({ leadReports, page }) => {
    const [from, to] = previousMonth();
    await leadReports.open();
    await leadReports.setPeriod('custom');
    const sent: string[] = [];
    page.on('request', r => { if (r.url().includes('period=custom')) sent.push(r.url()); });
    await leadReports.fromInput.fill(to);
    await leadReports.toInput.fill(from);
    await page.waitForLoadState('networkidle').catch(() => {});
    const invalid = sent.filter(u => (u.match(/from=([\d-]+)/)?.[1] ?? '') > (u.match(/to=([\d-]+)/)?.[1] ?? '~'));
    expect.soft(invalid, 'No request sent with From after To').toEqual([]);
    await expect(page.locator('main').getByText(/before|after|invalid|must be|cannot be/i).first(), 'Validation message').toBeVisible({ timeout: 5000 });
  });

  test(...lr('LR-022'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const openBefore = await leadReports.kpi('Open Leads Now');
    await leadReports.setCustomRange(...futureRange());
    expect.soft(await leadReports.kpi('Leads Captured'), 'Leads Captured').toBe(0);
    expect.soft(await leadReports.kpi('SPA Signed'), 'SPA Signed').toBe(0);
    expect.soft(await leadReports.kpi('Won Value'), 'Won Value').toBe(0);
    for (const rate of ['Contact Rate', 'Qualification Rate', 'Opportunity Conversion']) {
      expect.soft(await leadReports.kpiValue(rate).innerText(), rate).toMatch(/^\s*(—|–|0(\.0+)?%)\s*$/);
    }
    for (const s of await leadReports.funnel()) expect.soft(s.count, `Funnel ${s.label}`).toBe(0);
    expect.soft(await leadReports.kpi('Open Leads Now'), 'Open Leads Now is "as of today"').toBe(openBefore);
  });

  // LR-023 … LR-030: one per header filter, in the order of the filter bar
  const FILTER_CASES: [string, string][] = [['LR-023', 'Project'], ['LR-024', 'Lead Source'], ['LR-025', 'Capture Channel'], ['LR-026', 'Campaign'],
    ['LR-027', 'Broker'], ['LR-028', 'Salesperson'], ['LR-029', 'Prospect Type'], ['LR-030', 'Nationality']];
  for (const [id, grouping] of FILTER_CASES) {
    test(...lr(id), async ({ leadReports }) => {
      await leadReports.open();
      expect((await leadReports.filterSelect(LEAD_FILTERS[grouping]).locator('option').first().innerText()).trim(), 'First option').toBe(LEAD_FILTERS[grouping]);
      const r = await applyGroupFilter(leadReports, grouping);
      note('values', `All ${r.all} | ${grouping} = ${r.value}: ${r.filtered}${r.expectedLeads !== undefined ? ` (Source & Channel row: ${r.expectedLeads})` : ''}`);
      expect.soft(r.filtered, 'Filtered ≤ all').toBeLessThanOrEqual(r.all);
      if (r.expectedLeads !== undefined) expect.soft(r.filtered, `Leads Captured = "${r.value}" row of Performance by ${grouping}`).toBe(r.expectedLeads);
      expect.soft((await leadReports.funnel())[0].count, 'Funnel follows the filter').toBe(r.filtered);
      for (const k of leadReports.kpiLabels) expect.soft(await leadReports.kpiText(k), k).not.toMatch(BAD);
    });
  }

  test(...lr('LR-031'), async ({ leadReports }) => {
    const source = await applyGroupFilter(leadReports, 'Lead Source');
    await leadReports.openTab('Source & Channel');
    await leadReports.groupBy('Project');
    const options = await leadReports.filterOptions(LEAD_FILTERS['Project']);
    const row = rowWithData((await leadReports.breakdown.rows()).filter(r => options.includes(labelOf(r))), 'Leads');
    test.skip(!row, `No project with leads from ${source.value}`);
    await leadReports.setFilter(LEAD_FILTERS['Project'], labelOf(row!));
    await leadReports.openTab('Overview & Funnel');
    const both = await leadReports.kpi('Leads Captured');
    note('values', `${source.value}: ${source.filtered} | + ${labelOf(row!)}: ${both}`);
    expect.soft(both, 'Combined = that project\'s row while filtered by the source').toBe(num(row!['Leads']));
    expect.soft(both).toBeLessThanOrEqual(source.filtered);
  });

  test(...lr('LR-032'), async ({ leadReports }) => {
    const r = await applyGroupFilter(leadReports, 'Lead Source');
    await leadReports.openTab('Source & Channel');
    await leadReports.groupBy('Lead Source');
    expect.soft(await leadReports.filterSelect(LEAD_FILTERS['Lead Source']).inputValue(), 'Filter still selected').not.toBe('');
    const rows = await leadReports.breakdown.rows();
    expect.soft(rows.map(labelOf), 'Only the filtered source is listed').toEqual([r.value]);
    expect.soft(num((await leadReports.breakdown.total())?.['Leads'] ?? ''), 'Total = filtered Leads Captured').toBe(r.filtered);
  });

  test(...lr('LR-033'), async ({ leadReports, page }) => {
    const r = await applyGroupFilter(leadReports, 'Lead Source');
    await page.reload();
    await page.waitForLoadState('networkidle').catch(() => {});
    for (const [label, value] of Object.entries(await leadReports.filterState())) {
      if (!/^Period/.test(label)) expect.soft(value, `"${label}" after reload`).toBe('');
    }
    await leadReports.setPeriod('last_12_months');
    expect.soft(await leadReports.kpi('Leads Captured'), 'Figures match the defaults').toBe(r.all);
  });

  test(...lr('LR-034'), async ({ leadReports }) => {
    await leadReports.open();
    const period = await leadReports.period();
    const before = await leadReports.kpis(leadReports.kpiLabels);
    await expect.soft(leadReports.resetButton, 'Disabled before any change').toBeDisabled();
    await leadReports.setFilter(LEAD_FILTERS['Lead Source'], (await leadReports.filterOptions(LEAD_FILTERS['Lead Source']))[0]);
    await leadReports.setFilter(LEAD_FILTERS['Project'], (await leadReports.filterOptions(LEAD_FILTERS['Project']))[0]);
    await expect.soft(leadReports.resetButton, 'Enabled after a change').toBeEnabled();
    await leadReports.resetFilters();
    expect.soft(await leadReports.period(), 'Period').toBe(period);
    for (const all of leadReports.filters) expect.soft(await leadReports.filterSelect(all).inputValue(), `"${all}"`).toBe('');
    expect.soft(await leadReports.kpis(leadReports.kpiLabels), 'KPIs back to the original values').toEqual(before);
  });

  test(...lr('LR-035'), async ({ leadReports }) => {
    const r = await applyGroupFilter(leadReports, 'Lead Source');
    const { drill } = await leadReports.drill.verify(leadReports.cardLinks('Leads Captured').first());
    const other = drill.rows.filter(x => x['Source'] !== r.value);
    expect.soft(drill.count, 'List = filtered Leads Captured').toBe(r.filtered);
    expect.soft(other.map(x => `${x.LeadNo}: ${x['Source']}`).slice(0, 10), `Rows with a source other than ${r.value}`).toEqual([]);
  });
});

test.describe('Lead Reports · Views', () => {
  test(...lr('LR-036'), async ({ leadReports }) => {
    await leadReports.open();
    for (const v of ['All', 'You and your team', 'Mine'] as const) await expect.soft(leadReports.viewButton(v), v).toBeEnabled();
    await expect(leadReports.viewButton('All'), 'All is active for this user').toHaveClass(/is-active/);
  });

  for (const [id, view, param, wider] of [['LR-037', 'You and your team', 'team', 'All'], ['LR-038', 'Mine', 'self', 'You and your team']] as const) {
    test(...lr(id), async ({ leadReports, page }) => {
      await leadReports.openWith('last_12_months');
      if (wider !== 'All') await leadReports.setView(wider);
      const before = await leadReports.kpis(['Leads Captured', 'SPA Signed', 'Open Leads Now']);
      const req = page.waitForRequest(r => r.url().includes('/reports/leads/overview') && r.url().includes(`view=${param}`), { timeout: 15_000 });
      await leadReports.setView(view);
      await req;
      const after = await leadReports.kpis(['Leads Captured', 'SPA Signed', 'Open Leads Now']);
      note('values', `${wider} ${JSON.stringify(before)} | ${view} ${JSON.stringify(after)}`);
      for (const k of Object.keys(before)) expect.soft(after[k], `${view} ${k} ≤ ${wider}`).toBeLessThanOrEqual(before[k]);
    });
  }

  test(...lr('LR-039'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const all = await leadReports.kpis(leadReports.kpiLabels);
    await leadReports.setView('Mine');
    await leadReports.setView('All');
    expect(await leadReports.kpis(leadReports.kpiLabels)).toEqual(all);
  });

  test(...lrSkipped('LR-040', 'Needs manager and salesperson test accounts (set CRM_MANAGER_* / CRM_SALES_* to enable)'));
  test(...lrSkipped('LR-041', 'Needs a salesperson test account'));
});
