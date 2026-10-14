/**
 * Checks every report module page gets. Each page's spec calls them under its own test IDs
 * (e.g. SAL-04 → periodsReload(sales)), so the Excel report and `--grep` stay page by page.
 */
import { expect } from '@playwright/test';
import { note } from '../pages/fixtures';
import { BasePage } from '../pages/BasePage';
import { ReportsHubPage } from '../pages/ReportsHubPage';
import { ReportModulePage, PERIODS, Period } from '../pages/ReportModulePage';
import { ReportTable } from '../pages/ReportTable';
import { expectNear } from '../helpers';

const BAD = /NaN|undefined|Infinity|^\s*$/;
/** Lists on screen that are cut at this many rows (the export then has more). */
const CAPPED = [100, 200];

/** The module's card on the hub shows its name, LIVE, a description and "Open module →", and opens the page. */
export async function opensFromHub(hub: ReportsHubPage, module: BasePage, heading = module.name) {
  await hub.open();
  const card = await hub.readCard(module.path);
  note('card', `${card.name} [${card.status}] ${card.description}`);
  expect.soft(card.name, 'Card title').toBe(module.name);
  expect.soft(card.status, 'Card status').toBe('LIVE');
  expect.soft(card.description, 'Card description').not.toBe('');
  expect.soft(card.openText, 'Card link text').toBe('Open module →');
  module.watchErrors();
  await hub.openModule(module.path);
  await expect(module.heading(heading), 'Page heading').toBeVisible();
  module.expectNoErrors();
}

/** Every KPI card shows a valid, non-negative value; percentages stay within a sane range. */
export async function kpisValid(module: ReportModulePage, period: Period = 'last_12_months') {
  await module.openWith(period);
  const shown: string[] = [];
  for (const label of module.kpiLabels) {
    const text = await module.kpiText(label);
    shown.push(`${label}: ${text}`);
    expect.soft(text, `${label} text`).not.toMatch(BAD);
    const v = await module.kpi(label);
    expect.soft(v, `${label} ≥ 0`).toBeGreaterThanOrEqual(0);
    if (text.includes('%')) expect.soft(v, `${label} is a sane %`).toBeLessThanOrEqual(100_000);
  }
  note('KPIs', shown.join(' | '));
}

/** Every table renders with headers; no broken values, JavaScript errors or failed API calls. */
export async function tablesRender(module: ReportModulePage) {
  module.watchErrors();
  await module.open();
  const rows: string[] = [];
  for (const heading of module.tableHeadings) {
    const table = module.table(heading);
    expect.soft((await table.headers()).length, `${heading} has column headers`).toBeGreaterThan(0);
    rows.push(`${heading}: ${await table.rowCount()} rows`);
  }
  note('tables', rows.join(' | '));
  await module.expectNoBrokenValues();
  module.expectNoErrors();
}

/** The period dropdown offers every period, and each one reloads the KPIs with valid values. */
export async function periodsReload(module: ReportModulePage) {
  await module.open();
  expect.soft(await module.periodOptions(), 'Period options').toEqual([...PERIODS]);
  for (const period of PERIODS.filter(p => p !== 'custom')) {
    await module.setPeriod(period);
    expect.soft(await module.period(), `${period} selected`).toBe(period);
    expect.soft(await module.kpiText(module.mainKpi), `${period}: ${module.mainKpi}`).not.toMatch(BAD);
    await module.expectNoBrokenValues(`${module.name} (${period})`);
  }
}

/** The page opens on "This month", like the hub and dashboard (workbook RA-013). */
export async function opensOnThisMonth(module: ReportModulePage) {
  await module.open();
  expect(await module.period(), 'Default period').toBe('this_month');
}

/** Custom dates reload the page for that range; a range with no data shows 0, not NaN or blanks. */
export async function customRange(module: ReportModulePage) {
  await module.open();
  await module.setCustomRange('2026-09-01', '2026-09-30');
  expect.soft(await module.kpiText(module.mainKpi), `${module.mainKpi} for September`).not.toMatch(BAD);
  await module.expectNoBrokenValues(`${module.name} (custom range)`);
  await module.setCustomRange('2000-01-01', '2000-01-31');
  await module.expectNoBrokenValues(`${module.name} (empty range)`);
  // some KPIs don't depend on the period (e.g. Open opportunities), so only check the value is readable
  note('empty range', `${module.mainKpi} = ${(await module.kpiValue(module.mainKpi).innerText()).trim()}`);
}

/** Each filter dropdown has options, and picking one can only narrow the main KPI. */
export async function filtersNarrow(module: ReportModulePage) {
  await module.openWith();
  const all = await module.kpi(module.mainKpi);
  const seen: string[] = [`All: ${all}`];
  for (const filter of module.filters) {
    const options = await module.filterOptions(filter);
    expect.soft(options.length, `"${filter}" has options`).toBeGreaterThan(0);
    if (!options.length) continue;
    await module.setFilter(filter, options[0]);
    const v = await module.kpi(module.mainKpi);
    seen.push(`${options[0]}: ${v}`);
    expect.soft(v, `${module.mainKpi} with "${options[0]}" ≤ all`).toBeLessThanOrEqual(all);
    await module.expectNoBrokenValues(`${module.name} (${options[0]})`);
    await module.filterSelect(filter).selectOption({ index: 0 });
    await module.page.waitForLoadState('networkidle').catch(() => {});
  }
  note(module.mainKpi, seen.join(' | '));
}

/** All ≥ You and your team ≥ Mine for the main KPI. */
export async function viewsNarrow(module: ReportModulePage) {
  await module.openWith();
  const values: Record<string, number> = {};
  for (const view of ['All', 'You and your team', 'Mine'] as const) {
    await module.setView(view);
    values[view] = await module.kpi(module.mainKpi);
  }
  note(module.mainKpi, JSON.stringify(values));
  expect.soft(values['You and your team'], 'Team ≤ All').toBeLessThanOrEqual(values['All']);
  expect.soft(values['Mine'], 'Mine ≤ Team').toBeLessThanOrEqual(values['You and your team']);
}

/** Reset filters puts the period and every filter back to the defaults and restores the values. */
export async function resetRestores(module: ReportModulePage) {
  await module.open();
  const period = await module.period();
  const before = await module.kpi(module.mainKpi);
  await expect.soft(module.resetButton, 'Reset is disabled while nothing is changed').toBeDisabled();
  await module.setPeriod(period === 'last_month' ? 'this_month' : 'last_month');
  await module.setFilter(module.filters[0], (await module.filterOptions(module.filters[0]))[0]);
  await module.resetFilters();
  expect.soft(await module.period(), 'Period after reset').toBe(period);
  for (const f of module.filters) expect.soft(await module.filterSelect(f).inputValue(), `"${f}" after reset`).toBe('');
  expect.soft(await module.kpi(module.mainKpi), `${module.mainKpi} after reset`).toBe(before);
}

/** Every panel's Export downloads an .xlsx with the same rows as the table (capped lists: at least as many). */
export async function exportsMatchTables(module: ReportModulePage) {
  await module.openWith();
  for (const heading of module.tableHeadings) {
    const table = module.table(heading);
    const rows = await table.rowCount();
    const sheet = await table.export();
    expect.soft(sheet.name, `${heading} file`).toMatch(/\.xlsx$/i);
    if (module.expandedInExport.includes(heading)) {
      expect.soft(sheet.rows.length, `${heading}: export lists at least the rows on screen`).toBeGreaterThanOrEqual(rows);
      continue;
    }
    expect.soft(sheet.header, `${heading} columns`).toEqual(await table.headers());
    if (CAPPED.includes(rows)) expect.soft(sheet.rows.length, `${heading}: export ≥ capped table`).toBeGreaterThanOrEqual(rows);
    else expect.soft(sheet.rows.length, `${heading}: exported rows = table rows`).toBe(rows);
  }
}

/** The module tab bar marks this module and switches to another; the breadcrumb returns to the hub. */
export async function navigation(module: ReportModulePage, other: ReportModulePage) {
  await module.open();
  if (module.tabLabel) {
    await expect.soft(module.tab(module.tabLabel), 'Own tab is active').toHaveClass(/is-active/);
    await module.tab(other.tabLabel!).click();
    await expect.soft(module.page, `${other.tabLabel} tab opens ${other.path}`).toHaveURL(new RegExp(`${other.path}(\\?.*)?$`));
    await module.open();
  }
  await module.backToHub();
}

/** Expected-result wording for the common checks (shown in the Excel report). */
export const EXPECT = {
  opensFromHub: 'The hub card shows the module name, LIVE, a description and "Open module →"; clicking it opens the page with its heading and no errors',
  kpisValid: 'Every KPI card shows a valid, non-negative value (no blank, "—", NaN or negative); percentages are sane',
  tablesRender: 'Every table shows its column headers; no NaN / undefined, no JavaScript errors and no failed API calls',
  periodsReload: 'The period dropdown lists This month … Last 12 months and Custom dates; each period reloads valid values',
  opensOnThisMonth: 'The page opens with the period set to "This month" (same as the hub and dashboard)',
  customRange: 'Custom dates (From / To) reload the report for that range; a range with no data shows no NaN or blanks',
  filtersNarrow: 'Each filter dropdown has options; picking one can only lower or keep the main KPI, never raise it',
  viewsNarrow: 'Main KPI: All ≥ You and your team ≥ Mine',
  resetRestores: 'Reset filters is disabled until something changes, then puts the period and filters back and restores the values',
  exportsMatchTables: 'Each panel Export downloads an .xlsx with the table\'s columns and the same number of rows',
  navigation: 'The module tab bar highlights this module and switches to another; the "Reports & Analytics" breadcrumb returns to the hub',
};

/** A KPI equals the sum of a table column: exactly for counts, within `rel` for rounded amounts. */
export async function kpiEqualsColumn(module: ReportModulePage, label: string, table: ReportTable, column: string, rel = 0) {
  const k = await module.kpi(label);
  const s = await table.sum(column);
  if (rel) expectNear(s, k, `"${label}" vs sum of ${table.heading} › ${column}`, rel);
  else expect.soft(s, `"${label}" (${k}) = sum of ${table.heading} › ${column}`).toBe(k);
}
