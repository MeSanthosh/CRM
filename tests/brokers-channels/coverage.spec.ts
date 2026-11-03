/** Brokers & Channels workbook — every test case on the "Test Cases" sheet must have exactly one automated test. */
import { execSync } from 'child_process';
import path from 'path';
import { test, expect } from '../auth';
import { BC_CASES, TAG } from './catalog';

// ── BC-COV-01 · Coverage check
// Checks: every test case on the "Test Cases" sheet of Brokers_Channels_Test_Cases.xlsx has exactly one automated test (no missing, duplicate or unknown IDs).
test('BC-COV-01 Every test case in Brokers_Channels_Test_Cases.xlsx is automated', { tag: TAG }, () => {
  const root = path.resolve(__dirname, '../..');
  const listing = execSync('npx playwright test tests/brokers-channels --list --reporter=list', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const automated = [...listing.matchAll(/›\s(BC-\d{3})\s/g)].map(m => m[1]);
  test.info().annotations.push({ type: 'coverage', description: `${new Set(automated).size} of ${Object.keys(BC_CASES).length} workbook test cases automated` });
  expect.soft(Object.keys(BC_CASES).filter(id => !automated.includes(id)), 'Workbook test cases without a test').toEqual([]);
  expect.soft(automated.filter((id, i, a) => a.indexOf(id) !== i), 'Test cases automated twice').toEqual([]);
  expect.soft(automated.filter(id => !BC_CASES[id]), 'Tests whose ID is not in the workbook').toEqual([]);
});
