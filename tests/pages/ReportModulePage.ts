/**
 * Shared behaviour of the 10 report modules behind the hub cards (/reports/…): period, custom dates,
 * filter dropdowns, All / You and your team / Mine views, Reset filters, module tabs, tables, exports.
 */
import { expect } from '@playwright/test';
import { act } from '../helpers';
import { XP, at, REPORT_PAGES, ROUTES } from '../locators';
import { BasePage } from './BasePage';
import { ReportTable } from './ReportTable';

export const PERIODS = ['this_month', 'last_month', 'this_quarter', 'last_quarter', 'ytd', 'last_12_months', 'custom'] as const;
export type Period = (typeof PERIODS)[number];
export type View = 'All' | 'You and your team' | 'Mine';

/** The module tab bar, in order, with the page each tab opens. */
export const MODULE_TABS: Record<string, string> = {
  Sales: ROUTES.reports.sales, Inventory: ROUTES.reports.inventory, Customers: ROUTES.reports.customers, Brokers: ROUTES.reports.brokers,
  Marketing: ROUTES.reports.marketing, Reservations: ROUTES.reports.reservations, SPA: ROUTES.reports.spa, Collections: ROUTES.reports.collections,
  Exceptions: ROUTES.reports.exceptions, Leads: ROUTES.reports.leads,
};

export abstract class ReportModulePage extends BasePage {
  /** Filter dropdowns other than the period, by their first option ("All projects", …). */
  abstract readonly filters: string[];
  /** A count KPI that every filter and view can only narrow (used by the filter / view checks). */
  abstract readonly mainKpi: string;
  /** Module tab label in the tab bar (Sales, Inventory, …); Lead Reports has its own tabs instead. */
  readonly tabLabel?: string;
  /** Tables whose export lists every row of groups the screen shows collapsed (more rows, own headers). */
  readonly expandedInExport: string[] = [];

  get kpiLabels(): string[] {
    return REPORT_PAGES[this.name].kpis;
  }

  get tableHeadings(): string[] {
    return REPORT_PAGES[this.name].tables;
  }

  table(heading: string): ReportTable {
    return new ReportTable(this.page, heading);
  }

  // ── Period ────────────────────────────────────────────────────────────────
  get periodSelect() {
    return at(this.page, XP.reportPeriod);
  }

  period(): Promise<string> {
    return this.periodSelect.inputValue();
  }

  async periodOptions(): Promise<string[]> {
    return this.periodSelect.locator('option').evaluateAll(os => os.map(o => (o as HTMLOptionElement).value));
  }

  /** Waits for the matching data request; a period loaded before is served from cache (no request). */
  async setPeriod(value: Period) {
    if ((await this.period()) === value) return;
    if (value === 'custom') return act(this.page, () => this.periodSelect.selectOption(value));
    const resp = this.page.waitForResponse(r => r.url().includes(`period=${value}`), { timeout: 5_000 }).catch(() => null);
    await this.periodSelect.selectOption(value);
    await resp;
    await this.settle();
  }

  /** Opens the module with an explicit period (modules open on Last 12 months). */
  async openWith(period: Period = 'last_12_months') {
    await this.open();
    await this.setPeriod(period);
  }

  /** "Custom dates" with From / To (yyyy-mm-dd); waits for the request carrying both dates. */
  async setCustomRange(from: string, to: string) {
    await this.setPeriod('custom');
    const resp = this.dataResponse(u => u.includes(`from=${from}`) && u.includes(`to=${to}`));
    await at(this.page, XP.reportFrom).fill(from);
    await at(this.page, XP.reportTo).fill(to);
    await resp;
    await this.settle();
  }

  // ── Filters, views, reset ─────────────────────────────────────────────────
  filterSelect(allOption: string) {
    return at(this.page, XP.reportFilter(allOption));
  }

  /** Option labels of a filter, without its "All …" option. */
  async filterOptions(allOption: string): Promise<string[]> {
    return (await this.filterSelect(allOption).locator('option').allInnerTexts()).map(o => o.trim()).slice(1);
  }

  async setFilter(allOption: string, label: string) {
    const resp = this.dataResponse().catch(() => null);
    await this.filterSelect(allOption).selectOption({ label });
    await resp;
    await this.settle();
  }

  viewButton(view: View) {
    return at(this.page, XP.viewSegment(view));
  }

  async setView(view: View) {
    await act(this.page, () => this.viewButton(view).click());
    await expect(this.viewButton(view)).toHaveClass(/is-active/);
    await this.settle();
  }

  get resetButton() {
    return at(this.page, XP.reportResetFilters);
  }

  async resetFilters() {
    await act(this.page, () => this.resetButton.click());
    await this.settle();
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  tab(label: string) {
    return at(this.page, XP.reportTab(label));
  }

  async backToHub() {
    await at(this.page, XP.reportHubLink).first().click();
    await expect(this.page).toHaveURL(new RegExp(`${ROUTES.hub}$`));
  }

  // ── Module tab bar, messages, cards as shown, filters by position ─────────
  moduleTab(name: string) {
    return at(this.page, XP.moduleTab(name));
  }

  async moduleTabLabels(): Promise<string[]> {
    return (await at(this.page, XP.moduleTabs).allInnerTexts()).map(t => t.trim());
  }

  get emptyMessage() {
    return at(this.page, XP.reportEmpty);
  }

  get dateError() {
    return at(this.page, XP.reportDateError);
  }

  get fromInput() {
    return at(this.page, XP.reportFrom);
  }

  get toInput() {
    return at(this.page, XP.reportTo);
  }

  /** Card text as shown ("—" included), without waiting for a number. */
  async shown(label: string): Promise<string> {
    await expect(this.kpiValue(label), `KPI "${label}"`).toBeVisible();
    return (await this.kpiValue(label).innerText()).trim();
  }

  /** Every card as shown, after the report has loaded. */
  async shownAll(): Promise<Record<string, string>> {
    await this.kpiText(this.mainKpi);
    const out: Record<string, string> = {};
    for (const l of this.kpiLabels) out[l] = await this.shown(l);
    return out;
  }

  /** Name of the signed-in user, from the user menu ("CA / CRM Administrator / role"). */
  async signedInUser(): Promise<string> {
    const lines = (await at(this.page, XP.userMenu).innerText()).split('\n').map(s => s.trim()).filter(Boolean);
    return lines[1] ?? lines[0];
  }

  /** Selects a filter option by position (1 = first after "All …"); two options can share a label. */
  async setFilterIndex(allOption: string, index: number) {
    const resp = this.dataResponse().catch(() => null);
    await this.filterSelect(allOption).selectOption({ index });
    await resp;
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(300);
  }

  // ── internals ─────────────────────────────────────────────────────────────
  /** The module's data request (not the shared /options call). */
  dataResponse(match: (url: string) => boolean = () => true) {
    return this.page.waitForResponse(
      r => r.request().method() === 'GET' && /\/api\/v1\/reports\/(business|leads)\/(?!options)/.test(r.url()) && match(r.url()),
      { timeout: 30_000 },
    );
  }

  protected async settle() {
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(300);
  }
}
