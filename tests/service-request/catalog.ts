/**
 * Reads Testcase/Service_Requests_Test_Cases.xlsx, the source of truth for the Service Requests suite.
 * Titles, steps and expected results shown in reports come from the workbook; the tests only hold the checks.
 */
import path from 'path';
import * as XLSX from 'xlsx';
import type { TestDetails } from '@playwright/test';

export const SR_WORKBOOK = path.resolve(__dirname, '../../Testcase/Service_Requests_Test_Cases.xlsx');
export const TAG = '@service-requests';

export type SrCase = {
  id: string; area: string; component: string; title: string; preconditions: string; steps: string;
  data: string; expected: string; priority: string; automation: string; remarks: string;
};

const s = (v: unknown) => String(v ?? '').trim();
const wb = XLSX.readFile(SR_WORKBOOK);
if (!wb.Sheets['Test Cases']) throw new Error(`Sheet "Test Cases" missing in ${SR_WORKBOOK}`);

export const SR_CASES: Record<string, SrCase> = Object.fromEntries(
  XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Test Cases'], { defval: '' }).filter(r => s(r['TC ID'])).map(r => [s(r['TC ID']), {
    id: s(r['TC ID']), area: s(r['Area']), component: s(r['Component']), title: s(r['Test Case']), preconditions: s(r['Preconditions']),
    steps: s(r['Test Steps']), data: s(r['Test Data']), expected: s(r['Expected Result']), priority: s(r['Priority']),
    automation: s(r['Automation']), remarks: s(r['Remarks']),
  }]));

/** Title + details for a workbook test case: test(...sr('SR-046'), async ({ serviceRequests }) => …). */
export function sr(id: string): [string, TestDetails] {
  const c = SR_CASES[id];
  if (!c) throw new Error(`${id} is not in ${path.basename(SR_WORKBOOK)}`);
  return [`${id} ${c.title}`, { tag: [TAG], annotation: { type: 'expected', description: c.expected } }];
}
