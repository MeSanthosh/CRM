/** Marketing Reports card → /reports/marketing: campaign and channel budget, leads, cost per lead, revenue, ROI. */
import { ROUTES } from '../locators';
import { ReportModulePage } from './ReportModulePage';

export class MarketingReportsPage extends ReportModulePage {
  readonly path = ROUTES.reports.marketing;
  readonly name = 'Marketing Reports';
  readonly tabLabel = 'Marketing';
  readonly filters = ['All projects', 'All salespeople', 'All campaigns'];
  readonly mainKpi = 'Campaign leads';

  readonly campaigns = this.table('Campaign Performance');
  readonly channels = this.table('Performance by Channel');
}
