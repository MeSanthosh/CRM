/**
 * The lead side of UC-OPP-002 / UC-OPP-010: the Leads page tabs, Lead Detail and its
 * "Move to Opportunity" → "Convert lead to opportunity?" → Convert flow.
 */
import { Page, Locator, Response, expect } from '@playwright/test';
import { open } from '../helpers';
import { ROUTES, OPP, XP } from '../locators';

const isLeadList = (r: Response) => /\/api\/v1\/leads\?/.test(r.url()) && r.request().method() === 'GET';

export type LeadRow = { leadNo: string; name: string; status: string; href: string };

export class LeadsConversion {
  constructor(readonly page: Page) {}

  get searchBox(): Locator { return this.page.locator(OPP.leadsSearch); }
  get detail(): Locator { return this.page.locator(`xpath=${OPP.leadDetail}`); }
  get status(): Locator { return this.page.locator(`xpath=${OPP.leadDetailStatus}`); }
  fact(label: string): Locator { return this.page.locator(`xpath=${OPP.leadDetailFact(label)}`); }
  get moveButton(): Locator { return this.detail.getByRole('button', { name: 'Move to Opportunity', exact: true }); }
  get confirmDialog(): Locator { return this.page.locator(OPP.notice); }
  tab(name: string): Locator { return this.page.locator(`xpath=${XP.leadsTab(name)}`); }

  async open() {
    const loaded = this.page.waitForResponse(isLeadList);
    await open(this.page, ROUTES.leads);
    await loaded;
  }

  /** Runs `fn` and waits for the lead list request it triggers (briefly: cached views send none), then for the rows to render. */
  private async reload(fn: () => Promise<unknown>) {
    const done = this.page.waitForResponse(isLeadList, { timeout: 5_000 }).catch(() => null);
    await fn();
    await done;
    await expect(this.page.locator('main table tbody tr').first()).toBeVisible();
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async openTab(name: string) {
    await this.reload(() => this.tab(name).click());
    await expect(this.tab(name), `${name} tab selected`).toHaveAttribute('aria-selected', 'true');
    await this.rowsSettled();
  }

  /** Waits until the lead rows stop changing (the list re-renders after the response arrives). */
  async rowsSettled() {
    let last = '';
    await expect.poll(async () => {
      const now = await this.page.locator('main table tbody').innerText().catch(() => '');
      const same = now === last;
      last = now;
      return same;
    }, { intervals: [300] }).toBe(true);
  }

  /** Count shown on a Leads tab, e.g. "Ready to Convert 162" → 162 (waits for the count to load). */
  async tabCount(name: string): Promise<number> {
    const badge = this.page.locator(`xpath=${XP.leadsTabCount(name)}`);
    await expect(badge).toHaveText(/\d/);
    return Number((await badge.innerText()).replace(/\D/g, ''));
  }

  async search(text: string) {
    await this.reload(() => this.searchBox.fill(text));
  }

  /** Lead rows on the current page. */
  async rows(): Promise<LeadRow[]> {
    return this.page.locator('main table tbody tr').evaluateAll((trs, chip) => trs.filter(tr => tr.querySelector('a.crm-record-link')).map(tr => {
      const a = tr.querySelector('a.crm-record-link')!;
      return {
        leadNo: (a.textContent ?? '').trim(),
        name: (tr.querySelector('.crm-leads-lead-cell strong')?.textContent ?? '').trim(),
        status: (tr.querySelector(chip)?.textContent ?? '').trim(),
        href: a.getAttribute('href') ?? '',
      };
    }), OPP.leadsStatusChip);
  }

  /** "Showing 1–20 of 162 leads · Page 1 of 9" → 162 (hidden when everything fits on one page). */
  async total(): Promise<number> {
    const pager = this.page.locator(OPP.leadsPager);
    if (!(await pager.count())) return (await this.rows()).length;
    const m = (await pager.innerText()).replace(/,/g, '').match(/of\s+(\d+)\s+leads/i);
    return m ? Number(m[1]) : (await this.rows()).length;
  }

  /** Opens a lead from the current list by its number. */
  async openLead(leadNo: string) {
    await this.page.locator('main table tbody a.crm-record-link').filter({ hasText: new RegExp(`^${leadNo}$`) }).click();
    await expect(this.detail, 'Lead Detail opens').toBeVisible();
    await expect(this.detail, 'Lead Detail loaded').toContainText(leadNo, { timeout: 30_000 });
    await expect(this.detail.locator('button.crm-workflow-step').first()).toBeVisible();
  }

  /** Searches all leads for `leadNo` and opens it. */
  async findAndOpen(leadNo: string) {
    await this.open();
    await this.search(leadNo);
    await this.openLead(leadNo);
  }

  async closeDetail() {
    await this.detail.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(this.detail).toHaveCount(0);
  }
}
