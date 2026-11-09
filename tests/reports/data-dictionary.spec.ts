/**
 * Reports workbook — RPT-23 Master Data Dictionary & Report Index (REP-083 … REP-109).
 * Reports & Analytics → Executive & Governance tab → "Open RPT-23 →". The dictionary is reference data: its rows
 * are checked against its own methodology and description, the report catalogue, RPT-01's methodology, Inventory
 * and RPT-03, and must not change with the period, project, salesperson or view. Read-only.
 */
import { test, expect, note } from '../pages/fixtures';
import { REP_TEXT, REP_XP, ROUTES, at } from '../locators';
import { ymd } from '../helpers';
import type { SingleReportPage } from '../pages/SingleReportPage';
import type { ReportCatalogPage } from '../pages/ReportCatalogPage';
import { rep } from './catalog';
import { CREATED_WITHIN_MS, PRESET_PERIODS } from './lead-register.data';
import {
  codeRange, entry, feeRateIn, functionsIn, listed, names, reportNo, sheetOf, stated, statementFor, unitCountIn, value,
} from './data-dictionary.data';

const DD = REP_TEXT.dataDictionary;
const CA = REP_TEXT.controlAssumptions;
const ED = REP_TEXT.executiveDashboard;
const T = REP_TEXT.tiles;
const PROJECT = 'Project';
const SALES = 'Salesperson';
const [CODE, TERM, DEFINITION, FORMULA, SOURCE] = DD.columns;

test.describe.configure({ timeout: 300_000 });

// ── Report helpers ──────────────────────────────────────────────────────────────────────────────
/** Opens RPT-23 the way a user does: catalogue → Executive & Governance tab → Open RPT-23. */
async function openReport(reportCatalog: ReportCatalogPage, dd: SingleReportPage) {
  await reportCatalog.open();
  await reportCatalog.openTab(DD.category);
  await reportCatalog.openReport(DD.code);
  await expect(dd.title, 'Data Dictionary opened').toHaveText(DD.title);
  await expect(dd.tableRoot.locator('tbody tr').first(), 'Report rows loaded').toBeVisible({ timeout: 15_000 });
}

/** The selection on screen in words, for the report. */
async function shown(dd: SingleReportPage): Promise<string> {
  const text = async (s: ReturnType<SingleReportPage['filter']>) =>
    (await s.count()) ? s.evaluate(e => (e as HTMLSelectElement).selectedOptions[0]?.text ?? '') : '(hidden)';
  const sel = await dd.selection();
  const period = sel.period === 'custom' ? `${sel.from} → ${sel.to}` : await text(dd.periodSelect);
  return `Period ${period} · Project ${await text(dd.filter(PROJECT))} · Salesperson ${await text(dd.filter(SALES))} · View ${(await dd.isMine()) ? 'Mine' : 'All'}`;
}

/** Every entry of the methodology section, and the section as one text. */
async function methodology(page: SingleReportPage['page']): Promise<{ items: string[]; text: string }> {
  const items = (await at(page, REP_XP.definitionItems).allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
  const text = ((await at(page, REP_XP.definitions).textContent()) ?? '').replace(/\s+/g, ' ');
  return { items, text };
}

/** The dictionary for the selection on screen must equal the default dictionary. */
async function verifySame(what: string, dd: SingleReportPage, defaults: Record<string, unknown>[]) {
  const data = await dd.data();
  const rows = await dd.rows();
  note(what, `${await shown(dd)} · ${rows.length} rows · Total Records ${await dd.totalRecords()}`);
  expect.soft(data.rows, `${what}: same definitions as the default dictionary`).toEqual(defaults);
  expect.soft(rows.length, `${what}: rows shown = dictionary size`).toBe(defaults.length);
  expect.soft(await dd.totalRecords(), `${what}: Total Records = dictionary size`).toBe(defaults.length);
}

test.describe('Reports · RPT-23 Master Data Dictionary & Report Index', () => {
  // ── 1. Navigation ──────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-083'), async ({ reportCatalog, dataDictionary: dd, page }) => {
    dd.watchErrors();
    await reportCatalog.open();
    await reportCatalog.openTab(DD.category);
    const card = await reportCatalog.readCard(DD.code);
    note('card', `${card.code} · ${card.title} · ${card.category} · columns ${card.columns.join(', ')}`);
    expect.soft(card.title, 'Card title').toBe(DD.title);
    await reportCatalog.openReport(DD.code);
    await expect.soft(page, 'URL').toHaveURL(new RegExp(`${DD.route}\\?${DD.query}`));
    await expect.soft(dd.code, 'Report code').toHaveText(DD.code);
    await expect.soft(dd.title, 'Report title').toHaveText(DD.title);
    await expect(dd.tableRoot.locator('tbody tr').first(), 'Report rows loaded').toBeVisible({ timeout: 15_000 });
    await dd.expectNoBrokenValues();
    dd.expectNoErrors();
  });

  test(...rep('REP-084'), async ({ reportCatalog, controlAssumptions: ca, dataDictionary: dd, page }) => {
    await reportCatalog.open();
    await reportCatalog.openTab(CA.category);
    await reportCatalog.openReport(CA.code);
    await expect(ca.title, 'RPT-03 opened').toHaveText(CA.title);
    await ca.siblingPill(DD.code).click();
    await expect.soft(page, 'RPT-23 pill → RPT-23').toHaveURL(new RegExp(DD.query));
    await expect.soft(dd.title, 'RPT-23 title').toHaveText(DD.title);
    await expect.soft(dd.siblingPill(DD.code), 'RPT-23 pill marked current').toHaveClass(/active|current|selected/);
    await expect.soft(dd.backLink, 'Back link').toHaveText(DD.backLabel);
    await dd.backLink.click();
    await expect.soft(page, 'Back link → catalogue').toHaveURL(new RegExp(ROUTES.hub));
    await expect.soft(reportCatalog.tab(DD.category), 'Executive & Governance tab selected').toHaveAttribute('aria-selected', 'true');
  });

  test(...rep('REP-085'), async ({ reportCatalog, dataDictionary: dd }) => {
    await openReport(reportCatalog, dd);
    const data = await dd.data();
    const total = await dd.totalRecords();
    const rows = (await dd.rows()).length;
    const { items } = await methodology(dd.page);
    const statedCount = value(stated(items, 'Total Records in Report') ?? '');
    const created = await dd.tile(T.created);
    const by = await dd.tile(T.createdBy);
    const user = await dd.userName();
    note('header', `Total ${total} · rows ${rows} · API total ${data.total} · methodology ${statedCount} · Created ${created} · Created By ${by} · logged in as ${user}`);
    expect.soft(total, 'Total Records = rows shown').toBe(rows);
    expect.soft(total, 'Total Records = API total').toBe(data.total);
    expect.soft(total, 'Total Records = the count the methodology states').toBe(statedCount);
    const when = new Date(created.replace(',', ''));
    expect.soft(!isNaN(+when) && Math.abs(+when - Date.now()) < CREATED_WITHIN_MS, `Created date/time is now (${created})`).toBeTruthy();
    expect.soft(by.replace(/\s*\([^)]*\)$/, ''), 'Created By = logged-in user').toBe(user);
  });

  // ── 2. Structure ───────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-086'), async ({ reportCatalog, dataDictionary: dd }) => {
    await openReport(reportCatalog, dd);
    const headers = await dd.headers();
    const rows = await dd.rows();
    const codes = rows.map(r => r[CODE]);
    note('table', `${headers.join(' | ')} · codes: ${codes.join(', ')}`);
    expect.soft(headers, 'Columns').toEqual(DD.columns);
    expect.soft(codes.filter((c, i) => codes.indexOf(c) !== i), 'Term Codes listed twice').toEqual([]);
    const terms = rows.map(r => r[TERM]);
    expect.soft(terms.filter((c, i) => terms.indexOf(c) !== i), 'KPI / Control Terms listed twice').toEqual([]);
    const blank = rows.flatMap(r => DD.columns.filter(c => !/\S/.test(r[c] ?? '') || /^[—–-]$/.test(r[c].trim())).map(c => `${r[CODE]} · ${c}`));
    expect.soft(blank, 'Empty cells').toEqual([]);
  });

  test(...rep('REP-087'), async ({ reportCatalog, dataDictionary: dd }) => {
    await openReport(reportCatalog, dd);
    const { items } = await methodology(dd.page);
    const range = codeRange(entry(items, CODE) ?? '');
    const codes = (await dd.rows()).map(r => r[CODE]);
    note('codes', `methodology: ${range.join(', ') || '(no range)'} · table: ${codes.join(', ')}`);
    expect.soft(range.length, 'The methodology states the Term Code range').toBeGreaterThan(0);
    expect.soft(codes, 'Term Codes are the stated range, in order').toEqual(range);
  });

  test(...rep('REP-088'), async ({ reportCatalog, dataDictionary: dd }) => {
    await openReport(reportCatalog, dd);
    const terms = await dd.definedTerms();
    note('defined', terms.join(' | '));
    expect.soft(DD.columns.filter(c => !terms.includes(c)), 'Columns without an explanation').toEqual([]);
    expect.soft(Object.values(T).filter(t => !terms.some(d => d.startsWith(t))), 'Header items without an explanation').toEqual([]);
  });

  test(...rep('REP-089'), async ({ reportCatalog, dataDictionary: dd }) => {
    await openReport(reportCatalog, dd);
    const data = await dd.data();
    const rows = await dd.rows();
    const wrong: string[] = [];
    data.rows.forEach((api, i) => {
      for (const c of data.columns) if ((rows[i]?.[c.label] ?? '') !== String(api[c.key] ?? '')) wrong.push(`row ${i + 1} ${c.label}: shown "${rows[i]?.[c.label]}" · data "${api[c.key]}"`);
    });
    if (wrong.length) note('differences', wrong.join(' | '));
    expect.soft(rows.length, 'Rows shown = rows in the data').toBe(data.rows.length);
    expect.soft(wrong, 'Cells that differ from the report data').toEqual([]);
  });

  test(...rep('REP-090'), async ({ reportCatalog, dataDictionary: dd }) => {
    await openReport(reportCatalog, dd);
    const last = dd.tableRoot.locator('thead th').last();
    const wrap = dd.tableRoot.locator('xpath=..');
    const size = await wrap.evaluate(w => ({ scroll: w.scrollWidth, client: w.clientWidth, overflow: getComputedStyle(w).overflowX }));
    note('table width', `content ${size.scroll}px · visible ${size.client}px · overflow-x ${size.overflow}`);
    if (size.scroll > size.client) expect.soft(['auto', 'scroll'], 'A wide table can scroll sideways').toContain(size.overflow);
    await last.scrollIntoViewIfNeeded();
    await expect.soft(last, `Last column "${DD.columns.at(-1)}" can be brought into view`).toBeInViewport();
    await expect.soft(dd.tableRoot.locator('tbody tr').first().locator('td').last(), 'Its first cell is visible too').toBeInViewport();
  });

  // ── 3. Definitions vs the rest of the CRM ──────────────────────────────────────────────────────
  test(...rep('REP-091'), async ({ reportCatalog, dataDictionary: dd }) => {
    await openReport(reportCatalog, dd);
    const { items } = await methodology(dd.page);
    const allowed = listed(items, FORMULA);
    note('functions', `methodology lists: ${allowed.join(', ') || '(none)'}`);
    expect.soft(allowed.length, 'The methodology lists the formula functions').toBeGreaterThan(0);
    for (const r of await dd.rows()) {
      const used = functionsIn(r[FORMULA]);
      note(r[CODE], `${r[FORMULA]} · functions: ${used.join(', ') || 'none'}`);
      expect.soft(used.filter(f => !allowed.includes(f)), `${r[CODE]}: functions the methodology does not list`).toEqual([]);
    }
  });

  test(...rep('REP-092'), async ({ reportCatalog, dataDictionary: dd, executiveDashboard: ed }) => {
    await openReport(reportCatalog, dd);
    const rows = await dd.rows();
    await dd.siblingPill(ED.code).click();
    await expect(ed.title, 'RPT-01 opened').toHaveText(ED.title);
    const { text } = await methodology(ed.page);
    let compared = 0;
    for (const r of rows) {
      const s = sheetOf(r[SOURCE]);
      const statement = s && statementFor(text, s.sheet);
      note(r[CODE], `${r[FORMULA]} · ${r[SOURCE]} · RPT-01: ${statement ?? '(does not cite this sheet)'}`);
      if (!statement) continue;
      compared++;
      expect.soft(statement.includes(r[FORMULA]), `${r[CODE]} ${r[TERM]}: RPT-01 calculates Sheet ${s!.sheet} with the same formula "${r[FORMULA]}"`).toBe(true);
    }
    expect(compared, 'RPT-01 cites at least one sheet of the dictionary').toBeGreaterThan(0);
  });

  test(...rep('REP-093'), async ({ reportCatalog, dataDictionary: dd, crmData }) => {
    const units = (await crmData.units()).length;
    await openReport(reportCatalog, dd);
    const claims = (await dd.rows()).flatMap(r => [DEFINITION, SOURCE].map(c => ({ where: `${r[CODE]} · ${c}`, n: unitCountIn(r[c]) }))).filter(x => x.n !== undefined);
    note('units', `Inventory ${units} units · dictionary: ${claims.map(c => `${c.where} ${c.n}`).join(', ') || 'no unit count stated'}`);
    test.skip(!claims.length, 'The dictionary states no unit count');
    for (const c of claims) expect.soft(c.n, `${c.where}: stated unit count = units in Inventory`).toBe(units);
  });

  test(...rep('REP-094'), async ({ reportCatalog, dataDictionary: dd, crmData }) => {
    const assumptions = await crmData.governanceTable(CA.panelId);
    const standard = value(assumptions.find(r => r.parameter === CA.brokerRate)?.baseValue ?? '');
    await openReport(reportCatalog, dd);
    const fees = (await dd.rows()).map(r => ({ code: r[CODE], rate: feeRateIn(r[DEFINITION]) })).filter(x => x.rate !== undefined);
    note('fees', `RPT-03 ${CA.brokerRate} ${standard}% · dictionary: ${fees.map(f => `${f.code} ${f.rate}%`).join(', ') || 'no fee stated'}`);
    test.skip(!fees.length, 'The dictionary states no fee rate');
    expect(Number.isFinite(standard), 'RPT-03 lists the standard broker rate').toBe(true);
    for (const f of fees) expect.soft(f.rate, `${f.code}: stated fee = RPT-03 standard broker rate`).toBe(standard);
  });

  test(...rep('REP-095'), async ({ reportCatalog, dataDictionary: dd }) => {
    await openReport(reportCatalog, dd);
    const rows = await dd.rows();
    const cards = await reportCatalog.allCards();
    for (const r of rows) {
      const s = sheetOf(r[SOURCE]);
      const report = s && cards.find(c => reportNo(c.code, DD.reportPrefix) === s.sheet);
      note(r[CODE], `${r[SOURCE]} → ${report ? `${report.code} "${report.title}" (${report.tab})` : 'no report in the catalogue'}`);
      expect.soft(s, `${r[CODE]}: source names a sheet`).toBeDefined();
      if (!s) continue;
      expect.soft(report, `${r[CODE]}: Sheet ${s.sheet} (${s.name}) exists as report ${DD.reportPrefix}${String(s.sheet).padStart(2, '0')} in the catalogue`).toBeDefined();
      if (report && s.name) expect.soft(names(report.title, s.name), `${r[CODE]}: ${report.code} "${report.title}" is "${s.name}"`).toBe(true);
    }
  });

  test(...rep('REP-096'), async ({ reportCatalog, dataDictionary: dd }) => {
    await openReport(reportCatalog, dd);
    const description = (await dd.description.innerText()).trim();
    const indexed = new Set((await dd.rows()).map(r => sheetOf(r[SOURCE])?.sheet).filter(n => n !== undefined));
    const numbered = (await reportCatalog.allCards()).filter(c => reportNo(c.code, DD.reportPrefix) !== undefined);
    const missing = numbered.filter(c => !indexed.has(reportNo(c.code, DD.reportPrefix)!));
    note('index', `description: "${description}" · catalogue ${numbered.length} numbered reports · indexed ${indexed.size} · not indexed: ${missing.map(c => c.code).join(', ')}`);
    test.skip(!description.toLowerCase().includes(DD.indexPromise), 'The description does not promise an index of all reports');
    expect.soft(missing.map(c => `${c.code} ${c.title}`), 'Catalogue reports the Report Index does not list').toEqual([]);
  });

  test(...rep('REP-097'), async ({ reportCatalog, dataDictionary: dd }) => {
    await openReport(reportCatalog, dd);
    const description = (await dd.description.innerText()).trim();
    const headers = await dd.headers();
    const words = DD.cadencePromise.split(' ');
    note('cadence', `description: "${description}" · columns: ${headers.join(' | ')}`);
    test.skip(!description.toLowerCase().includes(DD.cadencePromise), 'The description does not promise a refresh cadence');
    expect.soft(headers.some(h => words.some(w => h.toLowerCase().includes(w))), `A column shows the ${DD.cadencePromise} the description promises`).toBe(true);
  });

  // ── 4. Filters ─────────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-098'), async ({ reportCatalog, dataDictionary: dd }) => {
    await openReport(reportCatalog, dd);
    const labels = (await dd.periodSelect.locator('option').allInnerTexts()).map(o => o.trim());
    note('options', labels.join(' | '));
    expect.soft(labels, 'Period options').toEqual(REP_TEXT.periods);
    expect.soft(await dd.period(), 'Default period').toBe('this_month');
    await expect.soft(dd.viewButton('All'), 'All is selected by default').toHaveAttribute('aria-pressed', 'true');
  });

  test(...rep('REP-099'), async ({ reportCatalog, dataDictionary: dd }) => {
    await openReport(reportCatalog, dd);
    const defaults = (await dd.data()).rows;
    for (const p of PRESET_PERIODS) {
      await dd.setPeriod(p);
      await verifySame(`Period ${p}`, dd, defaults);
    }
  });

  test(...rep('REP-100'), async ({ reportCatalog, dataDictionary: dd }) => {
    await openReport(reportCatalog, dd);
    const defaults = (await dd.data()).rows;
    const today = new Date();
    await dd.setCustomRange(ymd(new Date(+today - 30 * 864e5)), ymd(today));
    await verifySame('Custom dates', dd, defaults);
  });

  test(...rep('REP-101'), async ({ reportCatalog, dataDictionary: dd }) => {
    await openReport(reportCatalog, dd);
    const defaults = (await dd.data()).rows;
    const projects = await dd.options(PROJECT);
    test.skip(!projects.length, 'The Project dropdown has no projects');
    for (const o of projects) {
      await dd.setFilterValue(PROJECT, o.value);
      await verifySame(`Project ${o.label}`, dd, defaults);
    }
  });

  test(...rep('REP-102'), async ({ reportCatalog, dataDictionary: dd }) => {
    await openReport(reportCatalog, dd);
    const defaults = (await dd.data()).rows;
    const people = await dd.options(SALES);
    test.skip(!people.length, 'The Salesperson dropdown has no salespeople');
    for (const o of people) {
      await dd.setFilterValue(SALES, o.value);
      await verifySame(`Salesperson ${o.label}`, dd, defaults);
    }
  });

  test(...rep('REP-103'), async ({ reportCatalog, dataDictionary: dd }) => {
    await openReport(reportCatalog, dd);
    const defaults = (await dd.data()).rows;
    await dd.setView('Mine');
    await expect.soft(dd.viewButton('Mine'), 'Mine is selected').toHaveAttribute('aria-pressed', 'true');
    await verifySame('Mine', dd, defaults);
  });

  test(...rep('REP-104'), async ({ reportCatalog, dataDictionary: dd }) => {
    await openReport(reportCatalog, dd);
    const before = await dd.selection();
    const defaults = (await dd.data()).rows;
    const [project] = await dd.options(PROJECT);
    const [person] = await dd.options(SALES);
    await dd.setPeriod(PRESET_PERIODS.find(p => p !== before.period)!);
    if (project) await dd.setFilterValue(PROJECT, project.value);
    if (person) await dd.setFilterValue(SALES, person.value);
    note('changed to', await shown(dd));
    await dd.resetFilters();
    note('after reset', await shown(dd));
    const { view, ...filters } = await dd.selection();
    expect.soft(filters, 'Period, Project and Salesperson back to the defaults').toEqual(before);
    if (view === 'self') await dd.setView('All');
    await verifySame('After reset', dd, defaults);
  });

  // ── 5. Export ──────────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-105'), async ({ reportCatalog, dataDictionary: dd }) => {
    await openReport(reportCatalog, dd);
    const headers = await dd.headers();
    const total = await dd.totalRecords();
    const { sheet } = await dd.export();
    note('file', `${sheet.name} · sheet "${sheet.sheetName}" · ${sheet.rows.length} rows · ${sheet.header.join(' | ')}`);
    expect.soft(sheet.name, 'File name is .xlsx').toMatch(/\.xlsx$/i);
    expect.soft(sheet.magic, 'File is an Excel (zip) workbook').toBe('PK');
    expect.soft(sheet.sheetName, 'Sheet name').toBe(DD.exportSheet);
    expect.soft(sheet.header, 'Export columns = report columns').toEqual(headers);
    expect.soft(sheet.rows.length, 'Exported rows = Total Records').toBe(total);
  });

  test(...rep('REP-106'), async ({ reportCatalog, dataDictionary: dd }) => {
    await openReport(reportCatalog, dd);
    const rows = await dd.rows();
    const { sheet } = await dd.export();
    const wrong: string[] = [];
    rows.forEach((r, i) => {
      for (const c of DD.columns) if (String(sheet.rows[i]?.[c] ?? '').trim() !== r[c]) wrong.push(`${r[CODE]} · ${c}: report "${r[c]}" · file "${sheet.rows[i]?.[c] ?? ''}"`);
    });
    if (wrong.length) note('differences', wrong.join(' | '));
    expect.soft(sheet.rows.map(r => String(r[CODE])), 'Same Term Codes, in order').toEqual(rows.map(r => r[CODE]));
    expect.soft(wrong, 'Cells that differ between the report and the file').toEqual([]);
  });

  test(...rep('REP-107'), async ({ reportCatalog, dataDictionary: dd }) => {
    await openReport(reportCatalog, dd);
    await dd.setPeriod('last_12_months');
    const [project] = await dd.options(PROJECT);
    const [person] = await dd.options(SALES);
    if (project) await dd.setFilterValue(PROJECT, project.value);
    if (person) await dd.setFilterValue(SALES, person.value);
    const selection = await dd.selection();
    const rows = await dd.rows();
    const { sheet, query } = await dd.export();
    note('export', `${await shown(dd)} · export request ${new URLSearchParams(query)} · file ${sheet.rows.length} rows`);
    expect.soft(query, 'Export request carries the selected filters').toEqual(selection);
    expect.soft(sheet.rows.map(r => String(r[CODE])), 'File holds the definitions shown').toEqual(rows.map(r => r[CODE]));
  });

  // ── Additional: negative and boundary ──────────────────────────────────────────────────────────
  test(...rep('REP-108'), async ({ reportCatalog, dataDictionary: dd }) => {
    await openReport(reportCatalog, dd);
    const today = new Date();
    const from = ymd(today), to = ymd(new Date(+today - 864e5));
    await dd.setPeriod('custom');
    await dd.page.locator('main input[type=date]').nth(0).fill(from);
    await dd.page.locator('main input[type=date]').nth(1).fill(to);
    const message = dd.message(REP_TEXT.rangeError).first();
    const shownMsg = await message.waitFor({ timeout: 10_000 }).then(() => true, () => false);
    note('inverted range', `From ${from} · To ${to} · message ${shownMsg ? 'shown' : 'not shown'} · rows still listed ${(await dd.rows()).length}`);
    expect.soft(shownMsg, `Validation message "${REP_TEXT.rangeError}"`).toBe(true);
  });

  test(...rep('REP-109'), async ({ reportCatalog, dataDictionary: dd }) => {
    await openReport(reportCatalog, dd);
    const defaults = (await dd.data()).rows;
    await dd.setPeriod('last_month');
    const [person] = await dd.options(SALES);
    if (person) await dd.setFilterValue(SALES, person.value);
    const before = await shown(dd);
    await dd.page.reload();
    await expect(dd.tableRoot.locator('tbody tr').first(), 'Report reloaded').toBeVisible({ timeout: 20_000 });
    note('refresh', `before: ${before}  →  after: ${await shown(dd)}`);
    await verifySame('After refresh', dd, defaults);
  });
});
