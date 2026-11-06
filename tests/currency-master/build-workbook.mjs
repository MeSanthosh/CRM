import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const cases = [
  ['CUR-001', 'Register', 'Summary', 'Currency Master opens and displays its four summary cards', 'Signed in as a user with Currency Master access.', 'Open Currency Master and review the summary cards.', 'Live currency data', 'The page opens with Currencies, Active, Payment and Contract summary cards populated from the current currency data.', 'Functional', 'High'],
  ['CUR-002', 'Register', 'Currency register', 'Currency Register displays all expected columns', 'Currency Master is open.', 'Review the Currency Register table headings.', 'Live currency data', 'The register displays Currency, Policy Roles, Decimals, Status, Created Date and Actions.', 'Functional', 'High'],
  ['CUR-003', 'Register', 'Base currency', 'The base currency is identified as the Base Anchor', 'Currency Master is open.', 'Find the currency marked Base Anchor in the register.', 'Configured base currency', 'Exactly one currency row is marked Base Anchor and it is active.', 'Functional', 'High'],
  ['CUR-004', 'Register', 'Search', 'Currency search matches a code without regard to case', 'At least one currency is available.', 'Search using a displayed currency code in lowercase.', 'A code read from the first currency row', 'The matching currency row is returned despite the lowercase query.', 'Functional', 'Medium'],
  ['CUR-005', 'Register', 'Search', 'Currency search matches a displayed currency name', 'At least one currency is available.', 'Search using the name shown in a currency row.', 'A name read from the first currency row', 'The currency whose name matches the query is displayed.', 'Functional', 'Medium'],
  ['CUR-006', 'Register', 'Active filter', 'Active only displays active currencies', 'Currency Master is open.', 'Enable Active only and inspect the filtered rows.', 'Live currency data', 'Every currency shown in the filtered register has ACTIVE status.', 'Functional', 'Medium'],
  ['CUR-007', 'Register', 'Create form', 'New Currency opens with the expected initial values', 'Currency Master is open.', 'Select New Currency and inspect the blank form.', 'Default decimal places: 2; default status: Active', 'The code and name are blank, decimal places is 2, status is Active, and Active in System is checked.', 'Functional', 'High'],
  ['CUR-008', 'Register', 'Create form', 'Cancel closes New Currency without saving', 'Currency Master is open.', 'Open New Currency and select Cancel.', 'No currency data is entered', 'The form closes and no currency write request is sent.', 'Functional', 'High'],
  ['CUR-009', 'Register', 'Create validation', 'Empty required currency fields are not submitted', 'Currency Master is open.', 'Open New Currency and select Create Currency without entering required values.', 'Currency Code and Currency Name left blank', 'The form remains open and no currency create request is sent.', 'Negative', 'High'],
  ['CUR-010', 'Register', 'Edit form', 'Edit opens the selected currency with existing values', 'At least one currency is available.', 'Select Edit on a currency row and inspect the form.', 'Currency code read from the selected row', 'The edit form opens with the selected currency code and its existing name.', 'Functional', 'High'],
  ['CUR-011', 'Policy', 'Organization policy', 'Policy displays organization currency controls and operating roles', 'Currency Master is open.', 'Open Policy and inspect the organization policy and core currency section.', 'Current saved policy', 'The page explains the organization policy and displays base ledger, contract settlement and local operating roles.', 'Functional', 'High'],
  ['CUR-012', 'Policy', 'Base currency', 'Policy has a selected three-letter operating currency', 'Currency Master is open.', 'Open Policy and inspect the selected Core Operating Currency.', 'Current saved policy', 'A three-letter currency code is selected for the core operating currency.', 'Functional', 'High'],
  ['CUR-013', 'Policy', 'Reporting and payment policy', 'Policy exposes payment acceptance and reporting currency settings', 'Currency Master is open.', 'Open Policy and inspect payment and reporting policy sections.', 'Current saved policy', 'Payment Acceptance, Reporting Currencies and Max Reporting Currencies Limit settings are visible.', 'Functional', 'Medium'],
  ['CUR-014', 'Exchange Rates', 'Rate register', 'Exchange Rate Register displays rate fields and the base anchor', 'Currency Master is open.', 'Open Exchange Rates and review the table headings and base anchor.', 'Live exchange-rate data', 'The register displays Pair, Rate, Status, Rate Date, Source, Created By and Created Date, and identifies the Base Anchor.', 'Functional', 'High'],
  ['CUR-015', 'Exchange Rates', 'Search', 'Exchange-rate search matches a displayed currency pair', 'At least one exchange rate is available.', 'Search using a pair displayed in the first rate row.', 'Pair read from the first exchange-rate row', 'The matching currency-pair record is displayed.', 'Functional', 'Medium'],
  ['CUR-016', 'Exchange Rates', 'Active filter', 'Active Rates only filters the exchange-rate register', 'Currency Master is open.', 'Enable Active Rates only and inspect displayed rate rows.', 'Live exchange-rate data', 'Every displayed rate row is marked ACTIVE or LATEST.', 'Functional', 'Medium'],
  ['CUR-017', 'Exchange Rates', 'Add rate form', 'Add Exchange Rate opens and can be canceled without saving', 'Currency Master is open.', 'Open Exchange Rates, select Add Exchange Rate, inspect required rate fields, and cancel.', 'No rate data is entered', 'The rate, source and source reference fields are available; cancel closes the form without a write request.', 'Functional', 'High'],
];

const workbook = XLSX.utils.book_new();
const overview = XLSX.utils.aoa_to_sheet([
  ['Currency Master - Test Suite'],
  ['Purpose', 'Workbook-driven functional cases for the CRM Currency Master, including register, policy and exchange rates.'],
  ['Automation scope', 'Playwright tests in tests/currency-master. The automated suite is read-only and does not save currency, policy or rate changes.'],
  ['Run', 'npm run test:currency-master'],
  ['Data rule', 'Use live CRM values; test data is read from the page. No fixed currency counts, names or rates are asserted.'],
]);
overview['!cols'] = [{ wch: 24 }, { wch: 112 }];
XLSX.utils.book_append_sheet(workbook, overview, 'Overview');

const testCases = XLSX.utils.aoa_to_sheet([
  ['TC ID', 'Area', 'Component', 'Test Case', 'Preconditions', 'Test Steps', 'Test Data', 'Expected Result', 'Type', 'Priority'],
  ...cases,
]);
testCases['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 52 }, { wch: 42 }, { wch: 60 }, { wch: 36 }, { wch: 75 }, { wch: 14 }, { wch: 12 }];
testCases['!autofilter'] = { ref: `A1:J${cases.length + 1}` };
XLSX.utils.book_append_sheet(workbook, testCases, 'Test Cases');

const filename = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../Testcase/Currency_Master_Test_Cases.xlsx');
fs.mkdirSync(path.dirname(filename), { recursive: true });
XLSX.writeFile(workbook, filename);
console.log(`Created ${filename} with ${cases.length} test cases.`);
