/**
 * Log Call / New Task / New Meeting form and its Edit variant (Edit Call / Edit Task …), opened from a
 * record's Tasks & Calls block or from the Tasks & Calendar page. Fields are addressed by their label.
 */
import { Page, Locator, expect } from '@playwright/test';
import { Notice, pickDate } from './Notice';
import { XP, at } from '../locators';

export class ActivityDialog {
  constructor(readonly page: Page) {}

  get root(): Locator {
    return at(this.page, XP.activityDialog);
  }

  async waitOpen() {
    await expect(this.root).toBeVisible({ timeout: 15_000 });
    // the user lists load after the form opens ("Loading..." until then)
    await expect(this.root.locator('option', { hasText: /^\s*Loading/ })).toHaveCount(0, { timeout: 20_000 });
    await expect(this.root.locator('option', { hasText: '(' })).not.toHaveCount(0, { timeout: 20_000 });
  }
  async isOpen() {
    return (await at(this.page, XP.activityDialog).count()) > 0 && this.root.isVisible();
  }

  async title() {
    return (await this.root.locator('h3, h2').first().innerText()).trim();
  }
  /** "Linked to LD-… · Name" line under the title. */
  async linkedTo() {
    return ((await this.root.innerText()).split('\n').find(l => l.startsWith('Linked to')) ?? '').trim();
  }

  /** The <label> wrapping a field, by the start of its caption ("Subject *" → "Subject"). */
  field(label: string): Locator {
    const re = new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\*?`);
    return this.root.locator('label').filter({ hasText: re }).first();
  }
  control(label: string): Locator {
    return this.field(label).locator('select, textarea, input:not([type=hidden])').first();
  }

  /** Selects by option text; "(me)" picks the signed-in user's option ("CRM Administrator (me)"). */
  async select(label: string, option: string) {
    const sel = this.control(label);
    if (option.startsWith('(')) {
      const texts = await sel.locator('option').allTextContents();
      const hit = texts.find(t => t.includes(option));
      if (!hit) throw new Error(`No option containing "${option}" in ${label}`);
      return sel.selectOption({ label: hit });
    }
    return sel.selectOption({ label: option });
  }
  // textContent: Chromium gives no innerText for the options of a closed <select>
  async selected(label: string) {
    return ((await this.control(label).locator('option:checked').textContent()) ?? '').trim();
  }
  async options(label: string) {
    return (await this.control(label).locator('option').allTextContents()).map(o => o.trim());
  }
  async fill(label: string, value: string) {
    await this.control(label).fill(value);
  }
  async value(label: string) {
    return this.control(label).inputValue();
  }
  /** Types key by key (so input filters apply) and returns what the field then holds. */
  async type(label: string, value: string) {
    const el = this.control(label);
    await el.fill('');
    await el.pressSequentially(value);
    return el.inputValue();
  }
  async tick(label: string, on = true) {
    const box = this.field(label).locator('input[type=checkbox]');
    if (on) await box.check();
    else await box.uncheck();
  }
  async hasDateField(name: string) {
    return (await at(this.page, XP.activityDateField(name)).count()) > 0;
  }
  /** Date + time ("HH:MM") of a date field by its input name: occurredAt, dueAt, followUpDueAt. */
  async setDate(name: string, date: Date, time: string) {
    await pickDate(this.page, at(this.page, XP.activityDateField(name)), date, time);
  }
  /** Shown value of a date field, e.g. "22 Oct 2026, 10:00". */
  async dateText(name: string) {
    return (await at(this.page, XP.activityDateField(name)).locator('button').first().innerText()).trim();
  }
  /** Stored value of a date field (yyyy-mm-ddThh:mm). */
  async dateValue(name: string) {
    return at(this.page, XP.activityDateField(name)).locator('input[type=hidden]').inputValue();
  }
  /**
   * Opens the picker of a date field on the month of `days[0]`, reads whether each day is disabled,
   * then picks `pickAfter` (a day that can be chosen) so the picker closes. Returns day → disabled.
   */
  async dayStates(name: string, days: Date[], pickAfter: Date, time: string): Promise<boolean[]> {
    const wrap = at(this.page, XP.activityDateField(name));
    await wrap.locator(`xpath=${XP.dateTrigger}`).click();
    await expect(at(this.page, XP.datePopover)).toBeVisible();
    const states: boolean[] = [];
    for (const d of days) {
      await at(this.page, XP.datePopoverYear).selectOption(String(d.getFullYear()));
      await at(this.page, XP.datePopoverMonth).selectOption(String(d.getMonth() + 1));
      states.push((await at(this.page, XP.datePopoverDay(d.getDate())).getAttribute('aria-disabled')) === 'true');
    }
    await at(this.page, XP.datePopoverYear).selectOption(String(pickAfter.getFullYear()));
    await at(this.page, XP.datePopoverMonth).selectOption(String(pickAfter.getMonth() + 1));
    await at(this.page, XP.datePopoverDay(pickAfter.getDate())).click();
    if (await at(this.page, XP.datePopoverTime).count()) await at(this.page, XP.datePopoverTime).fill(time);
    if (await at(this.page, XP.datePopoverSet).count()) await at(this.page, XP.datePopoverSet).click();
    return states;
  }

  async errors(): Promise<string[]> {
    return (await at(this.page, XP.activityFieldErrors).allInnerTexts()).map(e => e.trim());
  }

  /** Clicks the form's save button (Log call / Save / Save changes); returns true when the form closed. */
  async save(): Promise<boolean> {
    await this.root.getByRole('button', { name: /^(Log call|Save|Save changes)$/ }).last().click();
    await this.page.waitForTimeout(500);
    try {
      await expect(at(this.page, XP.activityDialog)).toHaveCount(0, { timeout: 8_000 });
      await this.page.waitForLoadState('networkidle').catch(() => {});
      return true;
    } catch {
      return false;
    }
  }
  async saveLabel() {
    return (await this.root.getByRole('button', { name: /^(Log call|Save|Save changes)$/ }).last().innerText()).trim();
  }
  /** Cancel; a "discard changes?" pop-up (form with data) is answered with `confirm` (default: its last button). */
  async cancel(confirm?: string) {
    return this.leave(this.root.getByRole('button', { name: 'Cancel', exact: true }), confirm);
  }
  /** Close (×); same as cancel. */
  async close(confirm?: string) {
    return this.leave(this.root.getByRole('button', { name: 'Close', exact: true }).first(), confirm);
  }
  private async leave(button: Locator, confirm?: string) {
    await button.click();
    const notice = new Notice(this.page);
    const asked = await notice.wait(2_000);
    if (asked) await notice.close(confirm ?? asked.buttons[asked.buttons.length - 1]);
    await expect(at(this.page, XP.activityDialog)).toHaveCount(0, { timeout: 8_000 });
    return asked;
  }
}
