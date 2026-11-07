/** Reports & Analytics catalogue (/reports-analytics, build v2.0 0411): category tabs and report cards ("Open RPT-05 →"). */
import { expect } from '@playwright/test';
import { REP_XP, ROUTES, at } from '../locators';
import { BasePage } from './BasePage';

export type ReportCard = { code: string; title: string; description: string; columns: string[]; category: string; href: string };

export class ReportCatalogPage extends BasePage {
  readonly path = ROUTES.hub;
  readonly name = 'Reports & Analytics';

  tab(label: string) { return at(this.page, REP_XP.catalogTab(label)); }
  card(code: string) { return at(this.page, REP_XP.catalogCard(code)); }
  get cards() { return at(this.page, REP_XP.catalogCards); }

  /** Clicks a category tab ("Lead Reports") and waits until it is selected. */
  async openTab(label: string) {
    await this.tab(label).click();
    await expect(this.tab(label)).toHaveAttribute('aria-selected', 'true');
  }

  /** Number in the tab's badge, e.g. 7. */
  async tabCount(label: string): Promise<number> {
    return Number((await at(this.page, REP_XP.catalogTabBadge(label)).innerText()).trim());
  }

  async readCard(code: string): Promise<ReportCard> {
    await expect(this.card(code), `Card ${code}`).toBeVisible();
    const text = async (xp: string) => (await at(this.page, xp).innerText()).trim();
    return {
      code,
      title: await text(REP_XP.cardTitle(code)),
      description: await text(REP_XP.cardDescription(code)),
      columns: (await at(this.page, REP_XP.cardColumns(code)).allInnerTexts()).map(c => c.trim()),
      category: await text(REP_XP.cardCategory(code)),
      href: (await at(this.page, REP_XP.cardOpen(code)).getAttribute('href')) ?? '',
    };
  }

  /** Clicks "Open <code> →" on a card and waits for the report page. */
  async openReport(code: string) {
    await at(this.page, REP_XP.cardOpen(code)).click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }
}
