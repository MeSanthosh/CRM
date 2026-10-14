/**
 * Workbook area: Lead Reports (RA-032…043).
 * RA-032 covers the Lead Reports module tabs; the rest exercise the Leads list (/leads), which is where
 * the status, type, search, pagination and export features these scenarios describe live.
 */
import { test, expect, Page } from '../auth';
import { kpi, kpiText, open, act, listCount, collectJson } from '../helpers';
import { ROUTES, XP, at, LEAD_REPORT_TABS } from '../locators';
import { scenario, note, leadRows, leadNumbers, leadColumn, download, expectClean } from './support';

const status = (page: Page) => at(page, XP.leadsStatusFilter);
const chip = (page: Page, name: 'All' | 'Individual' | 'Corporate') => at(page, XP.leadsTypeChip(name));

async function setStatus(page: Page, label: string | null) {
  await act(page, () => (label ? status(page).selectOption({ label }) : status(page).selectOption({ index: 0 })));
}

/** Type marker shown under each lead's number: IND / CORP. */
async function types(page: Page): Promise<string[]> {
  return (await leadRows(page).allInnerTexts()).map(t => t.match(/\b(IND|CORP\w*)\b/)?.[1] ?? '?');
}

test.describe('Scenarios · Lead Reports', () => {
  test(...scenario('RA-032', 'Each Lead Reports tab opens (URL ?tab=…) and shows all its KPI cards with valid values and all its panels, without errors'), async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await open(page, ROUTES.reports.leads);
    // start from the second tab so the first one is also opened by a click
    for (const tab of [...LEAD_REPORT_TABS.slice(1), LEAD_REPORT_TABS[0]]) {
      await act(page, () => at(page, XP.reportTab(tab.name)).click());
      if (tab.param) await expect.soft(page, `${tab.name} URL`).toHaveURL(new RegExp(`tab=${tab.param}`));
      await expect.soft(at(page, XP.reportTab(tab.name)), `${tab.name} active`).toHaveClass(/is-active/);
      for (const label of tab.kpis) {
        expect.soft(await kpiText(page, label), `${tab.name} › ${label}`).not.toMatch(/NaN|undefined|Infinity/);
      }
      for (const panel of tab.panels) {
        await expect.soft(page.locator('main h3', { hasText: panel }).first(), `${tab.name} › panel "${panel}"`).toBeVisible();
      }
      await expectClean(page, tab.name);
    }
    expect.soft(errors, 'JavaScript errors').toEqual([]);
  });

  test(...scenario('RA-033', 'Filtering by each status shows only leads with that status, and the status counts add up to Total Leads'), async ({ page }) => {
    await open(page, ROUTES.leads);
    const total = await kpi(page, 'Total Leads');
    const options = (await status(page).locator('option').allInnerTexts()).map(o => o.trim()).slice(1);
    let sum = 0;
    const counts: string[] = [];
    for (const s of options) {
      await setStatus(page, s);
      const n = await listCount(page);
      sum += n;
      counts.push(`${s}: ${n}`);
      const shown = new Set(await leadColumn(page, 'Status'));
      expect.soft([...shown].filter(x => x !== s), `Rows with another status when filtering "${s}"`).toEqual([]);
    }
    note('status counts', counts.join(', '));
    expect.soft(sum, 'Sum of status counts = Total Leads').toBe(total);
  });

  test(...scenario('RA-034', '"Individual" shows only IND leads and its count is ≤ all leads'), async ({ page }) => {
    await open(page, ROUTES.leads);
    const all = await listCount(page);
    await act(page, () => chip(page, 'Individual').click());
    const n = await listCount(page);
    note('values', `All ${all} | Individual ${n}`);
    expect.soft(n).toBeLessThanOrEqual(all);
    expect.soft([...new Set(await types(page))].filter(t => t !== 'IND'), 'Non-IND rows').toEqual([]);
  });

  test(...scenario('RA-035', '"Corporate" shows no IND leads, and Individual + Corporate = All'), async ({ page }) => {
    await open(page, ROUTES.leads);
    const all = await listCount(page);
    await act(page, () => chip(page, 'Individual').click());
    const ind = await listCount(page);
    await act(page, () => chip(page, 'Corporate').click());
    const corp = await listCount(page);
    note('values', `All ${all} | Individual ${ind} | Corporate ${corp}`);
    expect.soft((await types(page)).filter(t => t === 'IND'), 'IND rows under Corporate').toEqual([]);
    expect.soft(ind + corp, 'Individual + Corporate = All').toBe(all);
  });

  test(...scenario('RA-036', 'Searching by a lead number finds that lead; searching by its name returns only matching rows'), async ({ page }) => {
    await open(page, ROUTES.leads);
    const firstRow = (await leadRows(page).first().innerText()).split('\n').map(s => s.trim()).filter(Boolean);
    const leadNo = firstRow.find(s => /^LD-/.test(s))!;
    const name = firstRow.find(s => /[a-z]/i.test(s) && !/^LD-|^\d+$/.test(s))!;
    const search = at(page, XP.leadsSearch);
    await act(page, () => search.fill(leadNo));
    expect.soft(await leadNumbers(page), `Search "${leadNo}"`).toContain(leadNo);
    await act(page, () => search.fill(name));
    const rows = await leadRows(page).allInnerTexts();
    expect.soft(rows.length, `Search "${name}" finds rows`).toBeGreaterThan(0);
    expect.soft(rows.filter(r => !r.toLowerCase().includes(name.toLowerCase().split(' ')[0])), 'Rows not matching the name').toEqual([]);
  });

  test(...scenario('RA-037', 'Next goes to page 2 and Previous back to page 1; the pager text follows'), async ({ page }) => {
    await open(page, ROUTES.leads);
    const pager = at(page, XP.leadsPager);
    await expect(pager).toContainText(/Page 1 of/);
    await act(page, () => at(page, XP.leadsNext).click());
    await expect.soft(pager).toContainText(/Page 2 of/);
    expect.soft(await leadRows(page).count(), 'Rows on page 2').toBeGreaterThan(0);
    await act(page, () => at(page, XP.leadsPrev).click());
    await expect.soft(pager).toContainText(/Page 1 of/);
  });

  test(...scenario('RA-038', 'Page 1 has 25 leads, page 2 has min(25, total − 25), and no lead appears on both pages'), async ({ page }) => {
    await open(page, ROUTES.leads);
    const total = await listCount(page);
    const p1 = await leadNumbers(page);
    await act(page, () => at(page, XP.leadsNext).click());
    const p2 = await leadNumbers(page);
    expect.soft(p1.length, 'Page 1 rows').toBe(Math.min(25, total));
    expect.soft(p2.length, 'Page 2 rows').toBe(Math.min(25, total - 25));
    expect.soft(p1.filter(n => p2.includes(n)), 'Leads on both pages').toEqual([]);
  });

  test(...scenario('RA-039', 'Filtered counts are ≤ the total, adding a second filter never increases the count, and clearing filters restores the total'), async ({ page }) => {
    await open(page, ROUTES.leads);
    const total = await listCount(page);
    await setStatus(page, 'Qualified');
    const qualified = await listCount(page);
    await act(page, () => chip(page, 'Individual').click());
    const both = await listCount(page);
    await act(page, () => chip(page, 'All').click());
    await setStatus(page, null);
    const restored = await listCount(page);
    note('values', `Total ${total} | Qualified ${qualified} | Qualified + Individual ${both} | after clearing ${restored}`);
    expect.soft(qualified).toBeLessThanOrEqual(total);
    expect.soft(both).toBeLessThanOrEqual(qualified);
    expect.soft(restored, 'Total after clearing filters').toBe(total);
  });

  test(...scenario('RA-040', 'The leads shown on page 1 are exactly the leads returned by the leads API, in the same order'), async ({ page }) => {
    const bodies = collectJson(page);
    await open(page, ROUTES.leads);
    const shown = await leadNumbers(page);
    const body = bodies.find(b => /\/api\/v1\/leads\?/.test(b.url))?.body;
    expect(body, 'Leads API response captured').toBeTruthy();
    const fromApi = (JSON.stringify(body).match(/"LD-[A-Z0-9-]+"/g) ?? []).map(s => s.slice(1, -1))
      .filter((v, i, a) => a.indexOf(v) === i);
    expect.soft(shown, 'UI lead numbers = API lead numbers').toEqual(fromApi.slice(0, shown.length));
    expect.soft(fromApi.length, 'API returned the same number of leads').toBe(shown.length);
  });

  test(...scenario('RA-041', 'Export downloads an .xlsx with one row per lead (rows = Total Leads)'), async ({ page }) => {
    await open(page, ROUTES.leads);
    const total = await kpi(page, 'Total Leads');
    const sheet = await download(page, at(page, XP.leadsExport));
    note('export', `${sheet.name}: ${sheet.rows.length} rows`);
    expect.soft(sheet.name, 'File type').toMatch(/\.xlsx$/i);
    expect.soft(sheet.rows.length, 'Exported rows').toBe(total);
  });

  test(...scenario('RA-042', 'With a status filter applied, the export contains only the filtered leads (rows = filtered count)'), async ({ page }) => {
    await open(page, ROUTES.leads);
    await setStatus(page, 'Qualified');
    const filtered = await listCount(page);
    const sheet = await download(page, at(page, XP.leadsExport));
    note('export', `Filtered ${filtered} | ${sheet.name}: ${sheet.rows.length} rows`);
    expect.soft(sheet.rows.length, 'Exported rows = filtered count').toBe(filtered);
  });

  test(...scenario('RA-043', 'Status + type combined: rows match both filters, and Qualified·Individual + Qualified·Corporate = Qualified'), async ({ page }) => {
    await open(page, ROUTES.leads);
    await setStatus(page, 'Qualified');
    const q = await listCount(page);
    await act(page, () => chip(page, 'Individual').click());
    const qi = await listCount(page);
    expect.soft([...new Set(await leadColumn(page, 'Status'))], 'Statuses shown').toEqual(qi ? ['Qualified'] : []);
    expect.soft([...new Set(await types(page))].filter(t => t !== 'IND'), 'Non-IND rows').toEqual([]);
    await act(page, () => chip(page, 'Corporate').click());
    const qc = await listCount(page);
    note('values', `Qualified ${q} | Individual ${qi} | Corporate ${qc}`);
    expect.soft(qi + qc, 'Individual + Corporate = Qualified').toBe(q);
  });
});
