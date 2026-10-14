/** Lead Reports workbook — General (LR-001…006) and Tabs (LR-007…015). Run: npm run test:lead-workbook */
import { test, expect, note } from '../pages/fixtures';
import { ROUTES } from '../locators';
import { lr } from './catalog';

const NO_AUTH = { cookies: [], origins: [] };
/** LR-008 … LR-011 open the 2nd … 5th tab. */
const OTHER_TABS = [{ id: 'LR-008', index: 1 }, { id: 'LR-009', index: 2 }, { id: 'LR-010', index: 3 }, { id: 'LR-011', index: 4 }];
const TAB_API: Record<string, string> = { '': 'overview', source: 'breakdown', aging: 'aging', qualification: 'qualification', scorecard: 'scorecard' };

test.describe('Lead Reports · General', () => {
  test(...lr('LR-001'), async ({ hub, leadReports, page }) => {
    await hub.open();
    const card = await hub.readCard(ROUTES.reports.leads);
    expect.soft(card.name).toBe('Lead Reports');
    expect.soft(card.status).toBe('LIVE');
    await hub.openModule(ROUTES.reports.leads);
    await expect(leadReports.heading()).toBeVisible();
    await expect.soft(page.locator('main'), 'Intro text').toContainText(/Funnel, source, aging, qualification and conversion/i);
    expect.soft(await leadReports.activeTab()).toBe(leadReports.tabs[0].name);
  });

  test(...lr('LR-002'), async ({ leadReports }) => {
    await leadReports.open();
    for (const label of leadReports.kpiLabels) expect.soft(await leadReports.kpiText(label), label).not.toMatch(/^\s*$|NaN|undefined/);
    for (const panel of leadReports.tabs[0].panels) await expect.soft(leadReports.panelHeading(panel), panel).toBeVisible();
  });

  test(...lr('LR-003'), async ({ leadReports }) => {
    await leadReports.open();
    await leadReports.backToHub();
  });

  test.describe('without a login', () => {
    test.use({ storageState: NO_AUTH });
    test(...lr('LR-004'), async ({ page }) => {
      const data: string[] = [];
      page.on('response', r => { if (r.url().includes('/reports/leads/') && r.ok()) data.push(r.url()); });
      await page.goto(ROUTES.reports.leads);
      await expect(page).toHaveURL(/\/login/);
      expect.soft(data, 'Report data returned without a login').toEqual([]);
    });
  });

  test(...lr('LR-005'), async ({ leadReports }) => {
    leadReports.watchErrors();
    await leadReports.open();
    await leadReports.expectNoBrokenValues();
    leadReports.expectNoErrors();
  });

  test(...lr('LR-006'), async ({ leadReports }) => {
    await leadReports.open();
    const text = await leadReports.helpText();
    for (const term of ['Leads captured', 'Contacted', 'Qualified', 'Opportunity', 'Reserved', 'SPA Signed', 'Won Value', 'Lost', 'Open', 'Idle days', 'View']) {
      expect.soft(text, `Definition of "${term}"`).toMatch(new RegExp(`${term}(:| is )`));
    }
    expect.soft(text, 'Says the "now" figures ignore the period').toMatch(/as of today and ignore the period/i);
  });
});

test.describe('Lead Reports · Tabs', () => {
  test(...lr('LR-007'), async ({ leadReports, page }) => {
    await leadReports.open();
    const tabs = (await page.locator('main button.crm-tab-button').allInnerTexts()).map(s => s.trim());
    expect.soft(tabs, 'Tab bar').toEqual(leadReports.tabs.map(t => t.name));
    expect(await leadReports.activeTab()).toBe(leadReports.tabs[0].name);
  });

  // LR-008 … LR-011: each of the other four tabs
  OTHER_TABS.forEach(({ id, index }) => {
    test(...lr(id), async ({ leadReports, page }) => {
      const tab = leadReports.tabs[index];
      await leadReports.open();
      const api = page.waitForRequest(r => r.url().includes(`/reports/leads/${TAB_API[tab.param]}`), { timeout: 30_000 });
      await leadReports.openTab(tab.name);
      await api;
      await expect.soft(page).toHaveURL(new RegExp(`tab=${tab.param}`));
      for (const p of tab.panels) await expect.soft(leadReports.panelHeading(p), `${tab.name} › ${p}`).toBeVisible();
      for (const k of tab.kpis) expect.soft(await leadReports.kpiText(k), `${tab.name} › ${k}`).not.toMatch(/NaN|undefined/);
    });
  });

  test(...lr('LR-012'), async ({ leadReports }) => {
    await leadReports.openAt('aging');
    expect(await leadReports.activeTab()).toBe('Aging & Follow-up');
    await expect(leadReports.panelHeading('Idle Time')).toBeVisible();
  });

  test(...lr('LR-013'), async ({ leadReports, page }) => {
    await leadReports.open();
    await leadReports.openTab('Source & Channel');
    await page.reload();
    await page.waitForLoadState('networkidle').catch(() => {});
    expect(await leadReports.activeTab()).toBe('Source & Channel');
  });

  test(...lr('LR-014'), async ({ leadReports, page }) => {
    await leadReports.openAt('aging');
    await leadReports.openTab('Salesperson Scorecard');
    await page.goBack();
    await page.waitForLoadState('networkidle').catch(() => {});
    note('after Back', `${page.url()} — active "${await leadReports.activeTab()}"`);
    expect(await leadReports.activeTab(), 'Tab after browser Back').toBe('Aging & Follow-up');
  });

  test(...lr('LR-015'), async ({ leadReports }) => {
    leadReports.watchErrors();
    await leadReports.openAt('nonsense');
    expect(await leadReports.activeTab()).toBe(leadReports.tabs[0].name);
    await leadReports.expectNoBrokenValues();
    leadReports.expectNoErrors();
  });
});
