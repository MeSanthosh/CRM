/**
 * The drill-down list that opens under Lead Reports when a count is clicked: title, "N leads" (with
 * "· showing the first 500" / "· as of today"), Export, Close and a table of leads.
 */
import { Page, Locator, expect } from '@playwright/test';
import { download, Sheet } from '../helpers';
import { XP, at } from '../locators';

/** The page shows at most this many rows; the header then says "showing the first 500". */
export const DRILL_CAP = 500;
export const DRILL_COLUMNS = ['Lead', 'Status', 'Salesperson', 'Source', 'Captured', 'First Contact', 'Qualified', 'Idle', 'Won Value'];
export const DRILL_EXPORT_COLUMNS = ['Lead No', 'Name', 'Status', 'Salesperson', 'Source', 'Channel', 'Project', 'Captured', 'First Contacted',
  'Qualified', 'Converted', 'Last Interaction', 'Days Idle', 'Won Value (Base)'];

export type DrillRow = Record<string, string> & { LeadNo: string };
export type Drill = { title: string; countLine: string; count: number; truncated: boolean; asOfToday: boolean; headers: string[]; rows: DrillRow[]; bucket: string | null; dimension: string | null; key: string | null };

const CLOSED = ['Converted', 'Lost', 'Disqualified', 'Duplicate'];
const blank = (v?: string) => !v || /^[—–-]$/.test(v.trim());
const days = (v?: string) => Number(String(v).match(/([\d.]+)\s*d/)?.[1] ?? NaN);
const SCALE: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9 };
const money = (v?: string) => {
  const m = String(v).replace(/,/g, '').match(/([\d.]+)\s*([KMB])?/);
  return m ? Number(m[1]) * (SCALE[m[2] ?? ''] ?? 1) : 0;
};

/** What every listed row must show for a bucket (as far as the list's columns can show it), per the page's own definitions. */
export const BUCKET_RULES: Record<string, { text: string; ok: (r: DrillRow) => boolean }> = {
  captured: { text: 'has a Captured date', ok: r => !blank(r['Captured']) },
  // "Contacted: a first contact is recorded (first call, meeting or status change to Contacted or later)"
  contacted: { text: 'has a First Contact date or a status of Contacted or later', ok: r => !blank(r['First Contact']) || !['New', 'Assigned'].includes(r['Status']) },
  qualified: { text: 'has a Qualified date', ok: r => !blank(r['Qualified']) },
  converted: { text: 'status Converted / Opportunity Created', ok: r => ['Converted', 'Opportunity Created'].includes(r['Status']) },
  reserved: { text: 'status Converted / Opportunity Created', ok: r => ['Converted', 'Opportunity Created'].includes(r['Status']) },
  won: { text: 'has a Won Value', ok: r => money(r['Won Value']) > 0 },
  openNow: { text: 'is open (not Converted / Lost / Disqualified / Duplicate)', ok: r => !CLOSED.includes(r['Status']) },
  idleNow: { text: 'is open and idle over 30 days', ok: r => !CLOSED.includes(r['Status']) && days(r['Idle']) > 30 },
  neverContactedNow: { text: 'is open with no First Contact', ok: r => !CLOSED.includes(r['Status']) && blank(r['First Contact']) },
  lost: { text: 'status Lost / Disqualified', ok: r => ['Lost', 'Disqualified'].includes(r['Status']) },
};
/** List column that shows a grouping (drill "dimension"). */
export const DIMENSION_COLUMN: Record<string, string> = { source: 'Source', owner: 'Salesperson' };

export class LeadDrill {
  constructor(readonly page: Page) {}

  get root(): Locator {
    return at(this.page, XP.leadDrill);
  }

  get exportButton() {
    return this.root.getByRole('button', { name: 'Export', exact: true });
  }

  get closeButton() {
    return this.root.getByRole('button', { name: 'Close', exact: true });
  }

  leadLinks() {
    return this.root.locator('tbody a');
  }

  async isOpen() {
    return (await this.root.count()) > 0;
  }

  /** Clicks a count (or "View lost leads") and waits until the list has loaded its rows. */
  async openFrom(link: Locator): Promise<Drill> {
    const resp = this.page.waitForResponse(r => r.url().includes('/reports/leads/drill'), { timeout: 30_000 });
    await link.scrollIntoViewIfNeeded();
    await link.click();
    const url = new URL((await resp).url());
    await this.waitLoaded();
    const d = await this.read();
    return { ...d, bucket: url.searchParams.get('bucket'), dimension: url.searchParams.get('dimension'), key: url.searchParams.get('key') };
  }

  /** The list first shows a loading state; wait for its "N leads" line and its rows. */
  async waitLoaded() {
    await this.root.waitFor({ timeout: 15_000 });
    await this.page.waitForFunction(cap => {
      const p = document.querySelector('section.crm-report-drill');
      if (!p) return false;
      const line = (p as HTMLElement).innerText.split('\n').map(s => s.trim()).find(l => /^\d[\d,]* leads?\b/.test(l));
      if (!line) return false;
      const n = Number(line.match(/^([\d,]+)/)![1].replace(/,/g, ''));
      return n === 0 || p.querySelectorAll('tbody tr').length >= Math.min(n, cap);
    }, DRILL_CAP, { timeout: 30_000 });
  }

  async read(): Promise<Omit<Drill, 'bucket' | 'dimension' | 'key'>> {
    return this.root.evaluate(p => {
      const lines = (p as HTMLElement).innerText.split('\n').map(s => s.trim()).filter(Boolean);
      const countLine = lines.find(l => /^\d[\d,]* leads?\b/.test(l)) ?? '';
      const headers = [...p.querySelectorAll('thead th')].map(t => (t as HTMLElement).innerText.trim());
      const rows = [...p.querySelectorAll('tbody tr')].map(tr => {
        const r = Object.fromEntries([...tr.children].map((td, i) => [headers[i], (td as HTMLElement).innerText.trim()])) as Record<string, string>;
        return { ...r, LeadNo: (r['Lead'] ?? '').match(/LD-[A-Z0-9-]+/)?.[0] ?? '' };
      });
      return {
        title: lines[0] ?? '', countLine,
        count: Number((countLine.match(/^([\d,]+)/)?.[1] ?? 'NaN').replace(/,/g, '')),
        truncated: /showing the first/i.test(countLine), asOfToday: /as of today/i.test(countLine), headers, rows,
      };
    });
  }

  /** Downloads the list's Export (all leads, not only the 500 shown). */
  export(): Promise<Sheet> {
    return download(this.page, this.exportButton);
  }

  async close() {
    await this.closeButton.click();
    await expect(this.root).toHaveCount(0);
  }

  /**
   * Full consistency check of one count link (used by the drill-down tests):
   * clicked = header = rows shown (500 + note above 500) = export rows; no duplicates; rows fit the bucket
   * and, for grouped tables, belong to the clicked row.
   */
  async verify(link: Locator, opts: { expected?: number; rowLabel?: string; withExport?: boolean } = {}) {
    const clicked = opts.expected ?? Number((await link.innerText()).replace(/,/g, '').trim());
    const d = await this.openFrom(link);
    const where = `${d.title} (${d.bucket}${d.dimension ? ` · ${d.dimension}` : ''})`;
    expect.soft(d.count, `${where}: "N leads" = number clicked`).toBe(clicked);
    expect.soft(d.rows.length, `${where}: rows listed`).toBe(Math.min(clicked, DRILL_CAP));
    if (clicked > DRILL_CAP) expect.soft(d.truncated, `${where}: says "showing the first ${DRILL_CAP}"`).toBeTruthy();
    const nos = d.rows.map(r => r.LeadNo);
    expect.soft(nos.filter((v, i, a) => v && a.indexOf(v) !== i), `${where}: duplicate leads`).toEqual([]);
    const rule = d.bucket ? BUCKET_RULES[d.bucket] : undefined;
    if (rule) expect.soft(d.rows.filter(r => !rule.ok(r)).map(r => `${r.LeadNo} ${r['Status']}`).slice(0, 10), `${where}: rows that do not ${rule.text}`).toEqual([]);
    const col = d.dimension ? DIMENSION_COLUMN[d.dimension] : undefined;
    if (col && opts.rowLabel) {
      const unspecified = /^(Unspecified|Unassigned)$/.test(opts.rowLabel);
      const off = d.rows.filter(r => (unspecified ? !(blank(r[col]) || r[col] === opts.rowLabel) : r[col] !== opts.rowLabel));
      expect.soft(off.map(r => `${r.LeadNo} ${col}=${r[col]}`).slice(0, 10), `${where}: rows outside "${opts.rowLabel}"`).toEqual([]);
    }
    let exported: Sheet | undefined;
    if (opts.withExport !== false) {
      exported = await this.export();
      expect.soft(exported.rows.length, `${where}: export rows`).toBe(clicked);
      const inFile = new Set(exported.rows.map(r => String(r['Lead No'])));
      expect.soft(nos.filter(n => !inFile.has(n)).slice(0, 10), `${where}: listed leads missing from export`).toEqual([]);
    }
    return { clicked, drill: d, exported };
  }
}
