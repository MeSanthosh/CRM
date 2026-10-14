/**
 * Workbook areas: Report-Specific Data Validation (RA-051…060), Record-Level Validation (RA-061…065).
 * Each module is checked on "Last 12 months" (set explicitly), where there is enough data for the
 * totals to mean something: KPI cards must agree with the tables on the same page.
 */
import { test, expect, Page } from '../auth';
import { kpi, open, act, tableRows, tableColumn, listCount } from '../helpers';
import { ROUTES, XP, at, DASHBOARD_KPIS, LEAD_STATUSES, INACTIVE_LEAD_STATUSES } from '../locators';
import { SAME } from '../consistency-cases';
import { scenario, manual, note, num, sum, near, expectNear, colSum, openReport, expectClean, download } from './support';

const R = ROUTES.reports;
const today = new Date(new Date().toDateString());

/** Rows of a table as objects keyed by header. */
async function tableObjects(page: Page, heading: string): Promise<Record<string, string>[]> {
  const table = at(page, XP.reportTable(heading));
  const headers = (await table.locator('thead th').allInnerTexts()).map(h => h.replace(/[↕▼▲]/g, '').trim());
  const rows = await table.locator('tbody tr').evaluateAll(trs => trs.map(tr => [...tr.children].map(td => (td as HTMLElement).innerText.trim())));
  return rows.filter(r => r.length === headers.length).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
}

/** Each KPI equals the sum of a table column (count exact unless `rel` is given). */
async function kpiEqualsColumn(page: Page, label: string, heading: string, column: string, rel = 0) {
  const k = await kpi(page, label);
  const s = await colSum(page, heading, column);
  if (rel) expectNear(s, k, `"${label}" vs sum of ${heading} › ${column}`, rel);
  else expect.soft(s, `"${label}" (${k}) = sum of ${heading} › ${column}`).toBe(k);
}

test.describe('Scenarios · Report-Specific Data Validation', () => {
  test(...scenario('RA-051', 'Sales: stage table totals = Open opportunities / Pipeline / Weighted; salesperson totals agree; Win rate = Won ÷ (Won + Lost); Past expected close = rows past their close date'), async ({ page }) => {
    await openReport(page, R.sales);
    await kpiEqualsColumn(page, 'Open opportunities', 'Open Pipeline by Stage', 'Opportunities');
    await kpiEqualsColumn(page, 'Pipeline value', 'Open Pipeline by Stage', 'Value (USD)', 0.01);
    await kpiEqualsColumn(page, 'Weighted pipeline', 'Open Pipeline by Stage', 'Weighted (USD)', 0.01);
    await kpiEqualsColumn(page, 'Open opportunities', 'Salesperson Pipeline', 'Open');
    await kpiEqualsColumn(page, 'Pipeline value', 'Salesperson Pipeline', 'Pipeline (USD)', 0.01);
    await kpiEqualsColumn(page, 'Won in period', 'Salesperson Pipeline', 'Won');
    await kpiEqualsColumn(page, 'Won value', 'Salesperson Pipeline', 'Won Value (USD)', 0.01);
    expect.soft(await tableRows(page, 'Open Opportunities'), 'Open Opportunities rows = KPI').toBe(await kpi(page, 'Open opportunities'));
    const won = await colSum(page, 'Salesperson Pipeline', 'Won');
    const lost = await colSum(page, 'Salesperson Pipeline', 'Lost');
    if (won + lost > 0) expectNear(await kpi(page, 'Win rate'), (won / (won + lost)) * 100, 'Win rate', 0, 0.1);
    const shares = await colSum(page, 'Open Pipeline by Stage', 'Share of Value %');
    expectNear(shares, 100, 'Stage shares add up to 100%', 0, 0.5);
    const past = (await tableColumn(page, 'Open Opportunities', 'Expected Close')).filter(d => d && new Date(d) < today).length;
    expect.soft(past, 'Rows past their expected close date = "Past expected close"').toBe(await kpi(page, 'Past expected close'));
  });

  test(...scenario('RA-052', 'Inventory: Available + Reserved + Sold ≤ Total; Sold % correct; project, unit-type and bedroom tables add up to the KPIs; Available Units rows and value match'), async ({ page }) => {
    await openReport(page, R.inventory);
    const [total, a, r, s] = [await kpi(page, 'Total units'), await kpi(page, 'Available'), await kpi(page, 'Reserved'), await kpi(page, 'Sold')];
    expect.soft(a + r + s, `${a}+${r}+${s} ≤ ${total}`).toBeLessThanOrEqual(total);
    expectNear(await kpi(page, 'Sold %'), (s / total) * 100, 'Sold %', 0, 0.1);
    for (const t of ['Inventory by Project', 'Inventory by Unit Type', 'Inventory by Bedrooms']) {
      await kpiEqualsColumn(page, 'Total units', t, 'Units');
      await kpiEqualsColumn(page, 'Available', t, 'Available');
      await kpiEqualsColumn(page, 'Reserved', t, 'Reserved');
      await kpiEqualsColumn(page, 'Sold', t, 'Sold');
      await kpiEqualsColumn(page, 'Available value', t, 'Available Value (USD)', 0.01);
    }
    expect.soft(await tableRows(page, 'Available Units'), 'Available Units rows = Available').toBe(a);
    await kpiEqualsColumn(page, 'Available value', 'Available Units', 'List Price (USD)', 0.01);
    if (a) expectNear(await kpi(page, 'Average available price'), (await kpi(page, 'Available value')) / a, 'Average available price');
  });

  test(...scenario('RA-053', 'Customers: nationality, residence and type tables each add up to Active customers / New in period / With SPA / SPA value; average per buyer correct'), async ({ page }) => {
    await openReport(page, R.customers);
    for (const t of ['Customers by Nationality', 'Customers by Country of Residence', 'Customers by Type']) {
      await kpiEqualsColumn(page, 'Active customers', t, 'Customers');
      await kpiEqualsColumn(page, 'New in period', t, 'New in Period');
      await kpiEqualsColumn(page, 'Customers with SPA', t, 'With SPA');
      await kpiEqualsColumn(page, 'SPA value', t, 'SPA Value (USD)', 0.01);
    }
    expect.soft(await tableRows(page, 'New Customers in Period'), 'New Customers rows = New in period').toBe(await kpi(page, 'New in period'));
    const buyers = await kpi(page, 'Customers with SPA');
    if (buyers) expectNear(await kpi(page, 'Average value per buyer'), (await kpi(page, 'SPA value')) / buyers, 'Average value per buyer');
  });

  test(...scenario('RA-054', 'Brokers: Broker Performance rows = Active brokers; Leads / Reservations / SPAs / SPA value columns add up to the KPIs; Brokers with SPA = rows with SPAs > 0'), async ({ page }) => {
    await openReport(page, R.brokers);
    expect.soft(await tableRows(page, 'Broker Performance'), 'Rows = Active brokers').toBe(await kpi(page, 'Active brokers'));
    await kpiEqualsColumn(page, 'Broker leads', 'Broker Performance', 'Leads');
    await kpiEqualsColumn(page, 'Broker reservations', 'Broker Performance', 'Reservations');
    await kpiEqualsColumn(page, 'Broker SPAs', 'Broker Performance', 'SPAs');
    await kpiEqualsColumn(page, 'Broker SPA value', 'Broker Performance', 'SPA Value (USD)', 0.01);
    const withSpa = (await tableColumn(page, 'Broker Performance', 'SPAs')).map(num).filter(n => n > 0).length;
    expect.soft(withSpa, 'Brokers with SPA').toBe(await kpi(page, 'Brokers with SPA'));
  });

  test(...scenario('RA-055', 'Marketing: campaign and channel tables add up to budget / leads / SPA / revenue; Cost per lead = budget ÷ leads; ROI = (revenue − budget) ÷ budget'), async ({ page }) => {
    await openReport(page, R.marketing);
    for (const t of ['Campaign Performance', 'Performance by Channel']) {
      await kpiEqualsColumn(page, 'Campaign budget', t, 'Budget (USD)', 0.01);
      await kpiEqualsColumn(page, 'Campaign leads', t, 'Leads');
      await kpiEqualsColumn(page, 'Leads to SPA', t, 'SPA');
      await kpiEqualsColumn(page, 'Revenue', t, 'Revenue (USD)', 0.01);
    }
    const [budget, leads, revenue] = [await kpi(page, 'Campaign budget'), await kpi(page, 'Campaign leads'), await kpi(page, 'Revenue')];
    if (leads) expectNear(await kpi(page, 'Cost per lead'), budget / leads, 'Cost per lead');
    if (budget) expectNear(await kpi(page, 'ROI'), ((revenue - budget) / budget) * 100, 'ROI %', 0.01, 0.5);
  });

  test(...scenario('RA-056', 'Reservations: month / project / salesperson tables add up to the KPIs; conversion rate correct; Active Reservations rows, expiry and deposit counts match the KPIs'), async ({ page }) => {
    await openReport(page, R.reservations);
    for (const t of ['Reservations by Month', 'Reservations by Project', 'Reservations by Salesperson']) {
      await kpiEqualsColumn(page, 'Reservations in period', t, 'Made in Period');
      await kpiEqualsColumn(page, 'Reservation amount', t, 'Amount (USD)', 0.01);
      await kpiEqualsColumn(page, 'Converted to SPA', t, 'Converted to SPA');
    }
    for (const t of ['Reservations by Project', 'Reservations by Salesperson']) await kpiEqualsColumn(page, 'Active now', t, 'Active Now');
    const made = await kpi(page, 'Reservations in period');
    if (made) expectNear(await kpi(page, 'Conversion rate'), ((await kpi(page, 'Converted to SPA')) / made) * 100, 'Conversion rate', 0, 0.1);
    const rows = await tableObjects(page, 'Active Reservations');
    expect.soft(rows.length, 'Active Reservations rows = Active now').toBe(await kpi(page, 'Active now'));
    const days = rows.map(r => num(r['Days Left']));
    expect.soft(days.filter(d => d < 0).length, 'Rows past expiry = "Past expiry, still active"').toBe(await kpi(page, 'Past expiry, still active'));
    expect.soft(days.filter(d => d >= 0 && d <= 7).length, 'Rows expiring in 0–7 days = "Expiring in 7 days"').toBe(await kpi(page, 'Expiring in 7 days'));
    note('deposit values', [...new Set(rows.map(r => r['Deposit']))].join(', '));
  });

  test(...scenario('RA-057', 'SPA: month / project / salesperson tables add up to signed count and value; average SPA value correct; awaiting signature and KYC columns match the KPIs'), async ({ page }) => {
    await openReport(page, R.spa);
    await kpiEqualsColumn(page, 'SPAs signed in period', 'SPAs Signed by Month', 'Signed');
    await kpiEqualsColumn(page, 'Signed value', 'SPAs Signed by Month', 'Value (USD)', 0.01);
    for (const t of ['SPAs by Project', 'SPAs by Salesperson']) {
      await kpiEqualsColumn(page, 'SPAs signed in period', t, 'Signed in Period');
      await kpiEqualsColumn(page, 'Signed value', t, 'Value (USD)', 0.01);
      await kpiEqualsColumn(page, 'Awaiting signature', t, 'Awaiting Signature');
      await kpiEqualsColumn(page, 'Signed, KYC not approved', t, 'KYC Not Approved');
    }
    const n = await kpi(page, 'SPAs signed in period');
    if (n) expectNear(await kpi(page, 'Average SPA value'), (await kpi(page, 'Signed value')) / n, 'Average SPA value');
  });

  test(...scenario('RA-058', 'Collections: Scheduled − Received = Outstanding; Overdue ≤ Outstanding; aging and project tables add up; shares = 100%; rates correct'), async ({ page }) => {
    await openReport(page, R.collections);
    const [sch, rec, out, over] = [await kpi(page, 'Scheduled'), await kpi(page, 'Received'), await kpi(page, 'Outstanding'), await kpi(page, 'Overdue')];
    expectNear(sch - rec, out, 'Scheduled − Received vs Outstanding', 0.005);
    expect.soft(over, 'Overdue ≤ Outstanding').toBeLessThanOrEqual(out);
    await kpiEqualsColumn(page, 'Outstanding', 'Outstanding by Age', 'Amount (USD)', 0.01);
    expectNear(await colSum(page, 'Outstanding by Age', 'Share %'), 100, 'Aging shares', 0, 0.5);
    await kpiEqualsColumn(page, 'Scheduled', 'Collections by Project', 'Scheduled (USD)', 0.01);
    await kpiEqualsColumn(page, 'Received', 'Collections by Project', 'Received (USD)', 0.01);
    await kpiEqualsColumn(page, 'Outstanding', 'Collections by Project', 'Outstanding (USD)', 0.01);
    await kpiEqualsColumn(page, 'Overdue', 'Collections by Project', 'Overdue (USD)', 0.01);
    if (sch) expectNear(await kpi(page, 'Collection rate'), (rec / sch) * 100, 'Collection rate', 0, 0.1);
  });

  test(...scenario('RA-059', 'Executive Dashboard: all 10 KPIs valid, and each equals the same metric on the hub and report modules (This month)'), async ({ page }) => {
    await open(page, ROUTES.dashboard);
    for (const label of DASHBOARD_KPIS) {
      const v = await kpi(page, label);
      expect.soft(v, `${label} ≥ 0`).toBeGreaterThanOrEqual(0);
    }
    const rows: string[] = [];
    for (const c of SAME.filter(c => c.sources.some(s => s.page === ROUTES.dashboard))) {
      const dash = c.sources.find(s => s.page === ROUTES.dashboard)!;
      await open(page, ROUTES.dashboard);
      const d = await kpi(page, dash.label!);
      for (const s of c.sources.filter(s => s !== dash && s.label)) {
        if (s.page === ROUTES.hub) await open(page, s.page);
        else await openReport(page, s.page, 'this_month');
        const v = await kpi(page, s.label!);
        rows.push(`${c.id} ${c.metric}: dashboard ${d} | ${s.page} ${v}`);
        expect.soft(near(d, v, 0.005, 0), `${c.metric}: dashboard ${d} vs ${s.page} "${s.label}" ${v}`).toBeTruthy();
      }
    }
    note('values', rows.join('\n'));
  });

  test(...scenario('RA-060', 'Exceptions: summary "Open" column adds up to Open exceptions; KPIs equal their summary rows; detail lists match the summary counts'), async ({ page }) => {
    await openReport(page, R.exceptions);
    await kpiEqualsColumn(page, 'Open exceptions', 'Exception Summary', 'Open');
    const summary = Object.fromEntries((await tableObjects(page, 'Exception Summary')).map(r => [r['Exception'], num(r['Open'])]));
    note('summary', JSON.stringify(summary));
    for (const label of ['Overdue instalments', 'Reservations past expiry']) {
      expect.soft(summary[label], `Summary "${label}" = KPI`).toBe(await kpi(page, label));
    }
    const panels = ['Reservations past expiry', 'Reservation deposit not received after 7 days', 'SPAs not signed after 14 days',
      'Signed SPAs with KYC not approved', 'Signed SPAs not handed off to ERP after 3 days', 'Open opportunities past expected close date'];
    for (const p of panels) {
      if (!(p in summary)) continue;
      const rows = await tableRows(page, p);
      if (rows < 100) expect.soft(rows, `"${p}" rows = summary count`).toBe(summary[p]);
      else expect.soft(rows, `"${p}" rows ≤ summary count (list capped)`).toBeLessThanOrEqual(summary[p]);
    }
    expect.soft(await tableRows(page, 'SPAs not signed after 14 days'), 'Rows = "SPAs unsigned > 14 days"').toBe(await kpi(page, 'SPAs unsigned > 14 days'));
    await openReport(page, R.reservations);
    expect.soft(summary['Reservations past expiry'], 'Same as Reservations "Past expiry, still active"').toBe(await kpi(page, 'Past expiry, still active'));
  });
});

test.describe('Scenarios · Record-Level Validation', () => {
  test(...scenario('RA-061', 'Every row in Open Opportunities and Available Units has a reference, a positive value, a 0–100% probability and a real date'), async ({ page }) => {
    await openReport(page, R.sales);
    const opps = await tableObjects(page, 'Open Opportunities');
    expect(opps.length).toBeGreaterThan(0);
    const bad: string[] = [];
    for (const o of opps) {
      if (!/^OPP-/.test(o['Opportunity'])) bad.push(`reference "${o['Opportunity']}"`);
      if (!o['Customer']) bad.push(`${o['Opportunity']}: no customer`);
      if (!(num(o['Value (USD)']) > 0)) bad.push(`${o['Opportunity']}: value "${o['Value (USD)']}"`);
      const p = num(o['Probability %']);
      if (p < 0 || p > 100) bad.push(`${o['Opportunity']}: probability ${p}`);
      // "—" means no expected close date was entered, which the report allows
      const close = o['Expected Close'];
      if (close && !/^[—–-]$/.test(close) && isNaN(Date.parse(close))) bad.push(`${o['Opportunity']}: date "${close}"`);
    }
    await openReport(page, R.inventory);
    for (const u of await tableObjects(page, 'Available Units')) {
      if (!u['Unit'] || !u['Project']) bad.push(`unit row without unit/project: ${JSON.stringify(u)}`);
      if (!(num(u['List Price (USD)']) > 0)) bad.push(`${u['Unit']}: price "${u['List Price (USD)']}"`);
    }
    expect.soft(bad, 'Invalid records').toEqual([]);
  });

  test(...scenario('RA-062', 'Opening an opportunity from the report shows the same record (reference and customer) in the Opportunities page'), async ({ page }) => {
    await openReport(page, R.sales);
    const first = (await tableObjects(page, 'Open Opportunities'))[0];
    await act(page, () => page.getByRole('link', { name: first['Opportunity'], exact: true }).first().click());
    await expect(page).toHaveURL(/\/opportunities/);
    await expect.soft(page.locator('main'), 'Record shows the reference').toContainText(first['Opportunity']);
    await expect.soft(page.locator('main'), 'Record shows the customer').toContainText(first['Customer']);
    note('record', JSON.stringify(first));
  });

  test(...manual('RA-063', 'needs a record to be edited in QA and the report re-checked; the suite only reads data'));

  test(...scenario('RA-064', 'Inactive leads (Converted, Lost, Disqualified, Duplicate) are excluded: hub Active Leads = Lead Reports Open Leads Now = sum of the other statuses'), async ({ page }) => {
    await open(page, ROUTES.hub);
    const active = await kpi(page, 'Active Leads');
    await open(page, R.leads);
    const openNow = await kpi(page, 'Open Leads Now');
    await open(page, ROUTES.leads);
    const statusSel = at(page, XP.leadsStatusFilter);
    const counts: Record<string, number> = {};
    for (const s of LEAD_STATUSES) {
      await act(page, () => statusSel.selectOption({ label: s }));
      counts[s] = await listCount(page);
    }
    const expected = sum(Object.entries(counts).filter(([k]) => !INACTIVE_LEAD_STATUSES.includes(k)).map(([, v]) => v));
    note('values', `Active Leads ${active} | Open Leads Now ${openNow} | active statuses ${expected} | ${JSON.stringify(counts)}`);
    expect.soft(active, 'Hub Active Leads').toBe(expected);
    expect.soft(openNow, 'Lead Reports Open Leads Now').toBe(expected);
  });

  test(...scenario('RA-065', 'No record is counted twice: lead numbers in the export, opportunity references and customer references are unique'), async ({ page }) => {
    await open(page, ROUTES.leads);
    const sheet = await download(page, at(page, XP.leadsExport));
    const leadNos = sheet.rows.map(r => JSON.stringify(r).match(/LD-[A-Z0-9-]+/)?.[0]).filter(Boolean) as string[];
    const dupLeads = leadNos.filter((v, i, a) => a.indexOf(v) !== i);
    expect.soft(dupLeads, 'Duplicate lead numbers in the export').toEqual([]);
    await openReport(page, R.sales);
    const opps = await tableColumn(page, 'Open Opportunities', 'Opportunity');
    expect.soft(opps.filter((v, i, a) => a.indexOf(v) !== i), 'Duplicate opportunities').toEqual([]);
    await openReport(page, R.customers);
    const custs = await tableColumn(page, 'New Customers in Period', 'Customer');
    expect.soft(custs.filter((v, i, a) => a.indexOf(v) !== i), 'Duplicate customers').toEqual([]);
    await expectClean(page);
  });
});
