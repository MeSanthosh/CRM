/** Sales Reports workbook — Data changes (SR-110…117), Cross-page (SR-118…125), Non-functional (SR-126…132). */
import 'dotenv/config';
import { test, expect, note } from '../pages/fixtures';
import { num, kpi, open } from '../helpers';
import { ROUTES } from '../locators';
import { SALES_FILTERS } from '../pages/SalesReportsPage';
import { sr, srSkipped } from './catalog';
import { BAD, expectSame } from './shared';

const DATA_CHANGE = 'Creates or edits opportunities on QA: run by hand with a disposable test opportunity (automating it needs the Opportunities form locators)';
/** Workbook targets: page ≤ 3 s, filter reload ≤ 2 s (override with SALES_PAGE_MS / SALES_FILTER_MS). */
const PAGE_MS = Number(process.env.SALES_PAGE_MS ?? 3000);
const FILTER_MS = Number(process.env.SALES_FILTER_MS ?? 2000);
const SIZES = { '1366 px': { width: 1366, height: 768 }, '1024 px': { width: 1024, height: 768 } };

test.describe('Sales Reports · Data changes', () => {
  for (const id of ['SR-110', 'SR-111', 'SR-112', 'SR-113', 'SR-114', 'SR-115', 'SR-116', 'SR-117']) test(...srSkipped(id, DATA_CHANGE));
});

test.describe('Sales Reports · Cross-page', () => {
  test(...sr('SR-118'), async ({ sales, hub, executive }) => {
    await sales.open();
    const own = await sales.kpi('Open opportunities');
    await hub.open();
    const onHub = await hub.kpi('Open Opportunities');
    await executive.open();
    const onDashboard = await executive.kpi('Open Opportunities');
    note('Open opportunities', `Sales ${own} | hub ${onHub} | dashboard ${onDashboard}`);
    expect.soft(onHub, 'Hub').toBe(own);
    expect.soft(onDashboard, 'Executive Dashboard').toBe(own);
  });

  for (const [id, salesLabel, hubLabel] of [['SR-119', 'Pipeline value', 'Pipeline Value'], ['SR-120', 'Weighted pipeline', 'Weighted Pipeline']] as const) {
    test(...sr(id), async ({ sales, hub }) => {
      await sales.open();
      const own = await sales.kpiText(salesLabel);
      await hub.open();
      const other = await hub.kpiText(hubLabel);
      note(salesLabel, `Sales ${own} | hub ${other}`);
      expectSame(own, other, `${salesLabel} = hub "${hubLabel}"`);
    });
  }

  test(...sr('SR-121'), async ({ sales, executive }) => {
    await executive.open();
    if ((await executive.periodSelect.inputValue()) !== 'this_month') await executive.periodSelect.selectOption('this_month');
    await executive.page.waitForLoadState('networkidle').catch(() => {});
    const dashboard = await executive.kpi('Won Opportunities');
    await sales.openWith('this_month');
    const own = num(await sales.kpiShown('Won in period'));
    note('This month', `dashboard ${dashboard} | Sales ${own}`);
    expect(own).toBe(dashboard);
  });

  test(...sr('SR-122'), async ({ sales, leadReports }) => {
    await leadReports.openWith('last_12_months');
    const lead = await leadReports.kpiText('Won Value');
    await sales.openWith('last_12_months');
    const own = await sales.kpiShown('Won value');
    note('Last 12 months', `Lead Reports ${lead} | Sales ${own}`);
    expectSame(own, lead, 'Won value = Lead Reports "Won Value"');
  });

  test(...sr('SR-123'), async ({ sales, spa }) => {
    await spa.openWith('last_12_months');
    const signed = num(await spa.kpiText('SPAs signed in period'));
    await sales.openWith('last_12_months');
    const won = num(await sales.kpiShown('Won in period'));
    note('Last 12 months', `SPA Reports ${signed} | Sales ${won}`);
    expect(won).toBe(signed);
  });

  test(...sr('SR-124'), async ({ sales, exceptions }) => {
    await sales.open();
    const own = num(await sales.kpiShown('Past expected close'));
    await exceptions.open();
    const rows = await exceptions.table('Open opportunities past expected close date').rowCount();
    note('Past expected close', `Sales ${own} | Exception Reports rows ${rows}`);
    expect(rows).toBe(own);
  });

  test(...sr('SR-125'), async ({ sales, page }) => {
    await sales.open();
    const [count, value] = [await sales.kpi('Open opportunities'), await sales.kpiText('Pipeline value')];
    await open(page, ROUTES.opportunities);
    const [listCount, listValue] = [await kpi(page, 'Open'), (await page.locator(`xpath=//article[contains(@class,'crm-card')][h3[normalize-space()='Pipeline Value']]/div[contains(@class,'crm-kpi')]`).innerText()).trim()];
    note('open', `Sales ${count} / ${value} | Opportunities page ${listCount} / ${listValue}`);
    expect.soft(listCount, 'Open count').toBe(count);
    expectSame(value, listValue, 'Pipeline value');
  });
});

test.describe('Sales Reports · Non-functional', () => {
  test(...sr('SR-126'), async ({ sales, page }) => {
    const start = Date.now();
    await page.goto(ROUTES.reports.sales);
    for (const k of sales.kpiLabels) await sales.kpiText(k);
    const pageMs = Date.now() - start;
    const filterMs: string[] = [];
    for (const all of Object.values(SALES_FILTERS)) {
      const option = (await sales.options(sales.filterSelect(all)))[1];
      const t = Date.now();
      const resp = page.waitForResponse(r => /\/reports\/business\/sales\b/.test(r.url()), { timeout: 30_000 });
      await sales.filterSelect(all).selectOption(option.value);
      await resp;
      await expect(sales.kpiValue(sales.mainKpi)).not.toHaveText(/^\s*$/);
      const ms = Date.now() - t;
      filterMs.push(`${all}: ${ms} ms`);
      expect.soft(ms, `${all} reload ≤ ${FILTER_MS} ms`).toBeLessThanOrEqual(FILTER_MS);
      await sales.setFilterValue(all, '');
    }
    note('timings', `page ${pageMs} ms | ${filterMs.join(' | ')}`);
    expect.soft(pageMs, `Page loaded ≤ ${PAGE_MS} ms`).toBeLessThanOrEqual(PAGE_MS);
  });

  test(...sr('SR-127'), async ({ sales }) => {
    const watch = sales.watchErrors();
    await sales.open();
    for (const p of ['this_month', 'last_quarter', 'ytd'] as const) await sales.setPeriod(p);
    for (const all of sales.filters) {
      await sales.setFilterValue(all, (await sales.options(sales.filterSelect(all)))[1].value);
      await sales.setFilterValue(all, '');
    }
    for (const v of ['You and your team', 'Mine', 'All'] as const) await sales.setView(v);
    for (const t of sales.tableHeadings) await sales.table(t).export();
    note('checked', `${watch.errors.length} JS errors, ${watch.failed.length} failed calls`);
    sales.expectNoErrors();
  });

  test(...sr('SR-128'), async ({ sales, page }) => {
    await sales.openWith('last_12_months');
    const first = await sales.snapshot();
    for (let i = 0; i < 2; i++) {
      await page.reload();
      await page.waitForLoadState('networkidle').catch(() => {});
      await sales.setPeriod('last_12_months');
      const again = await sales.snapshot();
      expect.soft(again.kpis, `Reload ${i + 1}: KPIs`).toEqual(first.kpis);
      expect.soft(again.stage, `Reload ${i + 1}: stage table`).toEqual(first.stage);
      expect.soft(again.salesperson, `Reload ${i + 1}: salesperson table`).toEqual(first.salesperson);
      expect.soft(again.opportunities, `Reload ${i + 1}: open opportunities`).toEqual(first.opportunities);
    }
  });

  test(...sr('SR-129'), async ({ sales }) => {
    test.skip(!process.env.SALES_LONG, 'Waits 16 minutes for the access token to expire: set SALES_LONG=1 to run');
    test.setTimeout(20 * 60_000);
    await sales.openWith('last_12_months');
    await sales.page.waitForTimeout(16 * 60_000);
    await sales.setPeriod('last_month');
    await expect(sales.page, 'Still on the report (not logged out)').toHaveURL(new RegExp(ROUTES.reports.sales));
    for (const k of sales.kpiLabels) expect.soft(await sales.kpiShown(k), k).not.toMatch(BAD);
  });

  test(...sr('SR-130'), async ({ sales, page }) => {
    await sales.open();
    await sales.tab('Inventory').click();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.reports.inventory}(\\?.*)?$`));
    await page.goBack();
    await expect(page, 'Back returns to Sales').toHaveURL(new RegExp(`${ROUTES.reports.sales}(\\?.*)?$`));
    expect.soft(await sales.kpiText(sales.mainKpi), 'Sales figures after Back').not.toMatch(BAD);
    await page.goForward();
    await expect(page, 'Forward returns to Inventory').toHaveURL(new RegExp(`${ROUTES.reports.inventory}(\\?.*)?$`));
    await expect.soft(page.locator('main h2').first(), 'Inventory page is not blank').toBeVisible();
  });

  test(...sr('SR-131'), async ({ sales, page }) => {
    for (const [name, size] of Object.entries(SIZES)) {
      await page.setViewportSize(size);
      await sales.open();
      const layout = await page.evaluate(() => {
        const pageScroll = document.documentElement.scrollWidth - window.innerWidth;
        const unscrollable = [...document.querySelectorAll('main table')].filter(t => {
          if (t.getBoundingClientRect().width <= window.innerWidth) return false;
          for (let e = t.parentElement; e && e.tagName !== 'MAIN'; e = e.parentElement) if (/(auto|scroll)/.test(getComputedStyle(e).overflowX)) return false;
          return true;
        }).length;
        const cards = [...document.querySelectorAll('main article.crm-card')].map(c => c.getBoundingClientRect());
        const overlaps = cards.filter((a, i) => cards.some((b, j) => j > i && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1)).length;
        return { pageScroll, unscrollable, overlaps };
      });
      note(name, JSON.stringify(layout));
      expect.soft(layout.pageScroll, `${name}: no page-wide horizontal scroll`).toBeLessThanOrEqual(1);
      expect.soft(layout.unscrollable, `${name}: wide tables scroll inside their panel`).toBe(0);
      expect.soft(layout.overlaps, `${name}: KPI cards do not overlap`).toBe(0);
    }
  });

  test(...sr('SR-132'), async ({ sales, page }) => {
    await sales.open();
    for (const t of sales.tableHeadings) {
      expect.soft(await sales.table(t).root.locator('thead th').count(), `${t}: header cells`).toBeGreaterThan(0);
    }
    const exportNames: string[] = [];
    for (const t of sales.tableHeadings) {
      const b = sales.table(t).exportButton;
      const name = (await b.getAttribute('aria-label')) ?? (await b.getAttribute('title')) ?? (await b.innerText()).trim();
      const described = await b.getAttribute('aria-describedby');
      exportNames.push(described ? `${name} (${described})` : name);
    }
    note('Export buttons', exportNames.join(' | '));
    expect.soft(new Set(exportNames).size, 'Each Export button can be told apart (aria-label / description names its panel)').toBe(exportNames.length);
    await expect.soft(page.getByRole('group', { name: 'Report view' }), 'View buttons grouped and labelled').toBeVisible();
  });
});
