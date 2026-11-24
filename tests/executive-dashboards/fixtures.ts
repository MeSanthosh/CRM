/** Fixtures of the Executive Dashboards suite: dash (DashboardsPage), ws (WorkspacePage), src (other modules via the API). */
import { test as base } from '../auth';
import { CrmApi } from '../opportunities-page/api';
import { DashboardsPage } from './DashboardsPage';
import { WorkspacePage } from './WorkspacePage';
import { ModuleSources } from './sources';

// src is set up first (dash and ws depend on it), so its API client sees the token of the page's own requests and never
// has to open another page to get one (that would leave the dashboard the test is reading)
export const test = base.extend<{ dash: DashboardsPage; ws: WorkspacePage; src: ModuleSources }>({
  src: async ({ page }, use) => { await use(new ModuleSources(new CrmApi(page))); },
  dash: async ({ page, src }, use) => { void src; page.setDefaultTimeout(30_000); await use(new DashboardsPage(page)); },
  ws: async ({ page, src }, use) => { void src; page.setDefaultTimeout(30_000); await use(new WorkspacePage(page)); },
});
export { expect } from '../auth';
