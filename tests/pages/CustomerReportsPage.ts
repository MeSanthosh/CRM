/** Customer Reports card → /reports/customers: customers by nationality, residence and type; new customers. */
import { ROUTES } from '../locators';
import { ReportModulePage } from './ReportModulePage';

export class CustomerReportsPage extends ReportModulePage {
  readonly path = ROUTES.reports.customers;
  readonly name = 'Customer Reports';
  readonly tabLabel = 'Customers';
  readonly filters = ['All projects', 'All salespeople'];
  readonly mainKpi = 'Active customers';

  readonly byNationality = this.table('Customers by Nationality');
  readonly byResidence = this.table('Customers by Country of Residence');
  readonly byType = this.table('Customers by Type');
  readonly newCustomers = this.table('New Customers in Period');
}
