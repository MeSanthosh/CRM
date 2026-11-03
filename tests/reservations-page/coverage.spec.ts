/**
 * Reservations workbook (Testcase/Reservations_Page_Test_Cases.xlsx) — every test case on its "Test Cases" sheet
 * (Maha's UR-001…069 and the generated RSV-001…022) must have exactly one automated test.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { test, expect } from '../auth';
import { RSV_CASES, TAG } from './catalog';
import { RESERVATION_CASES } from './shared';

// ── UR-COV-01 · Coverage check
// Checks: every test case on the "Test Cases" sheet of Reservations_Page_Test_Cases.xlsx has exactly one automated test (no missing, duplicate or unknown IDs).
test('UR-COV-01 Every test case in Reservations_Page_Test_Cases.xlsx is automated', { tag: TAG }, () => {
  const root = path.resolve(__dirname, '../..');
  const listing = execSync('npx playwright test tests/reservations-page --list --reporter=list', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const automated = [...listing.matchAll(/›\s((?:UR|RSV)-\d{3})\s/g)].map(m => m[1]);
  test.info().annotations.push({ type: 'coverage', description: `${new Set(automated).size} of ${Object.keys(RSV_CASES).length} workbook test cases automated` });
  expect.soft(Object.keys(RSV_CASES).filter(id => !automated.includes(id)), 'Workbook test cases without a test').toEqual([]);
  expect.soft(automated.filter((id, i, a) => a.indexOf(id) !== i), 'Test cases automated twice').toEqual([]);
  expect.soft(automated.filter(id => !RSV_CASES[id]), 'Tests whose ID is not in the workbook').toEqual([]);
});

/** Every case on the Test Cases sheet of Testcase/Reservations_Page_Test_Cases.xlsx appears in a spec of this folder. */
test('RSV-COV-01 Every Reservations page test case is automated', { tag: [TAG], annotation: { type: 'expected', description: 'Each TC ID on the Test Cases sheet appears in a spec under tests/reservations-page' } }, async () => {
  const code = fs.readdirSync(__dirname).filter(f => f.endsWith('.ts')).map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
  const missing = Object.keys(RESERVATION_CASES).filter(id => !code.includes(`'${id}'`));
  expect(missing, 'Test cases without automation').toEqual([]);
});
