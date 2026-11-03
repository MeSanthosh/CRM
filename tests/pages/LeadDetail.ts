/**
 * Lead Detail panel: header (Lead No. · name), summary values (PHONE, EMAIL, ASSIGNED…), workflow
 * status, actions (Change Status, Assign Lead, Qualify Lead, Move to Opportunity), score breakdown,
 * histories and the Tasks & Calls block.
 */
import { Page, Locator, expect } from '@playwright/test';
import { Notice, NoticeInfo, pickDate } from './Notice';
import { ActivityDialog } from './ActivityDialog';
import { XP, at } from '../locators';
import { relativeDate } from '../leads-page/test-data';
import { settle } from '../helpers';

export type ActivityItem = { list: 'open' | 'done'; kind: string; subject: string; lines: string[]; notes: string; buttons: string[] };
export type ScoreBreakdown = { computed: number; suggested: string; current: string; items: { name: string; points: number; max: number }[] };

export class LeadDetail {
  readonly notice: Notice;
  constructor(readonly page: Page) {
    this.notice = new Notice(page);
  }

  get root(): Locator {
    return at(this.page, XP.leadDetailPanel);
  }

  async waitOpen() {
    await expect(this.root).toBeVisible({ timeout: 20_000 });
    await expect(this.root).toContainText(/LD-/, { timeout: 45_000 }); // "Loading lead details..." can take a while on QA
  }
  async isOpen() {
    return (await this.root.count()) > 0;
  }

  private async lines(): Promise<string[]> {
    return (await this.root.innerText()).split('\n').map(s => s.trim()).filter(Boolean);
  }

  /** Lead No. from the panel header "LD-… · Name". */
  async leadNo(): Promise<string> {
    const m = (await this.root.innerText()).match(/\b(LD-[A-Z0-9-]+)\s+·/);
    if (!m) throw new Error('Lead No. not found in the Lead Detail header');
    return m[1];
  }
  /** Name from the panel header "LD-… · Name". */
  async headerName(): Promise<string> {
    return ((await this.root.innerText()).match(/\bLD-[A-Z0-9-]+\s+·\s+(.+)/)?.[1] ?? '').trim();
  }

  /**
   * Summary value: a tile (Prospect Type, Title, Phone, Email, Source, Budget) or an item of
   * "Additional Captured Profile Details (Units Interested: 1 · Timeline: 0-3 Months)".
   * value('Assigned') returns the owner from "LD-… · Assigned to <owner>".
   */
  async value(caption: string): Promise<string> {
    if (/^assigned$/i.test(caption)) return this.owner();
    const tile = at(this.page, XP.leadSummaryTile(caption));
    if (await tile.count()) return (await tile.first().innerText()).trim();
    const extra = at(this.page, XP.leadExtraDetails);
    if (await extra.count()) {
      const m = (await extra.first().innerText()).match(new RegExp(`${caption}:\\s*([^·)]+)`, 'i'));
      if (m) return m[1].trim();
    }
    return '';
  }

  /** Owner from the identity line "LD-… · Assigned to <owner>". */
  async owner(): Promise<string> {
    const line = (await at(this.page, XP.leadIdentityLine).first().innerText()).trim();
    return line.match(/Assigned to\s+(.+)$/)?.[1].trim() ?? '';
  }

  /** Status from the pill "Status: Qualified · Score 83". */
  async statusChip(): Promise<string> {
    const pill = (await at(this.page, XP.leadStatusPill).first().innerText()).trim();
    return pill.match(/Status:\s*([^·]+)/)?.[1].trim() ?? '';
  }
  /** Score from the pill "Status: Qualified · Score 83". */
  async scoreShown(): Promise<string> {
    const pill = (await at(this.page, XP.leadStatusPill).first().innerText()).trim();
    return pill.match(/Score\s+(\d+)/)?.[1] ?? '';
  }

  /** Text of a history block: from its heading to the next section heading. */
  async history(heading: 'Status History' | 'Owner History'): Promise<string> {
    const text = await this.historyText(heading);
    const start = text.indexOf(heading);
    if (start < 0) return '';
    const rest = text.slice(start + heading.length);
    const next = rest.search(/\n(Status History|Owner History|Tasks & Calls|Communications)\n/);
    return (next >= 0 ? rest.slice(0, next) : rest).replace(/\s+/g, ' ').trim();
  }
  /**
   * History entries, newest first. Each entry is a date line followed by one or two text lines
   * ("Contacted → Nurturing" + "reason"); they are joined with " · ":
   * { when: "20 OCT 2026, 07:50 · CRM ADMINISTRATOR", text: "Contacted → Nurturing · reason" }.
   */
  /** Panel text once the history block has loaded: it shows "No … recorded yet." until the entries arrive (waits up to 15 s). */
  private async historyText(heading: string): Promise<string> {
    const until = Date.now() + 15_000;
    let text = await this.root.innerText();
    while (Date.now() < until) {
      const i = text.indexOf(heading);
      if (i >= 0 && !/^\s*No [a-z ]+ recorded yet/i.test(text.slice(i + heading.length))) break;
      await this.page.waitForTimeout(1000);
      text = await this.root.innerText();
    }
    return text;
  }
  async historyEntries(heading: 'Status History' | 'Owner History'): Promise<{ when: string; text: string }[]> {
    const text = await this.historyText(heading);
    const start = text.indexOf(heading);
    if (start < 0) return [];
    const rest = text.slice(start + heading.length);
    const next = rest.search(/\n(Status History|Owner History|Tasks & Calls|Communications)\n/);
    const lines = (next >= 0 ? rest.slice(0, next) : rest).split('\n').map(s => s.trim()).filter(Boolean);
    const isDate = (l: string) => /^\d{1,2} [A-Z]{3} \d{4}, \d{2}:\d{2}/.test(l);
    const out: { when: string; text: string }[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (!isDate(lines[i])) continue;
      const body: string[] = [];
      for (let j = i + 1; j < lines.length && !isDate(lines[j]); j++) body.push(lines[j]);
      out.push({ when: lines[i], text: body.join(' · ') });
    }
    return out;
  }

  /** Current status (the "Status: X · Score N" pill). */
  async status(): Promise<string> {
    return this.statusChip();
  }

  /**
   * Workflow Status boxes (stage → DONE / IN PROGRESS / UP NEXT), the Now / Next boxes when shown
   * (qualified, disqualified) and "Next actions": the OPEN FORM cards of an active lead, joined with " | ".
   */
  async workflow(stages: string[]): Promise<Record<string, string>> {
    const lines = await this.lines();
    const start = lines.indexOf('Workflow Status');
    const out: Record<string, string> = {};
    for (const s of stages) {
      const i = lines.indexOf(s, start);
      if (i >= 0) out[s] = lines[i + 1];
    }
    const now = lines.findIndex((l, i) => i > start && l.toUpperCase() === 'NOW');
    const next = lines.findIndex((l, i) => i > start && l.toUpperCase() === 'NEXT');
    out.Now = now >= 0 ? lines[now + 1] : '';
    out.Next = next >= 0 ? lines[next + 1] : '';
    out['Next Actions'] = (await at(this.page, XP.leadNextActions).allTextContents()).map(t => t.replace(/Open Form.*$/i, '').trim()).join(' | ');
    return out;
  }

  /** Clicks Copy link and returns the clipboard (the context needs clipboard permissions). */
  async copyLink(): Promise<string> {
    await this.root.getByRole('button', { name: 'Copy link', exact: true }).click();
    await this.page.waitForTimeout(300);
    return this.page.evaluate(() => navigator.clipboard.readText());
  }

  private control(label: string): Locator {
    return this.root.locator(`xpath=${XP.fieldByLabel(label)}`).first();
  }
  /** The select / textarea / input of a field. */
  input(label: string): Locator {
    return this.control(label).locator('select, textarea, input:not([type=hidden])').first();
  }

  /** Sets a field in the panel by its label: select → option text, date picker → "{today} 10:30", else typed. */
  async set(label: string, value: string) {
    const wrap = this.control(label);
    await expect(wrap, `Field "${label}" in Lead Detail`).toBeVisible();
    if (await wrap.locator(`xpath=${XP.dateTrigger}`).count()) {
      const [date, time] = value.split(/\s+/);
      return pickDate(this.page, wrap, relativeDate(date) ?? new Date(date), time);
    }
    const input = this.input(label);
    if ((await input.evaluate(e => e.tagName)) === 'SELECT') {
      if (value === '') await input.selectOption({ index: 0 });
      else await input.selectOption({ label: value });
    } else await input.fill(value);
  }
  /** Options of a dropdown, without its "Select…" placeholder. */
  async options(label: string): Promise<string[]> {
    // textContent: Chromium gives no innerText for the options of a closed <select>; lists load after the panel opens
    const read = async () => (await this.input(label).locator('option').allTextContents()).map(o => o.trim()).filter(o => !/^Select\b/.test(o));
    return settle(read, o => o.length === 0 || o.some(x => /^Loading/.test(x)), 20_000);
  }
  async selected(label: string) {
    return ((await this.input(label).locator('option:checked').textContent()) ?? '').trim();
  }

  /** Clicks a panel action and returns its pop-up, left open. */
  async press(name: string, submit = false): Promise<NoticeInfo | undefined> {
    await (submit ? at(this.page, XP.leadDetailSubmit(name)) : at(this.page, XP.leadDetailButton(name)).last()).click();
    return this.notice.wait(30_000); // the QA server can be slow to answer under load
  }

  /** Clicks a panel action and waits for its pop-up; confirmations are accepted with `confirm`. */
  private async run(button: Locator, confirm?: string): Promise<NoticeInfo | undefined> {
    await button.click();
    let n = await this.notice.wait(30_000);
    if (n && n.buttons.length > 1) {
      const yes = confirm ?? n.buttons[n.buttons.length - 1];
      await this.notice.close(yes);
      n = await this.notice.wait(30_000);
    }
    if (n) await this.notice.close();
    await this.page.waitForLoadState('networkidle').catch(() => {});
    return n;
  }

  /** Reassign lead (v2.0): "Assign to" + optional "Reason for reassigning", button "Reassign lead". */
  async assign(user: string, reason?: string) {
    await this.set('Assign to', user);
    if (reason !== undefined) await this.set('Reason for reassigning', reason);
    return this.run(at(this.page, XP.leadDetailButton('Reassign lead')).last());
  }
  async assignDisabled() {
    return at(this.page, XP.leadDetailButton('Reassign lead')).last().isDisabled();
  }
  /** Options of "Assign to" that cannot be picked (the current owner). */
  async disabledAssignees(): Promise<string[]> {
    await this.options('Assign to'); // the user list loads after the panel opens
    return (await this.input('Assign to').locator('option:disabled').allTextContents()).map(o => o.trim()).filter(o => !/^Select\b/.test(o));
  }

  async qualify(values: [string, string][]) {
    for (const [label, value] of values) await this.set(label, value);
    return this.run(at(this.page, XP.leadDetailSubmit('Qualify lead')));
  }

  /** Disqualify lead; its confirmation ("Disqualify Lead … Cancel / Disqualify") is accepted with `confirm` (default: the last button). */
  async disqualify(reason: string, remarks: string, confirm?: string) {
    await this.set('Disqualification Reason', reason);
    await this.set('Disqualification Remarks', remarks);
    return this.run(at(this.page, XP.leadDetailButton('Disqualify lead')).last(), confirm);
  }

  /** Reopen Lead (disqualified leads): "Reopen As" + "Status Change Reason". */
  async reopen(status: string, reason: string) {
    await this.set('Reopen As', status);
    await this.set('Status Change Reason', reason);
    return this.run(at(this.page, XP.leadDetailButton('Reopen Lead')).last());
  }

  /** Opens the "Additional Captured Profile Details" and returns its text. */
  async extraDetails(): Promise<string> {
    const toggle = at(this.page, XP.leadExtraDetails).first();
    const label = (await toggle.innerText()).trim();
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    await this.page.waitForTimeout(400);
    const box = await toggle.locator('xpath=..').innerText();
    return `${label}\n${box}`;
  }

  async changeStatus(status: string, reason: string) {
    await this.set('Move Back To', status);
    await this.set('Status Change Reason', reason);
    return this.run(at(this.page, XP.leadDetailButton('Change Status')).last());
  }

  async convert(confirm: string) {
    return this.run(at(this.page, XP.leadDetailButton('Move to Opportunity')).last(), confirm);
  }

  /** Clicks Recalculate Score; returns its pop-up (closed). */
  async recalculate(): Promise<NoticeInfo | undefined> {
    return this.run(at(this.page, XP.leadDetailButton('Recalculate Score')));
  }
  /** Clicks Apply Suggested Rating and waits until the score buttons are enabled again (the rating is saved). */
  async applySuggestedRating() {
    const button = at(this.page, XP.leadDetailButton('Apply Suggested Rating'));
    await button.click();
    const n = await this.notice.wait(5_000);
    if (n) await this.notice.close();
    await expect(button, 'Apply Suggested Rating finished').toBeEnabled({ timeout: 30_000 });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    return n;
  }
  async score(): Promise<string> {
    return this.root.locator('[name=scoreTotal]').inputValue();
  }
  /** "Computed: 5 · Suggested rating: Nurture" and the "Budget Match: 0/25" items around Recalculate Score. */
  async scoreBreakdown(): Promise<ScoreBreakdown> {
    const text = await at(this.page, XP.leadScoreBox).innerText();
    const items = [...text.matchAll(/^\s*([A-Za-z][^:\n]*?):\s*(\d+)\s*\/\s*(\d+)/gm)].map(m => ({ name: m[1].trim(), points: Number(m[2]), max: Number(m[3]) }));
    return { computed: Number(text.match(/Computed:\s*(\d+)/)?.[1] ?? NaN), suggested: text.match(/Suggested rating:\s*([A-Za-z]+)/)?.[1] ?? '',
      current: (text.match(/Current rating:\s*([^·\n]+)/)?.[1] ?? '').trim(), items };
  }

  // ── Tasks & Calls ─────────────────────────────────────────────────────────
  async openActivity(name: 'Log call' | 'Add task' | 'Add meeting'): Promise<ActivityDialog> {
    await at(this.page, XP.activityButton(name)).click();
    const d = new ActivityDialog(this.page);
    await d.waitOpen();
    return d;
  }
  /** Items of the Open tasks and Call log & completed lists. */
  async activities(): Promise<ActivityItem[]> {
    return at(this.page, XP.activities).evaluate(sec => {
      const out: ActivityItem[] = [];
      let list: 'open' | 'done' = 'open';
      for (const el of [...sec.children]) {
        if (el.tagName === 'H5') list = /open/i.test((el as HTMLElement).innerText) ? 'open' : 'done';
        if (el.tagName !== 'UL') continue;
        for (const li of el.querySelectorAll('li.crm-record-activity')) {
          const t = (q: string) => ((li.querySelector(q) as HTMLElement | null)?.innerText ?? '').trim();
          out.push({ list, kind: t('.crm-activity-kind'), subject: t('.crm-activity-subject-button'),
            lines: [...li.querySelectorAll('.crm-muted-text')].map(s => (s as HTMLElement).innerText.trim()),
            notes: t('.crm-record-activity-notes'),
            buttons: [...li.querySelectorAll('.crm-record-activity-actions button')].map(b => (b as HTMLElement).innerText.trim()) });
        }
      }
      return out;
    }) as Promise<ActivityItem[]>;
  }
  async activity(subject: string): Promise<ActivityItem | undefined> {
    return (await this.activities()).find(a => a.subject === subject);
  }
  /**
   * Waits (up to `ms`) until the activity with this subject is in the given state — the list refreshes a
   * moment after a save, Mark done, Reopen or Edit. 'gone' waits until it is no longer listed.
   * Returns the item as last read.
   */
  async waitActivity(subject: string, state: 'open' | 'done' | 'gone', ms = 15_000): Promise<ActivityItem | undefined> {
    return settle(() => this.activity(subject), a => (state === 'gone' ? a !== undefined : a?.list !== state), ms);
  }
  /** Clicks a button (Mark done, Reopen, Edit) on an activity; Edit returns the edit form. */
  async activityAction(subject: string, button: 'Mark done' | 'Reopen' | 'Edit'): Promise<ActivityDialog | undefined> {
    await at(this.page, XP.activityItem(subject)).first().getByRole('button', { name: button, exact: true }).click();
    if (button === 'Edit') {
      const d = new ActivityDialog(this.page);
      await d.waitOpen();
      return d;
    }
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(800);
    return undefined;
  }

  async close() {
    await this.root.getByRole('button', { name: 'Close', exact: true }).first().click();
    await expect(this.root).toHaveCount(0, { timeout: 10_000 });
  }
}
