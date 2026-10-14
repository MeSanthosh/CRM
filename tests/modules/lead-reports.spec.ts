/** Lead Reports card → /reports/leads. Run alone: npm run test:lead-reports */
import { test, expect, expected, note } from '../pages/fixtures';
import { sum, expectNear } from '../helpers';
import * as check from './checks';

const FUNNEL = ['Captured', 'Contacted', 'Qualified', 'Opportunity'];

test.describe('Lead Reports', { tag: ['@pages', '@lead-reports'] }, () => {
  test('LDR-01 Opens from its card on the hub', expected(check.EXPECT.opensFromHub), ({ hub, leadReports }) => check.opensFromHub(hub, leadReports));
  test('LDR-02 Every KPI shows a valid value', expected(check.EXPECT.kpisValid), ({ leadReports }) => check.kpisValid(leadReports));
  test('LDR-03 Page loads without errors', expected(check.EXPECT.tablesRender), ({ leadReports }) => check.tablesRender(leadReports));
  test('LDR-04 Every period reloads the report', expected(check.EXPECT.periodsReload), ({ leadReports }) => check.periodsReload(leadReports));
  test('LDR-05 Opens on "This month"', expected(check.EXPECT.opensOnThisMonth), ({ leadReports }) => check.opensOnThisMonth(leadReports));
  test('LDR-06 Custom date range', expected(check.EXPECT.customRange), ({ leadReports }) => check.customRange(leadReports));
  test('LDR-07 Filters narrow the results', expected(check.EXPECT.filtersNarrow), ({ leadReports }) => check.filtersNarrow(leadReports));
  test('LDR-08 Views narrow the results', expected(check.EXPECT.viewsNarrow), ({ leadReports }) => check.viewsNarrow(leadReports));
  test('LDR-09 Reset filters', expected(check.EXPECT.resetRestores), ({ leadReports }) => check.resetRestores(leadReports));
  test('LDR-10 Breadcrumb back to the hub', expected('The "Reports & Analytics" breadcrumb returns to the hub'), ({ leadReports }) => check.navigation(leadReports, leadReports));

  test('LDR-11 Each tab shows its KPIs and panels', expected('Each of the 5 tabs opens (URL ?tab=…) and shows all its KPI cards with valid values and all its panels'), async ({ leadReports, page }) => {
    leadReports.watchErrors();
    await leadReports.openWith();
    for (const tab of [...leadReports.tabs.slice(1), leadReports.tabs[0]]) {
      await leadReports.openTab(tab.name);
      if (tab.param) await expect.soft(page, `${tab.name} URL`).toHaveURL(new RegExp(`tab=${tab.param}`));
      for (const label of tab.kpis) expect.soft(await leadReports.kpiText(label), `${tab.name} › ${label}`).not.toMatch(/NaN|undefined|Infinity/);
      for (const panel of tab.panels) await expect.soft(leadReports.panelHeading(panel), `${tab.name} › "${panel}"`).toBeVisible();
      await leadReports.expectNoBrokenValues(tab.name);
    }
    leadReports.expectNoErrors();
  });

  test('LDR-12 Lead funnel steps and counts', expected('Funnel lists Captured → Contacted → Qualified → Opportunity …, counts never increase, each rate = count ÷ Captured, bar width = rate'), async ({ leadReports }) => {
    await leadReports.openWith();
    const steps = await leadReports.funnel();
    note('funnel', steps.map(s => `${s.label} ${s.count} (${s.rate}%)`).join(' → '));
    expect.soft(steps.slice(0, FUNNEL.length).map(s => s.label), 'Funnel steps').toEqual(FUNNEL);
    for (let i = 1; i < steps.length; i++) {
      expect.soft(steps[i].count, `${steps[i].label} ≤ ${steps[i - 1].label}`).toBeLessThanOrEqual(steps[i - 1].count);
    }
    const top = steps[0].count;
    for (const s of steps) {
      if (top) expectNear(s.rate ?? NaN, (s.count / top) * 100, `${s.label} rate`, 0, 0.1);
      expectNear(s.width, s.rate ?? NaN, `${s.label} bar width`, 0, 0.5);
    }
  });

  test('LDR-13 Funnel agrees with the KPI cards', expected('Captured = Leads Captured; Contacted / Qualified / Opportunity rates = Contact Rate / Qualification Rate / Opportunity Conversion'), async ({ leadReports }) => {
    await leadReports.openWith();
    const by = Object.fromEntries((await leadReports.funnel()).map(s => [s.label, s]));
    expect.soft(by['Captured']?.count, 'Captured').toBe(await leadReports.kpi('Leads Captured'));
    expectNear(by['Contacted']?.rate ?? NaN, await leadReports.kpi('Contact Rate'), 'Contact Rate', 0, 0.1);
    expectNear(by['Qualified']?.rate ?? NaN, await leadReports.kpi('Qualification Rate'), 'Qualification Rate', 0, 0.1);
    expectNear(by['Opportunity']?.rate ?? NaN, await leadReports.kpi('Opportunity Conversion'), 'Opportunity Conversion', 0, 0.1);
  });

  test('LDR-14 12-month trend', expected('12 months ending with the current month, each with a value and "x opp · y SPA"; the 12 values add up to Leads Captured (Last 12 months)'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const months = await leadReports.trend();
    note('trend', months.map(m => `${m.label}: ${m.value}`).join(', '));
    expect.soft(months, '12 months').toHaveLength(12);
    for (const m of months) expect.soft(m.detail, `${m.label} detail`).toMatch(/^\d+ opp · \d+ SPA$/);
    const now = new Date();
    expect.soft(months.at(-1)?.label, 'Ends with the current month').toBe(`${now.toLocaleString('en-GB', { month: 'short' })} ${String(now.getFullYear()).slice(2)}`);
    expect.soft(sum(months.map(m => m.value)), 'Total = Leads Captured').toBe(await leadReports.kpi('Leads Captured'));
  });

  test('LDR-15 Data Completeness', expected('Each row is "filled / total (x%)" with total = Leads Captured, filled ≤ total and x = filled ÷ total'), async ({ leadReports }) => {
    await leadReports.openWith();
    const rows = await leadReports.dataCompleteness();
    const captured = await leadReports.kpi('Leads Captured');
    note('completeness', rows.map(r => `${r.label} ${r.filled}/${r.total} (${r.percent}%)`).join(' | '));
    expect(rows.length, 'Rows found').toBeGreaterThan(0);
    for (const r of rows) {
      expect.soft(r.total, `${r.label}: total = Leads Captured`).toBe(captured);
      expect.soft(r.filled, `${r.label}: filled ≤ total`).toBeLessThanOrEqual(r.total);
      if (r.total) expectNear(r.percent, (r.filled / r.total) * 100, `${r.label} %`, 0, 0.1);
    }
  });

  test('LDR-16 Funnel with no data', expected('A date range with no leads shows 0 in every funnel step and empty bars'), async ({ leadReports }) => {
    await leadReports.open();
    await leadReports.setCustomRange('2000-01-01', '2000-01-31');
    for (const s of await leadReports.funnel()) {
      expect.soft(s.count, `${s.label} count`).toBe(0);
      expect.soft(Number.isNaN(s.width) ? 0 : s.width, `${s.label} bar`).toBe(0);
    }
    await leadReports.expectNoBrokenValues();
  });
});
