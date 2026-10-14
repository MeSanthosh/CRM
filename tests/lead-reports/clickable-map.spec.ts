/**
 * Lead Reports workbook — "Clickable Map" sheet: one test per row. Each checks that the element is (or is not)
 * clickable as the sheet says, and does what the sheet describes. Rows are matched by position (LR-MAP-01 = row 1).
 */
import { test, expect } from '../pages/fixtures';
import { num } from '../helpers';
import { PERIODS } from '../pages/ReportModulePage';
import { LeadReportsPage, GROUPINGS, BREAKDOWN_LINK_COLUMNS, SCORECARD_LINK_COLUMNS, AGING_LINK_COLUMNS, LEAD_FILTERS } from '../pages/LeadReportsPage';
import { LeadTable } from '../pages/LeadTable';
import { MAP_ROWS, lrMap } from './catalog';
import { labelOf } from './shared';

/** Cells of `columns`: counts above 0 must be links, everything else must not. */
async function expectLinksOnlyOnCounts(table: LeadTable, linkColumns: string[]) {
  const headers = await table.headers();
  for (const r of (await table.rows()).slice(0, 5)) {
    for (const c of headers.slice(1)) {
      const shouldLink = linkColumns.includes(c) && num(r[c]) > 0;
      await expect.soft(table.link(r, c, headers), `${labelOf(r)} › ${c} (${r[c]}) ${shouldLink ? 'is' : 'is not'} a link`).toHaveCount(shouldLink ? 1 : 0);
    }
  }
}

async function expectDownload(lead: LeadReportsPage, table: LeadTable, file: RegExp) {
  const sheet = await table.export();
  expect(sheet.name).toMatch(file);
}

const CHECKS: Record<number, (lead: LeadReportsPage) => Promise<void>> = {
  1: async lead => { await lead.open(); await lead.backToHub(); },
  2: async lead => {
    await lead.open();
    expect(await lead.periodOptions()).toEqual([...PERIODS]);
    for (const all of Object.values(LEAD_FILTERS)) await expect.soft(lead.filterSelect(all), all).toBeEnabled();
    expect(await lead.page.locator('main select').count(), '9 dropdowns').toBe(9);
  },
  3: async lead => { await lead.open(); await lead.setPeriod('custom'); await expect(lead.fromInput).toBeEditable(); await expect(lead.toInput).toBeEditable(); },
  4: async lead => {
    await lead.open();
    for (const v of ['You and your team', 'Mine', 'All'] as const) await lead.setView(v);
  },
  5: async lead => {
    await lead.open();
    await expect(lead.resetButton).toBeDisabled();
    await lead.setFilter(LEAD_FILTERS['Project'], (await lead.filterOptions(LEAD_FILTERS['Project']))[0]);
    await expect(lead.resetButton).toBeEnabled();
  },
  6: async lead => { await lead.open(); expect(await lead.helpText()).toMatch(/Leads captured:/); },
  7: async lead => { await lead.open(); for (const t of [...lead.tabs.slice(1), lead.tabs[0]]) await lead.openTab(t.name); },
  8: async lead => { await lead.openWith('last_12_months'); await lead.drill.verify(lead.cardLinks('Leads Captured').first(), { withExport: false }); },
  9: async lead => { await lead.openWith('last_12_months'); await lead.drill.verify(lead.cardLinks('SPA Signed').first(), { withExport: false }); },
  10: async lead => {
    await lead.openWith('last_12_months');
    await expect(lead.cardLinks('Open Leads Now')).toHaveCount(3);
    for (let i = 0; i < 3; i++) await lead.drill.verify(lead.cardLinks('Open Leads Now').nth(i), { withExport: false });
  },
  11: async lead => {
    await lead.open();
    for (const c of ['Contact Rate', 'Qualification Rate', 'Opportunity Conversion', 'Won Value', 'Avg Time to First Contact']) {
      await expect.soft(lead.card(c).locator('button, a'), c).toHaveCount(0);
    }
  },
  12: async lead => {
    await lead.openWith('last_12_months');
    for (const s of (await lead.funnel()).filter(x => x.count > 0)) await expect.soft(lead.funnelLink(s.label), s.label).toHaveCount(1);
  },
  13: async lead => {
    await lead.open();
    for (const p of ['Data Completeness', '12-Month Trend']) await expect.soft(lead.panel(p).locator('button, a'), p).toHaveCount(0);
  },
  14: async lead => { await lead.openAt('source'); for (const g of [...GROUPINGS.slice(1), GROUPINGS[0]]) await lead.groupBy(g.name); },
  15: async lead => { await lead.openAt('source', 'last_12_months'); await expectLinksOnlyOnCounts(lead.breakdown, BREAKDOWN_LINK_COLUMNS); },
  16: async lead => { await lead.openAt('source', 'last_12_months'); await expectLinksOnlyOnCounts(lead.breakdown, BREAKDOWN_LINK_COLUMNS); },
  17: async lead => { await lead.openAt('source', 'last_12_months'); await expectDownload(lead, lead.breakdown, /^lead-report-breakdown-/); },
  18: async lead => {
    await lead.openAt('aging');
    for (const c of ['Open Leads', 'Idle Over 30 Days', 'Never Contacted']) await lead.drill.verify(lead.cardLinks(c).first(), { withExport: false });
  },
  19: async lead => {
    await lead.openAt('aging');
    const overdue = await lead.kpi('Overdue Follow-ups');
    await expect(lead.cardLinks('Overdue Follow-ups'), `Overdue Follow-ups ${overdue}: link only when above 0`).toHaveCount(overdue > 0 ? 1 : 0);
  },
  20: async lead => { await lead.openAt('aging'); for (const p of ['Idle Time', 'Lead Age']) await expect.soft(lead.panel(p).locator('button, a'), p).toHaveCount(0); },
  21: async lead => { await lead.openAt('aging'); await expectLinksOnlyOnCounts(lead.agingBySalesperson, AGING_LINK_COLUMNS); },
  22: async lead => { await lead.openAt('aging'); await expectLinksOnlyOnCounts(lead.agingBySalesperson, AGING_LINK_COLUMNS); },
  23: async lead => { await lead.openAt('aging'); await expectDownload(lead, lead.agingBySalesperson, /^lead-report-aging-/); },
  24: async lead => {
    await lead.openAt('aging');
    const rows = await lead.longestIdle.rows();
    const links = lead.longestIdle.table.locator('tbody a');
    await expect(links, 'One lead link per row').toHaveCount(rows.length);
    for (const href of await links.evaluateAll(as => as.map(a => a.getAttribute('href')))) expect.soft(href).toMatch(/^\/leads\?selected=/);
  },
  25: async lead => {
    await lead.openAt('qualification');
    for (const t of [lead.byRating, lead.byScore]) await expect.soft(t.table.locator('tbody button, tbody a')).toHaveCount(0);
    await expect.soft(lead.panel('Where the Leads Are Now').locator('button, a')).toHaveCount(0);
  },
  26: async lead => {
    await lead.openAt('qualification', 'last_12_months');
    const total = (await lead.lostReasons()).reduce((a, r) => a + r.count, 0);
    await lead.drill.verify(lead.viewLostLeads, { expected: total, withExport: false });
  },
  27: async lead => { await lead.openAt('scorecard', 'last_12_months'); await expectLinksOnlyOnCounts(lead.scorecard, SCORECARD_LINK_COLUMNS); },
  28: async lead => { await lead.openAt('scorecard', 'last_12_months'); await expectLinksOnlyOnCounts(lead.scorecard, SCORECARD_LINK_COLUMNS); },
  29: async lead => { await lead.openAt('scorecard', 'last_12_months'); await expectDownload(lead, lead.scorecard, /^lead-report-scorecard-/); },
  30: async lead => {
    await lead.openWith('last_12_months');
    const d = await lead.drill.openFrom(lead.cardLinks('SPA Signed').first());
    const hrefs = await lead.drill.leadLinks().evaluateAll(as => as.map(a => a.getAttribute('href')));
    expect(hrefs.length, 'One lead link per row').toBe(d.rows.length);
    for (const h of hrefs.slice(0, 20)) expect.soft(h).toMatch(/^\/leads\?selected=/);
  },
  31: async lead => {
    await lead.openWith('last_12_months');
    const d = await lead.drill.openFrom(lead.cardLinks('SPA Signed').first());
    expect((await lead.drill.export()).rows.length).toBe(d.count);
  },
  32: async lead => { await lead.openWith('last_12_months'); await lead.drill.openFrom(lead.cardLinks('SPA Signed').first()); await lead.drill.close(); },
};

test.describe('Lead Reports · Clickable Map', () => {
  test('LR-MAP-00 Every Clickable Map row has a check', { tag: '@lead-workbook' }, () => {
    expect(MAP_ROWS.map((_, i) => i + 1).filter(n => !CHECKS[n]), 'Map rows without a check').toEqual([]);
  });

  MAP_ROWS.forEach((_, i) => {
    const n = i + 1;
    if (!CHECKS[n]) return;
    test(...lrMap(n), async ({ leadReports }) => { await CHECKS[n](leadReports); });
  });
});
