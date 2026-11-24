/**
 * Reports workbook — RPT-01 Executive Dashboard (KPI vs Target) (REP-028 … REP-056).
 * Reports & Analytics → Executive & Governance tab → "Open RPT-01 →". Expected actuals come from the Inventory,
 * SPA Contracts and Marketing modules at run time, rates from RPT-03 (see executive-dashboard.data.ts). Read-only.
 */
import { test, expect, note } from '../pages/fixtures';
import { REP_TEXT, REP_XP, ROUTES, at } from '../locators';
import { parseNum, ymd } from '../helpers';
import type { SingleReportPage } from '../pages/SingleReportPage';
import type { ReportCatalogPage } from '../pages/ReportCatalogPage';
import type { CrmData, Contract, Unit, Campaign } from '../pages/CrmData';
import { rep } from './catalog';
import { CREATED_WITHIN_MS, PRESET_PERIODS } from './lead-register.data';
import {
  M, PCT_DECIMALS, STATUS_TOLERANCE_PCT, type Rates,
  close, criteriaOf, expectedActuals, metric, rate, ratesOf, signedDays, totalBudget,
} from './executive-dashboard.data';

const ED = REP_TEXT.executiveDashboard;
const T = REP_TEXT.tiles;
const PROJECT = 'Project';
const SALES = 'Salesperson';
const METRICS = Object.values(M);
const MONEY_COLS = ['baselineTarget', 'currentActual', 'varianceAmount'] as const;

test.describe.configure({ timeout: 300_000 });

// ── Source data (read once per worker; the suite changes nothing) ───────────────────────────────
type Sources = { units: Unit[]; contracts: Contract[]; campaigns: Campaign[]; rates: Rates };
let sourcesCache: Sources | undefined;

async function sources(crmData: CrmData): Promise<Sources> {
  sourcesCache ??= {
    units: await crmData.units(),
    contracts: await crmData.contracts(),
    campaigns: await crmData.campaigns(),
    rates: ratesOf(await crmData.governanceTable(REP_TEXT.controlAssumptions.panelId)),
  };
  return sourcesCache;
}

// ── Report helpers ──────────────────────────────────────────────────────────────────────────────
/** Opens RPT-01 the way a user does: catalogue → Executive & Governance tab → Open RPT-01. */
async function openReport(reportCatalog: ReportCatalogPage, ed: SingleReportPage) {
  await reportCatalog.open();
  await reportCatalog.openTab(ED.category);
  await reportCatalog.openReport(ED.code);
  await expect(ed.title, 'Executive Dashboard opened').toHaveText(ED.title);
  await expect(ed.tableRoot.locator('tbody tr').first(), 'Report rows loaded').toBeVisible({ timeout: 15_000 });
}

/** The selection on screen in words, for the report. */
async function shown(ed: SingleReportPage): Promise<string> {
  const text = async (s: ReturnType<SingleReportPage['filter']>) =>
    (await s.count()) ? s.evaluate(e => (e as HTMLSelectElement).selectedOptions[0]?.text ?? '') : '(hidden)';
  const sel = await ed.selection();
  const period = sel.period === 'custom' ? `${sel.from} → ${sel.to}` : await text(ed.periodSelect);
  return `Period ${period} · Project ${await text(ed.filter(PROJECT))} · Salesperson ${await text(ed.filter(SALES))} · View ${(await ed.isMine()) ? 'Mine' : 'All'}`;
}

const num = (v: unknown) => Number(v);
const money = (n: number) => Math.round(n).toLocaleString('en-US');
/** Display value → number ("-91.01M USD" → -91010000); a Unicode minus counts as minus. */
const shownNum = (s: string) => parseNum(s.replace(/[−–]/g, '-'));

/** The logged-in user's id, from the Salesperson dropdown (shown with the user's name). */
async function myUserId(ed: SingleReportPage): Promise<string | undefined> {
  const me = await ed.userName();
  return (await ed.options(SALES)).find(o => o.label === me)?.value;
}

/**
 * Checks the Current Actuals of the selection on screen against the source modules: Gross Portfolio Realization
 * (units of the project), Executed SPAs and Broker Commissions (executed contracts in the period, project and
 * salesperson) and Marketing ROAS (Executed SPAs ÷ campaign budgets).
 */
async function verifyActuals(what: string, ed: SingleReportPage, src: Sources, myId?: string) {
  const data = await ed.data();
  const c = criteriaOf(data, myId);
  const exp = expectedActuals(src, c);
  const budget = totalBudget(src.campaigns);
  const got = (name: string) => num(metric(data, name)?.currentActual);
  const roas = budget ? exp.spas / budget : NaN;
  note(what, `${await shown(ed)} (dates ${c.from} – ${c.to}) · expected: Gross ${money(exp.gross)} (${exp.units} units) · SPAs ${money(exp.spas)} (${exp.contracts.length} contracts: ${exp.contracts.map(k => k.contractNo).join(', ') || 'none'}) · Broker ${money(exp.broker)} · ROAS ${roas.toFixed(2)}  |  report: Gross ${money(got(M.gross))} · SPAs ${money(got(M.spas))} · Broker ${money(got(M.broker))} · ROAS ${got(M.roas)}`);
  expect.soft(close(got(M.gross), exp.gross), `${what}: Gross Portfolio Realization ${money(got(M.gross))} = units' base prices ${money(exp.gross)}`).toBe(true);
  expect.soft(close(got(M.spas), exp.spas), `${what}: Executed SPAs ${money(got(M.spas))} = executed contracts in the selection ${money(exp.spas)}`).toBe(true);
  expect.soft(close(got(M.broker), exp.broker), `${what}: Broker Commissions ${money(got(M.broker))} = commission on those contracts ${money(exp.broker)}`).toBe(true);
  if (budget) expect.soft(close(got(M.roas), roas), `${what}: Marketing ROAS ${got(M.roas)} = Executed SPAs ÷ campaign budgets ${roas.toFixed(2)}`).toBe(true);
  return { data, exp };
}

/** Targets stated in the methodology ("Gross Portfolio Realization: $204,845,800 USD (…)"), by metric. */
async function statedTargets(ed: SingleReportPage): Promise<Record<string, { value: number; note: string }>> {
  const text = ((await at(ed.page, REP_XP.definitions).textContent()) ?? '').replace(/\s+/g, ' ');
  const { baseline, actual } = ED.methodology;
  const start = text.indexOf(`${baseline}:`), end = text.indexOf(`${actual}:`, start);
  const section = text.slice(start, end > start ? end : undefined);
  const out: Record<string, { value: number; note: string }> = {};
  for (const name of METRICS) {
    const m = section.match(new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*\\$?([\\d,]+(?:\\.\\d+)?)[^(]*(?:\\(([^)]*)\\))?`));
    if (m) out[name] = { value: Number(m[1].replace(/,/g, '')), note: m[2] ?? '' };
  }
  return out;
}

test.describe('Reports · RPT-01 Executive Dashboard', () => {
  // ── 1. Navigation ──────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-028'), async ({ reportCatalog, executiveDashboard: ed, page }) => {
    ed.watchErrors();
    await reportCatalog.open();
    await reportCatalog.openTab(ED.category);
    const card = await reportCatalog.readCard(ED.code);
    note('card', `${card.code} · ${card.title} · ${card.category}`);
    expect.soft(card.title, 'Card title').toBe(ED.title);
    await reportCatalog.openReport(ED.code);
    await expect.soft(page, 'URL').toHaveURL(new RegExp(`${ED.route}\\?${ED.query}`));
    await expect.soft(ed.code, 'Report code').toHaveText(ED.code);
    await expect.soft(ed.title, 'Report title').toHaveText(ED.title);
    await expect(ed.tableRoot.locator('tbody tr').first(), 'Report rows loaded').toBeVisible({ timeout: 15_000 });
    note('loaded', `${(await ed.rows()).length} rows`);
    await ed.expectNoBrokenValues();
    ed.expectNoErrors();
  });

  test(...rep('REP-029'), async ({ reportCatalog, executiveDashboard: ed }) => {
    await openReport(reportCatalog, ed);
    const data = await ed.data();
    const total = await ed.totalRecords();
    const rows = (await ed.rows()).length;
    const created = await ed.tile(T.created);
    const by = await ed.tile(T.createdBy);
    const user = await ed.userName();
    note('header', `Total ${total} · rows ${rows} · API total ${data.total} · Created ${created} · Created By ${by} · logged in as ${user}`);
    expect.soft(total, 'Total Records = rows shown').toBe(rows);
    expect.soft(total, 'Total Records = API total').toBe(data.total);
    expect.soft(total, 'Total Records = the scorecard\'s metrics').toBe(METRICS.length);
    const at = new Date(created.replace(',', ''));
    expect.soft(!isNaN(+at) && Math.abs(+at - Date.now()) < CREATED_WITHIN_MS, `Created date/time is now (${created})`).toBeTruthy();
    expect.soft(by.replace(/\s*\([^)]*\)$/, ''), 'Created By = logged-in user').toBe(user);
  });

  test(...rep('REP-030'), async ({ reportCatalog, executiveDashboard: ed, page }) => {
    await openReport(reportCatalog, ed);
    await expect.soft(ed.backLink, 'Back link').toHaveText(ED.backLabel);
    for (const code of ED.siblings) {
      await expect.soft(ed.siblingPill(code), `Pill ${code}`).toBeVisible();
      await ed.siblingPill(code).click();
      await expect.soft(ed.code, `${code} opens`).toHaveText(code);
      await ed.open();
      await expect(ed.code, 'Back on RPT-01').toHaveText(ED.code);
    }
    await ed.backLink.click();
    await expect.soft(page, 'Back link → catalogue').toHaveURL(new RegExp(ROUTES.hub));
    await expect.soft(reportCatalog.tab(ED.category), 'Executive & Governance tab selected').toHaveAttribute('aria-selected', 'true');
    await expect.soft(reportCatalog.card(ED.code), 'RPT-01 card listed').toBeVisible();
  });

  // ── 2. Structure ───────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-031'), async ({ reportCatalog, executiveDashboard: ed }) => {
    await openReport(reportCatalog, ed);
    const headers = await ed.headers();
    const categories = (await ed.rows()).map(r => r[ED.columns[0]]);
    note('table', `${headers.join(' | ')}  ·  rows: ${categories.join(' | ')}`);
    expect.soft(headers, 'Columns').toEqual(ED.columns);
    expect.soft(categories, 'Metric rows, in order').toEqual(METRICS);
  });

  test(...rep('REP-032'), async ({ reportCatalog, executiveDashboard: ed }) => {
    await openReport(reportCatalog, ed);
    const terms = await ed.definedTerms();
    const text = (await at(ed.page, REP_XP.definitions).textContent()) ?? '';
    note('defined', terms.join(' | '));
    expect.soft(ED.columns.filter(c => !terms.includes(c)), 'Columns without an explanation').toEqual([]);
    expect.soft(Object.values(T).filter(t => !terms.some(d => d.startsWith(t))), 'Header items without an explanation').toEqual([]);
    expect.soft(METRICS.filter(m => !text.includes(m)), 'Metrics the methodology does not explain').toEqual([]);
  });

  // ── 3. Calculations ────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-033'), async ({ reportCatalog, executiveDashboard: ed }) => {
    await openReport(reportCatalog, ed);
    const data = await ed.data();
    const rows = await ed.rows();
    const label = Object.fromEntries(data.columns.map(c => [c.key, c.label]));
    const wrong: string[] = [];
    for (const name of METRICS) {
      const api = metric(data, name), ui = rows.find(r => r[ED.columns[0]] === name);
      if (!api || !ui) { wrong.push(`${name}: ${api ? 'not in the table' : 'not in the API data'}`); continue; }
      for (const c of data.columns) {
        const shownValue = ui[label[c.key]] ?? '';
        const same = c.format === 'money' || c.format === 'percent' || c.format === 'number'
          ? close(shownNum(shownValue), num(api[c.key])) : shownValue === String(api[c.key] ?? '');
        if (!same) wrong.push(`${name} · ${label[c.key]}: shown "${shownValue}" · data ${api[c.key]}`);
      }
    }
    if (wrong.length) note('differences', wrong.join(' | '));
    expect.soft(wrong, 'Cells that differ from the report data').toEqual([]);
  });

  test(...rep('REP-034'), async ({ reportCatalog, executiveDashboard: ed }) => {
    await openReport(reportCatalog, ed);
    const data = await ed.data();
    for (const name of METRICS) {
      const r = metric(data, name)!;
      const exp = num(r.currentActual) - num(r.baselineTarget);
      note(name, `Actual ${r.currentActual} − Target ${r.baselineTarget} = ${exp} · shown ${r.varianceAmount}`);
      expect.soft(close(num(r.varianceAmount), exp), `${name}: Variance ($) ${r.varianceAmount} = Actual − Target ${exp}`).toBe(true);
    }
  });

  test(...rep('REP-035'), async ({ reportCatalog, executiveDashboard: ed }) => {
    await openReport(reportCatalog, ed);
    const data = await ed.data();
    for (const name of METRICS) {
      const r = metric(data, name)!;
      const exp = Number(((num(r.currentActual) - num(r.baselineTarget)) / num(r.baselineTarget) * 100).toFixed(PCT_DECIMALS));
      note(name, `(${r.currentActual} − ${r.baselineTarget}) ÷ ${r.baselineTarget} × 100 = ${exp}% · shown ${r.variancePct}%`);
      expect.soft(num(r.variancePct), `${name}: Variance (%)`).toBeCloseTo(exp, PCT_DECIMALS);
    }
  });

  test(...rep('REP-036'), async ({ reportCatalog, executiveDashboard: ed }) => {
    await openReport(reportCatalog, ed);
    const data = await ed.data();
    note('rule', `A performing flag (${ED.goodFlags.join(', ')}) needs Variance (%) ≥ −${STATUS_TOLERANCE_PCT}%; ${ED.budgetFlag} needs Actual ≤ Target`);
    for (const name of METRICS) {
      const r = metric(data, name)!;
      const flag = String(r.statusFlag), pct = num(r.variancePct);
      note(name, `${flag} at ${pct}% (Actual ${r.currentActual} vs Target ${r.baselineTarget})`);
      expect.soft([...ED.goodFlags, ED.budgetFlag], `${name}: "${flag}" is a flag the methodology defines`).toContain(flag);
      if (ED.goodFlags.includes(flag)) expect.soft(pct, `${name}: "${flag}" while ${pct}% against target`).toBeGreaterThanOrEqual(-STATUS_TOLERANCE_PCT);
      if (flag === ED.budgetFlag) expect.soft(num(r.currentActual), `${name}: "${flag}" while Actual exceeds the budget`).toBeLessThanOrEqual(num(r.baselineTarget));
    }
  });

  test(...rep('REP-037'), async ({ reportCatalog, executiveDashboard: ed }) => {
    await openReport(reportCatalog, ed);
    const data = await ed.data();
    const currency = data.meta && (data.meta as { baseCurrencyCode?: string }).baseCurrencyCode || 'USD';
    const row = (await ed.rows()).find(r => r[ED.columns[0]] === M.roas)!;
    const cells = MONEY_COLS.map(k => data.columns.find(c => c.key === k)!.label);
    note('ROAS row', cells.map(c => `${c}: "${row[c]}"`).join(' · '));
    for (const c of cells) expect.soft(row[c], `Marketing ROAS ${c} is a multiple, not a ${currency} amount`).not.toContain(currency);
  });

  // ── 4. Baselines ───────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-038'), async ({ reportCatalog, executiveDashboard: ed }) => {
    await openReport(reportCatalog, ed);
    const data = await ed.data();
    const stated = await statedTargets(ed);
    for (const name of METRICS) {
      const target = num(metric(data, name)?.baselineTarget);
      note(name, `table ${target} · methodology ${stated[name]?.value ?? '(not stated)'} ${stated[name]?.note ? `(${stated[name].note})` : ''}`);
      expect.soft(stated[name]?.value, `${name}: Baseline Target = the target stated in the methodology`).toBe(target);
    }
  });

  test(...rep('REP-039'), async ({ reportCatalog, executiveDashboard: ed, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, ed);
    const data = await ed.data();
    const stated = await statedTargets(ed);
    const target = (name: string) => num(metric(data, name)?.baselineTarget);
    const share = stated[M.spas]?.note.match(/([\d.]+)\s*%/)?.[1];
    test.skip(!share || isNaN(src.rates.broker), 'The methodology states no absorption share or RPT-03 has no standard broker rate');
    const spas = target(M.gross) * rate(share!);
    const broker = target(M.spas) * src.rates.broker;
    note('rules', `Executed SPAs target = ${share}% of the Gross Portfolio target = ${money(spas)} · Broker target = ${src.rates.broker * 100}% (RPT-03 standard rate) of the SPA target = ${money(broker)}`);
    expect.soft(close(target(M.spas), spas), `Executed SPAs target ${money(target(M.spas))} = ${share}% of Gross Portfolio target ${money(spas)}`).toBe(true);
    expect.soft(close(target(M.broker), broker), `Broker Commissions target ${money(target(M.broker))} = standard rate × SPA target ${money(broker)}`).toBe(true);
  });

  // ── 5. Current Actuals vs source modules ───────────────────────────────────────────────────────
  test(...rep('REP-040'), async ({ reportCatalog, executiveDashboard: ed, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, ed);
    const data = await ed.data();
    const exp = src.units.reduce((s, u) => s + u.basePrice, 0);
    const got = num(metric(data, M.gross)?.currentActual);
    note('gross', `report ${money(got)} · ${src.units.length} units in Inventory, base prices ${money(exp)}`);
    expect.soft(close(got, exp), `Gross Portfolio Realization ${money(got)} = sum of unit base prices ${money(exp)}`).toBe(true);
  });

  test(...rep('REP-041'), async ({ reportCatalog, executiveDashboard: ed, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, ed);
    const { data, exp } = await verifyActuals('Default selection', ed, src);
    const got = num(metric(data, M.spas)?.currentActual);
    expect(close(got, exp.spas), `Executed SPAs ${money(got)} = executed contracts signed ${data.meta.period.from} – ${data.meta.period.to}: ${money(exp.spas)}`).toBe(true);
  });

  test(...rep('REP-042'), async ({ reportCatalog, executiveDashboard: ed, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, ed);
    const data = await ed.data();
    const exp = expectedActuals(src, criteriaOf(data));
    const got = num(metric(data, M.broker)?.currentActual);
    note('commission', `rates: broker ${src.rates.broker * 100}% + Tier 1 ${src.rates.tierBonus * 100}% above ${src.rates.tierAbove} sales, direct 2% · contracts: ${exp.contracts.map(k => `${k.contractNo} ${money(k.value)} ${k.brokerName ? `broker ${k.brokerName}` : 'direct'}`).join(', ') || 'none'} · expected ${money(exp.broker)} · report ${money(got)}`);
    expect(close(got, exp.broker), `Broker Commissions Accrued ${money(got)} = commission on the executed contracts ${money(exp.broker)}`).toBe(true);
  });

  test(...rep('REP-043'), async ({ reportCatalog, executiveDashboard: ed, crmData }) => {
    const src = await sources(crmData);
    const budget = totalBudget(src.campaigns);
    test.skip(!budget, 'No marketing campaign has a budget');
    await openReport(reportCatalog, ed);
    const data = await ed.data();
    const spas = num(metric(data, M.spas)?.currentActual);
    const got = num(metric(data, M.roas)?.currentActual);
    note('roas', `report Executed SPAs ${money(spas)} ÷ campaign budgets ${money(budget)} (${src.campaigns.map(c => `${c.campaignCode} ${money(c.budget)}`).join(', ')}) = ${(spas / budget).toFixed(2)} · report ${got}`);
    expect(close(got, spas / budget), `Marketing ROAS ${got} = Executed SPAs ÷ total campaign budget ${(spas / budget).toFixed(2)}`).toBe(true);
  });

  test(...rep('REP-044'), async ({ reportCatalog, executiveDashboard: ed }) => {
    await openReport(reportCatalog, ed);
    const data = await ed.data();
    note('escrow', `report ${money(num(metric(data, M.escrow)?.currentActual))} for ${data.meta.period.from} – ${data.meta.period.to}`);
    test.skip(true, 'Blocked: no collections / escrow receipts source the suite can read (the app exposes no receipts list); the value is recorded, not validated');
  });

  // ── 6. Filters ─────────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-045'), async ({ reportCatalog, executiveDashboard: ed }) => {
    await openReport(reportCatalog, ed);
    const labels = (await ed.periodSelect.locator('option').allInnerTexts()).map(o => o.trim());
    note('options', labels.join(' | '));
    expect.soft(labels, 'Period options').toEqual(REP_TEXT.periods);
    expect.soft(await ed.period(), 'Default period').toBe('this_month');
    await expect.soft(ed.viewButton('All'), 'All is selected by default').toHaveAttribute('aria-pressed', 'true');
  });

  test(...rep('REP-046'), async ({ reportCatalog, executiveDashboard: ed, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, ed);
    const seen: string[] = [];
    for (const p of PRESET_PERIODS) {
      await ed.setPeriod(p);
      const { data, exp } = await verifyActuals(`Period ${p}`, ed, src);
      seen.push(`${p}: SPAs ${money(num(metric(data, M.spas)?.currentActual))} (expected ${money(exp.spas)})`);
    }
    note('per period', seen.join(' · '));
  });

  test(...rep('REP-047'), async ({ reportCatalog, executiveDashboard: ed, crmData, page }) => {
    const src = await sources(crmData);
    const days = signedDays(src.contracts);
    test.skip(days.length < 2, 'Fewer than 2 distinct contract signing dates: no range holds some but not all contracts');
    const from = days[0], to = days[Math.floor((days.length - 1) / 2)];
    await openReport(reportCatalog, ed);
    await ed.setPeriod('custom');
    await expect.soft(page.locator('main input[type=date]'), 'From and To fields').toHaveCount(2);
    await ed.setCustomRange(from, to);
    await verifyActuals(`Custom ${from} → ${to}`, ed, src);
  });

  test(...rep('REP-048'), async ({ reportCatalog, executiveDashboard: ed, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, ed);
    // a period that holds every contract, so only the project decides the values
    await ed.setPeriod('last_12_months');
    const projects = await ed.options(PROJECT);
    note('projects', projects.map(o => `${o.label} (${o.value})`).join(', '));
    test.skip(!projects.length, 'The Project dropdown has no projects');
    for (const o of projects) {
      await ed.setFilterValue(PROJECT, o.value);
      await verifyActuals(`Project ${o.label}`, ed, src);
    }
  });

  test(...rep('REP-049'), async ({ reportCatalog, executiveDashboard: ed, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, ed);
    await ed.setPeriod('last_12_months');
    const people = await ed.options(SALES);
    note('salespeople', people.map(o => o.label).join(', '));
    test.skip(!people.length, 'The Salesperson dropdown has no salespeople');
    for (const o of people) {
      await ed.setFilterValue(SALES, o.value);
      await verifyActuals(`Salesperson ${o.label}`, ed, src);
    }
  });

  test(...rep('REP-050'), async ({ reportCatalog, executiveDashboard: ed, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, ed);
    await ed.setPeriod('last_12_months');
    const me = await myUserId(ed);
    test.skip(!me, 'The logged-in user is not in the Salesperson dropdown');
    await ed.setView('Mine');
    await expect.soft(ed.viewButton('Mine'), 'Mine is selected').toHaveAttribute('aria-pressed', 'true');
    await verifyActuals('Mine', ed, src, me);
  });

  test(...rep('REP-051'), async ({ reportCatalog, executiveDashboard: ed }) => {
    await openReport(reportCatalog, ed);
    const before = await ed.selection();
    const beforeRows = (await ed.data()).rows;
    const [project] = await ed.options(PROJECT);
    const [person] = await ed.options(SALES);
    await ed.setPeriod(PRESET_PERIODS.find(p => p !== before.period)!);
    if (project) await ed.setFilterValue(PROJECT, project.value);
    if (person) await ed.setFilterValue(SALES, person.value);
    note('changed to', await shown(ed));
    await ed.resetFilters();
    note('after reset', await shown(ed));
    const { view, ...filters } = await ed.selection();
    expect.soft(filters, 'Period, Project and Salesperson back to the defaults').toEqual(before);
    if (view === 'self') await ed.setView('All');
    expect.soft((await ed.data()).rows, 'Values back to the default values').toEqual(beforeRows);
  });

  // ── 7. Export ──────────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-052'), async ({ reportCatalog, executiveDashboard: ed }) => {
    await openReport(reportCatalog, ed);
    const headers = await ed.headers();
    const { sheet } = await ed.export();
    note('file', `${sheet.name} · sheet "${sheet.sheetName}" · ${sheet.rows.length} rows · ${sheet.header.join(' | ')}`);
    expect.soft(sheet.name, 'File name is .xlsx').toMatch(/\.xlsx$/i);
    expect.soft(sheet.magic, 'File is an Excel (zip) workbook').toBe('PK');
    expect.soft(sheet.sheetName, 'Sheet name').toBe(ED.exportSheet);
    expect.soft(sheet.header, 'Export columns = report columns').toEqual(headers);
    expect.soft(sheet.rows.length, 'One row per metric').toBe(METRICS.length);
  });

  test(...rep('REP-053'), async ({ reportCatalog, executiveDashboard: ed }) => {
    await openReport(reportCatalog, ed);
    const data = await ed.data();
    const { sheet } = await ed.export();
    const wrong: string[] = [];
    for (const name of METRICS) {
      const api = metric(data, name)!, f = sheet.rows.find(r => r[ED.columns[0]] === name);
      if (!f) { wrong.push(`${name}: not in the file`); continue; }
      for (const c of data.columns) {
        const v = f[c.label];
        const same = c.format === 'text' ? String(v ?? '') === String(api[c.key] ?? '') : close(num(v), num(api[c.key]));
        if (!same) wrong.push(`${name} · ${c.label}: file "${v}" · report ${api[c.key]}`);
      }
    }
    note('export', `${sheet.name}: ${sheet.rows.length} rows${wrong.length ? ` · differences: ${wrong.join(' | ')}` : ''}`);
    expect.soft(sheet.rows.map(r => r[ED.columns[0]]), 'Same metrics, in order').toEqual(METRICS);
    expect.soft(wrong, 'Cells that differ between the report and the file').toEqual([]);
  });

  test(...rep('REP-054'), async ({ reportCatalog, executiveDashboard: ed }) => {
    await openReport(reportCatalog, ed);
    await ed.setPeriod('last_12_months');
    const [project] = await ed.options(PROJECT);
    const [person] = await ed.options(SALES);
    if (project) await ed.setFilterValue(PROJECT, project.value);
    if (person) await ed.setFilterValue(SALES, person.value);
    const selection = await ed.selection();
    const data = await ed.data();
    const { sheet, query } = await ed.export();
    note('export', `${await shown(ed)} · export request ${new URLSearchParams(query)}`);
    expect.soft(query, 'Export request carries the selected filters').toEqual(selection);
    const fileActual = (name: string) => num(sheet.rows.find(r => r[ED.columns[0]] === name)?.[ED.columns[2]]);
    for (const name of METRICS) expect.soft(close(fileActual(name), num(metric(data, name)?.currentActual)), `${name}: file Current Actual = report for the selection`).toBe(true);
  });

  // ── Additional: negative and boundary ──────────────────────────────────────────────────────────
  test(...rep('REP-055'), async ({ reportCatalog, executiveDashboard: ed }) => {
    await openReport(reportCatalog, ed);
    const today = new Date();
    const from = ymd(today), to = ymd(new Date(+today - 864e5));
    await ed.setPeriod('custom');
    await ed.page.locator('main input[type=date]').nth(0).fill(from);
    await ed.page.locator('main input[type=date]').nth(1).fill(to);
    const message = ed.message(REP_TEXT.rangeError).first();
    const shownMsg = await message.waitFor({ timeout: 10_000 }).then(() => true, () => false);
    note('inverted range', `From ${from} · To ${to} · message ${shownMsg ? 'shown' : 'not shown'} · rows still listed ${(await ed.rows()).length}`);
    expect.soft(shownMsg, `Validation message "${REP_TEXT.rangeError}"`).toBe(true);
  });

  test(...rep('REP-056'), async ({ reportCatalog, executiveDashboard: ed, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, ed);
    await ed.setPeriod('last_month');
    const [person] = await ed.options(SALES);
    if (person) await ed.setFilterValue(SALES, person.value);
    const before = await shown(ed);
    await ed.page.reload();
    await expect(ed.tableRoot.locator('tbody tr').first(), 'Report reloaded').toBeVisible({ timeout: 20_000 });
    const after = await shown(ed);
    note('refresh', `before: ${before}  →  after: ${after} (${before === after ? 'filters kept' : 'filters reset'})`);
    await verifyActuals('After refresh', ed, src);
  });
});
