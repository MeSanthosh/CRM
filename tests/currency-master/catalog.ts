import path from 'path';
import * as XLSX from 'xlsx';
import { test, type TestDetails } from '../auth';

export const CURRENCY_WORKBOOK = path.resolve(__dirname, '../../Testcase/Currency_Master_Test_Cases.xlsx');
export const TAG = '@currency-workbook';

export type CurrencyCase = {
  id: string;
  area: string;
  component: string;
  title: string;
  preconditions: string;
  steps: string;
  data: string;
  expected: string;
  type: string;
  priority: string;
};

const text = (value: unknown) => String(value ?? '').trim();
const workbook = XLSX.readFile(CURRENCY_WORKBOOK);
const sheet = workbook.Sheets['Test Cases'];
if (!sheet) throw new Error(`Sheet "Test Cases" missing in ${CURRENCY_WORKBOOK}`);

export const CURRENCY_CASES: Record<string, CurrencyCase> = Object.fromEntries(
  XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    .filter(row => text(row['TC ID']))
    .map(row => {
      const item: CurrencyCase = {
        id: text(row['TC ID']),
        area: text(row.Area),
        component: text(row.Component),
        title: text(row['Test Case']),
        preconditions: text(row.Preconditions),
        steps: text(row['Test Steps']),
        data: text(row['Test Data']),
        expected: text(row['Expected Result']),
        type: text(row.Type),
        priority: text(row.Priority),
      };
      return [item.id, item];
    }),
);

export function currencyCase(id: string): [string, TestDetails] {
  const item = CURRENCY_CASES[id];
  if (!item) throw new Error(`${id} is not in ${path.basename(CURRENCY_WORKBOOK)}`);
  const area = `@currency-${item.area.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return [`${id} ${item.title}`, {
    tag: [TAG, area],
    annotation: { type: 'expected', description: item.expected },
  }];
}

export function currencyCaseSkipped(id: string, reason: string): [string, TestDetails, () => void] {
  const [title, details] = currencyCase(id);
  return [title, { ...details, tag: [...(details.tag as string[]), '@manual'] }, () => test.skip(true, reason)];
}
