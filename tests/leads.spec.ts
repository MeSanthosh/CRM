import { test, expect, Page } from './auth';
import * as XLSX from 'xlsx';
import { kpi, tabBadge, listCount, act, open } from './helpers';
import { ROUTES, XP, at, LEADS_TABS, LEAD_STATUSES, INACTIVE_LEAD_STATUSES } from './locators';

const LEADS = process.env.LEADS_PATH ?? ROUTES.leads;
const statusFilter = (page: Page) => at(page, XP.leadsStatusFilter);

async function statusCounts(page: Page) {
  const counts: Record<string, number> = {};
  for (const s of LEAD_STATUSES) {
    await act(page, () => statusFilter(page).selectOption({ label: s }));
    counts[s] = await listCount(page);
  }
  await act(page, () => statusFilter(page).selectOption({ index: 0 }));
  return counts;
}

test.describe('Leads – count validation', () => {
  test('L-01 Total card = All Leads badge = pager count', async ({ page }) => {
    await open(page, LEADS);
    const total = await kpi(page, 'Total Leads');
    expect.soft((await tabBadge(page, 'All Leads')).value, 'All Leads badge').toBe(total);
    expect.soft(await listCount(page), 'Pager "N leads"').toBe(total);
  });

  test('L-02 Assigned + Unassigned = Total', async ({ page }) => {
    await open(page, LEADS);
    const total = await kpi(page, 'Total Leads');
    const assigned = await kpi(page, 'Assigned');
    const unassigned = (await tabBadge(page, 'Unassigned')).value;
    expect(assigned + unassigned, `${assigned} + ${unassigned}`).toBe(total);
  });

  test('L-03 Qualified + Disqualified ≤ Total, Avg Score within 0–100', async ({ page }) => {
    await open(page, LEADS);
    const total = await kpi(page, 'Total Leads');
    expect.soft((await kpi(page, 'Qualified')) + (await kpi(page, 'Disqualified'))).toBeLessThanOrEqual(total);
    const avg = await kpi(page, 'Avg Score');
    expect.soft(avg).toBeGreaterThanOrEqual(0);
    expect.soft(avg).toBeLessThanOrEqual(100);
  });

  LEADS_TABS.slice(1).forEach((tabName, i) => {
    test(`L-04.${i + 1} "${tabName}" badge = rows listed in the tab`, async ({ page }) => {
      await open(page, LEADS);
      const { tab, value } = await tabBadge(page, tabName);
      await act(page, () => tab.click());
      expect(await listCount(page), `${tabName} list count`).toBe(value);
    });
  });

  test('L-05 Individual + Corporate = All', async ({ page }) => {
    await open(page, LEADS);
    const all = await listCount(page);
    await act(page, () => at(page, XP.leadsTypeChip('Individual')).click());
    const ind = await listCount(page);
    await act(page, () => at(page, XP.leadsTypeChip('Corporate')).click());
    const corp = await listCount(page);
    test.info().annotations.push({ type: 'split', description: `IND ${ind} + CORP ${corp} vs ALL ${all}` });
    expect(ind + corp, `${ind} + ${corp}`).toBe(all);
  });

  test('L-06 status filter: sum of all 10 statuses = Total; cards match their status', async ({ page }) => {
    await open(page, LEADS);
    const total = await kpi(page, 'Total Leads');
    const options = (await statusFilter(page).locator('option').allInnerTexts()).map(o => o.trim()).slice(1);
    expect.soft(options, 'Status options unchanged').toEqual(LEAD_STATUSES);

    const counts = await statusCounts(page);
    const breakdown = Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(', ');
    test.info().annotations.push({ type: 'status breakdown', description: breakdown });
    await test.info().attach('status-counts.json', { body: JSON.stringify(counts, null, 2), contentType: 'application/json' });

    const sum = Object.values(counts).reduce((a, b) => a + b, 0);
    expect.soft(sum, `Sum of statuses (${breakdown})`).toBe(total);
    expect.soft(counts['Disqualified'], 'Disqualified card vs filter').toBe(await kpi(page, 'Disqualified'));
    // The "Qualified" card counts every lead that reached qualification: status Qualified + Converted.
    expect.soft(counts['Qualified'] + counts['Converted'], 'Qualified card = Qualified + Converted').toBe(await kpi(page, 'Qualified'));
  });

  test('L-07 search: no match shows 0, clearing restores the total', async ({ page }) => {
    await open(page, LEADS);
    const before = await listCount(page);
    const search = at(page, XP.leadsSearch);
    await act(page, () => search.fill('zzz-no-such-lead-xyz'));
    expect.soft(await listCount(page), 'no-match search').toBe(0);
    await expect.soft(page.locator('main')).not.toContainText(/NaN|undefined/);
    await act(page, () => search.fill(''));
    expect(await listCount(page)).toBe(before);
  });

  test('L-08 pagination: page 1 has 25 rows, pages = ceil(total/25)', async ({ page }) => {
    await open(page, LEADS);
    const pager = await at(page, XP.leadsPager).innerText();
    const [, pages, total] = pager.replace(/,/g, '').match(/of\s+(\d+).*?(\d+)\s+leads/i)!.map(Number);
    const rows = await at(page, XP.leadsTableRows).count();
    expect.soft(rows, 'rows on page 1').toBe(Math.min(25, total));
    expect.soft(pages, 'page count').toBe(Math.ceil(total / 25));
  });

  test('L-09 Export row count = Total', async ({ page }) => {
    await open(page, LEADS);
    const total = await kpi(page, 'Total Leads');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      at(page, XP.leadsExport).click(),
    ]);
    const wb = XLSX.readFile((await download.path())!);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    expect(rows.length, `Rows in ${download.suggestedFilename()}`).toBe(total);
  });

  test('L-10 Active Leads (hub) = Total − Converted − Lost − Disqualified − Duplicate', async ({ page }) => {
    await open(page, ROUTES.hub);
    const active = await kpi(page, 'Active Leads');
    await open(page, LEADS);
    const counts = await statusCounts(page);
    const expected = Object.entries(counts)
      .filter(([k]) => !INACTIVE_LEAD_STATUSES.includes(k))
      .reduce((a, [, v]) => a + v, 0);
    test.info().annotations.push({ type: 'active leads', description: `hub ${active} | computed ${expected} | ${JSON.stringify(counts)}` });
    expect(active).toBe(expected);
  });
});
