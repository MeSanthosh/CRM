/** Reports & Analytics hub (/reports-analytics): Executive snapshot cards and the 11 module cards. */
import { expect } from '@playwright/test';
import { ROUTES, XP, at, HUB_SNAPSHOT, HUB_MODULES } from '../locators';
import { BasePage } from './BasePage';

export type ModuleCard = { name: string; href: string; status: string; description: string; openText: string };

export class ReportsHubPage extends BasePage {
  readonly path = ROUTES.hub;
  readonly name = 'Reports & Analytics';
  readonly snapshotLabels = HUB_SNAPSHOT;
  readonly modules = HUB_MODULES;

  get cards() {
    return this.page.locator('a.crm-module-hub-card');
  }

  get liveSummary() {
    return at(this.page, XP.hubLiveCount);
  }

  card(href: string) {
    return at(this.page, XP.moduleCard(href));
  }

  /** Title, status badge, description and "Open module →" text of a module card. */
  async readCard(href: string): Promise<ModuleCard> {
    await expect(this.card(href), `Card ${href}`).toBeVisible();
    const text = async (xp: string) => (await at(this.page, xp).innerText()).trim();
    return {
      href,
      name: await text(XP.moduleCardTitle(href)),
      status: (await text(XP.moduleCardStatus(href))).toUpperCase(),
      description: await text(XP.moduleCardDescription(href)),
      openText: await text(XP.moduleCardOpen(href)),
    };
  }

  /** Clicks a module card and waits for its page. */
  async openModule(href: string) {
    await this.card(href).click();
    await expect(this.page).toHaveURL(new RegExp(`${href.replace(/\//g, '\\/')}(\\?.*)?$`));
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }
}
