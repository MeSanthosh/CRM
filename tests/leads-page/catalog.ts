/**
 * Reads a human-readable test case workbook (Testcase/<Page>_Test_Cases.xlsx, sheet "Test Cases") —
 * here Testcase/Leads_Page_Test_Cases.xlsx for the Leads page (use cases HLUC-01 … HLUC-03).
 * Titles, steps and expected results in reports come from the workbook.
 */
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import type { TestDetails } from '@playwright/test';

export type PageCase = { id: string; useCase: string; area: string; title: string; preconditions: string; steps: string; data: string; expected: string; priority: string; impact: string };
/** @deprecated name kept for the Leads page suite */
export type LeadsPageCase = PageCase;

const s = (v: unknown) => String(v ?? '').trim();

/** Test cases of a workbook plus the title helpers its specs use. */
export function makeCatalog(workbook: string, tag: string) {
  const file = path.resolve(__dirname, '../../Testcase', workbook);
  const CASES: Record<string, PageCase> = fs.existsSync(file)
    ? Object.fromEntries(XLSX.utils.sheet_to_json<Record<string, unknown>>(XLSX.readFile(file).Sheets['Test Cases'], { defval: '' })
        .filter(r => s(r['TC ID'])).map(r => [s(r['TC ID']), {
          id: s(r['TC ID']), useCase: s(r['Use Case']), area: s(r['Area']), title: s(r['Test Case']), preconditions: s(r['Preconditions']),
          steps: s(r['Test Steps']), data: s(r['Test Data']), expected: s(r['Expected Result']), priority: s(r['Priority']), impact: s(r['Why It Matters']),
        }]))
    : {};
  const details = (expected: string, extra: { type: string; description: string }[] = []): TestDetails =>
    ({ tag: [tag], annotation: [{ type: 'expected', description: expected }, ...extra] });
  const caseOf = (id: string): PageCase => {
    const c = CASES[id];
    if (!c) throw new Error(`${id} is not in ${workbook}`);
    return c;
  };
  return {
    file, tag, CASES, caseOf,
    /** Title + details for a test case: test(...tc('LP-011'), async ({ page }) => …). */
    tc: (id: string): [string, TestDetails] => [`${id} ${caseOf(id).title}`, details(caseOf(id).expected)],
    /** A sub-case driven by one test-data row, e.g. "LP-005.2 … — value"; expected text from the data. */
    tcRow: (id: string, n: number, what: string, expected: string, data: string): [string, TestDetails] =>
      [`${id}.${n} ${caseOf(id).title} — ${what}`, details(expected, [{ type: 'test data', description: data }])],
  };
}

const LP = makeCatalog('Leads_Page_Test_Cases.xlsx', '@leads-page');
export const LEADS_PAGE_WORKBOOK = LP.file;
export const TAG = LP.tag;
export const LEADS_PAGE_CASES = LP.CASES;
export const caseOf = LP.caseOf;
export const lp = LP.tc;
export const lpRow = LP.tcRow;
