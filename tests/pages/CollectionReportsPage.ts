/** Collection Reports card → /reports/collections: scheduled, received, outstanding, overdue and aging. */
import { ROUTES } from '../locators';
import { ReportModulePage } from './ReportModulePage';

export class CollectionReportsPage extends ReportModulePage {
  readonly path = ROUTES.reports.collections;
  readonly name = 'Collection Reports';
  readonly tabLabel = 'Collections';
  readonly filters = ['All projects', 'All salespeople'];
  readonly mainKpi = 'Scheduled';

  readonly byAge = this.table('Outstanding by Age');
  readonly byProject = this.table('Collections by Project');
  readonly overdue = this.table('Overdue Instalments');
}
