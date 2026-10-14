/** SPA Reports card → /reports/spa: signed SPAs, contract value, time to sign, KYC and ERP handoff. */
import { ROUTES } from '../locators';
import { ReportModulePage } from './ReportModulePage';

export class SpaReportsPage extends ReportModulePage {
  readonly path = ROUTES.reports.spa;
  readonly name = 'SPA Reports';
  readonly tabLabel = 'SPA';
  readonly filters = ['All projects', 'All salespeople', 'All brokers'];
  readonly mainKpi = 'SPAs signed in period';

  readonly byMonth = this.table('SPAs Signed by Month');
  readonly byProject = this.table('SPAs by Project');
  readonly bySalesperson = this.table('SPAs by Salesperson');
  readonly needingAction = this.table('SPAs Needing Action');
}
