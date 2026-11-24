import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const cases = [
  ['PREF-001', 'Workspace settings', 'Navigation', 'Preferences opens with all four settings sections', 'Signed in with permission to view Preferences.', 'Open Preferences and review the section tabs.', 'Current organization settings', 'Preferences opens with General, Notifications, Security and Operations & ETL sections.', 'Functional', 'High', 'Provides access to the organization configuration areas.'],
  ['PREF-002', 'Workspace settings', 'Application defaults', 'Application defaults exposes landing page, theme and page-size choices', 'Preferences is open.', 'Open General > Application defaults and inspect its choice lists.', 'Current organization settings', 'The landing page, theme and rows-per-page controls offer their configured choices and the save action is present.', 'Functional', 'High', 'Verifies that administrators can view application-wide defaults.'],
  ['PREF-003', 'Workspace settings', 'Time and locale', 'Time & locale exposes regional setting choices', 'Preferences is open.', 'Open General > Time & locale and inspect the controls.', 'Current organization settings', 'Location, date format, time zone and number format each offer configured choices; the save action is present.', 'Functional', 'Medium', 'Ensures regional formatting options are available.'],
  ['PREF-004', 'Notifications', 'Email SMTP', 'Email settings expose mail server and sender controls', 'Preferences is open.', 'Open Notifications > Email (SMTP) and inspect the server and sender fields.', 'Stored credentials remain masked', 'SMTP host, port, username, password and sender controls are visible; the password stays masked; test and save actions are available.', 'Functional', 'High', 'Confirms email delivery settings can be reviewed without exposing a stored password.'],
  ['PREF-005', 'Notifications', 'Notification channels', 'Notification channel preferences are available', 'Preferences is open.', 'Open Notifications > Notification channel.', 'Current organization settings', 'The Notification Channels section and its channel controls are visible with a save action.', 'Functional', 'Medium', 'Verifies organization-level notification options are available.'],
  ['PREF-006', 'Security', 'Authentication policies', 'Security settings show numeric policies and unavailable MFA enforcement', 'Preferences is open.', 'Open Security and inspect the timeout, lockout and MFA controls.', 'Current security policy; do not save changes', 'The three policy settings contain positive integer values, MFA enforcement is disabled, and the save action is visible.', 'Functional', 'High', 'Confirms the current security controls are presented and MFA cannot be enabled prematurely.'],
  ['PREF-007', 'Operations & ETL', 'ETL audit log', 'Operations & ETL shows execution options and audit history', 'Preferences is open.', 'Open Operations & ETL and review the ETL panels and audit log without starting a job.', 'Current ETL status and history', 'Incremental and full ETL panels and the execution audit log are visible with status information.', 'Functional', 'High', 'Allows administrators to review data movement history without running a job.'],
];

const workbook = XLSX.utils.book_new();
const overview = XLSX.utils.aoa_to_sheet([
  ['Preferences - Test Suite'],
  ['Purpose', 'Workbook-driven functional cases for the Preferences organization console.'],
  ['Automation scope', 'Playwright tests in tests/preferences. The suite inspects settings without saving changes, sending email or running ETL jobs.'],
  ['Run', 'npm run test:preferences'],
  ['Data rule', 'Use the current settings and options presented by the page. Do not hard-code organization-specific saved values.'],
]);
overview['!cols'] = [{ wch: 24 }, { wch: 112 }];
XLSX.utils.book_append_sheet(workbook, overview, 'Overview');

const testCases = XLSX.utils.aoa_to_sheet([
  ['TC ID', 'Use Case', 'Area', 'Test Case', 'Preconditions', 'Test Steps', 'Test Data', 'Expected Result', 'Type', 'Priority', 'Why It Matters'],
  ...cases,
]);
testCases['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 60 }, { wch: 48 }, { wch: 72 }, { wch: 42 }, { wch: 90 }, { wch: 14 }, { wch: 12 }, { wch: 66 }];
testCases['!autofilter'] = { ref: `A1:K${cases.length + 1}` };
XLSX.utils.book_append_sheet(workbook, testCases, 'Test Cases');

const filename = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../Testcase/Preferences_Test_Cases.xlsx');
fs.mkdirSync(path.dirname(filename), { recursive: true });
XLSX.writeFile(workbook, filename);
console.log(`Created ${filename} with ${cases.length} test cases.`);
