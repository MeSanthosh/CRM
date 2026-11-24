/**
 * Reports workbook — RPT-03 Control & Assumptions Register (REP-057 … REP-082).
 * Reports & Analytics → Executive & Governance tab → "Open RPT-03 →". The register is configuration: its rows are
 * checked against the report's own methodology, the Inventory products' rates and RPT-01's stated rates, and must
 * not change with the period, project, salesperson or view. Read-only.
 */
import { test, expect, note } from '../pages/fixtures';
import { REP_TEXT, REP_XP, ROUTES, at } from '../locators';
import { ymd } from '../helpers';
import type { SingleReportPage } from '../pages/SingleReportPage';
import type { ReportCatalogPage } from '../pages/ReportCatalogPage';
import { rep } from './catalog';
import { CREATED_WITHIN_MS, PRESET_PERIODS } from './lead-register.data';
import { type Row, entry, formatFor, listed, numbers, rateBefore, stated, unitTypesOf, value } from './control-assumptions.data';

const CA = REP_TEXT.controlAssumptions;
const ED = REP_TEXT.executiveDashboard;
const T = REP_TEXT.tiles;
const PROJECT = 'Project';
const SALES = 'Salesperson';
const [PARAM, BASE, OPT, CONS, UNIT, OWNER, REVIEW, LOGIC] = CA.columns;

test.describe.configure({ timeout: 300_000 });

// ── Report helpers ──────────────────────────────────────────────────────────────────────────────
/** Opens RPT-03 the way a user does: catalogue → Executive & Governance tab → Open RPT-03. */
async function openReport(reportCatalog: ReportCatalogPage, ca: SingleReportPage) {
  await reportCatalog.open();
  await reportCatalog.openTab(CA.category);
  await reportCatalog.openReport(CA.code);
  await expect(ca.title, 'Control & Assumptions Register opened').toHaveText(CA.title);
  await expect(ca.tableRoot.locator('tbody tr').first(), 'Report rows loaded').toBeVisible({ timeout: 15_000 });
}

/** The selection on screen in words, for the report. */
async function shown(ca: SingleReportPage): Promise<string> {
  const text = async (s: ReturnType<SingleReportPage['filter']>) =>
    (await s.count()) ? s.evaluate(e => (e as HTMLSelectElement).selectedOptions[0]?.text ?? '') : '(hidden)';
  const sel = await ca.selection();
  const period = sel.period === 'custom' ? `${sel.from} → ${sel.to}` : await text(ca.periodSelect);
  return `Period ${period} · Project ${await text(ca.filter(PROJECT))} · Salesperson ${await text(ca.filter(SALES))} · View ${(await ca.isMine()) ? 'Mine' : 'All'}`;
}

/** Every entry of the methodology section ("Owner: … (CFO, …)"). */
async function methodology(ca: SingleReportPage): Promise<string[]> {
  return (await at(ca.page, REP_XP.definitionItems).allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
}

const key = (r: Row) => r[PARAM];
const brief = (rows: Row[]) => rows.map(r => `${r[PARAM]} ${r[BASE]}`).join(' · ');

/** The register for the selection on screen: data and table, which must equal the default register. */
async function verifySame(what: string, ca: SingleReportPage, defaults: Record<string, unknown>[]) {
  const data = await ca.data();
  const rows = await ca.rows();
  note(what, `${await shown(ca)} · ${rows.length} rows · Total Records ${await ca.totalRecords()}`);
  expect.soft(data.rows, `${what}: same parameters and values as the default register`).toEqual(defaults);
  expect.soft(rows.length, `${what}: rows shown = register size`).toBe(defaults.length);
  expect.soft(await ca.totalRecords(), `${what}: Total Records = register size`).toBe(defaults.length);
}

test.describe('Reports · RPT-03 Control & Assumptions Register', () => {
  // ── 1. Navigation ──────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-057'), async ({ reportCatalog, controlAssumptions: ca, page }) => {
    ca.watchErrors();
    await reportCatalog.open();
    await reportCatalog.openTab(CA.category);
    const card = await reportCatalog.readCard(CA.code);
    note('card', `${card.code} · ${card.title} · ${card.category} · columns ${card.columns.join(', ')}`);
    expect.soft(card.title, 'Card title').toBe(CA.title);
    expect.soft(card.columns, 'Card lists the report columns').toEqual(CA.columns);
    await reportCatalog.openReport(CA.code);
    await expect.soft(page, 'URL').toHaveURL(new RegExp(`${CA.route}\\?${CA.query}`));
    await expect.soft(ca.code, 'Report code').toHaveText(CA.code);
    await expect.soft(ca.title, 'Report title').toHaveText(CA.title);
    await expect(ca.tableRoot.locator('tbody tr').first(), 'Report rows loaded').toBeVisible({ timeout: 15_000 });
    await ca.expectNoBrokenValues();
    ca.expectNoErrors();
  });

  test(...rep('REP-058'), async ({ reportCatalog, executiveDashboard: ed, controlAssumptions: ca, page }) => {
    await reportCatalog.open();
    await reportCatalog.openTab(ED.category);
    await reportCatalog.openReport(ED.code);
    await expect(ed.title, 'RPT-01 opened').toHaveText(ED.title);
    await ed.siblingPill(CA.code).click();
    await expect.soft(page, 'RPT-03 pill → RPT-03').toHaveURL(new RegExp(CA.query));
    await expect.soft(ca.title, 'RPT-03 title').toHaveText(CA.title);
    await expect.soft(ca.siblingPill(CA.code), 'RPT-03 pill marked current').toHaveClass(/active|current|selected/);
    await expect.soft(ca.backLink, 'Back link').toHaveText(CA.backLabel);
    await ca.backLink.click();
    await expect.soft(page, 'Back link → catalogue').toHaveURL(new RegExp(ROUTES.hub));
    await expect.soft(reportCatalog.tab(CA.category), 'Executive & Governance tab selected').toHaveAttribute('aria-selected', 'true');
    await expect.soft(reportCatalog.card(CA.code), 'RPT-03 card listed').toBeVisible();
  });

  test(...rep('REP-059'), async ({ reportCatalog, controlAssumptions: ca }) => {
    await openReport(reportCatalog, ca);
    const data = await ca.data();
    const total = await ca.totalRecords();
    const rows = (await ca.rows()).length;
    const statedCount = value(stated(await methodology(ca), 'Total Records in Report') ?? '');
    const created = await ca.tile(T.created);
    const by = await ca.tile(T.createdBy);
    const user = await ca.userName();
    note('header', `Total ${total} · rows ${rows} · API total ${data.total} · methodology ${statedCount} · Created ${created} · Created By ${by} · logged in as ${user}`);
    expect.soft(total, 'Total Records = rows shown').toBe(rows);
    expect.soft(total, 'Total Records = API total').toBe(data.total);
    expect.soft(total, 'Total Records = the count the methodology states').toBe(statedCount);
    const at_ = new Date(created.replace(',', ''));
    expect.soft(!isNaN(+at_) && Math.abs(+at_ - Date.now()) < CREATED_WITHIN_MS, `Created date/time is now (${created})`).toBeTruthy();
    expect.soft(by.replace(/\s*\([^)]*\)$/, ''), 'Created By = logged-in user').toBe(user);
  });

  // ── 2. Structure ───────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-060'), async ({ reportCatalog, controlAssumptions: ca }) => {
    await openReport(reportCatalog, ca);
    const headers = await ca.headers();
    const rows = await ca.rows();
    const params = rows.map(key);
    note('table', `${headers.join(' | ')} · parameters: ${params.join(' | ')}`);
    expect.soft(headers, 'Columns').toEqual(CA.columns);
    expect.soft(params.filter((p, i) => params.indexOf(p) !== i), 'Parameters listed twice').toEqual([]);
    const blank = rows.flatMap(r => CA.columns.filter(c => !/\S/.test(r[c] ?? '') || /^[—–-]$/.test(r[c].trim())).map(c => `${key(r)} · ${c}`));
    expect.soft(blank, 'Empty cells').toEqual([]);
  });

  test(...rep('REP-061'), async ({ reportCatalog, controlAssumptions: ca }) => {
    await openReport(reportCatalog, ca);
    const terms = await ca.definedTerms();
    const items = await methodology(ca);
    const params = (await ca.rows()).map(key);
    note('defined', terms.join(' | '));
    expect.soft(CA.columns.filter(c => !terms.includes(c)), 'Columns without an explanation').toEqual([]);
    expect.soft(Object.values(T).filter(t => !terms.some(d => d.startsWith(t))), 'Header items without an explanation').toEqual([]);
    expect.soft(params.filter(p => !entry(items, p)), 'Parameters the methodology does not explain').toEqual([]);
  });

  // ── 3. Values ──────────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-062'), async ({ reportCatalog, controlAssumptions: ca }) => {
    await openReport(reportCatalog, ca);
    const data = await ca.data();
    const rows = await ca.rows();
    const wrong: string[] = [];
    data.rows.forEach((api, i) => {
      for (const c of data.columns) if ((rows[i]?.[c.label] ?? '') !== String(api[c.key] ?? '')) wrong.push(`row ${i + 1} ${c.label}: shown "${rows[i]?.[c.label]}" · data "${api[c.key]}"`);
    });
    if (wrong.length) note('differences', wrong.join(' | '));
    expect.soft(rows.length, 'Rows shown = rows in the data').toBe(data.rows.length);
    expect.soft(wrong, 'Cells that differ from the report data').toEqual([]);
  });

  test(...rep('REP-063'), async ({ reportCatalog, controlAssumptions: ca }) => {
    await openReport(reportCatalog, ca);
    const data = await ca.data();
    const currency = (data.meta as { baseCurrencyCode?: string }).baseCurrencyCode || 'USD';
    for (const r of await ca.rows()) {
      const format = formatFor(r[UNIT], currency);
      note(key(r), `${r[UNIT]} · ${r[BASE]} / ${r[OPT]} / ${r[CONS]} · expected format ${format ?? '(unknown unit)'}`);
      expect.soft(format, `${key(r)}: unit "${r[UNIT]}" is a percentage or a ${currency} amount`).toBeDefined();
      if (format) for (const c of [BASE, OPT, CONS]) expect.soft(r[c], `${key(r)} · ${c} formatted as ${r[UNIT]}`).toMatch(format);
    }
  });

  test(...rep('REP-064'), async ({ reportCatalog, controlAssumptions: ca }) => {
    await openReport(reportCatalog, ca);
    const pct = (await ca.rows()).filter(r => r[UNIT] === CA.percentUnit);
    note('percentages', brief(pct));
    test.skip(!pct.length, 'No percentage parameters');
    for (const r of pct) for (const c of [BASE, OPT, CONS]) {
      const v = value(r[c]);
      expect.soft(v >= 0 && v <= 100, `${key(r)} · ${c} ${r[c]} is between 0% and 100%`).toBe(true);
    }
  });

  test(...rep('REP-065'), async ({ reportCatalog, controlAssumptions: ca }) => {
    await openReport(reportCatalog, ca);
    for (const r of await ca.rows()) {
      const [b, o, c] = [value(r[BASE]), value(r[OPT]), value(r[CONS])];
      note(key(r), `Optimistic ${r[OPT]} · Base ${r[BASE]} · Conservative ${r[CONS]}`);
      expect.soft(b >= Math.min(o, c) && b <= Math.max(o, c), `${key(r)}: Base ${r[BASE]} lies between Optimistic ${r[OPT]} and Conservative ${r[CONS]}`).toBe(true);
    }
  });

  test(...rep('REP-066'), async ({ reportCatalog, controlAssumptions: ca }) => {
    await openReport(reportCatalog, ca);
    const items = await methodology(ca);
    const rows = await ca.rows();
    for (const col of [UNIT, OWNER, REVIEW]) {
      const allowed = listed(items, col);
      const used = [...new Set(rows.map(r => r[col]))];
      note(col, `methodology: ${allowed.join(', ') || '(no list)'} · used: ${used.join(', ')}`);
      expect.soft(allowed.length, `The methodology lists the ${col} values`).toBeGreaterThan(0);
      expect.soft(used.filter(v => !allowed.includes(v)), `${col} values the methodology does not list`).toEqual([]);
    }
  });

  test(...rep('REP-067'), async ({ reportCatalog, controlAssumptions: ca }) => {
    await openReport(reportCatalog, ca);
    const items = await methodology(ca);
    for (const r of await ca.rows()) {
      const s = stated(items, key(r));
      note(key(r), `table ${r[BASE]} · methodology ${s ?? '(not stated)'}`);
      expect.soft(s, `${key(r)}: the methodology states a base value`).toBeDefined();
      if (s) expect.soft(value(s), `${key(r)}: Base Value ${r[BASE]} = methodology "${s}"`).toBe(value(r[BASE]));
    }
  });

  test(...rep('REP-068'), async ({ reportCatalog, controlAssumptions: ca }) => {
    await openReport(reportCatalog, ca);
    const items = await methodology(ca);
    const withNumbers = (await ca.rows()).filter(r => numbers(r[LOGIC]).length);
    test.skip(!withNumbers.length, 'No Control Logic states a number');
    for (const r of withNumbers) {
      const known = [...numbers(entry(items, key(r)) ?? ''), value(r[BASE])];
      const odd = numbers(r[LOGIC]).filter(n => !known.includes(n));
      note(key(r), `Control Logic "${r[LOGIC]}" · Base ${r[BASE]} · methodology "${entry(items, key(r)) ?? ''}"`);
      expect.soft(odd, `${key(r)}: numbers in Control Logic "${r[LOGIC]}" agree with the Base Value and the methodology`).toEqual([]);
    }
  });

  // ── 4. Cross-module ────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-069'), async ({ reportCatalog, controlAssumptions: ca, crmData }) => {
    const products = await crmData.products();
    expect(products.length, 'Inventory products read').toBeGreaterThan(0);
    await openReport(reportCatalog, ca);
    const rates = (await ca.rows()).filter(r => r[UNIT].includes(CA.perArea)).map(r => ({ row: r, types: unitTypesOf(key(r)) }));
    test.skip(!rates.length, 'The register has no per-area rate');
    note('rates', rates.map(x => `${key(x.row)} ${x.row[BASE]} → ${x.types.join(', ')}`).join(' · '));
    for (const p of products) {
      const rate = rates.find(x => x.types.includes(p.unitType.toLowerCase()));
      note(p.productCode, `${p.name} (${p.unitType}) ${p.ratePerSqm} ${p.currency}/sqm · register ${rate ? `${key(rate.row)} ${rate.row[BASE]}` : 'none'}`);
      expect.soft(rate, `${p.productCode} (${p.unitType}): the register has a base price for this unit type`).toBeDefined();
      if (rate) expect.soft(p.ratePerSqm, `${p.productCode} (${p.unitType}): Inventory rate = ${key(rate.row)}`).toBe(value(rate.row[BASE]));
    }
  });

  test(...rep('REP-070'), async ({ reportCatalog, controlAssumptions: ca, executiveDashboard: ed }) => {
    await openReport(reportCatalog, ca);
    const rows = await ca.rows();
    const broker = value(rows.find(r => key(r) === CA.brokerRate)?.[BASE] ?? '');
    const tier = value(rows.find(r => key(r) === CA.tierBonus)?.[BASE] ?? '');
    await ca.siblingPill(ED.code).click();
    await expect(ed.title, 'RPT-01 opened').toHaveText(ED.title);
    const text = ((await at(ed.page, REP_XP.definitions).textContent()) ?? '').replace(/\s+/g, ' ');
    const edBroker = rateBefore(text, 'external'), edTier = rateBefore(text, 'Tier-1');
    note('rates', `RPT-03: ${CA.brokerRate} ${broker}% · ${CA.tierBonus} ${tier}%  |  RPT-01 methodology: ${edBroker}% external · ${edTier}% Tier-1`);
    expect([broker, tier].every(Number.isFinite), 'RPT-03 lists both broker rates').toBe(true);
    expect.soft(edBroker, 'RPT-01 uses the RPT-03 standard broker rate').toBe(broker);
    expect.soft(edTier, 'RPT-01 uses the RPT-03 Tier 1 bonus').toBe(tier);
  });

  // ── 5. Filters ─────────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-071'), async ({ reportCatalog, controlAssumptions: ca }) => {
    await openReport(reportCatalog, ca);
    const labels = (await ca.periodSelect.locator('option').allInnerTexts()).map(o => o.trim());
    note('options', labels.join(' | '));
    expect.soft(labels, 'Period options').toEqual(REP_TEXT.periods);
    expect.soft(await ca.period(), 'Default period').toBe('this_month');
    await expect.soft(ca.viewButton('All'), 'All is selected by default').toHaveAttribute('aria-pressed', 'true');
  });

  test(...rep('REP-072'), async ({ reportCatalog, controlAssumptions: ca }) => {
    await openReport(reportCatalog, ca);
    const defaults = (await ca.data()).rows;
    for (const p of PRESET_PERIODS) {
      await ca.setPeriod(p);
      await verifySame(`Period ${p}`, ca, defaults);
    }
  });

  test(...rep('REP-073'), async ({ reportCatalog, controlAssumptions: ca }) => {
    await openReport(reportCatalog, ca);
    const defaults = (await ca.data()).rows;
    const today = new Date();
    await ca.setCustomRange(ymd(new Date(+today - 30 * 864e5)), ymd(today));
    await verifySame('Custom dates', ca, defaults);
  });

  test(...rep('REP-074'), async ({ reportCatalog, controlAssumptions: ca }) => {
    await openReport(reportCatalog, ca);
    const defaults = (await ca.data()).rows;
    const projects = await ca.options(PROJECT);
    test.skip(!projects.length, 'The Project dropdown has no projects');
    for (const o of projects) {
      await ca.setFilterValue(PROJECT, o.value);
      await verifySame(`Project ${o.label}`, ca, defaults);
    }
  });

  test(...rep('REP-075'), async ({ reportCatalog, controlAssumptions: ca }) => {
    await openReport(reportCatalog, ca);
    const defaults = (await ca.data()).rows;
    const people = await ca.options(SALES);
    test.skip(!people.length, 'The Salesperson dropdown has no salespeople');
    for (const o of people) {
      await ca.setFilterValue(SALES, o.value);
      await verifySame(`Salesperson ${o.label}`, ca, defaults);
    }
  });

  test(...rep('REP-076'), async ({ reportCatalog, controlAssumptions: ca }) => {
    await openReport(reportCatalog, ca);
    const defaults = (await ca.data()).rows;
    await ca.setView('Mine');
    await expect.soft(ca.viewButton('Mine'), 'Mine is selected').toHaveAttribute('aria-pressed', 'true');
    await verifySame('Mine', ca, defaults);
  });

  test(...rep('REP-077'), async ({ reportCatalog, controlAssumptions: ca }) => {
    await openReport(reportCatalog, ca);
    const before = await ca.selection();
    const defaults = (await ca.data()).rows;
    const [project] = await ca.options(PROJECT);
    const [person] = await ca.options(SALES);
    await ca.setPeriod(PRESET_PERIODS.find(p => p !== before.period)!);
    if (project) await ca.setFilterValue(PROJECT, project.value);
    if (person) await ca.setFilterValue(SALES, person.value);
    note('changed to', await shown(ca));
    await ca.resetFilters();
    note('after reset', await shown(ca));
    const { view, ...filters } = await ca.selection();
    expect.soft(filters, 'Period, Project and Salesperson back to the defaults').toEqual(before);
    if (view === 'self') await ca.setView('All');
    await verifySame('After reset', ca, defaults);
  });

  // ── 6. Export ──────────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-078'), async ({ reportCatalog, controlAssumptions: ca }) => {
    await openReport(reportCatalog, ca);
    const headers = await ca.headers();
    const total = await ca.totalRecords();
    const { sheet } = await ca.export();
    note('file', `${sheet.name} · sheet "${sheet.sheetName}" · ${sheet.rows.length} rows · ${sheet.header.join(' | ')}`);
    expect.soft(sheet.name, 'File name is .xlsx').toMatch(/\.xlsx$/i);
    expect.soft(sheet.magic, 'File is an Excel (zip) workbook').toBe('PK');
    expect.soft(sheet.sheetName, 'Sheet name').toBe(CA.exportSheet);
    expect.soft(sheet.header, 'Export columns = report columns').toEqual(headers);
    expect.soft(sheet.rows.length, 'Exported rows = Total Records').toBe(total);
  });

  test(...rep('REP-079'), async ({ reportCatalog, controlAssumptions: ca }) => {
    await openReport(reportCatalog, ca);
    const rows = await ca.rows();
    const { sheet } = await ca.export();
    const wrong: string[] = [];
    rows.forEach((r, i) => {
      for (const c of CA.columns) if (String(sheet.rows[i]?.[c] ?? '').trim() !== r[c]) wrong.push(`${key(r)} · ${c}: report "${r[c]}" · file "${sheet.rows[i]?.[c] ?? ''}"`);
    });
    if (wrong.length) note('differences', wrong.join(' | '));
    expect.soft(sheet.rows.map(r => String(r[PARAM])), 'Same parameters, in order').toEqual(rows.map(key));
    expect.soft(wrong, 'Cells that differ between the report and the file').toEqual([]);
  });

  test(...rep('REP-080'), async ({ reportCatalog, controlAssumptions: ca }) => {
    await openReport(reportCatalog, ca);
    await ca.setPeriod('last_12_months');
    const [project] = await ca.options(PROJECT);
    const [person] = await ca.options(SALES);
    if (project) await ca.setFilterValue(PROJECT, project.value);
    if (person) await ca.setFilterValue(SALES, person.value);
    const selection = await ca.selection();
    const rows = await ca.rows();
    const { sheet, query } = await ca.export();
    note('export', `${await shown(ca)} · export request ${new URLSearchParams(query)} · file ${sheet.rows.length} rows`);
    expect.soft(query, 'Export request carries the selected filters').toEqual(selection);
    expect.soft(sheet.rows.map(r => String(r[PARAM])), 'File holds the parameters shown').toEqual(rows.map(key));
  });

  // ── Additional: negative and boundary ──────────────────────────────────────────────────────────
  test(...rep('REP-081'), async ({ reportCatalog, controlAssumptions: ca }) => {
    await openReport(reportCatalog, ca);
    const today = new Date();
    const from = ymd(today), to = ymd(new Date(+today - 864e5));
    await ca.setPeriod('custom');
    await ca.page.locator('main input[type=date]').nth(0).fill(from);
    await ca.page.locator('main input[type=date]').nth(1).fill(to);
    const message = ca.message(REP_TEXT.rangeError).first();
    const shownMsg = await message.waitFor({ timeout: 10_000 }).then(() => true, () => false);
    note('inverted range', `From ${from} · To ${to} · message ${shownMsg ? 'shown' : 'not shown'} · rows still listed ${(await ca.rows()).length}`);
    expect.soft(shownMsg, `Validation message "${REP_TEXT.rangeError}"`).toBe(true);
  });

  test(...rep('REP-082'), async ({ reportCatalog, controlAssumptions: ca }) => {
    await openReport(reportCatalog, ca);
    const defaults = (await ca.data()).rows;
    await ca.setPeriod('last_month');
    const [person] = await ca.options(SALES);
    if (person) await ca.setFilterValue(SALES, person.value);
    const before = await shown(ca);
    await ca.page.reload();
    await expect(ca.tableRoot.locator('tbody tr').first(), 'Report reloaded').toBeVisible({ timeout: 20_000 });
    note('refresh', `before: ${before}  →  after: ${await shown(ca)}`);
    await verifySame('After refresh', ca, defaults);
  });
});
