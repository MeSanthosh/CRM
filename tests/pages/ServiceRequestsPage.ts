/**
 * Service Requests (After-Sales) → /service-requests: staff ticket queue on the left; on the right
 * "Select a request", the "New service request" form, or the open ticket (fields, timeline, history,
 * conversation, attachments). Run alone: npm run test:service-requests
 */
import { Response, expect } from '@playwright/test';
import { ROUTES, SR_TEXT, SR_XP as X, at } from '../locators';
import { BasePage } from './BasePage';

export type QueueRow = { requestNo: string; subject: string; customer: string; priority: string; status: string; opened: string };
export type ApiTicket = {
  id: string; requestNo: string; subject: string; description?: string; openedAt: string;
  customer: { name: string }; priority?: { name: string } | null; status?: { name: string } | null;
};
export type QueueResponse = { items: ApiTicket[]; totalCount: number };
export type NewRequest = { customer?: string; type?: string; priority?: string; subject?: string; description?: string };
export type Comment = { staff: boolean; author: string; time: string; body: string };

const API = '/service-requests';
const pathOf = (r: Response) => new URL(r.url()).pathname;
/** API calls only: the page itself is also served at /service-requests. */
const isApi = (r: Response, method: string) => r.request().method() === method && ['xhr', 'fetch'].includes(r.request().resourceType());
const isList = (r: Response) => isApi(r, 'GET') && pathOf(r).endsWith(API);
const isDetail = (r: Response) => isApi(r, 'GET') && /\/service-requests\/[^/]+$/.test(pathOf(r));
const isPost = (suffix: RegExp) => (r: Response) => isApi(r, 'POST') && suffix.test(pathOf(r));

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** "25 Sept 2026, 22:09" → Date (NaN when the text is not a date in that format). */
export function parseOpened(text: string): Date {
  const m = text.trim().match(/^(\d{1,2}) ([A-Za-z]+)\.? (\d{4}),? (\d{1,2}):(\d{2})$/);
  const month = m ? MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) : -1;
  if (!m || month < 0) return new Date(NaN);
  return new Date(Number(m[3]), month, Number(m[1]), Number(m[4]), Number(m[5]));
}

export class ServiceRequestsPage extends BasePage {
  readonly path = ROUTES.serviceRequests;
  readonly name = 'Service Requests';
  /** Last queue response (GET /service-requests) seen by open(), search() or filterStatus(). */
  lastQueue?: QueueResponse;

  /** Locator for any SR_XP entry. */
  x(xpath: string) {
    return at(this.page, xpath);
  }

  /** Opens the page and waits until the queue matches the API response. */
  async open() {
    const resp = this.page.waitForResponse(isList, { timeout: 30_000 }).catch(() => null);
    await super.open();
    await this.settleQueue(await resp);
  }

  // ── Header and help ─────────────────────────────────────────────────────────
  get tipsButton() { return this.x(X.tipsButton); }
  get newRequestButton() { return this.x(X.newRequest); }
  get helpPanel() { return this.x(X.helpPanel); }
  get successBanner() { return this.x(X.successBanner); }

  // ── Queue ───────────────────────────────────────────────────────────────────
  get queueHeading() { return this.x(X.queueHeading); }
  get searchBox() { return this.x(X.search); }
  get statusFilter() { return this.x(X.statusFilter); }
  get rowLocator() { return this.x(X.queueRows); }
  get emptyRow() { return this.x(X.queueEmpty); }

  /** N from "Queue (N)". */
  async queueCount(): Promise<number> {
    const m = (await this.queueHeading.innerText()).match(/Queue \((\d+)\)/);
    if (!m) throw new Error(`Unexpected queue heading "${await this.queueHeading.innerText()}"`);
    return Number(m[1]);
  }

  async rows(): Promise<QueueRow[]> {
    return this.rowLocator.evaluateAll(trs => trs.map(tr => {
      const td = [...tr.querySelectorAll(':scope > td')] as HTMLElement[];
      const txt = (e: Element | null | undefined) => (e?.textContent ?? '').trim();
      return {
        requestNo: txt(td[0]?.querySelector('button')), subject: txt(td[0]?.querySelector(':scope > span')),
        customer: txt(td[1]), priority: txt(td[2]), status: txt(td[3]), opened: txt(td[4]),
      };
    }));
  }

  async row(requestNo: string): Promise<QueueRow | undefined> {
    return (await this.rows()).find(r => r.requestNo === requestNo);
  }

  /**
   * Types in the search box and waits for the queue to reload with that search. Retries: shortly after loading,
   * the page can re-render and drop what was typed (seen on QA as an empty search box and the full queue).
   */
  async search(text: string) {
    let attempt = 0;
    await expect(async () => {
      if (attempt++) await this.searchBox.fill(text === '' ? ' ' : '');
      await this.reloadQueue(() => this.searchBox.fill(text), sp => [text, text.trim()].includes(sp.get('search') ?? ''));
      await expect(this.searchBox).toHaveValue(text, { timeout: 1_000 });
    }).toPass({ timeout: 45_000 });
  }

  /** Statuses in the filter (option labels, without "All statuses"). Waits for the statuses to load. */
  async statusOptions(): Promise<string[]> {
    await expect.poll(() => this.statusFilter.locator('option').count(), { message: 'Status filter loaded' }).toBeGreaterThan(1);
    return (await this.statusFilter.locator('option').allInnerTexts()).map(o => o.trim()).slice(1);
  }

  /** Selects a status by its label ("All statuses" for every status) and waits for the queue to reload. */
  async filterStatus(label: string) {
    const options = await this.statusFilter.locator('option').evaluateAll(os =>
      os.map(o => ({ value: (o as HTMLOptionElement).value, label: (o.textContent ?? '').trim() })));
    const option = options.find(o => o.label === label);
    if (!option) throw new Error(`Status "${label}" is not in the filter: ${options.map(o => o.label).join(', ')}`);
    if ((await this.statusFilter.inputValue()) === option.value) return;
    await this.reloadQueue(() => this.statusFilter.selectOption(option.value), sp => (sp.get('statusCode') ?? '') === option.value);
  }

  private async reloadQueue(change: () => Promise<unknown>, matches: (params: URLSearchParams) => boolean) {
    const resp = this.page.waitForResponse(r => isList(r) && matches(new URL(r.url()).searchParams), { timeout: 10_000 }).catch(() => null);
    await change();
    await this.settleQueue(await resp);
  }

  /** Waits until "Queue (N)" and the rows match the API response (or briefly, when the result came from cache). */
  private async settleQueue(resp: Response | null) {
    if (!resp) return this.page.waitForTimeout(800);
    const body = (await resp.json()) as QueueResponse;
    this.lastQueue = body;
    await expect(this.queueHeading).toHaveText(`Queue (${body.totalCount})`);
    await expect(this.rowLocator).toHaveCount(body.items.length);
  }

  /** Opens a ticket by clicking its request number (or another cell of its row) and waits for its details. */
  async openTicket(requestNo: string, how: 'link' | 'row' = 'link') {
    // Retries: a click can be lost when the queue re-renders (another worker updating a ticket), leaving "Select a request".
    await expect(async () => {
      const resp = this.page.waitForResponse(isDetail, { timeout: 15_000 }).catch(() => null);
      if (how === 'link') await this.x(X.requestLink(requestNo)).click();
      else await this.x(X.queueRow(requestNo)).locator('td').nth(3).click();
      await resp;
      await expect(this.detailTitle).toHaveText(new RegExp(`^${requestNo} — `), { timeout: 5_000 });
    }).toPass({ timeout: 45_000 });
  }

  /** Reloads the page, searches the ticket and opens it. */
  async reopen(requestNo: string) {
    await this.open();
    await this.search(requestNo);
    await this.openTicket(requestNo);
  }

  // ── Detail panel ────────────────────────────────────────────────────────────
  get emptyState() { return this.x(X.emptyState); }
  get detailTitle() { return this.x(X.detailTitle); }
  get detailSubtitle() { return this.x(X.detailSubtitle); }
  get detailDescription() { return this.x(X.detailDescription); }

  field(label: string) {
    return this.x(X.field(label));
  }

  /** Text of the selected option of a dropdown field. */
  async selected(label: string): Promise<string> {
    return (await this.field(label).locator('option:checked').innerText()).trim();
  }

  async options(label: string): Promise<string[]> {
    return (await this.field(label).locator('option').allInnerTexts()).map(o => o.trim());
  }

  /** Changes Status / Priority / Type / Assigned to on the open ticket and waits until it is saved. */
  async setField(label: string, option: string) {
    const patch = this.page.waitForResponse(r => isApi(r, 'PATCH') && pathOf(r).includes(API), { timeout: 15_000 });
    await this.field(label).selectOption({ label: option });
    const r = await patch;
    expect(r.ok(), `Saving ${label} = "${option}" → HTTP ${r.status()}`).toBeTruthy();
    await expect(this.successBanner).toHaveText(SR_TEXT.updated);
    await expect(this.field(label).locator('option:checked')).toHaveText(option);
  }

  /** Progress timeline: status and "date · user" of each entry, oldest first. */
  async timeline(): Promise<{ status: string; meta: string }[]> {
    return this.x(X.timelineItems).evaluateAll(lis => lis.map(li => ({
      status: (li.querySelector('strong')?.textContent ?? '').trim(),
      meta: (li.querySelector('span')?.textContent ?? '').trim(),
    })));
  }

  /** Clicks History → Refresh and waits until it has reloaded. */
  async refreshHistory() {
    const refresh = this.x(X.historyRefresh);
    await refresh.click();
    await expect(refresh).toHaveText('Refresh');
    await expect(refresh).toBeEnabled();
  }

  /** Text of every History entry (expands "Show all" first). */
  async historyEntries(): Promise<string[]> {
    const all = this.x(X.historyShowAll);
    if (await all.count()) await all.click();
    return (await this.x(X.historyEntries).allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
  }

  async comments(): Promise<Comment[]> {
    return this.x(X.comments).evaluateAll(bs => bs.map(b => ({
      staff: b.classList.contains('is-staff'),
      author: (b.querySelector('header strong')?.textContent ?? '').trim(),
      time: (b.querySelector('header span')?.textContent ?? '').trim(),
      body: (b.querySelector(':scope > p')?.textContent ?? '').trim(),
    })));
  }

  get replyBox() { return this.x(X.replyBox); }
  get postReplyButton() { return this.x(X.postReply); }

  /** Posts a reply to the customer and waits for the confirmation. */
  async reply(text: string) {
    const post = this.page.waitForResponse(isPost(/\/comments$/), { timeout: 15_000 });
    await this.replyBox.fill(text);
    await this.postReplyButton.click();
    const r = await post;
    expect(r.ok(), `Posting the reply → HTTP ${r.status()}`).toBeTruthy();
    await expect(this.successBanner).toHaveText(SR_TEXT.replyPosted);
  }

  /** Uploads a file through "Add File"; returns the upload response. */
  async upload(name: string, content: string, mimeType = 'text/plain'): Promise<Response> {
    const post = this.page.waitForResponse(isPost(/\/attachments$/), { timeout: 60_000 });
    await this.x(X.fileInput).setInputFiles({ name, mimeType, buffer: Buffer.from(content) });
    return post;
  }

  async attachments(): Promise<{ name: string; href: string; target: string }[]> {
    return this.x(X.attachmentLinks).evaluateAll(as => as.map(a => ({
      name: (a.textContent ?? '').trim(), href: (a as HTMLAnchorElement).href, target: (a as HTMLAnchorElement).target,
    })));
  }

  // ── New service request form ────────────────────────────────────────────────
  get formTitle() { return this.x(X.detailTitle).filter({ hasText: SR_TEXT.formTitle }); }
  get createButton() { return this.x(X.createButton); }
  get cancelButton() { return this.x(X.cancel); }

  /** Opens the New service request form (retries the click: an early re-render can drop it, like the search). */
  async openForm(from: 'header' | 'empty' = 'header') {
    const button = from === 'header' ? this.newRequestButton : this.x(X.emptyNewRequest);
    await expect(async () => {
      if (!(await this.formTitle.isVisible())) await button.click();
      await expect(this.formTitle).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
  }

  /** Customer options as shown ("Name (CODE)"), without "Select customer". Waits for the list to load; reopens the form
   *  if a queue re-render closed it meanwhile (the panel falls back to "Select a request"). */
  async customerOptions(): Promise<string[]> {
    const select = this.field('Customer');
    await expect.poll(async () => {
      if (!(await this.formTitle.isVisible())) await this.openForm();
      return select.locator('option').count();
    }, { message: 'Customer list loaded', timeout: 20_000 }).toBeGreaterThan(1);
    return (await select.locator('option').allInnerTexts()).map(o => o.trim()).slice(1);
  }

  /** Customer to use for created tickets: SR_CUSTOMER from .env, else a "QA Test" customer, else the first one. */
  async testCustomer(): Promise<string> {
    const all = await this.customerOptions();
    const wanted = process.env.SR_CUSTOMER?.trim().toLowerCase();
    const pick = (wanted && all.find(o => o.toLowerCase().includes(wanted))) || all.find(o => /qa test/i.test(o)) || all[0];
    if (wanted && !pick.toLowerCase().includes(wanted)) throw new Error(`SR_CUSTOMER "${process.env.SR_CUSTOMER}" is not in the customer list`);
    return pick;
  }

  async fillForm(r: NewRequest) {
    if (r.customer !== undefined) await this.field('Customer').selectOption({ label: r.customer });
    if (r.type !== undefined) await this.field('Type').selectOption({ label: r.type });
    if (r.priority !== undefined) await this.field('Priority').selectOption({ label: r.priority });
    if (r.subject !== undefined) await this.field('Subject').fill(r.subject);
    if (r.description !== undefined) await this.field('Description').fill(r.description);
  }

  /** Submits the form and returns the created ticket (POST /service-requests response). */
  async create(r: NewRequest): Promise<ApiTicket> {
    await this.fillForm(r);
    const post = this.page.waitForResponse(isPost(/\/service-requests$/), { timeout: 30_000 });
    await this.createButton.click();
    const resp = await post;
    expect(resp.ok(), `Creating the request → HTTP ${resp.status()}`).toBeTruthy();
    return resp.json();
  }

  /** Counts POST /service-requests calls from now on (to prove a form did not submit). */
  countCreateCalls(): () => number {
    let n = 0;
    this.page.on('request', q => { if (q.method() === 'POST' && /\/service-requests$/.test(new URL(q.url()).pathname)) n++; });
    return () => n;
  }

  /** The "… is required." message shown inside a field's label. */
  fieldError(label: string) {
    return this.x(X.fieldLabel(label)).getByText(/ is required\.$/);
  }

  async isInvalid(label: string): Promise<boolean> {
    return /\bis-invalid\b/.test((await this.field(label).getAttribute('class')) ?? '');
  }
}
