/**
 * Reads the per-report workbooks in Testcase/Reports (RPT-05_Lead_Register_Test_Cases.xlsx, RPT-01_…, …), the
 * source of truth for the Reports suite (tests/reports). Titles, steps and expected results shown in reports come
 * from the workbooks; the tests only hold the checks. Data only: the Excel reporter imports this file.
 */
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import type { TestDetails } from '@playwright/test';

export const REP_DIR = path.resolve(__dirname, '../../Testcase/Reports');
/** One workbook per report: "RPT-<nn>_<Name>_Test_Cases.xlsx" (Excel's "~$…" lock files are skipped). */
export const REP_WORKBOOKS = fs.existsSync(REP_DIR)
  ? fs.readdirSync(REP_DIR).filter(f => /^RPT-\d+_.+_Test_Cases\.xlsx$/i.test(f)).sort().map(f => path.join(REP_DIR, f))
  : [];
export const TAG = '@reports-workbook';

export type RepCase = {
  id: string; report: string; area: string; component: string; title: string; preconditions: string; steps: string;
  data: string; expected: string; priority: string; automation: string; remarks: string; workbook: string;
};

const s = (v: unknown) => String(v ?? '').trim();

// no workbooks yet: no cases (the Excel reporter imports this file, so it must not throw for that)
export const REP_CASES: Record<string, RepCase> = {};
for (const file of REP_WORKBOOKS) {
  const ws = XLSX.readFile(file).Sheets['Test Cases'];
  if (!ws) throw new Error(`Sheet "Test Cases" missing in ${file}`);
  for (const r of XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' }).filter(r => s(r['TC ID']))) {
    const id = s(r['TC ID']);
    if (REP_CASES[id]) throw new Error(`${id} is in both ${REP_CASES[id].workbook} and ${path.basename(file)}`);
    REP_CASES[id] = {
      id, report: s(r['Report']), area: s(r['Area']), component: s(r['Component']), title: s(r['Test Case']),
      preconditions: s(r['Preconditions']), steps: s(r['Test Steps']), data: s(r['Test Data']), expected: s(r['Expected Result']),
      priority: s(r['Priority']), automation: s(r['Automation']), remarks: s(r['Remarks']), workbook: path.basename(file),
    };
  }
}

/** Title + details for a workbook test case: test(...rep('REP-005'), async ({ page }) => …). */
export function rep(id: string): [string, TestDetails] {
  const c = REP_CASES[id];
  if (!c) throw new Error(`${id} is in none of the workbooks in ${REP_DIR}`);
  return [`${id} ${c.title}`, { tag: [TAG], annotation: { type: 'expected', description: c.expected } }];
}
