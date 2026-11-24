/** Every case on the Test Cases sheet of Testcase/Role_Sales_Executive_Test_Cases.xlsx has an automated test. */
import fs from 'fs';
import path from 'path';
import { test, expect } from '../auth';
import { RSE_CASES, TAG } from './shared';

test('RSE-COV-01 Every Sales Executive role test case is automated', { tag: [TAG] }, async () => {
  const code = fs.readdirSync(__dirname).filter(f => f.endsWith('.spec.ts') && f !== 'coverage.spec.ts').map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
  expect(Object.keys(RSE_CASES).filter(id => !code.includes(`'${id}'`)), 'Test cases without automation').toEqual([]);
});
