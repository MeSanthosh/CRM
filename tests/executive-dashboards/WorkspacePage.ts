/**
 * My Smart Workspace (/): welcome line, Today strip (Mine / Team, task cards), Frequent Modules and Reports decks (slider,
 * Customize window), AI Lead Magnet panel. Task ticks, Ask AI and reminder buttons are never clicked.
 */
import type { Locator, Page, Response } from '@playwright/test';
import { expect } from '../auth';
import { EXD, at } from '../locators';
import { S } from './shared';

export type DeckCard = { step: string; title: string; link: string; href: string; num: string; unit: string; sub: string };
export type Deck = { title: string; badge: string; customize: string; cards: DeckCard[]; root: Locator };

export class WorkspacePage {
  readonly replies: { url: string; status: number; method: string }[] = [];
  readonly errors: string[] = [];
  constructor(readonly page: Page) {
    page.on('response', (r: Response) => { if (/\/api\/v1\//.test(r.url())) this.replies.push({ url: r.url().replace(/^.*\/api\/v1/, ''), status: r.status(), method: r.request().method() }); });
    page.on('pageerror', e => this.errors.push(String(e).slice(0, 300)));
  }
  get main() { return this.page.locator('main'); }

  async open() {
    await this.page.goto(S('Workspace Route'));
    await this.ready();
  }
  async ready() {
    await expect(this.page.locator(EXD.workspace)).toBeVisible({ timeout: 30_000 });
    await expect(this.page.locator(EXD.tasksCounts)).toContainText(/\d/, { timeout: 30_000 });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(500);
  }

  async text(sel: string) { return (await this.page.locator(sel).first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim(); }
  /** "11 overdue · 114 due today" → { overdue, today } */
  async counts(): Promise<{ text: string; overdue: number; today: number }> {
    const text = await this.text(EXD.tasksCounts);
    const n = (re: RegExp) => Number((text.match(re) ?? ['', 'NaN'])[1].replace(/,/g, ''));
    return { text, overdue: n(/([\d,]+)\s*overdue/i), today: n(/([\d,]+)\s*due today/i) };
  }
  async scope(name: string) {
    const answer = this.page.waitForResponse(r => /activities\/summary/.test(r.url()), { timeout: 15_000 }).catch(() => undefined);
    await at(this.page, EXD.scopeButton(name)).click();
    const r = await answer;
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(800);
    return r;
  }
  async taskCards(): Promise<{ tag: string; name: string; sub: string; check: string }[]> {
    return this.page.locator(EXD.taskCard).evaluateAll((cs, s) => cs.map(c => ({
      tag: (c.querySelector(s.tag) as HTMLElement | null)?.innerText.trim() ?? '',
      name: (c.querySelector(s.name) as HTMLElement | null)?.innerText.trim() ?? '',
      sub: (c.querySelector(s.sub) as HTMLElement | null)?.innerText.trim() ?? '',
      check: c.querySelector(s.check)?.getAttribute('aria-label') ?? '',
    })), { tag: EXD.taskTag, name: EXD.taskName, sub: EXD.taskSub, check: EXD.taskCheck });
  }
  async tasksLink() { const l = this.page.locator(EXD.tasksLink).first(); return { text: (await l.innerText()).trim(), href: (await l.getAttribute('href')) ?? '' }; }

  /** Both decks: [0] Frequent Modules, [1] Reports. */
  async decks(): Promise<Deck[]> {
    const roots = await this.page.locator(EXD.deckSection).all();
    const out: Deck[] = [];
    for (const root of roots) {
      const cards = await root.locator(EXD.deckCard).evaluateAll((cs, s) => cs.map(c => {
        const q = (sel: string) => (c.querySelector(sel) as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').trim() ?? '';
        const a = c.querySelector(`${s.quick}`) as HTMLAnchorElement | null;
        return { step: q(s.step), title: q(s.title), link: q(s.quick), href: a?.getAttribute('href') ?? a?.closest('a')?.getAttribute('href') ?? '', num: q(s.num), unit: q(s.unit), sub: q(s.sub) };
      }), { step: EXD.deckStep, quick: EXD.deckQuick, title: EXD.deckCardTitle, num: EXD.deckNum, unit: EXD.deckUnit, sub: EXD.deckSub });
      out.push({ title: (await root.locator(EXD.deckTitle).first().innerText()).trim(), badge: (await root.locator(EXD.deckBadge).first().innerText()).trim(),
        customize: (await root.locator(EXD.deckCustomize).first().innerText().catch(() => '')).trim(), cards, root });
    }
    return out;
  }
  /** "Showing 2–4 of 4 pinned" → { from, to, of } */
  static badge(text: string) {
    const m = text.match(/(\d+)\s*[–-]\s*(\d+)\s*of\s*(\d+)/);
    return m ? { from: +m[1], to: +m[2], of: +m[3] } : { from: NaN, to: NaN, of: NaN };
  }
  /** A deck card by its title, also when it is on a later slide. */
  async findCard(deck: number, title: string): Promise<DeckCard | undefined> {
    for (let i = 0; i < 10; i++) {
      const d = (await this.decks())[deck];
      const c = d.cards.find(x => x.title === title);
      if (c) return c;
      const next = d.root.locator(EXD.deckSlide('Next'));
      if (await next.isDisabled().catch(() => true)) return undefined;
      await next.click();
      await this.page.waitForTimeout(300);
    }
  }
  /** Every card of a deck, sliding through it (and back to the start). */
  async allCards(deck: number): Promise<DeckCard[]> {
    const seen = new Map<string, DeckCard>();
    for (let i = 0; i < 10; i++) {
      const d = (await this.decks())[deck];
      for (const c of d.cards) seen.set(`${c.step}|${c.title}`, c);
      const next = d.root.locator(EXD.deckSlide('Next'));
      if (await next.isDisabled().catch(() => true)) break;
      await next.click();
      await this.page.waitForTimeout(300);
    }
    for (let i = 0; i < 10; i++) {
      const prev = (await this.decks())[deck].root.locator(EXD.deckSlide('Prev'));
      if (await prev.isDisabled().catch(() => true)) break;
      await prev.click();
      await this.page.waitForTimeout(200);
    }
    return [...seen.values()];
  }

  // ── Customize window ──
  customizeWindow() { return this.page.locator(EXD.customize).first(); }
  async openCustomize() {
    await at(this.page, EXD.wsButton(S('Customize Button'))).click();
    await expect(this.customizeWindow()).toBeVisible();
    return this.customizeWindow();
  }
  /** Items of the open Customize tab: name, line under it, pinned or not. */
  async customizeItems(): Promise<{ name: string; detail: string; pinned: boolean; button: string }[]> {
    return this.customizeWindow().locator(EXD.customizeItem).evaluateAll((bs, s) => bs.map(b => ({
      name: (b.querySelector(s.name) as HTMLElement | null)?.innerText.trim() ?? '',
      detail: (b.querySelector(s.sub) as HTMLElement | null)?.innerText.trim() ?? '',
      pinned: b.classList.contains('is-pinned'),
      button: (b as HTMLElement).innerText.split(/\n/).pop()?.trim() ?? '',
    })), { name: EXD.customizeItemName, sub: EXD.customizeItemSub });
  }
  async customizeTab(prefix: string) { await this.customizeWindow().locator(EXD.customizeTab, { hasText: prefix }).first().click(); await this.page.waitForTimeout(400); }
  async customizeTabs() { return (await this.customizeWindow().locator(EXD.customizeTab).allInnerTexts()).map(s => s.trim()); }
  /** Pins or unpins an item; returns the status of the save request. */
  async togglePin(name: string) {
    const item = this.customizeWindow().locator(EXD.customizeItem).filter({ has: this.page.locator(EXD.customizeItemName, { hasText: new RegExp(`^${name.replace(/[&()]/g, m => `\\${m}`)}$`) }) }).first();
    const saved = this.page.waitForResponse(r => /preferences\/my-workspace/.test(r.url()) && r.request().method() !== 'GET', { timeout: 15_000 }).catch(() => undefined);
    await item.click();
    const r = await saved;
    await this.page.waitForTimeout(500);
    return r?.status();
  }
  async closeCustomize() {
    const done = this.customizeWindow().getByRole('button', { name: S('Done Button'), exact: true });
    if (await done.count()) await done.last().click(); else await this.customizeWindow().locator(EXD.customizeClose).click();
    await expect(this.page.locator(EXD.customize)).toHaveCount(0, { timeout: 10_000 });
  }

  // ── AI panel ──
  async aiPanel() {
    const p = this.page.locator(EXD.aiPanel);
    if (!(await p.isVisible().catch(() => false))) return undefined;
    const signals = await p.locator('.crm-sw-ai-sig').evaluateAll(es => es.map(e => ({
      label: (e.querySelector('.crm-sw-ai-sig-lbl') as HTMLElement | null)?.innerText.trim() ?? '', value: (e.querySelector('.crm-sw-ai-sig-val') as HTMLElement | null)?.innerText.trim() ?? '' })));
    return { fit: await this.text(EXD.aiFit), count: await this.text(EXD.aiCount), title: await this.text(EXD.aiTitle),
      scenarios: (await this.page.locator(EXD.aiScenario).allInnerTexts()).map(s => s.trim()),
      active: (await this.page.locator(`${EXD.aiScenario}.is-active`).first().innerText().catch(() => '')).trim(), signals };
  }
}
