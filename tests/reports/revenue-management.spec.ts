/**
 * Reports workbook — RPT-18 Revenue Management Engine (REP-137 … REP-164).
 * Reports & Analytics → Inventory Reports tab → "Open RPT-18 →". Each sub-category row is checked against the
 * engine's own rules (methodology thresholds, actions, adjustments), its Inventory product, RPT-03 and RPT-21, and
 * its absorption against SPA contracts and reservations of the current quarter (see revenue-management.data.ts).
 * Read-only.
 */
import { test, expect, note } from '../pages/fixtures';
import { REP_TEXT, REP_XP, ROUTES, at } from '../locators';
import { parseNum, ymd } from '../helpers';
import type { SingleReportPage, ReportData } from '../pages/SingleReportPage';
import type { ReportCatalogPage } from '../pages/ReportCatalogPage';
import type { CrmData, Contract, Product, Reservation, Unit } from '../pages/CrmData';
import { rep } from './catalog';
import { CREATED_WITHIN_MS, PRESET_PERIODS } from './lead-register.data';
import { close } from './executive-dashboard.data';
import { entry, numbers, unitTypesOf, value } from './control-assumptions.data';
import { typeOf } from './property-summary.data';
import { K, PCT_DECIMALS, absorbed, actionFor, adjustmentOf, bandsOf, productOf, quarterOf, statusFor } from './revenue-management.data';

const RM = REP_TEXT.revenueManagement;
const PS = REP_TEXT.propertySummary;
const CA = REP_TEXT.controlAssumptions;
const T = REP_TEXT.tiles;
const PROJECT = 'Project';
const STATUSES = Object.keys(RM.actions);
type Row = Record<string, unknown>;

test.describe.configure({ timeout: 300_000 });

// ── Source data (read once per worker; the suite changes nothing) ───────────────────────────────
type Sources = { units: Unit[]; products: Product[]; contracts: Contract[]; reservations: Reservation[] };
let sourcesCache: Sources | undefined;
async function sources(crmData: CrmData): Promise<Sources> {
  sourcesCache ??= {
    units: await crmData.units(), products: await crmData.products(),
    contracts: await crmData.contracts(), reservations: await crmData.reservations(),
  };
  return sourcesCache;
}

// ── Report helpers ──────────────────────────────────────────────────────────────────────────────
/** Opens RPT-18 the way a user does: catalogue → Inventory Reports tab → Open RPT-18. */
async function openReport(reportCatalog: ReportCatalogPage, rm: SingleReportPage) {
  await reportCatalog.open();
  await reportCatalog.openTab(RM.category);
  await reportCatalog.openReport(RM.code);
  await expect(rm.title, 'Revenue Management Engine opened').toHaveText(RM.title);
  await expect(rm.tableRoot.locator('tbody tr').first(), 'Report rows loaded').toBeVisible({ timeout: 15_000 });
}

async function shown(rm: SingleReportPage): Promise<string> {
  const sel = await rm.selection();
  const text = (s: ReturnType<SingleReportPage['filter']>) => s.evaluate(e => (e as HTMLSelectElement).selectedOptions[0]?.text ?? '');
  const period = sel.period === 'custom' ? `${sel.from} → ${sel.to}` : await text(rm.periodSelect);
  return `Period ${period} · Project ${await text(rm.filter(PROJECT))} · View ${(await rm.isMine()) ? 'Mine' : 'All'}`;
}

async function methodology(rm: SingleReportPage): Promise<string[]> {
  return (await at(rm.page, REP_XP.definitionItems).allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
}

const name = (r: Row) => String(r[K.name]);

/** The logged-in user's id: the owner of their contracts' opportunities (none → nothing can be theirs). */
async function myUserId(rm: SingleReportPage, src: Sources): Promise<string> {
  const me = await rm.userName();
  return src.contracts.find(k => k.ownerName === me)?.ownerUserId ?? `(${me} owns no contracts)`;
}

/**
 * Checks every row of the selection on screen against Inventory and the current quarter's sales: the product's
 * unit count (for the project) and Actual Qtr Absorption between the units sold under SPA and those plus confirmed
 * reservations.
 */
async function verify(what: string, rm: SingleReportPage, src: Sources, myId?: string) {
  const data = await rm.data();
  const q = quarterOf(new Date());
  const project = data.query.projectCode;
  const owner = data.query.view === 'self' ? myId : undefined;
  note(what, `${await shown(rm)} · quarter ${q.from} – ${q.to}${owner ? ` · owner ${owner}` : ''}`);
  for (const r of data.rows) {
    const p = productOf(name(r), src.products);
    expect.soft(p, `${what}: "${name(r)}" matches an Inventory product`).toBeDefined();
    if (!p) continue;
    const units = src.units.filter(u => u.productCode === p.productCode && (!project || u.projectCode === project)).length;
    const a = absorbed(p, src, q, owner);
    const actual = Number(r[K.actual]);
    note(`${what} · ${name(r)}`, `${p.productCode}: ${units} units · sold under SPA ${a.must} · with confirmed reservations ${a.may}  |  report: ${r[K.units]} units · actual ${actual}`);
    expect.soft(Number(r[K.units]), `${what} · ${name(r)}: Total Units = ${p.productCode} units in Inventory`).toBe(units);
    expect.soft(actual >= a.must && actual <= a.may, `${what} · ${name(r)}: Actual Qtr Absorption ${actual} between SPAs ${a.must} and SPAs + confirmed reservations ${a.may} this quarter`).toBe(true);
  }
  return data;
}

test.describe('Reports · RPT-18 Revenue Management Engine', () => {
  // ── 1. Navigation ──────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-137'), async ({ reportCatalog, revenueManagement: rm, page }) => {
    rm.watchErrors();
    await reportCatalog.open();
    await reportCatalog.openTab(RM.category);
    const card = await reportCatalog.readCard(RM.code);
    note('card', `${card.code} · ${card.title} · ${card.category}`);
    expect.soft(card.title, 'Card title').toBe(RM.title);
    await reportCatalog.openReport(RM.code);
    await expect.soft(page, 'URL').toHaveURL(new RegExp(`${RM.route}\\?${RM.query}`));
    await expect.soft(rm.code, 'Report code').toHaveText(RM.code);
    await expect.soft(rm.title, 'Report title').toHaveText(RM.title);
    await expect(rm.tableRoot.locator('tbody tr').first(), 'Report rows loaded').toBeVisible({ timeout: 15_000 });
    await rm.expectNoBrokenValues();
    rm.expectNoErrors();
  });

  test(...rep('REP-138'), async ({ reportCatalog, revenueManagement: rm, page }) => {
    await openReport(reportCatalog, rm);
    await expect.soft(rm.backLink, 'Back link').toHaveText(RM.backLabel);
    for (const code of RM.siblings) {
      await expect.soft(rm.siblingPill(code), `Pill ${code}`).toBeVisible();
      await rm.siblingPill(code).click();
      await expect.soft(rm.code, `${code} opens`).toHaveText(code);
      await rm.open();
      await expect(rm.code, 'Back on RPT-18').toHaveText(RM.code);
    }
    await rm.backLink.click();
    await expect.soft(page, 'Back link → catalogue').toHaveURL(new RegExp(ROUTES.hub));
    await expect.soft(reportCatalog.tab(RM.category), 'Inventory Reports tab selected').toHaveAttribute('aria-selected', 'true');
  });

  test(...rep('REP-139'), async ({ reportCatalog, revenueManagement: rm, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, rm);
    const data = await rm.data();
    const total = await rm.totalRecords();
    const rows = (await rm.rows()).length;
    const stated = numbers(entry(await methodology(rm), 'Total Records in Report') ?? '')[0];
    const created = await rm.tile(T.created);
    const by = await rm.tile(T.createdBy);
    const user = await rm.userName();
    note('header', `Total ${total} · rows ${rows} · API total ${data.total} · methodology ${stated} · Inventory products ${src.products.length} · Created ${created} · Created By ${by} · logged in as ${user}`);
    expect.soft(total, 'Total Records = rows shown').toBe(rows);
    expect.soft(total, 'Total Records = API total').toBe(data.total);
    expect.soft(total, 'Total Records = the count the methodology states').toBe(stated);
    expect.soft(total, 'Total Records = products in Inventory').toBe(src.products.length);
    const when = new Date(created.replace(',', ''));
    expect.soft(!isNaN(+when) && Math.abs(+when - Date.now()) < CREATED_WITHIN_MS, `Created date/time is now (${created})`).toBeTruthy();
    expect.soft(by.replace(/\s*\([^)]*\)$/, ''), 'Created By = logged-in user').toBe(user);
  });

  // ── 2. Structure ───────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-140'), async ({ reportCatalog, revenueManagement: rm }) => {
    await openReport(reportCatalog, rm);
    const headers = await rm.headers();
    const rows = await rm.rows();
    const names = rows.map(r => r[RM.columns[0]]);
    note('table', `${headers.join(' | ')} · ${names.length} sub-categories`);
    expect.soft(headers, 'Columns').toEqual(RM.columns);
    expect.soft(names.filter((n, i) => names.indexOf(n) !== i), 'Sub-categories listed twice').toEqual([]);
    const blank = rows.flatMap(r => RM.columns.filter(c => !/\S/.test(r[c] ?? '') || /^[—–-]$/.test(r[c].trim())).map(c => `${r[RM.columns[0]]} · ${c}`));
    expect.soft(blank, 'Empty cells').toEqual([]);
    const last = rm.tableRoot.locator('thead th').last();
    await last.scrollIntoViewIfNeeded();
    await expect.soft(last, `Last column "${RM.columns.at(-1)}" can be brought into view`).toBeInViewport();
    const filters = (await rm.page.locator('main section.crm-report-toolbar label .crm-label').allInnerTexts()).map(l => l.trim());
    expect.soft(filters, 'Filters').toEqual(RM.filterLabels);
  });

  test(...rep('REP-141'), async ({ reportCatalog, revenueManagement: rm }) => {
    await openReport(reportCatalog, rm);
    const terms = await rm.definedTerms();
    const items = await methodology(rm);
    const actions = Object.values(RM.actions).flatMap(a => typeof a === 'string' ? [a] : Object.values(a));
    note('defined', terms.join(' | '));
    expect.soft(RM.columns.filter(c => !terms.includes(c)), 'Columns without an explanation').toEqual([]);
    expect.soft(Object.values(T).filter(t => !terms.some(d => d.startsWith(t))), 'Header items without an explanation').toEqual([]);
    expect.soft(STATUSES.filter(s => !entry(items, s)), 'Demand statuses the methodology does not define').toEqual([]);
    expect.soft(actions.filter(a => !entry(items, a)), 'Pricing actions the methodology does not define').toEqual([]);
  });

  test(...rep('REP-142'), async ({ reportCatalog, revenueManagement: rm }) => {
    await openReport(reportCatalog, rm);
    const data = await rm.data();
    const rows = await rm.rows();
    const wrong: string[] = [];
    data.rows.forEach((api, i) => {
      for (const c of data.columns) {
        const v = rows[i]?.[c.label] ?? '';
        const same = c.format === 'text' ? v === String(api[c.key] ?? '') : close(parseNum(v.replace(/[−–]/g, '-')), Number(api[c.key]));
        if (!same) wrong.push(`${api[K.name]} · ${c.label}: shown "${v}" · data ${api[c.key]}`);
      }
    });
    if (wrong.length) note('differences', wrong.join(' | '));
    expect.soft(rows.length, 'Rows shown = rows in the data').toBe(data.rows.length);
    expect.soft(wrong, 'Cells that differ from the report data').toEqual([]);
  });

  // ── 3. Engine rules ────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-143'), async ({ reportCatalog, revenueManagement: rm }) => {
    await openReport(reportCatalog, rm);
    for (const r of (await rm.data()).rows) {
      const exp = Number(r[K.target]) ? Number((Number(r[K.actual]) / Number(r[K.target]) * 100).toFixed(PCT_DECIMALS)) : 0;
      note(name(r), `${r[K.actual]} ÷ ${r[K.target]} × 100 = ${exp}% · shown ${r[K.achievement]}%`);
      expect.soft(Number(r[K.achievement]), `${name(r)}: Target Achievement % = Actual ÷ Target × 100`).toBeCloseTo(exp, PCT_DECIMALS);
    }
  });

  test(...rep('REP-144'), async ({ reportCatalog, revenueManagement: rm }) => {
    await openReport(reportCatalog, rm);
    const bands = bandsOf(await methodology(rm), STATUSES);
    note('bands', bands.map(b => `${b.status} ${b.min}…${b.max}`).join(' · '));
    expect(bands.length, 'The methodology states a band for every status').toBe(STATUSES.length);
    for (const r of (await rm.data()).rows) {
      const a = Number(r[K.achievement]);
      const exp = statusFor(a, bands);
      note(name(r), `${a}% → ${exp} · shown ${r[K.status]}`);
      expect.soft(r[K.status], `${name(r)}: ${a}% is ${exp}`).toBe(exp);
    }
  });

  test(...rep('REP-145'), async ({ reportCatalog, revenueManagement: rm, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, rm);
    for (const r of (await rm.data()).rows) {
      const p = productOf(name(r), src.products);
      const exp = actionFor(String(r[K.status]), p?.unitType ?? '');
      note(name(r), `${r[K.status]} (${p?.unitType ?? 'unknown type'}) → ${exp ?? '(no rule)'} · shown ${r[K.action]}`);
      expect.soft(r[K.action], `${name(r)}: pricing action for ${r[K.status]}`).toBe(exp);
    }
  });

  test(...rep('REP-146'), async ({ reportCatalog, revenueManagement: rm }) => {
    await openReport(reportCatalog, rm);
    for (const r of (await rm.data()).rows) {
      const exp = adjustmentOf(String(r[K.action]));
      note(name(r), `"${r[K.action]}" → ${exp}% · shown ${r[K.adjustment]}%`);
      expect.soft(Number(r[K.adjustment]), `${name(r)}: Rate Adjustment % = the action's adjustment`).toBe(exp);
    }
  });

  test(...rep('REP-147'), async ({ reportCatalog, revenueManagement: rm }) => {
    await openReport(reportCatalog, rm);
    const rows = (await rm.data()).rows;
    for (const r of rows) {
      const exp = Math.round(Number(r[K.base]) * (1 + Number(r[K.adjustment]) / 100));
      note(name(r), `${r[K.base]} × (1 + ${r[K.adjustment]}%) = ${exp} · shown ${r[K.adjusted]}`);
      expect.soft(Number(r[K.adjusted]), `${name(r)}: Adjusted Rate = Base × (1 + Rate Adjustment %)`).toBe(exp);
    }
    const examples = numbers(entry(await methodology(rm), RM.columns.at(-1)!) ?? '').filter(n => n > 100);
    const computed = new Set(rows.map(r => Number(r[K.adjusted])));
    note('methodology examples', examples.join(', '));
    expect.soft(examples.filter(e => !computed.has(e)), 'Adjusted rates the methodology gives as examples appear in the report').toEqual([]);
  });

  test(...rep('REP-148'), async ({ reportCatalog, revenueManagement: rm }) => {
    await openReport(reportCatalog, rm);
    const bad: string[] = [];
    for (const r of (await rm.data()).rows) {
      const [units, target, actual] = [Number(r[K.units]), Number(r[K.target]), Number(r[K.actual])];
      if (!(units > 0)) bad.push(`${name(r)}: Total Units ${units}`);
      if (!(target > 0 && target <= units)) bad.push(`${name(r)}: Target ${target} not within 1…${units}`);
      if (!(actual >= 0 && actual <= units)) bad.push(`${name(r)}: Actual ${actual} not within 0…${units}`);
    }
    note('bounds', bad.join(' | ') || 'all within bounds');
    expect.soft(bad, 'Counts within bounds').toEqual([]);
  });

  // ── 4. Source data ─────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-149'), async ({ reportCatalog, revenueManagement: rm, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, rm);
    const rows = (await rm.data()).rows;
    const matched = rows.map(r => ({ r, p: productOf(name(r), src.products) }));
    note('matching', matched.map(m => `${name(m.r)} → ${m.p?.productCode ?? 'none'}`).join(' · '));
    expect.soft(matched.filter(m => !m.p).map(m => name(m.r)), 'Sub-categories without an Inventory product').toEqual([]);
    const used = matched.map(m => m.p?.productCode).filter(Boolean);
    expect.soft(used.filter((c, i) => used.indexOf(c) !== i), 'Products matched twice').toEqual([]);
    expect.soft(src.products.filter(p => !used.includes(p.productCode)).map(p => `${p.productCode} ${p.name}`), 'Inventory products without a sub-category row').toEqual([]);
  });

  test(...rep('REP-150'), async ({ reportCatalog, revenueManagement: rm, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, rm);
    const data = await rm.data();
    let sum = 0;
    for (const r of data.rows) {
      const p = productOf(name(r), src.products);
      if (!p) continue;
      const units = src.units.filter(u => u.productCode === p.productCode).length;
      sum += Number(r[K.units]);
      note(name(r), `${p.productCode}: ${units} units in Inventory · report ${r[K.units]}`);
      expect.soft(Number(r[K.units]), `${name(r)}: Total Units = ${p.productCode} units in Inventory`).toBe(units);
    }
    note('portfolio', `report ${sum} · Inventory ${src.units.length}`);
    expect.soft(sum, 'Total Units over all sub-categories = units in Inventory').toBe(src.units.length);
  });

  test(...rep('REP-151'), async ({ reportCatalog, revenueManagement: rm, crmData }) => {
    const src = await sources(crmData);
    const assumptions = await crmData.governanceTable(CA.panelId);
    const rates = assumptions.filter(a => a.unitOfMeasure?.includes(CA.perArea)).map(a => ({ types: unitTypesOf(a.parameter), rate: value(a.baseValue) }));
    await openReport(reportCatalog, rm);
    for (const r of (await rm.data()).rows) {
      const p = productOf(name(r), src.products);
      if (!p) continue;
      const rpt03 = rates.find(x => x.types.includes(p.unitType.toLowerCase()))?.rate;
      note(name(r), `report ${r[K.base]} · ${p.productCode} rate ${p.ratePerSqm} · RPT-03 ${rpt03 ?? '(none)'}`);
      expect.soft(Number(r[K.base]), `${name(r)}: Base Avg Rate = ${p.productCode} rate per sqm`).toBe(p.ratePerSqm);
      expect.soft(Number(r[K.base]), `${name(r)}: Base Avg Rate = RPT-03 Base Price / sqm for ${p.unitType}`).toBe(rpt03);
    }
  });

  test(...rep('REP-152'), async ({ reportCatalog, revenueManagement: rm, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, rm);
    await verify('Current quarter', rm, src);
  });

  test(...rep('REP-153'), async ({ reportCatalog, revenueManagement: rm, propertySummary: ps, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, rm);
    const rows = (await rm.data()).rows;
    await reportCatalog.open();
    await reportCatalog.openTab(PS.category);
    await reportCatalog.openReport(PS.code);
    const categories = (await ps.data()).rows;
    const types = [...new Set(src.products.map(p => p.unitType))];
    for (const c of categories) {
      const type = typeOf(String(c[PS.keys.category]), types);
      const sum = rows.filter(r => productOf(name(r), src.products)?.unitType === type).reduce((s, r) => s + Number(r[K.units]), 0);
      note(String(c[PS.keys.category]), `RPT-21 Total Keys ${c[PS.keys.keys]} · RPT-18 ${type} units ${sum}`);
      expect.soft(sum, `${c[PS.keys.category]}: RPT-18 units of ${type} = RPT-21 Total Keys`).toBe(Number(c[PS.keys.keys]));
    }
  });

  // ── 5. Filters ─────────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-154'), async ({ reportCatalog, revenueManagement: rm }) => {
    await openReport(reportCatalog, rm);
    const labels = (await rm.periodSelect.locator('option').allInnerTexts()).map(o => o.trim());
    note('options', labels.join(' | '));
    expect.soft(labels, 'Period options').toEqual(REP_TEXT.periods);
    expect.soft(await rm.period(), 'Default period').toBe('this_month');
    await expect.soft(rm.viewButton('All'), 'All is selected by default').toHaveAttribute('aria-pressed', 'true');
  });

  test(...rep('REP-155'), async ({ reportCatalog, revenueManagement: rm, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, rm);
    for (const p of PRESET_PERIODS) {
      await rm.setPeriod(p);
      await verify(`Period ${p}`, rm, src);
    }
  });

  test(...rep('REP-156'), async ({ reportCatalog, revenueManagement: rm, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, rm);
    const today = new Date();
    await rm.setCustomRange(ymd(new Date(+today - 30 * 864e5)), ymd(today));
    await verify('Custom dates', rm, src);
  });

  test(...rep('REP-157'), async ({ reportCatalog, revenueManagement: rm, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, rm);
    const projects = await rm.options(PROJECT);
    note('projects', projects.map(o => `${o.label} (${o.value})`).join(', '));
    test.skip(!projects.length, 'The Project dropdown has no projects');
    for (const o of projects) {
      await rm.setFilterValue(PROJECT, o.value);
      await verify(`Project ${o.label}`, rm, src);
    }
  });

  test(...rep('REP-158'), async ({ reportCatalog, revenueManagement: rm, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, rm);
    const me = await myUserId(rm, src);
    await rm.setView('Mine');
    await expect.soft(rm.viewButton('Mine'), 'Mine is selected').toHaveAttribute('aria-pressed', 'true');
    await verify('Mine', rm, src, me);
  });

  test(...rep('REP-159'), async ({ reportCatalog, revenueManagement: rm }) => {
    await openReport(reportCatalog, rm);
    const before = await rm.selection();
    const defaults = (await rm.data()).rows;
    const [project] = await rm.options(PROJECT);
    await rm.setPeriod(PRESET_PERIODS.find(p => p !== before.period)!);
    if (project) await rm.setFilterValue(PROJECT, project.value);
    note('changed to', await shown(rm));
    await rm.resetFilters();
    note('after reset', await shown(rm));
    const { view, ...filters } = await rm.selection();
    expect.soft(filters, 'Period and Project back to the defaults').toEqual(before);
    if (view === 'self') await rm.setView('All');
    const after: ReportData = await rm.data();
    expect.soft(after.rows, 'Values back to the default values').toEqual(defaults);
  });

  // ── 6. Export ──────────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-160'), async ({ reportCatalog, revenueManagement: rm }) => {
    await openReport(reportCatalog, rm);
    const headers = await rm.headers();
    const total = await rm.totalRecords();
    const { sheet } = await rm.export();
    note('file', `${sheet.name} · sheet "${sheet.sheetName}" · ${sheet.rows.length} rows · ${sheet.header.join(' | ')}`);
    expect.soft(sheet.name, 'File name is .xlsx').toMatch(/\.xlsx$/i);
    expect.soft(sheet.magic, 'File is an Excel (zip) workbook').toBe('PK');
    expect.soft(sheet.sheetName, 'Sheet name').toBe(RM.exportSheet);
    expect.soft(sheet.header, 'Export columns = report columns').toEqual(headers);
    expect.soft(sheet.rows.length, 'Exported rows = Total Records').toBe(total);
  });

  test(...rep('REP-161'), async ({ reportCatalog, revenueManagement: rm }) => {
    await openReport(reportCatalog, rm);
    const data = await rm.data();
    const { sheet } = await rm.export();
    const wrong: string[] = [];
    data.rows.forEach((api, i) => {
      for (const c of data.columns) {
        const v = sheet.rows[i]?.[c.label];
        const same = c.format === 'text' ? String(v ?? '') === String(api[c.key] ?? '') : close(Number(v), Number(api[c.key]));
        if (!same) wrong.push(`${api[K.name]} · ${c.label}: file "${v}" · report ${api[c.key]}`);
      }
    });
    note('export', `${sheet.name}: ${sheet.rows.length} rows${wrong.length ? ` · differences: ${wrong.join(' | ')}` : ''}`);
    expect.soft(sheet.rows.map(r => String(r[RM.columns[0]])), 'Same sub-categories, in order').toEqual(data.rows.map(name));
    expect.soft(wrong, 'Cells that differ between the report and the file').toEqual([]);
  });

  test(...rep('REP-162'), async ({ reportCatalog, revenueManagement: rm }) => {
    await openReport(reportCatalog, rm);
    await rm.setPeriod('this_quarter');
    const [project] = await rm.options(PROJECT);
    if (project) await rm.setFilterValue(PROJECT, project.value);
    const selection = await rm.selection();
    const data = await rm.data();
    const { sheet, query } = await rm.export();
    note('export', `${await shown(rm)} · export request ${new URLSearchParams(query)}`);
    expect.soft(query, 'Export request carries the selected filters').toEqual(selection);
    expect.soft(sheet.rows.map(r => Number(r[RM.columns[3]])), 'File Actual Qtr Absorption = report for the selection').toEqual(data.rows.map(r => Number(r[K.actual])));
  });

  // ── Additional: negative and boundary ──────────────────────────────────────────────────────────
  test(...rep('REP-163'), async ({ reportCatalog, revenueManagement: rm }) => {
    await openReport(reportCatalog, rm);
    const today = new Date();
    const from = ymd(today), to = ymd(new Date(+today - 864e5));
    await rm.setPeriod('custom');
    await rm.page.locator('main input[type=date]').nth(0).fill(from);
    await rm.page.locator('main input[type=date]').nth(1).fill(to);
    const message = rm.message(REP_TEXT.rangeError).first();
    const shownMsg = await message.waitFor({ timeout: 10_000 }).then(() => true, () => false);
    note('inverted range', `From ${from} · To ${to} · message ${shownMsg ? 'shown' : 'not shown'} · rows still listed ${(await rm.rows()).length}`);
    expect.soft(shownMsg, `Validation message "${REP_TEXT.rangeError}"`).toBe(true);
  });

  test(...rep('REP-164'), async ({ reportCatalog, revenueManagement: rm, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, rm);
    await rm.setPeriod('last_month');
    const before = await shown(rm);
    await rm.page.reload();
    await expect(rm.tableRoot.locator('tbody tr').first(), 'Report reloaded').toBeVisible({ timeout: 20_000 });
    note('refresh', `before: ${before}  →  after: ${await shown(rm)}`);
    await verify('After refresh', rm, src);
  });
});
