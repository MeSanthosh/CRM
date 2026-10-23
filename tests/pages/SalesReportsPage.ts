/** Sales Reports card → /reports/sales: pipeline by stage and salesperson, win rate, open opportunities. */
import { expect, Locator } from '@playwright/test';
import { num, settle } from '../helpers';
import { ROUTES, XP, at } from '../locators';
import { ReportModulePage } from './ReportModulePage';

export type Row = Record<string, string>;
/** What the Opportunity Detail modal shows for one opportunity. */
export type OpportunityDetail = { text: string; budget: string; probability: string; expectedClose: string; project: string; workflow: string[] };

/** Filter labels on screen, with each dropdown's "All …" first option. */
export const SALES_FILTERS: Record<string, string> = {
  Project: 'All projects', Salesperson: 'All salespeople', Broker: 'All brokers', Campaign: 'All campaigns',
};
export const SALES_PERIOD_LABEL = 'Period (won / lost)';
export const MODULE_TABS = ['Sales', 'Inventory', 'Customers', 'Brokers', 'Marketing', 'Reservations', 'SPA', 'Collections', 'Exceptions', 'Leads'];
export const STAGE_COLUMNS = ['Stage', 'Opportunities', 'Value (USD)', 'Weighted (USD)', 'Share of Value %'];
export const SALESPERSON_COLUMNS = ['Salesperson', 'Open', 'Pipeline (USD)', 'Weighted (USD)', 'Won', 'Won Value (USD)', 'Lost', 'Win %'];
export const OPPORTUNITY_COLUMNS = ['Opportunity', 'Customer', 'Stage', 'Salesperson', 'Value (USD)', 'Probability %', 'Expected Close'];
/** KPIs that are "as of today" (the period does not apply) and those that follow the period. */
export const OPEN_KPIS = ['Open opportunities', 'Pipeline value', 'Weighted pipeline', 'Past expected close'];
export const WON_KPIS = ['Won in period', 'Won value', 'Win rate', 'Average days to win'];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** "17 Jun 2026" / "30 Sept 2026" → Date; "—" or anything else → null. */
export function parseDay(text: string): Date | null {
  const m = text.trim().match(/^(\d{1,2})\s+([A-Za-z]{3,4})\.?\s+(\d{4})$/);
  const month = m ? MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) : -1;
  return m && month >= 0 ? new Date(Number(m[3]), month, Number(m[1])) : null;
}

export class SalesReportsPage extends ReportModulePage {
  readonly path = ROUTES.reports.sales;
  readonly name = 'Sales Reports';
  readonly tabLabel = 'Sales';
  readonly filters = Object.values(SALES_FILTERS);
  readonly mainKpi = 'Open opportunities';

  readonly stageTable = this.table('Open Pipeline by Stage');
  readonly salespersonTable = this.table('Salesperson Pipeline');
  readonly opportunitiesTable = this.table('Open Opportunities');

  // ── Header and layout ─────────────────────────────────────────────────────
  get intro() {
    return at(this.page, XP.reportIntro);
  }

  get fromInput() {
    return at(this.page, XP.reportFrom);
  }

  get toInput() {
    return at(this.page, XP.reportTo);
  }

  async filterLabels(): Promise<string[]> {
    return (await at(this.page, XP.reportFilterLabels).allInnerTexts()).map(s => s.trim());
  }

  /** Dropdown by its label on screen ("Project", "Period (won / lost)", …). */
  filterByLabel(label: string): Locator {
    return at(this.page, XP.reportFilterByLabel(label));
  }

  /** Options of a dropdown as { value, label }, including the "All …" option. */
  async options(select: Locator): Promise<{ value: string; label: string }[]> {
    return select.locator('option').evaluateAll(os => os.map(o => ({ value: (o as HTMLOptionElement).value, label: (o as HTMLOptionElement).text.trim() })));
  }

  /** Selects an option by value (labels can repeat, e.g. two "Mahalakshmi") and waits for the report. */
  async setFilterValue(allOption: string, value: string) {
    if ((await this.filterSelect(allOption).inputValue()) === value) return;
    // a combination loaded before is served from cache (no request), so don't wait long for one
    const resp = this.page.waitForResponse(r => /\/reports\/business\/sales\b/.test(r.url()), { timeout: 5_000 }).catch(() => null);
    await this.filterSelect(allOption).selectOption(value);
    await resp;
    await this.settle();
  }

  async kpiTitles(): Promise<string[]> {
    return (await at(this.page, XP.reportKpiTitles).allInnerTexts()).map(s => s.trim());
  }

  async kpiCaption(label: string): Promise<string> {
    const p = at(this.page, XP.reportKpiCaption(label));
    return (await p.count()) ? (await p.innerText()).trim() : '';
  }

  /** KPI text as shown right now, including a final "—" (kpiText() waits for "—" to go away). */
  async kpiShown(label: string): Promise<string> {
    await this.settle();
    return (await this.kpiValue(label).innerText()).trim();
  }

  async panelHeadings(): Promise<string[]> {
    return (await at(this.page, XP.reportPanelHeadings).allInnerTexts()).map(s => s.trim());
  }

  async panelNote(heading: string): Promise<string> {
    return (await at(this.page, XP.reportPanelNote(heading)).innerText()).trim();
  }

  emptyMessage(heading: string): Locator {
    return at(this.page, XP.reportEmpty(heading));
  }

  async moduleTabs(): Promise<string[]> {
    return (await this.page.locator('main .crm-tab-button').allInnerTexts()).map(s => s.trim());
  }

  /** Display name of the logged-in user (second line of the user menu button). */
  async userName(): Promise<string> {
    const lines = (await at(this.page, XP.userMenu).innerText()).split('\n').map(s => s.trim()).filter(Boolean);
    return lines[1] ?? lines[0];
  }

  // ── Tables ────────────────────────────────────────────────────────────────
  /** Rows of a table; an empty table ("Nothing matches these filters.") gives []. */
  async rowsOf(heading: string): Promise<Row[]> {
    await this.settle();
    if (await this.emptyMessage(heading).count()) return [];
    // rows render a moment after the KPIs
    return settle(() => this.table(heading).rows(), r => r.length === 0, 3_000);
  }

  stageRows = () => this.rowsOf('Open Pipeline by Stage');
  salespersonRows = () => this.rowsOf('Salesperson Pipeline');
  opportunityRows = () => this.rowsOf('Open Opportunities');

  /** The bold Total row (tfoot) keyed by column header, or null when the table has none. */
  async totalRow(heading: string): Promise<Row | null> {
    const tr = at(this.page, XP.reportTotalRow(heading));
    if (!(await tr.count())) return null;
    const headers = await this.table(heading).headers();
    const cells = (await tr.locator('td, th').allInnerTexts()).map(s => s.trim());
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
  }

  /** Numeric column of rows ("—" counts as 0). */
  static col(rows: Row[], name: string): number[] {
    return rows.map(r => num(r[name] ?? ''));
  }

  /** Every KPI text plus the three tables: a snapshot to compare two loads or periods. */
  async snapshot() {
    const kpis: Record<string, string> = {};
    for (const k of this.kpiLabels) kpis[k] = await this.kpiShown(k);
    return { kpis, stage: await this.stageRows(), salesperson: await this.salespersonRows(), opportunities: await this.opportunityRows() };
  }

  // ── Opportunity Detail ────────────────────────────────────────────────────
  get detail() {
    return at(this.page, XP.opportunityDetail);
  }

  /** Opens an opportunity from the Open Opportunities table (its reference link). */
  async openOpportunity(reference: string) {
    await at(this.page, XP.reportTableLinks('Open Opportunities')).filter({ hasText: reference }).first().click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  /** Reads the Opportunity Detail modal (labels are upper-cased by CSS, so they are matched case-insensitively). */
  async readDetail(): Promise<OpportunityDetail> {
    await expect(this.detail, 'Opportunity Detail opens').toBeVisible({ timeout: 15_000 });
    await expect(this.detail).toContainText(/probability/i);
    const text = await this.detail.innerText();
    const field = (label: string) => text.match(new RegExp(`^\\s*${label}\\s*\\n\\s*(.+)$`, 'im'))?.[1].trim() ?? '';
    return {
      text, budget: field('budget'), probability: field('probability'), expectedClose: field('expected close'), project: field('project'),
      workflow: (await at(this.page, XP.opportunityWorkflowSteps).allInnerTexts()).map(s => s.trim()),
    };
  }
}
