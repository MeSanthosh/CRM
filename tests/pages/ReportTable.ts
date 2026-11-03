/** A table panel on a report module, found by its heading (e.g. "Open Pipeline by Stage"). */
import { Page, expect } from '@playwright/test';
import { tableColumn, num, sum, download, Sheet, showTable } from '../helpers';
import { XP, at, RENAMED_COLUMNS, tableHeading } from '../locators';

export class ReportTable {
  constructor(readonly page: Page, readonly heading: string) {}

  get root() {
    return at(this.page, XP.reportTable(this.heading));
  }

  get exportButton() {
    return at(this.page, XP.reportPanelExport(this.heading));
  }

  async headers(): Promise<string[]> {
    await showTable(this.page, this.heading);
    return (await this.root.locator('thead th').allInnerTexts()).map(h => h.replace(/[↕▼▲]/g, '').trim());
  }

  async rowCount(): Promise<number> {
    await showTable(this.page, this.heading);
    return at(this.page, XP.reportTableRows(this.heading)).count();
  }

  /** Cell texts of one column, by header. */
  column(name: string): Promise<string[]> {
    return tableColumn(this.page, this.heading, name);
  }

  /** Sum of a numeric column ("—" counts as 0). */
  async sum(name: string): Promise<number> {
    return sum((await this.column(name)).map(num));
  }

  /** Rows as objects keyed by column header. */
  async rows(): Promise<Record<string, string>[]> {
    const headers = await this.headers();
    const cells = await this.root.locator('tbody tr').evaluateAll(trs =>
      trs.map(tr => [...tr.children].map(td => (td as HTMLElement).innerText.trim())));
    const alias = Object.entries(RENAMED_COLUMNS[tableHeading(this.heading)] ?? {});
    // renamed columns are also readable under their old name
    return cells.filter(r => r.length === headers.length).map(r => {
      const row: Record<string, string> = Object.fromEntries(headers.map((h, i) => [h, r[i]]));
      for (const [old, now] of alias) if (now in row && !(old in row)) row[old] = row[now];
      return row;
    });
  }

  /** The Total row (tfoot) keyed by column header, if the table has one. */
  async total(): Promise<Record<string, string> | undefined> {
    // with no data the table is replaced by "Nothing matches these filters."
    await showTable(this.page, this.heading).catch(() => {});
    if (!(await this.root.count())) return undefined;
    const headers = await this.headers();
    const foot = at(this.page, XP.reportTableTotal(this.heading));
    if (!(await foot.count())) return undefined;
    const cells = (await foot.first().locator('th, td').allInnerTexts()).map(c => c.trim());
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
  }

  /** Record links in the table body (e.g. Customer IDs). */
  get links() {
    return at(this.page, XP.reportTableLinks(this.heading));
  }

  /** Clicks the panel's Export and reads the downloaded sheet (the "Total" row is kept apart). */
  async export(): Promise<Sheet> {
    await showTable(this.page, this.heading);
    return download(this.page, this.exportButton);
  }
}
