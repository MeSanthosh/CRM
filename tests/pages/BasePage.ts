/**
 * Page Object Model: one class per screen in tests/pages/. Locator strings come from ../locators.ts
 * (the single source); page classes turn them into actions and reads that specs call.
 */
import { Page, Locator, expect } from '@playwright/test';
import { open, kpi, kpiText, watchErrors } from '../helpers';
import { kpiLocator } from '../locators';

export abstract class BasePage {
  /** Route of the screen, e.g. "/reports/sales". */
  abstract readonly path: string;
  /** Name as shown on its hub card and page heading, e.g. "Sales Reports". */
  abstract readonly name: string;

  private errors?: ReturnType<typeof watchErrors>;

  constructor(readonly page: Page) {}

  /** Starts recording JavaScript errors and failed API calls (call before open()). */
  watchErrors() {
    this.errors = watchErrors(this.page);
    return this.errors;
  }

  /** Opens the screen and waits until its data has loaded. */
  async open() {
    await open(this.page, this.path);
  }

  heading(text = this.name): Locator {
    return this.page.getByRole('heading', { name: text, exact: true });
  }

  kpiValue(label: string): Locator {
    return kpiLocator(this.page, label);
  }

  /** KPI value as shown, e.g. "2.18B USD" (waits until it has loaded). */
  kpiText(label: string) {
    return kpiText(this.page, label);
  }

  /** KPI value as a number, e.g. 2180000000. */
  kpi(label: string) {
    return kpi(this.page, label);
  }

  /** Reads several KPIs: { label: number }. */
  async kpis(labels: string[]): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const l of labels) out[l] = await this.kpi(l);
    return out;
  }

  /** True when the app replaced the page with its "Unexpected Application Error" screen. */
  async crashed(): Promise<boolean> {
    return (await this.page.getByText('Unexpected Application Error').count()) > 0;
  }

  /** No NaN / undefined / Infinity rendered and no crash screen. */
  async expectNoBrokenValues(where = this.name) {
    expect.soft(await this.crashed(), `${where}: app crashed to its error screen`).toBeFalsy();
    if (!(await this.crashed())) {
      await expect.soft(this.page.locator('main'), `${where}: no NaN / undefined / Infinity`)
        .not.toContainText(/\bNaN\b|undefined|Infinity|\[object Object\]/);
    }
  }

  /** JavaScript errors and failed API calls since watchErrors(). */
  expectNoErrors() {
    if (!this.errors) throw new Error('call watchErrors() before open()');
    expect.soft(this.errors.errors, `${this.name}: JavaScript errors`).toEqual([]);
    expect.soft(this.errors.failed, `${this.name}: failed API calls`).toEqual([]);
  }
}
