/** Every case on the Test Cases sheet of Testcase/Leads_Page_Test_Cases.xlsx has an automated test. */
import fs from 'fs';
import path from 'path';
import { test, expect } from './shared';
import { LEADS_PAGE_CASES, TAG } from './catalog';

test('LP-COV-01 Every Leads page test case is automated', { tag: [TAG], annotation: { type: 'expected', description: 'Each TC ID on the Test Cases sheet appears in a spec under tests/leads-page' } }, async () => {
  const dir = __dirname;
  const code = fs.readdirSync(dir).filter(f => f.endsWith('.ts')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  // IDs are written literally ('LP-011') or built from a number (`LP-0${61 + i}` covers LP-061 … LP-065)
  const built = new Set<string>();
  for (const m of code.matchAll(/`LP-0\$\{(\d+) \+ i\}`[\s\S]{0,200}?/g)) for (let i = 0; i < 5; i++) built.add(`LP-0${Number(m[1]) + i}`);
  const missing = Object.keys(LEADS_PAGE_CASES).filter(id => !code.includes(`'${id}'`) && !built.has(id));
  expect(missing, 'Test cases without automation').toEqual([]);
});
