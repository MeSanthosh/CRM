/**
 * Marketing Reports workbook: common rows (views, period, filters, cards, tables, exports, non-functional) come from
 * module-workbooks/common.ts; this file adds the page's own rows (page:…) and observations. Values are read live.
 */
import { test, expect, note } from '../pages/fixtures';
import { num, sum } from '../helpers';
import { declareCommon, declareCoverage } from '../module-workbooks/common';
import { shownDate, shownTolerance, NAMED_PERIODS } from '../module-workbooks/helpers';
import type { MarketingReportsPage } from '../pages/MarketingReportsPage';
import { labelOf } from '../lead-reports/shared';
import { WB, CFG } from './workbook';

declareCommon(WB, CFG);
declareCoverage(WB, 'tests/marketing-reports');

type FileRow = Record<string, unknown>;
const n = (v: unknown) => Number(v ?? 0);
const CAMPAIGNS = 'All campaigns';

/** Campaign Performance as exported: exact budgets, costs and ROI (the screen rounds them). */
async function campaignExport(m: MarketingReportsPage) {
  await m.openWith('last_12_months');
  return m.campaigns.export();
}

/** A computed value agrees with a file value (null = "—"). */
function expectClose(actual: unknown, expected: number | null, what: string, tol = 0.01) {
  if (expected === null) { expect.soft(actual === null || actual === undefined || actual === '', `${what}: "—" expected, file has ${actual}`).toBeTruthy(); return; }
  expect.soft(Math.abs(n(actual) - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tol);
}

test.describe('Marketing Reports · Page checks', () => {
  test(...WB.key('page:cost-per-lead'), async ({ marketing }) => {
    const sheet = await campaignExport(marketing);
    for (const r of [...sheet.rows, ...(sheet.total ? [sheet.total] : [])]) {
      expectClose(r['Cost per Lead'], n(r['Leads']) ? n(r['Budget (USD)']) / n(r['Leads']) : null, `${r['Campaign']}: Cost per Lead = Budget ÷ Leads`);
    }
  });

  test(...WB.key('page:roi'), async ({ marketing }) => {
    const sheet = await campaignExport(marketing);
    for (const r of [...sheet.rows, ...(sheet.total ? [sheet.total] : [])]) {
      const budget = n(r['Budget (USD)']);
      if (!budget) continue;
      expectClose(r['ROI %'], ((n(r['Revenue (USD)']) - budget) / budget) * 100, `${r['Campaign']}: ROI = (Revenue − Budget) ÷ Budget`, 0.1);
    }
  });

  test(...WB.key('page:cost-per-spa'), async ({ marketing }) => {
    const sheet = await campaignExport(marketing);
    for (const r of [...sheet.rows, ...(sheet.total ? [sheet.total] : [])]) {
      expectClose(r['Cost per SPA'], n(r['SPA']) ? n(r['Budget (USD)']) / n(r['SPA']) : null, `${r['Campaign']}: Cost per SPA = Budget ÷ SPA`);
    }
  });

  test(...WB.key('page:row-rules'), async ({ marketing }) => {
    await marketing.openWith('last_12_months');
    const rows = await marketing.campaigns.rows();
    const bad: string[] = [];
    for (const r of rows) {
      const [leads, qualified, opp, spa, revenue] = ['Leads', 'Qualified', 'Opportunities', 'SPA', 'Revenue (USD)'].map(c => num(r[c]));
      if (qualified > leads) bad.push(`${r['Campaign']}: Qualified ${qualified} > Leads ${leads}`);
      if (opp > leads) bad.push(`${r['Campaign']}: Opportunities ${opp} > Leads ${leads}`);
      if (spa > leads) bad.push(`${r['Campaign']}: SPA ${spa} > Leads ${leads}`);
      if (spa === 0 && revenue !== 0) bad.push(`${r['Campaign']}: Revenue ${r['Revenue (USD)']} without an SPA`);
      if (shownDate(r['Start']).getTime() > shownDate(r['End']).getTime()) bad.push(`${r['Campaign']}: Start ${r['Start']} after End ${r['End']}`);
    }
    const codes = rows.map(r => r['Campaign']);
    expect.soft(codes.filter((c, i) => codes.indexOf(c) !== i), 'Campaign codes listed twice').toEqual([]);
    expect(bad).toEqual([]);
  });

  test(...WB.key('page:states'), async ({ marketing }) => {
    await marketing.openWith('last_12_months');
    const today = new Date(new Date().toDateString()).getTime();
    const wrong = (await marketing.campaigns.rows()).filter(r => {
      const start = shownDate(r['Start']).getTime(), end = shownDate(r['End']).getTime();
      const want = end < today ? 'Ended' : start > today ? 'Upcoming' : 'Running';
      return r['State'] !== want;
    }).map(r => `${r['Campaign']}: ${r['State']} (${r['Start']} – ${r['End']})`);
    expect(wrong, 'Campaigns whose state does not match the dates').toEqual([]);
  });

  test(...WB.key('page:running-today'), async ({ marketing, page }) => {
    await marketing.openWith('last_12_months');
    const states = (await marketing.campaigns.column('State')).reduce<Record<string, number>>((a, s) => ({ ...a, [s]: (a[s] ?? 0) + 1 }), {});
    const card = await page.locator('main article.crm-card').filter({ hasText: 'Running today' }).innerText();
    const m = card.match(/(\d+)\s+ended,\s+(\d+)\s+upcoming/i);
    note('values', `${card.replace(/\s+/g, ' ')} | table states ${JSON.stringify(states)}`);
    expect.soft(await marketing.kpi('Running today'), 'Running today = Running campaigns').toBe(states['Running'] ?? 0);
    expect.soft(Number(m?.[1]), 'Subtitle "N ended" = Ended campaigns').toBe(states['Ended'] ?? 0);
    expect.soft(Number(m?.[2]), 'Subtitle "N upcoming" = Upcoming campaigns').toBe(states['Upcoming'] ?? 0);
  });

  test(...WB.key('page:channels'), async ({ marketing }) => {
    const campaigns = await campaignExport(marketing);
    const channels = await marketing.channels.export();
    const by: Record<string, { campaigns: number; budget: number; leads: number; spa: number; revenue: number }> = {};
    for (const r of campaigns.rows) {
      const g = (by[String(r['Channel'])] ??= { campaigns: 0, budget: 0, leads: 0, spa: 0, revenue: 0 });
      g.campaigns++; g.budget += n(r['Budget (USD)']); g.leads += n(r['Leads']); g.spa += n(r['SPA']); g.revenue += n(r['Revenue (USD)']);
    }
    expect.soft(channels.rows.map(r => String(r['Channel'])).sort(), 'Channels').toEqual(Object.keys(by).sort());
    for (const r of channels.rows) {
      const g = by[String(r['Channel'])];
      if (!g) continue;
      const c = String(r['Channel']);
      expect.soft(n(r['Campaigns']), `${c}: Campaigns`).toBe(g.campaigns);
      expectClose(r['Budget (USD)'], g.budget, `${c}: Budget`);
      expect.soft(n(r['Leads']), `${c}: Leads`).toBe(g.leads);
      expect.soft(n(r['SPA']), `${c}: SPA`).toBe(g.spa);
      expectClose(r['Revenue (USD)'], g.revenue, `${c}: Revenue`, 1);
      expectClose(r['Cost per Lead'], g.leads ? g.budget / g.leads : null, `${c}: Cost per Lead`);
      if (g.budget) expectClose(r['ROI %'], ((g.revenue - g.budget) / g.budget) * 100, `${c}: ROI`, 0.1);
    }
  });

  test(...WB.key('page:campaign-filter'), async ({ marketing }) => {
    await marketing.openWith('last_12_months');
    const labels = await marketing.filterOptions(CAMPAIGNS);
    for (const [i, label] of labels.slice(0, 3).entries()) {
      await marketing.setFilterIndex(CAMPAIGNS, i + 1);
      const rows = await marketing.campaigns.rows();
      expect.soft(rows.map(r => r['Name']), `${label}: only that campaign`).toEqual([label]);
      if (rows[0]) expect.soft(await marketing.shown('Campaign budget'), `${label}: Campaign budget = its budget`).toBe(rows[0]['Budget (USD)']);
    }
  });

  test(...WB.key('page:budget'), async ({ marketing }) => {
    await marketing.openWith('last_12_months');
    const budget = await marketing.shown('Campaign budget');
    const seen: string[] = [`Last 12 months ${budget}`];
    for (const p of ['this_month', 'ytd'] as const) { await marketing.setPeriod(p); seen.push(`${p} ${await marketing.shown('Campaign budget')}`); expect.soft(await marketing.shown('Campaign budget'), p).toBe(budget); }
    await marketing.setPeriod('last_12_months');
    for (const all of ['All projects', 'All salespeople']) {
      await marketing.setFilterIndex(all, 1);
      const b = await marketing.shown('Campaign budget');
      seen.push(`${all} → first value: ${b}`);
      expect.soft(b, `${all}: budget unchanged`).toBe(budget);
      const listed = sum((await marketing.campaigns.column('Budget (USD)')).map(num));
      expect.soft(Math.abs(listed - num(b)), `${all}: budget = the listed campaigns' budgets`).toBeLessThanOrEqual(shownTolerance(b) * 7);
      await marketing.setFilterIndex(all, 0);
    }
    note('budget', seen.join(' | '));
  });

  test(...WB.key('page:lead-reports'), async ({ marketing, leadReports }) => {
    const sheet = await campaignExport(marketing);
    await leadReports.openWith('last_12_months');
    await leadReports.openTab('Source & Channel');
    await leadReports.groupBy('Campaign');
    const lead = new Map((await leadReports.breakdown.rows()).map(r => [labelOf(r), r]));
    const diffs: string[] = [];
    for (const r of sheet.rows) {
      const name = String(r['Name']);
      const l = lead.get(name);
      if (!l) { if (n(r['Leads'])) diffs.push(`${name}: not in Lead Reports (Marketing Leads ${r['Leads']})`); continue; }
      for (const [mc, lc] of [['Leads', 'Leads'], ['Qualified', 'Qualified'], ['Opportunities', 'Opportunity'], ['SPA', 'SPA Signed']]) {
        if (n(r[mc]) !== num(l[lc])) diffs.push(`${name}: ${mc} ${r[mc]} vs Lead Reports ${lc} ${l[lc]}`);
      }
      if (Math.abs(n(r['Revenue (USD)']) - num(l['Won Value'])) > shownTolerance(l['Won Value']) + 1) diffs.push(`${name}: Revenue ${r['Revenue (USD)']} vs Lead Reports Won Value ${l['Won Value']}`);
    }
    note('compared', `${sheet.rows.length} campaigns`);
    expect(diffs).toEqual([]);
  });
});

test.describe('Marketing Reports · Observations', () => {
  test(...WB.obs('OBS-02'), async ({ marketing }) => {
    await marketing.open();
    let checked = false;
    for (const p of NAMED_PERIODS) {
      await marketing.setPeriod(p);
      if ((await marketing.kpi('Campaign leads')) !== 0) continue;
      checked = true;
      const roi = await marketing.shown('ROI');
      note(p, `Campaign leads 0, Revenue ${await marketing.shown('Revenue')}, ROI ${roi}`);
      expect.soft(roi, `${p}: ROI with no campaign leads`).toMatch(/^[—–-]$/);
    }
    test.skip(!checked, 'Every period has campaign leads');
  });

  test(...WB.obs('OBS-03'), async ({ marketing }) => {
    await marketing.open();
    const formats: string[] = [];
    for (const p of NAMED_PERIODS) {
      await marketing.setPeriod(p);
      const cpl = await marketing.shown('Cost per lead');
      if (cpl !== '—') formats.push(`${p}: ${cpl}`);
    }
    note('Cost per lead', formats.join(' | '));
    const styles = new Set(formats.map(f => (/\d\s?[KMB]\s?USD$/.test(f) ? 'abbreviated' : 'full')));
    expect(styles.size, 'Cost per lead shown in one format').toBe(1);
  });

  test(...WB.obs('OBS-04'), async ({ marketing }) => {
    await marketing.openWith('this_month');
    const parts = [`This month: leads ${await marketing.shown('Campaign leads')}, budget ${await marketing.shown('Campaign budget')}, cost per lead ${await marketing.shown('Cost per lead')}, ROI ${await marketing.shown('ROI')}`];
    await marketing.setPeriod('last_12_months');
    parts.push(`Last 12 months: leads ${await marketing.shown('Campaign leads')}, budget ${await marketing.shown('Campaign budget')}`);
    note('finding', parts.join(' | '));
  });

  test(...WB.obs('OBS-05'), async ({ marketing }) => {
    await marketing.openWith('last_12_months');
    const footer = await marketing.channels.total();
    const sheet = await marketing.channels.export();
    note('finding', `Performance by Channel Total row on screen: ${footer ? 'yes' : 'no'}; in the export: ${sheet.total ? 'yes' : 'no'}`);
  });

  test(...WB.obs('OBS-07'), async ({ marketing }) => {
    await marketing.openWith('last_quarter');
    const today = new Date();
    const lastQuarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3 - 3, 1).getTime();
    const after = (await marketing.campaigns.rows()).filter(r => num(r['Leads']) > 0 && shownDate(r['End']).getTime() < lastQuarterStart);
    note('finding', after.length ? `Last quarter leads for campaigns that ended earlier: ${after.map(r => `${r['Name']} (ended ${r['End']}): ${r['Leads']}`).join(', ')}` : 'No leads attributed after a campaign ended');
  });
});
