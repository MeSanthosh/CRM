/**
 * Create Individual Lead / Create Corporate / Institutional Lead form (/leads/<kind>/new).
 * Fields are addressed by their label on the Form Fields sheet, which maps each label to the
 * field's name in the page (several labels such as "City" or "Country" appear more than once).
 */
import { Page, Locator, expect } from '@playwright/test';
import { Notice, NoticeInfo, pickDate } from './Notice';
import { LeadDetail } from './LeadDetail';
import { XP, at } from '../locators';
import { Form, field, relativeDate } from '../leads-page/test-data';

export type SubmitResult = {
  /** Pop-up shown after Create Lead (undefined: none appeared) */
  notice?: NoticeInfo;
  /** True when the app saved a lead (POST /leads answered 2xx) */
  saved: boolean;
  /** HTTP status of the save request, if one was sent */
  status?: number;
};

export class LeadForm {
  readonly notice: Notice;
  constructor(readonly page: Page, readonly form: Form) {
    this.notice = new Notice(page);
  }

  get kind() {
    return this.form === 'Individual' ? 'individual' : 'corporate';
  }
  get root(): Locator {
    return at(this.page, XP.leadForm);
  }

  /** Opens the form by its address. */
  async open() {
    await this.page.goto(`/leads/${this.kind}/new`);
    await this.waitOpen();
  }

  async waitOpen() {
    await expect(at(this.page, XP.leadFormSubmit)).toBeVisible({ timeout: 20_000 });
    await this.page.waitForLoadState('networkidle').catch(() => {}); // dropdown options load from reference data
  }

  async heading() {
    return (await at(this.page, XP.leadFormHeading).innerText()).trim();
  }
  async sections() {
    return (await at(this.page, XP.leadFormSections).allInnerTexts()).map(s => s.trim());
  }
  async buttonVisible(name: string) {
    return this.root.getByRole('button', { name, exact: true }).isVisible();
  }

  /** Labels marked with * that belong to an editable field. */
  async requiredLabels(): Promise<string[]> {
    return (await at(this.page, XP.leadFormRequiredLabels).allInnerTexts()).map(s => s.replace(/\*/g, '').trim());
  }

  /** The input / select for a label (date pickers: the label.crm-field wrapper). */
  control(label: string): Locator {
    const f = field(this.form, label);
    if (f.type === 'Date picker') return this.root.locator(`xpath=${XP.fieldByLabel(label)}`);
    return at(this.page, XP.leadFormField(f.name));
  }

  /** Enters one value: dropdowns by visible text, date pickers by {today±N} or yyyy-mm-dd, text fields typed. */
  async set(label: string, value: string, opts: { leave?: boolean } = { leave: true }) {
    const f = field(this.form, label);
    const el = this.control(label);
    if (f.type === 'Date picker') {
      const d = relativeDate(value) ?? new Date(value);
      return pickDate(this.page, el, d);
    }
    if (f.type === 'Dropdown') return el.selectOption({ label: value });
    const v = f.type === 'Date' && relativeDate(value) ? (() => { const d = relativeDate(value)!; return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })() : value;
    await el.fill(v);
    if (opts.leave) await el.press('Tab'); // the app checks email / phone formats when the field loses focus
  }

  /** Fills several fields; closes any format pop-up a value raises and returns them. */
  async fill(values: Record<string, string>): Promise<NoticeInfo[]> {
    const raised: NoticeInfo[] = [];
    for (const [label, value] of Object.entries(values)) {
      await this.set(label, value);
      const n = await this.notice.dismiss(300);
      if (n) raised.push(n);
    }
    return raised;
  }

  async clear(label: string) {
    const f = field(this.form, label);
    if (f.type === 'Dropdown') await this.control(label).selectOption({ index: 0 });
    else await this.control(label).fill('');
  }

  async isEditable(label: string) {
    return this.control(label).isEditable();
  }
  async placeholder(label: string) {
    return (await this.control(label).getAttribute('placeholder')) ?? '';
  }

  /** Clicks Create Lead and reports the pop-up and whether a lead was saved. The pop-up is left open. */
  async submit(): Promise<SubmitResult> {
    let status: number | undefined;
    const onResponse = (r: import('@playwright/test').Response) => {
      if (r.request().method() === 'POST' && /\/api\/v1\/leads(\?|$)/.test(r.url())) status = r.status();
    };
    this.page.on('response', onResponse);
    try {
      await at(this.page, XP.leadFormSubmit).click();
      const notice = await this.notice.wait(60_000); // the QA server can take > 20 s to save under load
      await this.page.waitForTimeout(300);
      return { notice, saved: status !== undefined && status < 300, status };
    } finally {
      this.page.off('response', onResponse);
    }
  }

  /** Closes the pop-up left open by submit(). */
  async closeNotice(button?: string) {
    if (await this.notice.visible()) await this.notice.close(button);
  }

  /** After a successful save the Lead Detail panel opens with the new lead. */
  detail(): LeadDetail {
    return new LeadDetail(this.page);
  }

  /** Clicks Close; a "Discard changes?" pop-up (form with data) is answered with `confirm`. Returns that pop-up. */
  async close(confirm?: string): Promise<NoticeInfo | undefined> {
    await at(this.page, XP.leadFormClose).click();
    const asked = await this.notice.wait(2_000);
    if (asked) await this.notice.close(confirm);
    await expect(at(this.page, XP.leadForm)).toHaveCount(0, { timeout: 10_000 });
    return asked;
  }
}
