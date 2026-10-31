/**
 * The app's pop-up messages (.crm-notice-dialog): "Required Fields Missing", "Invalid Entry",
 * "Lead Created", "Duplicate Lead — Blocked", confirmations…, and its custom date / date-time picker.
 */
import { Page, Locator, expect } from '@playwright/test';
import { XP, at } from '../locators';

export type NoticeInfo = { title: string; text: string; kind: 'success' | 'error' | 'info'; buttons: string[] };

export class Notice {
  readonly root: Locator;
  constructor(readonly page: Page) {
    this.root = at(page, XP.notice).last();
  }

  async visible(): Promise<boolean> {
    return this.root.isVisible();
  }

  /** Waits for a pop-up and reads it (undefined when none appears within `ms`). */
  async wait(ms = 15_000): Promise<NoticeInfo | undefined> {
    try {
      await this.root.waitFor({ state: 'visible', timeout: ms });
    } catch {
      return undefined;
    }
    await this.page.waitForTimeout(150); // the text renders just after the frame
    return this.read();
  }

  async read(): Promise<NoticeInfo> {
    const cls = (await this.root.getAttribute('class')) ?? '';
    const title = (await this.root.locator('h3').first().innerText().catch(() => '')).trim();
    const buttons = (await this.root.locator('button').allInnerTexts()).map(b => b.trim());
    const text = (await this.root.innerText()).replace(/\s+/g, ' ').trim();
    return { title, text, buttons, kind: /success/.test(cls) ? 'success' : /error/.test(cls) ? 'error' : 'info' };
  }

  /** Closes the pop-up with the named button (default: the first one, e.g. OK / Cancel / Go back). */
  async close(button?: string) {
    const b = button ? at(this.page, XP.noticeButton(button)).last() : this.root.locator('button').first();
    await b.click();
    await expect(at(this.page, XP.notice)).toHaveCount(0, { timeout: 5_000 }).catch(() => {});
  }

  /** Reads and closes the pop-up if one is open (or appears within `ms`). */
  async dismiss(ms = 0): Promise<NoticeInfo | undefined> {
    const n = ms ? await this.wait(ms) : (await this.visible()) ? await this.read() : undefined;
    if (n) await this.close();
    return n;
  }
}

/**
 * Picks a date (and time "HH:MM") in the app's date picker. `field` is the label.crm-field that holds
 * the picker button.
 */
export async function pickDate(page: Page, field: Locator, date: Date, time?: string) {
  await field.locator(`xpath=${XP.dateTrigger}`).click();
  const pop = at(page, XP.datePopover);
  await expect(pop).toBeVisible();
  await at(page, XP.datePopoverYear).selectOption(String(date.getFullYear()));
  await at(page, XP.datePopoverMonth).selectOption(String(date.getMonth() + 1));
  await at(page, XP.datePopoverDay(date.getDate())).click();
  if (time && (await at(page, XP.datePopoverTime).count())) await at(page, XP.datePopoverTime).fill(time);
  if (await pop.isVisible() && (await at(page, XP.datePopoverSet).count())) await at(page, XP.datePopoverSet).click();
  if (await pop.isVisible()) await page.keyboard.press('Escape');
}
