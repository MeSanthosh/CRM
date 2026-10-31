/** Every case on the Test Cases sheet of Testcase/Opportunities_Page_Test_Cases.xlsx has an automated test. */
import fs from 'fs';
import path from 'path';
import { test, expect, OPPORTUNITY_CASES, TAG } from './shared';

test('OPP-COV-01 Every Opportunities page test case is automated', { tag: [TAG], annotation: { type: 'expected', description: 'Each TC ID on the Test Cases sheet appears in a spec under tests/opportunities-page' } }, async () => {
  const code = fs.readdirSync(__dirname).filter(f => f.endsWith('.ts')).map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
  const missing = Object.keys(OPPORTUNITY_CASES).filter(id => !code.includes(`'${id}'`));
  expect(missing, 'Test cases without automation').toEqual([]);
});
