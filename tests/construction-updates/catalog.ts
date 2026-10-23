/**
 * Reads Testcase/Construction_Updates_Test_Cases.xlsx — the source of truth for the Construction Updates suite
 * (CU-001…). Titles, steps and expected results shown in test names and the Excel defect report come from its
 * "Test Cases" sheet; the tests only hold the checks. Edit wording in the workbook.
 */
import path from 'path';
import * as XLSX from 'xlsx';
import { test, type TestDetails } from '../auth';

export const CU_WORKBOOK = path.resolve(__dirname, '../../Testcase/Construction_Updates_Test_Cases.xlsx');
export const TAG = '@cu-workbook';

export type CuCase = {
  id: string; area: string; component: string; title: string; preconditions: string; steps: string;
  data: string; expected: string; type: string; priority: string;
};

const s = (v: unknown) => String(v ?? '').trim();
const rows = (): Record<string, unknown>[] => {
  const wb = XLSX.readFile(CU_WORKBOOK);
  if (!wb.Sheets['Test Cases']) throw new Error(`Sheet "Test Cases" missing in ${CU_WORKBOOK}`);
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Test Cases'], { defval: '' });
};

export const CU_CASES: Record<string, CuCase> = Object.fromEntries(rows().filter(r => s(r['TC ID'])).map(r => [s(r['TC ID']), {
  id: s(r['TC ID']), area: s(r['Area']), component: s(r['Component']), title: s(r['Test Case']), preconditions: s(r['Preconditions']),
  steps: s(r['Test Steps']), data: s(r['Test Data']), expected: s(r['Expected Result']), type: s(r['Type']), priority: s(r['Priority']),
}]));

/**
 * Title + details for a workbook test case: test(...cu('CU-005'), async ({ cu }) => …).
 * Tags: @cu-workbook plus one per area (@cu-page, @cu-list, @cu-filters-search, @cu-detail-panel, @cu-validation,
 * @cu-api, @cu-lifecycle, @cu-manual), so `npx playwright test --grep @cu-list` runs one area.
 */
export function cu(id: string): [string, TestDetails] {
  const c = CU_CASES[id];
  if (!c) throw new Error(`${id} is not on the "Test Cases" sheet of ${path.basename(CU_WORKBOOK)}`);
  const area = `@cu-${c.area.toLowerCase().replace(/[^a-z]+/g, '-').replace(/-$/, '')}`;
  return [`${id} ${c.title}`, { tag: [TAG, area], annotation: { type: 'expected', description: c.expected } }];
}

/** A test case that cannot run unattended: still listed, Skipped with the reason. */
export function cuSkipped(id: string, reason: string): [string, TestDetails, () => void] {
  const [title, d] = cu(id);
  return [title, { ...d, tag: [...(d.tag as string[]), '@manual'] }, () => test.skip(true, reason)];
}
