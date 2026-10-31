/**
 * Leads → Insights → Sources (/leads/sources): cards, the "By source" table and the drill-down list of a source.
 */
import { Page, expect } from '@playwright/test';
import { XP, at } from '../locators';
import { kpi, tabBadge, parseNum } from '../helpers';

export type SourceRow = { source: string; total: number; qualified: number; converted: number; unassigned: number; qualPct: number; convPct: number; text: string };
export type DrillLead = { lead: string; contact: string; source: string; owner: string; text: string };

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const pct = (s: string) => Number(s.replace('%', '').trim());

export class LeadInsightsPage {
  constructor(readonly page: Page, readonly route: string) {}

  async open() {
    await this.page.goto(this.route);
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await expect(at(this.page, XP.insightsSourceRows).first()).toBeVisible({ timeout: 20_000 });
  }
  async text() {
    return clean(await this.page.locator('main').innerText());
  }
  async card(label: string) {
    return kpi(this.page, label);
  }
  async tabCount(name: string) {
    return (await tabBadge(this.page, name)).value;
  }
  async subTabs(names: string[]) {
    const out: string[] = [];
    for (const n of names) if (await at(this.page, XP.leadsSubTab(n)).count()) out.push(n);
    return out;
  }
  async headers(xp = XP.insightsSourceHeaders) {
    return (await at(this.page, xp).allInnerTexts()).map(h => clean(h.replace(/[↕▲▼]/g, '')));
  }
  /** Rows of "By source". */
  async sources(): Promise<SourceRow[]> {
    const rows = await at(this.page, XP.insightsSourceRows).evaluateAll(trs => trs.map(tr => [...tr.querySelectorAll('td')].map(td => (td as HTMLElement).innerText.trim())));
    return rows.map(c => ({
      source: c[0], total: Number(c[1]), qualified: Number(c[2]), converted: Number(c[3]), unassigned: Number(c[4]),
      qualPct: pct(c[5]), convPct: pct(c[6]), text: c.join(' | '),
    }));
  }
  async source(name: string): Promise<SourceRow | undefined> {
    return (await this.sources()).find(r => r.source === name);
  }
  async refresh(button: string) {
    await this.page.locator('main').getByRole('button', { name: button, exact: true }).click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(1000);
  }
  /** Clicks a source row (again = clears the list). */
  async clickSource(name: string) {
    await at(this.page, XP.insightsSourceRows).filter({ has: this.page.locator('td', { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first().click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(800);
  }
  /** "Leads N matching" → N (NaN when the list is not shown). */
  async drillCount(word: string): Promise<number> {
    const m = (await this.text()).match(new RegExp(`Leads\\s+(\\d+)\\s+${word}`));
    return m ? Number(m[1]) : NaN;
  }
  async pagerTotal(): Promise<number> {
    const p = at(this.page, XP.pagerText).first();
    return (await p.count()) ? Number((await p.innerText()).match(/ of (\d+)/)?.[1] ?? NaN) : NaN;
  }
  /** Every lead of the drill-down list (follows Next). */
  async drillLeads(): Promise<DrillLead[]> {
    const heads = await this.headers(XP.insightsDrillHeaders);
    const col = (n: string) => heads.indexOf(n);
    const all: DrillLead[] = [];
    for (let guard = 0; guard < 30; guard++) {
      const rows = await at(this.page, XP.insightsDrillRows).evaluateAll(trs => trs.map(tr => [...tr.querySelectorAll('td')].map(td => (td as HTMLElement).innerText.trim())));
      for (const c of rows) all.push({ lead: (c[col('Lead')] ?? '').split('\n')[0], contact: c[col('Contact')] ?? '', source: c[col('Source')] ?? '', owner: c[col('Owner')] ?? '', text: c.join(' | ') });
      const next = at(this.page, XP.pagerNext).first();
      if (!(await next.count()) || !(await next.isEnabled())) break;
      const pager = await at(this.page, XP.pagerText).first().innerText();
      const firstLead = (rows[0]?.[1] ?? '').split('\n')[0];
      await next.click();
      // the pager moves first ("Showing 21–40 …"), the rows a moment later: wait for both
      await expect.poll(() => at(this.page, XP.pagerText).first().innerText(), { timeout: 15_000 }).not.toBe(pager);
      await expect.poll(async () => ((await at(this.page, XP.insightsDrillRows).first().locator('td').nth(1).innerText().catch(() => '')).split('\n')[0]), { timeout: 15_000 }).not.toBe(firstLead);
    }
    return all;
  }
}

export { parseNum };
