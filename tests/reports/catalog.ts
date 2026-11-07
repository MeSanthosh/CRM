/**
 * Reads Testcase/Reports/Reports_Test_Cases.xlsx, the source of truth for the Reports suite (tests/reports).
 * Titles, steps and expected results shown in reports come from the workbook; the tests only hold the checks.
 * Data only: the Excel reporter imports this file.
 */
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import type { TestDetails } from '@playwright/test';

export const REP_WORKBOOK = path.resolve(__dirname, '../../Testcase/Reports/Reports_Test_Cases.xlsx');
export const TAG = '@reports-workbook';

export type RepCase = {
  id: string; report: string; area: string; component: string; title: string; preconditions: string; steps: string;
  data: string; expected: string; priority: string; automation: string; remarks: string;
};

const s = (v: unknown) => String(v ?? '').trim();
// no workbook yet: no cases (the Excel reporter imports this file, so it must not throw)
const wb = fs.existsSync(REP_WORKBOOK) ? XLSX.readFile(REP_WORKBOOK) : undefined;
if (wb && !wb.Sheets['Test Cases']) throw new Error(`Sheet "Test Cases" missing in ${REP_WORKBOOK}`);

export const REP_CASES: Record<string, RepCase> = Object.fromEntries(
  (wb ? XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Test Cases'], { defval: '' }) : []).filter(r => s(r['TC ID'])).map(r => [s(r['TC ID']), {
    id: s(r['TC ID']), report: s(r['Report']), area: s(r['Area']), component: s(r['Component']), title: s(r['Test Case']),
    preconditions: s(r['Preconditions']), steps: s(r['Test Steps']), data: s(r['Test Data']), expected: s(r['Expected Result']),
    priority: s(r['Priority']), automation: s(r['Automation']), remarks: s(r['Remarks']),
  }]));

/** Title + details for a workbook test case: test(...rep('REP-005'), async ({ page }) => …). */
export function rep(id: string): [string, TestDetails] {
  const c = REP_CASES[id];
  if (!c) throw new Error(`${id} is not in ${path.basename(REP_WORKBOOK)}`);
  return [`${id} ${c.title}`, { tag: [TAG], annotation: { type: 'expected', description: c.expected } }];
}
