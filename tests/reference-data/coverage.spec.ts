import { execSync } from 'child_process';
import path from 'path';
import { test, expect } from '../auth';
import { REFERENCE_DATA_CASES } from './shared';

test('RDM-COV-01 Every case in Reference_Data_Test_Cases.xlsx is automated', { tag: '@reference-data-workbook' }, () => {
  const root = path.resolve(__dirname, '../..');
  const listing = execSync('npx playwright test tests/reference-data --list --reporter=list', {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const automated = [...listing.matchAll(/›\s(RDM-\d{3})\s/g)].map(match => match[1]);
  test.info().annotations.push({
    type: 'coverage',
    description: `${new Set(automated).size} of ${Object.keys(REFERENCE_DATA_CASES).length} workbook test cases automated`,
  });
  expect.soft(Object.keys(REFERENCE_DATA_CASES).filter(id => !automated.includes(id)), 'Workbook cases without an automated test').toEqual([]);
  expect.soft(automated.filter((id, index, all) => all.indexOf(id) !== index), 'Cases automated more than once').toEqual([]);
  expect.soft(automated.filter(id => !REFERENCE_DATA_CASES[id]), 'Automated IDs absent from the workbook').toEqual([]);
});
