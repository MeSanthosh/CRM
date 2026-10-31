/**
 * Reads Testcase/Customer_Reports_Test_Cases.xlsx — the source of truth for the Customer Reports suite:
 *   Test Cases (CR-001…), Clickable Map (CR-MAP-nn), Observations (CR-OBS-nn).
 * Titles, steps and expected results shown in reports come from the workbook; the tests only hold the checks.
 */
import path from 'path';
import * as XLSX from 'xlsx';
import type { TestDetails } from '@playwright/test';

export const CUSTOMER_WORKBOOK = path.resolve(__dirname, '../../Testcase/Customer_Reports_Test_Cases.xlsx');
export const TAG = '@customer-workbook';

export type CustomerCase = { id: string; area: string; component: string; title: string; preconditions: string; steps: string; data: string; expected: string; priority: string };
export type MapRow = { id: string; area: string; component: string; element: string; clickable: string; result: string };
export type Observation = { id: string; area: string; observation: string; expected: string; severity: string };

function sheet(name: string): Record<string, unknown>[] {
  const wb = XLSX.readFile(CUSTOMER_WORKBOOK);
  if (!wb.Sheets[name]) throw new Error(`Sheet "${name}" missing in ${CUSTOMER_WORKBOOK}`);
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: '' });
}
const s = (v: unknown) => String(v ?? '').trim();

export const CUSTOMER_CASES: Record<string, CustomerCase> = Object.fromEntries(sheet('Test Cases').filter(r => s(r['TC ID'])).map(r => [s(r['TC ID']), {
  id: s(r['TC ID']), area: s(r['Area']), component: s(r['Component']), title: s(r['Test Case']), preconditions: s(r['Preconditions']),
  steps: s(r['Test Steps']), data: s(r['Test Data']), expected: s(r['Expected Result']), priority: s(r['Priority']),
}]));

export const MAP_ROWS: MapRow[] = sheet('Clickable Map').map((r, i) => ({
  id: `CR-MAP-${String(i + 1).padStart(2, '0')}`, area: s(r['Area']), component: s(r['Component']), element: s(r['Element']),
  clickable: s(r['Clickable']), result: s(r['What happens']),
}));

export const OBSERVATIONS: Observation[] = sheet('Observations').filter(r => s(r['Obs ID'])).map(r => ({
  id: s(r['Obs ID']), area: s(r['Area']), observation: s(r['Observation']), expected: s(r['Expected / Question']), severity: s(r['Suggested severity']),
}));

export const details = (expected: string, extraTags: string[] = []): TestDetails => ({ tag: [TAG, ...extraTags], annotation: { type: 'expected', description: expected } });

/** Title + details for a workbook test case: test(...cr('CR-044'), async ({ … }) => …). */
export function cr(id: string): [string, TestDetails] {
  const c = CUSTOMER_CASES[id];
  if (!c) throw new Error(`${id} is not in ${path.basename(CUSTOMER_WORKBOOK)}`);
  return [`${id} ${c.title}`, details(c.expected)];
}

/** Clickable Map row n (1-based) as a test title. */
export function crMap(n: number): [string, TestDetails] {
  const m = MAP_ROWS[n - 1];
  if (!m) throw new Error(`Clickable Map row ${n} missing`);
  return [`${m.id} ${m.area} › ${m.element} — clickable: ${m.clickable}`, details(`${m.element}: clickable = ${m.clickable}; ${m.result}`)];
}

/** Observation OBS-nn as a test title (the test asserts the expected behaviour). */
export function crObs(obsId: string): [string, TestDetails] {
  const o = OBSERVATIONS.find(x => x.id === obsId);
  if (!o) throw new Error(`${obsId} missing on the Observations sheet`);
  return [`CR-${o.id} ${o.area}: ${o.observation.split('. ')[0].slice(0, 110)}`, details(o.expected)];
}
