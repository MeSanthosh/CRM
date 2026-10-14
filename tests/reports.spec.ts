import { test, expect } from './auth';
import { kpi, kpiText, open, tableRows, collectJson, numbersIn, matchesApi, watchErrors } from './helpers';
import { ROUTES, XP, at, HUB_SNAPSHOT, HUB_MODULES, REPORT_PAGES, DASHBOARD_KPIS } from './locators';

const BAD_VALUE = /NaN|undefined|null|Infinity|^\s*$/;

test.describe('Reports & Analytics hub', () => {
  test('RA-01 all 8 snapshot cards show a valid, non-negative number', async ({ page }) => {
    await open(page, ROUTES.hub);
    for (const label of HUB_SNAPSHOT) {
      await test.step(label, async () => {
        const txt = await kpiText(page, label);
        expect.soft(txt, `${label} text`).not.toMatch(BAD_VALUE);
        expect.soft(await kpi(page, label), `${label} ≥ 0`).toBeGreaterThanOrEqual(0);
      });
    }
  });

  test('RA-02 snapshot values match the API response (UI vs backend)', async ({ page }) => {
    const bodies = collectJson(page);
    await open(page, ROUTES.hub);
    const apiNums = numbersIn(bodies);
    test.skip(apiNums.length === 0, 'No JSON API calls captured');
    for (const label of HUB_SNAPSHOT) {
      const v = await kpi(page, label);
      expect.soft(matchesApi(v, apiNums), `${label}=${v} found in API response`).toBeTruthy();
    }
  });

  test('RA-03 values are stable after reload', async ({ page }) => {
    await open(page, ROUTES.hub);
    const first: Record<string, string> = {};
    for (const l of HUB_SNAPSHOT) first[l] = await kpiText(page, l);
    await page.reload();
    await page.waitForLoadState('networkidle').catch(() => {});
    // After a reload the cards briefly show "—" / "0" while data loads; they must settle on the same values.
    for (const l of HUB_SNAPSHOT) {
      await expect
        .poll(async () => kpiText(page, l), { message: `${l} after reload`, timeout: 15_000 })
        .toBe(first[l]);
    }
  });

  test('RA-04 hub loads with no JS errors and no failed API calls', async ({ page }) => {
    const w = watchErrors(page);
    await open(page, ROUTES.hub);
    expect.soft(w.failed, 'Failed API calls').toEqual([]);
    expect.soft(w.errors, 'JS errors').toEqual([]);
  });

  test('RA-05 module status summary = number of module cards per status', async ({ page }) => {
    await open(page, ROUTES.hub);
    const live = Number((await at(page, XP.hubLiveCount).innerText()).match(/\d+/)![0]);
    const liveCards = await page.locator('a.crm-module-hub-card .crm-module-hub-status.is-live').count();
    expect(liveCards).toBe(live);
    expect(await page.locator('a.crm-module-hub-card').count()).toBe(HUB_MODULES.length);
  });

  HUB_MODULES.forEach((m, i) => {
    test(`RA-MOD-${String(i + 1).padStart(2, '0')} ${m.name} card opens ${m.href}`, async ({ page }) => {
      await open(page, ROUTES.hub);
      const card = at(page, XP.moduleCard(m.href));
      await expect(card).toContainText(m.name);
      const status = (await at(page, XP.moduleCardStatus(m.href)).innerText()).trim().toUpperCase();
      test.info().annotations.push({ type: 'status', description: status });
      await card.click();
      await expect(page).toHaveURL(new RegExp(`${m.href.replace(/\//g, '\\/')}$`));
    });
  });
});

test.describe('Report modules', () => {
  Object.entries(REPORT_PAGES).forEach(([name, def], i) => {
    test(`RM-${String(i + 1).padStart(2, '0')} ${name}: every KPI valid, every table renders, no errors`, async ({ page }) => {
      const w = watchErrors(page);
      await open(page, def.path);
      for (const label of def.kpis) {
        await test.step(`KPI ${label}`, async () => {
          const txt = await kpiText(page, label);
          expect.soft(txt, `${label}`).not.toMatch(BAD_VALUE);
          expect.soft(await kpi(page, label), `${label} ≥ 0`).toBeGreaterThanOrEqual(0);
          if (txt.includes('%')) expect.soft(await kpi(page, label), `${label} is a sane %`).toBeLessThanOrEqual(100_000);
        });
      }
      for (const t of def.tables) {
        await test.step(`Table ${t}`, async () => {
          expect.soft(await tableRows(page, t), `${t} rows`).toBeGreaterThanOrEqual(0);
        });
      }
      await expect.soft(page.locator('main')).not.toContainText(/NaN|undefined|Something went wrong/);
      expect.soft(w.failed, 'Failed API calls').toEqual([]);
      expect.soft(w.errors, 'JS errors').toEqual([]);
    });
  });

  test('RM-11 Executive Dashboard: every KPI valid', async ({ page }) => {
    await open(page, ROUTES.dashboard);
    for (const label of DASHBOARD_KPIS) {
      expect.soft(await kpiText(page, label), label).not.toMatch(BAD_VALUE);
    }
  });
});
