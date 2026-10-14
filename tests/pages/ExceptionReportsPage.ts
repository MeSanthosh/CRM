/** Exception Reports card → /reports/exceptions: open exceptions summary and one detail list per exception. */
import { ROUTES } from '../locators';
import { ReportModulePage } from './ReportModulePage';

export class ExceptionReportsPage extends ReportModulePage {
  readonly path = ROUTES.reports.exceptions;
  readonly name = 'Exception Reports';
  readonly tabLabel = 'Exceptions';
  readonly filters = ['All projects', 'All salespeople'];
  readonly mainKpi = 'Open exceptions';

  readonly summary = this.table('Exception Summary');
  /** Detail lists (each panel lists the records behind one exception; long lists are capped). */
  readonly detailLists = this.tableHeadings.filter(h => h !== 'Exception Summary');

  /** Exception Summary as { exception name: open count }. */
  async summaryCounts(): Promise<Record<string, number>> {
    return Object.fromEntries((await this.summary.rows()).map(r => [r['Exception'], Number(r['Open'].replace(/,/g, ''))]));
  }
}
