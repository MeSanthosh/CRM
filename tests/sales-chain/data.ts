/**
 * Test-data reader for the Inventory, Proposals and SPA / Sales Contracts suites: one TestData workbook
 * per module (or its CSV copy with TEST_DATA_FORMAT=csv). Every value a test types or expects comes from it.
 */
import path from 'path';
import { dataBook, Row, TEST_DATA_DIR, fillTemplate } from '../leads-page/test-data';

export type ModuleData = ReturnType<typeof moduleData>;

const digit = () => String(Math.floor(Math.random() * 10));
let counter = 0;
const unique = () => `${Date.now().toString().slice(-7)}${process.env.TEST_WORKER_INDEX ?? 0}${counter++ % 10}`;

/**
 * Fills a value pattern: # = random digit, {seq} = 3 digits shared by a record's code and name,
 * {project} = test project code, {unique}, {first} / {last}, {reservation} / {contract} / {list-3%}.
 * {today+N} is kept: date fields read it themselves.
 */
export function fill(text: string, ctx: Record<string, string | number | undefined> = {}): string {
  let out = text
    .replace(/\{list-(\d+(?:\.\d+)?)%\}/g, (_, p) => String(Math.round(Number(ctx.list) * (1 - Number(p) / 100))))
    .replace(/\{list\}/g, () => String(ctx.list))
    .replace(/\{(seq|project|reservation|contract|proposal|unique)\}/g, (m, k) => (k === 'unique' && ctx.unique === undefined ? unique() : String(ctx[k] ?? m)));
  if (/\{(first|last|company)\}/.test(out)) out = fillTemplate(out, { first: String(ctx.first ?? ''), last: String(ctx.last ?? ''), unique: String(ctx.unique ?? unique()) });
  return out.replace(/#/g, digit);
}
export const seq = () => `${digit()}${digit()}${digit()}`;

export function moduleData(xlsx: string, csvDir: string) {
  const book = dataBook(xlsx, csvDir);
  const sheet = (name: string): Row[] => book.sheet(name);
  const has = (name: string) => { try { sheet(name); return true; } catch { return false; } };
  const setting = (name: string): string => {
    for (const s of ['Settings', 'Deal Settings']) {
      if (!has(s)) continue;
      const r = sheet(s).find(x => x['Setting'] === name);
      if (r) return r['Value'];
    }
    throw new Error(`Setting "${name}" missing in ${xlsx}`);
  };
  const message = (key: string, vars: Record<string, string> = {}): string => {
    const r = sheet('Messages').find(x => x['Message Key'] === key);
    if (!r) throw new Error(`Message "${key}" missing in ${xlsx}`);
    return r['Expected Text'].replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
  };
  /** Expected change of every card after an action (number, or a word such as "Base Price"). */
  const countChanges = (action: string): Record<string, string> => {
    const r = sheet('Count Changes').find(x => x['Action'] === action);
    if (!r) throw new Error(`Count Changes row "${action}" missing in ${xlsx}`);
    return Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'Action'));
  };
  /** Card → { statuses (empty = all), measure } */
  const cardRules = () => sheet('Card Rules').map(r => ({
    card: r['Card'], statuses: /^all$/i.test(r['Statuses']) ? [] : r['Statuses'].split(',').map(s => s.trim()), measure: r['Measure'],
  }));
  /** Field label → field name of a form (Form Fields sheet; `form` filters the Form column when there is one). */
  const fieldNames = (form?: string): Record<string, string> =>
    Object.fromEntries(sheet('Form Fields').filter(r => !form || r['Form'] === form).map(r => [r['Field Label'], r['Field Name']]));
  /** Field label → field name of a form: the Form Fields sheet (rows of that Form) or else Deal Form Fields. */
  const formFields = (form: string): Record<string, string> => {
    for (const sh of ['Form Fields', 'Deal Form Fields']) {
      if (!has(sh)) continue;
      const rows = sheet(sh).filter(r => r['Form'] === form);
      if (rows.length) return Object.fromEntries(rows.map(r => [r['Field Label'], r['Field Name']]));
    }
    throw new Error(`No form fields for "${form}" in ${xlsx}`);
  };
  const mandatory = (form?: string) => sheet('Form Fields').filter(r => (!form || r['Form'] === form) && /^y/i.test(r['Mandatory'])).map(r => r['Field Label']);
  /** Field values of a step / action sheet: { submit button, fields }. */
  const action = (sheetName: string, key: string, keyColumn = 'Action') => {
    const rows = sheet(sheetName).filter(r => r[keyColumn] === key);
    if (!rows.length) throw new Error(`${sheetName} row "${key}" missing in ${xlsx}`);
    return { submit: rows[0]['Submit Button'], fields: Object.fromEntries(rows.filter(r => r['Field']).map(r => [r['Field'], r['Value']])) as Record<string, string> };
  };
  const file = (rel: string) => path.resolve(TEST_DATA_DIR, '..', rel);
  return { source: book.source, sheet, has, setting, message, countChanges, cardRules, fieldNames, formFields, mandatory, action, file };
}

/** Values of a data row keyed by field name (columns that are form fields only), with patterns filled. */
export function formValues(row: Row, names: Record<string, string>, ctx: Record<string, string | number | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [label, value] of Object.entries(row)) if (names[label] && value !== '') out[names[label]] = fill(value, ctx);
  return out;
}

/** Proposal / contract number pattern ("PRO-YYYYMMDDhhmmss-XXXX") as a RegExp. */
export function numberPattern(format: string): RegExp {
  const re = format.split(/([YMDhms]{2,}|X{2,})/).map(p =>
    /^[YMDhms]{2,}$/.test(p) ? `\\d{${p.length}}` : /^X{2,}$/.test(p) ? `[A-Z0-9]{${p.length}}` : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
  return new RegExp(`^${re}$`);
}

/**
 * Value shared by every worker of one run (Playwright restarts its worker after a failed test, which would
 * otherwise rebuild deals and create duplicate data). Stored in .auth/run-cache/<runner pid>-<key>.json;
 * a failure is stored too, so later tests fail fast instead of building again.
 */
export async function runOnce<T>(key: string, make: () => Promise<T>): Promise<T> {
  const fs = await import('fs');
  const dir = path.resolve(__dirname, '../../.auth/run-cache');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${process.ppid}-${key}.json`);
  if (fs.existsSync(file)) {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (saved.error) throw new Error(`${key} could not be built earlier in this run: ${saved.error}`);
    return saved.value as T;
  }
  try {
    const value = await make();
    fs.writeFileSync(file, JSON.stringify({ value }));
    return value;
  } catch (e) {
    // a network drop may be retried (Playwright retries the test); other failures are kept so later tests fail fast
    if (!/net::ERR_|chrome-error|ECONNRESET/.test(String(e))) fs.writeFileSync(file, JSON.stringify({ error: String(e).split('\n')[0].slice(0, 300) }));
    throw e;
  }
}

/** A value of this run that tests update (e.g. the proposal the workflow tests act on), kept across worker restarts. */
export const runValue = {
  file(key: string) {
    return path.resolve(__dirname, '../../.auth/run-cache', `${process.ppid}-${key}.value.json`);
  },
  get<T>(key: string): T | undefined {
    const fs = require('fs') as typeof import('fs');
    const f = runValue.file(key);
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as T) : undefined;
  },
  set<T>(key: string, value: T) {
    const fs = require('fs') as typeof import('fs');
    fs.mkdirSync(path.dirname(runValue.file(key)), { recursive: true });
    fs.writeFileSync(runValue.file(key), JSON.stringify(value));
  },
};
