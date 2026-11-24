/**
 * Reports workbook — RPT-19 Smart Sales Forecast (REP-197 … REP-221).
 * Reports & Analytics → Sales Reports tab → "Open RPT-19 →". Each forecast month is checked for its own arithmetic,
 * against the methodology, and against its sources: open opportunities (volume, probability, closing yield) and
 * Inventory (selling price, stock); KPI-06 against RPT-23 / RPT-18 and month labels against RPT-20
 * (see smart-forecast.data.ts). The report has no filters since build index-Dmirkzo4. Read-only.
 */
import { test, expect, note } from '../pages/fixtures';
import { REP_TEXT, REP_XP, ROUTES, at } from '../locators';
import { parseNum, ymd } from '../helpers';
import type { SingleReportPage } from '../pages/SingleReportPage';
import type { ReportCatalogPage } from '../pages/ReportCatalogPage';
import { rep } from './catalog';
import { CREATED_WITHIN_MS } from './lead-register.data';
import { close } from './executive-dashboard.data';
import { value } from './control-assumptions.data';
import {
  K, PROBABILITY_POINTS, escalationOf, monthOf, nextMonth, pipelineFor, prices, probabilities, sameFormula, statedFigures,
} from './smart-forecast.data';

const SF = REP_TEXT.smartForecast;
const RM = REP_TEXT.revenueManagement;
const T = REP_TEXT.tiles;
type Row = Record<string, unknown>;

test.describe.configure({ timeout: 180_000 });

// ── Report helpers ──────────────────────────────────────────────────────────────────────────────
/** Opens RPT-19 the way a user does: catalogue → Sales Reports tab → Open RPT-19. */
async function openReport(reportCatalog: ReportCatalogPage, fc: SingleReportPage) {
  await reportCatalog.open();
  await reportCatalog.openTab(SF.category);
  await reportCatalog.openReport(SF.code);
  await expect(fc.title, 'Smart Sales Forecast opened').toHaveText(SF.title, { timeout: 15_000 });
  await expect(fc.tableRoot.locator('tbody tr').first(), 'Report rows loaded').toBeVisible({ timeout: 15_000 });
}

async function methodology(fc: SingleReportPage): Promise<string[]> {
  return (await at(fc.page, REP_XP.definitionItems).allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
}

const money = (n: number) => Math.round(n).toLocaleString('en-US');
const num = (r: Row | undefined, k: string) => Number(r?.[k]);

/** The "Report Created" chip as a date. */
async function createdAt(fc: SingleReportPage): Promise<Date> {
  return new Date((await fc.tile(T.created)).replace(',', ''));
}

test.describe('Reports · RPT-19 Smart Sales Forecast', () => {
  // ── 1. Navigation ──────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-197'), async ({ reportCatalog, smartForecast: fc, page }) => {
    fc.watchErrors();
    await reportCatalog.open();
    await reportCatalog.openTab(SF.category);
    const card = await reportCatalog.readCard(SF.code);
    note('card', `${card.code} · ${card.title} · ${card.category}`);
    expect.soft(card.title, 'Card title').toBe(SF.title);
    await reportCatalog.openReport(SF.code);
    await expect.soft(page, 'URL').toHaveURL(new RegExp(`${SF.route}\\?${SF.query}`));
    await expect.soft(fc.code, 'Report code').toHaveText(SF.code);
    await expect.soft(fc.title, 'Report title').toHaveText(SF.title);
    await expect(fc.tableRoot.locator('tbody tr').first(), 'Report rows loaded').toBeVisible({ timeout: 15_000 });
    await fc.expectNoBrokenValues();
    fc.expectNoErrors();
  });

  test(...rep('REP-198'), async ({ reportCatalog, smartForecast: fc, page }) => {
    await openReport(reportCatalog, fc);
    await expect.soft(fc.backLink, 'Back link').toHaveText(SF.backLabel);
    for (const code of SF.siblings) {
      await expect.soft(fc.siblingPill(code), `Pill ${code}`).toBeVisible();
      await fc.siblingPill(code).click();
      await expect.soft(fc.code, `${code} opens`).toHaveText(code);
      await fc.open();
      await expect(fc.code, 'Back on RPT-19').toHaveText(SF.code);
    }
    await fc.backLink.click();
    // since build index-Dmirkzo4 the back link opens the catalogue as /reports?cat=<category>
    await expect.soft(page, 'Back link → catalogue category').toHaveURL(new RegExp(`(${ROUTES.hub}|/reports)\\?cat=`));
    await expect.soft(reportCatalog.tab(SF.category), 'Sales Reports tab selected').toHaveAttribute('aria-selected', 'true');
  });

  test(...rep('REP-199'), async ({ reportCatalog, smartForecast: fc }) => {
    await openReport(reportCatalog, fc);
    const data = await fc.data();
    const total = await fc.totalRecords();
    const rows = (await fc.rows()).length;
    const stated = statedFigures(await methodology(fc)).months;
    const created = await fc.tile(T.created);
    const by = await fc.tile(T.createdBy);
    const user = await fc.userName();
    note('header', `Total ${total} · rows ${rows} · API total ${data.total} · methodology ${stated} · Created ${created} · Created By ${by} · logged in as ${user}`);
    expect.soft(total, 'Total Records = rows shown').toBe(rows);
    expect.soft(total, 'Total Records = API total').toBe(data.total);
    expect.soft(total, 'Total Records = the monthly horizons the methodology states').toBe(stated);
    const when = await createdAt(fc);
    expect.soft(!isNaN(+when) && Math.abs(+when - Date.now()) < CREATED_WITHIN_MS, `Created date/time is now (${created})`).toBeTruthy();
    expect.soft(by.replace(/\s*\([^)]*\)$/, ''), 'Created By = logged-in user').toBe(user);
  });

  // ── 2. Structure ───────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-200'), async ({ reportCatalog, smartForecast: fc }) => {
    await openReport(reportCatalog, fc);
    const headers = await fc.headers();
    const rows = await fc.rows();
    const stated = statedFigures(await methodology(fc));
    const labels = rows.map(r => r[SF.columns[0]]);
    const months = labels.map(monthOf);
    note('table', `${headers.join(' | ')} · periods ${labels.join(', ')} · methodology ${stated.from?.code} ${stated.from?.ym} → ${stated.to?.code} ${stated.to?.ym}`);
    expect.soft(headers, 'Columns').toEqual(SF.columns);
    expect.soft(labels.filter((l, i) => !months[i]), 'Periods not labelled "Mnn (Mon YYYY)"').toEqual([]);
    expect.soft(labels.filter((l, i) => months[i] && months[i]!.n !== Number(months[i]!.ym.slice(5))), 'Periods whose Mnn is not their month number').toEqual([]);
    expect.soft(months.filter((m, i) => i && m && months[i - 1] && m.ym !== nextMonth(months[i - 1]!.ym)).map(m => m!.code), 'Periods that do not follow the month before').toEqual([]);
    expect.soft([months[0]?.ym, months.at(-1)?.ym], 'First and last month = the horizon the methodology states').toEqual([stated.from?.ym, stated.to?.ym]);
    const blank = rows.flatMap(r => SF.columns.filter(c => !/\S/.test(r[c] ?? '')).map(c => `${r[SF.columns[0]]} · ${c}`));
    expect.soft(blank, 'Empty cells').toEqual([]);
    const last = fc.tableRoot.locator('thead th').last();
    await last.scrollIntoViewIfNeeded();
    await expect.soft(last, `Last column "${SF.columns.at(-1)}" can be brought into view`).toBeInViewport();
  });

  test(...rep('REP-201'), async ({ reportCatalog, smartForecast: fc }) => {
    await openReport(reportCatalog, fc);
    const terms = await fc.definedTerms();
    note('defined', terms.join(' | '));
    expect.soft(SF.columns.filter(c => !terms.includes(c)), 'Columns without an explanation').toEqual([]);
    expect.soft(Object.values(T).filter(t => !terms.some(d => d.startsWith(t))), 'Header items without an explanation').toEqual([]);
  });

  test(...rep('REP-202'), async ({ reportCatalog, smartForecast: fc }) => {
    await openReport(reportCatalog, fc);
    const data = await fc.data();
    const rows = await fc.rows();
    const foot = await fc.totalRow();
    const wrong: string[] = [];
    const compare = (shown: Record<string, string> | undefined, api: Row, what: string) => {
      for (const c of data.columns) {
        const v = shown?.[c.label] ?? '';
        const a = api[c.key];
        const same = a === null || a === undefined ? /^[—–-]$/.test(v)
          : c.format === 'text' ? v === String(a) : close(parseNum(v), Number(a));
        if (!same) wrong.push(`${what} · ${c.label}: shown "${v}" · data ${a}`);
      }
    };
    data.rows.forEach((api, i) => compare(rows[i], api, String(api[K.period])));
    expect(data.totalRow, 'The report data has a total row').toBeDefined();
    compare(foot, data.totalRow!, SF.totalLabel);
    if (wrong.length) note('differences', wrong.join(' | '));
    expect.soft(rows.length, 'Rows shown = rows in the data').toBe(data.rows.length);
    expect.soft(foot?.[SF.columns[0]], 'Total row label').toBe(SF.totalLabel);
    expect.soft(wrong, 'Cells that differ from the report data').toEqual([]);
  });

  test(...rep('REP-203'), async ({ reportCatalog, smartForecast: fc }) => {
    await openReport(reportCatalog, fc);
    const filters = (await fc.page.locator('main section.crm-report-toolbar label .crm-label').allInnerTexts()).map(l => l.trim());
    const views = await Promise.all((['All', 'Mine'] as const).map(v => fc.viewButton(v).count()));
    const reset = await fc.page.getByRole('button', { name: 'Reset filters' }).count();
    note('controls', `filters: ${filters.join(', ') || 'none'} · All/Mine buttons ${views.join('/')} · Reset ${reset}`);
    expect.soft(filters, 'No filters shown').toEqual([]);
    expect.soft(views, 'No All / Mine toggle').toEqual([0, 0]);
    expect.soft(reset, 'No Reset filters button').toBe(0);
  });

  // ── 3. Forecast arithmetic ─────────────────────────────────────────────────────────────────────
  test(...rep('REP-204'), async ({ reportCatalog, smartForecast: fc }) => {
    await openReport(reportCatalog, fc);
    for (const r of (await fc.data()).rows) {
      const exp = num(r, K.volume) * num(r, K.probability) / 100;
      note(String(r[K.period]), `${r[K.volume]} × ${r[K.probability]}% = ${exp} · shown ${r[K.absorption]}`);
      expect.soft(Math.abs(num(r, K.absorption) - exp) <= 0.5, `${r[K.period]}: Expected Unit Sales Absorption ${r[K.absorption]} = ${exp}`).toBe(true);
    }
  });

  test(...rep('REP-205'), async ({ reportCatalog, smartForecast: fc }) => {
    await openReport(reportCatalog, fc);
    for (const r of (await fc.data()).rows) {
      const exp = num(r, K.absorption) * num(r, K.price);
      note(String(r[K.period]), `${r[K.absorption]} × ${money(num(r, K.price))} = ${money(exp)} · shown ${money(num(r, K.monthly))}`);
      // the price is shown in whole dollars, so the product may differ by up to $1 per unit
      expect.soft(Math.abs(num(r, K.monthly) - exp) <= Math.max(1, num(r, K.absorption)), `${r[K.period]}: Projected Monthly Contract Sales ${money(num(r, K.monthly))} = ${money(exp)}`).toBe(true);
    }
  });

  test(...rep('REP-206'), async ({ reportCatalog, smartForecast: fc }) => {
    await openReport(reportCatalog, fc);
    let running = 0;
    for (const r of (await fc.data()).rows) {
      running += num(r, K.monthly);
      note(String(r[K.period]), `running total ${money(running)} · shown ${money(num(r, K.cumulative))}`);
      expect.soft(num(r, K.cumulative), `${r[K.period]}: Cumulative Projected Sales = running total`).toBe(running);
    }
  });

  test(...rep('REP-207'), async ({ reportCatalog, smartForecast: fc }) => {
    await openReport(reportCatalog, fc);
    const { rows, totalRow } = await fc.data();
    expect(totalRow, 'The report has a TOTAL FORECAST row').toBeDefined();
    const sum = (k: string) => rows.reduce((s, r) => s + num(r, k), 0);
    note('totals', `volume ${sum(K.volume)} / ${totalRow![K.volume]} · units ${sum(K.absorption)} / ${totalRow![K.absorption]} · sales ${money(sum(K.monthly))} / ${money(num(totalRow, K.monthly))} · cumulative ${money(num(rows.at(-1), K.cumulative))} / ${money(num(totalRow, K.cumulative))}`);
    expect.soft(totalRow![K.period], 'Total row label').toBe(SF.totalLabel);
    expect.soft(num(totalRow, K.volume), 'Total pipeline volume = sum of the months').toBe(sum(K.volume));
    expect.soft(num(totalRow, K.absorption), 'Total absorption = sum of the months').toBe(sum(K.absorption));
    expect.soft(num(totalRow, K.monthly), 'Total projected sales = sum of the months').toBe(sum(K.monthly));
    expect.soft(num(totalRow, K.cumulative), "Total cumulative = the last month's cumulative").toBe(num(rows.at(-1), K.cumulative));
    expect.soft([totalRow![K.probability], totalRow![K.price]], 'Probability and price have no total').toEqual([null, null]);
  });

  test(...rep('REP-208'), async ({ reportCatalog, smartForecast: fc }) => {
    await openReport(reportCatalog, fc);
    const { rows, totalRow } = await fc.data();
    const st = statedFigures(await methodology(fc));
    const [lo, hi] = st.price;
    const [amin, amax] = st.absorption;
    note('methodology', `probability ${st.probability}% · price ${money(lo)}–${money(hi)} · absorption ${amin}–${amax} units/month · total ${money(st.total)} · ${st.units} units`);
    expect.soft(rows.filter(r => num(r, K.probability) !== st.probability).map(r => `${r[K.period]} ${r[K.probability]}%`), `Months not at the stated ${st.probability}%`).toEqual([]);
    // the stated range is rounded to two decimals in millions ($1.56M), so allow that rounding
    const round = 0.005e6;
    expect.soft(rows.filter(r => !(num(r, K.price) >= lo - round && num(r, K.price) <= hi + round)).map(r => `${r[K.period]} ${money(num(r, K.price))}`), 'Prices outside the stated range').toEqual([]);
    expect.soft(rows.filter(r => !(num(r, K.absorption) >= amin && num(r, K.absorption) <= amax)).map(r => `${r[K.period]} ${r[K.absorption]}`), 'Absorption outside the stated units/month').toEqual([]);
    expect.soft(num(totalRow, K.monthly), 'Stated total forecast = TOTAL FORECAST').toBe(st.total);
    expect.soft(num(totalRow, K.absorption), 'Stated absorption units = TOTAL FORECAST').toBe(st.units);
  });

  test(...rep('REP-209'), async ({ reportCatalog, smartForecast: fc }) => {
    await openReport(reportCatalog, fc);
    const rows = (await fc.data()).rows;
    const bad = rows.flatMap(r => [
      ...[K.volume, K.absorption, K.price, K.monthly, K.cumulative].filter(k => !(num(r, k) >= 0)).map(k => `${r[K.period]} ${k} ${r[k]}`),
      ...(num(r, K.probability) >= 0 && num(r, K.probability) <= 100 ? [] : [`${r[K.period]} probability ${r[K.probability]}`]),
      ...(Number.isInteger(num(r, K.absorption)) && num(r, K.absorption) <= num(r, K.volume) ? [] : [`${r[K.period]} absorption ${r[K.absorption]} of ${r[K.volume]}`]),
    ]);
    note('checked', `${rows.length} months`);
    expect.soft(bad, 'Negative or impossible values').toEqual([]);
  });

  // ── 4. Forecast vs modules ─────────────────────────────────────────────────────────────────────
  test(...rep('REP-210'), async ({ reportCatalog, smartForecast: fc }) => {
    await openReport(reportCatalog, fc);
    const rows = (await fc.data()).rows;
    const now = ymd(await createdAt(fc)).slice(0, 7);
    const past = rows.filter(r => (monthOf(String(r[K.period]))?.ym ?? '') < now).map(r => String(r[K.period]));
    note('horizon', `report created in ${now} · forecast ${rows[0]?.[K.period]} … ${rows.at(-1)?.[K.period]} · months before the report date: ${past.join(', ') || 'none'}`);
    expect.soft(past, 'Forecast months before the month the report was created').toEqual([]);
  });

  test(...rep('REP-211'), async ({ reportCatalog, smartForecast: fc, crmData }) => {
    const opps = await crmData.opportunities();
    await openReport(reportCatalog, fc);
    for (const r of (await fc.data()).rows) {
      const m = monthOf(String(r[K.period]));
      const e = pipelineFor(opps, m?.ym ?? '');
      const got = num(r, K.volume);
      note(String(r[K.period]), `report ${got} · open opportunities closing in ${m?.ym}: ${e.must} (${e.records.join(', ') || 'none'}) · open with no close date: ${e.undated}`);
      expect.soft(got >= e.must && got <= e.may, `${r[K.period]}: Pipeline Opportunity Volume ${got} = ${e.must === e.may ? e.must : `${e.must}–${e.may}`} open opportunities`).toBe(true);
    }
  });

  test(...rep('REP-212'), async ({ reportCatalog, smartForecast: fc, crmData }) => {
    const p = probabilities(await crmData.opportunities());
    await openReport(reportCatalog, fc);
    const total = num((await fc.data()).totalRow, K.volume);
    note('pipeline', `report total ${total} · open opportunities ${p.open}`);
    expect.soft(total, 'Total Pipeline Opportunity Volume ≤ open opportunities').toBeLessThanOrEqual(p.open);
  });

  test(...rep('REP-213'), async ({ reportCatalog, smartForecast: fc, crmData }) => {
    const p = probabilities(await crmData.opportunities());
    await openReport(reportCatalog, fc);
    const shown = [...new Set((await fc.data()).rows.map(r => num(r, K.probability)))];
    const fixed = (n: number) => n.toFixed(1);
    note('probability', `report ${shown.join(', ')}% · open pipeline (${p.open}): average ${fixed(p.mean)}%, budget-weighted ${fixed(p.weighted)}% · closing yield ${p.won} won ÷ ${p.won + p.lost} closed = ${fixed(p.yield)}%`);
    for (const v of shown) {
      const fits = [p.mean, p.weighted, p.yield].some(e => Math.abs(v - e) <= PROBABILITY_POINTS);
      expect.soft(fits, `Weighted Conversion Probability ${v}% = pipeline average ${fixed(p.mean)}%, weighted ${fixed(p.weighted)}% or closing yield ${fixed(p.yield)}%`).toBe(true);
    }
  });

  test(...rep('REP-214'), async ({ reportCatalog, smartForecast: fc, crmData }) => {
    const pr = prices(await crmData.units());
    test.skip(!pr.available, 'No Available units in Inventory');
    await openReport(reportCatalog, fc);
    const rows = (await fc.data()).rows;
    const now = ymd(await createdAt(fc)).slice(0, 7);
    const current = rows.find(r => monthOf(String(r[K.period]))?.ym === now) ?? rows[0];
    const price = num(current, K.price);
    note('price', `${current[K.period]} ${money(price)} · Inventory: ${pr.available} Available units averaging ${money(pr.availableAvg)} (range ${money(pr.min)}–${money(pr.max)}) · all units ${money(pr.allAvg)}`);
    expect.soft(close(price, pr.availableAvg) || close(price, pr.allAvg), `${current[K.period]} price ${money(price)} = average base price ${money(pr.availableAvg)} (Available) or ${money(pr.allAvg)} (all units)`).toBe(true);
    expect.soft(rows.filter(r => !(num(r, K.price) >= pr.min && num(r, K.price) <= pr.max)).map(r => `${r[K.period]} ${money(num(r, K.price))}`), "Prices outside the Available units' range").toEqual([]);
  });

  test(...rep('REP-215'), async ({ reportCatalog, smartForecast: fc, crmData }) => {
    const pr = prices(await crmData.units());
    await openReport(reportCatalog, fc);
    const units = num((await fc.data()).totalRow, K.absorption);
    note('stock', `forecast absorption ${units} units · Available in Inventory ${pr.available}`);
    expect.soft(units, 'Total Expected Unit Sales Absorption ≤ Available units').toBeLessThanOrEqual(pr.available);
  });

  test(...rep('REP-216'), async ({ reportCatalog, smartForecast: fc, dataDictionary: dd, revenueManagement: rm }) => {
    await openReport(reportCatalog, fc);
    const kpi = statedFigures(await methodology(fc)).kpi06;
    expect(kpi, 'RPT-19 methodology states KPI-06').not.toBe('');
    // RPT-23 and RPT-18 have no catalogue card since build index-Dmirkzo4; they still open by their own address
    await dd.open();
    const def = (await dd.data()).rows.find(r => String(r.termCode) === 'KPI-06');
    const formula = String(def?.standardFormula ?? '');
    await rm.open();
    const rmRows = (await rm.data()).rows;
    const escalated = rmRows.find(r => r[RM.keys.action] === RM.actions.HIGH_DEMAND.standard);
    const rmRate = escalated ? Number(escalated[RM.keys.adjustment]) : value(RM.actions.HIGH_DEMAND.standard);
    note('KPI-06', `RPT-19: ${kpi} · RPT-23: ${formula || '(none)'} · factor ${escalationOf(kpi)}% · RPT-18 standard escalation ${rmRate}%${escalated ? ` (${escalated[RM.keys.name]})` : ' (action text)'}`);
    expect(def, 'RPT-23 defines KPI-06').toBeDefined();
    expect.soft(sameFormula(kpi, formula), 'KPI-06 formula = RPT-23 standard formula').toBe(true);
    expect.soft(escalationOf(kpi), "KPI-06 escalation = RPT-18's standard price escalation").toBe(rmRate);
  });

  test(...rep('REP-217'), async ({ reportCatalog, smartForecast: fc, crmData }) => {
    await openReport(reportCatalog, fc);
    const data = await fc.data();
    const body = await crmData.get<{ tables: { key: string; rows: Row[] }[] }>(`/reports/business${SF.route.replace('/reports', '')}?period=${data.meta.period.period}`);
    const cf = body.tables.find(t => t.key === SF.cashFlow.panelId);
    expect(cf, `${SF.cashFlow.code} data`).toBeDefined();
    const cfMonths = new Map(cf!.rows.map(r => monthOf(String(r[SF.cashFlow.period]))).filter(Boolean).map(m => [m!.code, m!.ym]));
    const clash = data.rows.map(r => monthOf(String(r[K.period]))).filter(m => m && cfMonths.has(m.code) && cfMonths.get(m.code) !== m.ym)
      .map(m => `${m!.code}: RPT-19 ${m!.ym} · ${SF.cashFlow.code} ${cfMonths.get(m!.code)}`);
    note('labels', `${SF.cashFlow.code} ${[...cfMonths].slice(0, 3).map(([c, m]) => `${c}=${m}`).join(', ')} … · differences: ${clash.join(' | ') || 'none'}`);
    test.skip(!data.rows.some(r => cfMonths.has(monthOf(String(r[K.period]))?.code ?? '')), `No label shared with ${SF.cashFlow.code}`);
    expect.soft(clash, `Labels naming a different month in ${SF.cashFlow.code}`).toEqual([]);
  });

  // ── 5. Export ──────────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-218'), async ({ reportCatalog, smartForecast: fc }) => {
    await openReport(reportCatalog, fc);
    const headers = await fc.headers();
    const total = await fc.totalRecords();
    const { sheet } = await fc.export();
    note('file', `${sheet.name} · sheet "${sheet.sheetName}" · ${sheet.rows.length} rows + total "${sheet.total?.[SF.columns[0]] ?? '(none)'}" · ${sheet.header.join(' | ')}`);
    expect.soft(sheet.name, 'File name is .xlsx').toMatch(/\.xlsx$/i);
    expect.soft(sheet.magic, 'File is an Excel (zip) workbook').toBe('PK');
    expect.soft(sheet.sheetName, 'Sheet name').toBe(SF.exportSheet);
    expect.soft(sheet.header, 'Export columns = report columns').toEqual(headers);
    expect.soft(sheet.rows.length, 'Exported months = Total Records').toBe(total);
    expect.soft(sheet.total?.[SF.columns[0]], 'Export has the TOTAL FORECAST row').toBe(SF.totalLabel);
  });

  test(...rep('REP-219'), async ({ reportCatalog, smartForecast: fc }) => {
    await openReport(reportCatalog, fc);
    const data = await fc.data();
    const { sheet } = await fc.export();
    const wrong: string[] = [];
    [...data.rows, data.totalRow ?? {}].forEach((api, i) => {
      const file = i < data.rows.length ? sheet.rows[i] : sheet.total;
      for (const c of data.columns) {
        const v = file?.[c.label], a = api[c.key];
        const same = a === null || a === undefined ? v === null || v === undefined || v === ''
          : c.format === 'text' ? String(v ?? '') === String(a) : close(Number(v), Number(a));
        if (!same) wrong.push(`${api[K.period] ?? SF.totalLabel} · ${c.label}: file "${v}" · report ${a}`);
      }
    });
    note('export', `${sheet.name}: ${sheet.rows.length} rows${wrong.length ? ` · differences: ${wrong.join(' | ')}` : ''}`);
    expect.soft(sheet.rows.map(r => String(r[SF.columns[0]])), 'Same months, in order').toEqual(data.rows.map(r => String(r[K.period])));
    expect.soft(wrong, 'Cells that differ between the report and the file').toEqual([]);
  });

  // ── Additional: negative and display ───────────────────────────────────────────────────────────
  test(...rep('REP-220'), async ({ reportCatalog, smartForecast: fc }) => {
    await openReport(reportCatalog, fc);
    const before = (await fc.data()).rows;
    const created = await createdAt(fc);
    await fc.page.waitForTimeout(61_000); // the chip shows minutes, so let a minute pass
    const reloadedAt = Date.now();
    await fc.page.reload();
    await expect(fc.tableRoot.locator('tbody tr').first(), 'Report reloaded').toBeVisible({ timeout: 20_000 });
    const after = await createdAt(fc);
    note('refresh', `Report Created ${created.toLocaleString()} → ${after.toLocaleString()}`);
    expect.soft((await fc.data()).rows, 'Same forecast after reload').toEqual(before);
    expect.soft(+after > +created && Math.abs(+after - reloadedAt) < CREATED_WITHIN_MS, 'Report Created is the reload time').toBe(true);
  });

  test(...rep('REP-221'), async ({ reportCatalog, smartForecast: fc }) => {
    await openReport(reportCatalog, fc);
    const data = await fc.data();
    const rows = await fc.rows();
    const currency = (data.meta as { baseCurrencyCode?: string }).baseCurrencyCode ?? '';
    const pattern: Record<string, RegExp> = {
      money: new RegExp(`^-?[\\d.,]+[KMB]? ${currency}$`), percent: /^-?\d+(\.\d+)?%$/, number: /^-?\d[\d,]*$/, text: /\S/,
    };
    const bad = rows.flatMap(r => data.columns.filter(c => !(pattern[c.format] ?? /\S/).test(r[c.label] ?? '')).map(c => `${r[SF.columns[0]]} · ${c.label} "${r[c.label]}"`));
    note('format', `base currency ${currency} · e.g. ${SF.columns.map(c => rows[0]?.[c]).join(' | ')}`);
    expect(currency, 'The report states its base currency').not.toBe('');
    expect.soft(bad, 'Cells not in the format of their column').toEqual([]);
  });
});
