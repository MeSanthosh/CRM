/**
 * Page objects shared by the Inventory, Proposals and SPA / Sales Contracts suites:
 *  - ModulePage   a module page with KPI cards, tabs, a register table, pager and search
 *  - ModalForm    the top-most modal form (New Project / Product / Unit / Proposal / Contract, payment plan)
 *  - RecordPanel  a record detail panel (Opportunity / Reservation / Proposal / Contract Detail)
 *  - UnitPicker   "Choose Unit" dialog
 *  - CustomerKyc  Customers → Edit Customer → Documents & KYC
 *  - PipelineBoard  Opportunities → Board (columns, filters, move menus)
 * Selectors come from locators.ts; values come from the suites' TestData files.
 */
import { Page, Locator, expect } from '@playwright/test';
import { XP, at } from '../locators';
import { Notice, NoticeInfo, pickDate } from './Notice';
import { kpiText, parseNum, settle } from '../helpers';
import { relativeDate } from '../leads-page/test-data';
import * as XLSX from 'xlsx';

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

export type RegisterRow = { cells: Record<string, string>; text: string; lines: string[]; row: Locator };

// ── Module page ──────────────────────────────────────────────────────────────
export class ModulePage {
  readonly notice: Notice;
  constructor(readonly page: Page, readonly route: string) {
    this.notice = new Notice(page);
  }
  async open(route = this.route) {
    await this.page.goto(route);
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await expect(this.page.locator('main')).toBeVisible();
    await at(this.page, XP.registerRows).first().waitFor({ timeout: 20_000 }).catch(() => {});
  }
  /** Eyebrow, title and currency line under the header bar, e.g. "INVENTORY | Projects and Units | All amounts in". */
  async title() {
    const lines = (await this.page.locator('main').innerText()).split('\n').map(s => s.trim()).filter(Boolean);
    const user = lines.indexOf('▾'); // end of the header bar (user menu)
    return clean(lines.slice(user + 1, user + 6).join(' | '));
  }
  async kpiText(label: string) {
    return kpiText(this.page, label);
  }
  /** KPI value; a real 0 is allowed (the helper waits a few seconds for a non-zero value first). */
  async kpi(label: string) {
    return parseNum(await kpiText(this.page, label));
  }
  async tab(name: string) {
    await at(this.page, XP.pageTab(name)).first().click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await at(this.page, XP.registerRows).first().waitFor({ timeout: 10_000 }).catch(() => {});
  }
  async tabNames(candidates: string[]) {
    const out: string[] = [];
    for (const c of candidates) if (await at(this.page, XP.pageTab(c)).count()) out.push(c);
    return out;
  }
  async headers(): Promise<string[]> {
    return (await at(this.page, XP.registerHeaders).allInnerTexts()).map(h => clean(h.replace(/[↕▲▼]/g, '')));
  }
  /** Rows of the register on the current page: header → cell text (lines joined with " | "). */
  async rows(): Promise<RegisterRow[]> {
    const heads = await this.headers();
    const rows = at(this.page, XP.registerRows);
    const n = await rows.count();
    const out: RegisterRow[] = [];
    for (let i = 0; i < n; i++) {
      const row = rows.nth(i);
      const cells = await row.locator('td').allInnerTexts();
      if (cells.length === 1 && heads.length > 1) continue; // "No units found." placeholder row
      const rec: Record<string, string> = {};
      heads.forEach((h, j) => { rec[h] = (cells[j] ?? '').split('\n').map(s => s.trim()).filter(Boolean).join(' | '); });
      const text = await row.innerText();
      out.push({ cells: rec, text: clean(text), lines: text.split('\n').map(s => s.trim()).filter(Boolean), row });
    }
    return out;
  }
  /** Every row of the register, following Next until the last page. */
  async allRows(): Promise<RegisterRow[]> {
    const all: RegisterRow[] = [];
    for (let guard = 0; guard < 50; guard++) {
      const before = await this.pagerText();
      const rows = await this.rows();
      all.push(...rows);
      const next = at(this.page, XP.pagerNext).first();
      if (!(await next.count()) || !(await next.isEnabled())) break;
      const sigBefore = rows.map(r => r.text).join('¦');
      await next.click();
      await expect.poll(() => this.pagerText(), { timeout: 15_000 }).not.toBe(before);
      // the pager changes before the rows arrive: wait until the rows differ from the previous page
      // (compare all rows: a page may hold another table that stays the same, e.g. "Pending My Approval")
      await expect.poll(async () => {
        const texts = (await at(this.page, XP.registerRows).allInnerTexts()).filter(t => t.split('\t').length > 1).map(clean);
        return texts.length > 0 && texts.join('¦') !== sigBefore;
      }, { timeout: 15_000 }).toBeTruthy();
    }
    return all;
  }
  async pagerText(): Promise<string> {
    const p = at(this.page, XP.pagerText).first();
    return (await p.count()) ? clean(await p.innerText()) : '';
  }
  /** Total from the pager "Showing 1–20 of 135 units · Page 1 of 7" (0 when there is no pager). */
  async pagerTotal(): Promise<number> {
    const t = await settle(() => this.pagerText(), v => !/ of \d+/.test(v), 10_000);
    return Number(t.match(/ of (\d+)/)?.[1] ?? 0);
  }
  /**
   * Types in a register search box and waits for the result: the list first shows "No … found." while the
   * server answers, so wait for matching rows; an empty list counts only when it stays empty for a few seconds.
   */
  async search(placeholder: string, text: string) {
    const box = at(this.page, XP.searchBox(placeholder)).first();
    await box.fill(text);
    const want = text.toLowerCase();
    const dataRows = async () => (await at(this.page, XP.registerRows).allInnerTexts()).filter(r => r.split('	').length > 1);
    const until = Date.now() + 15_000;
    let emptySince = 0;
    while (Date.now() < until) {
      await this.page.waitForTimeout(400);
      const rows = await dataRows();
      if (rows.length && rows.every(r => r.toLowerCase().includes(want))) break;
      if (!rows.length) { emptySince ||= Date.now(); if (Date.now() - emptySince > 5_000) break; } else emptySince = 0;
    }
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }
  /** Options of the register status filter (textContent: options of a closed select have no innerText). */
  async statusOptions(): Promise<string[]> {
    return (await at(this.page, XP.statusFilter).locator('option').allTextContents()).map(o => o.trim());
  }
  async filterStatus(option: string) {
    const before = await this.pagerText();
    await at(this.page, XP.statusFilter).selectOption({ label: option });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await expect.poll(() => this.pagerText(), { timeout: 10_000 }).not.toBe(before).catch(() => {});
    await this.page.waitForTimeout(500);
  }
  /** Clicks a button in a register row (Edit, Deactivate, View, Open). Native confirm dialogs are accepted and returned. */
  async rowAction(row: RegisterRow, button: string): Promise<string | undefined> {
    let asked: string | undefined;
    const onDialog = (d: import('@playwright/test').Dialog) => { asked = d.message(); d.accept().catch(() => {}); };
    this.page.once('dialog', onDialog);
    await row.row.getByRole('button', { name: button, exact: true }).click();
    await this.page.waitForTimeout(1500);
    this.page.off('dialog', onDialog);
    return asked;
  }
  /** Opens a record from its record link (first link of the row). */
  async openRecord(number: string): Promise<RecordPanel> {
    // a page may hold several tables (Reservations: "Pending My Approval" + the register): take the row with the record link
    const row = at(this.page, XP.registerRows).filter({ hasText: number }).filter({ has: this.page.locator('a.crm-record-link') }).first();
    // not on this page: follow Next until it shows up
    for (let guard = 0; guard < 30 && !(await row.isVisible({ timeout: 5_000 }).catch(() => false)); guard++) {
      const next = at(this.page, XP.pagerNext).first();
      if (!(await next.count()) || !(await next.isEnabled())) break;
      const before = await this.pagerText();
      await next.click();
      await expect.poll(() => this.pagerText(), { timeout: 15_000 }).not.toBe(before);
    }
    await expect(row, `${number} is listed`).toBeVisible({ timeout: 20_000 });
    await row.locator('a.crm-record-link').first().click();
    const panel = new RecordPanel(this.page);
    await panel.waitOpen(number);
    return panel;
  }
  /** Clicks a register Export button and returns the downloaded file's rows (CSV / XLSX). */
  async export(button = 'Export'): Promise<{ name: string; rows: Record<string, string>[] }> {
    const [dl] = await Promise.all([this.page.waitForEvent('download', { timeout: 30_000 }), this.page.locator('main').getByRole('button', { name: button, exact: true }).first().click()]);
    const file = await dl.path();
    const wb = XLSX.readFile(file!, { raw: true });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false })
      .map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), String(v ?? '').trim()])));
    return { name: dl.suggestedFilename(), rows };
  }
}

// ── Modal form ───────────────────────────────────────────────────────────────
export type SubmitResult = { notice?: NoticeInfo; notices: NoticeInfo[]; closed: boolean; formText: string };

export class ModalForm {
  readonly notice: Notice;
  constructor(readonly page: Page) {
    this.notice = new Notice(page);
  }
  get root(): Locator {
    return at(this.page, XP.topModal);
  }
  /** Opens the form with a page button (New Project, New Unit, New Proposal …). */
  async open(button: string) {
    await this.page.locator('main').getByRole('button', { name: button, exact: true }).first().click();
    await expect(this.root).toBeVisible({ timeout: 15_000 });
    await this.page.waitForTimeout(800); // dropdowns load after the form opens
  }
  async heading() {
    return clean((await this.root.locator('h2, h3').first().innerText().catch(() => '')));
  }
  async text() {
    return clean(await this.root.innerText());
  }
  field(name: string): Locator {
    return at(this.page, XP.modalField(name)).first();
  }
  /** Labels of the form's fields (text of label.crm-field without its options). */
  async labels(): Promise<string[]> {
    return this.root.locator('label.crm-field, .crm-field').evaluateAll(ls => ls.map(l => {
      const span = l.querySelector('.crm-label, span');
      return (span?.textContent ?? '').replace(/\s+/g, ' ').trim();
    }).filter(Boolean));
  }
  /** Options of a dropdown by field name, after they load. */
  async options(name: string): Promise<string[]> {
    const read = async () => (await this.field(name).locator('option').allTextContents()).map(o => o.trim());
    return settle(read, o => o.length <= 1 || o.some(x => /^Loading/i.test(x)), 15_000);
  }
  async selected(name: string) {
    return ((await this.field(name).locator('option:checked').textContent()) ?? '').trim();
  }
  async value(name: string) {
    return this.field(name).inputValue();
  }
  /**
   * Sets a field by its name attribute: select → option text ("~text" = first option containing it),
   * checkbox → yes / no, other → typed. Empty value clears a text field / picks the placeholder option.
   */
  async set(name: string, value: string) {
    const f = this.field(name);
    await expect(f, `Field "${name}"`).toBeAttached();
    const tag = await f.evaluate(e => e.tagName);
    if (tag === 'SELECT') {
      if (value === '') return void (await f.selectOption({ index: 0 }));
      if (value.startsWith('~')) {
        const opts = await this.options(name);
        const hit = opts.find(o => o.includes(value.slice(1)));
        if (!hit) throw new Error(`No option containing "${value.slice(1)}" in "${name}" (${opts.slice(0, 8).join(', ')})`);
        return void (await f.selectOption({ label: hit }));
      }
      return void (await f.selectOption({ label: value }));
    }
    if ((await f.getAttribute('type')) === 'checkbox') return f.setChecked(/^y/i.test(value));
    await f.fill(value);
    await f.blur().catch(() => {});
  }
  async fill(values: Record<string, string>) {
    for (const [k, v] of Object.entries(values)) await this.set(k, v);
  }
  /** Picks a date in a date field of the form found by its label ("{today+14}"). */
  async setDate(label: string, value: string) {
    const wrap = this.root.locator('label.crm-field, .crm-field').filter({ hasText: label }).first();
    await pickDate(this.page, wrap, relativeDate(value) ?? new Date(value));
  }
  /**
   * Clicks the submit button and reads what happens: pop-ups (confirmations accepted with `confirm`),
   * and whether the form closed.
   */
  async submit(button: string, opts: { confirm?: string; wait?: number } = {}): Promise<SubmitResult> {
    const before = await this.heading();
    await at(this.page, XP.modalButton(button)).last().click();
    const notices: NoticeInfo[] = [];
    // a pop-up (.crm-notice-dialog) or a toast (.crm-app-toast), whichever shows first
    const toast = at(this.page, XP.toast).last();
    await Promise.race([this.notice.root.waitFor({ timeout: opts.wait ?? 30_000 }), toast.waitFor({ timeout: opts.wait ?? 30_000 })]).catch(() => {});
    if (await toast.isVisible().catch(() => false)) {
      const cls = (await toast.getAttribute('class')) ?? '';
      const title = clean(await toast.locator('strong').first().innerText().catch(() => ''));
      notices.push({ title, text: clean((await toast.innerText()).replace(/×\s*$/, '')), buttons: [], kind: /error/.test(cls) ? 'error' : /success/.test(cls) ? 'success' : 'info' });
    }
    let n = (await this.notice.visible()) ? await this.notice.read() : undefined;
    while (n) {
      notices.push(n);
      if (n.buttons.length > 1) await this.notice.close(opts.confirm ?? n.buttons[n.buttons.length - 1]);
      else break;
      n = await this.notice.wait(30_000);
    }
    await this.page.waitForTimeout(1000);
    const open = await this.root.isVisible().catch(() => false);
    const formText = open ? clean(await this.root.innerText().catch(() => '')) : '';
    // closed = the form went away, or turned into the saved record's view (New Unit → "<unit code> …")
    const closed = !open || (await this.heading()) !== before;
    return { notice: notices[notices.length - 1], notices, closed, formText };
  }
  async closeNotice() {
    await this.notice.dismiss(2_000);
  }
  /** Closes the form; a "Discard changes?" question is answered with Discard. */
  async close() {
    await this.notice.dismiss(); // a pop-up left open (e.g. "Contract Created") blocks every click behind it
    if (!(await this.root.isVisible().catch(() => false))) return;
    const btn = this.root.getByRole('button', { name: /^(Cancel|Close)$/ }).first();
    if (await btn.count()) await btn.click(); else await this.page.keyboard.press('Escape');
    const q = await this.notice.wait(2_000);
    if (q) await this.notice.close(q.buttons.find(b => /discard/i.test(b)) ?? q.buttons[q.buttons.length - 1]);
  }
}

// ── Record detail panel ─────────────────────────────────────────────────────
export class RecordPanel {
  readonly notice: Notice;
  constructor(readonly page: Page) {
    this.notice = new Notice(page);
  }
  get root(): Locator {
    return at(this.page, XP.detailPanel);
  }
  async waitOpen(number?: string) {
    await expect(this.root).toBeVisible({ timeout: 20_000 });
    if (number) await expect(this.root).toContainText(number, { timeout: 45_000 });
    await this.page.waitForTimeout(800);
  }
  async lines(): Promise<string[]> {
    return (await this.root.innerText()).split('\n').map(s => s.trim()).filter(Boolean);
  }
  async text() {
    return clean(await this.root.innerText());
  }
  /** Header "<record no.> · <customer>" */
  async header(): Promise<{ number: string; name: string }> {
    const l = (await this.lines()).find(x => /^[A-Z]{2,4}-[A-Z0-9-]+ · /.test(x)) ?? '';
    const [number, name] = l.split(' · ');
    return { number: number ?? '', name: name ?? '' };
  }
  /** "Status: Approved" */
  async status(): Promise<string> {
    return (await this.text()).match(/Status:\s*([A-Za-z][A-Za-z ]*?)(?=\s+(?:ERP:|[A-Z]{3,}\b))/)?.[1].trim() ?? '';
  }
  /** Summary tile value by its caption (OPPORTUNITY, UNIT, LIST PRICE, VALUE, ERP HANDOFF …): the line after it. */
  async summary(caption: string): Promise<string> {
    const lines = await this.lines();
    const end = lines.findIndex(l => l === 'Workflow Status');
    const i = lines.findIndex((l, k) => l.toUpperCase() === caption.toUpperCase() && (end < 0 || k < end));
    return i >= 0 ? lines[i + 1] ?? '' : '';
  }
  /** Workflow Status boxes: stage → DONE / IN PROGRESS / UP NEXT. */
  async workflow(stages: string[]): Promise<Record<string, string>> {
    const lines = await this.lines();
    const start = lines.indexOf('Workflow Status');
    const out: Record<string, string> = {};
    for (const s of stages) {
      const i = lines.indexOf(s, start);
      out[s] = i >= 0 ? lines[i + 1] : '';
    }
    return out;
  }
  /** State of a "Next action" card, e.g. "OPEN FORM ↓", "AFTER SUBMIT", "DONE ✓", "UNAVAILABLE". */
  async actionState(name: string): Promise<string> {
    // the card's text runs together in textContent ("Approve ProposalAfter submit"); CSS shows it in capitals
    const b = this.root.locator('button').filter({ hasText: new RegExp(`^\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[A-Za-z]{3,}`) }).first();
    if (!(await b.count())) return '';
    return clean((await b.innerText()).replace(name, '')).toUpperCase();
  }
  /** Lines of a block between its heading and the next known heading ("Approval History", "History", "Site Visit History"). */
  async block(heading: string, until: RegExp = /^(Pricing Audit|Approval History|History|Documents|Agreed Pack|Tasks & Calls|Notes|Site Visit History|Remarks)$/): Promise<string[]> {
    const lines = await this.lines();
    const i = lines.lastIndexOf(heading);
    if (i < 0) return [];
    const rest = lines.slice(i + 1);
    const j = rest.findIndex(l => until.test(l) && l !== heading);
    return j >= 0 ? rest.slice(0, j) : rest;
  }
  private field(label: string): Locator {
    return at(this.page, XP.recordField(label)).first();
  }
  /** Fields of the form that a submit button belongs to: the last field with that label wins (forms repeat labels). */
  async set(label: string, value: string, submit?: string) {
    let wrap = this.field(label);
    if (submit) {
      // the form section of a submit button: its nearest ancestor that also holds the field
      const sec = at(this.page, `(${XP.recordPanelButton(submit)})[last()]/ancestor::*[.//label[contains(@class,'crm-field')]][1]`);
      const inSec = sec.locator(`xpath=.//label[contains(@class,'crm-field')][span[contains(@class,'crm-label')][starts-with(normalize-space(),${JSON.stringify(label)})]]`).first();
      if (await inSec.count()) wrap = inSec;
    }
    await expect(wrap, `Field "${label}"`).toBeAttached();
    if (await wrap.locator(`xpath=${XP.dateTrigger}`).count()) {
      const [date, time] = value.split(/\s+/);
      return pickDate(this.page, wrap, relativeDate(date) ?? new Date(date), time);
    }
    const input = wrap.locator('select, textarea, input:not([type=hidden])').first();
    const tag = await input.evaluate(e => e.tagName);
    if (tag === 'SELECT') {
      if (value.startsWith('#')) return void (await input.selectOption({ index: Number(value.slice(1)) }));
      if (value === '') return void (await input.selectOption({ index: 0 }));
      if (value.startsWith('~')) {
        const opts = (await input.locator('option').allTextContents()).map(o => o.trim());
        const hit = opts.find(o => o.includes(value.slice(1)));
        if (!hit) throw new Error(`No option containing "${value.slice(1)}" in "${label}"`);
        return void (await input.selectOption({ label: hit }));
      }
      return void (await input.selectOption({ label: value }));
    }
    await input.fill(value);
  }
  async fill(values: Record<string, string>, submit?: string) {
    for (const [k, v] of Object.entries(values)) await this.set(k, v, submit);
  }
  /** Browser validation message of a field ("Please fill out this field." when a required field is empty). */
  async validationMessage(label: string): Promise<string> {
    const input = this.field(label).locator('select, textarea, input:not([type=hidden])').first();
    return (await input.count()) ? input.evaluate(e => (e as HTMLInputElement).validationMessage) : '';
  }
  /** Is the submit button of a form enabled? */
  async canPress(submit: string) {
    const b = at(this.page, XP.recordPanelButton(submit)).last();
    return (await b.count()) > 0 && (await b.isEnabled());
  }
  /**
   * Opens a "Next action" card (optional), fills its form and presses its submit button.
   * Confirmations are answered with `confirm` (default: the last button, e.g. "Approve"); `goBack` answers the first.
   * Returns every pop-up seen, in order.
   */
  async act(submit: string, values: Record<string, string> = {}, opts: { goBack?: boolean; confirm?: string } = {}): Promise<NoticeInfo[]> {
    await this.fill(values, submit);
    const button = at(this.page, XP.recordPanelButton(submit)).last();
    if (!(await button.isVisible().catch(() => false)) || !(await button.isEnabled().catch(() => false))) {
      // not offered in the current status (or waiting for a required field): report it instead of timing out
      return [{ title: 'Not available', text: `"${submit}" cannot be used here: the button is ${(await button.count()) ? 'disabled' : 'not shown'} (status ${await this.status()}).`, kind: 'info', buttons: [] }];
    }
    await button.click();
    const seen: NoticeInfo[] = [];
    let n = await this.notice.wait(30_000);
    while (n) {
      seen.push(n);
      if (n.buttons.length > 1) await this.notice.close(opts.goBack ? n.buttons[0] : opts.confirm ?? n.buttons[n.buttons.length - 1]);
      else { await this.notice.close(); break; }
      if (opts.goBack) break;
      n = await this.notice.wait(30_000);
    }
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(1500);
    return seen;
  }
  /** "Choose Unit" in a panel form, then pick the unit. */
  async chooseUnit(code: string, submit?: string) {
    const trigger = submit
      ? at(this.page, `(${XP.recordPanelButton(submit)})[last()]/ancestor::*[.//button[normalize-space()='Choose Unit']][1]//button[normalize-space()='Choose Unit']`)
      : this.root.getByRole('button', { name: 'Choose Unit' }).first();
    await trigger.first().click();
    await new UnitPicker(this.page).choose(code);
  }
  async copyLink(): Promise<string> {
    await this.root.getByRole('button', { name: 'Copy link', exact: true }).click();
    await this.page.waitForTimeout(300);
    return this.page.evaluate(() => navigator.clipboard.readText());
  }
  async close() {
    const b = this.root.getByRole('button', { name: 'Close', exact: true }).first();
    if (await b.count()) await b.click();
    const q = await this.notice.wait(1_500);
    if (q) await this.notice.close(q.buttons.find(x => /discard/i.test(x)) ?? q.buttons[q.buttons.length - 1]);
  }
}

// ── Unit picker ──────────────────────────────────────────────────────────────
export class UnitPicker {
  constructor(readonly page: Page) {}
  get root() {
    return at(this.page, XP.unitPicker);
  }
  async choose(code: string) {
    await expect(this.root).toBeVisible({ timeout: 15_000 });
    await at(this.page, XP.unitPickerSearch).fill(code);
    const row = at(this.page, XP.unitPickerRow(code));
    await expect(row, `Unit ${code} offered in the unit picker`).toBeVisible({ timeout: 15_000 });
    await row.getByRole('button', { name: 'Select' }).click();
    await expect(this.root).toBeHidden({ timeout: 10_000 });
  }
  /** Units offered for a search (unit codes). */
  async offered(search: string): Promise<string[]> {
    await expect(this.root).toBeVisible({ timeout: 15_000 });
    await at(this.page, XP.unitPickerSearch).fill(search);
    await this.page.waitForTimeout(1500);
    return (await this.root.locator('tbody tr').allInnerTexts()).map(t => t.split('\n')[0].trim());
  }
}

// ── Customer KYC ─────────────────────────────────────────────────────────────
export type KycDocument = { type: string; number: string; expiry: string; file: string };

export class CustomerKyc {
  readonly notice: Notice;
  constructor(readonly page: Page, readonly route = '/customers') {
    this.notice = new Notice(page);
  }
  get block() {
    return at(this.page, XP.kycBlock);
  }
  /** Opens the customer (by Customer ID or name in the register) — the Edit Customer form. Never saved. */
  async open(customer: string) {
    await this.page.goto(this.route);
    await this.page.waitForLoadState('networkidle').catch(() => {});
    const row = at(this.page, XP.registerRows).filter({ hasText: customer }).first();
    await expect(row, `Customer ${customer} listed`).toBeVisible({ timeout: 20_000 });
    await row.locator('a.crm-record-link').first().click();
    await expect(this.block).toBeVisible({ timeout: 20_000 });
  }
  async status() {
    return clean((await at(this.page, XP.kycStatus).first().innerText()).replace(/^KYC:\s*/, ''));
  }
  async upload(doc: KycDocument) {
    await this.block.getByLabel('KYC document type').selectOption({ label: doc.type });
    await this.block.getByLabel('Document number').fill(doc.number);
    await pickDate(this.page, this.block.locator('.crm-date-field'), relativeDate(doc.expiry) ?? new Date(doc.expiry));
    await this.block.getByLabel('KYC file').setInputFiles(doc.file);
    await this.block.getByRole('button', { name: 'Upload', exact: true }).click();
    await expect.poll(() => this.status(), { timeout: 20_000 }).not.toMatch(/Not Started/i);
  }
  async verify() {
    await this.block.getByRole('button', { name: 'Verify', exact: true }).first().click();
    const n = await this.notice.wait(10_000);
    if (n && n.buttons.length > 1) await this.notice.close(n.buttons[n.buttons.length - 1]);
    await this.notice.dismiss(5_000);
    await expect.poll(() => this.status(), { timeout: 20_000 }).toMatch(/Approved/i);
  }
  /** Closes the Edit Customer form without saving. */
  async close() {
    const b = at(this.page, XP.topModal).getByRole('button', { name: 'Close', exact: true }).first();
    if (await b.count()) await b.click();
    const q = await this.notice.wait(2_000);
    if (q) await this.notice.close(q.buttons.find(x => /discard/i.test(x)) ?? q.buttons[q.buttons.length - 1]);
  }
}

// ── Opportunities → Board ────────────────────────────────────────────────────
export type BoardCard = { opportunity: string; text: string; budget: number; moves: { label: string; disabled: boolean }[] };
export type BoardColumn = { stage: string; count: number; value: number; collapsed: boolean; cards: BoardCard[] };

export class PipelineBoard {
  constructor(readonly page: Page) {}
  async open(view = 'Board') {
    await this.page.locator('main').getByRole('button', { name: view, exact: true }).click();
    await expect(at(this.page, XP.boardSummary)).toBeVisible({ timeout: 20_000 });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(800);
  }
  /** "Open pipeline: N deals · V USD · weighted W USD" → { deals, value } */
  async summary(): Promise<{ text: string; deals: number; value: number }> {
    const text = clean(await at(this.page, XP.boardSummary).innerText());
    const [, deals, value] = text.match(/:\s*([\d,]+)\s*deals?\s*·\s*([^·]+)/) ?? [];
    return { text, deals: deals ? parseNum(deals) : NaN, value: value ? parseNum(value) : NaN };
  }
  async filterOptions(label: string): Promise<string[]> {
    return (await at(this.page, XP.selectByLabel(label)).locator('option').allTextContents()).map(clean);
  }
  async filter(label: string, option: string) {
    await at(this.page, XP.selectByLabel(label)).selectOption({ label: option });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(1200);
  }
  /** Every column with its header figures and its cards (budget, move menu options). */
  async columns(): Promise<BoardColumn[]> {
    const out: BoardColumn[] = [];
    const cols = at(this.page, XP.boardColumns);
    for (let i = 0; i < (await cols.count()); i++) {
      const c = cols.nth(i);
      const stage = clean((await c.locator('header').first().innerText()).split('\n')[0]);
      const cards: BoardCard[] = [];
      const els = c.locator(`xpath=${XP.boardCards}`);
      for (let k = 0; k < (await els.count()); k++) {
        const el = els.nth(k);
        const sel = el.locator(`xpath=${XP.boardMoveSelect}`).first();
        const text = clean(await el.innerText());
        const opportunity = ((await sel.getAttribute('aria-label')) ?? '').replace(/^Move\s+|\s+to\s*:?\s*$/g, '');
        const amount = text.match(/[\d.,]+\s*[KMB]?\s+[A-Z]{3}\b/)?.[0];
        const moves = await sel.locator('option').evaluateAll(os => os.map(o => ({ label: (o.textContent ?? '').trim(), disabled: (o as HTMLOptionElement).disabled })));
        cards.push({ opportunity, text, budget: amount ? parseNum(amount) : 0, moves });
      }
      out.push({
        stage, collapsed: /is-collapsed/.test((await c.getAttribute('class')) ?? ''),
        count: parseNum(await c.locator(`xpath=${XP.boardColumnCount}`).first().innerText()),
        value: parseNum(await c.locator(`xpath=${XP.boardColumnValue}`).first().innerText()),
        cards,
      });
    }
    return out;
  }
}
