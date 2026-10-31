/** Customer Reports workbook — Non-functional (CR-072…077). */
import 'dotenv/config';
import { test, expect, note } from '../pages/fixtures';
import { ERROR_TEXT } from '../scenarios/support';
import { cr } from './catalog';

const BUDGET = Number(process.env.PERF_BUDGET_MS ?? 5000);
const SIZES = { tablet: { width: 768, height: 1024 }, phone: { width: 390, height: 844 } };
const API = '**/api/v1/reports/business/customers**';

test.describe('Customer Reports · Non-functional', () => {
  test(...cr('CR-072'), async ({ customers, page }) => {
    for (const [name, size] of Object.entries(SIZES)) {
      await page.setViewportSize(size);
      await customers.open();
      await customers.kpiText('Active customers');
      const overflow = await page.evaluate(() => {
        const wide = [...document.querySelectorAll('main section.crm-panel, main article.crm-card')]
          .filter(e => e.getBoundingClientRect().right > window.innerWidth + 1)
          .map(e => `"${(e.querySelector('h3') as HTMLElement | null)?.innerText.trim()}" ${Math.round(e.getBoundingClientRect().right - window.innerWidth)}px too wide`);
        return { px: document.documentElement.scrollWidth - window.innerWidth, wide };
      });
      expect.soft(overflow.px, `${name}: no page-wide horizontal scroll (${overflow.wide.join(', ') || 'no single panel'})`).toBeLessThanOrEqual(1);
      const unscrollable = await page.evaluate(() => [...document.querySelectorAll('main table')].filter(t => {
        if (t.getBoundingClientRect().width <= window.innerWidth) return false;
        for (let e = t.parentElement; e && e.tagName !== 'MAIN'; e = e.parentElement) if (/(auto|scroll)/.test(getComputedStyle(e).overflowX)) return false;
        return true;
      }).length);
      expect.soft(unscrollable, `${name}: wide tables scroll inside their panel`).toBe(0);
      await expect.soft(customers.periodSelect, `${name}: period usable`).toBeVisible();
      await expect.soft(customers.viewButton('Mine'), `${name}: views usable`).toBeVisible();
    }
  });

  test(...cr('CR-073'), async ({ customers, page }) => {
    await customers.openWith('last_12_months');
    const focusVisible = (l: ReturnType<typeof page.locator>) => l.evaluate(e => { const s = getComputedStyle(e); return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none'; });
    await customers.viewButton('Mine').focus();
    expect.soft(await focusVisible(customers.viewButton('Mine')), 'View button shows focus').toBeTruthy();
    await page.keyboard.press('Enter');
    await expect.soft(customers.viewButton('Mine'), 'Enter on a view selects it').toHaveClass(/is-active/);
    await customers.viewButton('All').focus();
    await page.keyboard.press('Enter');
    const exportButton = customers.byNationality.exportButton;
    await exportButton.focus();
    expect.soft(await focusVisible(exportButton), 'Export shows focus').toBeTruthy();
    const download = page.waitForEvent('download', { timeout: 15_000 }).then(() => true).catch(() => false);
    await page.keyboard.press('Enter');
    expect.soft(await download, 'Enter on Export downloads the file').toBe(true);
    await customers.moduleTab('Sales').focus();
    expect.soft(await focusVisible(customers.moduleTab('Sales')), 'Module tab shows focus').toBeTruthy();
    await page.keyboard.press('Enter');
    await expect(page, 'Enter on a module tab opens it').toHaveURL(/\/reports\/sales/);
  });

  test(...cr('CR-074'), async ({ customers, page }) => {
    let t = Date.now();
    await page.goto(customers.path);
    for (const k of customers.kpiLabels) await customers.shown(k);
    await customers.newCustomers.rowCount();
    const pageMs = Date.now() - t;
    t = Date.now();
    await customers.setPeriod('this_month');
    await customers.kpiText('New in period');
    const periodMs = Date.now() - t;
    note('timings', `page ${pageMs} ms | period change ${periodMs} ms (budget ${BUDGET} ms)`);
    expect.soft(pageMs, 'Page loads within budget').toBeLessThanOrEqual(BUDGET);
    expect.soft(periodMs, 'Period change within budget').toBeLessThanOrEqual(BUDGET);
  });

  test(...cr('CR-075'), async ({ customers, page }) => {
    await page.route(API, r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Internal Server Error"}' }));
    await page.goto(customers.path);
    await expect(page.locator('main').getByText(ERROR_TEXT).first(), 'Error message after the app\'s retries').toBeVisible({ timeout: 20_000 });
    await expect.soft(page.locator('main').getByText(/^\s*loading/i), 'Not stuck loading').toHaveCount(0);
    await customers.expectNoBrokenValues();
  });

  test(...cr('CR-076'), async ({ customers, page }) => {
    await page.route(API, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.goto(customers.path);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
    expect(await customers.crashed(), 'No error screen').toBeFalsy();
    await expect.soft(customers.heading(), 'Page still shows its heading').toBeVisible();
    await customers.expectNoBrokenValues();
  });

  test(...cr('CR-077'), async ({ customers, page }) => {
    await customers.open();
    const unlabelled = await page.evaluate(() => [...document.querySelectorAll('main select')].filter(s => !(s.closest('label')?.textContent?.trim() || s.getAttribute('aria-label'))).length);
    expect.soft(unlabelled, 'Dropdowns without a label').toBe(0);
    const unnamed = await page.evaluate(() => [...document.querySelectorAll('main button, main a')].filter(b => !((b as HTMLElement).innerText.trim() || b.getAttribute('aria-label') || b.getAttribute('title'))).length);
    expect.soft(unnamed, 'Buttons or links without a name').toBe(0);
    for (const t of customers.tableHeadings) expect.soft(await customers.table(t).root.locator('thead th').count(), `${t}: column headers`).toBeGreaterThan(0);
  });
});
