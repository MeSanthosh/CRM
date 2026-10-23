/**
 * Opportunities workbooks — every test case on Opportunities_Test_Cases.xlsx has exactly one automated test,
 * every test ID a use case lists under "Related Test Case IDs" is on that sheet with the same use case,
 * and every use case is covered.
 */
import { execSync } from 'child_process';
import path from 'path';
import { test, expect } from '../auth';
import { USE_CASES, OPP_CASES, TAG } from './catalog';

// ── OPP-COV-01 · Coverage check
// Checks: every test case on the "Test Cases" sheet of Opportunities_Test_Cases.xlsx has exactly one automated test (no missing, duplicate or unknown IDs).
test('OPP-COV-01 Every test case in Opportunities_Test_Cases.xlsx is automated', { tag: TAG }, () => {
  const root = path.resolve(__dirname, '../..');
  const listing = execSync('npx playwright test tests/opportunities --list --reporter=list', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const automated = [...listing.matchAll(/›\s(OPP-\d{3})\s/g)].map(m => m[1]);
  const referenced = [...new Set(Object.values(USE_CASES).flatMap(u => u.related))];
  test.info().annotations.push({ type: 'coverage', description: `${Object.keys(USE_CASES).length} use cases, ${referenced.length} referenced test IDs, ${new Set(automated).size} automated` });

  expect.soft(referenced.filter(id => !OPP_CASES[id]), 'Use-case test IDs missing from Opportunities_Test_Cases.xlsx').toEqual([]);
  expect.soft(Object.keys(OPP_CASES).filter(id => !automated.includes(id)), 'Test cases in Opportunities_Test_Cases.xlsx without a test').toEqual([]);
  expect.soft(automated.filter((id, i, a) => a.indexOf(id) !== i), 'Test IDs automated twice').toEqual([]);
  expect.soft(automated.filter(id => !OPP_CASES[id]), 'Tests whose ID is not in Opportunities_Test_Cases.xlsx').toEqual([]);
  // each test case's "Use Case ID" must match the use-case workbook's "Related Test Case IDs"
  const mismatched = Object.values(OPP_CASES).filter(c => referenced.includes(c.id)).flatMap(c => {
    const fromWorkbook = Object.values(USE_CASES).filter(u => u.related.includes(c.id)).map(u => u.id).sort();
    return JSON.stringify(fromWorkbook) === JSON.stringify([...c.uc].sort()) ? [] : [`${c.id}: catalog ${c.uc.join('+')} vs workbook ${fromWorkbook.join('+')}`];
  });
  expect.soft(mismatched, 'Catalog use case ≠ workbook use case').toEqual([]);
  const uncovered = Object.keys(USE_CASES).filter(uc => !Object.values(OPP_CASES).some(c => c.uc.includes(uc) && automated.includes(c.id)));
  expect.soft(uncovered, 'Use cases without any test').toEqual([]);
});
