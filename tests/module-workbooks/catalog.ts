/**
 * Reads a report-module workbook (Testcase/<Module>_Reports_Test_Cases.xlsx): Test Cases, Clickable Map, Observations.
 * Every Test Cases row has an "Automation key"; rows with a common key (general:…, views:…, filter:…, table:…, nf:…)
 * are run by common.ts from the page's config, the others by the page's own spec.
 */
import path from 'path';
import * as XLSX from 'xlsx';
import { test, TestDetails } from '../auth';

export type Case = { id: string; area: string; component: string; title: string; steps: string; expected: string; priority: string; key: string };
export type MapRow = { id: string; area: string; component: string; element: string; clickable: string; result: string; key: string };
/** kind: 'defect' (the test asserts the fix, so it fails until fixed) or 'question' (the test records the behaviour). */
export type Observation = { id: string; area: string; observation: string; expected: string; severity: string; related: string; kind: string };

export type Workbook = ReturnType<typeof readWorkbook>;

/** Loads `Testcase/<file>` for test IDs `<prefix>-001…`, tagging every test with `tag`. */
export function readWorkbook(file: string, prefix: string, tag: string) {
  const full = path.resolve(__dirname, '../../Testcase', file);
  const wb = XLSX.readFile(full);
  const sheet = (name: string) => {
    if (!wb.Sheets[name]) throw new Error(`Sheet "${name}" missing in ${file}`);
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: '' });
  };
  const s = (v: unknown) => String(v ?? '').trim();

  const CASES: Record<string, Case> = Object.fromEntries(sheet('Test Cases').filter(r => s(r['TC ID'])).map(r => [s(r['TC ID']), {
    id: s(r['TC ID']), area: s(r['Area']), component: s(r['Component']), title: s(r['Test Case']), steps: s(r['Test Steps']),
    expected: s(r['Expected Result']), priority: s(r['Priority']), key: s(r['Automation key']),
  }]));
  const KEYS: Record<string, string> = Object.fromEntries(Object.values(CASES).filter(c => c.key).map(c => [c.key, c.id]));
  const MAP_ROWS: MapRow[] = sheet('Clickable Map').map((r, i) => ({
    id: `${prefix}-MAP-${String(i + 1).padStart(2, '0')}`, area: s(r['Area']), component: s(r['Component']), element: s(r['Element']),
    clickable: s(r['Clickable']), result: s(r['What happens']), key: s(r['Automation key']),
  }));
  const OBSERVATIONS: Observation[] = sheet('Observations').filter(r => s(r['Obs ID'])).map(r => ({
    id: s(r['Obs ID']), area: s(r['Area']), observation: s(r['Observation']), expected: s(r['Expected / Question']), severity: s(r['Suggested severity']),
    related: s(r['Related check']), kind: s(r['Kind']),
  }));

  const details = (expected: string, extra: string[] = []): TestDetails => ({ tag: [tag, ...extra], annotation: { type: 'expected', description: expected } });

  /** Title + details of a test case by ID. */
  const tc = (id: string): [string, TestDetails] => {
    const c = CASES[id];
    if (!c) throw new Error(`${id} is not in ${file}`);
    return [`${id} ${c.title}`, details(c.expected)];
  };
  return {
    file, prefix, tag, CASES, KEYS, MAP_ROWS, OBSERVATIONS, tc,
    /** ID of the row with this automation key (undefined when the workbook has no such row). */
    id: (key: string) => KEYS[key],
    /** Title + details of the row with this automation key. */
    key: (key: string) => {
      const id = KEYS[key];
      if (!id) throw new Error(`No row with automation key "${key}" in ${file}`);
      return tc(id);
    },
    /** A row that cannot run here: listed, Skipped with the reason. */
    skipped: (id: string, reason: string): [string, TestDetails, () => void] => {
      const [title, d] = tc(id);
      return [title, { ...d, tag: [tag, '@manual'] }, () => test.skip(true, reason)];
    },
    /** Title + details of the Clickable Map row with this key. */
    mapKey: (key: string): [string, TestDetails] => {
      const i = MAP_ROWS.findIndex(m => m.key === key);
      if (i < 0) throw new Error(`No Clickable Map row with key "${key}" in ${file}`);
      const m = MAP_ROWS[i];
      return [`${m.id} ${m.area} › ${m.element} — clickable: ${m.clickable}`, details(`${m.element}: clickable = ${m.clickable}; ${m.result}`)];
    },
    map: (n: number): [string, TestDetails] => {
      const m = MAP_ROWS[n - 1];
      if (!m) throw new Error(`Clickable Map row ${n} missing in ${file}`);
      return [`${m.id} ${m.area} › ${m.element} — clickable: ${m.clickable}`, details(`${m.element}: clickable = ${m.clickable}; ${m.result}`)];
    },
    obs: (obsId: string): [string, TestDetails] => {
      const o = OBSERVATIONS.find(x => x.id === obsId);
      if (!o) throw new Error(`${obsId} missing on the Observations sheet of ${file}`);
      return [`${prefix}-${o.id} ${o.area}: ${o.observation.split('. ')[0].slice(0, 110)}`, details(o.expected)];
    },
  };
}
