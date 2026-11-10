/**
 * Reports workbook — RPT-16 Sales Funnel & Conversion Analysis (REP-165 … REP-196).
 * Reports & Analytics → Sales Reports tab → "Open RPT-16 →". Each stage is checked for its own arithmetic, against
 * the methodology, and against its module (leads, qualified leads, opportunities, reservations, executed SPAs) for
 * the selection the report says it applied (see sales-funnel.data.ts). Read-only.
 */
import { test, expect, note } from '../pages/fixtures';
import { REP_TEXT, REP_XP, ROUTES, at } from '../locators';
import { parseNum, ymd } from '../helpers';
import type { SingleReportPage, ReportData } from '../pages/SingleReportPage';
import type { ReportCatalogPage } from '../pages/ReportCatalogPage';
import type { CrmData } from '../pages/CrmData';
import { rep } from './catalog';
import { CREATED_WITHIN_MS, PRESET_PERIODS } from './lead-register.data';
import { close } from './executive-dashboard.data';
import { entry, numbers } from './control-assumptions.data';
import { codeRange } from './data-dictionary.data';
import { K, PCT_DECIMALS, type Sources, criteriaOf, pct, stagesFor } from './sales-funnel.data';

const SF = REP_TEXT.salesFunnel;
const ED = REP_TEXT.executiveDashboard;
const PS = REP_TEXT.propertySummary;
const DD = REP_TEXT.dataDictionary;
const T = REP_TEXT.tiles;
const PROJECT = 'Project';
const SALES = 'Salesperson';
const BROKER = 'Broker';
const CAMPAIGN = 'Campaign';
type Row = Record<string, unknown>;

test.describe.configure({ timeout: 300_000 });

// ── Source data (read once per worker; the suite changes nothing) ───────────────────────────────
let sourcesCache: Sources | undefined;
async function sources(crmData: CrmData): Promise<Sources> {
  sourcesCache ??= {
    leads: await crmData.leads(), opportunities: await crmData.opportunities(),
    reservations: await crmData.reservations(), contracts: await crmData.contracts(),
  };
  return sourcesCache;
}

// ── Report helpers ──────────────────────────────────────────────────────────────────────────────
/** Opens RPT-16 the way a user does: catalogue → Sales Reports tab → Open RPT-16. */
async function openReport(reportCatalog: ReportCatalogPage, sf: SingleReportPage) {
  await reportCatalog.open();
  await reportCatalog.openTab(SF.category);
  await reportCatalog.openReport(SF.code);
  await expect(sf.title, 'Sales Funnel opened').toHaveText(SF.title);
  await expect(sf.tableRoot.locator('tbody tr').first(), 'Report rows loaded').toBeVisible({ timeout: 15_000 });
}

async function shown(sf: SingleReportPage): Promise<string> {
  const text = async (s: ReturnType<SingleReportPage['filter']>) =>
    (await s.count()) ? s.evaluate(e => (e as HTMLSelectElement).selectedOptions[0]?.text ?? '') : '(hidden)';
  const sel = await sf.selection();
  const period = sel.period === 'custom' ? `${sel.from} → ${sel.to}` : await text(sf.periodSelect);
  const f = await Promise.all([PROJECT, SALES, BROKER, CAMPAIGN].map(async l => `${l} ${await text(sf.filter(l))}`));
  return `Period ${period} · ${f.join(' · ')} · View ${(await sf.isMine()) ? 'Mine' : 'All'}`;
}

async function methodology(sf: SingleReportPage): Promise<string[]> {
  return (await at(sf.page, REP_XP.definitionItems).allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
}

const money = (n: number) => Math.round(n).toLocaleString('en-US');

/** The logged-in user's id, from the Salesperson dropdown (shown with the user's name). */
async function myUserId(sf: SingleReportPage): Promise<string | undefined> {
  const me = await sf.userName();
  return (await sf.options(SALES)).find(o => o.label === me)?.value;
}

/**
 * Checks the stages of the selection on screen against their modules: each Prospect Count between the records that
 * surely entered the stage in the period and those that may have, and the SPA stage's value. `only` limits it to
 * one stage (0-based).
 */
async function verify(what: string, sf: SingleReportPage, src: Sources, myId?: string, only?: number) {
  const data = await sf.data();
  const c = criteriaOf(data, myId);
  const exp = stagesFor(src, c);
  note(what, `${await shown(sf)} (dates ${c.from} – ${c.to})`);
  data.rows.forEach((r, i) => {
    if (only !== undefined && i !== only) return;
    const e = exp[i], got = Number(r[K.count]);
    if (!e) return;
    note(`${what} · ${r[K.name]}`, `report ${got} · expected ${e.must === e.may ? e.must : `${e.must}–${e.may}`}${e.value !== undefined ? ` · value report ${money(Number(r[K.value]))} expected ${money(e.value)}` : ''} · records: ${e.records.slice(0, 12).join(', ') || 'none'}${e.records.length > 12 ? ' …' : ''}`);
    expect.soft(got >= e.must && got <= e.may, `${what} · ${r[K.name]}: Prospect Count ${got} = ${e.must === e.may ? e.must : `${e.must}–${e.may}`} from its module`).toBe(true);
    if (e.value !== undefined) expect.soft(close(Number(r[K.value]), e.value), `${what} · ${r[K.name]}: Aggregate Value ${money(Number(r[K.value]))} = executed SPA value ${money(e.value)}`).toBe(true);
  });
  return data;
}

/** Runs verify for every option of a filter. */
async function eachOption(label: string, sf: SingleReportPage, src: Sources) {
  const opts = await sf.options(label);
  note(label, opts.map(o => o.label).join(', '));
  test.skip(!opts.length, `The ${label} dropdown has no options`);
  for (const o of opts) {
    await sf.setFilterValue(label, o.value);
    await verify(`${label} ${o.label}`, sf, src);
  }
}

test.describe('Reports · RPT-16 Sales Funnel & Conversion Analysis', () => {
  // ── 1. Navigation ──────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-165'), async ({ reportCatalog, salesFunnel: sf, page }) => {
    sf.watchErrors();
    await reportCatalog.open();
    await reportCatalog.openTab(SF.category);
    const card = await reportCatalog.readCard(SF.code);
    note('card', `${card.code} · ${card.title} · ${card.category}`);
    expect.soft(card.title, 'Card title').toBe(SF.title);
    await reportCatalog.openReport(SF.code);
    await expect.soft(page, 'URL').toHaveURL(new RegExp(`${SF.route}\\?${SF.query}`));
    await expect.soft(sf.code, 'Report code').toHaveText(SF.code);
    await expect.soft(sf.title, 'Report title').toHaveText(SF.title);
    await expect(sf.tableRoot.locator('tbody tr').first(), 'Report rows loaded').toBeVisible({ timeout: 15_000 });
    await sf.expectNoBrokenValues();
    sf.expectNoErrors();
  });

  test(...rep('REP-166'), async ({ reportCatalog, salesFunnel: sf, page }) => {
    await openReport(reportCatalog, sf);
    await expect.soft(sf.backLink, 'Back link').toHaveText(SF.backLabel);
    for (const code of SF.siblings) {
      await expect.soft(sf.siblingPill(code), `Pill ${code}`).toBeVisible();
      await sf.siblingPill(code).click();
      await expect.soft(sf.code, `${code} opens`).toHaveText(code);
      await sf.open();
      await expect(sf.code, 'Back on RPT-16').toHaveText(SF.code);
    }
    await sf.backLink.click();
    await expect.soft(page, 'Back link → catalogue').toHaveURL(new RegExp(ROUTES.hub));
    await expect.soft(reportCatalog.tab(SF.category), 'Sales Reports tab selected').toHaveAttribute('aria-selected', 'true');
  });

  test(...rep('REP-167'), async ({ reportCatalog, salesFunnel: sf }) => {
    await openReport(reportCatalog, sf);
    const data = await sf.data();
    const total = await sf.totalRecords();
    const rows = (await sf.rows()).length;
    const stated = numbers(entry(await methodology(sf), 'Total Records in Report') ?? '')[0];
    const created = await sf.tile(T.created);
    const by = await sf.tile(T.createdBy);
    const user = await sf.userName();
    note('header', `Total ${total} · rows ${rows} · API total ${data.total} · methodology ${stated} · Created ${created} · Created By ${by} · logged in as ${user}`);
    expect.soft(total, 'Total Records = rows shown').toBe(rows);
    expect.soft(total, 'Total Records = API total').toBe(data.total);
    expect.soft(total, 'Total Records = the stage count the methodology states').toBe(stated);
    const when = new Date(created.replace(',', ''));
    expect.soft(!isNaN(+when) && Math.abs(+when - Date.now()) < CREATED_WITHIN_MS, `Created date/time is now (${created})`).toBeTruthy();
    expect.soft(by.replace(/\s*\([^)]*\)$/, ''), 'Created By = logged-in user').toBe(user);
  });

  // ── 2. Structure ───────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-168'), async ({ reportCatalog, salesFunnel: sf }) => {
    await openReport(reportCatalog, sf);
    const headers = await sf.headers();
    const rows = await sf.rows();
    const items = await methodology(sf);
    const range = codeRange(entry(items, SF.columns[0]) ?? '');
    const nameEntry = entry(items, SF.columns[1]) ?? '';
    note('table', `${headers.join(' | ')} · codes ${rows.map(r => r[SF.columns[0]]).join(', ')} (methodology ${range.join(', ')}) · stages ${rows.map(r => r[SF.columns[1]]).join(' → ')}`);
    expect.soft(headers, 'Columns').toEqual(SF.columns);
    expect.soft(rows.map(r => r[SF.columns[0]]), 'Stage Codes = the range the methodology states').toEqual(range);
    expect.soft(rows.map(r => r[SF.columns[1]]), 'Stages in funnel order').toEqual(SF.stages);
    expect.soft(SF.stages.filter(s => !nameEntry.includes(s)), 'Stage names the methodology does not list').toEqual([]);
    const blank = rows.flatMap(r => SF.columns.filter(c => !/\S/.test(r[c] ?? '')).map(c => `${r[SF.columns[0]]} · ${c}`));
    expect.soft(blank, 'Empty cells').toEqual([]);
    const last = sf.tableRoot.locator('thead th').last();
    await last.scrollIntoViewIfNeeded();
    await expect.soft(last, `Last column "${SF.columns.at(-1)}" can be brought into view`).toBeInViewport();
    const filters = (await sf.page.locator('main section.crm-report-toolbar label .crm-label').allInnerTexts()).map(l => l.trim());
    expect.soft(filters, 'Filters').toEqual(SF.filterLabels);
  });

  test(...rep('REP-169'), async ({ reportCatalog, salesFunnel: sf }) => {
    await openReport(reportCatalog, sf);
    const terms = await sf.definedTerms();
    note('defined', terms.join(' | '));
    expect.soft(SF.columns.filter(c => !terms.includes(c)), 'Columns without an explanation').toEqual([]);
    expect.soft(Object.values(T).filter(t => !terms.some(d => d.startsWith(t))), 'Header items without an explanation').toEqual([]);
  });

  test(...rep('REP-170'), async ({ reportCatalog, salesFunnel: sf }) => {
    await openReport(reportCatalog, sf);
    const data = await sf.data();
    const rows = await sf.rows();
    const wrong: string[] = [];
    data.rows.forEach((api, i) => {
      for (const c of data.columns) {
        const v = rows[i]?.[c.label] ?? '';
        const same = c.format === 'text' ? v === String(api[c.key] ?? '') : close(parseNum(v), Number(api[c.key]));
        if (!same) wrong.push(`${api[K.code]} · ${c.label}: shown "${v}" · data ${api[c.key]}`);
      }
    });
    if (wrong.length) note('differences', wrong.join(' | '));
    expect.soft(rows.length, 'Rows shown = rows in the data').toBe(data.rows.length);
    expect.soft(wrong, 'Cells that differ from the report data').toEqual([]);
  });

  // ── 3. Funnel arithmetic ───────────────────────────────────────────────────────────────────────
  test(...rep('REP-171'), async ({ reportCatalog, salesFunnel: sf }) => {
    await openReport(reportCatalog, sf);
    const rows = (await sf.data()).rows;
    rows.forEach((r, i) => {
      const exp = i ? pct(Number(r[K.count]), Number(rows[i - 1][K.count])) : 100;
      note(String(r[K.name]), `${r[K.count]} ÷ ${i ? rows[i - 1][K.count] : '(first stage)'} = ${exp}% · shown ${r[K.stage]}%`);
      expect.soft(Number(r[K.stage]), `${r[K.name]}: Stage Conversion % = Prospect Count ÷ prior stage`).toBeCloseTo(exp, PCT_DECIMALS);
    });
  });

  test(...rep('REP-172'), async ({ reportCatalog, salesFunnel: sf }) => {
    await openReport(reportCatalog, sf);
    const rows = (await sf.data()).rows;
    const top = Number(rows[0]?.[K.count]);
    for (const r of rows) {
      const exp = pct(Number(r[K.count]), top);
      note(String(r[K.name]), `${r[K.count]} ÷ ${top} = ${exp}% · shown ${r[K.cumulative]}%`);
      expect.soft(Number(r[K.cumulative]), `${r[K.name]}: Cumulative Conversion % = Prospect Count ÷ Lead Intake`).toBeCloseTo(exp, PCT_DECIMALS);
    }
  });

  test(...rep('REP-173'), async ({ reportCatalog, salesFunnel: sf }) => {
    await openReport(reportCatalog, sf);
    const rows = (await sf.data()).rows;
    const counts = rows.map(r => Number(r[K.count]));
    note('counts', counts.join(' → '));
    expect.soft(counts.filter((n, i) => i && n > counts[i - 1]).length, 'Each stage holds no more prospects than the one before').toBe(0);
    expect.soft(rows.filter(r => !(Number(r[K.stage]) >= 0 && Number(r[K.stage]) <= 100)).map(r => r[K.name]), 'Stage Conversion % within 0–100').toEqual([]);
    expect.soft(rows.filter(r => !(Number(r[K.count]) >= 0 && Number(r[K.value]) >= 0 && Number(r[K.velocity]) >= 0)).map(r => r[K.name]), 'No negative counts, values or days').toEqual([]);
  });

  test(...rep('REP-174'), async ({ reportCatalog, salesFunnel: sf }) => {
    await openReport(reportCatalog, sf);
    const rows = (await sf.data()).rows;
    const items = await methodology(sf);
    const cumulative = numbers(entry(items, SF.columns[5]) ?? '');
    const velocity = numbers(entry(items, SF.columns[6]) ?? '');
    const kpi = items.find(i => /Executed_SPAs\s*\/\s*Total_Leads_Intake/.test(i)) ?? '';
    const stated = numbers(kpi);
    const counts = rows.map(r => Number(r[K.count]));
    note('methodology', `cumulative ${cumulative.join(' → ')} · velocity ${velocity.join(', ')} · KPI-03: "${kpi.slice(0, 160)}"`);
    expect.soft(rows.map(r => Number(r[K.cumulative])).every(v => cumulative.includes(v)), 'Every Cumulative Conversion % is one the methodology states').toBe(true);
    expect.soft(rows.map(r => Number(r[K.velocity])), 'Avg Stage Velocity = the days the methodology states, in order').toEqual(velocity.slice(0, rows.length));
    expect.soft(stated.includes(counts[0]) && stated.includes(counts.at(-1)!), `The methodology's KPI-03 intake and SPA counts are the report's (${counts[0]}, ${counts.at(-1)})`).toBe(true);
  });

  test(...rep('REP-175'), async ({ reportCatalog, salesFunnel: sf }) => {
    await openReport(reportCatalog, sf);
    const rows = (await sf.data()).rows;
    const listed = entry(await methodology(sf), SF.columns[7]) ?? '';
    note('leakage', rows.map(r => r[K.leakage]).join(' · '));
    expect.soft(rows.filter(r => !listed.includes(String(r[K.leakage]))).map(r => `${r[K.code]} "${r[K.leakage]}"`), 'Leakage strategies the methodology does not list').toEqual([]);
  });

  // ── 4. Stages vs their modules ─────────────────────────────────────────────────────────────────
  SF.stages.forEach((stage, i) => {
    test(...rep(`REP-${176 + i}`), async ({ reportCatalog, salesFunnel: sf, crmData }) => {
      const src = await sources(crmData);
      await openReport(reportCatalog, sf);
      await sf.setPeriod('last_12_months');
      await verify(`${stage} (Last 12 months)`, sf, src, undefined, i);
    });
  });

  test(...rep('REP-181'), async ({ reportCatalog, salesFunnel: sf, executiveDashboard: ed, propertySummary: ps }) => {
    await openReport(reportCatalog, sf);
    const spa = (await sf.data()).rows.at(-1) as Row;
    await reportCatalog.open();
    await reportCatalog.openTab(ED.category);
    await reportCatalog.openReport(ED.code);
    const edSpa = Number((await ed.data()).rows.find(r => r.metricCategory === ED.metrics.spas)?.currentActual);
    await reportCatalog.open();
    await reportCatalog.openTab(PS.category);
    await reportCatalog.openReport(PS.code);
    const psTotal = (await ps.data()).totalRow ?? {};
    note('SPA stage', `RPT-16 ${spa[K.count]} SPAs · ${money(Number(spa[K.value]))}  |  RPT-01 Executed SPAs ${money(edSpa)}  |  RPT-21 ${psTotal[PS.keys.sold]} sold keys · ${money(Number(psTotal[PS.keys.contracted]))}`);
    expect.soft(close(Number(spa[K.value]), edSpa), 'RPT-16 SPA value = RPT-01 Executed SPAs (This month)').toBe(true);
    expect.soft(Number(spa[K.count]), 'RPT-16 SPA count = RPT-21 SPA Sold Keys').toBe(Number(psTotal[PS.keys.sold]));
    expect.soft(close(Number(spa[K.value]), Number(psTotal[PS.keys.contracted])), 'RPT-16 SPA value = RPT-21 Contracted SPA Value').toBe(true);
  });

  test(...rep('REP-182'), async ({ reportCatalog, salesFunnel: sf, dataDictionary: dd }) => {
    await openReport(reportCatalog, sf);
    const rows = (await sf.data()).rows;
    await reportCatalog.open();
    await reportCatalog.openTab(DD.category);
    await reportCatalog.openReport(DD.code);
    const kpi = (await dd.data()).rows.find(r => /Sheet\s+16\b/.test(String(r.primaryDataSource)));
    const formula = String(kpi?.standardFormula ?? '');
    const exp = pct(Number(rows.at(-1)?.[K.count]), Number(rows[0]?.[K.count]));
    note('KPI', `${kpi?.termCode ?? '(none)'} ${kpi?.kpiControlTerm ?? ''}: ${formula} · ${rows.at(-1)?.[K.count]} ÷ ${rows[0]?.[K.count]} = ${exp}% · RPT-16 final cumulative ${rows.at(-1)?.[K.cumulative]}%`);
    expect(kpi, 'RPT-23 defines a KPI sourced from Sheet 16').toBeDefined();
    expect.soft(/Executed_SPAs\s*\/\s*Total_Leads_Intake/.test(formula), 'RPT-23 formula is Executed SPAs ÷ Lead Intake').toBe(true);
    expect.soft(Number(rows.at(-1)?.[K.cumulative]), 'RPT-16 final Cumulative Conversion % = RPT-23 KPI formula').toBeCloseTo(exp, PCT_DECIMALS);
  });

  // ── 5. Filters ─────────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-183'), async ({ reportCatalog, salesFunnel: sf }) => {
    await openReport(reportCatalog, sf);
    const labels = (await sf.periodSelect.locator('option').allInnerTexts()).map(o => o.trim());
    note('options', labels.join(' | '));
    expect.soft(labels, 'Period options').toEqual(REP_TEXT.periods);
    expect.soft(await sf.period(), 'Default period').toBe('this_month');
    await expect.soft(sf.viewButton('All'), 'All is selected by default').toHaveAttribute('aria-pressed', 'true');
  });

  test(...rep('REP-184'), async ({ reportCatalog, salesFunnel: sf, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, sf);
    for (const p of PRESET_PERIODS) {
      await sf.setPeriod(p);
      await verify(`Period ${p}`, sf, src);
    }
  });

  test(...rep('REP-185'), async ({ reportCatalog, salesFunnel: sf, crmData }) => {
    const src = await sources(crmData);
    const days = [...new Set(src.leads.map(l => l.capturedDay).filter(Boolean))].sort();
    test.skip(days.length < 3, 'Fewer than 3 distinct lead capture dates');
    const from = days[Math.floor(days.length / 4)], to = days[Math.floor(days.length / 2)];
    await openReport(reportCatalog, sf);
    await sf.setCustomRange(from, to);
    await verify(`Custom ${from} → ${to}`, sf, src);
  });

  for (const [id, label] of [['REP-186', PROJECT], ['REP-187', SALES], ['REP-188', BROKER], ['REP-189', CAMPAIGN]] as const) {
    test(...rep(id), async ({ reportCatalog, salesFunnel: sf, crmData }) => {
      const src = await sources(crmData);
      await openReport(reportCatalog, sf);
      await sf.setPeriod('last_12_months');
      await eachOption(label, sf, src);
    });
  }

  test(...rep('REP-190'), async ({ reportCatalog, salesFunnel: sf, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, sf);
    await sf.setPeriod('last_12_months');
    const me = await myUserId(sf);
    test.skip(!me, 'The logged-in user is not in the Salesperson dropdown');
    await sf.setView('Mine');
    await expect.soft(sf.viewButton('Mine'), 'Mine is selected').toHaveAttribute('aria-pressed', 'true');
    await verify('Mine', sf, src, me);
  });

  test(...rep('REP-191'), async ({ reportCatalog, salesFunnel: sf }) => {
    await openReport(reportCatalog, sf);
    const before = await sf.selection();
    const defaults = (await sf.data()).rows;
    await sf.setPeriod(PRESET_PERIODS.find(p => p !== before.period)!);
    for (const label of [PROJECT, SALES, BROKER, CAMPAIGN]) {
      const [o] = await sf.options(label);
      if (o) await sf.setFilterValue(label, o.value);
    }
    note('changed to', await shown(sf));
    await sf.resetFilters();
    note('after reset', await shown(sf));
    const { view, ...filters } = await sf.selection();
    expect.soft(filters, 'Period, Project, Salesperson, Broker and Campaign back to the defaults').toEqual(before);
    if (view === 'self') await sf.setView('All');
    const after: ReportData = await sf.data();
    expect.soft(after.rows, 'Stages back to the default values').toEqual(defaults);
  });

  // ── 6. Export ──────────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-192'), async ({ reportCatalog, salesFunnel: sf }) => {
    await openReport(reportCatalog, sf);
    const headers = await sf.headers();
    const total = await sf.totalRecords();
    const { sheet } = await sf.export();
    note('file', `${sheet.name} · sheet "${sheet.sheetName}" · ${sheet.rows.length} rows · ${sheet.header.join(' | ')}`);
    expect.soft(sheet.name, 'File name is .xlsx').toMatch(/\.xlsx$/i);
    expect.soft(sheet.magic, 'File is an Excel (zip) workbook').toBe('PK');
    expect.soft(sheet.sheetName, 'Sheet name').toBe(SF.exportSheet);
    expect.soft(sheet.header, 'Export columns = report columns').toEqual(headers);
    expect.soft(sheet.rows.length, 'Exported rows = Total Records').toBe(total);
  });

  test(...rep('REP-193'), async ({ reportCatalog, salesFunnel: sf }) => {
    await openReport(reportCatalog, sf);
    const data = await sf.data();
    const { sheet } = await sf.export();
    const wrong: string[] = [];
    data.rows.forEach((api, i) => {
      for (const c of data.columns) {
        const v = sheet.rows[i]?.[c.label];
        const same = c.format === 'text' ? String(v ?? '') === String(api[c.key] ?? '') : close(Number(v), Number(api[c.key]));
        if (!same) wrong.push(`${api[K.code]} · ${c.label}: file "${v}" · report ${api[c.key]}`);
      }
    });
    note('export', `${sheet.name}: ${sheet.rows.length} rows${wrong.length ? ` · differences: ${wrong.join(' | ')}` : ''}`);
    expect.soft(sheet.rows.map(r => String(r[SF.columns[0]])), 'Same stages, in order').toEqual(data.rows.map(r => String(r[K.code])));
    expect.soft(wrong, 'Cells that differ between the report and the file').toEqual([]);
  });

  test(...rep('REP-194'), async ({ reportCatalog, salesFunnel: sf }) => {
    await openReport(reportCatalog, sf);
    await sf.setPeriod('last_12_months');
    for (const label of [PROJECT, SALES]) {
      const [o] = await sf.options(label);
      if (o) await sf.setFilterValue(label, o.value);
    }
    const selection = await sf.selection();
    const data = await sf.data();
    const { sheet, query } = await sf.export();
    note('export', `${await shown(sf)} · export request ${new URLSearchParams(query)}`);
    expect.soft(query, 'Export request carries the selected filters').toEqual(selection);
    expect.soft(sheet.rows.map(r => Number(r[SF.columns[2]])), 'File Prospect Counts = report for the selection').toEqual(data.rows.map(r => Number(r[K.count])));
  });

  // ── Additional: negative and boundary ──────────────────────────────────────────────────────────
  test(...rep('REP-195'), async ({ reportCatalog, salesFunnel: sf }) => {
    await openReport(reportCatalog, sf);
    const today = new Date();
    const from = ymd(today), to = ymd(new Date(+today - 864e5));
    await sf.setPeriod('custom');
    await sf.page.locator('main input[type=date]').nth(0).fill(from);
    await sf.page.locator('main input[type=date]').nth(1).fill(to);
    const message = sf.message(REP_TEXT.rangeError).first();
    const shownMsg = await message.waitFor({ timeout: 10_000 }).then(() => true, () => false);
    note('inverted range', `From ${from} · To ${to} · message ${shownMsg ? 'shown' : 'not shown'} · rows still listed ${(await sf.rows()).length}`);
    expect.soft(shownMsg, `Validation message "${REP_TEXT.rangeError}"`).toBe(true);
  });

  test(...rep('REP-196'), async ({ reportCatalog, salesFunnel: sf, crmData }) => {
    const src = await sources(crmData);
    await openReport(reportCatalog, sf);
    await sf.setPeriod('last_month');
    const before = await shown(sf);
    await sf.page.reload();
    await expect(sf.tableRoot.locator('tbody tr').first(), 'Report reloaded').toBeVisible({ timeout: 20_000 });
    note('refresh', `before: ${before}  →  after: ${await shown(sf)}`);
    await verify('After refresh', sf, src);
  });
});
