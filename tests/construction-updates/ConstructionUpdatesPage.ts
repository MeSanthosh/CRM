/**
 * Page object for /construction-updates (Project Engagement › Construction Updates): the help panel, the Updates
 * list with its search and filters, and the detail panel (empty state, New draft form, Edit update form with its
 * Photo gallery, Publish / Unpublish). Locator strings come from ../locators.ts (CUP).
 */
import { Page, Locator, Request, expect } from '@playwright/test';
import { BasePage } from '../pages/BasePage';
import { ROUTES, CUP } from '../locators';
import { withRequest, stable } from '../opportunities/OpportunitiesPage';

export type UpdateRow = { title: string; project: string; period: string; status: string };
export type UpdateForm = { projectId: string; projectLocked: boolean; period: string; title: string; description: string; portalVisible: boolean; submit: string };
export type PhotoCard = { text: string; src: string; loaded: boolean };

/** GET /construction-updates?… — the list request the status and project filters send */
const isListRequest = (r: Request) => r.method() === 'GET' && /\/api\/v1\/construction-updates(\?|$)/.test(r.url());

export class ConstructionUpdatesPage extends BasePage {
  readonly path = ROUTES.constructionUpdates;
  readonly name = 'Construction Updates';

  constructor(page: Page) { super(page); }
  private x(xpath: string): Locator { return this.page.locator(`xpath=${xpath}`); }

  /** Opens the page and waits until the list has loaded (rows, or the empty-list row). */
  async open() {
    await super.open();
    await this.listLoaded();
  }

  private async listLoaded() {
    await expect(this.page.locator(CUP.rows).first().or(this.page.locator(CUP.emptyRow))).toBeVisible({ timeout: 20_000 });
    await stable(() => this.rows());
  }

  // ── header and help panel ──
  get eyebrow(): Locator { return this.page.locator(CUP.eyebrow); }
  get intro(): Locator { return this.page.locator(CUP.intro); }
  headerButton(name: 'Hide tips' | 'Show tips' | 'New Update'): Locator { return this.x(CUP.headerButton(name)); }
  get help(): Locator { return this.page.locator(CUP.help); }
  get helpSteps(): Locator { return this.page.locator(CUP.helpSteps); }
  get helpTip(): Locator { return this.page.locator(CUP.helpTip); }

  // ── list ──
  get searchBox(): Locator { return this.page.locator(CUP.search); }
  get statusFilter(): Locator { return this.x(CUP.statusFilter); }
  get projectFilter(): Locator { return this.x(CUP.projectFilter); }
  get emptyRow(): Locator { return this.page.locator(CUP.emptyRow); }
  get selectedRow(): Locator { return this.page.locator(CUP.selectedRow); }

  /** N from the "Updates (N)" heading */
  async count(): Promise<number> {
    const text = await this.x(CUP.listCount).innerText();
    return Number(text.match(/\((\d+)\)/)?.[1] ?? NaN);
  }

  async headers(): Promise<string[]> {
    return (await this.page.locator(CUP.tableHeaders).allInnerTexts()).map(t => t.trim());
  }

  async rows(): Promise<UpdateRow[]> {
    return this.page.locator(CUP.rows).evaluateAll(trs => trs.map(tr => {
      const td = Array.from(tr.querySelectorAll('td')).map(c => (c.textContent ?? '').trim());
      return { title: td[0] ?? '', project: td[1] ?? '', period: td[2] ?? '', status: td[3] ?? '' };
    }));
  }

  /** Types in "Search title or project" (the list filters in the browser) and waits for the rows to settle. */
  async search(text: string) {
    await this.searchBox.fill(text);
    await stable(() => this.rows());
  }

  async clearSearch() {
    await this.page.locator(CUP.clearSearch).click();
    await stable(() => this.rows());
  }

  /** Picks a status by its label ("All statuses", "Draft", "Published", "Archived"); waits for the reload. */
  async filterStatus(label: string) {
    await withRequest(this.page, isListRequest, () => this.statusFilter.selectOption({ label }));
    await stable(() => this.rows());
  }

  /** Picks a project by its label ("All projects" or the project name); waits for the reload. */
  async filterProject(label: string) {
    await withRequest(this.page, isListRequest, () => this.projectFilter.selectOption({ label }));
    await stable(() => this.rows());
  }

  async optionLabels(select: Locator): Promise<string[]> {
    return (await select.locator('option').allInnerTexts()).map(t => t.trim());
  }

  // ── detail panel ──
  get detailHeading(): Locator { return this.page.locator(CUP.detailHeading); }
  get detailSubtitle(): Locator { return this.page.locator(CUP.detailSubtitle); }
  get emptyStateHeading(): Locator { return this.page.locator(CUP.emptyStateHeading); }
  get emptyStateText(): Locator { return this.page.locator(CUP.emptyStateText); }
  get emptyStateNew(): Locator { return this.page.locator(CUP.emptyStateNew); }
  publishButton(name: 'Publish' | 'Unpublish'): Locator { return this.x(CUP.publishButton(name)); }
  get headerActions(): Locator { return this.page.locator(CUP.headerActions); }
  get projectSelect(): Locator { return this.page.locator(CUP.project); }
  get periodInput(): Locator { return this.page.locator(CUP.period); }
  get titleInput(): Locator { return this.page.locator(CUP.title); }
  get descriptionInput(): Locator { return this.page.locator(CUP.description); }
  get portalCheckbox(): Locator { return this.page.locator(CUP.portalVisible); }
  get submit(): Locator { return this.page.locator(CUP.submit); }
  fieldError(label: 'Project' | 'Title' | 'Description' | 'Period label'): Locator { return this.x(CUP.fieldError(label)); }
  get fieldErrors(): Locator { return this.page.locator(CUP.fieldErrors); }
  get success(): Locator { return this.page.locator(CUP.success); }
  get error(): Locator { return this.page.locator(CUP.error); }

  /** Clicks a row's title and waits for its Edit update form to hold that update. */
  async openRow(title: string) {
    await this.x(CUP.rowTitle(title)).first().click();
    await expect(this.detailHeading).toHaveText('Edit update');
    await expect(this.titleInput).toHaveValue(title);
    await stable(() => this.form());
  }

  /** Opens the New draft form from the page header (or from the empty detail panel). */
  async newUpdate(from: 'header' | 'panel' = 'header') {
    await (from === 'header' ? this.headerButton('New Update') : this.emptyStateNew).click();
    await expect(this.detailHeading).toHaveText('New draft');
  }

  async form(): Promise<UpdateForm> {
    return {
      projectId: await this.projectSelect.inputValue(),
      projectLocked: await this.projectSelect.isDisabled(),
      period: await this.periodInput.inputValue(),
      title: await this.titleInput.inputValue(),
      description: await this.descriptionInput.inputValue(),
      portalVisible: await this.portalCheckbox.isChecked(),
      submit: (await this.submit.innerText()).trim(),
    };
  }

  /** Fills the form fields that are given; leaves the others as they are. */
  async fill(v: Partial<{ projectLabel: string; period: string; title: string; description: string; portalVisible: boolean }>) {
    if (v.projectLabel !== undefined) await this.projectSelect.selectOption({ label: v.projectLabel });
    if (v.period !== undefined) await this.periodInput.fill(v.period);
    if (v.title !== undefined) await this.titleInput.fill(v.title);
    if (v.description !== undefined) await this.descriptionInput.fill(v.description);
    if (v.portalVisible !== undefined) await this.portalCheckbox.setChecked(v.portalVisible);
  }

  // ── photo gallery ──
  get gallery(): Locator { return this.x(CUP.gallery); }
  get galleryText(): Locator { return this.x(CUP.galleryText); }
  get captionInput(): Locator { return this.page.locator(CUP.caption); }
  get addPhoto(): Locator { return this.page.locator(CUP.addPhoto); }
  get fileInput(): Locator { return this.page.locator(CUP.fileInput); }
  get noPhotos(): Locator { return this.x(CUP.noPhotos); }
  photoCard(text: string): Locator { return this.x(CUP.photoCard(text)); }

  async photos(): Promise<PhotoCard[]> {
    return this.page.locator(CUP.photoCards).evaluateAll(figs => figs.map(f => {
      const img = f.querySelector('img');
      return {
        text: (f.querySelector('figcaption span')?.textContent ?? '').trim(),
        src: img?.getAttribute('src') ?? '',
        loaded: !!img && img.complete && img.naturalWidth > 0,
      };
    }));
  }

  /** Types the caption (optional) and picks the file in "Add Photo"; returns the upload response once it arrives. */
  async uploadPhoto(file: string, caption = '') {
    await this.captionInput.fill(caption);
    const res = this.page.waitForResponse(r => r.request().method() === 'POST' && /\/construction-updates\/[0-9a-f-]{36}\/photos$/.test(r.url()), { timeout: 30_000 });
    await this.fileInput.setInputFiles(file);
    const r = await res;
    await expect(this.addPhoto).toHaveText(/Add Photo/, { timeout: 30_000 });
    return r;
  }

  /** Clicks Publish / Unpublish; returns the publish response once it arrives. */
  async togglePublish(name: 'Publish' | 'Unpublish') {
    const res = this.page.waitForResponse(r => r.request().method() === 'POST' && /\/construction-updates\/[0-9a-f-]{36}\/publish$/.test(r.url()), { timeout: 30_000 });
    await this.publishButton(name).click();
    return res;
  }

  /** Clicks Save Draft / Save Changes; returns the create (POST) or save (PATCH) response once it arrives. */
  async save() {
    const res = this.page.waitForResponse(r => ['POST', 'PATCH'].includes(r.request().method()) && /\/construction-updates(\/[0-9a-f-]{36})?$/.test(r.url()), { timeout: 30_000 });
    await this.submit.click();
    return res;
  }

  async removePhoto(text: string) {
    await this.photoCard(text).first().getByRole('button', { name: 'Remove' }).click();
  }
}
