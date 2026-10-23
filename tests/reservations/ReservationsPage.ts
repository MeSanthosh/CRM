/**
 * Page object for /reservations (Unit Reservations): status cards, Pending My Approval, the Reservation
 * Register, the Reservation Detail modal (facts, workflow, actions, documents, history), the
 * Create / Replace Reservation forms and the unit picker. Locator strings come from ../locators.ts (RSV).
 */
import { Page, Locator, Request, Response, expect } from '@playwright/test';
import { BasePage } from '../pages/BasePage';
import { ROUTES, RSV, RESERVATION_CARDS, RESERVATION_COLUMNS } from '../locators';
import { parseNum } from '../helpers';
import { withRequest, stable } from '../opportunities/OpportunitiesPage';

export type RsvRow = {
  rsv: string; opp: string; customer: string; unit: string; status: string;
  date: string; amount: string; created: string; href: string;
};
export type PickerUnit = { code: string; project: string; price: string; status: string; selectable: boolean };

const isList = (r: Request) => /\/api\/v1\/reservations\?/.test(r.url()) && r.method() === 'GET';
const isRecord = (r: Response) => /\/api\/v1\/reservations\/[0-9a-f-]{36}$/.test(r.url()) && r.request().method() === 'GET';
export const isCreate = (r: Response) => /\/api\/v1\/reservations$/.test(r.url()) && r.request().method() === 'POST';

export class ReservationsPage extends BasePage {
  readonly path = ROUTES.reservations;
  readonly name = 'Unit Reservations';
  readonly cards = RESERVATION_CARDS;
  readonly columns = RESERVATION_COLUMNS;

  constructor(page: Page) { super(page); }

  private x(xpath: string): Locator { return this.page.locator(`xpath=${xpath}`); }

  // ── cards ───────────────────────────────────────────────────────────────
  card(label: string): Locator { return this.x(RSV.card(label)); }
  get amountCard(): Locator { return this.x(RSV.amountCard); }

  async cardValue(label: string): Promise<number> {
    const v = this.card(label).locator('.crm-kpi');
    await expect(v).toHaveText(/\d/);
    return parseNum(await v.innerText());
  }
  async amountText(): Promise<string> {
    await expect(this.amountCard).toHaveText(/\d/);
    return (await this.amountCard.innerText()).trim();
  }
  async clickCard(label: string) {
    await this.reload(() => this.card(label).click());
    await expect(this.card(label)).toHaveAttribute('aria-pressed', 'true');
  }

  // ── Pending My Approval ─────────────────────────────────────────────────
  get pendingPanel(): Locator { return this.x(RSV.pendingPanel); }
  async pendingRows(): Promise<string[][]> {
    if (!(await this.pendingPanel.count())) return [];
    return this.pendingPanel.locator('tbody tr').evaluateAll(trs => trs.map(tr => Array.from(tr.querySelectorAll('td')).map(td => (td.textContent ?? '').trim())));
  }

  // ── register ────────────────────────────────────────────────────────────
  get register(): Locator { return this.x(RSV.register); }
  get searchBox(): Locator { return this.page.locator(RSV.search); }
  get clearSearchButton(): Locator { return this.page.locator(RSV.searchClear); }
  get exportButton(): Locator { return this.register.locator('button.crm-export-button'); }
  get pager(): Locator { return this.x(RSV.pager); }
  pagerButton(name: 'Previous' | 'Next'): Locator { return this.x(RSV.pagerButton(name)); }
  sortHeader(column: string): Locator { return this.x(RSV.sortHeader(column)); }
  private get rowsLoc(): Locator { return this.x(`${RSV.table}/tbody/tr`); }

  async open() {
    await withRequest(this.page, isList, () => super.open());
    await this.listSettled();
  }

  async reload(fn: () => Promise<unknown>, match: (p: URLSearchParams) => boolean = () => true) {
    await withRequest(this.page, r => isList(r) && match(new URL(r.url()).searchParams), fn);
    await this.listSettled();
  }

  private async listText() {
    const table = (await this.x(RSV.table).allInnerTexts()).join('\n');
    const pager = (await this.pager.allInnerTexts()).join('\n');
    const cards = (await this.page.locator('main .crm-metric-grid').allInnerTexts()).join('\n');
    return `${table}\n${pager}\n${cards}`;
  }

  async listSettled() {
    await expect(this.rowsLoc.first()).toBeVisible();
    await stable(() => this.listText());
  }

  async headers(): Promise<string[]> {
    return (await this.x(`${RSV.table}/thead//th`).allInnerTexts()).map(t => t.replace(/[↕▲▼]/g, '').trim());
  }

  /** Rows on the current page (rows without a reservation link, such as the empty state, are skipped). */
  async rows(): Promise<RsvRow[]> {
    return this.rowsLoc.evaluateAll(trs => trs.filter(tr => tr.querySelector('a.crm-record-link')).map(tr => {
      const td = Array.from(tr.querySelectorAll('td'));
      const t = (i: number) => (td[i]?.textContent ?? '').trim();
      const a = td[0].querySelector('a')!;
      return {
        rsv: (a.textContent ?? '').trim(), opp: (td[0].querySelector('span')?.textContent ?? '').trim(),
        customer: t(1), unit: t(2), status: t(3), date: t(4), amount: t(5), created: t(6), href: a.getAttribute('href') ?? '',
      };
    }));
  }

  /** Text of the register body when it has no reservations (empty-state row), else ''. */
  async emptyText(): Promise<string> {
    if ((await this.rows()).length) return '';
    return (await this.rowsLoc.allInnerTexts()).join(' ').trim();
  }

  /** "Showing 1–20 of 115 reservations · Page 1 of 6" → numbers (null when the pager is hidden). */
  async pagerInfo() {
    // the pager briefly disappears while a page re-renders: wait a little before deciding there is none
    const read = async () => (await this.pager.allInnerTexts()).join(' ').replace(/,/g, '');
    const re = /Showing\s+(\d+)\D+(\d+)\s+of\s+(\d+).*Page\s+(\d+)\s+of\s+(\d+)/i;
    await expect.poll(async () => re.test(await read()), { timeout: 3_000 }).toBe(true).catch(() => {});
    const t = await read();
    const m = t.match(re);
    if (!m) return null;
    const [from, to, total, page, pages] = m.slice(1).map(Number);
    return { from, to, total, page, pages, text: t };
  }

  async search(text: string) {
    if ((await this.searchBox.inputValue()) === text) return;
    await this.reload(() => this.searchBox.fill(text), p => (p.get('search') ?? '') === text);
  }

  async clearSearch() {
    await this.reload(() => this.clearSearchButton.click(), p => !p.get('search'));
  }

  async sortBy(column: string): Promise<string> {
    const before = (await this.rows()).map(r => r.rsv).join();
    await this.reload(() => this.sortHeader(column).locator('button').click());
    // the response can arrive before the table re-renders in the new order: wait for the rows to change
    // (briefly — a re-sort can legitimately leave the first page unchanged)
    await expect.poll(async () => (await this.rows()).map(r => r.rsv).join(), { timeout: 5_000 }).not.toBe(before).catch(() => {});
    await stable(() => this.rows());
    return (await this.sortHeader(column).getAttribute('aria-sort')) ?? 'none';
  }

  async sortTo(column: string, dir: 'ascending' | 'descending') {
    for (let i = 0; i < 3 && (await this.sortHeader(column).getAttribute('aria-sort')) !== dir; i++) await this.sortBy(column);
    expect(await this.sortHeader(column).getAttribute('aria-sort'), `${column} sorted ${dir}`).toBe(dir);
  }

  /** Every row of every page, following "Page N of M". */
  async allRows(maxPages = 50): Promise<RsvRow[]> {
    const out = await this.rows();
    for (let info = await this.pagerInfo(); info && info.page < info.pages && info.page < maxPages; info = await this.pagerInfo()) {
      await expect(this.pagerButton('Next')).toBeEnabled();
      const firstBefore = (await this.rows())[0]?.rsv;
      await this.reload(() => this.pagerButton('Next').click());
      await expect.poll(async () => (await this.pagerInfo())?.page, { message: `Next → page ${info.page + 1}` }).toBe(info.page + 1);
      // the pager can update before the rows: wait until the page's rows have changed too
      await expect.poll(async () => (await this.rows())[0]?.rsv, { message: `rows of page ${info.page + 1}` }).not.toBe(firstBefore);
      out.push(...await stable(() => this.rows()));
    }
    return out;
  }

  // ── detail ──────────────────────────────────────────────────────────────
  get detail(): Locator { return this.x(RSV.detail); }
  fact(label: string): Locator { return this.x(RSV.detailFact(label)); }
  get status(): Locator { return this.x(RSV.detailStatus); }
  get quickNotes(): Locator { return this.x(RSV.quickNotes); }
  get documents(): Locator { return this.x(RSV.documents); }
  get history(): Locator { return this.x(RSV.history); }
  get remarks(): Locator { return this.x(RSV.remarks); }
  action(name: string): Locator { return this.x(RSV.actions).filter({ hasText: new RegExp(`^${name}$`) }); }
  get notice(): Locator { return this.page.locator('section.crm-notice-dialog[role="alertdialog"]'); }

  async detailLoaded(rsvNo?: string) {
    await expect(this.detail, 'Reservation Detail opens').toBeVisible();
    await expect(this.x(RSV.detailLoaded), 'Reservation Detail loaded').toBeVisible({ timeout: 20_000 });
    if (rsvNo) await expect(this.x(RSV.detailTitle)).toHaveText(rsvNo);
    await this.page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  }

  /** Finds a reservation with the register search and opens it; returns its API record. */
  async openRecord(rsvNo: string) {
    await this.search(rsvNo);
    const record = this.page.waitForResponse(isRecord);
    await this.rowsLoc.locator('a.crm-record-link').filter({ hasText: new RegExp(`^${rsvNo}$`) }).click();
    const res = await record;
    await this.detailLoaded(rsvNo);
    return res.json();
  }

  /** Opens the first row of the register (after a card filter). */
  async openFirst(): Promise<RsvRow | undefined> {
    const row = (await this.rows())[0];
    if (row) await this.openRecord(row.rsv);
    return row;
  }

  async closeDetail() {
    await this.detail.getByRole('button', { name: 'Close', exact: true }).first().click();
    await expect(this.detail).toHaveCount(0);
  }

  async facts(): Promise<Record<string, string>> {
    const out: Record<string, string> = {
      number: (await this.x(RSV.detailTitle).innerText()).trim(),
      customer: (await this.x(RSV.detailCustomer).innerText()).trim(),
      status: (await this.status.innerText()).trim(),
    };
    for (const l of ['Opportunity', 'Unit', 'Project', 'Amount', 'Date', 'Expiry', 'Deposit Received', 'ERP Sync']) {
      out[l] = (await this.fact(l).allInnerTexts()).join('').trim();
    }
    return out;
  }

  async workflow(): Promise<{ name: string; text: string }[]> {
    return stable(() => this.x(RSV.workflowStep).evaluateAll(bs => bs.map(b => ({
      name: (b.querySelector('strong')?.textContent ?? '').trim(), text: (b.querySelector('span')?.textContent ?? '').trim(),
    }))));
  }

  async actions(): Promise<string[]> {
    return (await this.x(RSV.actions).allInnerTexts()).map(t => t.trim());
  }

  async historyEntries(): Promise<string[]> {
    return (await this.x(RSV.historyEntries).allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
  }

  async readNotice() {
    await expect(this.notice).toBeVisible();
    return { title: (await this.notice.locator('h3').innerText()).trim(), body: (await this.notice.innerText()).replace(/\s+/g, ' ').trim() };
  }
  async noticeButton(name: string) {
    await this.notice.getByRole('button', { name, exact: true }).click();
    await expect(this.notice).toHaveCount(0);
  }

  // ── documents ───────────────────────────────────────────────────────────
  /** Uploads a file; returns the POST /documents response or null if none was sent within `ms`. */
  async upload(file: string | null, type = '', description = '', ms = 10_000) {
    if (type) await this.documents.locator('select').selectOption(type);
    if (description) await this.documents.getByPlaceholder('Description (optional)').fill(description);
    if (file) await this.documents.locator('input[type="file"]').setInputFiles(file);
    const posted = this.page.waitForResponse(r => /\/api\/v1\/documents$/.test(r.url()) && r.request().method() === 'POST', { timeout: ms }).catch(() => null);
    await this.documents.getByRole('button', { name: 'Upload', exact: true }).click();
    return posted;
  }

  /** <ul.crm-document-list><li.crm-document-item><button.crm-document-name>file</button><span>type · description · size</span><span>Uploaded by …</span><button>Delete</button> */
  documentItem(fileName: string): Locator {
    return this.documents.locator('li.crm-document-item').filter({ has: this.page.locator('.crm-document-name', { hasText: new RegExp(`^${fileName.replace('.', '\\.')}$`) }) });
  }
  async documentList(): Promise<{ name: string; meta: string[]; canDelete: boolean }[]> {
    return this.documents.locator('li.crm-document-item').evaluateAll(lis => lis.map(li => ({
      name: (li.querySelector('.crm-document-name')?.textContent ?? '').trim(),
      meta: Array.from(li.querySelectorAll('.crm-document-main > span')).map(s => (s.textContent ?? '').trim()),
      canDelete: Array.from(li.querySelectorAll('button')).some(b => (b.textContent ?? '').trim() === 'Delete'),
    })));
  }

  // ── create / replace forms ──────────────────────────────────────────────
  get createForm(): Locator { return this.x(RSV.createForm); }
  get replaceForm(): Locator { return this.x(RSV.replaceForm); }
  get picker(): Locator { return this.page.locator(RSV.unitPicker); }

  async openNew() {
    await this.x(RSV.newButton).click();
    await expect(this.createForm).toBeVisible();
    await expect.poll(() => this.createForm.locator(`${RSV.formOpportunity} option`).count(), { message: 'opportunity options load' }).toBeGreaterThan(1);
  }

  async opportunityOptions(form: Locator): Promise<{ value: string; label: string }[]> {
    return form.locator(`${RSV.formOpportunity} option`).evaluateAll(os => os.map(o => ({ value: (o as HTMLOptionElement).value, label: (o.textContent ?? '').trim() })).filter(o => o.value));
  }

  async chooseOpportunity(form: Locator, oppNo: string) {
    const opt = (await this.opportunityOptions(form)).find(o => o.label.startsWith(`${oppNo} `));
    if (!opt) throw new Error(`${oppNo} is not offered in the Opportunity list`);
    await form.locator(RSV.formOpportunity).selectOption(opt.value);
  }

  async openPicker(form: Locator) {
    await form.locator(RSV.formChooseUnit).click();
    await expect(this.picker).toBeVisible();
    // the table first shows a placeholder row while the units load
    await expect(this.picker.locator('tbody tr td strong').first(), 'Units loaded').toBeVisible({ timeout: 20_000 });
    await stable(() => this.picker.locator('tbody').innerText());
  }

  async pickerUnits(): Promise<PickerUnit[]> {
    // rows without a unit code (e.g. an empty-state row) are not units
    return this.picker.locator('tbody tr').evaluateAll(trs => trs.filter(tr => tr.querySelector('td strong')).map(tr => {
      const td = Array.from(tr.querySelectorAll('td'));
      const btn = tr.querySelector('button');
      return {
        code: (td[0]?.querySelector('strong')?.textContent ?? '').trim(), project: (td[1]?.textContent ?? '').trim(),
        price: (tr.querySelector('.crm-unit-picker-price')?.textContent ?? '').trim(), status: (td[8]?.textContent ?? '').trim(),
        selectable: !!btn && !(btn as HTMLButtonElement).disabled,
      };
    }));
  }

  async setHideOnHold(on: boolean) {
    const box = this.page.locator(RSV.unitPickerHideOnHold);
    if ((await box.isChecked()) !== on) await box.setChecked(on);
    await stable(() => this.picker.locator('tbody').innerText());
  }

  async closePicker() {
    await this.picker.getByRole('button', { name: 'Close', exact: true }).first().click();
    await expect(this.picker).toHaveCount(0);
  }

  /** Picks an available, selectable unit not in `exclude` (random among the first `spread`, to avoid clashing with other runs). */
  async pickUnit(form: Locator, exclude: string[] = [], spread = 8): Promise<PickerUnit> {
    await this.openPicker(form);
    const units = (await this.pickerUnits()).filter(u => u.status === 'Available' && u.selectable && !exclude.includes(u.code));
    if (!units.length) throw new Error('No available unit to select');
    const unit = units[Math.floor(Math.random() * Math.min(spread, units.length))];
    await this.picker.locator('tbody tr').filter({ has: this.page.locator('strong', { hasText: new RegExp(`^${unit.code}$`) }) })
      .getByRole('button', { name: 'Select' }).click();
    await expect(this.picker).toHaveCount(0);
    await expect(form.locator(RSV.formUnitText)).toHaveValue(new RegExp(unit.code));
    return unit;
  }

  /** Waits for the amount to fill in after a unit is chosen; returns it ('' if it stays empty). */
  async filledAmount(form: Locator, ms = 10_000): Promise<string> {
    const amount = form.locator(RSV.formAmount);
    await expect.poll(() => amount.inputValue(), { timeout: ms }).not.toBe('').catch(() => {});
    return amount.inputValue();
  }

  /** Clicks the form's submit button; returns the create / supersede response (or null if none was sent within `ms`). */
  async submit(form: Locator, ms = 10_000) {
    const posted = this.page.waitForResponse(r => /\/api\/v1\/reservations(\/[0-9a-f-]{36}\/supersede)?$/.test(r.url()) && r.request().method() === 'POST', { timeout: ms }).catch(() => null);
    await form.locator(RSV.formSubmit).click();
    return posted;
  }
}
