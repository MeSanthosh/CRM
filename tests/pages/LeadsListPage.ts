/** Leads module (/leads): its tabs, KPI cards, every row across the pager's pages, and the Lead Detail dialog. */
import { Response, expect } from '@playwright/test';
import { LEADS_ROW, REP_TEXT, REP_XP, ROUTES, XP, at } from '../locators';
import { BasePage } from './BasePage';

export type LeadRow = { leadNo: string; name: string; source: string; status: string; assigned: string };
/** A lead as returned by GET /leads (only the fields the tests read). */
export type LeadApiItem = {
  leadNo: string;
  firstName?: string | null; lastName?: string | null; companyName?: string | null;
  leadSource?: { name: string | null } | null;
  broker?: { name: string | null };
  assignedToUser?: { id: string | null; name: string | null } | null;
  assignedTo?: { name?: string | null; displayName?: string | null } | null;
  preferredProjectCode?: string | null;
  capturedAt?: string | null; createdAt?: string | null;
};
/** What the Lead Detail dialog shows for a lead. */
export type LeadDetail = { leadNo: string; name: string; source: string };

const isList = (r: Response) => r.request().method() === 'GET' && /\/api\/v1\/leads\?/.test(r.url());

export class LeadsListPage extends BasePage {
  readonly path = ROUTES.leads;
  readonly name = 'Leads';

  /** Count on a tab, e.g. "All Leads" → 41. */
  async tabCount(label: string): Promise<number> {
    const badge = at(this.page, XP.leadsTabCount(label));
    await expect(badge, `Tab "${label}" count`).toBeVisible();
    return Number((await badge.innerText()).replace(/[^\d]/g, ''));
  }

  /** "Showing 1–20 of 41 leads · Page 1 of 3" → { total: 41, pages: 3 } (no pager: one page). */
  async pager(): Promise<{ total?: number; pages: number }> {
    const pager = at(this.page, XP.leadsPager);
    if (!(await pager.count())) return { pages: 1 };
    const text = await pager.first().innerText();
    return { total: Number(text.match(/of\s+([\d,]+)\s+leads/)?.[1]?.replace(/,/g, '')), pages: Number(text.match(/Page\s+\d+\s+of\s+(\d+)/)?.[1] ?? 1) };
  }

  /** Rows on the current page. */
  async pageRows(): Promise<LeadRow[]> {
    return at(this.page, XP.leadsTableRows).evaluateAll((trs, sel) => trs.map(tr => {
      const t = (s: string) => (tr.querySelector(s)?.textContent ?? '').replace(/\s+/g, ' ').trim();
      return { leadNo: t(sel.leadNo), name: t(sel.name), source: t(sel.source), status: t(sel.status), assigned: t(sel.assigned) };
    }).filter(r => r.leadNo), LEADS_ROW);
  }

  /**
   * Opens the Leads module and reads every page of a tab ("All Leads" by default). Also returns the GET /leads
   * items those pages loaded (owner, project and dates that the list does not show), one per lead.
   */
  async allLeads(tab: string = REP_TEXT.allLeadsTab): Promise<{ rows: LeadRow[]; api: LeadApiItem[] }> {
    const api = new Map<string, LeadApiItem>();
    let collecting = tab === REP_TEXT.allLeadsTab;
    const collect = async (r: Response) => {
      if (!collecting || !isList(r) || /openOnly=|idleDaysMin=/.test(r.url())) return;
      try { for (const item of (await r.json()).items ?? []) api.set(item.leadNo, item); } catch { /* not JSON */ }
    };
    this.page.on('response', collect);
    try {
      await this.open();
      if (!collecting) {
        const resp = this.page.waitForResponse(isList, { timeout: 30_000 }).catch(() => null);
        collecting = true;
        await at(this.page, XP.leadsTab(tab)).click();
        await expect(at(this.page, XP.leadsTab(tab)), `Tab "${tab}" selected`).toHaveAttribute('aria-selected', 'true');
        await resp;
        await this.page.waitForLoadState('networkidle').catch(() => {});
      }
      const count = await this.tabCount(tab);
      if (count) await expect(at(this.page, XP.leadsTableRows).first(), `"${tab}" rows`).toBeVisible({ timeout: 20_000 });
      const { pages } = await this.pager();
      const rows: LeadRow[] = [...(await this.pageRows())];
      for (let p = 2; p <= pages; p++) {
        const first = (await this.pageRows())[0]?.leadNo; // the page has changed once its first row changes
        const resp = this.page.waitForResponse(isList, { timeout: 30_000 }).catch(() => null);
        await at(this.page, XP.leadsNext).click();
        await resp;
        await expect.poll(async () => (await this.pageRows())[0]?.leadNo, { message: `Page ${p} loaded` }).not.toBe(first);
        rows.push(...(await this.pageRows()));
      }
      expect(rows.length, `Leads read from "${tab}" = its tab count`).toBe(count);
      // the listener parses responses asynchronously: wait until every listed lead has its item
      const listed = new Set(rows.map(r => r.leadNo));
      await expect.poll(() => [...listed].filter(n => !api.has(n)).length,
        { message: `GET /leads data for all ${listed.size} leads listed in "${tab}"`, timeout: 15_000 }).toBe(0);
      // keep only the items of the leads the tab lists (other list calls on the page may load more)
      return { rows, api: [...api.values()].filter(a => listed.has(a.leadNo)) };
    } finally {
      this.page.off('response', collect);
    }
  }

  /** Lead ID, name and Source from the open Lead Detail dialog ("LD-2026-0037 · Sebastian Weber"). */
  async detail(): Promise<LeadDetail> {
    const subtitle = at(this.page, REP_XP.leadDetailSubtitle);
    await expect(at(this.page, REP_XP.leadDetail), 'Lead Detail dialog').toBeVisible({ timeout: 20_000 });
    await expect(subtitle, 'Lead Detail loaded').toContainText('·');
    const [leadNo, ...name] = (await subtitle.innerText()).split('·').map(s => s.trim());
    const source = (await at(this.page, REP_XP.leadDetailTile(REP_TEXT.leadDetail.source)).innerText()).trim();
    return { leadNo, name: name.join(' · '), source };
  }
}
