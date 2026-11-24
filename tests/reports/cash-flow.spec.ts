/**
 * Reports workbook — RPT-20 Project Cash Flow Forecast (REP-222 … REP-246).
 * Reports & Analytics → Sales Reports tab → "Open RPT-20 →". Each month is checked for its own arithmetic, against
 * the methodology, and against its sources: signed SPAs' payment-plan lines (inflows), RPT-03 (broker rate),
 * RPT-10 / RPT-01 (escrow receipts) — see cash-flow.data.ts. The report has no filters since build index-Dmirkzo4.
 * Read-only.
 */
import { test, expect, note } from '../pages/fixtures';
import { REP_TEXT, REP_XP, ROUTES, at } from '../locators';
import { parseNum, ymd } from '../helpers';
import type { SingleReportPage } from '../pages/SingleReportPage';
import type { ReportCatalogPage } from '../pages/ReportCatalogPage';
import { rep } from './catalog';
import { CREATED_WITHIN_MS } from './lead-register.data';
import { EXECUTED, close } from './executive-dashboard.data';
import { value } from './control-assumptions.data';
import { K, brokerByMonth, clearedInEscrow, codeAt, inflowsByMonth, monthOf, nextMonth, statedFigures } from './cash-flow.data';

const CF = REP_TEXT.cashFlow;
const ED = REP_TEXT.executiveDashboard;
const CA = REP_TEXT.controlAssumptions;
const T = REP_TEXT.tiles;
type Row = Record<string, unknown>;

test.describe.configure({ timeout: 180_000 });

// ── Report helpers ──────────────────────────────────────────────────────────────────────────────
/** Opens RPT-20 the way a user does: catalogue → Sales Reports tab → Open RPT-20. */
async function openReport(reportCatalog: ReportCatalogPage, cf: SingleReportPage) {
  await reportCatalog.open();
  await reportCatalog.openTab(CF.category);
  await reportCatalog.openReport(CF.code);
  await expect(cf.title, 'Project Cash Flow Forecast opened').toHaveText(CF.title, { timeout: 15_000 });
  await expect(cf.tableRoot.locator('tbody tr').first(), 'Report rows loaded').toBeVisible({ timeout: 15_000 });
}

async function methodology(cf: SingleReportPage): Promise<string[]> {
  return (await at(cf.page, REP_XP.definitionItems).allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
}

const money = (n: number) => Math.round(n).toLocaleString('en-US');
const num = (r: Row | undefined, k: string) => Number(r?.[k]);
/** Amounts are compared to the cent (the report keeps cents, e.g. 898,148.8). */
const cents = (a: number, b: number) => Math.abs(a - b) < 0.01;

async function createdAt(cf: SingleReportPage): Promise<Date> {
  return new Date((await cf.tile(T.created)).replace(',', ''));
}

/** RPT-03 Standard Broker Commission Rate, in %. */
async function brokerRate(crmData: { governanceTable(k: string): Promise<Record<string, string>[]> }) {
  const row = (await crmData.governanceTable(CA.panelId)).find(r => r.parameter === CA.brokerRate);
  expect(row, `RPT-03 "${CA.brokerRate}"`).toBeDefined();
  return value(row!.baseValue);
}

test.describe('Reports · RPT-20 Project Cash Flow Forecast', () => {
  // ── 1. Navigation ──────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-222'), async ({ reportCatalog, cashFlow: cf, page }) => {
    cf.watchErrors();
    await reportCatalog.open();
    await reportCatalog.openTab(CF.category);
    const card = await reportCatalog.readCard(CF.code);
    note('card', `${card.code} · ${card.title} · ${card.category}`);
    expect.soft(card.title, 'Card title').toBe(CF.title);
    await reportCatalog.openReport(CF.code);
    await expect.soft(page, 'URL').toHaveURL(new RegExp(`${CF.route}\\?${CF.query}`));
    await expect.soft(cf.code, 'Report code').toHaveText(CF.code);
    await expect.soft(cf.title, 'Report title').toHaveText(CF.title);
    await expect(cf.tableRoot.locator('tbody tr').first(), 'Report rows loaded').toBeVisible({ timeout: 15_000 });
    await cf.expectNoBrokenValues();
    cf.expectNoErrors();
  });

  test(...rep('REP-223'), async ({ reportCatalog, cashFlow: cf, page }) => {
    await openReport(reportCatalog, cf);
    await expect.soft(cf.backLink, 'Back link').toHaveText(CF.backLabel);
    for (const code of CF.siblings) {
      await expect.soft(cf.siblingPill(code), `Pill ${code}`).toBeVisible();
      await cf.siblingPill(code).click();
      await expect.soft(cf.code, `${code} opens`).toHaveText(code);
      await cf.open();
      await expect(cf.code, 'Back on RPT-20').toHaveText(CF.code);
    }
    await cf.backLink.click();
    // since build index-Dmirkzo4 the back link opens the catalogue as /reports?cat=<category>
    await expect.soft(page, 'Back link → catalogue category').toHaveURL(new RegExp(`(${ROUTES.hub}|/reports)\\?cat=`));
    await expect.soft(reportCatalog.tab(CF.category), 'Sales Reports tab selected').toHaveAttribute('aria-selected', 'true');
  });

  test(...rep('REP-224'), async ({ reportCatalog, cashFlow: cf }) => {
    await openReport(reportCatalog, cf);
    const data = await cf.data();
    const total = await cf.totalRecords();
    const rows = (await cf.rows()).length;
    const stated = statedFigures(await methodology(cf)).periods;
    const created = await cf.tile(T.created);
    const by = await cf.tile(T.createdBy);
    const user = await cf.userName();
    note('header', `Total ${total} · rows ${rows} · API total ${data.total} · methodology ${stated} · Created ${created} · Created By ${by} · logged in as ${user}`);
    expect.soft(total, 'Total Records = rows shown').toBe(rows);
    expect.soft(total, 'Total Records = API total').toBe(data.total);
    expect.soft(total, 'Total Records = the periods the methodology states').toBe(stated);
    const when = await createdAt(cf);
    expect.soft(!isNaN(+when) && Math.abs(+when - Date.now()) < CREATED_WITHIN_MS, `Created date/time is now (${created})`).toBeTruthy();
    expect.soft(by.replace(/\s*\([^)]*\)$/, ''), 'Created By = logged-in user').toBe(user);
  });

  // ── 2. Structure ───────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-225'), async ({ reportCatalog, cashFlow: cf }) => {
    await openReport(reportCatalog, cf);
    const headers = await cf.headers();
    const rows = await cf.rows();
    const labels = rows.map(r => r[CF.columns[0]]);
    note('table', `${headers.join(' | ')} · periods ${labels.join(', ')}`);
    expect.soft(headers, 'Columns').toEqual(CF.columns);
    expect.soft(labels.filter(l => !monthOf(l)), 'Periods not labelled "Mnn (Mon YYYY)"').toEqual([]);
    expect.soft(labels.filter((l, i) => monthOf(l) && monthOf(l)!.code !== codeAt(i)), 'Periods whose code is not their two-digit place (M01 … M18)').toEqual([]);
    const blank = rows.flatMap(r => CF.columns.filter(c => !/\S/.test(r[c] ?? '')).map(c => `${r[CF.columns[0]]} · ${c}`));
    expect.soft(blank, 'Empty cells').toEqual([]);
    const last = cf.tableRoot.locator('thead th').last();
    await last.scrollIntoViewIfNeeded();
    await expect.soft(last, `Last column "${CF.columns.at(-1)}" can be brought into view`).toBeInViewport();
  });

  test(...rep('REP-226'), async ({ reportCatalog, cashFlow: cf }) => {
    await openReport(reportCatalog, cf);
    const months = (await cf.data()).rows.map(r => monthOf(String(r[K.period]))?.ym ?? '');
    const gaps = months.flatMap((m, i) => i && m !== nextMonth(months[i - 1]) ? [`${months[i - 1]} → ${m} (missing ${nextMonth(months[i - 1])})`] : []);
    note('months', `${months.join(', ')}${gaps.length ? ` · gaps: ${gaps.join(' | ')}` : ''}`);
    expect.soft(gaps, 'Months skipped in the horizon').toEqual([]);
  });

  test(...rep('REP-227'), async ({ reportCatalog, cashFlow: cf }) => {
    await openReport(reportCatalog, cf);
    const terms = await cf.definedTerms();
    note('defined', terms.join(' | '));
    expect.soft(CF.columns.filter(c => !terms.includes(c)), 'Columns without an explanation').toEqual([]);
    expect.soft(Object.values(T).filter(t => !terms.some(d => d.startsWith(t))), 'Header items without an explanation').toEqual([]);
  });

  test(...rep('REP-228'), async ({ reportCatalog, cashFlow: cf }) => {
    await openReport(reportCatalog, cf);
    const data = await cf.data();
    const rows = await cf.rows();
    const foot = await cf.totalRow();
    const wrong: string[] = [];
    const compare = (shown: Record<string, string> | undefined, api: Row, what: string) => {
      for (const c of data.columns) {
        const v = shown?.[c.label] ?? '';
        const same = c.format === 'text' ? v === String(api[c.key] ?? '') : close(parseNum(v), Number(api[c.key]));
        if (!same) wrong.push(`${what} · ${c.label}: shown "${v}" · data ${api[c.key]}`);
      }
    };
    data.rows.forEach((api, i) => compare(rows[i], api, String(api[K.period])));
    expect(data.totalRow, 'The report data has a total row').toBeDefined();
    compare(foot, data.totalRow!, CF.totalLabel);
    if (wrong.length) note('differences', wrong.join(' | '));
    expect.soft(rows.length, 'Rows shown = rows in the data').toBe(data.rows.length);
    expect.soft(foot?.[CF.columns[0]], 'Total row label').toBe(CF.totalLabel);
    expect.soft(wrong, 'Cells that differ from the report data').toEqual([]);
  });

  test(...rep('REP-229'), async ({ reportCatalog, cashFlow: cf }) => {
    await openReport(reportCatalog, cf);
    const filters = (await cf.page.locator('main section.crm-report-toolbar label .crm-label').allInnerTexts()).map(l => l.trim());
    const views = await Promise.all((['All', 'Mine'] as const).map(v => cf.viewButton(v).count()));
    const reset = await cf.page.getByRole('button', { name: 'Reset filters' }).count();
    note('controls', `filters: ${filters.join(', ') || 'none'} · All/Mine buttons ${views.join('/')} · Reset ${reset}`);
    expect.soft(filters, 'No filters shown').toEqual([]);
    expect.soft(views, 'No All / Mine toggle').toEqual([0, 0]);
    expect.soft(reset, 'No Reset filters button').toBe(0);
  });

  // ── 3. Cash-flow arithmetic ────────────────────────────────────────────────────────────────────
  test(...rep('REP-230'), async ({ reportCatalog, cashFlow: cf }) => {
    await openReport(reportCatalog, cf);
    for (const r of (await cf.data()).rows) {
      const exp = num(r, K.inflows) - (num(r, K.dev) + num(r, K.broker) + num(r, K.mkt));
      note(String(r[K.period]), `${money(num(r, K.inflows))} − (${money(num(r, K.dev))} + ${money(num(r, K.broker))} + ${money(num(r, K.mkt))}) = ${exp.toFixed(2)} · shown ${num(r, K.net).toFixed(2)}`);
      expect.soft(cents(num(r, K.net), exp), `${r[K.period]}: Net Monthly Cash = inflows − outflows`).toBe(true);
    }
  });

  test(...rep('REP-231'), async ({ reportCatalog, cashFlow: cf }) => {
    await openReport(reportCatalog, cf);
    const rows = (await cf.data()).rows;
    rows.forEach((r, i) => {
      if (!i) return;
      const exp = num(rows[i - 1], K.balance) + num(r, K.net);
      note(String(r[K.period]), `${money(num(rows[i - 1], K.balance))} + ${money(num(r, K.net))} = ${money(exp)} · shown ${money(num(r, K.balance))}`);
      expect.soft(cents(num(r, K.balance), exp), `${r[K.period]}: Closing balance = prior balance + net cash`).toBe(true);
    });
  });

  test(...rep('REP-232'), async ({ reportCatalog, cashFlow: cf }) => {
    await openReport(reportCatalog, cf);
    const { rows, totalRow } = await cf.data();
    expect(totalRow, 'The report has a TOTAL CASH FLOW row').toBeDefined();
    const sum = (k: string) => rows.reduce((s, r) => s + num(r, k), 0);
    const flows = [K.inflows, K.dev, K.broker, K.mkt, K.net];
    note('totals', flows.map(k => `${k} ${money(sum(k))} / ${money(num(totalRow, k))}`).join(' · ') + ` · balance ${money(num(rows.at(-1), K.balance))} / ${money(num(totalRow, K.balance))}`);
    expect.soft(totalRow![K.period], 'Total row label').toBe(CF.totalLabel);
    for (const k of flows) expect.soft(cents(num(totalRow, k), sum(k)), `Total ${k} = sum of the months`).toBe(true);
    expect.soft(cents(num(totalRow, K.balance), num(rows.at(-1), K.balance)), "Total balance = the last month's closing balance").toBe(true);
  });

  test(...rep('REP-233'), async ({ reportCatalog, cashFlow: cf }) => {
    await openReport(reportCatalog, cf);
    const { rows, totalRow } = await cf.data();
    const st = statedFigures(await methodology(cf));
    const months = rows.map(r => monthOf(String(r[K.period]))?.ym);
    const disbursed = num(totalRow, K.dev) + num(totalRow, K.broker) + num(totalRow, K.mkt);
    const [inflows, outflows, net] = st.summary;
    const [lo, hi] = st.escrow;
    const balances = rows.map(r => num(r, K.balance));
    note('methodology', `horizon ${st.from} → ${st.to} (table ${months[0]} → ${months.at(-1)}) · ${st.periods} periods (table ${rows.length}) · totals ${money(inflows)} / ${money(outflows)} / ${money(net)} (table ${money(num(totalRow, K.inflows))} / ${money(disbursed)} / ${money(num(totalRow, K.net))}) · escrow ${money(lo)} → ${money(hi)} (table ${money(balances[0])} → ${money(balances.at(-1)!)})`);
    expect.soft([months[0], months.at(-1)], 'Stated horizon = first and last month').toEqual([st.from, st.to]);
    expect.soft(rows.length, 'Stated period count = rows').toBe(st.periods);
    expect.soft(close(num(totalRow, K.inflows), inflows), 'Stated total inflows = TOTAL CASH FLOW').toBe(true);
    expect.soft(close(disbursed, outflows), 'Stated total disbursements = TOTAL CASH FLOW outflows').toBe(true);
    expect.soft(close(num(totalRow, K.net), net), 'Stated net cash = TOTAL CASH FLOW net').toBe(true);
    expect.soft(balances.filter(b => !(b >= lo * 0.995 && b <= hi * 1.005)).length, 'Escrow balances outside the stated range').toBe(0);
  });

  test(...rep('REP-234'), async ({ reportCatalog, cashFlow: cf }) => {
    await openReport(reportCatalog, cf);
    const rows = (await cf.data()).rows;
    const bad = rows.flatMap(r => [
      ...[K.inflows, K.dev, K.broker, K.mkt].filter(k => !(num(r, k) >= 0)).map(k => `${r[K.period]} ${k} ${r[k]}`),
      ...(num(r, K.balance) > 0 ? [] : [`${r[K.period]} balance ${r[K.balance]}`]),
    ]);
    note('checked', `${rows.length} months · negative net cash in: ${rows.filter(r => num(r, K.net) < 0).map(r => r[K.period]).join(', ') || 'none'}`);
    expect.soft(bad, 'Negative flows or a non-positive escrow balance').toEqual([]);
  });

  // ── 4. Cash flow vs modules ────────────────────────────────────────────────────────────────────
  test(...rep('REP-235'), async ({ reportCatalog, cashFlow: cf, crmData }) => {
    const expected = inflowsByMonth(await crmData.paymentLines());
    await openReport(reportCatalog, cf);
    const rows = (await cf.data()).rows;
    const shown = new Map(rows.map(r => [monthOf(String(r[K.period]))?.ym ?? '', num(r, K.inflows)]));
    const months = [...new Set([...expected.keys(), ...shown.keys()])].sort();
    for (const m of months) {
      note(m, `report ${money(shown.get(m) ?? 0)} · payment-plan lines due ${money(expected.get(m) ?? 0)}`);
      expect.soft(cents(shown.get(m) ?? 0, expected.get(m) ?? 0), `${m}: Estimated Buyer Inflows = signed SPAs' lines due`).toBe(true);
    }
  });

  test(...rep('REP-236'), async ({ reportCatalog, cashFlow: cf, executiveDashboard: ed, crmData }) => {
    const contracts = await crmData.contracts();
    const signed = contracts.filter(c => c.status === EXECUTED);
    const value = signed.reduce((s, c) => s + c.value, 0);
    await openReport(reportCatalog, cf);
    const total = num((await cf.data()).totalRow, K.inflows);
    await ed.open();
    const spas = Number((await ed.data()).rows.find(r => r.metricCategory === ED.metrics.spas)?.currentActual);
    note('inflows', `report ${money(total)} · ${signed.length} signed SPAs ${money(value)} (other statuses: ${contracts.filter(c => c.status !== EXECUTED).map(c => `${c.contractNo} ${c.status}`).join(', ') || 'none'}) · RPT-01 Executed SPAs ${money(spas)}`);
    expect.soft(cents(total, value), 'Total inflows = signed SPA value').toBe(true);
    expect.soft(close(total, spas), 'Total inflows = RPT-01 Executed SPAs').toBe(true);
  });

  test(...rep('REP-237'), async ({ reportCatalog, cashFlow: cf, crmData }) => {
    const rate = await brokerRate(crmData);
    const value = (await crmData.contracts()).filter(c => c.status === EXECUTED).reduce((s, c) => s + c.value, 0);
    await openReport(reportCatalog, cf);
    const total = num((await cf.data()).totalRow, K.broker);
    const exp = value * rate / 100;
    note('broker', `report ${money(total)} · RPT-03 rate ${rate}% × signed SPA value ${money(value)} = ${money(exp)}`);
    // monthly figures are rounded to whole dollars, so allow $1 per month
    expect.soft(Math.abs(total - exp) <= (await cf.rows()).length, 'Total broker outflows = RPT-03 rate × signed SPA value').toBe(true);
  });

  test(...rep('REP-238'), async ({ reportCatalog, cashFlow: cf, crmData }) => {
    const rate = await brokerRate(crmData);
    const contracts = await crmData.contracts();
    const lines = await crmData.paymentLines();
    await openReport(reportCatalog, cf);
    const st = statedFigures(await methodology(cf));
    const [first, , threshold] = st.broker;
    test.skip(!(first > 0 && threshold > 0), 'The methodology states no commission timing');
    const expected = brokerByMonth(contracts, lines, rate, first, threshold);
    const rows = (await cf.data()).rows;
    const shown = new Map(rows.map(r => [monthOf(String(r[K.period]))?.ym ?? '', num(r, K.broker)]));
    note('rule', `${rate}% commission · ${first}% at signing · rest when ${threshold}% is due`);
    for (const m of [...new Set([...expected.keys(), ...shown.keys()])].sort()) {
      note(m, `report ${money(shown.get(m) ?? 0)} · methodology timing ${money(expected.get(m) ?? 0)}`);
      expect.soft(Math.abs((shown.get(m) ?? 0) - (expected.get(m) ?? 0)) <= 1, `${m}: Broker Comm Outflows = commission halves due this month`).toBe(true);
    }
  });

  test(...rep('REP-239'), async ({ reportCatalog, cashFlow: cf, executiveDashboard: ed, crmData }) => {
    const ledger = await crmData.get<{ tables: { key: string; rows: Row[] }[] }>(`/reports/business${CF.ledger.route.replace('/reports', '')}?period=last_12_months`);
    const cleared = clearedInEscrow(ledger.tables.find(t => t.key === CF.ledger.panelId)?.rows ?? []);
    await openReport(reportCatalog, cf);
    const first = (await cf.data()).rows[0];
    const opening = num(first, K.balance) - num(first, K.net);
    await ed.open();
    const escrow = Number((await ed.data()).rows.find(r => r.metricCategory === ED.metrics.escrow)?.currentActual);
    note('escrow', `opening balance ${money(opening)} (${first?.[K.period]} closing ${money(num(first, K.balance))} − net ${money(num(first, K.net))}) · RPT-10 cleared in escrow ${money(cleared)} · RPT-01 Escrow Collections ${money(escrow)}`);
    expect.soft(close(opening, cleared), 'Opening balance = receipts cleared in escrow (RPT-10)').toBe(true);
    expect.soft(close(opening, escrow), 'Opening balance = RPT-01 Escrow Collections').toBe(true);
  });

  test(...rep('REP-240'), async ({ reportCatalog, cashFlow: cf }) => {
    await openReport(reportCatalog, cf);
    const rows = (await cf.data()).rows;
    const now = ymd(await createdAt(cf)).slice(0, 7);
    const past = rows.filter(r => (monthOf(String(r[K.period]))?.ym ?? '') < now).map(r => String(r[K.period]));
    note('horizon', `report created in ${now} · forecast ${rows[0]?.[K.period]} … ${rows.at(-1)?.[K.period]} · months before the report date: ${past.join(', ') || 'none'}`);
    expect.soft(past, 'Forecast months before the month the report was created').toEqual([]);
  });

  test(...rep('REP-241'), async ({ reportCatalog, cashFlow: cf }) => {
    await openReport(reportCatalog, cf);
    const rows = (await cf.data()).rows;
    note('dev outflows', rows.map(r => `${r[K.period]} ${money(num(r, K.dev))} (${(num(r, K.dev) / num(r, K.inflows) * 100).toFixed(1)}% of inflows)`).join(' · '));
    test.skip(true, 'Blocked: no construction disbursement source is readable in the CRM; the values and their share of inflows are recorded, not validated');
  });

  test(...rep('REP-242'), async ({ reportCatalog, cashFlow: cf, crmData }) => {
    const campaigns = await crmData.campaigns();
    await openReport(reportCatalog, cf);
    const rows = (await cf.data()).rows;
    note('mkt opex', `${[...new Set(rows.map(r => money(num(r, K.mkt))))].join(', ')} per month · campaign budgets ${campaigns.map(c => `${c.campaignCode} ${money(c.budget)}`).join(', ')}`);
    test.skip(true, 'Blocked: the CRM holds campaign budgets but no monthly marketing spend plan; the values are recorded, not validated');
  });

  // ── 5. Export ──────────────────────────────────────────────────────────────────────────────────
  test(...rep('REP-243'), async ({ reportCatalog, cashFlow: cf }) => {
    await openReport(reportCatalog, cf);
    const headers = await cf.headers();
    const total = await cf.totalRecords();
    const { sheet } = await cf.export();
    note('file', `${sheet.name} · sheet "${sheet.sheetName}" · ${sheet.rows.length} rows + total "${sheet.total?.[CF.columns[0]] ?? '(none)'}" · ${sheet.header.join(' | ')}`);
    expect.soft(sheet.name, 'File name is .xlsx').toMatch(/\.xlsx$/i);
    expect.soft(sheet.magic, 'File is an Excel (zip) workbook').toBe('PK');
    expect.soft(sheet.sheetName, 'Sheet name').toBe(CF.exportSheet);
    expect.soft(sheet.header, 'Export columns = report columns').toEqual(headers);
    expect.soft(sheet.rows.length, 'Exported months = Total Records').toBe(total);
    expect.soft(sheet.total?.[CF.columns[0]], 'Export has the TOTAL CASH FLOW row').toBe(CF.totalLabel);
  });

  test(...rep('REP-244'), async ({ reportCatalog, cashFlow: cf }) => {
    await openReport(reportCatalog, cf);
    const data = await cf.data();
    const { sheet } = await cf.export();
    const wrong: string[] = [];
    [...data.rows, data.totalRow ?? {}].forEach((api, i) => {
      const file = i < data.rows.length ? sheet.rows[i] : sheet.total;
      for (const c of data.columns) {
        const v = file?.[c.label], a = api[c.key];
        const same = c.format === 'text' ? String(v ?? '') === String(a ?? '') : cents(Number(v), Number(a));
        if (!same) wrong.push(`${api[K.period] ?? CF.totalLabel} · ${c.label}: file "${v}" · report ${a}`);
      }
    });
    note('export', `${sheet.name}: ${sheet.rows.length} rows${wrong.length ? ` · differences: ${wrong.join(' | ')}` : ''}`);
    expect.soft(sheet.rows.map(r => String(r[CF.columns[0]])), 'Same months, in order').toEqual(data.rows.map(r => String(r[K.period])));
    expect.soft(wrong, 'Cells that differ between the report and the file').toEqual([]);
  });

  // ── Additional: negative and display ───────────────────────────────────────────────────────────
  test(...rep('REP-245'), async ({ reportCatalog, cashFlow: cf }) => {
    await openReport(reportCatalog, cf);
    const before = (await cf.data()).rows;
    const created = await createdAt(cf);
    await cf.page.waitForTimeout(61_000); // the chip shows minutes, so let a minute pass
    const reloadedAt = Date.now();
    await cf.page.reload();
    await expect(cf.tableRoot.locator('tbody tr').first(), 'Report reloaded').toBeVisible({ timeout: 20_000 });
    const after = await createdAt(cf);
    note('refresh', `Report Created ${created.toLocaleString()} → ${after.toLocaleString()}`);
    expect.soft((await cf.data()).rows, 'Same cash flow after reload').toEqual(before);
    expect.soft(+after > +created && Math.abs(+after - reloadedAt) < CREATED_WITHIN_MS, 'Report Created is the reload time').toBe(true);
  });

  test(...rep('REP-246'), async ({ reportCatalog, cashFlow: cf }) => {
    await openReport(reportCatalog, cf);
    const data = await cf.data();
    const rows = [...await cf.rows(), (await cf.totalRow()) ?? {}];
    const currency = (data.meta as { baseCurrencyCode?: string }).baseCurrencyCode ?? '';
    const moneyCell = new RegExp(`^-?[\\d.,]+[KMB]? ${currency}$`);
    const bad = rows.flatMap(r => data.columns.filter(c => c.format === 'money' && !moneyCell.test(r[c.label] ?? '')).map(c => `${r[CF.columns[0]]} · ${c.label} "${r[c.label]}"`));
    const negatives = data.rows.filter(r => num(r, K.net) < 0).map(r => String(r[K.period]));
    const shownNeg = (await cf.rows()).filter(r => negatives.includes(r[CF.columns[0]])).map(r => r[CF.columns[5]]);
    note('format', `base currency ${currency} · e.g. ${CF.columns.map(c => rows[0]?.[c]).join(' | ')} · negative net cash shown as ${shownNeg.join(', ') || '(none)'}`);
    expect(currency, 'The report states its base currency').not.toBe('');
    expect.soft(bad, 'Money cells not in the base currency format').toEqual([]);
    expect.soft(shownNeg.filter(v => !v.startsWith('-')), 'Negative net cash shown without a minus sign').toEqual([]);
  });
});
