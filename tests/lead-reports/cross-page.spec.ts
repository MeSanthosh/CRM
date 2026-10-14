/** Lead Reports workbook — Cross-page & non-functional (LR-139…144). */
import 'dotenv/config';
import { test, expect, note } from '../pages/fixtures';
import { expectNear } from '../helpers';
import { ERROR_TEXT } from '../scenarios/support';
import { lr } from './catalog';

const BUDGET = Number(process.env.PERF_BUDGET_MS ?? 5000);
const SIZES = { tablet: { width: 768, height: 1024 }, phone: { width: 390, height: 844 } };

test.describe('Lead Reports · Cross-page & non-functional', () => {
  test(...lr('LR-139'), async ({ leadReports, hub }) => {
    await leadReports.open();
    const open = await leadReports.kpi('Open Leads Now');
    await hub.open();
    expect(await hub.kpi('Active Leads'), 'Hub Active Leads = Lead Reports Open Leads Now').toBe(open);
  });

  test(...lr('LR-140'), async ({ leadReports, spa, sales }) => {
    await leadReports.openWith('last_12_months');
    const k = await leadReports.kpis(['SPA Signed', 'Won Value']);
    await spa.openWith('last_12_months');
    const signed = await spa.kpi('SPAs signed in period');
    await sales.openWith('last_12_months');
    const won = await sales.kpi('Won value');
    note('values', `Lead Reports ${JSON.stringify(k)} | SPA Reports ${signed} | Sales won value ${won}`);
    expect.soft(k['SPA Signed'], 'SPA Signed = SPA Reports "SPAs signed in period"').toBe(signed);
    expectNear(k['Won Value'], won, 'Won Value = Sales Reports "Won value"', 0.005, 0);
  });

  test(...lr('LR-141'), async ({ leadReports, page }) => {
    for (const [name, size] of Object.entries(SIZES)) {
      await page.setViewportSize(size);
      for (const tab of ['', 'source', 'scorecard']) {
        await leadReports.openAt(tab);
        const overflow = await page.evaluate(() => {
          const wide = [...document.querySelectorAll('main section.crm-panel, main article.crm-card')]
            .filter(e => e.getBoundingClientRect().right > window.innerWidth + 1)
            .map(e => `"${(e.querySelector('h3') as HTMLElement | null)?.innerText.trim()}" ${Math.round(e.getBoundingClientRect().right - window.innerWidth)}px too wide`);
          return { px: document.documentElement.scrollWidth - window.innerWidth, wide };
        });
        expect.soft(overflow.px, `${name} ${tab || 'overview'}: no page-wide horizontal scroll (${overflow.wide.join(', ') || 'no single panel'})`).toBeLessThanOrEqual(1);
        const unscrollable = await page.evaluate(() => [...document.querySelectorAll('main table')].filter(t => {
          if (t.getBoundingClientRect().width <= window.innerWidth) return false;
          for (let e = t.parentElement; e && e.tagName !== 'MAIN'; e = e.parentElement) if (/(auto|scroll)/.test(getComputedStyle(e).overflowX)) return false;
          return true;
        }).length);
        expect.soft(unscrollable, `${name} ${tab || 'overview'}: wide tables scroll inside their panel`).toBe(0);
      }
      await expect.soft(leadReports.tab('Source & Channel'), `${name}: tabs usable`).toBeVisible();
    }
  });

  test(...lr('LR-142'), async ({ leadReports, page }) => {
    await leadReports.openWith('last_12_months');
    await leadReports.tab('Source & Channel').focus();
    await page.keyboard.press('Enter');
    await expect(leadReports.tab('Source & Channel'), 'Enter on a tab opens it').toHaveClass(/is-active/);
    await leadReports.tab('Overview & Funnel').focus();
    await page.keyboard.press('Enter');
    const link = leadReports.cardLinks('SPA Signed').first();
    await link.focus();
    const focusVisible = await link.evaluate(e => { const s = getComputedStyle(e); return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none'; });
    expect.soft(focusVisible, 'Focused count link is highlighted').toBeTruthy();
    await page.keyboard.press('Enter');
    await expect(leadReports.drill.root, 'Enter on a count opens its list').toBeVisible();
    await leadReports.drill.closeButton.focus();
    await page.keyboard.press('Enter');
    await expect(leadReports.drill.root, 'Enter on Close closes it').toHaveCount(0);
  });

  test(...lr('LR-143'), async ({ leadReports, page }) => {
    let t = Date.now();
    await page.goto(leadReports.path);
    for (const k of leadReports.kpiLabels) await leadReports.kpiText(k);
    const pageMs = Date.now() - t;
    await leadReports.setPeriod('last_12_months');
    t = Date.now();
    const d = await leadReports.drill.openFrom(leadReports.cardLinks('Leads Captured').first());
    const drillMs = Date.now() - t;
    note('timings', `page ${pageMs} ms | list of ${d.rows.length} rows ${drillMs} ms (budget ${BUDGET} ms)`);
    expect.soft(pageMs, 'Overview loads within budget').toBeLessThanOrEqual(BUDGET);
    expect.soft(drillMs, 'Largest list loads within budget').toBeLessThanOrEqual(BUDGET);
  });

  test(...lr('LR-144'), async ({ leadReports, page }) => {
    await page.route('**/api/v1/reports/leads/overview**', r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Internal Server Error"}' }));
    await page.goto(leadReports.path);
    await expect(page.locator('main').getByText(ERROR_TEXT).first(), 'Error message after the app\'s retries').toBeVisible({ timeout: 20_000 });
    await expect.soft(page.locator('main').getByText(/^\s*loading/i), 'Not stuck loading').toHaveCount(0);
    await leadReports.expectNoBrokenValues();
  });
});
