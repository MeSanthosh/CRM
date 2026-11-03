/** Customer Reports card → /reports/customers: customers by nationality, residence and type; new customers. */
import { ROUTES } from '../locators';
import { ReportModulePage } from './ReportModulePage';
export { MODULE_TABS } from './ReportModulePage';

/** Columns shared by the three breakdown tables (after the grouping column). */
export const BREAKDOWN_COLUMNS = ['Customers', 'New in Period', 'With SPA', 'SPAs', 'SPA Value (USD)'];
export const LIST_COLUMNS = ['Customer', 'Name', 'Nationality', 'Country', 'Created', 'SPAs', 'SPA Value (USD)'];
/** Cards about the customer base as a whole (they do not follow the "customer created" period). */
export const ALL_TIME_KPIS = ['Active customers', 'Customers with SPA', 'Repeat buyers', 'SPA value', 'Average value per buyer', 'Portal access'];
export const PROJECTS = 'All projects';
export const SALESPEOPLE = 'All salespeople';

export class CustomerReportsPage extends ReportModulePage {
  readonly path = ROUTES.reports.customers;
  readonly name = 'Customer Reports';
  readonly tabLabel = 'Customers';
  readonly filters = [PROJECTS, SALESPEOPLE];
  readonly mainKpi = 'Active customers';

  readonly byNationality = this.table('Customers by Nationality');
  readonly byResidence = this.table('Customers by Country of Residence');
  readonly byType = this.table('Customers by Type');
  readonly newCustomers = this.table('New Customers in Period');
  /** The three breakdown tables with their grouping column. */
  readonly breakdowns = [
    { table: this.byNationality, group: 'Nationality', listColumn: 'Nationality' },
    { table: this.byResidence, group: 'Country', listColumn: 'Country' },
    { table: this.byType, group: 'Customer Type', listColumn: '' },
  ];
}
