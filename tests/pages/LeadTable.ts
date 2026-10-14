/**
 * A table panel on Lead Reports, found by the start of its heading ("Performance by", "Open Leads by Salesperson",
 * "Salesperson Scorecard", …). Reads body rows, the Total row (tfoot) and the count links in cells.
 */
import { Page, Locator, expect } from '@playwright/test';
import { download, num, sum, Sheet } from '../helpers';
import { XP, at } from '../locators';

/** A table row keyed by column header; `__row` is its position in the table body (names can repeat). */
export type Row = Record<string, string>;
/** Summary rows that are not data rows (e.g. the scorecard's "Company average"). */
const SUMMARY_ROW = /^(company|team) average$/i;

export class LeadTable {
  constructor(readonly page: Page, readonly heading: string) {}

  get panel(): Locator {
    return at(this.page, XP.leadPanel(this.heading)).first();
  }

  get table(): Locator {
    return this.panel.locator('table').first();
  }

  get exportButton() {
    return this.panel.getByRole('button', { name: 'Export', exact: true });
  }

  async title(): Promise<string> {
    return (await this.panel.locator('h3').first().innerText()).trim();
  }

  async headers(): Promise<string[]> {
    await expect(this.table, `Table "${this.heading}"`).toBeVisible();
    return (await this.table.locator('thead th').allInnerTexts()).map(h => h.replace(/[↕▼▲]/g, '').trim());
  }

  private async read(section: 'tbody' | 'tfoot'): Promise<Row[]> {
    const headers = await this.headers();
    const cells = await this.table.locator(`${section} tr`).evaluateAll(trs => trs.map(tr => [...tr.children].map(td => (td as HTMLElement).innerText.trim())));
    return cells.map((c, i) => ({ c, i })).filter(({ c }) => c.length === headers.length)
      .map(({ c, i }) => ({ ...Object.fromEntries(headers.map((h, k) => [h, c[k]])), __row: String(i) }));
  }

  /** Body rows (without the Total row and summary rows such as "Company average"). */
  async rows(): Promise<Row[]> {
    return (await this.read('tbody')).filter(r => !SUMMARY_ROW.test(Object.values(r)[0]));
  }

  /** The "Company average" (or similar) summary row, if the table has one. */
  async summaryRow(): Promise<Row | undefined> {
    return (await this.read('tbody')).find(r => SUMMARY_ROW.test(Object.values(r)[0]));
  }

  /** The Total row, if the table has one. */
  async total(): Promise<Row | undefined> {
    return (await this.read('tfoot'))[0];
  }

  async column(name: string): Promise<string[]> {
    return (await this.rows()).map(r => r[name]);
  }

  async sum(name: string): Promise<number> {
    return sum((await this.column(name)).map(num));
  }

  /** The cell of a body row and column. Pass the row read from rows() (exact position) or its label (first match). */
  cell(row: Row | string, column: string, headers: string[]): Locator {
    let tr: Locator;
    if (typeof row !== 'string') tr = this.table.locator('tbody tr').nth(Number(row.__row));
    else {
      const exact = new RegExp(`^\\s*${row.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
      tr = this.table.locator('tbody tr').filter({ has: this.page.locator('td:first-child', { hasText: exact }) }).first();
    }
    return tr.locator('td').nth(headers.indexOf(column));
  }

  /** The count link in a cell (absent when the cell is not a link, e.g. a 0). */
  link(row: Row | string, column: string, headers: string[]): Locator {
    return this.cell(row, column, headers).locator('button.crm-report-link, a');
  }

  export(): Promise<Sheet> {
    return download(this.page, this.exportButton);
  }
}
