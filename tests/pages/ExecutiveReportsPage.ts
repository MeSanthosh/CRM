/**
 * Executive Reports card → Executive Dashboard (/). Not a /reports/ module: it has its own
 * Dashboard View (Executive Dashboard / Lead Dashboard) and Period dropdowns, KPI cards that link to
 * their records, and summary panels.
 */
import { expect } from '@playwright/test';
import { act, parseNum, waitForKpi } from '../helpers';
import { ROUTES, XP, at, DASHBOARD_KPIS } from '../locators';
import { BasePage } from './BasePage';

export type DashboardView = 'operations' | 'audience';
export const DASHBOARD_PERIODS = ['this_month', 'last_30_days', 'this_quarter', 'ytd'] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export class ExecutiveReportsPage extends BasePage {
  readonly path = ROUTES.dashboard;
  readonly name = 'Executive Reports';
  readonly pageTitle = 'Executive Dashboard';
  readonly kpiLabels = DASHBOARD_KPIS;
  /** Panels of the Executive Dashboard view. */
  readonly panels = ['Sales Pipeline', 'Inventory Overview', 'Sales Trend (SPAs Value)', 'Top Performing Brokers',
    'Unit Holds Expiring (24h)', 'Collections Summary', 'Priority Alerts'];
  /** Panels of the Lead Dashboard view. */
  readonly leadPanels = ['Lead & Customer Insights', 'Lead Source Mix', 'Capture Channel', 'Geography', 'Conversion by Source'];

  get viewSelect() {
    return at(this.page, XP.dashboardView);
  }

  get periodSelect() {
    return at(this.page, XP.dashboardPeriod);
  }

  kpiCard(label: string) {
    return at(this.page, XP.execKpiCard(label));
  }

  /** Panels can be nested in a wrapper that is also a .crm-panel; the last match is the panel itself. */
  panel(heading: string) {
    return at(this.page, XP.dashboardPanel(heading)).last();
  }

  async setView(view: DashboardView) {
    await act(this.page, () => this.viewSelect.selectOption(view));
  }

  async periodOptions(): Promise<string[]> {
    return this.periodSelect.locator('option').evaluateAll(os => os.map(o => (o as HTMLOptionElement).value));
  }

  async setPeriod(period: DashboardPeriod) {
    if ((await this.periodSelect.inputValue()) === period) return;
    // a period loaded before comes from the app's cache (no request), so the wait is allowed to give up
    const resp = this.page.waitForResponse(r => r.url().includes('/dashboard/summary') && r.url().includes(`period=${period}`), { timeout: 5_000 }).catch(() => null);
    await this.periodSelect.selectOption(period);
    await resp;
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(300);
  }

  /** "Amount Received" and "Outstanding" from the Collections Summary panel. */
  async collectionsSummary(): Promise<{ received: number; outstanding: number }> {
    const text = (await this.panel('Collections Summary').innerText()).replace(/\s+/g, ' ');
    const pick = (label: string) => {
      const m = text.match(new RegExp(`${label}\\s+([\\d.,]+\\s?[KMB]?\\s?[A-Z]{3})`));
      if (!m) throw new Error(`"${label}" not found in Collections Summary: ${text}`);
      return parseNum(m[1]);
    };
    return { received: pick('Amount Received'), outstanding: pick('Outstanding') };
  }

  /** Clicks a KPI card (they are links to the underlying records). */
  async openKpi(label: string) {
    const href = await this.kpiCard(label).getAttribute('href');
    await this.kpiCard(label).click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
    return href;
  }

  /** Waits until every KPI card shows data (cards briefly show "—" while loading). */
  async waitForKpis() {
    for (const label of this.kpiLabels) await waitForKpi(this.page, label);
  }

  async expectOnDashboard() {
    await expect(this.heading(this.pageTitle)).toBeVisible();
  }
}
