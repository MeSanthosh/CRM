/**
 * Lead Reports workbook — Filter combinations (LR-147…156).
 * Every filter value is picked from the page at run time (Source & Channel › Performance by <field>), and every
 * expected figure comes from the page itself: the picked row, the unfiltered figures, the options API.
 */
import { test, expect, note } from '../pages/fixtures';
import { num, sum } from '../helpers';
import { GROUPINGS } from '../pages/LeadReportsPage';
import { lr } from './catalog';
import { expectRate, labelOf, isTotalOrUnspecified } from './shared';
import { Grouping, SOURCE, PROJECT, BAD, EMPTY_RATE, API_KEY, EXPORT_COLUMN, captured, selected, selectedCode, uniqueOptions, selectable, narrow,
  recordsOutside, describeApplied } from './filters';

test.describe('Lead Reports · Filter combinations', () => {
  test(...lr('LR-147'), async ({ leadReports }) => {
    test.setTimeout(300_000);
    await leadReports.openWith('last_12_months');
    let previous = await captured(leadReports);
    const applied = await narrow(leadReports, GROUPINGS);
    note('filters', `All: ${previous} | ${describeApplied(applied)}`);
    test.skip(applied.length < 2, 'Fewer than two filters have a value with leads');
    for (const a of applied) {
      expect.soft(a.captured, `${a.g.name} = ${a.value}: Leads Captured = its row in Performance by ${a.g.name}`).toBe(a.leads);
      expect.soft(a.captured, `${a.g.name} = ${a.value}: never goes up`).toBeLessThanOrEqual(previous);
      previous = a.captured;
    }
    for (const a of applied) expect.soft(await selected(leadReports, a.g), `"${a.g.name}" still selected`).toBe(a.value);
    for (const g of GROUPINGS.filter(g => !applied.some(a => a.g === g))) expect.soft(await selected(leadReports, g), `"${g.name}" left at All`).toBe(g.filter);
    await leadReports.openTab('Overview & Funnel');
    expect.soft((await leadReports.funnel())[0].count, 'Funnel Captured = Leads Captured').toBe(previous);
    if (previous > 0) {
      const r = await recordsOutside(leadReports, applied);
      note('records', `listed ${r.listed} | exported ${r.exported} | checked ${r.checked.join(', ')}`);
      expect.soft(r.listed, 'List = Leads Captured').toBe(previous);
      expect.soft(r.outside.slice(0, 10), 'Leads outside the selected filters').toEqual([]);
    }
  });

  test(...lr('LR-148'), async ({ leadReports }) => {
    test.setTimeout(180_000);
    await leadReports.openWith('last_12_months');
    const before = await leadReports.kpis(leadReports.kpiLabels);
    const row = (await selectable(leadReports, SOURCE)).find(r => num(r['Leads']) < before['Leads Captured']);
    test.skip(!row, 'No lead source with only some of the leads');
    await leadReports.setFilter(SOURCE.filter, labelOf(row!));
    await leadReports.openTab('Overview & Funnel');
    const after = await leadReports.kpis(leadReports.kpiLabels);
    const lc = after['Leads Captured'];
    note('values', `All ${JSON.stringify(before)} | ${labelOf(row!)} ${JSON.stringify(after)}`);
    expect.soft(lc, `Leads Captured = "${labelOf(row!)}" row`).toBe(num(row!['Leads']));
    for (const k of ['Leads Captured', 'SPA Signed', 'Open Leads Now']) expect.soft(after[k], `${k} ≤ unfiltered`).toBeLessThanOrEqual(before[k]);
    for (const k of leadReports.kpiLabels) expect.soft(await leadReports.kpiText(k), `${k} is a valid value`).not.toMatch(BAD);
    for (const [card, re] of [['Contact Rate', /(\d[\d,]*)\s+contacted/], ['Qualification Rate', /(\d[\d,]*)\s+qualified/],
      ['Opportunity Conversion', /(\d[\d,]*)\s+converted to opportunity/]] as const) {
      const part = Number((await leadReports.cardSubtitle(card)).match(re)?.[1].replace(/,/g, '') ?? NaN);
      expectRate(after[card], part, lc, `${card} recalculated`);
    }
    expect.soft((await leadReports.funnel())[0].count, 'Funnel Captured').toBe(lc);
    await leadReports.openTab('Source & Channel');
    await leadReports.groupBy('Lead Source');
    expect.soft(num((await leadReports.breakdown.total())?.['Leads'] ?? ''), 'Source & Channel Total').toBe(lc);
    await leadReports.openTab('Salesperson Scorecard');
    expect.soft(sum((await leadReports.scorecard.rows()).map(r => num(r['Leads']))), 'Scorecard Leads').toBe(lc);
  });

  test(...lr('LR-149'), async ({ leadReports }) => {
    test.setTimeout(180_000);
    await leadReports.openWith('last_12_months');
    const a = (await selectable(leadReports, SOURCE))[0];
    const p = (await selectable(leadReports, PROJECT))[0];
    test.skip(!a || !p, 'No lead source or project with leads');
    const [aAlone, pAlone] = [num(a['Leads']), num(p['Leads'])];
    await leadReports.setFilter(SOURCE.filter, labelOf(a));
    await leadReports.setFilter(PROJECT.filter, labelOf(p));
    const both = await captured(leadReports);

    await leadReports.setFilter(PROJECT.filter, PROJECT.filter);
    const afterProject = await captured(leadReports);
    expect.soft(await selected(leadReports, SOURCE), 'Lead Source kept').toBe(labelOf(a));
    expect.soft(await selected(leadReports, PROJECT), 'Project cleared').toBe(PROJECT.filter);
    expect.soft(afterProject, `Clearing Project = ${labelOf(a)} alone`).toBe(aAlone);

    await leadReports.setFilter(PROJECT.filter, labelOf(p));
    await leadReports.setFilter(SOURCE.filter, SOURCE.filter);
    const afterSource = await captured(leadReports);
    expect.soft(await selected(leadReports, PROJECT), 'Project kept').toBe(labelOf(p));
    expect.soft(await selected(leadReports, SOURCE), 'Lead Source cleared').toBe(SOURCE.filter);
    expect.soft(afterSource, `Clearing Lead Source = ${labelOf(p)} alone`).toBe(pAlone);
    note('values', `${labelOf(a)} ${aAlone} | ${labelOf(p)} ${pAlone} | both ${both} | Project cleared ${afterProject} | Source cleared ${afterSource}`);
    expect.soft(both, 'Both ≤ either alone').toBeLessThanOrEqual(Math.min(aAlone, pAlone));
  });

  test(...lr('LR-150'), async ({ leadReports }) => {
    test.setTimeout(180_000);
    await leadReports.openWith('last_12_months');
    const before = await leadReports.kpis(leadReports.kpiLabels);
    const funnelBefore = (await leadReports.funnel()).map(s => `${s.label} ${s.count}`);
    const applied = await narrow(leadReports, [SOURCE, PROJECT]);
    test.skip(!applied.length, 'No filter value with leads');
    for (const g of GROUPINGS) if ((await selected(leadReports, g)) !== g.filter) await leadReports.setFilter(g.filter, g.filter);
    for (const g of GROUPINGS) expect.soft(await selected(leadReports, g), `"${g.name}" shows All`).toBe(g.filter);
    await leadReports.openTab('Overview & Funnel');
    note('values', `${describeApplied(applied)} → all back to All`);
    expect.soft(await leadReports.kpis(leadReports.kpiLabels), 'KPI cards = unfiltered').toEqual(before);
    expect.soft((await leadReports.funnel()).map(s => `${s.label} ${s.count}`), 'Funnel = unfiltered').toEqual(funnelBefore);
  });

  test(...lr('LR-151'), async ({ leadReports }) => {
    test.setTimeout(300_000);
    await leadReports.openWith('last_12_months');
    const applied = await narrow(leadReports, GROUPINGS.filter(g => EXPORT_COLUMN[g.dimension]));
    test.skip(!applied.length, 'No filter value with leads');
    const lc = applied[applied.length - 1].captured;
    const r = await recordsOutside(leadReports, applied);
    note('values', `${describeApplied(applied)} | listed ${r.listed} | exported ${r.exported} | checked ${r.checked.join(', ')}`);
    expect.soft(r.listed, 'List = Leads Captured').toBe(lc);
    expect.soft(r.exported, 'Export rows = Leads Captured').toBe(lc);
    expect.soft(r.outside.slice(0, 10), 'Leads outside the selected filters').toEqual([]);
  });

  test(...lr('LR-152'), async ({ leadReports }) => {
    test.setTimeout(180_000);
    await leadReports.openWith('last_12_months');
    let pick: { g: Grouping; value: string } | undefined;
    for (const g of GROUPINGS) {
      const row = (await selectable(leadReports, g)).find(r => num(r['Leads']) === 1);
      if (row) { pick = { g, value: labelOf(row) }; break; }
    }
    test.skip(!pick, 'No filter value with exactly one lead');
    await leadReports.setFilter(pick!.g.filter, pick!.value);
    const lc = await captured(leadReports);
    note('values', `${pick!.g.name} = ${pick!.value}: Leads Captured ${lc}`);
    expect(lc, 'Leads Captured').toBe(1);
    const funnel = await leadReports.funnel();
    expect.soft(funnel[0].count, 'Funnel Captured').toBe(1);
    for (const s of funnel) expect.soft(s.count, `Funnel ${s.label} ≤ 1`).toBeLessThanOrEqual(1);
    // with one lead a time card can rightly show "—" (e.g. the lead was never contacted), so read the cards as shown
    for (const k of leadReports.kpiLabels) expect.soft(await leadReports.kpiValue(k).innerText(), `${k} is a valid value`).not.toMatch(BAD);
    for (const card of ['Contact Rate', 'Qualification Rate', 'Opportunity Conversion']) {
      expect.soft(await leadReports.kpiValue(card).innerText(), `${card} is 0% or 100%`).toMatch(/^\s*(0|100)(\.0+)?\s*%\s*$/);
    }
    await leadReports.drill.verify(leadReports.cardLinks('Leads Captured').first());
    await leadReports.openTab('Source & Channel');
    await leadReports.groupBy(pick!.g.name);
    expect.soft((await leadReports.breakdown.rows()).map(labelOf), 'Only the selected value is listed').toEqual([pick!.value]);
    expect.soft(num((await leadReports.breakdown.total())?.['Leads'] ?? ''), 'Source & Channel Total').toBe(1);
    await leadReports.openTab('Salesperson Scorecard');
    expect.soft(sum((await leadReports.scorecard.rows()).map(r => num(r['Leads']))), 'Scorecard Leads').toBe(1);
  });

  test(...lr('LR-153'), async ({ leadReports, page }) => {
    test.setTimeout(240_000);
    await leadReports.openWith('last_12_months');
    const sources = await selectable(leadReports, SOURCE);
    test.skip(!sources.length, 'No lead source with leads');
    const a = sources[sources.length - 1]; // the smallest source leaves the most values without leads
    await leadReports.setFilter(SOURCE.filter, labelOf(a));
    let pick: { g: Grouping; value: string } | undefined;
    for (const g of GROUPINGS.filter(g => g !== SOURCE)) {
      await leadReports.openTab('Source & Channel');
      await leadReports.groupBy(g.name);
      const withLeads = (await leadReports.breakdown.rows()).filter(r => num(r['Leads']) > 0).map(labelOf);
      const none = (await uniqueOptions(leadReports, g)).find(o => !withLeads.includes(o));
      if (none) { pick = { g, value: none }; break; }
    }
    test.skip(!pick, `Every value has leads from ${labelOf(a)}`);
    await leadReports.setFilter(pick!.g.filter, pick!.value);
    note('filters', `${SOURCE.name} = ${labelOf(a)} + ${pick!.g.name} = ${pick!.value}`);

    await leadReports.openTab('Overview & Funnel');
    for (const k of ['Leads Captured', 'SPA Signed', 'Won Value']) expect.soft(await leadReports.kpi(k), k).toBe(0);
    for (const card of ['Contact Rate', 'Qualification Rate', 'Opportunity Conversion']) {
      expect.soft(await leadReports.kpiValue(card).innerText(), `${card} shows — or 0%`).toMatch(EMPTY_RATE);
    }
    for (const s of await leadReports.funnel()) expect.soft(s.count, `Funnel ${s.label}`).toBe(0);
    for (const tab of leadReports.tabs.map(t => t.name)) {
      await leadReports.openTab(tab);
      await leadReports.expectNoBrokenValues(tab);
      expect.soft((await leadReports.countLinks().allInnerTexts()).filter(t => /^\s*0\s*$/.test(t)), `${tab}: zero counts are not links`).toEqual([]);
      await expect.soft(page.locator('main').getByText(/something went wrong|failed to load|error loading/i), `${tab}: no error message`).toHaveCount(0);
    }
    await leadReports.openTab('Source & Channel');
    if (await leadReports.breakdown.table.isVisible()) {
      expect.soft((await leadReports.breakdown.rows()).filter(r => num(r['Leads']) > 0).map(labelOf), 'Source & Channel rows with leads').toEqual([]);
    }
  });

  test(...lr('LR-154'), async ({ leadReports }) => {
    test.setTimeout(300_000);
    await leadReports.openWith('last_12_months');
    await leadReports.openTab('Source & Channel');
    let total = 0, unspecified = 0;
    for (const g of GROUPINGS) {
      await leadReports.groupBy(g.name);
      const options = await leadReports.filterOptions(g.filter);
      expect.soft(options.filter(o => !o.trim() || /^(null|undefined|n\/a|-|—|unspecified)$/i.test(o.trim())), `${g.name}: blank or null options`).toEqual([]);
      const rows = await leadReports.breakdown.rows();
      const t = num((await leadReports.breakdown.total())?.['Leads'] ?? '');
      expect.soft(sum(rows.map(r => num(r['Leads']))), `${g.name}: named rows + Unspecified = Total`).toBe(t);
      if (g === SOURCE) {
        total = t;
        unspecified = sum(rows.filter(r => isTotalOrUnspecified(labelOf(r))).map(r => num(r['Leads'])));
      }
    }
    const perSource: string[] = [];
    let named = 0;
    for (const o of await leadReports.filterOptions(SOURCE.filter)) {
      await leadReports.setFilter(SOURCE.filter, o);
      const n = await captured(leadReports);
      named += n;
      perSource.push(`${o} ${n}`);
    }
    note('values', `Total ${total} | Unspecified ${unspecified} | ${perSource.join(', ')} | sum ${named}`);
    expect.soft(named, 'Sum over every Lead Source option = Total − Unspecified').toBe(total - unspecified);

    await leadReports.setFilter(SOURCE.filter, SOURCE.filter);
    const busiest = (await selectable(leadReports, SOURCE))[0];
    test.skip(!busiest, 'No lead source with leads');
    await leadReports.setFilter(SOURCE.filter, labelOf(busiest));
    const lc = await captured(leadReports);
    const r = await recordsOutside(leadReports, [{ g: SOURCE, value: labelOf(busiest), code: await selectedCode(leadReports, SOURCE), leads: num(busiest['Leads']), captured: lc }]);
    expect.soft(r.outside.filter(x => x.endsWith('(blank)')).slice(0, 10), `Leads with a blank Source under ${labelOf(busiest)}`).toEqual([]);
  });

  test(...lr('LR-155'), async ({ leadReports }) => {
    test.setTimeout(240_000);
    await leadReports.openWith('last_12_months');
    const applied = await narrow(leadReports, [SOURCE, PROJECT]);
    test.skip(!applied.length, 'No filter value with leads');
    await leadReports.openTab('Overview & Funnel');
    const k = await leadReports.kpis(leadReports.kpiLabels);
    note('values', `${describeApplied(applied)} | ${JSON.stringify(k)}`);
    for (const tab of leadReports.tabs.map(t => t.name)) {
      await leadReports.openTab(tab);
      for (const a of applied) expect.soft(await selected(leadReports, a.g), `${tab}: "${a.g.name}" still ${a.value}`).toBe(a.value);
      if (tab === 'Source & Channel') {
        await leadReports.groupBy('Lead Source');
        expect.soft(num((await leadReports.breakdown.total())?.['Leads'] ?? ''), 'Source & Channel Total = Leads Captured').toBe(k['Leads Captured']);
      }
      if (tab === 'Aging & Follow-up') expect.soft(await leadReports.kpi('Open Leads'), 'Aging Open Leads = Open Leads Now').toBe(k['Open Leads Now']);
      if (tab === 'Salesperson Scorecard') {
        const rows = await leadReports.scorecard.rows();
        expect.soft(sum(rows.map(r => num(r['Leads']))), 'Scorecard Leads = Leads Captured').toBe(k['Leads Captured']);
        expect.soft(sum(rows.map(r => num(r['Open Now']))), 'Scorecard Open Now = Open Leads Now').toBe(k['Open Leads Now']);
      }
    }
    await leadReports.openTab('Overview & Funnel');
    expect.soft(await leadReports.kpis(leadReports.kpiLabels), 'KPI cards unchanged after visiting every tab').toEqual(k);
  });

  test(...lr('LR-156'), async ({ leadReports, page }) => {
    test.setTimeout(180_000);
    const optionsResponse = page.waitForResponse(r => r.url().includes('/reports/leads/options'), { timeout: 30_000 });
    await leadReports.openWith('last_12_months');
    const api = await (await optionsResponse).json() as Record<string, { label: string }[]>;
    await leadReports.openTab('Source & Channel');
    for (const g of GROUPINGS) {
      const options = await leadReports.filterOptions(g.filter);
      const fromApi = (api[API_KEY[g.dimension]] ?? []).map(o => String(o.label).trim());
      expect.soft(options, `${g.name}: dropdown = options API (${API_KEY[g.dimension]})`).toEqual(fromApi);
      expect.soft(options.filter((o, i) => options.indexOf(o) !== i), `${g.name}: duplicate labels`).toEqual([]);
      expect.soft(options.filter(o => !o.trim()), `${g.name}: blank labels`).toEqual([]);
      await leadReports.groupBy(g.name);
      const missing = (await leadReports.breakdown.rows())
        .filter(r => num(r['Leads']) > 0 && !isTotalOrUnspecified(labelOf(r)) && !options.includes(labelOf(r)))
        .map(r => `${labelOf(r)} (${num(r['Leads'])} leads)`);
      note(g.name, `${options.length} options${missing.length ? ` | not selectable: ${missing.join(', ')}` : ''}`);
      expect.soft(missing, `${g.name}: values with leads that cannot be selected`).toEqual([]);
    }
  });
});
