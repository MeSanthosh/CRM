/**
 * Page object for /customers (Customer and Broker Workspace): the four cards, the Customers / Brokers tabs,
 * both registers (search, sort, paging, export), the Edit Customer window (fields, sections, KYC) and the
 * broker form (create / edit) with its portal-credentials dialog. Locator strings come from ../locators.ts (CB).
 */
import { Page, Locator, Request, Response, expect } from '@playwright/test';
import { BasePage } from '../pages/BasePage';
import { ROUTES, CB, CB_CARDS, CUSTOMER_COLUMNS, BROKER_COLUMNS } from '../locators';
import { withRequest, stable } from '../opportunities/OpportunitiesPage';

export type Tab = 'Customers' | 'Brokers';
export type CustomerRow = { name: string; code: string; phone: string; email: string; buyerType: string; project: string; status: string; created: string; href: string };
export type BrokerRow = { name: string; code: string; phone: string; email: string; city: string; plan: string; status: string; created: string };

const isList = (tab: Tab) => (r: Request) => new RegExp(`/api/v1/${tab === 'Customers' ? 'customers' : 'brokers'}\\?`).test(r.url()) && r.method() === 'GET';
const isCustomer = (r: Response) => /\/api\/v1\/customers\/[0-9a-f-]{36}$/.test(r.url()) && r.request().method() === 'GET';
const TITLE: Record<Tab, 'Customer Register' | 'Broker Register'> = { Customers: 'Customer Register', Brokers: 'Broker Register' };

export class CustomersBrokersPage extends BasePage {
  readonly path = ROUTES.customers;
  readonly name = 'Customer and Broker Workspace';
  readonly cards = CB_CARDS;
  readonly customerColumns = CUSTOMER_COLUMNS;
  readonly brokerColumns = BROKER_COLUMNS;
  current: Tab = 'Customers';

  constructor(page: Page) { super(page); }
  private x(xpath: string): Locator { return this.page.locator(`xpath=${xpath}`); }

  // ── page, cards, tabs ───────────────────────────────────────────────────
  async open() {
    await withRequest(this.page, isList('Customers'), () => super.open());
    this.current = 'Customers';
    await this.listSettled();
  }
  tab(name: Tab): Locator { return this.x(CB.tab(name)); }
  async showTab(name: Tab) {
    if (await this.tab(name).evaluate(e => e.classList.contains('is-active'))) { this.current = name; return; }
    await withRequest(this.page, isList(name), () => this.tab(name).click());
    this.current = name;
    await expect(this.register).toBeVisible();
    await this.listSettled();
  }
  /** Card value as a number ("164"). */
  async card(label: string) { return this.kpi(label); }

  // ── register (the one on the current tab) ──────────────────────────────
  get register(): Locator { return this.x(CB.register(TITLE[this.current])); }
  get searchBox(): Locator { return this.page.locator(this.current === 'Customers' ? CB.customerSearch : CB.brokerSearch); }
  get clearSearchButton(): Locator { return this.register.locator('button.crm-search-clear'); }
  get exportButton(): Locator { return this.register.locator('button.crm-export-button'); }
  get pager(): Locator { return this.register.locator('.crm-pagination > span'); }
  pagerButton(name: 'Previous' | 'Next'): Locator { return this.register.locator('.crm-pagination button', { hasText: name }); }
  sortHeader(column: string): Locator { return this.register.locator('th', { has: this.page.locator('span', { hasText: new RegExp(`^${column}$`) }) }); }
  private get rowsLoc(): Locator { return this.register.locator('table tbody tr'); }

  private async listText() {
    return [...await this.register.locator('table').allInnerTexts(), ...await this.pager.allInnerTexts()].join('\n');
  }
  /** Waits until the register's table and pager stop changing (a search may leave no rows at all). */
  async listSettled() {
    await expect(this.register.locator('table')).toBeVisible();
    await stable(() => this.listText());
  }
  async reload(fn: () => Promise<unknown>, match: (p: URLSearchParams) => boolean = () => true) {
    const tab = this.current;
    await withRequest(this.page, r => isList(tab)(r) && match(new URL(r.url()).searchParams), fn);
    await this.listSettled();
  }

  async headers(): Promise<string[]> {
    return (await this.register.locator('thead th').allInnerTexts()).map(t => t.replace(/[↕▲▼]/g, '').trim());
  }

  async customerRows(): Promise<CustomerRow[]> {
    return this.rowsLoc.evaluateAll(trs => trs.filter(tr => tr.querySelector('a.crm-record-link')).map(tr => {
      const td = Array.from(tr.querySelectorAll('td'));
      const t = (i: number) => (td[i]?.textContent ?? '').trim();
      const a = td[0].querySelector('a')!;
      return {
        name: (td[0].querySelector('strong')?.textContent ?? '').trim(), code: (a.textContent ?? '').trim(), href: a.getAttribute('href') ?? '',
        phone: (td[1]?.querySelector('strong')?.textContent ?? '').trim(), email: (td[1]?.querySelector('span')?.textContent ?? '').trim(),
        buyerType: t(2), project: t(3), status: t(4), created: t(5),
      };
    }));
  }

  async brokerRows(): Promise<BrokerRow[]> {
    return this.rowsLoc.evaluateAll(trs => trs.filter(tr => /BRK-/.test(tr.textContent ?? '')).map(tr => {
      const td = Array.from(tr.querySelectorAll('td'));
      const t = (i: number) => (td[i]?.textContent ?? '').trim();
      return {
        name: (td[0]?.querySelector('strong')?.textContent ?? '').trim(), code: (td[0]?.querySelector('span')?.textContent ?? '').trim(),
        phone: (td[1]?.querySelector('strong')?.textContent ?? '').trim(), email: (td[1]?.querySelector('span')?.textContent ?? '').trim(),
        city: t(2), plan: t(3), status: t(4), created: t(5),
      };
    }));
  }

  /** Number of records on the current page (customers or brokers). */
  async rowCount() { return this.current === 'Customers' ? (await this.customerRows()).length : (await this.brokerRows()).length; }

  /** Text of the register body when nothing is listed, else ''. */
  async emptyText(): Promise<string> {
    if (await this.rowCount()) return '';
    return (await this.rowsLoc.allInnerTexts()).join(' ').trim();
  }

  /** "Showing 1–20 of 164 customers · Page 1 of 9" (null when the pager is hidden). */
  async pagerInfo() {
    const re = /Showing\s+(\d+)\D+(\d+)\s+of\s+(\d+).*Page\s+(\d+)\s+of\s+(\d+)/i;
    const read = async () => (await this.pager.allInnerTexts()).join(' ').replace(/,/g, '');
    await expect.poll(async () => re.test(await read()), { timeout: 3_000 }).toBe(true).catch(() => {});
    const m = (await read()).match(re);
    if (!m) return null;
    const [from, to, total, page, pages] = m.slice(1).map(Number);
    return { from, to, total, page, pages };
  }
  /** Register total: the pager's, or the rows when there is no pager. */
  async total() { return (await this.pagerInfo())?.total ?? this.rowCount(); }

  async search(text: string) {
    if ((await this.searchBox.inputValue()) === text) return;
    await this.reload(() => this.searchBox.fill(text), p => (p.get('search') ?? '') === text);
  }
  async clearSearch() {
    await this.reload(() => this.clearSearchButton.click(), p => !p.get('search'));
  }

  private async firstKeys() {
    return this.current === 'Customers' ? (await this.customerRows()).map(r => r.code).join() : (await this.brokerRows()).map(r => r.code).join();
  }
  async sortBy(column: string): Promise<string> {
    const before = await this.firstKeys();
    await this.reload(() => this.sortHeader(column).locator('button').click());
    await expect.poll(() => this.firstKeys(), { timeout: 5_000 }).not.toBe(before).catch(() => {});
    await stable(() => this.firstKeys());
    return (await this.sortHeader(column).getAttribute('aria-sort')) ?? 'none';
  }
  async sortTo(column: string, dir: 'ascending' | 'descending') {
    for (let i = 0; i < 3 && (await this.sortHeader(column).getAttribute('aria-sort')) !== dir; i++) await this.sortBy(column);
    expect(await this.sortHeader(column).getAttribute('aria-sort'), `${column} sorted ${dir}`).toBe(dir);
  }

  /** Every customer row of every page, following "Page N of M". */
  async allCustomerRows(maxPages = 50): Promise<CustomerRow[]> {
    const out = await this.customerRows();
    for (let info = await this.pagerInfo(); info && info.page < info.pages && info.page < maxPages; info = await this.pagerInfo()) {
      const first = (await this.customerRows())[0]?.code;
      await this.reload(() => this.pagerButton('Next').click());
      await expect.poll(async () => (await this.pagerInfo())?.page).toBe(info.page + 1);
      await expect.poll(async () => (await this.customerRows())[0]?.code).not.toBe(first);
      out.push(...await stable(() => this.customerRows()));
    }
    return out;
  }

  get notice(): Locator { return this.page.locator('section.crm-notice-dialog[role="alertdialog"]'); }
  async readNotice() {
    await expect(this.notice).toBeVisible();
    return { title: (await this.notice.locator('h3').innerText()).trim(), body: (await this.notice.innerText()).replace(/\s+/g, ' ').trim() };
  }
  async noticeButton(name: string) {
    await this.notice.getByRole('button', { name, exact: true }).click();
    await expect(this.notice).toHaveCount(0);
  }

  // ── customer detail ─────────────────────────────────────────────────────
  get customerDialog(): Locator { return this.x(CB.customerDialog); }
  customerField(name: string): Locator { return this.x(CB.customerField(name)); }
  get updateButton(): Locator { return this.x(CB.customerUpdate); }
  customerSection(heading: string): Locator { return this.x(CB.customerSection(heading)); }
  get kycSection(): Locator { return this.customerSection('Documents & KYC'); }
  get kycBadge(): Locator { return this.x(CB.kycBadge); }

  /** Searches a customer by code and opens it; returns its API record. */
  async openCustomer(code: string) {
    await this.showTab('Customers');
    await this.search(code);
    const record = this.page.waitForResponse(isCustomer);
    await this.rowsLoc.locator('a.crm-record-link').filter({ hasText: new RegExp(`^${code}$`) }).click();
    const res = await record;
    await expect(this.customerDialog, 'Edit Customer opens').toBeVisible();
    await expect(this.customerField('displayName')).not.toHaveValue('');
    await this.page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    return res.json();
  }
  /** "Discard changes? … [Keep editing] [Discard]" — shown when a form with unsaved changes is closed. */
  get discardPrompt(): Locator { return this.notice.filter({ hasText: 'Discard changes?' }); }

  /** Closes Edit Customer; if it asks about unsaved changes, answers Discard. */
  async closeCustomer() {
    await this.x(CB.customerClose).first().click();
    if (await this.discardPrompt.waitFor({ timeout: 1_500 }).then(() => true, () => false)) await this.noticeButton('Discard');
    await expect(this.customerDialog).toHaveCount(0);
  }

  /** Saves the Edit Customer form; returns the PATCH response (or null if none was sent within `ms`). */
  async saveCustomer(ms = 10_000) {
    const saved = this.page.waitForResponse(r => /\/api\/v1\/customers\/[0-9a-f-]{36}$/.test(r.url()) && r.request().method() === 'PATCH', { timeout: ms }).catch(() => null);
    await this.updateButton.click();
    return saved;
  }

  // ── KYC ─────────────────────────────────────────────────────────────────
  /** Fills the KYC upload row and clicks Upload; returns the POST response (or null). */
  async uploadKyc(o: { type?: string; number?: string; expiryNextMonthDay?: number; file?: string }, ms = 10_000) {
    const k = this.kycSection;
    if (o.type) await k.locator('select').selectOption({ label: o.type });
    if (o.number) await k.locator('input:not([type=file]):not([type=hidden])').first().fill(o.number);
    if (o.expiryNextMonthDay) {
      await k.locator('button.crm-date-field-trigger').click();
      await this.page.locator('button.crm-calendar-nav-button[aria-label="Next month"]').click();
      await this.page.locator('button.crm-calendar-day:not(.is-outside)').filter({ hasText: new RegExp(`^${o.expiryNextMonthDay}$`) }).click();
      const set = this.page.locator('button.crm-date-field-set-button');
      if (await set.isVisible().catch(() => false)) await set.click();
    }
    if (o.file) await k.locator('input[type=file]').setInputFiles(o.file);
    const posted = this.page.waitForResponse(r => /\/api\/v1\/kyc\/customers\/[0-9a-f-]{36}\/documents$/.test(r.url()) && r.request().method() === 'POST', { timeout: ms }).catch(() => null);
    await k.getByRole('button', { name: 'Upload', exact: true }).click();
    return posted;
  }

  // ── brokers ─────────────────────────────────────────────────────────────
  get brokerForm(): Locator { return this.page.locator(CB.brokerForm); }
  brokerField(name: string): Locator { return this.page.locator(CB.brokerField(name)); }
  get credentials(): Locator { return this.x(CB.credentialsDialog); }

  async openNewBroker() {
    await this.showTab('Brokers');
    await this.x(CB.newBroker).click();
    await expect(this.brokerForm).toBeVisible();
    await expect(this.brokerForm.locator('h3')).toHaveText('Create Broker');
  }
  /** Opens a broker from the register by its code. */
  async openBroker(code: string) {
    await this.showTab('Brokers');
    await this.search(code);
    await this.rowsLoc.filter({ hasText: code }).first().click();
    await expect(this.brokerForm).toBeVisible();
    await expect(this.brokerForm.locator('h3')).toHaveText('Edit Broker');
    await expect(this.brokerField('name')).not.toHaveValue('');
  }
  /** Submits the broker form; returns the POST / PATCH response (or null). */
  async submitBroker(ms = 10_000) {
    const saved = this.page.waitForResponse(r => /\/api\/v1\/brokers(\/[0-9a-f-]{36})?$/.test(r.url()) && ['POST', 'PATCH'].includes(r.request().method()), { timeout: ms }).catch(() => null);
    await this.brokerForm.locator('button[type="submit"]').click();
    return saved;
  }
  /** Inline messages under the broker form fields. */
  async brokerErrors(): Promise<string[]> {
    return (await this.brokerForm.locator('.crm-field-error').allInnerTexts()).map(t => t.trim()).filter(Boolean);
  }
}
