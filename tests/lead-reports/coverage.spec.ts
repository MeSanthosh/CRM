/** Lead Reports workbook — every test case on the "Test Cases" sheet must have exactly one automated test. */
import { execSync } from 'child_process';
import path from 'path';
import { test, expect } from '../auth';
import { LEAD_CASES, TAG } from './catalog';

test('LR-COV-01 Every test case in Lead_Reports_Test_Cases.xlsx is automated', { tag: TAG }, () => {
  const root = path.resolve(__dirname, '../..');
  const listing = execSync('npx playwright test tests/lead-reports --list --reporter=list', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const automated = [...listing.matchAll(/›\s(LR-\d{3})\s/g)].map(m => m[1]);
  const missing = Object.keys(LEAD_CASES).filter(id => !automated.includes(id));
  const duplicated = automated.filter((id, i, a) => a.indexOf(id) !== i);
  const unknown = automated.filter(id => !LEAD_CASES[id]);
  test.info().annotations.push({ type: 'coverage', description: `${new Set(automated).size} of ${Object.keys(LEAD_CASES).length} workbook test cases automated` });
  expect.soft(missing, 'Workbook test cases without a test').toEqual([]);
  expect.soft(duplicated, 'Test cases automated twice').toEqual([]);
  expect.soft(unknown, 'Tests whose ID is not in the workbook').toEqual([]);
});
