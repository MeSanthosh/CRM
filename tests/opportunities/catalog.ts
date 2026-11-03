/**
 * The Opportunities suite reads two workbooks in Testcase/ at runtime:
 *  - Opportunities_Test_Cases.xlsx, sheet "Test Cases": the test cases (OPP-001…OPP-060) — titles, steps,
 *    expected results, type and priority shown in test names and the Excel defect report. Edit wording there.
 *  - Asquare_CRM_Opportunities_Use_Cases.xlsx, sheet "Detailed Specifications": the 12 use cases and the
 *    test IDs each one lists ("Related Test Case IDs"); coverage.spec.ts checks the two workbooks agree.
 * OPP-060 is extra (UC-OPP-003's "record missing" exception had no ID of its own).
 */
import path from 'path';
import * as XLSX from 'xlsx';
import { test, type TestDetails } from '../auth';

export const OPP_WORKBOOK = path.resolve(__dirname, '../../Testcase/Asquare_CRM_Opportunities_Use_Cases.xlsx');
export const TAG = '@opp-workbook';

export type UseCase = {
  id: string; name: string; objective: string; preconditions: string; trigger: string; basicFlow: string;
  alternateFlows: string; exceptions: string; postconditions: string; related: string[]; priority: string; notes: string;
};

const s = (v: unknown) => String(v ?? '').trim();

/** "OPP-001–OPP-008, OPP-026" → ['OPP-001', …, 'OPP-008', 'OPP-026'] */
export function expandIds(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(',').map(p => p.trim()).filter(Boolean)) {
    const m = part.match(/^OPP-(\d{3})\s*[–—-]\s*OPP-(\d{3})$/);
    if (m) for (let n = +m[1]; n <= +m[2]; n++) out.push(`OPP-${String(n).padStart(3, '0')}`);
    else out.push(part);
  }
  return out;
}

function readUseCases(): Record<string, UseCase> {
  const wb = XLSX.readFile(OPP_WORKBOOK);
  const sheet = wb.Sheets['Detailed Specifications'];
  if (!sheet) throw new Error(`Sheet "Detailed Specifications" missing in ${OPP_WORKBOOK}`);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return Object.fromEntries(rows.filter(r => s(r['Use Case ID'])).map(r => [s(r['Use Case ID']), {
    id: s(r['Use Case ID']), name: s(r['Use Case Name']), objective: s(r['Objective / Description']),
    preconditions: s(r['Preconditions']), trigger: s(r['Trigger']), basicFlow: s(r['Basic Flow']),
    alternateFlows: s(r['Alternate Flows']), exceptions: s(r['Exceptions / Error Handling']),
    postconditions: s(r['Postconditions']), related: expandIds(s(r['Related Test Case IDs'])),
    priority: s(r['Priority']), notes: s(r['Assumptions / Notes']),
  }]));
}
export const USE_CASES = readUseCases();

export const OPP_TEST_CASES = path.resolve(__dirname, '../../Testcase/Opportunities_Test_Cases.xlsx');

export type OppCase = {
  id: string; uc: string[]; useCase: string; title: string; preconditions: string; steps: string;
  data: string; expected: string; type: string; priority: string;
};

/** The "Test Cases" sheet of Opportunities_Test_Cases.xlsx: one row per test ID ("Use Case ID" may list two). */
function readTestCases(): Record<string, OppCase> {
  const wb = XLSX.readFile(OPP_TEST_CASES);
  const sheet = wb.Sheets['Test Cases'];
  if (!sheet) throw new Error(`Sheet "Test Cases" missing in ${OPP_TEST_CASES}`);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return Object.fromEntries(rows.filter(r => s(r['TC ID'])).map(r => [s(r['TC ID']), {
    id: s(r['TC ID']), uc: s(r['Use Case ID']).split(',').map(x => x.trim()).filter(Boolean), useCase: s(r['Use Case']),
    title: s(r['Test Case']), preconditions: s(r['Preconditions']), steps: s(r['Test Steps']), data: s(r['Test Data']),
    expected: s(r['Expected Result']), type: s(r['Type']), priority: s(r['Priority']),
  }]));
}
export const OPP_CASES = readTestCases();

/** Title + details for a test case: test(...opp('OPP-011'), async ({ page }) => …). */
export function opp(id: string): [string, TestDetails] {
  const k = OPP_CASES[id];
  if (!k) throw new Error(`${id} is not on the "Test Cases" sheet of ${path.basename(OPP_TEST_CASES)}`);
  const uc = k.uc.map(u => `@${u.toLowerCase()}`);
  return [`${id} ${k.title}`, { tag: [TAG, ...uc], annotation: { type: 'expected', description: k.expected } }];
}

/** A test case that cannot run unattended: still listed, Skipped with the reason. */
export function oppSkipped(id: string, reason: string): [string, TestDetails, () => void] {
  const [title, d] = opp(id);
  return [title, { ...d, tag: [...(d.tag as string[]), '@manual'] }, () => test.skip(true, reason)];
}
