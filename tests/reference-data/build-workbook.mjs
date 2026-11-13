import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const cases = [
  ['RDM-001', 'Register', 'Summary', 'Reference Data Management displays its summary cards', 'Signed in with permission to view Reference Data Management.', 'Open Reference Data Management and review the summary cards.', 'Live reference data', 'Values, Categories, Families and Inactive cards are visible and show whole-number values from the live data.', 'Functional', 'High', 'Provides a quick overview of configured reference data.'],
  ['RDM-002', 'Register', 'Reference register', 'Reference Register displays the expected columns', 'Reference Data Management is open.', 'Review the Reference Register column headings.', 'Live reference data', 'The register displays Category, Group, Value Code, Value Name, Order, Status, Created Date and Actions.', 'Functional', 'High', 'Ensures reference records expose their key attributes and actions.'],
  ['RDM-003', 'Filters', 'Category and group options', 'Category and Group filters contain configured options', 'Reference Data Management is open.', 'Review the Category and Group filter options.', 'Current reference metadata', 'Both filters include their All option and configured values.', 'Functional', 'Medium', 'Lets administrators find reference values by their hierarchy.'],
  ['RDM-004', 'Filters', 'Category and group filters', 'Category and Group filters narrow the register together', 'At least one reference value is listed.', 'Choose the category and group from a listed value.', 'Category and group read from the first register row', 'Every displayed result matches both selected filters.', 'Functional', 'High', 'Verifies that reference hierarchy filters apply consistently.'],
  ['RDM-005', 'Search', 'Value code', 'Search finds a reference value by code without case sensitivity', 'At least one reference value is listed.', 'Search using a displayed value code in lowercase.', 'Value code read from a listed row', 'The matching reference value is displayed.', 'Functional', 'Medium', 'Allows administrators to quickly locate a configured value.'],
  ['RDM-006', 'Filters', 'Active only', 'Active only displays only active reference values', 'Reference Data Management is open.', 'Select Active only and inspect the register.', 'Live reference data', 'Every displayed result has ACTIVE status.', 'Functional', 'Medium', 'Prevents inactive values from appearing in an active-only view.'],
  ['RDM-007', 'Register', 'Pagination', 'Reference register pagination moves between pages', 'More than one page of reference values is available.', 'Select Next and then Previous.', 'Live reference data', 'Next displays page 2 and Previous returns to page 1.', 'Functional', 'Medium', 'Ensures administrators can navigate large reference catalogs.'],
  ['RDM-008', 'Forms', 'New Category', 'New Category form shows expected initial values', 'Reference Data Management is open.', 'Open New Category and inspect its fields, then cancel.', 'Default order 0; default status Active', 'The category, group and value fields are blank; order is 0; status is Active; application use is checked.', 'Functional', 'High', 'Confirms the category creation form starts with safe defaults.'],
  ['RDM-009', 'Forms', 'New Group', 'New Group form offers categories and blank group fields', 'At least one category is configured.', 'Open New Group and inspect the category options and group fields, then cancel.', 'Configured categories', 'A category can be selected; group and value fields are blank; order defaults to 0.', 'Functional', 'High', 'Ensures groups can be created within the correct category.'],
  ['RDM-010', 'Forms', 'New Reference Value', 'New Reference Value form offers category and group options', 'At least one category and group are configured.', 'Open New Reference Value, select the category from a listed value, and inspect its available groups and the value fields, then cancel.', 'Category read from a listed reference value', 'Category options are available; selecting a category loads its groups; code and name are blank; order defaults to 0.', 'Functional', 'High', 'Ensures new values can be associated with an existing group.'],
  ['RDM-011', 'Forms', 'New Category cancel', 'Cancel closes New Category without saving', 'Reference Data Management is open.', 'Open New Category and select Cancel.', 'No data entered', 'The form closes and no reference-data write request is sent.', 'Functional', 'High', 'Prevents accidental writes when a form is canceled.'],
  ['RDM-012', 'Forms', 'New Group cancel', 'Cancel closes New Group without saving', 'Reference Data Management is open.', 'Open New Group and select Cancel.', 'No data entered', 'The form closes and no reference-data write request is sent.', 'Functional', 'High', 'Prevents accidental writes when a form is canceled.'],
  ['RDM-013', 'Forms', 'New Reference Value cancel', 'Cancel closes New Reference Value without saving', 'Reference Data Management is open.', 'Open New Reference Value and select Cancel.', 'No data entered', 'The form closes and no reference-data write request is sent.', 'Functional', 'High', 'Prevents accidental writes when a form is canceled.'],
  ['RDM-014', 'Forms', 'Edit Reference Value', 'Edit opens with the selected reference value populated', 'At least one reference value is listed.', 'Select Edit on a listed row and inspect the value code and name, then cancel.', 'Code read from the selected register row', 'The edit form opens with the selected value code and a populated value name.', 'Functional', 'High', 'Confirms the edit action targets the selected reference value.'],
];

const workbook = XLSX.utils.book_new();
const overview = XLSX.utils.aoa_to_sheet([
  ['Reference Data Management - Test Suite'],
  ['Purpose', 'Workbook-driven functional cases for the Reference Data Management register, filters, search and forms.'],
  ['Automation scope', 'Playwright tests in tests/reference-data. Tests do not save or change reference data.'],
  ['Run', 'npm run test:reference-data'],
  ['Data rule', 'Use live CRM values; test data is read from the page. No fixed catalog counts or reference values are asserted.'],
]);
overview['!cols'] = [{ wch: 24 }, { wch: 112 }];
XLSX.utils.book_append_sheet(workbook, overview, 'Overview');

const testCases = XLSX.utils.aoa_to_sheet([
  ['TC ID', 'Use Case', 'Area', 'Test Case', 'Preconditions', 'Test Steps', 'Test Data', 'Expected Result', 'Type', 'Priority', 'Why It Matters'],
  ...cases,
]);
testCases['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 54 }, { wch: 48 }, { wch: 70 }, { wch: 42 }, { wch: 80 }, { wch: 14 }, { wch: 12 }, { wch: 62 }];
testCases['!autofilter'] = { ref: `A1:K${cases.length + 1}` };
XLSX.utils.book_append_sheet(workbook, testCases, 'Test Cases');

const filename = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../Testcase/Reference_Data_Test_Cases.xlsx');
fs.mkdirSync(path.dirname(filename), { recursive: true });
XLSX.writeFile(workbook, filename);
console.log(`Created ${filename} with ${cases.length} test cases.`);
