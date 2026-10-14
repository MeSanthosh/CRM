/**
 * Playwright fixtures that hand each test its page objects:
 *   test('SAL-01 …', expected('…'), async ({ hub, sales }) => { … })
 */
import { test as base, TestDetails } from '../auth';
import { ReportsHubPage } from './ReportsHubPage';
import { LeadReportsPage } from './LeadReportsPage';
import { SalesReportsPage } from './SalesReportsPage';
import { InventoryReportsPage } from './InventoryReportsPage';
import { CustomerReportsPage } from './CustomerReportsPage';
import { BrokerReportsPage } from './BrokerReportsPage';
import { MarketingReportsPage } from './MarketingReportsPage';
import { ReservationReportsPage } from './ReservationReportsPage';
import { SpaReportsPage } from './SpaReportsPage';
import { CollectionReportsPage } from './CollectionReportsPage';
import { ExecutiveReportsPage } from './ExecutiveReportsPage';
import { ExceptionReportsPage } from './ExceptionReportsPage';

export type Pages = {
  hub: ReportsHubPage;
  leadReports: LeadReportsPage;
  sales: SalesReportsPage;
  inventory: InventoryReportsPage;
  customers: CustomerReportsPage;
  brokers: BrokerReportsPage;
  marketing: MarketingReportsPage;
  reservations: ReservationReportsPage;
  spa: SpaReportsPage;
  collections: CollectionReportsPage;
  executive: ExecutiveReportsPage;
  exceptions: ExceptionReportsPage;
};

export const test = base.extend<Pages>({
  hub: async ({ page }, use) => use(new ReportsHubPage(page)),
  leadReports: async ({ page }, use) => use(new LeadReportsPage(page)),
  sales: async ({ page }, use) => use(new SalesReportsPage(page)),
  inventory: async ({ page }, use) => use(new InventoryReportsPage(page)),
  customers: async ({ page }, use) => use(new CustomerReportsPage(page)),
  brokers: async ({ page }, use) => use(new BrokerReportsPage(page)),
  marketing: async ({ page }, use) => use(new MarketingReportsPage(page)),
  reservations: async ({ page }, use) => use(new ReservationReportsPage(page)),
  spa: async ({ page }, use) => use(new SpaReportsPage(page)),
  collections: async ({ page }, use) => use(new CollectionReportsPage(page)),
  executive: async ({ page }, use) => use(new ExecutiveReportsPage(page)),
  exceptions: async ({ page }, use) => use(new ExceptionReportsPage(page)),
});

export { expect } from '../auth';

/** Test details carrying what the test asserts; the Excel report shows it as the Expected Result. */
export const expected = (description: string): TestDetails => ({ annotation: { type: 'expected', description } });

/** Records a value in the test's annotations (shown as "Observed Values" in the Excel report). */
export const note = (type: string, description: string) => test.info().annotations.push({ type, description });
