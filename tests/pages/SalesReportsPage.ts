/** Sales Reports card → /reports/sales: pipeline by stage and salesperson, win rate, open opportunities. */
import { ROUTES } from '../locators';
import { ReportModulePage } from './ReportModulePage';

export class SalesReportsPage extends ReportModulePage {
  readonly path = ROUTES.reports.sales;
  readonly name = 'Sales Reports';
  readonly tabLabel = 'Sales';
  readonly filters = ['All projects', 'All salespeople', 'All brokers', 'All campaigns'];
  readonly mainKpi = 'Open opportunities';

  readonly stageTable = this.table('Open Pipeline by Stage');
  readonly salespersonTable = this.table('Salesperson Pipeline');
  readonly opportunitiesTable = this.table('Open Opportunities');

  /** Opens an opportunity from the Open Opportunities table (its reference link). */
  async openOpportunity(reference: string) {
    await this.page.getByRole('link', { name: reference, exact: true }).first().click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }
}
