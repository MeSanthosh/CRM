/**
 * Lead Reports card → /reports/leads: 5 tabs, 8 filters + views, KPI cards with count links, lead funnel,
 * data completeness, 12-month trend, grouped tables with Total rows, aging buckets, lost reasons, scorecard,
 * and the drill-down list behind every count. No module-level exports (each table has its own Export).
 */
import { expect, Locator } from '@playwright/test';
import { act, parseNum, settle } from '../helpers';
import { ROUTES, XP, at, LEAD_REPORT_TABS } from '../locators';
import { ReportModulePage } from './ReportModulePage';
import { LeadDrill } from './LeadDrill';
import { LeadTable } from './LeadTable';

export type FunnelStep = { label: string; count: number; rate: number | null; step: number | null; width: number };
export type TrendMonth = { label: string; value: number; detail: string; opp: number; spa: number; height: number };
export type Completeness = { label: string; filled: number; total: number; percent: number };
export type Bucket = { label: string; count: number };

/** Grouping sub-tabs on Source & Channel and the header filter that selects the same field. */
export const GROUPINGS: { name: string; dimension: string; filter: string }[] = [
  { name: 'Lead Source', dimension: 'source', filter: 'All sources' },
  { name: 'Capture Channel', dimension: 'channel', filter: 'All channels' },
  { name: 'Campaign', dimension: 'campaign', filter: 'All campaigns' },
  { name: 'Broker', dimension: 'broker', filter: 'All brokers' },
  { name: 'Salesperson', dimension: 'owner', filter: 'All salespeople' },
  { name: 'Project', dimension: 'project', filter: 'All projects' },
  { name: 'Nationality', dimension: 'nationality', filter: 'All nationalities' },
  { name: 'Prospect Type', dimension: 'prospectType', filter: 'All types' },
];
/** Header filters: label shown above the dropdown → first option. */
export const LEAD_FILTERS: Record<string, string> = {
  'Project': 'All projects', 'Lead Source': 'All sources', 'Capture Channel': 'All channels', 'Campaign': 'All campaigns',
  'Broker': 'All brokers', 'Salesperson': 'All salespeople', 'Prospect Type': 'All types', 'Nationality': 'All nationalities',
};
export const FUNNEL_STEPS = ['Captured', 'Contacted', 'Qualified', 'Opportunity', 'Reserved', 'SPA Signed'];
export const BREAKDOWN_COLUMNS = ['Leads', 'Contacted', 'Qualified', 'Opportunity', 'Reserved', 'SPA Signed', 'Lost', 'Contact %', 'Qual. %',
  'Conv. %', 'Win %', 'Avg First Contact', 'Won Value', 'Cost / Lead'];
export const BREAKDOWN_LINK_COLUMNS = ['Leads', 'Contacted', 'Qualified', 'Opportunity', 'Reserved', 'SPA Signed', 'Lost'];
export const SCORECARD_COLUMNS = ['Salesperson', 'Leads', 'Contacted', 'Qualified', 'Opportunity', 'SPA Signed', 'Conv. %', 'Win %', 'Won Value',
  'Avg First Contact', 'Open Now', 'Idle > 30 d', 'Never Contacted', 'Overdue Tasks', 'Calls', 'Meetings', 'Tasks Done'];
export const SCORECARD_LINK_COLUMNS = ['Leads', 'Contacted', 'Qualified', 'Opportunity', 'SPA Signed', 'Open Now', 'Idle > 30 d', 'Never Contacted'];
export const AGING_LINK_COLUMNS = ['Open', 'Never Contacted'];
export const CLOSED_STATUSES = ['Converted', 'Lost', 'Disqualified', 'Duplicate'];

/** "2.8 d" / "46.4 h" / "—" → hours (NaN for "—"). */
export const toHours = (s: string) => {
  const m = String(s).replace(/,/g, '').match(/([\d.]+)\s*(d|h)\b/);
  return m ? Number(m[1]) * (m[2] === 'd' ? 24 : 1) : NaN;
};

export class LeadReportsPage extends ReportModulePage {
  readonly path = ROUTES.reports.leads;
  readonly name = 'Lead Reports';
  readonly filters = Object.values(LEAD_FILTERS);
  readonly mainKpi = 'Leads Captured';
  readonly tabs = LEAD_REPORT_TABS;
  readonly drill = new LeadDrill(this.page);
  readonly breakdown = new LeadTable(this.page, 'Performance by');
  readonly agingBySalesperson = new LeadTable(this.page, 'Open Leads by Salesperson');
  readonly agingByStatus = new LeadTable(this.page, 'Open Leads by Status');
  readonly longestIdle = new LeadTable(this.page, 'Longest Idle Leads');
  readonly byRating = new LeadTable(this.page, 'Conversion by Lead Rating');
  readonly byScore = new LeadTable(this.page, 'Conversion by Lead Score');
  readonly scorecard = new LeadTable(this.page, 'Salesperson Scorecard');

  /** Opens a tab directly by URL (?tab=…). */
  async openAt(tabParam: string, period?: Parameters<ReportModulePage['setPeriod']>[0]) {
    await this.page.goto(`${this.path}${tabParam ? `?tab=${tabParam}` : ''}`);
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await expect(this.page.locator('main')).not.toContainText(/^\s*loading/i);
    if (period) await this.setPeriod(period);
  }

  async openTab(name: string) {
    await act(this.page, () => this.tab(name).click());
    await expect(this.tab(name)).toHaveClass(/is-active/);
  }

  async activeTab(): Promise<string> {
    // don't hang when no tab is active (e.g. the browser left the page)
    const active = this.page.locator('main button.crm-tab-button.is-active').first();
    return (await active.innerText({ timeout: 10_000 }).catch(() => '(no tab active)')).trim();
  }

  panelHeading(text: string) {
    return this.page.locator('main h3', { hasText: text }).first();
  }

  panel(headingStart: string): Locator {
    return at(this.page, XP.leadPanel(headingStart)).first();
  }

  // ── KPI cards ─────────────────────────────────────────────────────────────
  card(label: string): Locator {
    return at(this.page, XP.kpiCard(label));
  }

  /** Card text without its title and value, e.g. "322 contacted". */
  async cardSubtitle(label: string): Promise<string> {
    const card = this.card(label);
    await this.kpiText(label);
    const read = async () => {
      const all = (await card.innerText()).replace(/\s+/g, ' ').trim();
      const title = (await card.locator('h3').innerText()).trim();
      const value = (await card.locator('.crm-kpi').innerText()).replace(/\s+/g, ' ').trim();
      return all.replace(title, '').replace(value, '').trim();
    };
    // the subtitle counts show 0 until the data arrives
    return settle(read, s => !/[1-9]/.test(s));
  }

  /** Count links inside a card (value first, then subtitle links). */
  cardLinks(label: string): Locator {
    return this.card(label).locator('button.crm-report-link');
  }

  /** All count links on the current tab (outside the drill-down list). */
  countLinks(): Locator {
    return at(this.page, XP.leadCountLinks);
  }

  // ── Header bits ───────────────────────────────────────────────────────────
  get helpToggle() {
    return at(this.page, XP.leadHelp).first();
  }

  async helpText(): Promise<string> {
    await this.helpToggle.click();
    const box = this.page.locator('main details', { has: this.page.locator('summary', { hasText: 'How these numbers are calculated' }) });
    return ((await box.count()) ? await box.innerText() : await this.helpToggle.locator('xpath=..').innerText()).replace(/\s+/g, ' ');
  }

  get fromInput() {
    return at(this.page, XP.reportFrom);
  }

  get toInput() {
    return at(this.page, XP.reportTo);
  }

  /** Header filter dropdowns with their label text and current value. */
  async filterState(): Promise<Record<string, string>> {
    return this.page.locator('main select').evaluateAll(ss => Object.fromEntries(ss.map(s => [
      ((s as HTMLSelectElement).closest('label')?.childNodes[0]?.textContent ?? '').trim(), (s as HTMLSelectElement).value])));
  }

  // ── Overview charts ───────────────────────────────────────────────────────
  async funnel(): Promise<FunnelStep[]> {
    await expect(at(this.page, XP.reportFunnelStep).first()).toBeVisible();
    return at(this.page, XP.reportFunnelStep).evaluateAll(steps => steps.map(s => {
      const q = (c: string) => (s.querySelector(c) as HTMLElement | null)?.innerText.trim() ?? '';
      const rateText = q('.crm-report-funnel-rate');
      const rate = rateText.match(/^(-?[\d.]+)%/);
      const step = rateText.match(/step\s+(-?[\d.]+)%/);
      return {
        label: q('.crm-report-funnel-label'),
        count: Number(q('.crm-report-funnel-count').replace(/,/g, '')),
        rate: rate ? Number(rate[1]) : null,
        step: step ? Number(step[1]) : null,
        width: parseFloat((s.querySelector('.crm-report-bar-fill') as HTMLElement | null)?.style.width ?? 'NaN'),
      };
    }));
  }

  funnelLink(step: string): Locator {
    return at(this.page, XP.reportFunnelStep).filter({ has: this.page.locator('.crm-report-funnel-label', { hasText: new RegExp(`^${step}$`) }) })
      .locator('button.crm-report-link');
  }

  async trend(): Promise<TrendMonth[]> {
    return at(this.page, XP.reportTrendMonth).evaluateAll(months => months.map(m => {
      const q = (c: string) => (m.querySelector(c) as HTMLElement | null)?.innerText.trim() ?? '';
      const detail = q('small');
      return {
        label: q('.crm-report-trend-label'),
        value: Number(q('.crm-report-trend-value').replace(/,/g, '')),
        detail,
        opp: Number(detail.match(/(\d+)\s*opp/)?.[1] ?? NaN),
        spa: Number(detail.match(/(\d+)\s*SPA/)?.[1] ?? NaN),
        height: parseFloat((m.querySelector('.crm-report-trend-fill') as HTMLElement | null)?.style.height ?? 'NaN'),
      };
    }));
  }

  /** Data Completeness rows, e.g. "Lead source recorded 41 / 613 (6.7%)". */
  async dataCompleteness(): Promise<Completeness[]> {
    const panel = this.panel('Data Completeness');
    await expect(panel, 'Data Completeness figures loaded').toContainText(/[\d,]+\s*\/\s*[\d,]+\s*\([\d.]+%\)/, { timeout: 30_000 });
    const text = await panel.innerText();
    return [...text.matchAll(/^(.+?)\s*\n?\s*([\d,]+)\s*\/\s*([\d,]+)\s*\(([\d.]+)%\)/gm)].map(m => ({
      label: m[1].trim(), filled: Number(m[2].replace(/,/g, '')), total: Number(m[3].replace(/,/g, '')), percent: Number(m[4]),
    }));
  }

  // ── Source & Channel ──────────────────────────────────────────────────────
  subTab(name: string): Locator {
    return at(this.page, XP.leadSubTab(name));
  }

  async subTabs(): Promise<string[]> {
    return (await this.panel('Performance by').locator('button.crm-tab-button').allInnerTexts()).map(s => s.trim());
  }

  /** Switches the grouping and waits until the table is re-rendered for it. */
  async groupBy(name: string) {
    if ((await this.breakdown.title()) === `Performance by ${name}`) return;
    const resp = this.page.waitForResponse(r => r.url().includes('/reports/leads/breakdown'), { timeout: 30_000 }).catch(() => null);
    await this.subTab(name).click();
    await expect(this.panel('Performance by').locator('h3').first()).toHaveText(`Performance by ${name}`);
    await resp;
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(500);
  }

  // ── Aging / Qualification lists ───────────────────────────────────────────
  /** Bucket lists such as Idle Time / Lead Age: "0–7 days 4", "Over 90 days 341". */
  async buckets(heading: string): Promise<Bucket[]> {
    const read = async () => {
      const lines = (await this.panel(heading).innerText()).split('\n').map(s => s.trim()).filter(Boolean);
      const out: Bucket[] = [];
      for (let i = 0; i < lines.length; i++) {
        const inline = lines[i].match(/^(.*\d.*days?|Over \d+ days)\s+([\d,]+)$/);
        if (inline) out.push({ label: inline[1].trim(), count: Number(inline[2].replace(/,/g, '')) });
        else if (/days?$/.test(lines[i]) && /^[\d,]+$/.test(lines[i + 1] ?? '')) out.push({ label: lines[i], count: Number(lines[++i].replace(/,/g, '')) });
      }
      return out;
    };
    // the panel renders its buckets after the data arrives
    return settle(read, b => b.length === 0, 30_000);
  }

  /** "Where the Leads Are Now": status → count. */
  async whereNow(): Promise<Bucket[]> {
    const lines = (await this.panel('Where the Leads Are Now').innerText()).split('\n').map(s => s.trim()).filter(Boolean).slice(1);
    const out: Bucket[] = [];
    for (let i = 0; i < lines.length; i++) {
      const inline = lines[i].match(/^(.+?)\s+([\d,]+)$/);
      if (inline) out.push({ label: inline[1], count: Number(inline[2].replace(/,/g, '')) });
      else if (/^[\d,]+$/.test(lines[i + 1] ?? '')) out.push({ label: lines[i], count: Number(lines[++i].replace(/,/g, '')) });
    }
    return out;
  }

  /** Lost Reasons: reason → count and %. */
  async lostReasons(): Promise<{ reason: string; count: number; percent: number }[]> {
    const read = async () => {
      const text = await this.panel('Lost Reasons').innerText();
      return [...text.matchAll(/^(.+?)\s*\n?\s*([\d,]+)\s*\(([\d.]+)%\)/gm)].map(m => ({ reason: m[1].trim(), count: Number(m[2].replace(/,/g, '')), percent: Number(m[3]) }));
    };
    // the reasons render after the data arrives
    return settle(read, r => r.length === 0);
  }

  get viewLostLeads() {
    return this.panel('Lost Reasons').getByRole('button', { name: 'View lost leads' });
  }

  /** Time-to-stage card: median value and the "average" from its subtitle, in hours. */
  async timeCard(label: string): Promise<{ median: number; average: number; text: string; subtitle: string }> {
    const text = await this.kpiText(label);
    const subtitle = await this.cardSubtitle(label);
    return { median: toHours(text), average: toHours(subtitle.replace(/^.*average/i, '')), text, subtitle };
  }

  /** Count of a card subtitle like "322 contacted" / "Win rate 12.4%". */
  async subtitleNumber(label: string): Promise<number> {
    return parseNum(await this.cardSubtitle(label));
  }
}
