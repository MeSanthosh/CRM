/**
 * Executive Dashboards (/dashboards): tabs Commercial / Sales, Monthly Sales & Marketing, Lead & Customer Insights; Report
 * Period; tiles, sections and tables. Commercial / Sales and Monthly are drawn with inline styles, so tiles and sections are
 * found by their text and tables are the <table> that follows a section heading. Records the API replies the tabs read.
 */
import type { Page, Response } from '@playwright/test';
import { expect } from '../auth';
import { EXD, at } from '../locators';
import { S, N, sheet } from './shared';

export type Tile = { label: string; value: string; lines: string[]; tooltip: string; href: string };
export type Table = { headers: string[]; rows: string[][]; get: (row: string, col: string) => string | undefined };

export class DashboardsPage {
  /** Latest JSON reply per API (snapshot / summary / collections), and every reply by full URL. */
  readonly api: { snapshot?: any; summary?: any; collections?: any; operations?: any } = {};
  readonly replies: { url: string; status: number }[] = [];
  readonly byUrl = new Map<string, any>();
  private tabName = S('Default Tab');

  constructor(readonly page: Page) {
    page.on('response', (r: Response) => this.record(r));
  }

  private async record(r: Response) {
    const url = r.url();
    if (!/\/api\/v1\//.test(url)) return;
    this.replies.push({ url: url.replace(/^.*\/api\/v1/, ''), status: r.status() });
    if (r.request().method() !== 'GET' || r.status() >= 300) return;
    if (!/analytics\/snapshots|dashboard\/summary|collections-summary/.test(url)) return;
    const body = await r.json().catch(() => undefined);
    if (body === undefined) return;
    this.byUrl.set(url.replace(/^.*\/api\/v1/, ''), body);
    if (/analytics\/snapshots/.test(url)) this.api.snapshot = body;
    else if (/collections-summary/.test(url)) this.api.collections = body;
    else if (/view=operations/.test(url)) this.api.operations = body;
    else this.api.summary = body;
  }

  get main() { return this.page.locator('main'); }

  /** Opens /dashboards (default tab and period), then the tab and period asked for. */
  async open(tab = S('Default Tab'), period?: string) {
    await this.page.goto(S('Dashboards Route'));
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await expect(at(this.page, EXD.dashTab(S('Default Tab')))).toBeVisible({ timeout: 30_000 });
    if (tab !== S('Default Tab')) await this.tab(tab);
    if (period) await this.period(period);
    await this.ready();
  }
  async tab(name: string) {
    this.tabName = name;
    await at(this.page, EXD.dashTab(name)).click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.ready();
  }
  /** Chooses a Report Period by its key (today, this_month, this_year, upto_date, custom). */
  async period(key: string) {
    const sel = this.page.locator(EXD.dashPeriod).first();
    if ((await sel.inputValue()) === key) return;
    await sel.selectOption(key);
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(800);
    await this.ready();
  }
  async periodValue() { return this.page.locator(EXD.dashPeriod).first().inputValue(); }
  async periodOptions() { return this.page.locator(EXD.dashPeriod).first().locator('option').evaluateAll(os => os.map(o => ({ value: (o as HTMLOptionElement).value, label: (o as HTMLOptionElement).text.trim() }))); }

  /** Waits until the tab no longer says "Loading …" (up to Load Wait Ms); returns false if it never finishes. */
  async ready(ms = N('Load Wait Ms')): Promise<boolean> {
    const loading = this.main.getByText(new RegExp(`^\\s*${S('Loading Text')}\\b.*\\.{3}\\s*$`));
    const done = await expect(loading).toHaveCount(0, { timeout: ms }).then(() => true, () => false);
    await this.page.waitForTimeout(300);
    return done;
  }
  async loadingText(): Promise<string> {
    return (await this.lines()).find(l => new RegExp(`^${S('Loading Text')}\\b`).test(l)) ?? '';
  }
  async activeTab(): Promise<string> {
    return (await this.page.locator(`${EXD.dashTabs}.is-active`).first().innerText().catch(() => '')).trim();
  }

  /** The main area's text, one trimmed line per entry. */
  async lines(): Promise<string[]> {
    return (await this.main.innerText()).split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  }

  /** A tile / card by its label as shown (case is ignored): value, the other lines, tooltip and link. */
  async tile(label: string): Promise<Tile | undefined> {
    return this.main.evaluate((root, label) => {
      const want = label.trim().toUpperCase();
      const own = (e: Element) => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent ?? '').join('').trim().toUpperCase();
      const hits = [...root.querySelectorAll('*')].filter(e => own(e) === want);
      for (const h of hits) {
        let card: Element | null = h.closest('a.crm-exec-kpi-card, article, [title]');
        if (!card || card === root || card.contains(root)) card = h.parentElement?.parentElement ?? h.parentElement;
        if (!card) continue;
        const lines = (card as HTMLElement).innerText.split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
        const i = lines.findIndex(l => l.toUpperCase() === want);
        const rest = lines.slice(i + 1);
        const value = rest.find(l => /\d/.test(l) && !/→|^As of\b|^Status as of\b/i.test(l) && !/^\d{4}-\d{2}-\d{2}/.test(l)) ?? '';
        return { label, value, lines: rest, tooltip: card.getAttribute('title') ?? '', href: card.getAttribute('href') ?? '' };
      }
      return undefined;
    }, label);
  }
  /** Value of a tile, '' when the tile is not shown. */
  async tileValue(label: string) { return (await this.tile(label))?.value ?? ''; }

  /** Lines of a section: from its heading (line that starts with it, case ignored) to the next heading of the tab. */
  async section(heading: string): Promise<string[]> {
    const lines = await this.lines();
    const heads = sheet('Sections').filter(r => r['Tab'] === this.tabName).map(r => r['Heading'].toUpperCase());
    const start = lines.findIndex(l => l.toUpperCase().startsWith(heading.toUpperCase()));
    if (start < 0) return [];
    const end = lines.findIndex((l, i) => i > start && heads.some(h => h !== heading.toUpperCase() && l.toUpperCase().startsWith(h)));
    return lines.slice(start + 1, end < 0 ? undefined : end);
  }
  /** The <table> after a section heading. */
  async table(heading: string): Promise<Table> {
    const data = await this.main.evaluate((root, heading) => {
      const want = heading.toUpperCase();
      const own = (e: Element) => (e as HTMLElement).innerText?.replace(/\s+/g, ' ').trim().toUpperCase() ?? '';
      const head = [...root.querySelectorAll('*')].find(e => own(e).startsWith(want) && ![...e.children].some(c => own(c).startsWith(want)));
      if (!head) return { headers: [], rows: [] };
      const table = [...root.querySelectorAll('table')].find(t => head.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (!table) return { headers: [], rows: [] };
      const cells = (tr: Element) => [...tr.querySelectorAll('th, td')].map(c => (c as HTMLElement).innerText.replace(/\s+/g, ' ').trim());
      const trs = [...table.querySelectorAll('tr')];
      return { headers: trs.length ? cells(trs[0]) : [], rows: trs.slice(1).map(cells) };
    }, heading);
    const col = (c: string) => data.headers.findIndex(h => h.toUpperCase().startsWith(c.toUpperCase()));
    return { ...data, get: (row: string, c: string) => data.rows.find(r => r[0]?.toUpperCase().startsWith(row.toUpperCase()))?.[col(c)] };
  }
  /** Every tooltip ([title]) on the tab. */
  async tooltips(): Promise<string[]> {
    return this.main.locator('[title]').evaluateAll(es => es.map(e => e.getAttribute('title') ?? ''));
  }

  /** "label / value" pairs of a section ("Referrals" "89", or "Available (128)" "$204.98M (95.5%)"). */
  async pairs(heading: string): Promise<{ label: string; value: string }[]> {
    const ls = await this.section(heading);
    const out: { label: string; value: string }[] = [];
    const isValue = (s: string) => /^(USD\s)?[$-]?[\d,.]+\s*[KMB]?\s*(%|USD)?(\s*\(.*\))?$/.test(s);
    for (let i = 0; i < ls.length - 1; i++) if (!isValue(ls[i]) && isValue(ls[i + 1])) { out.push({ label: ls[i], value: ls[i + 1] }); i++; }
    return out;
  }
  /** Chart points: a number line followed by a month line ("2.95" "Oct"); `per` numbers per month (2 for two series). */
  async monthly(heading: string, per = 1, after = false): Promise<{ month: string; values: number[] }[]> {
    const ls = await this.section(heading);
    const out: { month: string; values: number[] }[] = [];
    const month = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/;
    ls.forEach((l, i) => {
      if (!month.test(l)) return;
      // values written before the month ("2.95" "Oct") or, with `after`, after it ("Oct" "2.95" "0.29")
      const vals = after ? ls.slice(i + 1, i + 1 + per) : ls.slice(Math.max(0, i - per), i);
      if (vals.length === per && vals.every(v => /^-?\d+(\.\d+)?$/.test(v))) out.push({ month: l, values: vals.map(Number) });
    });
    return out;
  }
  /** Value written just before a caption ("$0" "Marketing Spend"). */
  async valueBefore(heading: string, caption: string): Promise<string> {
    const ls = await this.section(heading);
    const i = ls.findIndex(l => l.toUpperCase() === caption.toUpperCase());
    return i > 0 ? ls.slice(0, i).reverse().find(l => /\d/.test(l)) ?? '' : '';
  }

  // ── API values ──
  kpi(code: string): any { return (this.api.snapshot?.kpis ?? []).find((k: any) => k.metricCode === code); }
  /** Value of a Tiles-sheet source (kpi:, meta:, sum:, coll:, calc:conversion). */
  source(src: string): number {
    const [kind, path] = src.split(':');
    const dig = (o: any, p: string) => p.split('.').reduce((v, k) => v?.[k], o);
    if (kind === 'kpi') return this.kpi(path)?.actualValue;
    if (kind === 'meta') return dig(this.api.snapshot?.metadata, path);
    if (kind === 'sum') return dig(this.api.summary, path);
    if (kind === 'coll') return dig(this.api.collections, path);
    if (src === 'calc:conversion') { const l = this.kpi('TOTAL_LEADS')?.actualValue; return l ? (this.api.snapshot.metadata.convertedLeads / l) * 100 : 0; }
    throw new Error(`Unknown source ${src}`);
  }
}
