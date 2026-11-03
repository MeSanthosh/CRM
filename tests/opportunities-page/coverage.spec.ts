/**
 * Opportunities workbook (Testcase/Opportunities_Page_Test_Cases.xlsx) — every test case on its "Test Cases" sheet
 * (Maha's OPP-001…078 and the generated OPP-101…132) has exactly one automated test, every test ID a use case lists
 * under "Related Test Case IDs" is on that sheet with the same use case, and every use case is covered.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { test, expect } from '../auth';
import { USE_CASES, OPP_CASES, TAG } from './catalog';
import { OPPORTUNITY_CASES } from './shared';

// ── OPP-COV-01 · Coverage check
// Checks: every test case on the "Test Cases" sheet of Opportunities_Page_Test_Cases.xlsx has exactly one automated test (no missing, duplicate or unknown IDs).
test('OPP-COV-01 Every test case in Opportunities_Page_Test_Cases.xlsx is automated', { tag: TAG }, () => {
  const root = path.resolve(__dirname, '../..');
  const listing = execSync('npx playwright test tests/opportunities-page --list --reporter=list', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const automated = [...listing.matchAll(/›\s(OPP-\d{3})\s/g)].map(m => m[1]);
  const referenced = [...new Set(Object.values(USE_CASES).flatMap(u => u.related))];
  test.info().annotations.push({ type: 'coverage', description: `${Object.keys(USE_CASES).length} use cases, ${referenced.length} referenced test IDs, ${new Set(automated).size} automated` });

  expect.soft(referenced.filter(id => !OPP_CASES[id]), 'Use-case test IDs missing from Opportunities_Page_Test_Cases.xlsx').toEqual([]);
  expect.soft(Object.keys(OPP_CASES).filter(id => !automated.includes(id)), 'Test cases in Opportunities_Page_Test_Cases.xlsx without a test').toEqual([]);
  expect.soft(automated.filter((id, i, a) => a.indexOf(id) !== i), 'Test IDs automated twice').toEqual([]);
  expect.soft(automated.filter(id => !OPP_CASES[id]), 'Tests whose ID is not in Opportunities_Page_Test_Cases.xlsx').toEqual([]);
  // each test case's "Use Case ID" must match the use-case sheets' "Related Test Case IDs"
  const mismatched = Object.values(OPP_CASES).filter(c => referenced.includes(c.id)).flatMap(c => {
    const fromWorkbook = Object.values(USE_CASES).filter(u => u.related.includes(c.id)).map(u => u.id).sort();
    return JSON.stringify(fromWorkbook) === JSON.stringify([...c.uc].sort()) ? [] : [`${c.id}: catalog ${c.uc.join('+')} vs workbook ${fromWorkbook.join('+')}`];
  });
  expect.soft(mismatched, 'Catalog use case ≠ workbook use case').toEqual([]);
  const uncovered = Object.keys(USE_CASES).filter(uc => !Object.values(OPP_CASES).some(c => c.uc.includes(uc) && automated.includes(c.id)));
  expect.soft(uncovered, 'Use cases without any test').toEqual([]);
});

/** Every case on the Test Cases sheet of Testcase/Opportunities_Page_Test_Cases.xlsx appears in a spec of this folder. */
test('OPP-COV-02 Every Opportunities page test case is automated', { tag: [TAG], annotation: { type: 'expected', description: 'Each TC ID on the Test Cases sheet appears in a spec under tests/opportunities-page' } }, async () => {
  const code = fs.readdirSync(__dirname).filter(f => f.endsWith('.ts')).map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
  const missing = Object.keys(OPPORTUNITY_CASES).filter(id => !code.includes(`'${id}'`));
  expect(missing, 'Test cases without automation').toEqual([]);
});
