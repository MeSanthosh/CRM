/**
 * The test scenario workbook (Testcase/Reports_Analytics_Test_Scenarios.xlsx) is the source of truth
 * for scenario IDs, areas and wording. Test titles and the Excel report read it from here, so editing
 * a scenario's text in the workbook updates the reports without touching the tests.
 */
import path from 'path';
import * as XLSX from 'xlsx';

export interface Scenario {
  id: string;
  area: string;
  scenario: string;
  expected: string;
  priority: string;
}

export const SCENARIO_FILE = path.resolve(__dirname, '../../Testcase/Reports_Analytics_Test_Scenarios.xlsx');

function load(): Record<string, Scenario> {
  const wb = XLSX.readFile(SCENARIO_FILE);
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  const out: Record<string, Scenario> = {};
  for (const r of rows) {
    const id = String(r['Scenario ID']).trim();
    if (!id) continue;
    out[id] = {
      id,
      area: String(r['Test Area']).trim(),
      scenario: String(r['Test Scenario']).trim(),
      expected: String(r['Expected Result']).trim(),
      priority: String(r['Priority']).trim(),
    };
  }
  return out;
}

export const SCENARIOS = load();
export const isScenarioId = (id: string) => /^RA-\d{3}$/.test(id);
