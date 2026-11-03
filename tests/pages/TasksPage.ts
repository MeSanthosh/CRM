/**
 * Tasks & Calendar page (/activities): Tasks list (filters, search, export) and the Call log view.
 */
import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { ActivityDialog } from './ActivityDialog';
import { act, download, Sheet } from '../helpers';
import { XP, at } from '../locators';

export type TaskRow = { kind: string; subject: string; notes: string; due: string; priority: string; record: string; assigned: string; status: string; text: string };

export class TasksPage extends BasePage {
  readonly name = 'Tasks & Calendar';
  constructor(page: Page, readonly path = '/activities') {
    super(page);
  }

  async open() {
    await this.page.goto(this.path);
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await expect(at(this.page, XP.tasksTable)).toBeVisible({ timeout: 20_000 });
  }

  async filter(option: string) {
    await act(this.page, () => at(this.page, XP.tasksFilter).selectOption({ label: option }));
  }
  async whose(option: string) {
    await act(this.page, () => at(this.page, XP.tasksWhose).selectOption({ label: option }));
  }
  async search(text: string) {
    await act(this.page, () => at(this.page, XP.tasksSearch).fill(text));
    await this.page.waitForTimeout(600);
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }
  async view(name: 'Tasks' | 'Call log') {
    await act(this.page, () => at(this.page, XP.tasksView(name)).first().click());
  }

  /** Rows of the current table, read by column header (Task / Call, Due / When, Record, …). */
  async rows(): Promise<Record<string, string>[]> {
    const table = at(this.page, XP.tasksTable);
    await expect(table).toBeVisible();
    return table.evaluate(t => {
      const heads = [...t.querySelectorAll('thead th')].map(h => (h as HTMLElement).innerText.trim());
      return [...t.querySelectorAll('tbody tr')].filter(r => r.children.length > 1).map(r => {
        const o: Record<string, string> = { text: (r as HTMLElement).innerText.replace(/\s+/g, ' ').trim() };
        [...r.children].forEach((c, i) => { if (heads[i]) o[heads[i]] = (c as HTMLElement).innerText.trim(); });
        return o;
      });
    });
  }

  /** Rows whose first column holds the subject (exact line). */
  async find(subject: string): Promise<Record<string, string>[]> {
    const all = await this.rows();
    return all.filter(r => Object.values(r)[1]?.split('\n').map(s => s.trim()).includes(subject));
  }

  /** Rows matching `match`, looking through up to `maxPages` pages (20 rows each) with Next. */
  async findOnPages(match: (r: Record<string, string>) => boolean, maxPages = 15): Promise<Record<string, string>[]> {
    for (let p = 0; p < maxPages; p++) {
      const hits = (await this.rows()).filter(match);
      if (hits.length) return hits;
      const next = at(this.page, XP.leadsNext);
      if (!(await next.count()) || (await next.isDisabled())) return [];
      await act(this.page, () => next.click());
    }
    return [];
  }

  async export(): Promise<Sheet> {
    return download(this.page, at(this.page, XP.tasksExport));
  }

  dialog() {
    return new ActivityDialog(this.page);
  }
}

/** Opportunities list (/opportunities), only what the lead tests need. */
export class OpportunitiesPage extends BasePage {
  readonly name = 'Opportunities';
  constructor(page: Page, readonly path = '/opportunities') {
    super(page);
  }
  async open() {
    await this.page.goto(this.path);
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await expect(at(this.page, XP.opportunityRows).first()).toBeVisible({ timeout: 20_000 });
  }
  /** Text of the rows that mention the given text (e.g. a Lead No.), first page (newest first). */
  async rowsWith(text: string): Promise<string[]> {
    return (await at(this.page, XP.opportunityRows).allInnerTexts()).map(r => r.replace(/\s+/g, ' ').trim()).filter(r => r.includes(text));
  }
}
