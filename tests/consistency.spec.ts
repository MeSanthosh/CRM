/**
 * Cross-page consistency: the same metric shown on different pages must agree.
 * The hub and dashboard always show "This month"; report modules open on "Last 12 months", so each
 * module is switched to "This month" before it is read.
 */
import { test, expect, Page } from './auth';
import { kpi, kpiText, open, act, tableRows, tableColumn, parseNum } from './helpers';
import { ROUTES, XP, at } from './locators';
import { SAME, R, Src, where } from './consistency-cases';

async function read(page: Page, s: Src): Promise<{ v: number; shown: string }> {
  await open(page, s.page);
  const period = at(page, XP.reportPeriod);
  if (s.page.startsWith('/reports/') && (await period.inputValue()) !== 'this_month') {
    // wait for the This month data itself, not just any request, so the old period's value is never read
    const resp = page.waitForResponse(r => r.url().includes('period=this_month'), { timeout: 30_000 }).catch(() => null);
    await period.selectOption('this_month');
    await resp;
    await page.waitForLoadState('networkidle').catch(() => {});
  }
  if (s.table) {
    const n = await tableRows(page, s.table);
    return { v: n, shown: `${n} rows` };
  }
  const shown = await kpiText(page, s.label!);
  return { v: parseNum(shown), shown };
}

test.describe('Cross-page consistency', () => {
  for (const c of SAME) {
    test(`${c.id} ${c.metric} is the same on every page`, async ({ page }) => {
      const rows: string[] = [];
      const values: number[] = [];
      for (const s of c.sources) {
        const { v, shown } = await read(page, s);
        values.push(v);
        rows.push(`${shown.padEnd(14)} ${where(s)}`);
      }
      test.info().annotations.push({ type: c.metric, description: rows.join('  |  ') });
      expect(new Set(values).size, `${c.metric} differs:\n  ${rows.join('\n  ')}`).toBe(1);
    });
  }
});

test.describe('Math inside each page', () => {
  test('M-01 Hub: Available + Reserved + Sold = Inventory total units', async ({ page }) => {
    await open(page, ROUTES.hub);
    const sum = (await kpi(page, 'Units Available')) + (await kpi(page, 'Units Reserved')) + (await kpi(page, 'Units Sold'));
    await open(page, R.inventory);
    expect(sum).toBe(await kpi(page, 'Total units'));
  });

  test('M-02 Inventory: Available + Reserved + Sold (+Other) = Total; Sold % correct; project table sums', async ({ page }) => {
    await open(page, R.inventory);
    const total = await kpi(page, 'Total units');
    const [a, r, s] = [await kpi(page, 'Available'), await kpi(page, 'Reserved'), await kpi(page, 'Sold')];
    expect.soft(a + r + s, `${a}+${r}+${s}`).toBeLessThanOrEqual(total);
    expect.soft(await kpi(page, 'Sold %')).toBeCloseTo((s / total) * 100, 1);
    const units = (await tableColumn(page, 'Inventory by Project', 'Units')).map(parseNum).reduce((x, y) => x + y, 0);
    expect.soft(units, 'Inventory by Project: sum of Units').toBe(total);
  });

  test('M-03 Collections: Scheduled − Received = Outstanding; rates add up', async ({ page }) => {
    await open(page, R.collections);
    const sch = await kpi(page, 'Scheduled');
    const rec = await kpi(page, 'Received');
    const out = await kpi(page, 'Outstanding');
    const tol = 0.01e6; // values are shown to 0.01M
    expect.soft(Math.abs(sch - rec - out), `${sch} − ${rec} vs ${out}`).toBeLessThanOrEqual(tol);
    expect.soft(await kpi(page, 'Overdue'), 'Overdue ≤ Outstanding').toBeLessThanOrEqual(out);
    const due = await kpi(page, 'Due in period');
    expect.soft(await kpi(page, 'Received of due in period'), 'Received of due %').toBeCloseTo((rec / due) * 100, 0);
    expect.soft(await kpi(page, 'Collection rate'), 'Collection rate = Received / Scheduled').toBeCloseTo((rec / sch) * 100, 0);
  });

  test('M-04 Reservations: Conversion rate = Converted / Reservations', async ({ page }) => {
    await open(page, R.reservations);
    const made = await kpi(page, 'Reservations in period');
    const conv = await kpi(page, 'Converted to SPA');
    expect(await kpi(page, 'Conversion rate')).toBeCloseTo((conv / made) * 100, 0);
  });

  test('M-05 SPA: Average SPA value = Signed value / SPAs signed', async ({ page }) => {
    await open(page, R.spa);
    const n = await kpi(page, 'SPAs signed in period');
    test.skip(n === 0, 'No SPAs in period');
    const avg = (await kpi(page, 'Signed value')) / n;
    expect(Math.abs((await kpi(page, 'Average SPA value')) - avg) / avg).toBeLessThanOrEqual(0.01);
  });

  test('M-06 Marketing: Cost per lead = Budget / Campaign leads', async ({ page }) => {
    await open(page, R.marketing);
    const cpl = (await kpi(page, 'Campaign budget')) / (await kpi(page, 'Campaign leads'));
    expect(Math.abs((await kpi(page, 'Cost per lead')) - cpl) / cpl).toBeLessThanOrEqual(0.01);
  });

  test('M-07 Exceptions: Open exceptions = sum of the summary table "Open" column', async ({ page }) => {
    await open(page, R.exceptions);
    const sum = (await tableColumn(page, 'Exception Summary', 'Open')).map(parseNum).reduce((a, b) => a + b, 0);
    expect(sum).toBe(await kpi(page, 'Open exceptions'));
  });

  test('M-08 Sales: stage table total = Open opportunities and Pipeline value', async ({ page }) => {
    await open(page, R.sales);
    const opps = (await tableColumn(page, 'Open Pipeline by Stage', 'Opportunities')).map(parseNum).reduce((a, b) => a + b, 0);
    expect.soft(opps, 'Sum of Opportunities by stage').toBe(await kpi(page, 'Open opportunities'));
    const value = (await tableColumn(page, 'Open Pipeline by Stage', 'Value (USD)')).map(parseNum).reduce((a, b) => a + b, 0);
    const kpiVal = await kpi(page, 'Pipeline value');
    expect.soft(Math.abs(value - kpiVal) / kpiVal, 'Sum of stage values vs Pipeline value').toBeLessThanOrEqual(0.005);
  });
});
