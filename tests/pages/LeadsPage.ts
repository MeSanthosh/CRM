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
    const p = at(this.page, XP.leadsKpiCard(label)).locator('p').first();
    return (await p.count()) ? (await p.innerText()).replace(/\s+/g, ' ').trim() : '';
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
        return { name: lead[0] ?? '', leadNo: r.querySelector('a.crm-record-link')!.textContent!.trim(), type: col(cells, 'Type'),
          phone: contact[0] ?? '', email: contact[1] ?? '', source: col(cells, 'Source'), status: col(cells, 'Status'), rating: col(cells, 'Rating'),
          score: col(cells, 'Score'), captured: col(cells, 'Captured'), assigned: col(cells, 'Assigned') };
      });
    });
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
