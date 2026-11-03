/**
 * Page object for /opportunities: KPI cards, the List view (search, sort, paging), the Board view and
 * the Opportunity Detail modal with its workflow forms. Locator strings come from ../locators.ts (OPP).
 */
import { Page, Locator, Request, Response, expect } from '@playwright/test';
import { BasePage } from '../pages/BasePage';
import { ROUTES, OPP, OPPORTUNITY_KPIS, OPPORTUNITY_COLUMNS } from '../locators';
import { parseNum } from '../helpers';

export type OppRow = {
  opp: string; lead: string; customer: string; stage: string; probability: string;
  budget: string; project: string; created: string; href: string;
};
export type BoardColumn = { stage: string; count: number; value: string; weighted: string; collapsed: boolean };
export type BoardCard = { oppNo: string; customer: string; value: string; tags: string[]; stale: boolean; reserved: boolean; owner: string; moves: { label: string; disabled: boolean }[] };
export type Step = { name: string; state: 'done' | 'current' | 'next' | 'other'; text: string };

const isList = (r: Request) => /\/api\/v1\/opportunities\?/.test(r.url()) && r.method() === 'GET';
const isBoard = (r: Request) => /\/api\/v1\/opportunities\/board\?/.test(r.url()) && r.method() === 'GET';
/** A view the app has already loaded comes from its cache: if no request goes out within this time, none is coming. */
const SENT_MS = 1_500;
/** Longest wait for a list or board response under load. */
const LOAD_MS = 30_000;

/**
 * Runs `fn`; when it sends a request matching `isReq`, waits for the response of the last one sent
 * (that is the one the page shows). Clearing a search or going back to page 1 is served from the app's
 * cache and sends nothing, so only SENT_MS is spent waiting in that case.
 */
export async function withRequest(page: Page, isReq: (r: Request) => boolean, fn: () => Promise<unknown>) {
  const sent: Request[] = [];
  const onRequest = (r: Request) => { if (isReq(r)) sent.push(r); };
  page.on('request', onRequest);
  try {
    await fn();
    await expect.poll(() => sent.length, { timeout: SENT_MS }).toBeGreaterThan(0).catch(() => {});
    if (sent.length) {
      const last = sent[sent.length - 1];
      await Promise.race([last.response(), new Promise(r => setTimeout(r, LOAD_MS))]);
    }
  } finally {
    page.off('request', onRequest);
  }
}

/** Reads until two reads `ms` apart agree (the app re-renders after its data arrives); returns that value. */
export async function stable<T>(read: () => Promise<T>, ms = 300): Promise<T> {
  let last = JSON.stringify(await read());
  let value!: T;
  await expect.poll(async () => {
    value = await read();
    const now = JSON.stringify(value);
    const same = now === last;
    last = now;
    return same;
  }, { intervals: [ms] }).toBe(true);
  return value;
}
const isRecord = (r: Response) => /\/api\/v1\/opportunities\/[0-9a-f-]{36}$/.test(r.url()) && r.request().method() === 'GET';

/** "15 Nov 2026, 11:00" style date-time shown by the app, from a Date in the browser's time zone. */
export const shownDateTime = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('en-GB', { month: 'short' })} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export class OpportunitiesPage extends BasePage {
  readonly path = ROUTES.opportunities;
  readonly name = 'Opportunities';
  readonly kpiLabels = OPPORTUNITY_KPIS;
  readonly columns = OPPORTUNITY_COLUMNS;

  constructor(page: Page) { super(page); }

  // ── list ────────────────────────────────────────────────────────────────
  get searchBox(): Locator { return this.page.locator(OPP.search); }
  get clearSearchButton(): Locator { return this.page.locator(OPP.searchClear); }
  get exportButton(): Locator { return this.page.locator(OPP.exportButton); }
  get emptyState(): Locator { return this.page.locator(`xpath=${OPP.empty}`); }
  get pager(): Locator { return this.page.locator(OPP.pager); }
  pagerButton(name: 'Previous' | 'Next'): Locator { return this.page.locator(`xpath=${OPP.pagerButton(name)}`); }
  viewButton(name: 'List' | 'Board'): Locator { return this.page.locator(`xpath=${OPP.viewToggle(name)}`); }
  sortHeader(column: string): Locator { return this.page.locator(`xpath=${OPP.sortHeader(column)}`); }
  kpiFormula(label: string): Locator { return this.page.locator(`xpath=${OPP.kpiFormula(label)}`); }

  /**
   * Opens the page in the List view and waits for its first page of records. The app saves List/Board per
   * user, so the page can open on the Board (left there by another test or session).
   */
  async open() {
    await withRequest(this.page, r => isList(r) || isBoard(r), () => super.open());
    await expect(this.viewButton('List')).toBeVisible();
    if ((await this.viewButton('List').getAttribute('aria-pressed')) !== 'true') {
      await this.reload(() => this.viewButton('List').click());
    }
    await this.listSettled();
  }

  /** Runs `fn` (search, sort, paging), waits for the list request it sends (if any), then for the table to settle. */
  async reload(fn: () => Promise<unknown>, match: (params: URLSearchParams) => boolean = () => true) {
    await withRequest(this.page, r => isList(r) && match(new URL(r.url()).searchParams), fn);
    await this.listSettled();
  }

  /** Table and pager text (no waiting: empty when not shown). */
  private async listText() {
    const table = (await this.page.locator(OPP.table).allInnerTexts()).join('\n');
    const pager = (await this.pager.allInnerTexts()).join('\n');
    return `${table}\n${pager}`;
  }

  /** Waits until the table shows rows or the empty state, and the row text stops changing. */
  async listSettled() {
    await expect(this.page.locator(OPP.rows).first()).toBeVisible();
    await stable(() => this.listText());
  }

  async headers(): Promise<string[]> {
    return (await this.page.locator(OPP.headerCells).allInnerTexts()).map(t => t.replace(/[↕▲▼]/g, '').trim());
  }

  /** Rows on the current page (empty when the "No opportunities found." row is shown). */
  async rows(): Promise<OppRow[]> {
    if (await this.emptyState.count()) return [];
    return this.page.locator(OPP.rows).evaluateAll(trs => trs.map(tr => {
      const td = Array.from(tr.querySelectorAll('td'));
      const t = (i: number) => (td[i]?.textContent ?? '').trim();
      const a = td[0]?.querySelector('a');
      return {
        opp: (a?.textContent ?? '').trim(), lead: (td[0]?.querySelector('span')?.textContent ?? '').trim(),
        customer: t(1), stage: t(2), probability: t(3), budget: t(4), project: t(5), created: t(6), href: a?.getAttribute('href') ?? '',
      };
    }));
  }

  /** "Showing 1–20 of 130 opportunities · Page 1 of 7" → numbers. */
  async pagerInfo() {
    const t = (await this.pager.innerText()).replace(/,/g, '');
    const m = t.match(/Showing\s+(\d+)\D+(\d+)\s+of\s+(\d+).*Page\s+(\d+)\s+of\s+(\d+)/i);
    if (!m) throw new Error(`Unexpected pager text "${t}"`);
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

  /** Clicks a column header; returns the aria-sort it ends with. */
  async sortBy(column: string): Promise<string> {
    await this.reload(() => this.sortHeader(column).locator('button').click());
    return (await this.sortHeader(column).getAttribute('aria-sort')) ?? 'none';
  }

  /** Clicks a column header until it shows the wanted direction. */
  async sortTo(column: string, dir: 'ascending' | 'descending') {
    for (let i = 0; i < 3 && (await this.sortHeader(column).getAttribute('aria-sort')) !== dir; i++) await this.sortBy(column);
    expect(await this.sortHeader(column).getAttribute('aria-sort'), `${column} sorted ${dir}`).toBe(dir);
  }

  /** Every row of every page, following "Page N of M" (Next is briefly disabled while a page loads). */
  async allRows(maxPages = 50): Promise<OppRow[]> {
    const out = await this.rows();
    if (!(await this.pager.count())) return out;
    for (let info = await this.pagerInfo(); info.page < info.pages && info.page < maxPages; info = await this.pagerInfo()) {
      await expect(this.pagerButton('Next')).toBeEnabled();
      await this.reload(() => this.pagerButton('Next').click());
      await expect.poll(async () => (await this.pagerInfo()).page, { message: `Next → page ${info.page + 1}` }).toBe(info.page + 1);
      out.push(...await this.rows());
    }
    return out;
  }

  // ── board ───────────────────────────────────────────────────────────────
  async showBoard() {
    if ((await this.viewButton('Board').getAttribute('aria-pressed')) === 'true') return;
    await withRequest(this.page, isBoard, () => this.viewButton('Board').click());
    await expect(this.page.locator(OPP.boardColumns).first()).toBeVisible();
    await this.boardSettled();
  }

  async showList() {
    if ((await this.viewButton('List').getAttribute('aria-pressed')) === 'true') return;
    await this.viewButton('List').click();
    await this.listSettled();
  }

  boardFilter(aria: 'Owner' | 'Project' | 'Closed deals'): Locator { return this.page.locator(OPP.boardFilter(aria)); }

  async boardOptions(aria: 'Owner' | 'Project' | 'Closed deals') {
    return this.boardFilter(aria).locator('option').evaluateAll(os => os.map(o => ({ value: (o as HTMLOptionElement).value, label: (o.textContent ?? '').trim() })));
  }

  async setBoardFilter(aria: 'Owner' | 'Project' | 'Closed deals', value: string) {
    if ((await this.boardFilter(aria).inputValue()) === value) return;
    await withRequest(this.page, isBoard, () => this.boardFilter(aria).selectOption(value));
    await expect(this.page.locator(OPP.boardColumns).first()).toBeVisible();
    await this.boardSettled();
  }

  /** Waits until the board's columns stop changing. */
  async boardSettled() {
    await stable(() => this.boardColumns());
  }

  async boardColumns(): Promise<BoardColumn[]> {
    return this.page.locator(OPP.boardColumns).evaluateAll((cols, sel) => cols.map(c => ({
      stage: c.getAttribute('aria-label') ?? '',
      count: Number((c.querySelector(sel.count)?.textContent ?? '').replace(/\D/g, '') || 0),
      value: (c.querySelector(sel.value)?.textContent ?? '').trim(),
      weighted: (c.querySelector(sel.weighted)?.textContent ?? '').trim(),
      collapsed: c.classList.contains('is-collapsed'),
    })), { count: OPP.boardColumnCount, value: OPP.boardColumnValue, weighted: OPP.boardColumnWeighted });
  }

  /** "Open pipeline: 47 deals · 2.18B USD · weighted 1.65B USD" */
  async boardSummary() {
    const t = (await this.page.locator(OPP.boardSummary).innerText()).replace(/\s+/g, ' ');
    const m = t.match(/Open pipeline:\s*([\d,]+)\s*deals\s*·\s*(.+?)\s*·\s*weighted\s*(.+)$/i);
    if (!m) throw new Error(`Unexpected board summary "${t}"`);
    return { deals: Number(m[1].replace(/,/g, '')), value: m[2].trim(), weighted: m[3].trim(), text: t };
  }

  boardCard(oppNo: string): Locator { return this.page.locator(OPP.boardCardFor(oppNo)); }

  /** Cards in a board column. Won and Lost start collapsed ("Closed last 30 days · Show"), so they are expanded first. */
  async boardCards(stage: string): Promise<BoardCard[]> {
    const column = this.page.locator(OPP.boardColumn(stage));
    const show = column.locator(OPP.boardColumnShow);
    const count = (await this.boardColumns()).find(c => c.stage === stage)?.count ?? 0;
    if (count && await show.count()) {
      // Show/Hide is saved per user, so another session can toggle it back meanwhile: retry until cards show
      await expect(async () => {
        if (await show.count()) await show.click();
        await expect(column.locator(OPP.boardCard).first()).toBeVisible({ timeout: 2_000 });
      }, `${stage} column expands`).toPass({ timeout: 15_000 });
    }
    return column.locator(OPP.boardCard).evaluateAll((cards, moveSel) => cards.map(c => {
      const top = c.querySelector('.crm-board-card-top');
      const footer = c.querySelector('.crm-board-card-footer');
      return {
        oppNo: (c.querySelector('.crm-board-card-meta')?.textContent ?? '').split('·')[0].trim(),
        customer: (top?.querySelector('strong')?.textContent ?? '').trim(),
        value: (top?.querySelector('.crm-board-card-value')?.textContent ?? '').trim(),
        tags: Array.from(c.querySelectorAll('.crm-board-tag')).map(t => (t.textContent ?? '').trim()),
        stale: !!c.querySelector('.crm-board-tag.is-stale'),
        reserved: !!c.querySelector('.crm-board-tag.is-reserved'),
        owner: (footer?.querySelector('span')?.textContent ?? '').trim(),
        moves: Array.from(c.querySelectorAll(`${moveSel} option`)).slice(1).map(o => ({ label: (o.textContent ?? '').trim(), disabled: (o as HTMLOptionElement).disabled })),
      };
    }), OPP.boardMoveSelect);
  }

  /** Searches while the Board is shown (the board reloads; there is no table to wait for). */
  async searchBoard(text: string) {
    if ((await this.searchBox.inputValue()) === text) return;
    await withRequest(this.page, r => isBoard(r) && (new URL(r.url()).searchParams.get('search') ?? '') === text, () => this.searchBox.fill(text));
    await expect(this.page.locator(OPP.boardColumns).first()).toBeVisible();
    await this.boardSettled();
  }

  /** The Show / Hide button of a Won or Lost column. */
  columnToggle(stage: string): Locator { return this.page.locator(OPP.boardColumn(stage)).locator(OPP.boardColumnToggle); }
  async collapsed(stage: string): Promise<boolean> {
    return this.page.locator(OPP.boardColumn(stage)).evaluate(c => c.classList.contains('is-collapsed'));
  }
  get lostDialog(): Locator { return this.page.locator(`xpath=${OPP.boardLostDialog}`); }
  get cantMoveDialog(): Locator { return this.page.locator(`xpath=${OPP.boardCantMoveDialog}`); }

  /** Chooses an option of a card's "Move / mark Lost…" menu by its label (e.g. "Lost"). */
  async moveCard(oppNo: string, label: string) {
    const sel = this.boardCard(oppNo).locator(OPP.boardMoveSelect);
    const value = await sel.locator('option').filter({ hasText: new RegExp(`^${label}$`) }).getAttribute('value');
    await sel.selectOption(value!);
  }

  /** Drags a card onto another column. */
  async dragCard(oppNo: string, stage: string) {
    await this.boardCard(oppNo).dragTo(this.page.locator(OPP.boardColumn(stage)));
  }

  // ── detail modal ────────────────────────────────────────────────────────
  get detail(): Locator { return this.page.locator(`xpath=${OPP.detail}`); }
  fact(label: string): Locator { return this.page.locator(`xpath=${OPP.detailFact(label)}`); }
  get status(): Locator { return this.page.locator(`xpath=${OPP.detailStatus}`); }
  section(heading: string): Locator { return this.page.locator(`xpath=${OPP.detailSection(heading)}`); }
  get visitForm(): Locator { return this.page.locator(`xpath=${OPP.visitForm}`); }
  get lostForm(): Locator { return this.page.locator(`xpath=${OPP.lostForm}`); }
  get noteForm(): Locator { return this.page.locator(`xpath=${OPP.noteForm}`); }
  get notice(): Locator { return this.page.locator(OPP.notice); }

  /** Waits for the detail modal to finish loading the record. */
  async detailLoaded(oppNo?: string) {
    await expect(this.detail, 'Opportunity Detail opens').toBeVisible();
    await expect(this.page.locator(`xpath=${OPP.detailLoading}`)).toHaveCount(0, { timeout: 20_000 });
    if (oppNo) await expect(this.page.locator(`xpath=${OPP.detailSubtitle}`)).toContainText(oppNo);
    await expect(this.page.locator(`xpath=${OPP.workflowStep}`).first()).toBeVisible();
    // workflow states fill in after the modal's reservation / contract / unit-hold lookups return
    await this.page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  }

  /** Finds a record with the list search and opens it; returns the API response of the record. */
  async openRecord(oppNo: string) {
    await this.showList();
    await this.search(oppNo);
    const link = this.page.locator(OPP.rows).locator(OPP.rowLink).filter({ hasText: new RegExp(`^${oppNo}$`) });
    const record = this.page.waitForResponse(isRecord);
    await link.click();
    const res = await record;
    await this.detailLoaded(oppNo);
    return res.json();
  }

  async closeDetail() {
    await this.page.locator(`xpath=${OPP.detailClose}`).click();
    await expect(this.detail).toHaveCount(0);
  }

  async facts(): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const l of ['Lead', 'Budget', 'Project', 'Unit', 'Probability', 'Expected Close']) out[l] = (await this.fact(l).innerText()).trim();
    return out;
  }

  /** customer, subtitle ("OPP-… · Customer"), status, and the facts Lead, Budget, Project, Unit, Probability, Expected Close. */
  async detailHeader(): Promise<Record<string, string>> {
    return {
      customer: (await this.page.locator(`xpath=${OPP.detailTitle}`).innerText()).trim(),
      subtitle: (await this.page.locator(`xpath=${OPP.detailSubtitle}`).innerText()).trim(),
      status: (await this.status.innerText()).trim(),
      ...(await this.facts()),
    };
  }

  /** Workflow steps with their state, read once they stop changing (states fill in after the steps appear). */
  async workflow(): Promise<Step[]> {
    return stable(() => this.readWorkflow());
  }

  private async readWorkflow(): Promise<Step[]> {
    return this.page.locator(`xpath=${OPP.workflowStep}`).evaluateAll(bs => bs.map(b => ({
      name: (b.querySelector('strong')?.textContent ?? '').trim(),
      text: (b.querySelector('span')?.textContent ?? '').trim(),
      state: b.classList.contains('is-completed') ? 'done' : b.classList.contains('is-current') ? 'current' : b.classList.contains('is-next') ? 'next' : 'other',
    }) as { name: string; text: string; state: 'done' | 'current' | 'next' | 'other' }));
  }

  async formHeadings(): Promise<string[]> {
    return (await this.page.locator(`xpath=${OPP.formHeadings}`).allInnerTexts()).map(t => t.trim());
  }

  /** Title and body of the notice dialog shown after an action (waits for it). */
  async readNotice() {
    await expect(this.notice).toBeVisible();
    return { title: (await this.notice.locator('h3').innerText()).trim(), body: (await this.notice.innerText()).trim() };
  }

  async noticeButton(name: string) {
    await this.notice.getByRole('button', { name, exact: true }).click();
    await expect(this.notice).toHaveCount(0);
  }

  // ── workflow forms ──────────────────────────────────────────────────────
  /** Opens the Visit Date picker on the visit form. */
  async openVisitPicker() {
    await this.visitForm.locator(OPP.visitDateTrigger).click();
    await expect(this.page.locator(OPP.calendarSet)).toBeVisible();
  }

  /** Picks `day` of next month at `time` (HH:MM) in the open picker; returns the trigger's text. */
  async pickVisitDate(day: number, time: string): Promise<string> {
    await this.openVisitPicker();
    await this.page.locator(OPP.calendarNext).click();
    await this.page.locator(OPP.calendarDay).filter({ hasText: new RegExp(`^${day}$`) }).click();
    await this.page.locator(OPP.calendarTime).fill(time);
    await this.page.locator(OPP.calendarSet).click();
    return (await this.visitForm.locator(OPP.visitDateTrigger).innerText()).trim();
  }

  /** Submits the visit form; returns the POST …/site-visits response (or null if none was sent within `ms`). */
  async submitVisit(ms = 10_000) {
    const posted = this.page.waitForResponse(r => /\/site-visits$/.test(r.url()) && r.request().method() === 'POST', { timeout: ms }).catch(() => null);
    await this.visitForm.locator('button[type="submit"]').click();
    return posted;
  }

  async fillLost(reasonLabel: string, remarks: string) {
    if (reasonLabel) await this.lostForm.locator(OPP.lostReason).selectOption({ label: reasonLabel });
    await this.lostForm.locator(OPP.remarks).fill(remarks);
  }

  async clickMarkLost() {
    await this.lostForm.getByRole('button', { name: 'Mark Lost', exact: true }).click();
  }

  async lostReasons(): Promise<string[]> {
    return (await this.lostForm.locator(`${OPP.lostReason} option`).allInnerTexts()).map(t => t.trim()).filter(t => t && t !== 'Select reason');
  }

  /** Adds a note; returns the POST …/opportunities/<id>/… response (or null if none was sent within `ms`). */
  async addNote(text: string, ms = 10_000) {
    await this.noteForm.locator(OPP.noteText).fill(text);
    const posted = this.page.waitForResponse(r => /\/api\/v1\/opportunities\/[0-9a-f-]{36}\/[a-z-]+/.test(r.url()) && r.request().method() === 'POST', { timeout: ms }).catch(() => null);
    await this.noteForm.getByRole('button', { name: 'Add Note', exact: true }).click();
    return posted;
  }
}

/** Mean of "35%"-style tags. */
export const meanPercent = (values: string[]) => values.reduce((a, v) => a + parseNum(v), 0) / values.length;
