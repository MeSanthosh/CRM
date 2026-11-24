/** Every case on the Test Cases sheet of Testcase/Executive_Dashboards_Test_Cases.xlsx has an automated test. */
import fs from 'fs';
import path from 'path';
import { test, expect } from '../auth';
import { ED_CASES, TAG } from './shared';

test('EXD-COV-01 Every Executive Dashboards test case is automated', { tag: [TAG], annotation: { type: 'expected', description: 'Each TC ID on the Test Cases sheet appears in a spec under tests/executive-dashboards' } }, async () => {
  const code = fs.readdirSync(__dirname).filter(f => f.endsWith('.spec.ts') && f !== 'coverage.spec.ts').map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
  const missing = Object.keys(ED_CASES).filter(id => !code.includes(`'${id}'`));
  expect(missing, 'Test cases without automation').toEqual([]);
  const used = [...code.matchAll(/'((?:EXD|MSW)-\d{3})'/g)].map(m => m[1]);
  expect(used.filter(id => !ED_CASES[id]), 'Tests whose ID is not in the workbook').toEqual([]);
});
