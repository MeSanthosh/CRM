/**
 * Reports workbook — RPT-21 Summary by Property Type (REP-110 … REP-136).
 * Reports & Analytics → Inventory Reports tab → "Open RPT-21 →". Each category row is checked for its own
 * arithmetic, against its methodology, and against Inventory units / products and SPA contracts for the selection
 * the report says it applied (see property-summary.data.ts). Read-only.
 */
import { test, expect, note } from '../pages/fixtures';
import { REP_TEXT, REP_XP, ROUTES, at } from '../locators';
import { parseNum, ymd } from '../helpers';
import type { SingleReportPage, ReportData } from '../pages/SingleReportPage';
import type { ReportCatalogPage } from '../pages/ReportCatalogPage';
import type { CrmData, Contract, Product, Unit } from '../pages/CrmData';
import { rep } from './catalog';
import { CREATED_WITHIN_MS, PRESET_PERIODS } from './lead-register.data';
import { close, signedDays } from './executive-dashboard.data';
import { entry, numbers } from './control-assumptions.data';
import { K, PCT_DECIMALS, type Criteria, type Figures, absorption, criteriaOf, figures, reported, typeOf } from './property-summary.data';

const PS = REP_TEXT.propertySummary;
const CA = REP_TEXT.controlAssumptions;
const ED = REP_TEXT.executiveDashboard;
const T = REP_TEXT.tiles;
const PROJECT = 'Project';
const SUMMED = [K.keys, K.area, K.base, K.sold, K.contracted, K.unsold] as const;

test.describe.configure({ timeout: 300_000 });

// ── Source data (read once per worker; the suite changes nothing) ───────────────────────────────
type Sources = { units: Unit[]; products: Product[]; contracts: Contract[] };
let sourcesCache: Sources | undefined;
async function sources(crmData: CrmData): Promise<Sources> {
  sourcesCache ??= { units: await crmData.units(), products: await crmData.products(), contracts: await crmData.contracts() };
  return sourcesCache;
}

// ── Report helpers ──────────────────────────────────────────────────────────────────────────────
/** Opens RPT-21 the way a user does: catalogue → Inventory Reports tab → Open RPT-21. */
async function openReport(reportCatalog: ReportCatalogPage, ps: SingleReportPage) {
  await reportCatalog.open();
  await reportCatalog.openTab(PS.category);
  await reportCatalog.openReport(PS.code);
  await expect(ps.title, 'Summary by Property Type opened').toHaveText(PS.title);
  await expect(ps.tableRoot.locator('tbody tr').first(), 'Report rows loaded').toBeVisible({ timeout: 15_000 });
}

async function shown(ps: SingleReportPage): Promise<string> {
  const sel = await ps.selection();
  const text = (s: ReturnType<SingleReportPage['filter']>) => s.evaluate(e => (e as HTMLSelectElement).selectedOptions[0]?.text ?? '');
  const period = sel.period === 'custom' ? `${sel.from} → ${sel.to}` : await text(ps.periodSelect);
  return `Period ${period} · Project ${await text(ps.filter(PROJECT))} · View ${(await ps.isMine()) ? 'Mine' : 'All'}`;
}

const money = (n: number) => Math.round(n).toLocaleString('en-US');
const fig = (f: Figures) => `keys ${f.keys} · area ${money(f.area)} · base ${money(f.base)} · sold ${f.sold} · contracted ${money(f.contracted)}`;

/** The logged-in user's id: the owner of their contracts' opportunities (none → no contract can be theirs). */
async function myUserId(ps: SingleReportPage, src: Sources): Promise<string> {
  const me = await ps.userName();
  return src.contracts.find(k => k.ownerName === me)?.ownerUserId ?? `(${me} owns no contracts)`;
}

/**
 * Checks every category row of the selection on screen against Inventory and SPA Contracts: keys, carpet area and
 * base value (net area × product rate) for the project, sold keys and contracted value for the project, period
 * and view. `which` limits the columns compared.
 */
async function verify(what: string, ps: SingleReportPage, src: Sources, which: 'all' | 'inventory' | 'sales' = 'all', myId?: string) {
  const data = await ps.data();
  const c: Criteria = criteriaOf(data, myId);
  const types = [...new Set(src.units.map(u => u.unitType))];
  const cols: (keyof Figures)[] = which === 'inventory' ? ['keys', 'area', 'base'] : which === 'sales' ? ['sold', 'contracted'] : ['keys', 'area', 'base', 'sold', 'contracted'];
  note(what, `${await shown(ps)} (dates ${c.from} – ${c.to}${c.ownerUserId ? `, owner ${c.ownerUserId}` : ''})`);
  for (const r of data.rows) {
    const category = String(r[K.category]);
    const type = typeOf(category, types);
    expect.soft(type, `${what}: "${category}" matches an Inventory unit type (${types.join(', ')})`).toBeDefined();
    if (!type) continue;
    const exp = figures(src, c, type), got = reported(r);
    note(`${what} · ${category}`, `expected (${type}): ${fig(exp)}  |  report: ${fig(got)}`);
    for (const k of cols) expect.soft(close(got[k], exp[k]), `${what} · ${category}: ${k} ${money(got[k])} = ${money(exp[k])} from Inventory / SPA Contracts`).toBe(true);
  }
  return data;
}

test.describe('Reports · RPT-21 Summary by Property Type', () => {
  // ── 1. Navigation ──────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-110'), async ({ reportCatalog, propertySummary: ps, page }) => {
    ps.watchErrors();
    await reportCatalog.open();
    await reportCatalog.openTab(PS.category);
    const card = await reportCatalog.readCard(PS.code);
    note('card', `${card.code} · ${card.title} · ${card.category}`);
    expect.soft(card.title, 'Card title').toBe(PS.title);
    await reportCatalog.openReport(PS.code);
    await expect.soft(page, 'URL').toHaveURL(new RegExp(`${PS.route}\\?${PS.query}`));
    await expect.soft(ps.code, 'Report code').toHaveText(PS.code);
    await expect.soft(ps.title, 'Report title').toHaveText(PS.title);
    await expect(ps.tableRoot.locator('tbody tr').first(), 'Report rows loaded').toBeVisible({ timeout: 15_000 });
    await ps.expectNoBrokenValues();
    ps.expectNoErrors();
  });

  test(...rep('REP-111'), async ({ reportCatalog, propertySummary: ps, page }) => {
    await openReport(reportCatalog, ps);
    await expect.soft(ps.backLink, 'Back link').toHaveText(PS.backLabel);
    for (const code of PS.siblings) {
      await expect.soft(ps.siblingPill(code), `Pill ${code}`).toBeVisible();
      await ps.siblingPill(code).click();
      await expect.soft(ps.code, `${code} opens`).toHaveText(code);
      await ps.open();
      await expect(ps.code, 'Back on RPT-21').toHaveText(PS.code);
    }
    await ps.backLink.click();
    await expect.soft(page, 'Back link → catalogue').toHaveURL(new RegExp(ROUTES.hub));
    await expect.soft(reportCatalog.tab(PS.category), 'Inventory Reports tab selected').toHaveAttribute('aria-selected', 'true');
  });

  test(...rep('REP-112'), async ({ reportCatalog, propertySummary: ps }) => {
    await openReport(reportCatalog, ps);
    const data = await ps.data();
    const total = await ps.totalRecords();
    const rows = (await ps.rows()).length;
    const items = (await at(ps.page, REP_XP.definitionItems).allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
    const stated = numbers(entry(items, 'Total Records in Report') ?? '')[0];
    const created = await ps.tile(T.created);
    const by = await ps.tile(T.createdBy);
    const user = await ps.userName();
    note('header', `Total ${total} · category rows ${rows} · API total ${data.total} · methodology ${stated} · Created ${created} · Created By ${by} · logged in as ${user}`);
    expect.soft(total, 'Total Records = category rows').toBe(rows);
    expect.soft(total, 'Total Records = API total').toBe(data.total);
    expect.soft(total, 'Total Records = the count the methodology states').toBe(stated);
    const when = new Date(created.replace(',', ''));
    expect.soft(!isNaN(+when) && Math.abs(+when - Date.now()) < CREATED_WITHIN_MS, `Created date/time is now (${created})`).toBeTruthy();
    expect.soft(by.replace(/\s*\([^)]*\)$/, ''), 'Created By = logged-in user').toBe(user);
  });

  // ── 2. Structure ───────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-113'), async ({ reportCatalog, propertySummary: ps, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, ps);
    const headers = await ps.headers();
    const categories = (await ps.rows()).map(r => r[PS.columns[0]]);
    const total = await ps.totalRow();
    const types = [...new Set(src.units.map(u => u.unitType))];
    note('table', `${headers.join(' | ')} · categories: ${categories.join(' | ')} · total row: ${total?.[PS.columns[0]] ?? '(none)'} · Inventory unit types: ${types.join(', ')}`);
    expect.soft(headers, 'Columns').toEqual(PS.columns);
    expect.soft(categories.filter((c, i) => categories.indexOf(c) !== i), 'Categories listed twice').toEqual([]);
    expect.soft(total?.[PS.columns[0]], 'Total row').toBe(PS.totalLabel);
    expect.soft(types.filter(t => !categories.some(c => typeOf(c, [t]))), 'Inventory unit types without a category row').toEqual([]);
  });

  test(...rep('REP-114'), async ({ reportCatalog, propertySummary: ps }) => {
    await openReport(reportCatalog, ps);
    const terms = await ps.definedTerms();
    note('defined', terms.join(' | '));
    expect.soft(PS.columns.filter(c => !terms.includes(c)), 'Columns without an explanation').toEqual([]);
    expect.soft(Object.values(T).filter(t => !terms.some(d => d.startsWith(t))), 'Header items without an explanation').toEqual([]);
    const filters = (await ps.page.locator('main section.crm-report-toolbar label .crm-label').allInnerTexts()).map(l => l.trim());
    note('filters', filters.join(', '));
    expect.soft(filters, 'Filters').toEqual(PS.filterLabels);
  });

  test(...rep('REP-115'), async ({ reportCatalog, propertySummary: ps }) => {
    await openReport(reportCatalog, ps);
    const data = await ps.data();
    const rows = await ps.rows();
    const foot = await ps.totalRow();
    const label = Object.fromEntries(data.columns.map(c => [c.key, c.label]));
    const wrong: string[] = [];
    const compare = (where: string, api: Record<string, unknown> | undefined, ui: Record<string, string> | undefined) => {
      if (!api || !ui) { wrong.push(`${where}: ${api ? 'not shown' : 'not in the data'}`); return; }
      for (const c of data.columns) {
        const v = ui[label[c.key]] ?? '';
        const same = c.format === 'text' ? v === String(api[c.key] ?? '') : close(parseNum(v), Number(api[c.key]));
        if (!same) wrong.push(`${where} · ${label[c.key]}: shown "${v}" · data ${api[c.key]}`);
      }
    };
    data.rows.forEach((r, i) => compare(String(r[K.category]), r, rows[i]));
    compare('Total row', data.totalRow, foot);
    if (wrong.length) note('differences', wrong.join(' | '));
    expect.soft(wrong, 'Cells that differ from the report data').toEqual([]);
  });

  // ── 3. Calculations ────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-116'), async ({ reportCatalog, propertySummary: ps }) => {
    await openReport(reportCatalog, ps);
    const data = await ps.data();
    const t = data.totalRow ?? {};
    for (const k of SUMMED) {
      const sum = data.rows.reduce((s, r) => s + Number(r[k]), 0);
      note(k, `categories ${data.rows.map(r => r[k]).join(' + ')} = ${sum} · total row ${t[k]}`);
      expect.soft(close(Number(t[k]), sum), `Total row ${k} ${t[k]} = sum of the categories ${sum}`).toBe(true);
    }
  });

  test(...rep('REP-117'), async ({ reportCatalog, propertySummary: ps }) => {
    await openReport(reportCatalog, ps);
    const data = await ps.data();
    for (const r of [...data.rows, data.totalRow ?? {}]) {
      const exp = Number(r[K.base]) - Number(r[K.contracted]);
      note(String(r[K.category]), `${r[K.base]} − ${r[K.contracted]} = ${exp} · shown ${r[K.unsold]}`);
      expect.soft(close(Number(r[K.unsold]), exp), `${r[K.category]}: Unsold Value = Base Gross Value − Contracted SPA Value`).toBe(true);
    }
  });

  test(...rep('REP-118'), async ({ reportCatalog, propertySummary: ps }) => {
    await openReport(reportCatalog, ps);
    const data = await ps.data();
    for (const r of [...data.rows, data.totalRow ?? {}]) {
      const exp = absorption(Number(r[K.sold]), Number(r[K.keys]));
      note(String(r[K.category]), `${r[K.sold]} ÷ ${r[K.keys]} × 100 = ${exp}% · shown ${r[K.absorption]}%`);
      expect.soft(Number(r[K.absorption]), `${r[K.category]}: Absorption % = SPA Sold Keys ÷ Total Keys × 100`).toBeCloseTo(exp, PCT_DECIMALS);
    }
  });

  test(...rep('REP-119'), async ({ reportCatalog, propertySummary: ps }) => {
    await openReport(reportCatalog, ps);
    const data = await ps.data();
    const items = (await at(ps.page, REP_XP.definitionItems).allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
    const label = Object.fromEntries(data.columns.map(c => [c.key, c.label]));
    for (const k of [...SUMMED, K.absorption]) {
      const stated = numbers(entry(items, label[k]) ?? '');
      const total = Number(data.totalRow?.[k]);
      note(label[k], `total row ${total} · numbers in the methodology: ${stated.join(', ') || '(none)'}`);
      expect.soft(stated.some(n => close(n, total)), `${label[k]}: the portfolio total ${total} is the one the methodology states`).toBe(true);
    }
  });

  // ── 4. Source data ─────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-120'), async ({ reportCatalog, propertySummary: ps, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, ps);
    await ps.setPeriod('last_12_months');
    const data = await verify('Inventory columns', ps, src, 'inventory');
    const all = figures(src, criteriaOf(data));
    const t = reported(data.totalRow ?? {});
    note('portfolio', `Inventory: ${fig(all)}  |  total row: ${fig(t)}`);
    expect.soft(t.keys, 'Total Keys = units in Inventory').toBe(all.keys);
  });

  test(...rep('REP-121'), async ({ reportCatalog, propertySummary: ps, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, ps);
    await ps.setPeriod('last_12_months');
    const data = await verify('Sales columns (Last 12 months)', ps, src, 'sales');
    const all = figures(src, criteriaOf(data));
    const t = reported(data.totalRow ?? {});
    note('portfolio', `SPA Contracts: sold ${all.sold} · contracted ${money(all.contracted)}  |  total row: sold ${t.sold} · contracted ${money(t.contracted)}`);
    expect.soft(t.sold, 'SPA Sold Keys total = units with an executed SPA').toBe(all.sold);
    expect.soft(close(t.contracted, all.contracted), 'Contracted SPA Value total = value of the executed SPAs').toBe(true);
  });

  test(...rep('REP-122'), async ({ reportCatalog, propertySummary: ps, crmData }) => {
    const assumptions = await crmData.governanceTable(CA.panelId);
    const products = await crmData.products();
    await openReport(reportCatalog, ps);
    const items = (await at(ps.page, REP_XP.definitionItems).allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
    const text = entry(items, PS.columns[3]) ?? '';
    const stated = [...text.matchAll(/\$([\d,]+)\/sqm for ([^($]+?)(?= and |\s*\(|$)/g)].map(m => ({ rate: Number(m[1].replace(/,/g, '')), types: m[2] }));
    note('stated rates', stated.map(s => `${s.rate} for ${s.types}`).join(' · ') || '(none)');
    expect.soft(stated.length, 'The methodology states the base rates').toBeGreaterThan(0);
    const rptRates = assumptions.filter(r => r.unitOfMeasure?.includes(CA.perArea)).map(r => Number(String(r.baseValue).replace(/[^\d.]/g, '')));
    for (const s of stated) {
      expect.soft(rptRates, `$${s.rate}/sqm (${s.types}) is a RPT-03 Base Price / sqm`).toContain(s.rate);
      const typed = products.filter(p => s.types.toLowerCase().includes(p.unitType.toLowerCase()));
      expect.soft(typed.filter(p => p.ratePerSqm !== s.rate).map(p => `${p.productCode} ${p.ratePerSqm}`), `Inventory products of ${s.types} use $${s.rate}/sqm`).toEqual([]);
    }
  });

  test(...rep('REP-123'), async ({ reportCatalog, propertySummary: ps, executiveDashboard: ed }) => {
    await openReport(reportCatalog, ps);
    const base = Number((await ps.data()).totalRow?.[K.base]);
    await reportCatalog.open();
    await reportCatalog.openTab(ED.category);
    await reportCatalog.openReport(ED.code);
    const target = Number((await ed.data()).rows.find(r => r.metricCategory === ED.metrics.gross)?.baselineTarget);
    note('baseline', `RPT-21 Base Gross Value total ${money(base)} · RPT-01 Gross Portfolio Realization target ${money(target)}`);
    expect(close(base, target), 'RPT-21 Base Gross Value = RPT-01 Gross Portfolio baseline target').toBe(true);
  });

  // ── 5. Filters ─────────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-124'), async ({ reportCatalog, propertySummary: ps }) => {
    await openReport(reportCatalog, ps);
    const labels = (await ps.periodSelect.locator('option').allInnerTexts()).map(o => o.trim());
    note('options', labels.join(' | '));
    expect.soft(labels, 'Period options').toEqual(REP_TEXT.periods);
    expect.soft(await ps.period(), 'Default period').toBe('this_month');
    await expect.soft(ps.viewButton('All'), 'All is selected by default').toHaveAttribute('aria-pressed', 'true');
  });

  test(...rep('REP-125'), async ({ reportCatalog, propertySummary: ps, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, ps);
    for (const p of PRESET_PERIODS) {
      await ps.setPeriod(p);
      await verify(`Period ${p}`, ps, src);
    }
  });

  test(...rep('REP-126'), async ({ reportCatalog, propertySummary: ps, crmData }) => {
    const src = await sources(crmData);
    const days = signedDays(src.contracts);
    test.skip(days.length < 2, 'Fewer than 2 distinct contract signing dates');
    const from = days[0], to = days[Math.floor((days.length - 1) / 2)];
    await openReport(reportCatalog, ps);
    await ps.setCustomRange(from, to);
    await verify(`Custom ${from} → ${to}`, ps, src);
  });

  test(...rep('REP-127'), async ({ reportCatalog, propertySummary: ps, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, ps);
    await ps.setPeriod('last_12_months');
    const projects = await ps.options(PROJECT);
    note('projects', projects.map(o => `${o.label} (${o.value})`).join(', '));
    test.skip(!projects.length, 'The Project dropdown has no projects');
    for (const o of projects) {
      await ps.setFilterValue(PROJECT, o.value);
      await verify(`Project ${o.label}`, ps, src);
    }
  });

  test(...rep('REP-128'), async ({ reportCatalog, propertySummary: ps, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, ps);
    await ps.setPeriod('last_12_months');
    const me = await myUserId(ps, src);
    await ps.setView('Mine');
    await expect.soft(ps.viewButton('Mine'), 'Mine is selected').toHaveAttribute('aria-pressed', 'true');
    await verify('Mine', ps, src, 'all', me);
  });

  test(...rep('REP-129'), async ({ reportCatalog, propertySummary: ps }) => {
    await openReport(reportCatalog, ps);
    const before = await ps.selection();
    const defaults = await ps.data();
    const [project] = await ps.options(PROJECT);
    await ps.setPeriod(PRESET_PERIODS.find(p => p !== before.period)!);
    if (project) await ps.setFilterValue(PROJECT, project.value);
    note('changed to', await shown(ps));
    await ps.resetFilters();
    note('after reset', await shown(ps));
    const { view, ...filters } = await ps.selection();
    expect.soft(filters, 'Period and Project back to the defaults').toEqual(before);
    if (view === 'self') await ps.setView('All');
    const after: ReportData = await ps.data();
    expect.soft(after.rows, 'Categories back to the default values').toEqual(defaults.rows);
    expect.soft(after.totalRow, 'Total row back to the default values').toEqual(defaults.totalRow);
  });

  // ── 6. Export ──────────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-130'), async ({ reportCatalog, propertySummary: ps }) => {
    await openReport(reportCatalog, ps);
    const headers = await ps.headers();
    const rows = (await ps.rows()).length;
    const { sheet } = await ps.export();
    // download() keeps the total row apart from the data rows
    const last = sheet.total?.[PS.columns[0]];
    note('file', `${sheet.name} · sheet "${sheet.sheetName}" · ${sheet.rows.length} category rows + total "${last ?? '(none)'}" · ${sheet.header.join(' | ')}`);
    expect.soft(sheet.name, 'File name is .xlsx').toMatch(/\.xlsx$/i);
    expect.soft(sheet.magic, 'File is an Excel (zip) workbook').toBe('PK');
    expect.soft(sheet.sheetName, 'Sheet name').toBe(PS.exportSheet);
    expect.soft(sheet.header, 'Export columns = report columns').toEqual(headers);
    expect.soft(sheet.rows.length, 'One row per category').toBe(rows);
    expect.soft(last, 'The file has the total row').toBe(PS.totalLabel);
  });

  test(...rep('REP-131'), async ({ reportCatalog, propertySummary: ps }) => {
    await openReport(reportCatalog, ps);
    const data = await ps.data();
    const { sheet } = await ps.export();
    const wrong: string[] = [];
    [...data.rows, data.totalRow ?? {}].forEach((api, i) => {
      for (const c of data.columns) {
        const v = (i < data.rows.length ? sheet.rows[i] : sheet.total)?.[c.label];
        const same = c.format === 'text' ? String(v ?? '') === String(api[c.key] ?? '') : close(Number(v), Number(api[c.key]));
        if (!same) wrong.push(`${api[K.category]} · ${c.label}: file "${v}" · report ${api[c.key]}`);
      }
    });
    note('export', `${sheet.name}: ${sheet.rows.length} rows${wrong.length ? ` · differences: ${wrong.join(' | ')}` : ''}`);
    expect.soft(wrong, 'Cells that differ between the report and the file').toEqual([]);
  });

  test(...rep('REP-132'), async ({ reportCatalog, propertySummary: ps }) => {
    await openReport(reportCatalog, ps);
    await ps.setPeriod('last_12_months');
    const [project] = await ps.options(PROJECT);
    if (project) await ps.setFilterValue(PROJECT, project.value);
    const selection = await ps.selection();
    const data = await ps.data();
    const { sheet, query } = await ps.export();
    note('export', `${await shown(ps)} · export request ${new URLSearchParams(query)}`);
    expect.soft(query, 'Export request carries the selected filters').toEqual(selection);
    expect.soft([...sheet.rows, sheet.total ?? {}].map(r => Number(r[PS.columns[1]])), 'File Total Keys = report for the selection').toEqual([...data.rows, data.totalRow ?? {}].map(r => Number(r[K.keys])));
  });

  // ── Additional: negative and boundary ──────────────────────────────────────────────────────────
  test(...rep('REP-133'), async ({ reportCatalog, propertySummary: ps }) => {
    await openReport(reportCatalog, ps);
    const today = new Date();
    const from = ymd(today), to = ymd(new Date(+today - 864e5));
    await ps.setPeriod('custom');
    await ps.page.locator('main input[type=date]').nth(0).fill(from);
    await ps.page.locator('main input[type=date]').nth(1).fill(to);
    const message = ps.message(REP_TEXT.rangeError).first();
    const shownMsg = await message.waitFor({ timeout: 10_000 }).then(() => true, () => false);
    note('inverted range', `From ${from} · To ${to} · message ${shownMsg ? 'shown' : 'not shown'} · rows still listed ${(await ps.rows()).length}`);
    expect.soft(shownMsg, `Validation message "${REP_TEXT.rangeError}"`).toBe(true);
  });

  test(...rep('REP-134'), async ({ reportCatalog, propertySummary: ps, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, ps);
    await ps.setPeriod('last_month');
    const before = await shown(ps);
    await ps.page.reload();
    await expect(ps.tableRoot.locator('tbody tr').first(), 'Report reloaded').toBeVisible({ timeout: 20_000 });
    note('refresh', `before: ${before}  →  after: ${await shown(ps)}`);
    await verify('After refresh', ps, src);
  });

  test(...rep('REP-135'), async ({ reportCatalog, propertySummary: ps }) => {
    await openReport(reportCatalog, ps);
    const data = await ps.data();
    const bad = [...data.rows, data.totalRow ?? {}].flatMap(r => SUMMED.filter(k => !(Number(r[k]) >= 0)).map(k => `${r[K.category]} · ${k} ${r[k]}`));
    const over = [...data.rows, data.totalRow ?? {}].filter(r => Number(r[K.sold]) > Number(r[K.keys])).map(r => String(r[K.category]));
    note('bounds', `negative or missing: ${bad.join(', ') || 'none'} · sold keys above total keys: ${over.join(', ') || 'none'}`);
    expect.soft(bad, 'Amounts and counts are present and not negative').toEqual([]);
    expect.soft(over, 'SPA Sold Keys never exceed Total Keys').toEqual([]);
  });

  test(...rep('REP-136'), async ({ reportCatalog, propertySummary: ps }) => {
    await openReport(reportCatalog, ps);
    const data = await ps.data();
    const pct = [...data.rows, data.totalRow ?? {}].map(r => ({ c: String(r[K.category]), v: Number(r[K.absorption]) }));
    note('absorption', pct.map(p => `${p.c} ${p.v}%`).join(' · '));
    for (const p of pct) expect.soft(p.v >= 0 && p.v <= 100, `${p.c}: Absorption % ${p.v} is between 0 and 100`).toBe(true);
  });
});
