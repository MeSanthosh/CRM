/**
 * Page object for /brokers-channels ("Channel Management" hub): status summary, live signal cards,
 * Top capture channels, Registered brokers and the module menu. Locator strings come from ../locators.ts (BCH).
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../pages/BasePage';
import { ROUTES, BCH, BC_SIGNALS, BC_MODULES } from '../locators';
import { parseNum } from '../helpers';

export type ModuleCard = { name: string; status: string; description: string; footer: string; href: string | null };

export class BrokersChannelsPage extends BasePage {
  readonly path = ROUTES.brokersChannels;
  readonly name = 'Brokers & Channels';
  readonly signals = BC_SIGNALS;
  readonly modules = BC_MODULES;

  constructor(page: Page) { super(page); }
  private x(xpath: string): Locator { return this.page.locator(`xpath=${xpath}`); }

  /** Opens the page and waits for the signal cards and both mini lists. */
  async open() {
    await super.open();
    await expect(this.x(BCH.signal('Total Brokers'))).toHaveText(/\d/);
    await expect(this.x(BCH.miniList('Registered brokers')).first()).toBeVisible();
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  get intro(): Locator { return this.page.locator(BCH.intro); }
  get openBrokerRegister(): Locator { return this.x(BCH.openBrokerRegister); }

  /** "2 live", "5 partial", "3 planned" → { live: 2, partial: 5, planned: 3 } */
  async summary(): Promise<Record<string, number>> {
    const items = await this.page.locator(BCH.summary).allInnerTexts();
    return Object.fromEntries(items.map(t => { const m = t.trim().match(/^(\d+)\s+(\w+)/)!; return [m[2].toLowerCase(), Number(m[1])]; }));
  }

  async signal(label: string): Promise<number> {
    const v = this.x(BCH.signal(label));
    await expect(v).toHaveText(/\d/);
    return parseNum(await v.innerText());
  }

  /** Rows of a mini list as [left, right] ("Not specified", "310 leads" / broker name, code). */
  async miniList(title: 'Top capture channels' | 'Registered brokers'): Promise<[string, string][]> {
    return this.x(BCH.miniList(title)).evaluateAll(lis => lis.map(li => {
      const s = Array.from(li.querySelectorAll('span')).map(x => (x.textContent ?? '').trim());
      return [s[0] ?? '', s[1] ?? ''] as [string, string];
    }));
  }

  moduleCard(name: string): Locator { return this.x(BCH.moduleCard(name)); }

  async moduleCards(): Promise<ModuleCard[]> {
    return this.page.locator(BCH.moduleCards).evaluateAll(cards => cards.map(c => ({
      name: (c.querySelector('.crm-module-hub-card-head strong')?.textContent ?? '').trim(),
      status: (c.querySelector('.crm-module-hub-status')?.textContent ?? '').trim(),
      description: (c.querySelector('p')?.textContent ?? '').trim(),
      footer: (c.querySelector('small')?.textContent ?? '').trim(),
      href: c.tagName === 'A' ? c.getAttribute('href') : null,
    })));
  }
}
