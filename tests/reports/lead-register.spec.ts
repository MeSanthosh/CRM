/**
 * Reports workbook — RPT-05 Lead Register (REP-001 … REP-027).
 * Reports & Analytics → Lead Reports tab → "Open RPT-05 →". Every expected record comes from the Leads module
 * at run time (see lead-register.data.ts); filter values are read from the dropdowns. Read-only.
 */
import { test, expect, note } from '../pages/fixtures';
import { REP_TEXT, ROUTES } from '../locators';
import { parseNum, ymd } from '../helpers';
import type { SingleReportPage, ReportData } from '../pages/SingleReportPage';
import type { ReportCatalogPage } from '../pages/ReportCatalogPage';
import type { LeadApiItem, LeadsListPage } from '../pages/LeadsListPage';
import type { Period } from '../pages/ReportModulePage';
import { rep } from './catalog';
import {
  CREATED_WITHIN_MS, MONEY_TOLERANCE, PRESET_PERIODS, SAMPLE_SIZE,
  capturedDays, coversAll, criteriaOf, expected, sample,
} from './lead-register.data';

const LR = REP_TEXT.leadRegister;
const T = REP_TEXT.tiles;
const PROJECT = 'Project';
const SALES = 'Salesperson';

test.describe.configure({ timeout: 300_000 });

// ── Leads module data (read once per worker; the suite changes nothing) ─────────────────────────
let allLeadsCache: LeadApiItem[] | undefined;
let myLeadsCache: Set<string> | undefined;

async function leadsData(leadsList: LeadsListPage): Promise<LeadApiItem[]> {
  allLeadsCache ??= (await leadsList.allLeads()).api;
  return allLeadsCache;
}

async function myLeads(leadsList: LeadsListPage): Promise<Set<string>> {
  myLeadsCache ??= new Set((await leadsList.allLeads(REP_TEXT.myLeadsTab)).rows.map(r => r.leadNo));
  return myLeadsCache;
}

// ── Report helpers ──────────────────────────────────────────────────────────────────────────────
/** Opens the Lead Register the way a user does: catalogue → Lead Reports tab → Open RPT-05. */
async function openRegister(reportCatalog: ReportCatalogPage, reg: SingleReportPage) {
  await reportCatalog.open();
  await reportCatalog.openTab(LR.category);
  await reportCatalog.openReport(LR.code);
  await expect(reg.title, 'Lead Register opened').toHaveText(LR.title);
  await expect(reg.tableRoot.locator('thead th').first(), 'Report table loaded').toBeVisible({ timeout: 15_000 });
}

/** Selects the first preset period that holds every lead (so the report should list all of them). */
async function coverAll(reg: SingleReportPage, leads: LeadApiItem[]): Promise<ReportData> {
  for (const p of [...PRESET_PERIODS].reverse()) {
    await reg.setPeriod(p);
    const data = await reg.data();
    if (coversAll(leads, data.meta.period.from, data.meta.period.to)) return data;
  }
  test.skip(true, 'No preset period covers every lead\'s captured and created dates');
  throw new Error('unreachable');
}

/** Selects a preset period with some (ideally not all) leads; returns it. */
async function periodWithLeads(reg: SingleReportPage, leads: LeadApiItem[]): Promise<Period> {
  const counts: [Period, number][] = [];
  for (const p of PRESET_PERIODS) {
    await reg.setPeriod(p);
    counts.push([p, expected(leads, criteriaOf(await reg.data())).must.size]);
  }
  const pick = counts.find(([, n]) => n > 0 && n < leads.length) ?? counts.find(([, n]) => n > 0);
  test.skip(!pick, 'No preset period holds any lead');
  await reg.setPeriod(pick![0]);
  return pick![0];
}

/** The salesperson option with most leads under the given extra criteria. */
async function busiestSalesperson(reg: SingleReportPage, leads: LeadApiItem[], data?: ReportData) {
  const base = data ? criteriaOf(data) : {};
  const ranked = (await reg.options(SALES))
    .map(o => ({ ...o, n: expected(leads, { ...base, ownerUserId: o.value }).must.size }))
    .sort((a, b) => b.n - a.n);
  test.skip(!ranked.length, 'The Salesperson dropdown has no salespeople');
  return ranked[0];
}

/** The selection on screen in words, for the report. */
async function shown(reg: SingleReportPage): Promise<string> {
  const text = async (s: ReturnType<SingleReportPage['filter']>) =>
    (await s.count()) ? s.evaluate(e => (e as HTMLSelectElement).selectedOptions[0]?.text ?? '') : '(hidden)';
  const sel = await reg.selection();
  const period = sel.period === 'custom' ? `${sel.from} → ${sel.to}` : await text(reg.periodSelect);
  return `Period ${period} · Project ${await text(reg.filter(PROJECT))} · Salesperson ${await text(reg.filter(SALES))} · View ${(await reg.isMine()) ? 'Mine' : 'All'}`;
}

const first = (ids: string[], n = 8) => ids.slice(0, n).join(', ') + (ids.length > n ? ` … (+${ids.length - n})` : '');

/**
 * Checks the report's current records against the Leads module: table = API data, Total Records = rows,
 * no duplicates, nothing that does not match the filters, nothing missing.
 */
async function verify(what: string, reg: SingleReportPage, leads: LeadApiItem[], mine?: Set<string>) {
  const data = await reg.data();
  const ui = await reg.ids();
  const api = reg.idsOf(data);
  const tile = await reg.totalRecords();
  const exp = expected(leads, criteriaOf(data, mine));
  const got = new Set(ui);
  const extra = ui.filter(id => !exp.may.has(id));
  const missing = [...exp.must].filter(id => !got.has(id));
  const dup = ui.filter((id, i) => ui.indexOf(id) !== i);
  const { from, to } = criteriaOf(data);
  note(what, `${await shown(reg)} (dates ${from} – ${to}) · report ${ui.length} · Total Records ${tile} · expected ${exp.byCaptured} from the Leads module`);
  if (extra.length) note(`${what} · shown but not matching`, first(extra));
  if (missing.length) note(`${what} · missing`, first(missing));
  expect.soft([...ui].sort(), `${what}: table rows = report data`).toEqual([...api].sort());
  expect.soft(tile, `${what}: Total Records in Report = rows shown`).toBe(ui.length);
  expect.soft(dup, `${what}: Lead IDs listed twice`).toEqual([]);
  expect.soft(extra.length, `${what}: ${extra.length} lead(s) shown that do not match the selection (expected ${exp.byCaptured} leads): ${first(extra)}`).toBe(0);
  expect.soft(missing.length, `${what}: ${missing.length} matching lead(s) missing: ${first(missing)}`).toBe(0);
  return { data, ui, exp };
}

/** Same cell value in the table and the export (amounts and dates compared as values). */
function sameCell(format: string, ui: string, file: unknown): boolean {
  const blank = (v: string) => /^\s*[—–-]?\s*$/.test(v);
  const f = typeof file === 'number' && format === 'date' ? new Date(Math.round((file - 25569) * 864e5)).toISOString().slice(0, 10) : String(file ?? '').trim();
  if (blank(ui) || blank(f)) return blank(ui) && blank(f);
  if (format === 'money' || format === 'number') {
    const a = parseNum(ui), b = Number(f.replace(/[^\d.-]/g, ''));
    return Math.abs(a - b) <= Math.max(1, Math.abs(b) * MONEY_TOLERANCE);
  }
  if (format === 'date') {
    const d = (s: string) => { const t = Date.parse(s.replace(/-/g, ' ')); return isNaN(t) ? Date.parse(s) : t; };
    return ymd(new Date(d(ui))) === ymd(new Date(d(f)));
  }
  return ui.trim() === f;
}

/** A filter selection with no leads at all (either lead date), found from the Leads module. */
async function emptySelection(reg: SingleReportPage, leads: LeadApiItem[]) {
  const people = await reg.options(SALES);
  for (const p of PRESET_PERIODS) {
    await reg.setPeriod(p);
    const c = criteriaOf(await reg.data());
    if (!expected(leads, c).may.size) return { period: p };
    const person = people.find(o => !expected(leads, { ...c, ownerUserId: o.value }).may.size);
    if (person) return { period: p, salesperson: person };
  }
  return undefined;
}

test.describe('Reports · RPT-05 Lead Register', () => {
  // ── 1. Navigation ──────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-001'), async ({ reportCatalog, leadRegister: reg, page }) => {
    reg.watchErrors();
    await reportCatalog.open();
    await reportCatalog.openTab(LR.category);
    const card = await reportCatalog.readCard(LR.code);
    note('card', `${card.code} · ${card.title} · ${card.category}`);
    expect.soft(card.title, 'Card title').toBe(LR.title);
    await reportCatalog.openReport(LR.code);
    await expect.soft(page, 'URL').toHaveURL(new RegExp(`${LR.route}\\?${LR.query}`));
    await expect.soft(reg.code, 'Report code').toHaveText(LR.code);
    await expect.soft(reg.title, 'Report title').toHaveText(LR.title);
    await expect(reg.tableRoot.locator('tbody tr').first(), 'Report rows loaded').toBeVisible({ timeout: 15_000 });
    note('loaded', `${(await reg.rows()).length} rows`);
    await reg.expectNoBrokenValues();
    reg.expectNoErrors();
  });

  test(...rep('REP-002'), async ({ reportCatalog, leadRegister: reg }) => {
    await openRegister(reportCatalog, reg);
    const total = await reg.tile(T.total);
    const created = await reg.tile(T.created);
    const by = await reg.tile(T.createdBy);
    const user = await reg.userName();
    note('tiles', `Total ${total} · Created ${created} · Created By ${by} · logged in as ${user}`);
    expect.soft(total, 'Total is a number').toMatch(/^[\d,]+$/);
    const at = new Date(created.replace(',', ''));
    expect.soft(!isNaN(+at) && Math.abs(+at - Date.now()) < CREATED_WITHIN_MS, `Created date/time is now (${created})`).toBeTruthy();
    // shown as "Name (Role)" since build index-DGibO5LD
    expect.soft(by.replace(/\s*\([^)]*\)$/, ''), 'Created By = logged-in user').toBe(user);
  });

  // ── 2. Lead count ──────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-003'), async ({ reportCatalog, leadRegister: reg, page }) => {
    await openRegister(reportCatalog, reg);
    const data = await reg.data();
    const rows = (await reg.rows()).length;
    const tile = await reg.totalRecords();
    const pager = await page.locator('main section#' + LR.panelId).locator('.crm-pagination').count();
    note('count', `Total Records ${tile} · rows ${rows} · API total ${data.total} (${data.rows.length} rows) · pager ${pager ? 'yes' : 'none: every record on one page'}`);
    expect.soft(rows, 'Rows shown = Total Records in Report').toBe(tile);
    expect.soft(data.total, 'API total = Total Records in Report').toBe(tile);
    expect.soft(data.rows.length, 'API rows = API total').toBe(data.total);
  });

  test(...rep('REP-004'), async ({ reportCatalog, leadRegister: reg, leadsList }) => {
    const leads = await leadsData(leadsList);
    await leadsList.open();
    const tab = await leadsList.tabCount(REP_TEXT.allLeadsTab);
    const kpi = await leadsList.kpi('Total Leads');
    const { total: pager } = await leadsList.pager();
    await openRegister(reportCatalog, reg);
    const data = await coverAll(reg, leads);
    const report = await reg.totalRecords();
    note('totals', `Lead Register ${report} (period ${data.meta.period.from} – ${data.meta.period.to}, All) · All Leads tab ${tab} · Total Leads KPI ${kpi} · pager ${pager ?? '(none)'} · leads read ${leads.length}`);
    expect.soft(report, 'Report total = All Leads tab').toBe(tab);
    expect.soft(report, 'Report total = Total Leads KPI').toBe(kpi);
    if (pager !== undefined) expect.soft(report, 'Report total = pager total').toBe(pager);
  });

  test(...rep('REP-005'), async ({ reportCatalog, leadRegister: reg, leadsList }) => {
    const leads = await leadsData(leadsList);
    await openRegister(reportCatalog, reg);
    await coverAll(reg, leads);
    const ids = await reg.ids();
    const all = leads.map(l => l.leadNo);
    note('leads', `report ${ids.length} · Leads module ${all.length}`);
    expect.soft(ids.filter((x, i) => ids.indexOf(x) !== i), 'Lead IDs listed twice').toEqual([]);
    expect.soft(ids.filter(x => !all.includes(x)), 'In the report, not in the Leads module').toEqual([]);
    expect.soft(all.filter(x => !ids.includes(x)), 'In the Leads module, not in the report').toEqual([]);
  });

  // ── 3. Tabs ────────────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-006'), async ({ reportCatalog, leadRegister: reg, leadsList }) => {
    const leads = await leadsData(leadsList);
    await openRegister(reportCatalog, reg);
    await expect.soft(reg.viewButton('All'), 'All is selected by default').toHaveAttribute('aria-pressed', 'true');
    expect.soft(await reg.headers(), 'Columns').toEqual(LR.columns);
    await coverAll(reg, leads);
    await verify('All', reg, leads);
  });

  test(...rep('REP-007'), async ({ reportCatalog, leadRegister: reg, leadsList }) => {
    const leads = await leadsData(leadsList);
    const mine = await myLeads(leadsList);
    note('My Leads', `${mine.size} lead(s) in Leads → My Leads: ${first([...mine])}`);
    await openRegister(reportCatalog, reg);
    await coverAll(reg, leads);
    const all = new Set(await reg.ids());
    await reg.setView('Mine');
    await expect.soft(reg.viewButton('Mine'), 'Mine is selected').toHaveAttribute('aria-pressed', 'true');
    const { ui } = await verify('Mine', reg, leads, mine);
    expect.soft(ui.filter(id => !all.has(id)), 'Mine is a subset of All').toEqual([]);
  });

  // ── 4. Period ──────────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-008'), async ({ reportCatalog, leadRegister: reg }) => {
    await openRegister(reportCatalog, reg);
    const labels = (await reg.periodSelect.locator('option').allInnerTexts()).map(o => o.trim());
    note('options', labels.join(' | '));
    expect.soft(labels, 'Period options').toEqual(REP_TEXT.periods);
    expect.soft(await reg.period(), 'Default period').toBe('this_month');
  });

  test(...rep('REP-009'), async ({ reportCatalog, leadRegister: reg, leadsList }) => {
    const leads = await leadsData(leadsList);
    await openRegister(reportCatalog, reg);
    const totals: string[] = [];
    for (const p of PRESET_PERIODS) {
      await reg.setPeriod(p);
      const { ui, exp } = await verify(`Period ${p}`, reg, leads);
      totals.push(`${p}: ${ui.length} (expected ${exp.byCaptured})`);
    }
    note('per period', totals.join(' · '));
  });

  test(...rep('REP-010'), async ({ reportCatalog, leadRegister: reg, leadsList, page }) => {
    const leads = await leadsData(leadsList);
    const days = capturedDays(leads);
    test.skip(days.length < 3, 'Fewer than 3 distinct captured dates: no range holds some but not all leads');
    const from = days[Math.floor(days.length / 4)], to = days[Math.floor(days.length / 2)];
    await openRegister(reportCatalog, reg);
    await reg.setPeriod('custom');
    await expect.soft(page.locator('main input[type=date]'), 'From and To fields').toHaveCount(2);
    await reg.setCustomRange(from, to);
    await verify(`Custom ${from} → ${to}`, reg, leads);
  });

  // ── 5. Project ─────────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-011'), async ({ reportCatalog, leadRegister: reg, leadsList }) => {
    const leads = await leadsData(leadsList);
    await openRegister(reportCatalog, reg);
    await coverAll(reg, leads);
    const projects = await reg.options(PROJECT);
    const inLeads = [...new Set(leads.map(l => l.preferredProjectCode).filter(Boolean))];
    note('projects', `dropdown: ${projects.map(o => `${o.label} (${o.value})`).join(', ')} · on leads: ${inLeads.join(', ')} · leads without a project: ${leads.filter(l => !l.preferredProjectCode).length}`);
    test.skip(!projects.length, 'The Project dropdown has no projects');
    expect.soft(inLeads.filter(c => !projects.some(o => o.value === c)), 'Lead projects missing from the dropdown').toEqual([]);
    for (const o of projects) {
      await reg.setFilterValue(PROJECT, o.value);
      await verify(`Project ${o.label}`, reg, leads);
    }
  });

  // ── 6. Salesperson ─────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-012'), async ({ reportCatalog, leadRegister: reg, leadsList }) => {
    const leads = await leadsData(leadsList);
    await openRegister(reportCatalog, reg);
    await coverAll(reg, leads);
    const people = await reg.options(SALES);
    note('salespeople', people.map(o => o.label).join(', '));
    test.skip(!people.length, 'The Salesperson dropdown has no salespeople');
    for (const o of people) {
      await reg.setFilterValue(SALES, o.value);
      await verify(`Salesperson ${o.label}`, reg, leads);
    }
  });

  // ── 7. Combined filters ────────────────────────────────────────────────────────────────────────
  test(...rep('REP-013'), async ({ reportCatalog, leadRegister: reg, leadsList }) => {
    const leads = await leadsData(leadsList);
    await openRegister(reportCatalog, reg);
    await periodWithLeads(reg, leads);
    const [project] = await reg.options(PROJECT);
    test.skip(!project, 'The Project dropdown has no projects');
    await reg.setFilterValue(PROJECT, project.value);
    await verify('Period + Project', reg, leads);
  });

  test(...rep('REP-014'), async ({ reportCatalog, leadRegister: reg, leadsList }) => {
    const leads = await leadsData(leadsList);
    await openRegister(reportCatalog, reg);
    await periodWithLeads(reg, leads);
    const person = await busiestSalesperson(reg, leads, await reg.data());
    await reg.setFilterValue(SALES, person.value);
    await verify('Period + Salesperson', reg, leads);
  });

  test(...rep('REP-015'), async ({ reportCatalog, leadRegister: reg, leadsList }) => {
    const leads = await leadsData(leadsList);
    await openRegister(reportCatalog, reg);
    await coverAll(reg, leads);
    const [project] = await reg.options(PROJECT);
    test.skip(!project, 'The Project dropdown has no projects');
    await reg.setFilterValue(PROJECT, project.value);
    const person = await busiestSalesperson(reg, leads, await reg.data());
    await reg.setFilterValue(SALES, person.value);
    await verify('Project + Salesperson', reg, leads);
  });

  test(...rep('REP-016'), async ({ reportCatalog, leadRegister: reg, leadsList }) => {
    const leads = await leadsData(leadsList);
    await openRegister(reportCatalog, reg);
    await periodWithLeads(reg, leads);
    const [project] = await reg.options(PROJECT);
    test.skip(!project, 'The Project dropdown has no projects');
    await reg.setFilterValue(PROJECT, project.value);
    const person = await busiestSalesperson(reg, leads, await reg.data());
    await reg.setFilterValue(SALES, person.value);
    await verify('Period + Project + Salesperson', reg, leads);
  });

  test(...rep('REP-017'), async ({ reportCatalog, leadRegister: reg, leadsList }) => {
    const leads = await leadsData(leadsList);
    await openRegister(reportCatalog, reg);
    const before = await reg.selection();
    const beforeIds = reg.idsOf(await reg.data()).sort();
    const [project] = await reg.options(PROJECT);
    const person = await busiestSalesperson(reg, leads);
    await reg.setPeriod(PRESET_PERIODS.find(p => p !== before.period)!);
    if (project) await reg.setFilterValue(PROJECT, project.value);
    await reg.setFilterValue(SALES, person.value);
    await reg.setView('Mine');
    note('changed to', await shown(reg));
    await reg.resetFilters();
    note('after reset', await shown(reg));
    const { view, ...filters } = await reg.selection();
    expect.soft(filters, 'Period, Project and Salesperson back to the defaults').toEqual(before);
    // the All / Mine view is not one of the filters; record what Reset does with it, then compare in the default view
    note('view after reset', view === 'self' ? 'Mine kept (Reset filters does not change the view)' : 'All');
    if (view === 'self') await reg.setView('All');
    expect.soft(reg.idsOf(await reg.data()).sort(), 'Records back to the default records').toEqual(beforeIds);
    expect.soft((await reg.ids()).sort(), 'Table back to the default records').toEqual(beforeIds);
  });

  // ── 8. Export ──────────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-018'), async ({ reportCatalog, leadRegister: reg }) => {
    await openRegister(reportCatalog, reg);
    const headers = await reg.headers();
    const { sheet } = await reg.export();
    note('file', `${sheet.name} · sheet "${sheet.sheetName}" · ${sheet.rows.length} rows · ${sheet.header.join(' | ')}`);
    expect.soft(sheet.name, 'File name is .xlsx').toMatch(/\.xlsx$/i);
    expect.soft(sheet.magic, 'File is an Excel (zip) workbook').toBe('PK');
    expect.soft(sheet.header, 'Export columns = report columns').toEqual(headers);
  });

  test(...rep('REP-019'), async ({ reportCatalog, leadRegister: reg, leadsList }) => {
    const leads = await leadsData(leadsList);
    await openRegister(reportCatalog, reg);
    const data = await coverAll(reg, leads);
    const rows = await reg.rows();
    const tile = await reg.totalRecords();
    const { sheet } = await reg.export();
    const idCol = LR.columns[0];
    const fileIds = sheet.rows.map(r => String(r[idCol] ?? ''));
    note('export', `${sheet.name}: ${sheet.rows.length} rows · report ${rows.length} rows · Total Records ${tile}`);
    expect.soft(sheet.rows.length, 'Exported rows = Total Records').toBe(tile);
    expect.soft(fileIds.filter((x, i) => fileIds.indexOf(x) !== i), 'Lead IDs twice in the file').toEqual([]);
    expect.soft([...fileIds].sort(), 'Same Lead IDs as the report').toEqual(rows.map(r => r[idCol]).sort());
    const format = Object.fromEntries(data.columns.map(c => [c.label, c.format]));
    const byId = new Map(sheet.rows.map(r => [String(r[idCol]), r]));
    const wrong: string[] = [];
    for (const r of rows) {
      const f = byId.get(r[idCol]);
      if (!f) continue;
      for (const col of LR.columns) if (!sameCell(format[col] ?? 'text', r[col] ?? '', f[col])) wrong.push(`${r[idCol]} ${col}: report "${r[col]}" · file "${f[col] ?? ''}"`);
    }
    if (wrong.length) note('cell mismatches', wrong.slice(0, 15).join(' | '));
    expect.soft(wrong.length, `Cells that differ between the report and the file: ${wrong.slice(0, 3).join(' | ')}`).toBe(0);
  });

  test(...rep('REP-020'), async ({ reportCatalog, leadRegister: reg, leadsList }) => {
    const leads = await leadsData(leadsList);
    await openRegister(reportCatalog, reg);
    await periodWithLeads(reg, leads);
    const [project] = await reg.options(PROJECT);
    if (project) await reg.setFilterValue(PROJECT, project.value);
    const person = await busiestSalesperson(reg, leads, await reg.data());
    await reg.setFilterValue(SALES, person.value);
    const selection = await reg.selection();
    const ui = await reg.ids();
    const { sheet, query } = await reg.export();
    const fileIds = sheet.rows.map(r => String(r[LR.columns[0]] ?? ''));
    note('export', `${await shown(reg)} · report ${ui.length} rows · file ${fileIds.length} rows · export request ${new URLSearchParams(query)}`);
    expect.soft(query, 'Export request carries the selected filters').toEqual(selection);
    expect.soft([...fileIds].sort(), 'File holds exactly the records shown').toEqual([...ui].sort());
  });

  // ── 9. Lead data ───────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-021'), async ({ reportCatalog, leadRegister: reg, leadsList, page }) => {
    await openRegister(reportCatalog, reg);
    const rows = await reg.rows();
    const picks = sample(rows, SAMPLE_SIZE);
    note('picked', picks.map(r => r['Lead ID']).join(', '));
    for (const r of picks) {
      const id = r['Lead ID'];
      await reg.rowLink(id).click();
      await expect(page, `${id}: Leads module opens`).toHaveURL(new RegExp(`${ROUTES.leads}(\\?selected=.*)?$`));
      const lead = await leadsList.detail();
      note(id, `report: ${id} · "${r['Prospect Name']}" · ${r['Channel Source']}  |  Lead Detail: ${lead.leadNo} · "${lead.name}" · ${lead.source}`);
      expect.soft(lead.leadNo, `${id}: Lead ID`).toBe(id);
      expect.soft(r['Prospect Name'], `${id}: Lead Name (report vs Lead Detail)`).toBe(lead.name);
      expect.soft(r['Channel Source'], `${id}: Source Channel (report vs Lead Detail)`).toBe(lead.source);
      await reg.open();
      await expect(reg.tableRoot.locator('tbody tr').first(), 'Back on the report').toBeVisible({ timeout: 15_000 });
    }
  });

  // ── Additional: negative and boundary ──────────────────────────────────────────────────────────
  test(...rep('REP-022'), async ({ reportCatalog, leadRegister: reg, leadsList }) => {
    const leads = await leadsData(leadsList);
    await openRegister(reportCatalog, reg);
    const empty = await emptySelection(reg, leads);
    test.skip(!empty, 'Every period / salesperson combination has leads');
    await reg.setPeriod(empty!.period);
    if (empty!.salesperson) await reg.setFilterValue(SALES, empty!.salesperson.value);
    const { ui } = await verify('No matching leads', reg, leads);
    expect.soft(ui.length, 'No rows listed').toBe(0);
    expect.soft(await reg.totalRecords(), 'Total Records is 0').toBe(0);
  });

  test(...rep('REP-023'), async ({ reportCatalog, leadRegister: reg }) => {
    await openRegister(reportCatalog, reg);
    const today = new Date();
    const from = ymd(today), to = ymd(new Date(+today - 864e5));
    await reg.setPeriod('custom');
    await reg.page.locator('main input[type=date]').nth(0).fill(from);
    await reg.page.locator('main input[type=date]').nth(1).fill(to);
    const message = reg.message(REP_TEXT.rangeError).first();
    const shownMsg = await message.isVisible({ timeout: 10_000 }).catch(() => false) || await message.waitFor({ timeout: 10_000 }).then(() => true, () => false);
    const rows = (await reg.rows()).length;
    note('inverted range', `From ${from} · To ${to} · message ${shownMsg ? 'shown' : 'not shown'} · rows still listed ${rows} · Total Records ${await reg.tile(T.total)}`);
    expect.soft(shownMsg, `Validation message "${REP_TEXT.rangeError}"`).toBe(true);
    if (!shownMsg) expect.soft(rows, 'Without a message, no records may be presented for an invalid range').toBe(0);
  });

  test(...rep('REP-024'), async ({ reportCatalog, leadRegister: reg, leadsList }) => {
    const leads = await leadsData(leadsList);
    const mine = await myLeads(leadsList);
    await openRegister(reportCatalog, reg);
    await periodWithLeads(reg, leads);
    const person = await busiestSalesperson(reg, leads, await reg.data());
    await reg.setFilterValue(SALES, person.value);
    const before = await reg.selection();
    await reg.setView('Mine');
    const hidden = await reg.hiddenParams();
    const omit = (q: Record<string, string>) => Object.fromEntries(Object.entries(q).filter(([k]) => k !== 'view' && !hidden.includes(k)));
    note('Mine', `before: ${await shown(reg)}${hidden.length ? ` · Mine hides the filter(s) sent as ${hidden.join(', ')}` : ''}`);
    expect.soft(omit(await reg.selection()), 'Visible filters kept after switching to Mine').toEqual(omit(before));
    await verify('Mine with filters', reg, leads, mine);
    await reg.setView('All');
    const back = await reg.selection();
    note('back to All', `${await shown(reg)} · Salesperson ${back.ownerUserId === before.ownerUserId ? 'kept' : 'reset'}`);
    expect.soft(omit(back), 'Period and Project kept after switching back to All').toEqual(omit(before));
    await verify('All with filters', reg, leads);
  });

  test(...rep('REP-025'), async ({ reportCatalog, leadRegister: reg, leadsList }) => {
    const leads = await leadsData(leadsList);
    await openRegister(reportCatalog, reg);
    const people = await reg.options(SALES);
    const [project] = await reg.options(PROJECT);
    const person = await busiestSalesperson(reg, leads);
    // fire the changes back to back, without waiting for the report in between
    for (const p of ['last_month', 'ytd', 'this_quarter', 'last_12_months'] as Period[]) await reg.periodSelect.selectOption(p);
    for (const o of people.slice(0, 3)) await reg.filter(SALES).selectOption(o.value);
    if (project) await reg.filter(PROJECT).selectOption(project.value);
    await reg.filter(SALES).selectOption(person.value);
    await verify('After consecutive changes', reg, leads);
  });

  test(...rep('REP-026'), async ({ reportCatalog, leadRegister: reg, leadsList }) => {
    const leads = await leadsData(leadsList);
    await openRegister(reportCatalog, reg);
    await periodWithLeads(reg, leads);
    const person = await busiestSalesperson(reg, leads, await reg.data());
    await reg.setFilterValue(SALES, person.value);
    const before = await shown(reg);
    await reg.page.reload();
    await expect(reg.tableRoot.locator('thead th').first(), 'Report reloaded').toBeVisible({ timeout: 20_000 });
    const after = await shown(reg);
    note('refresh', `before: ${before}  →  after: ${after} (${before === after ? 'filters kept' : 'filters reset'})`);
    await verify('After refresh', reg, leads);
  });

  test(...rep('REP-027'), async ({ reportCatalog, leadRegister: reg, leadsList }) => {
    const leads = await leadsData(leadsList);
    await openRegister(reportCatalog, reg);
    const empty = await emptySelection(reg, leads);
    test.skip(!empty, 'Every period / salesperson combination has leads');
    await reg.setPeriod(empty!.period);
    if (empty!.salesperson) await reg.setFilterValue(SALES, empty!.salesperson.value);
    const headers = await reg.headers();
    const { sheet } = await reg.export();
    note('export', `${await shown(reg)} · file ${sheet.name} · ${sheet.rows.length} rows`);
    expect.soft(sheet.header, 'Column headers present').toEqual(headers);
    expect.soft(sheet.rows.length, 'No data rows for a selection with no leads').toBe(0);
  });
});
