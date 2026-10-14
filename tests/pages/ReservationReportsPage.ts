/** Reservation Reports card → /reports/reservations: reservations, deposits, conversion to SPA, expiry. */
import { ROUTES } from '../locators';
import { ReportModulePage } from './ReportModulePage';

export class ReservationReportsPage extends ReportModulePage {
  readonly path = ROUTES.reports.reservations;
  readonly name = 'Reservation Reports';
  readonly tabLabel = 'Reservations';
  readonly filters = ['All projects', 'All salespeople', 'All brokers'];
  readonly mainKpi = 'Reservations in period';

  readonly byMonth = this.table('Reservations by Month');
  readonly byProject = this.table('Reservations by Project');
  readonly bySalesperson = this.table('Reservations by Salesperson');
  readonly active = this.table('Active Reservations');
}
