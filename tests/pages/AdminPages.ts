/**
 * Admin & Governance: the Business Rules page (one engine at a time) and the small helpers used by Currency Master,
 * Reference Data and Preferences. The registers themselves use ModulePage. Locators come from locators.ts.
 */
import { Page, Locator, expect } from '@playwright/test';
import { XP, at } from '../locators';
import { coverOf } from './PricingMatrixPage';

const clean = (s: string) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Clicks; when something lies on top (reminder cards), clicks with a DOM event instead. */
export async function press(loc: Locator) {
  if (await coverOf(loc).catch(() => '')) await loc.dispatchEvent('click'); else await loc.click();
  await loc.page().waitForLoadState('networkidle').catch(() => {});
  await loc.page().waitForTimeout(500);
}
export const mainLines = async (page: Page) => (await page.locator('main').innerText()).split('\n').map(s => s.trim()).filter(Boolean);
/** Toast or pop-up shown now ('' when none). */
export const shownMessage = (page: Page) => page.evaluate(() => [...document.querySelectorAll('.crm-app-toast, .crm-notice-dialog, [role=alert]')]
  .map(e => (e as HTMLElement).innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | '));

export class BusinessRulesPage {
  constructor(readonly page: Page, readonly route: string) {}

  async open(engine: string) {
    await this.page.goto(`${this.route}?engine=${engine}`);
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await expect(this.page.locator('main button.crm-configuration-engine-button.is-active'), `Engine ${engine} opens`).toBeVisible({ timeout: 30_000 });
    await this.page.waitForTimeout(800);
  }
  async engineNames(): Promise<string[]> {
    return (await this.page.locator('main button.crm-configuration-engine-button').allInnerTexts()).map(clean);
  }
  lines() { return mainLines(this.page); }
  async version(word: string) {
    const text = (await this.lines()).find(l => l.startsWith(`${word} `)) ?? '';
    return { text, number: Number((text.match(/\d+/) ?? ['NaN'])[0]) };
  }
  /**
   * A field: "label:Match Mode" (first field of that label), "number:0" / "text:0" (n-th field of that type),
   * "check:Mask personal data" (check box by its label), "rowcheck:First name" (check box of a table row),
   * "rownum:HOT:1" / "rowtext:HOT" (n-th number / the text field of a table row).
   */
  control(spec: string): Locator {
    const [kind, ...rest] = spec.split(':');
    const key = rest.join(':');
    if (kind === 'label') return at(this.page, XP.admField(key)).first();
    if (kind === 'check') return at(this.page, XP.admCheck(key)).first();
    const row = (t: string) => this.page.locator('main table tbody tr').filter({ hasText: t }).first();
    if (kind === 'rowcheck') return row(key).locator('input[type=checkbox]').first();
    if (kind === 'rownum') return row(rest[0]).locator('input[type=number]').nth(Number(rest[1] ?? 0));
    if (kind === 'rowtext') return row(key).locator('input:not([type=number]):not([type=checkbox])').first();
    // text inputs often have no type attribute
    const css = kind === 'text' ? 'main input:not([type]), main input[type=text]' : `main input[type=${kind}]`;
    return this.page.locator(css).filter({ visible: true }).nth(Number(key));
  }
  async read(spec: string): Promise<string> {
    return this.control(spec).evaluate(e => e.tagName === 'SELECT' ? ((e as HTMLSelectElement).selectedOptions[0]?.textContent ?? '').trim()
      : (e as HTMLInputElement).type === 'checkbox' ? String((e as HTMLInputElement).checked) : (e as HTMLInputElement).value);
  }
  async write(spec: string, value: string) {
    const c = this.control(spec);
    if ((await c.evaluate(e => (e as HTMLInputElement).type)) === 'checkbox') {
      if (String(await c.isChecked()) !== value) await c.evaluate(e => (e as HTMLInputElement).click());
    } else if ((await c.evaluate(e => e.tagName)) === 'SELECT') await c.selectOption({ label: value });
    else { await c.fill(value); await c.blur().catch(() => {}); }
    await this.page.waitForTimeout(250);
  }
  /** Applies a change of the data ("to:value", "+1", "-1", "&suffix") and returns the value typed. */
  async change(spec: string, change: string): Promise<string> {
    const now = await this.read(spec);
    const v = change.startsWith('to:') ? change.slice(3) : change.startsWith('&') ? `${now}${change.slice(1)}` : String(Number(now) + Number(change));
    await this.write(spec, v);
    return v;
  }
  /** All visible numeric inputs. */
  async numbers(): Promise<number[]> {
    return this.page.locator('main input[type=number]').filter({ visible: true }).evaluateAll(es => es.map(e => Number((e as HTMLInputElement).value)));
  }
  button(name: string) { return this.page.locator('main').getByRole('button', { name, exact: true }).first(); }

  private fields() { return this.page.locator('main input:not([type=search]), main select, main textarea').filter({ visible: true }); }
  /** Every visible field of the open engine, in page order (select: its value; check box: checked). */
  async snapshot(): Promise<string[]> {
    return this.fields().evaluateAll(es => es.map(e => (e as HTMLInputElement).type === 'checkbox' ? String((e as HTMLInputElement).checked) : (e as HTMLInputElement).value));
  }
  /** Puts a snapshot back. Dropdowns first, because they show or hide other fields. */
  async applySnapshot(snap: string[]) {
    const tags = await this.fields().evaluateAll(es => es.map(e => e.tagName));
    for (const [i, t] of tags.entries()) if (t === 'SELECT') await this.fields().nth(i).selectOption(snap[i]).catch(() => {});
    await this.page.waitForTimeout(300);
    for (let i = 0; i < snap.length; i++) {
      const f = this.fields().nth(i);
      const [tag, type] = await f.evaluate(e => [e.tagName, (e as HTMLInputElement).type]);
      if (tag === 'SELECT') continue;
      if (type === 'checkbox') { if (String(await f.isChecked()) !== snap[i]) await f.evaluate(e => (e as HTMLInputElement).click()); continue; }
      if ((await f.inputValue()) !== snap[i]) { await f.fill(snap[i]); await f.blur().catch(() => {}); }
    }
    await this.page.waitForTimeout(250);
  }
  /** Publishes the open engine and fails with the app's message when the server does not accept it. */
  async publish(publishButton: string): Promise<void> {
    const b = this.button(publishButton);
    await expect(b, 'Publish can be pressed (the values on the form are valid)').toBeEnabled({ timeout: 10_000 });
    const answer = this.page.waitForResponse(r => !['GET', 'HEAD', 'OPTIONS'].includes(r.request().method()) && r.url().includes('/api/') && !/\/auth\//.test(r.url()), { timeout: 60_000 });
    await press(b);
    const r = await answer;
    expect(r.status(), `Publish accepted (${await shownMessage(this.page)})`).toBeLessThan(300);
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }
  /**
   * Publishes `changes` ([field, value]) on an engine, runs `fn`, and in every case publishes the original values again
   * and verifies them. The engine's values are read before anything is changed.
   */
  async withRule<T>(engine: string, publishButton: string, changes: [string, string][], fn: () => Promise<T>, tab: () => Promise<void> = async () => {}): Promise<T> {
    const openIt = async () => { await this.open(engine); await tab(); }; // tab: an engine whose fields sit on tabs shows only one tab's fields
    await openIt();
    const original = await this.snapshot();
    try {
      for (const [f, v] of changes) await this.write(f, v);
      await this.publish(publishButton);
      return await fn();
    } finally {
      await openIt();
      await this.applySnapshot(original);
      await this.publish(publishButton);
      await openIt();
      expect(await this.snapshot(), `${engine}: original rule published again`).toEqual(original);
    }
  }
}
