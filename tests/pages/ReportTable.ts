/** A table panel on a report module, found by its heading (e.g. "Open Pipeline by Stage"). */
import { Page, expect } from '@playwright/test';
import { tableColumn, num, sum, download, Sheet } from '../helpers';
import { XP, at } from '../locators';

export class ReportTable {
  constructor(readonly page: Page, readonly heading: string) {}

  get root() {
    return at(this.page, XP.reportTable(this.heading));
  }

  get exportButton() {
    return at(this.page, XP.reportPanelExport(this.heading));
  }

  async headers(): Promise<string[]> {
    await expect(this.root, `Table "${this.heading}"`).toBeVisible();
    return (await this.root.locator('thead th').allInnerTexts()).map(h => h.replace(/[↕▼▲]/g, '').trim());
  }

  async rowCount(): Promise<number> {
    await expect(this.root, `Table "${this.heading}"`).toBeVisible();
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
    return cells.filter(r => r.length === headers.length).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
  }

  /** Clicks the panel's Export and reads the downloaded sheet (the "Total" row is kept apart). */
  export(): Promise<Sheet> {
    return download(this.page, this.exportButton);
  }
}
