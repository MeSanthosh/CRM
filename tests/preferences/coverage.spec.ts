import { execSync } from 'child_process';
import path from 'path';
import { test, expect } from '../auth';
import { PREFERENCES_CASES } from './shared';

test('PREF-COV-01 Every case in Preferences_Test_Cases.xlsx is automated', { tag: '@preferences-workbook' }, () => {
  const root = path.resolve(__dirname, '../..');
  const listing = execSync('npx playwright test tests/preferences --list --reporter=list', {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const automated = [...listing.matchAll(/›\s(PREF-\d{3})\s/g)].map(match => match[1]);
  test.info().annotations.push({
    type: 'coverage',
    description: `${new Set(automated).size} of ${Object.keys(PREFERENCES_CASES).length} workbook test cases automated`,
  });
  expect.soft(Object.keys(PREFERENCES_CASES).filter(id => !automated.includes(id)), 'Workbook cases without an automated test').toEqual([]);
  expect.soft(automated.filter((id, index, all) => all.indexOf(id) !== index), 'Cases automated more than once').toEqual([]);
  expect.soft(automated.filter(id => !PREFERENCES_CASES[id]), 'Automated IDs absent from the workbook').toEqual([]);
});
