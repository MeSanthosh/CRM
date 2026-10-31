/** Every case on the Test Cases sheet of Testcase/Lead_Insights_Page_Test_Cases.xlsx has an automated test. */
import fs from 'fs';
import path from 'path';
import { test, expect, LEAD_INSIGHTS_CASES, TAG } from './shared';

test('LSI-COV-01 Every Lead Insights test case is automated', { tag: [TAG], annotation: { type: 'expected', description: 'Each TC ID on the Test Cases sheet appears in a spec under tests/lead-insights' } }, async () => {
  const code = fs.readdirSync(__dirname).filter(f => f.endsWith('.ts')).map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
  const missing = Object.keys(LEAD_INSIGHTS_CASES).filter(id => !code.includes(`'${id}'`));
  expect(missing, 'Test cases without automation').toEqual([]);
});
