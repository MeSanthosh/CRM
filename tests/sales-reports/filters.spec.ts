/** Sales Reports workbook — Period filter (SR-017…028), Dropdown filters (SR-029…050), Reset filters (SR-051…053). */
import { test, expect, note } from '../pages/fixtures';
import { num } from '../helpers';
import * as check from '../modules/checks';
import { PERIODS } from '../pages/ReportModulePage';
import { SalesReportsPage, SALES_FILTERS, SALES_PERIOD_LABEL, OPEN_KPIS, Row } from '../pages/SalesReportsPage';
import { sr } from './catalog';
import { BAD, DASH, previousMonth, futureRange, filterToSalesperson } from './shared';

const PERIOD_LABELS = ['This month', 'Last month', 'This quarter', 'Last quarter', 'Year to date', 'Last 12 months', 'Custom dates'];
const ADDITIVE = ['Open opportunities', 'Pipeline value', 'Weighted pipeline', 'Won in period', 'Won value', 'Past expected close'];
/** Query parameter each filter sends to /reports/business/sales. */
const PARAM: Record<string, string> = { Project: 'projectCode', Salesperson: 'ownerUserId', Broker: 'brokerId', Campaign: 'campaignId' };
/** Workbook IDs per dropdown: [label & default, options, narrows]. */
const DROPDOWN_CASES: Record<string, [string, string, string]> = {
  Project: ['SR-029', 'SR-030', 'SR-031'], Salesperson: ['SR-032', 'SR-033', 'SR-034'],
  Broker: ['SR-035', 'SR-036', 'SR-037'], Campaign: ['SR-038', 'SR-039', 'SR-040'],
};

async function additive(sales: SalesReportsPage) {
  const out: Record<string, number> = {};
  for (const k of ADDITIVE) out[k] = await sales.kpi(k);
  return out;
}
function expectNarrower(narrow: Record<string, number>, wide: Record<string, number>, what: string) {
  for (const k of ADDITIVE) expect.soft(narrow[k], `${k}: ${what} ≤ unfiltered`).toBeLessThanOrEqual(wide[k] * 1.005);
}
const label = (r: Row) => Object.values(r)[0];
/** A salesperson row with open opportunities, preferring one that is not the biggest (so the filter visibly narrows). */
const salespersonWithOpen = (rows: Row[]) => rows.filter(r => num(r['Open']) > 0).slice(-1)[0];

/** Rows of another report's table, without total / placeholder rows (the name may sit after a code column). */
async function rowsOn(page: { open(): Promise<void>; table(h: string): { rows(): Promise<Row[]> } }, heading: string) {
  await page.open();
  return (await page.table(heading).rows()).filter(r => label(r) && !/^(total|direct|unspecified|unassigned|—)$/i.test(label(r)));
}

test.describe('Sales Reports · Period filter', () => {
  test(...sr('SR-017'), async ({ sales }) => {
    await sales.open();
    expect.soft(await sales.filterLabels(), 'Period label').toContain(SALES_PERIOD_LABEL);
    const options = await sales.options(sales.filterByLabel(SALES_PERIOD_LABEL));
    expect.soft(options.map(o => o.label), 'Option labels in order').toEqual(PERIOD_LABELS);
    expect(options.map(o => o.value), 'Option values').toEqual([...PERIODS]);
  });

  test(...sr('SR-018'), async ({ sales }) => {
    await sales.open();
    expect(await sales.period(), 'Default period').toBe('this_month');
  });

  test(...sr('SR-019'), async ({ sales }) => {
    await check.periodsReload(sales);
    for (const k of sales.kpiLabels) expect.soft(await sales.kpiShown(k), `Last period › ${k}`).not.toMatch(BAD);
  });

  test(...sr('SR-020'), async ({ sales }) => {
    await sales.openWith('last_12_months');
    const before = await sales.snapshot();
    await sales.setPeriod('this_month');
    const after = await sales.snapshot();
    for (const k of OPEN_KPIS) expect.soft(after.kpis[k], `${k} does not follow the period`).toBe(before.kpis[k]);
    expect.soft(after.stage, 'Open Pipeline by Stage does not follow the period').toEqual(before.stage);
    expect.soft(after.opportunities.map(r => r['Opportunity']), 'Open Opportunities list does not follow the period').toEqual(before.opportunities.map(r => r['Opportunity']));
    for (const r of before.salesperson.filter(x => num(x['Open']) > 0)) {
      const now = after.salesperson.find(x => x['Salesperson'] === r['Salesperson'] && x['Open'] === r['Open']);
      expect.soft(now && [now['Pipeline (USD)'], now['Weighted (USD)']], `${r['Salesperson']}: Open / Pipeline / Weighted unchanged`).toEqual([r['Pipeline (USD)'], r['Weighted (USD)']]);
    }
    expect.soft(num(after.kpis['Won in period']), 'Won in period: This month ≤ Last 12 months').toBeLessThanOrEqual(num(before.kpis['Won in period']));
    expect.soft(num(after.kpis['Won value']), 'Won value: This month ≤ Last 12 months').toBeLessThanOrEqual(num(before.kpis['Won value']) * 1.005);
    note('won / lost', `Last 12 months ${JSON.stringify(before.kpis)} → This month ${JSON.stringify(after.kpis)}`);
  });

  test(...sr('SR-021'), async ({ sales }) => {
    await sales.openWith('last_12_months');
    await expect(sales.fromInput, 'No From field before Custom dates').toHaveCount(0);
    await sales.setPeriod('custom');
    await expect(sales.fromInput).toBeVisible();
    await expect(sales.toInput).toBeVisible();
    await sales.setPeriod('last_month');
    await expect(sales.fromInput, 'From hidden again').toHaveCount(0);
    await expect(sales.toInput, 'To hidden again').toHaveCount(0);
    expect.soft(await sales.kpiText(sales.mainKpi)).not.toMatch(BAD);
  });

  test(...sr('SR-022'), async ({ sales }) => {
    const [from, to] = previousMonth();
    await sales.open();
    await sales.setCustomRange(from, to); // waits for the request carrying both dates
    for (const k of sales.kpiLabels) expect.soft(await sales.kpiShown(k), k).not.toMatch(BAD);
    note('range', `${from} → ${to}: Won ${await sales.kpiShown('Won in period')}, Won value ${await sales.kpiShown('Won value')}`);
    await sales.expectNoBrokenValues();
  });

  test(...sr('SR-023'), async ({ sales, page }) => {
    const [from, to] = previousMonth();
    await sales.open();
    await sales.setPeriod('custom');
    const sent: string[] = [];
    page.on('request', r => { if (r.url().includes('period=custom')) sent.push(r.url()); });
    await sales.fromInput.fill(to);
    await sales.toInput.fill(from);
    await page.waitForLoadState('networkidle').catch(() => {});
    const invalid = sent.filter(u => (u.match(/from=([\d-]+)/)?.[1] ?? '') > (u.match(/to=([\d-]+)/)?.[1] ?? '~'));
    expect.soft(invalid, 'No request with From after To').toEqual([]);
    // look only in the filter bar: the page banner also contains "before"
    const filterBar = page.locator(`xpath=//main//section[contains(@class,'crm-panel')][.//select]`).first();
    await expect(filterBar.getByText(/before|after|invalid|must be|cannot be|earlier|later/i).first(), 'Validation message').toBeVisible({ timeout: 5_000 });
  });

  test(...sr('SR-024'), async ({ sales, page }) => {
    const [from] = previousMonth();
    await sales.openWith('last_12_months');
    await sales.setPeriod('custom');
    const before = await sales.kpiShown(sales.mainKpi);
    const sent: string[] = [];
    page.on('request', r => { if (r.url().includes('period=custom')) sent.push(r.url()); });
    await sales.fromInput.fill(from);
    await page.waitForTimeout(1_500);
    expect.soft(sent.filter(u => !/[?&]to=\d/.test(u)), 'No request with only From').toEqual([]);
    expect.soft(await sales.kpiShown(sales.mainKpi), 'Figures unchanged').toBe(before);
    await sales.expectNoBrokenValues();
  });

  for (const [id, range, what] of [['SR-025', futureRange(), 'future range'], ['SR-026', ['2000-01-01', '2000-01-31'] as [string, string], 'range with no data']] as const) {
    test(...sr(id), async ({ sales }) => {
      await sales.openWith('last_12_months');
      const open: Record<string, string> = {};
      for (const k of OPEN_KPIS) open[k] = await sales.kpiShown(k);
      const stage = await sales.stageRows();
      await sales.setCustomRange(range[0], range[1]);
      note(what, `${range[0]} → ${range[1]}`);
      expect.soft(await sales.kpiShown('Won in period'), 'Won in period').toBe('0');
      expect.soft(num(await sales.kpiShown('Won value')), 'Won value').toBe(0);
      expect.soft(await sales.kpiShown('Win rate'), 'Win rate').toMatch(DASH);
      expect.soft(await sales.kpiShown('Average days to win'), 'Average days to win').toMatch(DASH);
      for (const r of await sales.salespersonRows()) {
        expect.soft([r['Won'], r['Lost']], `${r['Salesperson']}: Won / Lost`).toEqual(['0', '0']);
        expect.soft(r['Win %'], `${r['Salesperson']}: Win %`).toMatch(DASH);
      }
      for (const k of OPEN_KPIS) expect.soft(await sales.kpiShown(k), `${k} unchanged`).toBe(open[k]);
      expect.soft(await sales.stageRows(), 'Stage table unchanged').toEqual(stage);
      await sales.expectNoBrokenValues(what);
    });
  }

  test(...sr('SR-027'), async ({ sales }) => {
    // A deal won on the split day is counted twice or not at all unless both ends of a range are inclusive.
    const [from, to] = previousMonth();
    const mid = `${from.slice(0, 8)}15`;
    const next = `${from.slice(0, 8)}16`;
    const won: Record<string, number> = {};
    await sales.open();
    for (const [a, b] of [[from, to], [from, mid], [next, to]]) {
      await sales.setCustomRange(a, b);
      won[`${a}→${b}`] = num(await sales.kpiShown('Won in period'));
    }
    await sales.setPeriod('last_month');
    const preset = num(await sales.kpiShown('Won in period'));
    note('Won in period', `${JSON.stringify(won)} | Last month preset ${preset}`);
    expect.soft(won[`${from}→${mid}`] + won[`${next}→${to}`], 'Halves add up to the month').toBe(won[`${from}→${to}`]);
    expect.soft(won[`${from}→${to}`], 'Custom month (last day included) = Last month').toBe(preset);
  });

  test(...sr('SR-028'), async ({ sales, page }) => {
    await sales.openWith('last_12_months');
    const select = sales.filterByLabel(SALES_PERIOD_LABEL);
    await select.focus();
    await expect(select, 'Focus on the period dropdown').toBeFocused();
    const req = page.waitForRequest(r => r.url().includes('period=ytd'), { timeout: 10_000 });
    await page.keyboard.press('ArrowUp'); // Last 12 months → Year to date
    await req;
    expect(await sales.period()).toBe('ytd');
    expect.soft(await sales.kpiText(sales.mainKpi)).not.toMatch(BAD);
  });
});

test.describe('Sales Reports · Dropdown filters', () => {
  for (const [name, all] of Object.entries(SALES_FILTERS)) {
    const [idDefault, idOptions, idNarrows] = DROPDOWN_CASES[name];

    test(...sr(idDefault), async ({ sales }) => {
      await sales.open();
      const select = sales.filterByLabel(name);
      await expect(select, `Dropdown labelled "${name}"`).toBeVisible();
      const options = await sales.options(select);
      expect.soft(options[0]?.label, 'First option').toBe(all);
      expect.soft(await select.inputValue(), `"${all}" selected`).toBe(options[0]?.value);
    });

    test(...sr(idOptions), async ({ sales, inventory, brokers, marketing }) => {
      await sales.openWith('last_12_months');
      const options = (await sales.options(sales.filterByLabel(name))).slice(1);
      note('options', options.map(o => o.label).join(' | '));
      expect.soft(options.length, 'Has options').toBeGreaterThan(0);
      expect.soft(options.filter(o => BAD.test(o.label) || !o.value), 'No blank / undefined options').toEqual([]);
      expect.soft(options.filter((o, i, a) => a.findIndex(x => x.value === o.value) !== i), 'No repeated entries').toEqual([]);
      const labels = options.map(o => o.label);
      expect.soft(labels, 'Sorted A→Z').toEqual([...labels].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
      const known = new Set([...labels, ...options.map(o => o.value)].map(s => s.toLowerCase()));
      const source = name === 'Salesperson' ? (await sales.salespersonRows()).map(r => ({ Salesperson: r['Salesperson'] }))
        : name === 'Project' ? await rowsOn(inventory, 'Inventory by Project')
        : name === 'Broker' ? await rowsOn(brokers, 'Broker Performance')
        : await rowsOn(marketing, 'Campaign Performance');
      note('source', source.map(r => Object.values(r).slice(0, 2).join(' ')).join(' | '));
      // a source row is offered when any of its cells (code or name) is an option label or value
      const missing = source.filter(r => !Object.values(r).some(v => known.has(String(v).trim().toLowerCase()))).map(r => Object.values(r).slice(0, 2).join(' '));
      expect.soft(missing, 'Every source entry is offered').toEqual([]);
    });

    test(...sr(idNarrows), async ({ sales, page }) => {
      await sales.openWith('last_12_months');
      const unfiltered = await additive(sales);
      const req = page.waitForRequest(r => r.url().includes(`${PARAM[name]}=`), { timeout: 10_000 }).catch(() => null);
      let chosen: string;
      if (name === 'Salesperson') {
        const row = salespersonWithOpen(await sales.salespersonRows());
        test.skip(!row, 'No salesperson has open opportunities');
        chosen = row['Salesperson'];
        expect(await filterToSalesperson(sales, row), `Option for ${chosen}`).toBeTruthy();
      } else {
        const option = (await sales.options(sales.filterSelect(all)))[1];
        chosen = option.label;
        await sales.setFilterValue(all, option.value);
      }
      expect.soft(await req, `Request carries ${PARAM[name]}`).toBeTruthy();
      const filtered = await additive(sales);
      note(name, `${chosen}: ${JSON.stringify(filtered)} | unfiltered ${JSON.stringify(unfiltered)}`);
      expectNarrower(filtered, unfiltered, chosen);
      const rows = await sales.opportunityRows();
      expect.soft(rows.length, 'List rows = Open opportunities').toBe(filtered['Open opportunities']);
      if (name === 'Salesperson') {
        expect.soft(rows.filter(r => r['Salesperson'] !== chosen).map(r => r['Opportunity']), `Every row belongs to ${chosen}`).toEqual([]);
        expect.soft([...new Set((await sales.salespersonRows()).map(r => r['Salesperson']))], 'Salesperson Pipeline').toEqual([chosen]);
      }
      if (name === 'Project' && rows.length) {
        await sales.expectNoBrokenValues(chosen);
        // opening a record leaves the report (/opportunities), so only the first row is checked
        const code = await sales.filterSelect(all).inputValue();
        await sales.openOpportunity(rows[0]['Opportunity']);
        expect.soft((await sales.readDetail()).project, `${rows[0]['Opportunity']} project`).toBe(code);
        return;
      }
      await sales.expectNoBrokenValues(chosen);
    });
  }

  test(...sr('SR-041'), async ({ sales }) => {
    await sales.open();
    const labels = (await sales.options(sales.filterByLabel('Salesperson'))).slice(1).map(o => o.label);
    const repeated = [...new Set(labels.filter((l, i) => labels.indexOf(l) !== i))];
    note('options', labels.join(' | '));
    expect(repeated, 'Salesperson options that look the same').toEqual([]);
  });

  test(...sr('SR-042'), async ({ sales }) => {
    await sales.openWith('last_12_months');
    const row = (await sales.salespersonRows()).find(r => num(r['Open']) === 0 && num(r['Won']) > 0);
    test.skip(!row, 'No salesperson with only won deals in the last 12 months');
    expect(await filterToSalesperson(sales, row!), `Option for ${row!['Salesperson']}`).toBeTruthy();
    note('row', JSON.stringify(row));
    expect.soft(await sales.kpi('Open opportunities'), 'Open opportunities').toBe(0);
    expect.soft(await sales.kpi('Pipeline value'), 'Pipeline value').toBe(0);
    expect.soft(await sales.kpi('Weighted pipeline'), 'Weighted pipeline').toBe(0);
    expect.soft(await sales.kpi('Past expected close'), 'Past expected close').toBe(0);
    await expect.soft(sales.emptyMessage('Open Pipeline by Stage'), 'Stage table empty-state').toBeVisible();
    await expect.soft(sales.emptyMessage('Open Opportunities'), 'Open Opportunities empty-state').toBeVisible();
    expect.soft(await sales.kpiShown('Won in period'), 'Won in period = row').toBe(row!['Won']);
    expect.soft(await sales.kpiShown('Won value'), 'Won value = row').toBe(row!['Won Value (USD)']);
    expect.soft(await sales.kpiShown('Win rate'), 'Win rate = row').toBe(row!['Win %']);
  });

  test(...sr('SR-043'), async ({ sales }) => {
    await sales.openWith('last_12_months');
    const all = SALES_FILTERS.Project;
    let empty: string | undefined;
    for (const o of (await sales.options(sales.filterSelect(all))).slice(1)) {
      await sales.setFilterValue(all, o.value);
      if ((await sales.kpiShown('Open opportunities')) === '0' && (await sales.kpiShown('Won in period')) === '0') { empty = o.label; break; }
    }
    test.skip(!empty, 'Every project has opportunities');
    note('project', empty!);
    for (const k of ['Open opportunities', 'Won in period', 'Past expected close']) expect.soft(await sales.kpiShown(k), k).toBe('0');
    for (const k of ['Pipeline value', 'Weighted pipeline', 'Won value']) expect.soft(num(await sales.kpiShown(k)), k).toBe(0);
    for (const k of ['Win rate', 'Average days to win']) expect.soft(await sales.kpiShown(k), k).toMatch(DASH);
    for (const t of sales.tableHeadings) await expect.soft(sales.emptyMessage(t), `${t} empty-state message`).toBeVisible();
    await sales.expectNoBrokenValues();
  });

  test(...sr('SR-044'), async ({ sales }) => {
    await sales.openWith('last_12_months');
    const row = salespersonWithOpen(await sales.salespersonRows());
    test.skip(!row, 'No salesperson has open opportunities');
    const project = (await sales.options(sales.filterSelect(SALES_FILTERS.Project)))[1];
    await sales.setFilterValue(SALES_FILTERS.Project, project.value);
    const byProject = await additive(sales);
    await sales.setFilterValue(SALES_FILTERS.Project, '');
    await filterToSalesperson(sales, row);
    const bySalesperson = await additive(sales);
    await sales.setFilterValue(SALES_FILTERS.Project, project.value);
    const both = await additive(sales);
    note('KPIs', `project ${JSON.stringify(byProject)} | salesperson ${JSON.stringify(bySalesperson)} | both ${JSON.stringify(both)}`);
    expectNarrower(both, byProject, 'both filters vs project alone');
    expectNarrower(both, bySalesperson, 'both filters vs salesperson alone');
    expect.soft((await sales.opportunityRows()).filter(r => r['Salesperson'] !== row['Salesperson']).map(r => r['Opportunity']), 'Rows match the salesperson').toEqual([]);
  });

  test(...sr('SR-045'), async ({ sales }) => {
    sales.watchErrors();
    await sales.open();
    const defaultPeriod = await sales.period();
    await sales.setPeriod('this_quarter');
    for (const all of sales.filters) await sales.setFilterValue(all, (await sales.options(sales.filterSelect(all)))[1].value);
    await sales.setView('Mine');
    for (const k of sales.kpiLabels) expect.soft(await sales.kpiShown(k), k).not.toMatch(BAD);
    await sales.expectNoBrokenValues('every filter');
    await sales.resetFilters();
    expect.soft(await sales.period(), 'Period after Reset').toBe(defaultPeriod);
    // "Mine" hides the Salesperson dropdown, so only the dropdowns on screen are checked
    const shown = [];
    for (const all of sales.filters) if (await sales.filterSelect(all).count()) shown.push(all);
    note('dropdowns in Mine view', shown.join(', '));
    for (const all of shown) expect.soft(await sales.filterSelect(all).inputValue(), `"${all}" after Reset`).toBe('');
    sales.expectNoErrors();
  });

  test(...sr('SR-046'), async ({ sales, page }) => {
    await sales.openWith('last_12_months');
    const all = SALES_FILTERS.Salesperson;
    const options = await sales.options(sales.filterSelect(all));
    const rows = (await sales.salespersonRows()).filter(r => options.filter(o => o.label === r['Salesperson']).length === 1);
    const target = rows.filter(r => num(r['Open']) > 0).slice(-1)[0];
    test.skip(!target, 'No salesperson with a unique name and open opportunities');
    const value = options.find(o => o.label === target['Salesperson'])!.value;
    const others = options.slice(1).filter(o => o.value !== value).slice(0, 4);
    for (const o of [...others, { value }]) await sales.filterSelect(all).selectOption(o.value); // no waiting in between
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1_500);
    note('target', JSON.stringify(target));
    expect.soft(await sales.kpiShown('Open opportunities'), 'Open opportunities of the last selection').toBe(target['Open']);
    expect.soft(await sales.kpiShown('Won in period'), 'Won in period of the last selection').toBe(target['Won']);
    expect.soft([...new Set((await sales.salespersonRows()).map(r => r['Salesperson']))], 'Salesperson Pipeline').toEqual([target['Salesperson']]);
  });

  test(...sr('SR-047'), async ({ sales, page }) => {
    await sales.open();
    const defaultPeriod = await sales.period();
    const defaults = await sales.snapshot();
    await sales.setFilterValue(SALES_FILTERS.Project, (await sales.options(sales.filterSelect(SALES_FILTERS.Project)))[1].value);
    await sales.setPeriod(defaultPeriod === 'last_month' ? 'this_month' : 'last_month');
    await page.reload();
    await page.waitForLoadState('networkidle').catch(() => {});
    expect.soft(await sales.period(), 'Period after reload').toBe(defaultPeriod);
    for (const all of sales.filters) expect.soft(await sales.filterSelect(all).inputValue(), `"${all}" after reload`).toBe('');
    expect.soft((await sales.snapshot()).kpis, 'Figures match the defaults').toEqual(defaults.kpis);
  });

  test(...sr('SR-048'), async ({ sales, inventory }) => {
    await sales.openWith('last_12_months');
    const row = salespersonWithOpen(await sales.salespersonRows());
    test.skip(!row, 'No salesperson has open opportunities');
    await filterToSalesperson(sales, row);
    await sales.tab('Inventory').click();
    await inventory.page.waitForLoadState('networkidle').catch(() => {});
    await inventory.tab('Sales').click();
    await sales.page.waitForLoadState('networkidle').catch(() => {});
    const kept = (await sales.filterSelect(SALES_FILTERS.Salesperson).inputValue()) !== '';
    note('behaviour', kept ? 'Salesperson filter kept' : 'Filters reset to defaults');
    const shown = [...new Set((await sales.salespersonRows()).map(r => r['Salesperson']))];
    if (kept) expect.soft(shown, 'Figures follow the kept filter').toEqual([row['Salesperson']]);
    else expect.soft(shown.length, 'Figures are unfiltered').toBeGreaterThanOrEqual(1);
    expect.soft(await sales.kpi('Open opportunities'), 'Open opportunities = rows listed').toBe((await sales.opportunityRows()).length);
  });

  test(...sr('SR-049'), async ({ sales, page }) => {
    await sales.open();
    const clipped = await page.locator('main label.crm-field select').evaluateAll(ss => ss.flatMap(s => {
      const sel = s as HTMLSelectElement;
      const ctx = document.createElement('canvas').getContext('2d')!;
      const cs = getComputedStyle(sel);
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const room = sel.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const longest = [...sel.options].map(o => o.text).sort((a, b) => ctx.measureText(b).width - ctx.measureText(a).width)[0] ?? '';
      return ctx.measureText(longest).width > room && !sel.title ? [`"${longest}" (${Math.round(ctx.measureText(longest).width)}px > ${Math.round(room)}px)`] : [];
    }));
    expect.soft(clipped, 'Longest options fit their dropdown (or have a tooltip)').toEqual([]);
  });

  test(...sr('SR-050'), async ({ sales, page }) => {
    await sales.openWith('last_12_months');
    for (const name of [SALES_PERIOD_LABEL, ...Object.keys(SALES_FILTERS)]) {
      await expect.soft(page.getByRole('combobox', { name: new RegExp(`^${name.replace(/[()]/g, '\\$&')}`) }), `Combobox named "${name}"`).toHaveCount(1);
    }
    const project = sales.filterByLabel('Project');
    await project.focus();
    const req = page.waitForRequest(r => r.url().includes('projectCode='), { timeout: 10_000 });
    await page.keyboard.press('ArrowDown');
    await req;
    expect(await project.inputValue(), 'Arrow key selects the next project').not.toBe('');
  });
});

test.describe('Sales Reports · Reset filters', () => {
  test(...sr('SR-051'), async ({ sales }) => {
    await sales.open();
    await expect(sales.resetButton).toBeDisabled();
  });

  test(...sr('SR-052'), async ({ sales }) => {
    await sales.open();
    const period = await sales.period();
    const before = await sales.snapshot();
    const [from, to] = previousMonth();
    await sales.setCustomRange(from, to);
    for (const all of sales.filters) await sales.setFilterValue(all, (await sales.options(sales.filterSelect(all)))[1].value);
    await expect(sales.resetButton, 'Reset enabled after changes').toBeEnabled();
    await sales.resetFilters();
    expect.soft(await sales.period(), 'Period back to default').toBe(period);
    await expect.soft(sales.fromInput, 'From / To hidden').toHaveCount(0);
    for (const all of sales.filters) expect.soft(await sales.filterSelect(all).inputValue(), `"${all}" back to All`).toBe('');
    expect.soft((await sales.snapshot()).kpis, 'KPIs back to the original values').toEqual(before.kpis);
    await expect.soft(sales.resetButton, 'Disabled again').toBeDisabled();
  });

  test(...sr('SR-053'), async ({ sales }) => {
    await sales.open();
    await sales.setView('Mine');
    await sales.setFilterValue(SALES_FILTERS.Project, (await sales.options(sales.filterSelect(SALES_FILTERS.Project)))[1].value);
    await sales.resetFilters();
    expect.soft(await sales.filterSelect(SALES_FILTERS.Project).inputValue(), 'Project back to All').toBe('');
    await expect(sales.viewButton('Mine'), 'View stays on Mine').toHaveClass(/is-active/);
  });
});
