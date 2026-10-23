/**
 * Reads Testcase/Sales_Reports_Test_Cases.xlsx — the source of truth for the Sales Reports suite (SR-001…).
 * Titles and expected results shown in reports come from the workbook; the tests only hold the checks.
 */
import path from 'path';
import * as XLSX from 'xlsx';
import { test, type TestDetails } from '../auth';

export const SALES_WORKBOOK = path.resolve(__dirname, '../../Testcase/Sales_Reports_Test_Cases.xlsx');
export const TAG = '@sales-workbook';

export type SalesCase = { id: string; area: string; component: string; title: string; preconditions: string; steps: string; data: string; expected: string; type: string; priority: string };

const s = (v: unknown) => String(v ?? '').trim();
const rows = (): Record<string, unknown>[] => {
  const wb = XLSX.readFile(SALES_WORKBOOK);
  if (!wb.Sheets['Test Cases']) throw new Error(`Sheet "Test Cases" missing in ${SALES_WORKBOOK}`);
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Test Cases'], { defval: '' });
};

export const SALES_CASES: Record<string, SalesCase> = Object.fromEntries(rows().filter(r => s(r['TC ID'])).map(r => [s(r['TC ID']), {
  id: s(r['TC ID']), area: s(r['Area']), component: s(r['Component']), title: s(r['Test Case']), preconditions: s(r['Preconditions']),
  steps: s(r['Test Steps']), data: s(r['Test Data']), expected: s(r['Expected Result']), type: s(r['Type']), priority: s(r['Priority']),
}]));

/** Title + details for a workbook test case: test(...sr('SR-044'), async ({ sales }) => …). */
export function sr(id: string): [string, TestDetails] {
  const c = SALES_CASES[id];
  if (!c) throw new Error(`${id} is not in ${path.basename(SALES_WORKBOOK)}`);
  return [`${id} ${c.title}`, { tag: [TAG, `@sales-${c.area.toLowerCase().replace(/[^a-z]+/g, '-')}`], annotation: { type: 'expected', description: c.expected } }];
}

/** A workbook case that cannot run unattended: still listed, Skipped with the reason. */
export function srSkipped(id: string, reason: string): [string, TestDetails, () => void] {
  const [title, d] = sr(id);
  return [title, { ...d, tag: [TAG, '@manual'] }, () => test.skip(true, reason)];
}
