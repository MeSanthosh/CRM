/**
 * Inventory → Pricing Matrix (build 0411-16): the 2-layer matrix (views, filters, search, summary line, export),
 * the unit breakdown window, Business Rules → Unit Pricing Matrix Rules (rule tabs, Live Simulator) and the
 * Sales section of the unit window opened by a row's Edit. Locators come from locators.ts.
 */
import { Page, Locator, expect } from '@playwright/test';
import { XP, at } from '../locators';
import { download, Sheet } from '../helpers';
import { UnitView } from './SalesPages';

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "$856,800" / "+$16,800" / "-$1.2k" / "$1.25M" / "856,800 USD" → number (NaN when there is none). */
export function money(s: string): number {
  const m = (s ?? '').replace(/,/g, '').match(/([+-])?\s*\$?\s*([+-])?(\d+(?:\.\d+)?)\s*([kKmMbB])?(?![a-z])/);
  if (!m) return NaN;
  const sign = m[1] === '-' || m[2] === '-' ? -1 : 1;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[4] ?? '').toLowerCase() as 'k' | 'm' | 'b'] ?? 1;
  return sign * Number(m[3]) * mult;
}
/** "+2%" / "-2%" / "Partial Ocean View (+4%)" / "0%" → number; "-" or no % → 0 when `dashIsZero`, else NaN. */
export function pct(s: string, dashIsZero = true): number {
  const m = (s ?? '').match(/([+-]?\d+(?:\.\d+)?)\s*%/);
  if (m) return Number(m[1]);
  return dashIsZero && /^\s*[-–—]?\s*$/.test(s ?? '') ? 0 : NaN;
}
/** "Partial Ocean View (+4%)" → "Partial Ocean View" */
export const nameOf = (s: string) => clean((s ?? '').replace(/\([^)]*%\)\s*$/, ''));

/** Who lies on top of an element's centre ('' when it is the element itself). */
export async function coverOf(loc: Locator): Promise<string> {
  await loc.evaluate(b => b.scrollIntoView({ block: 'center', inline: 'center' }));
  return loc.evaluate(b => {
    const r = b.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !top || b.contains(top) || top.contains(b) ? '' : `${top.tagName.toLowerCase()}.${String(top.className).split(' ')[0]} "${((top as HTMLElement).innerText ?? '').trim().replace(/\s+/g, ' ').slice(0, 50)}"`;
  });
}

/** Write requests (POST / PUT / PATCH / DELETE to /api/) the page sends, with their status. */
export function watchWrites(page: Page) {
  const writes: { method: string; url: string; status: number; body: string }[] = [];
  page.on('response', r => {
    const m = r.request().method();
    if (!r.url().includes('/api/') || ['GET', 'HEAD', 'OPTIONS'].includes(m) || /\/auth\//.test(r.url())) return;
    writes.push({ method: m, url: new URL(r.url()).pathname, status: r.status(), body: (r.request().postData() ?? '').slice(0, 2000) });
  });
  return writes;
}

export type PMRow = { code: string; cells: Record<string, string>; titles: Record<string, string> };
export type PMHeader = { groups: { name: string; span: number }[]; columns: string[] };

export class PricingMatrixPage {
  /** Things found lying on top of buttons pressed by `press()` (button → what covered it). */
  readonly covered: Record<string, string> = {};
  constructor(readonly page: Page, readonly route: string, readonly tab: string) {}

  get table() { return at(this.page, XP.pmTable); }

  async open() {
    await this.page.goto(this.route);
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await at(this.page, XP.pageTab(this.tab)).first().click();
    await expect(at(this.page, XP.pmRows).first(), 'Pricing Matrix rows load').toBeVisible({ timeout: 30_000 });
    await expect(this.table.locator('tbody'), 'Pricing Matrix finished loading').not.toHaveText(/^\s*Loading/i, { timeout: 60_000 });
    await this.stable();
  }

  /** Waits until the rows stop changing (filters, views and searches re-render in the browser) and are no longer loading. */
  async stable(ms = 600) {
    let last = '';
    for (let i = 0; i < 40; i++) {
      const now = await this.table.evaluate(t => `${t.querySelectorAll('tbody tr').length}|${(t.querySelector('tbody') as HTMLElement)?.innerText.length}|${(t.querySelector('thead') as HTMLElement)?.innerText}`).catch(() => '');
      const loading = await this.table.evaluate(t => /^\s*loading/i.test((t.querySelector('tbody') as HTMLElement)?.innerText ?? '')).catch(() => true);
      if (now && now === last && !loading) return;
      last = now;
      await this.page.waitForTimeout(ms);
    }
  }

  /** Clicks a button; when something lies on top of it, records that and clicks it with a DOM event instead. */
  async press(loc: Locator, what: string) {
    const cover = await coverOf(loc);
    if (cover) { this.covered[what] = cover; await loc.dispatchEvent('click'); } else await loc.click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async view(name: string) {
    const b = at(this.page, XP.pmView(name));
    if ((await b.getAttribute('aria-pressed')) !== 'true') await this.press(b, `view ${name}`);
    await expect(b, `${name} selected`).toHaveAttribute('aria-pressed', 'true');
    await this.stable();
  }
  async viewPressed(name: string) {
    return (await at(this.page, XP.pmView(name)).getAttribute('aria-pressed')) === 'true';
  }

  async header(): Promise<PMHeader> {
    return this.table.evaluate(t => {
      const trs = [...t.querySelectorAll('thead tr')];
      const txt = (e: Element) => (e as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
      return {
        groups: trs.length > 1 ? [...trs[0].children].map(c => ({ name: txt(c), span: (c as HTMLTableCellElement).colSpan })) : [],
        columns: [...trs[trs.length - 1].children].map(txt),
      };
    });
  }

  /** Every row shown, keyed by column header, with each cell's tooltip (title) as well. */
  async rows(): Promise<PMRow[]> {
    return this.table.evaluate(t => {
      const trs = [...t.querySelectorAll('thead tr')];
      const cols = [...trs[trs.length - 1].children].map(c => (c as HTMLElement).innerText.replace(/\s+/g, ' ').trim());
      // a single cell is the loading / empty-state line ("Loading unit pricing matrix...", "No units found …"), not a unit
      return [...t.querySelectorAll('tbody tr')].filter(r => r.querySelectorAll('td').length > 1).map(r => {
        const tds = [...r.querySelectorAll('td')];
        const cells: Record<string, string> = {}, titles: Record<string, string> = {};
        tds.forEach((td, i) => {
          const k = cols[i] ?? `#${i}`;
          cells[k] = (td as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
          titles[k] = td.getAttribute('title') || td.querySelector('[title]')?.getAttribute('title') || '';
        });
        return { code: cells[cols[0]] ?? '', cells, titles };
      });
    });
  }

  /** The one-cell line shown instead of rows ('' when units are listed). */
  async emptyText(): Promise<string> {
    return this.table.evaluate(t => { const r = [...t.querySelectorAll('tbody tr')]; return r.length === 1 && r[0].querySelectorAll('td').length === 1 ? (r[0] as HTMLElement).innerText.trim() : ''; });
  }
  async summary(start: string, label: string): Promise<string> {
    return clean(await at(this.page, XP.pmSummary(start, label)).first().innerText());
  }

  filter(label: string) { return at(this.page, XP.pmFilter(label)); }
  async filterOptions(label: string): Promise<string[]> {
    return (await this.filter(label).locator('option').allTextContents()).map(clean);
  }
  async filterValue(label: string) {
    return clean((await this.filter(label).locator('option:checked').textContent()) ?? '');
  }
  /** Chooses a filter option by its text (or its position) and waits for the rows. */
  async choose(label: string, option: string | number) {
    const f = this.filter(label);
    const cover = await coverOf(f);
    if (cover) this.covered[`filter ${label}`] = cover;
    await f.selectOption(typeof option === 'number' ? { index: option } : { label: option });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.stable();
  }
  async resetFilters(labels: string[]) {
    for (const l of labels) if ((await this.filter(l).evaluate(s => (s as HTMLSelectElement).selectedIndex)) !== 0) await this.choose(l, 0);
  }

  async search(text: string, placeholder: string) {
    const box = at(this.page, XP.searchBox(placeholder));
    await box.fill(text);
    await this.page.waitForTimeout(400);
    await this.stable();
  }

  async export(button: string): Promise<Sheet> {
    return download(this.page, this.page.locator('main').getByRole('button', { name: button, exact: true }).first());
  }

  rowButton(code: string, name: string) { return at(this.page, XP.pmRowButton(code, name)).first(); }
  unitCode(code: string) { return at(this.page, XP.pmUnitCode(code)).first(); }
  button(name: string) { return this.page.locator('main').getByRole('button', { name, exact: true }).first(); }

  /** Opens the breakdown of a unit (with its ⊞ Breakdown button, or its unit code) and returns its lines. */
  async breakdown(code: string, title: string, via: { button?: string } = {}): Promise<Breakdown> {
    if (!(await this.table.isVisible().catch(() => false))) await this.open();
    const b = via.button ? this.rowButton(code, via.button) : this.unitCode(code);
    await this.press(b, via.button ? `${via.button} of ${code}` : `unit code ${code}`);
    const w = new Breakdown(this.page, title);
    await expect(w.root, `Breakdown of ${code} opens`).toBeVisible({ timeout: 15_000 });
    return w;
  }

  /** Row Edit → unit window (opens on Sales). The app shows the Units tab behind the window, so the matrix is opened again when needed. */
  async editUnit(code: string, button: string): Promise<UnitSales> {
    if (!(await this.table.isVisible().catch(() => false))) await this.open();
    await this.press(this.rowButton(code, button), `${button} of ${code}`);
    const u = new UnitSales(this.page);
    await expect(u.view.root, `Unit window of ${code} opens`).toBeVisible({ timeout: 20_000 });
    await u.ready(code);
    return u;
  }
}

export class Breakdown {
  constructor(readonly page: Page, readonly title: string) {}
  get root() { return at(this.page, XP.pmBreakdown(this.title)); }
  async lines(): Promise<string[]> {
    return (await this.root.innerText()).split('\n').map(s => s.trim()).filter(Boolean);
  }
  /** Value on the line after a caption (captions start with the given text). */
  static after(lines: string[], caption: string): string {
    const i = lines.findIndex(l => l.toLowerCase().startsWith(caption.toLowerCase()));
    return i >= 0 ? lines[i + 1] ?? '' : '';
  }
  async close(how: 'button' | 'x' | 'escape', closeButton = 'Close') {
    if (how === 'escape') await this.page.keyboard.press('Escape');
    else if (how === 'x') await this.root.locator('button[aria-label="Close modal"]').first().click();
    else await this.root.getByRole('button', { name: closeButton, exact: true }).last().click();
    await expect(this.root, `Breakdown closes (${how})`).toBeHidden({ timeout: 10_000 });
  }
}

/** Unit window opened from the Pricing Matrix: its sections and the Sales section in view / edit mode. */
export class UnitSales {
  readonly view: UnitView;
  constructor(readonly page: Page) { this.view = new UnitView(page); }

  /** Unit code in the window heading. */
  async title(): Promise<string> {
    return clean(await this.view.root.evaluate(m => ((m.closest('[role=dialog]') ?? m).querySelector('h3') as HTMLElement | null)?.innerText ?? ''));
  }
  /** Waits until the window shows the unit (it shows "Create Unit" for a moment while the unit loads). */
  async ready(code: string) {
    await expect.poll(() => this.title(), { message: `Unit window shows ${code}`, timeout: 20_000 }).toBe(code);
    await this.page.waitForTimeout(500);
  }
  /** Currency of the window ("Amounts in USD"). */
  async currency(): Promise<string> {
    return this.view.root.evaluate(m => {
      const box = [...(m.closest('[role=dialog]') ?? m).querySelectorAll('*')].find(e => /^Amounts in/.test((e as HTMLElement).innerText ?? '') && e.querySelector('strong'));
      return (box?.querySelector('strong') as HTMLElement | undefined)?.innerText.trim() ?? '';
    });
  }
  /** Section buttons in the order shown, with their state word ("Identification" → "OPEN"). */
  async sectionList(): Promise<{ name: string; state: string }[]> {
    return this.view.root.locator('button').evaluateAll(bs => bs.map(b => (b as HTMLElement).innerText.replace(/\s+/g, ' ').trim())
      .map(t => t.match(/^(.*\S)\s+(OPEN|VIEW|EDIT|EDITING)$/)).filter(Boolean).map(m => ({ name: m![1], state: m![2] })));
  }
  async lines(): Promise<string[]> {
    return (await this.view.root.innerText()).split('\n').map(s => s.trim()).filter(Boolean);
  }
  async open(section: string): Promise<string[]> { return this.view.open(section); }

  field(name: string) { return this.view.root.locator(`xpath=${XP.unitFieldIn(name)}`).first(); }
  button(name: string) { return this.view.root.locator(`xpath=${XP.unitButtonIn(name)}`).first(); }
  async edit(button: string) {
    await this.button(button).click();
    await expect(this.button(button), 'Section switches to edit mode').toBeHidden({ timeout: 10_000 }).catch(() => {});
    await this.page.waitForTimeout(600);
  }
  /** Values of the edit-mode fields by name (checkbox → "true"/"false", select → option text). */
  async values(names: string[]): Promise<Record<string, string>> {
    return this.view.root.evaluate((root, ns) => Object.fromEntries(ns.map(n => {
      const e = root.querySelector(`[name="${n}"]`) as HTMLInputElement | HTMLSelectElement | null;
      if (!e) return [n, '(missing)'];
      if ((e as HTMLInputElement).type === 'checkbox') return [n, String((e as HTMLInputElement).checked)];
      if (e.tagName === 'SELECT') return [n, ((e as HTMLSelectElement).selectedOptions[0]?.textContent ?? '').trim()];
      return [n, e.value];
    })), names);
  }
  async set(name: string, value: string) {
    const f = this.field(name);
    const tag = await f.evaluate(e => `${e.tagName}:${(e as HTMLInputElement).type}`);
    if (tag.startsWith('SELECT')) {
      const opts = (await f.locator('option').allTextContents()).map(clean);
      const hit = opts.find(o => o === value) ?? opts.find(o => o.startsWith(value));
      if (!hit) throw new Error(`Option "${value}" not in ${name}: ${opts.join(' | ')}`);
      await f.selectOption({ label: hit });
    } else if (tag.endsWith('checkbox')) await f.setChecked(value === 'true');
    else { await f.fill(''); if (value) await f.pressSequentially(value); }
    await f.blur().catch(() => {});
    await this.page.waitForTimeout(200);
  }
  /** Saves the section; returns the write requests sent and the message shown (toast / pop-up / field errors). */
  async save(button: string, writes: { method: string; url: string; status: number }[], waitMs: number) {
    const from = writes.length;
    await this.button(button).click();
    const until = Date.now() + waitMs;
    // a save is done when a write came back, a message appeared, or the form left edit mode
    while (Date.now() < until) {
      await this.page.waitForTimeout(500);
      if (writes.length > from && writes.slice(from).every(w => w.status > 0)) break;
      if (await this.message()) break;
    }
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(1200);
    return { writes: writes.slice(from), message: await this.message(), editing: await this.button(button).isVisible().catch(() => false) };
  }
  /** Toast, pop-up or field error shown now ('' when none). */
  async message(): Promise<string> {
    return this.page.evaluate(() => {
      const sel = '.crm-app-toast, .crm-notice-dialog, .crm-field-error, .crm-inline-error, .crm-error-text, [role=alert]';
      const t = [...document.querySelectorAll(sel)].map(e => (e as HTMLElement).innerText.replace(/\s+/g, ' ').trim()).filter(Boolean);
      const inv = [...document.querySelectorAll('.crm-unit-detail-modal input:invalid, .crm-unit-detail-modal select:invalid')].map(e => (e as HTMLInputElement).validationMessage).filter(Boolean);
      return [...new Set([...t, ...inv])].join(' | ');
    });
  }
  async dismissMessages() {
    for (const b of await this.page.locator('.crm-notice-dialog button, .crm-app-toast button').all()) await b.click().catch(() => {});
    await this.page.waitForTimeout(300);
  }
  /** Closes the window; answers "Discard changes?" with the discard button. */
  async close(closeButton: string, discard: string) {
    await this.button(closeButton).click().catch(async () => { await this.page.keyboard.press('Escape'); });
    const d = this.page.getByRole('button', { name: new RegExp(`^${esc(discard)}`) }).first();
    if (await d.isVisible({ timeout: 1500 }).catch(() => false)) await d.click();
    await expect(this.view.root, 'Unit window closes').toBeHidden({ timeout: 10_000 });
  }
}

/** Business Rules → Unit Pricing Matrix Rules: rule tabs, their tables and fields, and the Live Simulator. */
export class PricingRulesPage {
  constructor(readonly page: Page) {}
  async tab(name: string) {
    await at(this.page, XP.rulesTab(name)).first().click();
    await this.page.waitForTimeout(700);
  }
  async tabNames(names: string[]): Promise<string[]> {
    const out: string[] = [];
    for (const n of names) if (await at(this.page, XP.rulesTab(n)).count()) out.push(n);
    return out;
  }
  /** Table of the current tab: headers and every row (input values instead of empty cells). */
  async table(): Promise<{ headers: string[]; rows: string[][] }> {
    return at(this.page, XP.rulesTable).evaluate(t => ({
      headers: [...t.querySelectorAll('thead th')].map(h => (h as HTMLElement).innerText.replace(/\s+/g, ' ').trim()),
      rows: [...t.querySelectorAll('tbody tr')].map(r => [...r.querySelectorAll('td')].map(td => {
        const i = td.querySelector('input, select') as HTMLInputElement | null;
        return i ? i.value : (td as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
      })),
    }));
  }
  field(label: string) { return at(this.page, XP.rulesField(label)).first(); }
  async value(label: string): Promise<string> {
    const f = this.field(label);
    return f.evaluate(e => e.tagName === 'SELECT' ? ((e as HTMLSelectElement).selectedOptions[0]?.textContent ?? '').trim() : (e as HTMLInputElement).type === 'checkbox' ? String((e as HTMLInputElement).checked) : (e as HTMLInputElement).value);
  }
  async options(label: string): Promise<string[]> {
    return (await this.field(label).locator('option').allTextContents()).map(clean);
  }
  /** Simulator input: a select by option number ("1", "last") or text, an input by value. */
  async simulate(label: string, value: string) {
    const f = this.field(label);
    if ((await f.evaluate(e => e.tagName)) === 'SELECT') {
      const opts = await this.options(label);
      const i = value === 'last' ? opts.length - 1 : /^\d+$/.test(value) ? Math.min(Number(value), opts.length) - 1 : opts.findIndex(o => o.startsWith(value));
      await f.selectOption({ index: i });
      return opts[i];
    }
    await f.fill(value);
    await f.blur().catch(() => {});
    await this.page.waitForTimeout(300);
    return value;
  }
  async lines(): Promise<string[]> {
    return (await this.page.locator('main').innerText()).split('\n').map(s => s.trim()).filter(Boolean);
  }
  button(name: string) { return at(this.page, XP.rulesButton(name)).first(); }
  /** "Version 3 · Draft: PUBLISHED · Published 05 Nov 2026, 23:28" */
  async version(word: string): Promise<{ text: string; number: number }> {
    const text = (await this.lines()).find(l => l.startsWith(word)) ?? '';
    return { text, number: Number((text.match(/\d+/) ?? ['NaN'])[0]) };
  }
  /** Types a value into the input of a rule row (1. Base Rates: by product code). */
  async setRow(first: string, value: string) {
    const i = at(this.page, XP.rulesRowInput(first)).first();
    await i.fill(value);
    await i.blur().catch(() => {});
    await this.page.waitForTimeout(300);
  }
  async rowValue(first: string) { return at(this.page, XP.rulesRowInput(first)).first().inputValue(); }
}
