/** Broker Reports card → /reports/brokers: broker leads, reservations, SPAs and SPA value. */
import { ROUTES } from '../locators';
import { ReportModulePage } from './ReportModulePage';

export class BrokerReportsPage extends ReportModulePage {
  readonly path = ROUTES.reports.brokers;
  readonly name = 'Broker Reports';
  readonly tabLabel = 'Brokers';
  readonly filters = ['All projects', 'All salespeople', 'All brokers'];
  readonly mainKpi = 'Broker leads';

  readonly performance = this.table('Broker Performance');
}
