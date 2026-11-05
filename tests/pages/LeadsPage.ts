/**
 * Leads page (/leads): tabs, KPI cards, filters, search, the leads table, and the entry points to
 * the Create Individual / Create Corporate forms and the Lead Detail panel.
 */
import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { LeadForm } from './LeadForm';
import { LeadDetail } from './LeadDetail';
import { act, listCount, tabBadge, kpi, settle } from '../helpers';
import { XP, at, LEADS_TABS } from '../locators';
import type { Form } from '../leads-page/test-data';

export type LeadRow = {
  name: string; leadNo: string; type: string; phone: string; email: string; source: string;
  status: string; rating: string; score: string; captured: string; assigned: string;
};

/** Counts the HLUC-03 tests compare before and after an action (names = Count Changes columns). */
export type CountSnapshot = Record<string, number>;
export const CARD_LABELS = ['Total Leads', 'Assigned', 'Qualified', 'Disqualified'];

export class LeadsPage extends BasePage {
  readonly path = '/leads';
  readonly name = 'Leads';

  constructor(page: Page) {
    super(page);
  }

  /** Opens a tab by its route (from the Tab Rules sheet) and waits for the list. */
  async openRoute(route = this.path) {
    await this.page.goto(route);
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await expect(at(this.page, XP.leadsTable)).toBeVisible({ timeout: 20_000 });
  }

  async clickTab(tab: string) {
    await act(this.page, () => at(this.page, XP.leadsTab(tab)).click());
  }

  /** Number on a tab, e.g. "My Leads" → 606 */
  async tabCount(tab: string): Promise<number> {
    return (await tabBadge(this.page, tab)).value;
  }

  card(label: string): Promise<number> {
    return kpi(this.page, label);
  }

  /** Formula line under a card, e.g. Assigned → "Total (311) − Unassigned (14)" (build v2.0). */
  async cardFormula(label: string): Promise<string> {
    // clickable cards are buttons; AVG SCORE (build CAITer8U) is a plain article card
    const p = this.page.locator(`xpath=${XP.leadsKpiCard(label)}/p | //main//article[contains(@class,'crm-card')][h3[normalize-space()=${JSON.stringify(label)}]]/p`).first();
    return (await p.count()) ? (await p.innerText()).replace(/\s+/g, ' ').trim() : '';
  }

  /** Tab labels above the list, without their counts ("All Leads 41" → "All Leads"). */
  async tabLabels(): Promise<string[]> {
    return (await this.page.locator(`xpath=//main//a[contains(@class,'crm-leads-tab')]`).allInnerTexts()).map(t => t.replace(/\s*\d+\s*$/, '').replace(/\s+/g, ' ').trim());
  }

  async clickCard(label: string) {
    await act(this.page, () => at(this.page, XP.leadsKpiCard(label)).click());
  }

  /** Total in the pager ("Showing 1–20 of N leads"), or the rows when everything fits on one page. */
  listed(): Promise<number> {
    return listCount(this.page);
  }

  /** One-line description under the heading, e.g. "My Leads · Leads assigned to you." */
  async description(): Promise<string> {
    return (await at(this.page, XP.leadsPageDescription).innerText()).trim();
  }

  async search(text: string) {
    const box = at(this.page, XP.leadsSearch);
    const matches = async () => {
      const rows = await this.rows().catch(() => []);
      return rows.every(r => JSON.stringify(r).toLowerCase().replace(/\s/g, '').includes(text.toLowerCase().replace(/\s/g, '')));
    };
    for (let attempt = 0; attempt < 3; attempt++) {
      await act(this.page, () => box.fill(text));
      await this.page.waitForTimeout(500); // the list filters after a short typing pause
      await this.page.waitForLoadState('networkidle').catch(() => {});
      // a tab that finishes loading after the search was typed can reset the box or the list: type it again
      if ((await box.inputValue()) === text && (await settle(matches, ok => !ok, 8_000))) return;
    }
  }

  async filterStatus(status: string | null) {
    const sel = at(this.page, XP.leadsStatusFilter);
    await act(this.page, () => (status === null ? sel.selectOption({ index: 0 }) : sel.selectOption({ label: status })));
    if (status === null) return;
    // the list re-renders a moment after the response: read counts only once every row shows the status (or none is left)
    await expect.poll(async () => {
      const shown = await this.rows().catch(() => []);
      return shown.every(r => r.status === status);
    }, { message: `List shows only "${status}" leads`, timeout: 15_000 }).toBeTruthy();
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async statusOptions(): Promise<string[]> {
    return (await at(this.page, XP.leadsStatusFilter).locator('option').allInnerTexts()).slice(1).map(s => s.trim());
  }

  async typeChip(name: 'All' | 'Individual' | 'Corporate') {
    await act(this.page, () => at(this.page, XP.leadsTypeChip(name)).click());
  }

  /** Clicks a sortable column header; returns the arrow it then shows (▲ / ▼). */
  async sortBy(column: string): Promise<string> {
    const h = at(this.page, XP.leadsSortHeader(column));
    await act(this.page, () => h.click());
    return (await h.innerText()).replace(column, '').trim();
  }

  /** Rows of the current page, read by column header. */
  async rows(): Promise<LeadRow[]> {
    const table = at(this.page, XP.leadsTable);
    await expect(table).toBeVisible();
    return table.evaluate(t => {
      const heads = [...t.querySelectorAll('thead th')].map(h => (h as HTMLElement).innerText.replace(/[↕▲▼]/g, '').trim());
      const col = (cells: Element[], name: string) => (cells[heads.indexOf(name)] as HTMLElement | undefined)?.innerText.trim() ?? '';
      return [...t.querySelectorAll('tbody tr')].filter(r => r.querySelector('a.crm-record-link')).map(r => {
        const cells = [...r.children];
        const lead = (cells[heads.indexOf('Lead')] as HTMLElement).innerText.split('\n').map(s => s.trim()).filter(Boolean);
        const contact = col(cells, 'Phone / Email').split('\n').map(s => s.trim()).filter(Boolean);
        // since build CAITer8U the Type column is an icon; its tooltip holds "Individual" / "Corporate"
        const typeCell = cells[heads.indexOf('Type')] as HTMLElement | undefined;
        const type = typeCell?.querySelector('[title]')?.getAttribute('title')?.trim() || col(cells, 'Type');
        return { name: lead[0] ?? '', leadNo: r.querySelector('a.crm-record-link')!.textContent!.trim(), type,
          phone: contact[0] ?? '', email: contact[1] ?? '', source: col(cells, 'Source'), status: col(cells, 'Status'), rating: col(cells, 'Rating'),
          score: col(cells, 'Score'), captured: col(cells, 'Captured'), assigned: col(cells, 'Assigned') };
      });
    });
  }

  /** Pager text, e.g. "Showing 21–40 of 41 leads · Page 2 of 3" (without the buttons). */
  async pagerText(): Promise<string> {
    return (await at(this.page, XP.leadsPager).first().innerText()).replace(/\s+/g, ' ').trim();
  }

  /** What covered the pager button on the last turnPage() (e.g. the reminder cards), '' when it could be clicked. */
  coveredBy = '';

  /**
   * Clicks Next / Previous and waits until the pager changes. Returns false when the button is disabled.
   * When something lies on top of the button (build 0411-16: the reminder cards at the bottom right), that is kept
   * in `coveredBy` and the button is pressed with the keyboard instead, so the paging can still be checked.
   */
  async turnPage(dir: 'Next' | 'Previous'): Promise<boolean> {
    const btn = at(this.page, dir === 'Next' ? XP.leadsNext : XP.leadsPrev);
    if (await btn.isDisabled()) return false;
    const before = await this.pagerText();
    await btn.evaluate(b => b.scrollIntoView({ block: 'center' }));
    this.coveredBy = await btn.evaluate(b => {
      const r = b.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !top || b.contains(top) ? '' : `${top.tagName.toLowerCase()}.${String(top.className).split(' ')[0]} "${(top as HTMLElement).innerText.trim().slice(0, 40)}"`;
    });
    await act(this.page, () => (this.coveredBy ? btn.press('Enter') : btn.click()));
    await expect.poll(() => this.pagerText(), { message: `Pager changes after ${dir}`, timeout: 15_000 }).not.toBe(before);
    return true;
  }

  async pagerButtonDisabled(dir: 'Next' | 'Previous'): Promise<boolean> {
    return at(this.page, dir === 'Next' ? XP.leadsNext : XP.leadsPrev).isDisabled();
  }

  /** S.No. column of the rows on this page ("01", "02" … → 1, 2 …). */
  async serialNumbers(): Promise<number[]> {
    return at(this.page, XP.leadsTable).evaluate(t => {
      const heads = [...t.querySelectorAll('thead th')].map(h => (h as HTMLElement).innerText.trim());
      const i = heads.indexOf('S.No.');
      return [...t.querySelectorAll('tbody tr')].filter(r => r.querySelector('a.crm-record-link')).map(r => Number((r.children[i] as HTMLElement)?.innerText.trim()));
    });
  }

  /** Ticks / unticks "Select all leads on this page", or the box of one lead. */
  async select(what: 'all' | string, on = true) {
    const box = at(this.page, what === 'all' ? XP.leadsSelectAll : XP.leadsSelectRow(what));
    await (on ? box.check() : box.uncheck());
  }

  /** Lead Nos. whose row box is ticked. */
  async selectedLeads(): Promise<string[]> {
    return at(this.page, XP.leadsTable).evaluate(t => [...t.querySelectorAll('tbody tr')]
      .filter(r => (r.querySelector('input[type=checkbox]') as HTMLInputElement | null)?.checked)
      .map(r => r.querySelector('a.crm-record-link')?.textContent?.trim() ?? ''));
  }

  /** The selection bar shown while rows are ticked ("20 selected Assign Change status …"), or '' when hidden. */
  async bulkBar(): Promise<string> {
    const bar = at(this.page, XP.leadsBulkBar);
    return (await bar.count()) && (await bar.isVisible()) ? (await bar.innerText()).replace(/\s+/g, ' ').trim() : '';
  }

  async bulkButton(name: string) {
    await act(this.page, () => at(this.page, XP.leadsBulkButton(name)).click());
  }

  /** Clicks a lead's pencil button (Act. column) and returns the edit form. */
  async editLead(leadNo: string, form: Form): Promise<LeadForm> {
    const btn = at(this.page, XP.leadsEditButton(leadNo));
    await btn.evaluate(b => b.scrollIntoView({ block: 'center' }));
    this.coveredBy = await btn.evaluate(b => {
      const r = b.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !top || b.contains(top) ? '' : `${top.tagName.toLowerCase()}.${String(top.className).split(' ')[0]} "${(top as HTMLElement).innerText.trim().slice(0, 40)}"`;
    });
    await (this.coveredBy ? btn.press('Enter') : btn.click());
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await expect(at(this.page, XP.leadForm), 'Edit form opens').toBeVisible({ timeout: 20_000 });
    return new LeadForm(this.page, form);
  }

  /** Searches for a lead (by email, mobile, name or Lead No.) and returns the matching rows. */
  async find(text: string): Promise<LeadRow[]> {
    await this.search(text);
    if ((await this.listed()) === 0) return [];
    return this.rows();
  }

  /** Name of the signed-in user, from the user menu (initials / name / role). */
  async signedInUser(): Promise<string> {
    const lines = (await at(this.page, XP.userMenu).innerText()).split('\n').map(s => s.trim()).filter(s => s && s !== '▾');
    return lines.length >= 2 ? lines[1] : lines[0];
  }

  /** Opens the create form from the "Individual" / "Corporate" button. */
  async startCreate(form: Form): Promise<LeadForm> {
    await at(this.page, XP.leadsCreate(form === 'Individual' ? 'individual' : 'corporate')).click();
    const f = new LeadForm(this.page, form);
    await f.waitOpen();
    return f;
  }

  /** Opens a lead's detail panel from its Lead No. link (searching for it first). */
  async openLead(leadNo: string): Promise<LeadDetail> {
    await this.openRoute(this.path); // a fresh list: no panel or pop-up left over the table
    await this.search(leadNo);
    await this.page.locator('a.crm-record-link', { hasText: leadNo }).first().click();
    const d = new LeadDetail(this.page);
    await d.waitOpen();
    return d;
  }

  /** Every tab count plus the four cards on All Leads (fresh page load each time). */
  async snapshot(): Promise<CountSnapshot> {
    await this.openRoute(this.path);
    const s: CountSnapshot = {};
    for (const t of LEADS_TABS) s[t] = await this.tabCount(t);
    for (const c of CARD_LABELS) s[`${c} card`] = await this.card(c);
    return s;
  }
}
