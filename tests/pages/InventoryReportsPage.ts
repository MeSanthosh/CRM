/** Inventory Reports card → /reports/inventory: units by status, project, unit type, bedrooms; availability matrix. */
import { act } from '../helpers';
import { ROUTES } from '../locators';
import { ReportModulePage } from './ReportModulePage';

export class InventoryReportsPage extends ReportModulePage {
  readonly path = ROUTES.reports.inventory;
  readonly name = 'Inventory Reports';
  readonly tabLabel = 'Inventory';
  readonly filters = ['All projects'];
  readonly mainKpi = 'Total units';
  /** The screen shows one row per block (floors collapsed); the export lists every floor. */
  readonly expandedInExport = ['Availability Summary'];

  readonly availability = this.table('Availability Summary');
  readonly byProject = this.table('Inventory by Project');
  readonly byUnitType = this.table('Inventory by Unit Type');
  readonly byBedrooms = this.table('Inventory by Bedrooms');
  readonly availableUnits = this.table('Available Units');

  /** Availability Summary grouping: "By product" or "By bedrooms". */
  async groupAvailabilityBy(mode: 'By product' | 'By bedrooms') {
    await act(this.page, () => this.page.getByRole('button', { name: mode, exact: true }).click());
  }
}
