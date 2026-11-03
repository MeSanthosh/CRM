/**
 * Executive Reports card → Executive Dashboard (/). Not a /reports/ module: it has its own
 * Dashboard View (Executive Dashboard / Lead Dashboard) and Period dropdowns, KPI cards that link to
 * their records, and summary panels.
 */
import { expect } from '@playwright/test';
import { act, parseNum, waitForKpi } from '../helpers';
import { ROUTES, XP, at, DASHBOARD_KPIS } from '../locators';
import { BasePage } from './BasePage';

export type DashboardView = 'commercial_executive' | 'monthly_sales_marketing' | 'operations' | 'audience';
/** Dashboard View options (value → label); the first is the default since build 1710. */
export const DASHBOARD_VIEWS: Record<DashboardView, string> = {
  commercial_executive: 'Commercial / Sales Dashboard', monthly_sales_marketing: 'Monthly Sales & Marketing Report',
  operations: 'Executive Operations Dashboard', audience: 'Lead Dashboard',
};
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

  /**
   * Since build 1710 the dashboard opens on "Commercial / Sales Dashboard"; the KPI cards and panels this page
   * object reads are on "Executive Operations Dashboard", so open() switches to it.
   */
  async open() {
    await super.open();
    if ((await this.viewSelect.inputValue()) !== 'operations') await this.setView('operations');
    await this.page.waitForLoadState('networkidle').catch(() => {});
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

  get reportPeriodSelect() {
    return at(this.page, XP.dashboardReportPeriod);
  }

  /** Opens / and switches to a view (the snapshot views have no request of their own to wait for). */
  async openView(view: DashboardView) {
    await super.open();
    if ((await this.viewSelect.inputValue()) !== view) await this.setView(view);
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(800);
  }

  /** Value of a tile on the snapshot views: the line after its label ("TOTAL LEADS" → "621"). */
  async tile(label: string): Promise<string> {
    const lbl = at(this.page, XP.dashboardLabel(label)).first();
    await expect(lbl, `Tile "${label}"`).toBeVisible();
    return lbl.evaluate((el, name) => {
      // climb to the smallest box whose text has the label and something after it
      for (let e: HTMLElement | null = el as HTMLElement; e && e.tagName !== 'MAIN'; e = e.parentElement) {
        const lines = e.innerText.split('\n').map(s => s.trim()).filter(Boolean);
        const i = lines.findIndex(l => l.toUpperCase() === (name as string).toUpperCase());
        const value = lines.slice(i + 1).find(l => /\d/.test(l));
        if (i >= 0 && value) return value;
      }
      return '';
    }, label);
  }

  /** Text lines of the box under a panel heading (snapshot views). */
  async sectionLines(heading: string): Promise<string[]> {
    const h = at(this.page, XP.dashboardHeading(heading)).first();
    await expect(h, `Panel "${heading}"`).toBeVisible();
    return h.evaluate(el => {
      let e: HTMLElement | null = el.parentElement as HTMLElement;
      while (e && e.innerText.trim() === (el as HTMLElement).innerText.trim()) e = e.parentElement;
      return (e?.innerText ?? '').split('\n').map(s => s.trim()).filter(Boolean);
    });
  }

  /** Rows of the table that follows a panel heading, keyed by column header. */
  async tableAfter(heading: string): Promise<Record<string, string>[]> {
    const t = at(this.page, XP.dashboardTableAfter(heading));
    await expect(t, `Table after "${heading}"`).toBeVisible();
    return t.evaluate(tb => {
      const headers = [...tb.querySelectorAll('thead th')].map(th => (th as HTMLElement).innerText.trim());
      return [...tb.querySelectorAll('tbody tr')].map(tr => Object.fromEntries([...tr.children].map((td, i) => [headers[i], (td as HTMLElement).innerText.trim()])));
    });
  }

  actionButton(name: string) {
    return at(this.page, XP.dashboardAction(name));
  }

  /** Waits until every KPI card shows data (cards briefly show "—" while loading). */
  async waitForKpis() {
    for (const label of this.kpiLabels) await waitForKpi(this.page, label);
  }

  async expectOnDashboard() {
    await expect(this.heading(this.pageTitle)).toBeVisible();
  }
}
