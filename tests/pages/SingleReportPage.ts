/**
 * One report opened from the Reports & Analytics catalogue (/reports/governance?report=…): header with the
 * report code, title and All / Mine view, the filters, the metadata tiles, the report table and its definitions.
 * Period, custom dates, view and Reset come from ReportModulePage; the filters here are found by their label.
 */
import { Response, expect } from '@playwright/test';
import { download, Sheet } from '../helpers';
import { REP_XP, REP_TEXT, XP, at } from '../locators';
import { BasePage } from './BasePage';
import { ReportModulePage } from './ReportModulePage';
import { ReportTable } from './ReportTable';

export type ReportSpec = {
  code: string; title: string; route: string; query: string; panelId: string; columns: string[]; backLabel: string;
  /** Filter label → query parameter of the report request ("Project" → "projectCode") */
  filters?: Record<string, string>;
};

/** The report's table as the API returned it for one selection. */
export type ReportData = {
  query: Record<string, string>;
  meta: { period: { period: string; from: string; to: string }; periodApplies?: boolean; scope?: { mode: string; label: string } };
  total: number;
  columns: { key: string; label: string; format: string }[];
  rows: Record<string, unknown>[];
};

export type Option = { value: string; label: string };

/** Query parameters that select data (tzOffset and the default view=all do not). */
function selectionOf(params: URLSearchParams | Record<string, string>): Record<string, string> {
  const q: Record<string, string> = {};
  for (const [k, v] of params instanceof URLSearchParams ? params.entries() : Object.entries(params)) {
    if (!v || k === 'tzOffset' || k === 'table' || (k === 'view' && v === 'all')) continue;
    q[k] = v;
  }
  return q;
}
const keyOf = (q: Record<string, string>) => Object.keys(q).sort().map(k => `${k}=${q[k]}`).join('&');

export class SingleReportPage extends ReportModulePage {
  readonly path: string;
  readonly name: string;
  readonly filters: string[] = [];
  readonly mainKpi = REP_TEXT.tiles.total;
  /** Report responses seen on this page, by selection (the app serves a repeated selection from cache). */
  private readonly seen = new Map<string, ReportData>();

  constructor(page: ConstructorParameters<typeof BasePage>[0], readonly spec: ReportSpec) {
    super(page);
    this.path = `${spec.route}?${spec.query}`;
    this.name = spec.title;
    const api = `/api/v1/reports/business/${spec.route.split('/').pop()}?`;
    page.on('response', async (r: Response) => {
      if (r.request().method() !== 'GET' || !r.url().includes(api) || r.status() !== 200) return;
      try {
        const body = await r.json();
        const table = body.tables?.find((t: { key: string }) => t.key === spec.panelId);
        if (!table) return;
        const query = selectionOf(new URL(r.url()).searchParams);
        this.seen.set(keyOf(query), { query, meta: body.meta, total: table.total, columns: table.columns, rows: table.rows });
      } catch { /* page closed or not JSON */ }
    });
  }

  get code() { return at(this.page, REP_XP.reportCode); }
  get title() { return at(this.page, REP_XP.reportTitle); }
  get description() { return at(this.page, REP_XP.reportDescription); }
  get backLink() { return at(this.page, REP_XP.backLink); }
  get exportButton() { return at(this.page, REP_XP.panelExport(this.spec.panelId)); }
  siblingPill(code: string) { return at(this.page, REP_XP.siblingPill(code)); }

  /** Text of a metadata tile ("Total Records in Report", "Created By", …), once it has loaded. */
  async tile(label: string): Promise<string> {
    const value = at(this.page, REP_XP.tile(label));
    await expect(value, `Tile "${label}"`).toBeVisible();
    await expect(value, `Tile "${label}" loaded`).not.toHaveText(/^\s*[—–-]?\s*$/, { timeout: 15_000 });
    return (await value.innerText()).trim();
  }

  /** "Total Records in Report" as a number. */
  async totalRecords(): Promise<number> {
    return Number((await this.tile(REP_TEXT.tiles.total)).replace(/[^\d]/g, ''));
  }

  get tableRoot() { return at(this.page, REP_XP.panelTable(this.spec.panelId)); }

  async headers(): Promise<string[]> {
    await expect(this.tableRoot.locator('thead th').first(), `${this.spec.title} table`).toBeVisible({ timeout: 15_000 });
    return (await this.tableRoot.locator('thead th').allInnerTexts()).map(h => h.trim());
  }

  /** Every row of the report table keyed by column header (an empty-state row is not a record). */
  async rows(): Promise<Record<string, string>[]> {
    const headers = await this.headers();
    const cells = await this.tableRoot.locator('tbody tr').evaluateAll(trs =>
      trs.map(tr => [...tr.children].map(td => (td as HTMLElement).innerText.trim())));
    return cells.filter(c => c.length === headers.length).map(c => Object.fromEntries(headers.map((h, i) => [h, c[i]])));
  }

  /** Record IDs (first column) shown in the table. */
  async ids(): Promise<string[]> {
    const first = (await this.headers())[0];
    return (await this.rows()).map(r => r[first]);
  }

  /** Link in the first cell of the row whose first cell is `id` (e.g. the Lead ID link). */
  rowLink(id: string) {
    return this.tableRoot.locator('tbody tr td:first-child a', { hasText: id }).first();
  }

  /** Terms explained under "How these numbers are calculated" (column and tile names). */
  async definedTerms(): Promise<string[]> {
    return (await at(this.page, REP_XP.definitionTerms).allInnerTexts()).map(t => t.trim());
  }

  exactText(text: string) {
    return at(this.page, REP_XP.exactText(text));
  }

  message(text: string) {
    return at(this.page, REP_XP.message(text));
  }

  async userName(): Promise<string> {
    return (await at(this.page, REP_XP.userName).innerText()).trim();
  }

  /** Same table read as a ReportTable (export, sums), by the panel heading. */
  table(heading = this.spec.title): ReportTable {
    return new ReportTable(this.page, heading);
  }

  // ── Filters by label (Project, Salesperson) ───────────────────────────────
  filter(label: string) {
    return at(this.page, REP_XP.filter(label));
  }

  /** Options of a filter without its "All …" entry. */
  async options(label: string): Promise<Option[]> {
    const all = await this.filter(label).locator('option').evaluateAll(os =>
      os.map(o => ({ value: (o as HTMLOptionElement).value, label: (o.textContent ?? '').trim() })));
    return all.filter(o => o.value);
  }

  /** Selects a filter value ('' = all) and waits for the report to settle. */
  async setFilterValue(label: string, value: string) {
    await this.filter(label).selectOption(value);
    await this.settle();
  }

  async isMine(): Promise<boolean> {
    return (await this.viewButton('Mine').getAttribute('aria-pressed')) === 'true';
  }

  /** Query parameters of filters the page does not show at the moment (Mine hides Salesperson). */
  async hiddenParams(): Promise<string[]> {
    const hidden: string[] = [];
    for (const [label, param] of Object.entries(this.spec.filters ?? {})) if (!(await this.filter(label).count())) hidden.push(param);
    return hidden;
  }

  /** The selection shown on screen, as the query parameters the report request should carry. */
  async selection(): Promise<Record<string, string>> {
    const q: Record<string, string> = { period: await this.period() };
    if (q.period === 'custom') {
      q.from = await at(this.page, XP.reportFrom).inputValue();
      q.to = await at(this.page, XP.reportTo).inputValue();
    }
    for (const [label, param] of Object.entries(this.spec.filters ?? {})) {
      if (await this.filter(label).count()) q[param] = await this.filter(label).inputValue();
    }
    if (await this.isMine()) q.view = 'self';
    return selectionOf(q);
  }

  /** The API data for the selection on screen (waits until the app has loaded it). */
  async data(): Promise<ReportData> {
    let data: ReportData | undefined;
    await expect.poll(async () => {
      const sel = await this.selection();
      const hidden = await this.hiddenParams();
      // a hidden filter's parameter may or may not still be sent; it does not decide the match
      const strip = (q: Record<string, string>) => keyOf(Object.fromEntries(Object.entries(q).filter(([k]) => !hidden.includes(k))));
      data = [...this.seen.values()].reverse().find(d => strip(d.query) === strip(sel));
      return !!data;
    }, { message: `${this.spec.code} data for the selection on screen`, timeout: 30_000 }).toBe(true);
    const found = data as ReportData;
    // the table re-renders after the response; wait (quietly) until it shows that many records
    await expect.poll(async () => (await this.rows()).length, { timeout: 10_000 }).toBe(found.rows.length).catch(() => {});
    return found;
  }

  /** Record IDs in the API data (the first column is the record ID). */
  idsOf(data: ReportData): string[] {
    return data.rows.map(r => String(r[data.columns[0].key]));
  }

  /**
   * Clicks Export: the downloaded sheet and the selection the export request carried. Fails at once with the
   * server's answer when the export request is rejected (no file will come).
   */
  async export(): Promise<{ sheet: Sheet; query: Record<string, string> }> {
    const resp = this.page.waitForResponse(r => r.url().includes('/export?') && r.url().includes(`table=${this.spec.panelId}`), { timeout: 60_000 });
    const file = download(this.page, this.exportButton);
    file.catch(() => {}); // handled below once the response is known
    const r = await resp;
    if (r.status() >= 400) {
      const message = await this.page.locator('main section#' + this.spec.panelId).locator('.crm-export-button-wrap, .crm-report-panel-actions').innerText().catch(() => '');
      throw new Error(`Export rejected: HTTP ${r.status()} ${(await r.text().catch(() => '')).slice(0, 300)} · on screen: ${message.replace(/\s+/g, ' ').trim()}`);
    }
    return { sheet: await file, query: selectionOf(new URL(r.url()).searchParams) };
  }
}
