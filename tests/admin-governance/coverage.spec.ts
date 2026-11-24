/** Every case on the Test Cases sheet of Testcase/Admin_Governance_Test_Cases.xlsx has an automated test. */
import fs from 'fs';
import path from 'path';
import { test, expect, ADM_CASES, TAG } from './shared';

test('ADM-COV-01 Every Admin & Governance test case is automated', { tag: [TAG], annotation: { type: 'expected', description: 'Each TC ID on the Test Cases sheet appears in a spec under tests/admin-governance' } }, async () => {
  const code = fs.readdirSync(__dirname).filter(f => f.endsWith('.ts')).map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
  const missing = Object.keys(ADM_CASES).filter(id => !code.includes(`'${id}'`));
  expect(missing, 'Test cases without automation').toEqual([]);
});
