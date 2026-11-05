/**
 * Test data for the Leads page suite, read at run time from TestData/Leads_Test_Data.xlsx
 * (or TestData/csv/<sheet>.csv when TEST_DATA_FORMAT=csv). Nothing the tests type or expect is
 * hard-coded: names, contacts, invalid values, messages, tab rules and expected count changes all
 * come from the data file.
 */
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

export type Row = Record<string, string>;
export type Form = 'Individual' | 'Corporate';

export const TEST_DATA_DIR = path.resolve(__dirname, '../../TestData');
export const DATA_FORMAT = (process.env.TEST_DATA_FORMAT ?? 'xlsx').toLowerCase() === 'csv' ? 'csv' : 'xlsx';

/**
 * Sheet reader for a TestData workbook: `TestData/<xlsx>` by default, `TestData/csv/<csvDir>/<sheet>.csv`
 * with TEST_DATA_FORMAT=csv. Every value comes back as trimmed text; empty rows are dropped.
 */
export function dataBook(xlsx: string, csvDir = '') {
  const source = DATA_FORMAT === 'csv' ? path.join(TEST_DATA_DIR, 'csv', csvDir) : path.join(TEST_DATA_DIR, xlsx);
  const cache: Record<string, Row[]> = {};
  const read = (name: string): Row[] => {
    if (cache[name]) return cache[name];
    let ws: XLSX.WorkSheet;
    if (DATA_FORMAT === 'csv') {
      const file = path.join(source, `${name}.csv`);
      if (!fs.existsSync(file)) throw new Error(`Test data file missing: ${file}`);
      // raw: keep "0-3 Months" or "+91 98### #####" as typed instead of parsing them as dates / numbers
      const wb = XLSX.read(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''), { type: 'string', raw: true });
      ws = wb.Sheets[wb.SheetNames[0]];
    } else {
      const wb = XLSX.readFile(source);
      ws = wb.Sheets[name];
      if (!ws) throw new Error(`Sheet "${name}" missing in ${source}`);
    }
    return (cache[name] = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false })
      .map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), String(v ?? '').trim()])))
      .filter(r => Object.values(r).some(Boolean)));
  };
  return { source, sheet: read };
}

const LEADS_BOOK = dataBook('Leads_Test_Data.xlsx');
export const DATA_SOURCE = LEADS_BOOK.source;
/** All rows of a sheet of Leads_Test_Data (or its CSV). */
export const sheet = LEADS_BOOK.sheet;

export const setting = (name: string): string => {
  const r = sheet('Settings').find(x => x['Setting'] === name);
  if (!r) throw new Error(`Setting "${name}" missing on the Settings sheet`);
  return r['Value'];
};

/** Expected text of a message, with {placeholders} filled in. */
export function message(key: string, vars: Record<string, string> = {}): string {
  const r = sheet('Messages').find(x => x['Message Key'] === key);
  if (!r) throw new Error(`Message "${key}" missing on the Messages sheet`);
  return r['Expected Text'].replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}

// ── Form fields ─────────────────────────────────────────────────────────────
export type FieldDef = { form: Form; label: string; name: string; type: string; mandatory: boolean };
export const fields = (form: Form): FieldDef[] => sheet('Form Fields').filter(r => r['Form'] === form).map(r => ({
  form, label: r['Field Label'], name: r['Field Name'], type: r['Field Type'], mandatory: /^y/i.test(r['Mandatory']),
}));
export const field = (form: Form, label: string): FieldDef => {
  const f = fields(form).find(x => x.label === label);
  if (!f) throw new Error(`Field "${label}" (${form}) missing on the Form Fields sheet`);
  return f;
};
export const mandatoryFields = (form: Form) => fields(form).filter(f => f.mandatory);

// ── Placeholders ────────────────────────────────────────────────────────────
let counter = 0;
/** A token unique to this test (clock + worker + counter), used in emails. */
export const uniqueToken = () => `${Date.now().toString().slice(-8)}${process.env.TEST_WORKER_INDEX ?? 0}${counter++ % 10}`;
const slug = (s: string) => s.toLowerCase().replace(/['’]/g, '').trim().replace(/\s+/g, '.');
const randomDigit = () => String(Math.floor(Math.random() * 10));

/** {today}, {today+N}, {today-N} → Date */
export function relativeDate(text: string): Date | undefined {
  const m = text.match(/\{today(?:([+-])(\d+))?\}/);
  if (!m) return undefined;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (m[1]) d.setDate(d.getDate() + (m[1] === '+' ? 1 : -1) * Number(m[2]));
  return d;
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function fillTemplate(text: string, ctx: { first?: string; last?: string; company?: string; unique?: string }): string {
  return text
    .replace(/\{first\}/g, slug(ctx.first ?? ''))
    .replace(/\{last\}/g, slug(ctx.last ?? ''))
    .replace(/\{company\}/g, slug(ctx.company ?? ''))
    .replace(/\{unique\}/g, ctx.unique ?? uniqueToken())
    .replace(/\{today(?:[+-]\d+)?\}/g, m => iso(relativeDate(m)!))
    .replace(/#/g, randomDigit);
}

/**
 * Lead No. pattern from Settings ("LD-YYYYMMDDhhmmss-XXXX") as a RegExp: a run of Y M D h m s = digits,
 * a run of X = letters / digits, anything else (the "LD-" prefix) literal.
 */
export function leadNoPattern(): RegExp {
  const f = setting('Lead No. Format');
  const re = f.split(/([YMDhms]{2,}|X{2,})/).map(part =>
    /^[YMDhms]{2,}$/.test(part) ? `\\d{${part.length}}`
    : /^X{2,}$/.test(part) ? `[A-Z0-9]{${part.length}}`
    : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
  return new RegExp(`^${re}$`);
}

// ── Leads to create ─────────────────────────────────────────────────────────
export type LeadData = {
  form: Form;
  dataId: string;
  /** Field label → value to enter (labels as on the Form Fields sheet) */
  values: Record<string, string>;
  /** Name shown in the Leads list (the company for Corporate) */
  name: string;
  /** Person named in "<name> was created successfully" (the primary contact for Corporate) */
  contact: string;
  first: string;
  last: string;
  mobile: string;
  email: string;
};

const SHEET: Record<Form, string> = { Individual: 'Individual Leads', Corporate: 'Corporate Leads' };
const FIRST: Record<Form, string> = { Individual: 'First Name', Corporate: 'Primary Contact First Name' };
const LAST: Record<Form, string> = { Individual: 'Last Name', Corporate: 'Primary Contact Last Name' };

const USED_NAMES = path.resolve(__dirname, '../../.auth/used-lead-names.json');
const NAMES_LOCK = `${USED_NAMES}.lock`;
const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
/**
 * A row (name) no earlier save used, across workers and runs: claimed in .auth/used-lead-names.json under a
 * small file lock, so a run never saves two leads with the same name and the next run picks new names.
 */
function claimRow(form: Form, pool: Row[]): Row {
  fs.mkdirSync(path.dirname(USED_NAMES), { recursive: true });
  for (let i = 0; ; i++) {
    try { fs.mkdirSync(NAMES_LOCK); break; } catch {
      if (i > 200) fs.rmSync(NAMES_LOCK, { recursive: true, force: true }); // left by a killed run
      pause(50);
    }
  }
  try {
    const used: Record<string, { id: string; name: string; at: string }[]> = fs.existsSync(USED_NAMES) ? JSON.parse(fs.readFileSync(USED_NAMES, 'utf8')) : {};
    const taken = new Set((used[form] ?? []).map(u => u.id));
    const row = pool.find(r => !taken.has(r['Data ID']));
    if (!row) throw new Error(`All ${pool.length} ${form} names on the "${SHEET[form]}" sheet were used by earlier saves `
      + `(${path.relative(process.cwd(), USED_NAMES)}). Add new rows to the sheet (scripts/build_leads_testdata.py), or delete that file to start over.`);
    const name = form === 'Corporate' ? row['Legal Entity / Company Name'] : `${row[FIRST[form]]} ${row[LAST[form]]}`;
    (used[form] ??= []).push({ id: row['Data ID'], name, at: new Date().toISOString() });
    fs.writeFileSync(USED_NAMES, JSON.stringify(used, null, 1));
    return row;
  } finally {
    fs.rmSync(NAMES_LOCK, { recursive: true, force: true });
  }
}

/** Address block values typed into the create form (Addresses sheet; never saved). */
export function addressData(form: Form) {
  const r = sheet('Addresses').find(x => x['Form'] === form);
  if (!r) throw new Error(`Addresses sheet has no row for ${form}`);
  return r;
}

/**
 * Picks a row (Settings → Data Selection: "random" or a Data ID) and builds a new, unique lead from it.
 * `save: true` = the test saves this lead: it gets a name no earlier save used (Settings → Name Selection).
 */
export function newLead(form: Form, opts: { exclude?: string[]; save?: boolean } = {}): LeadData {
  const rows = sheet(SHEET[form]);
  const choice = setting('Data Selection');
  const fixed = rows.find(r => r['Data ID'] === choice);
  const pool = rows.filter(r => !opts.exclude?.includes(r['Data ID']));
  const row = fixed ?? (opts.save && /^unique$/i.test(setting('Name Selection')) ? claimRow(form, pool)
    : (pool.length ? pool : rows)[Math.floor(Math.random() * (pool.length || rows.length))]);
  const first = row[FIRST[form]], last = row[LAST[form]], company = row['Legal Entity / Company Name'] ?? '';
  const unique = uniqueToken();
  const known = new Set(fields(form).map(f => f.label));
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) if (known.has(k) && v) values[k] = fillTemplate(v, { first, last, company, unique });
  return { form, dataId: row['Data ID'], values, name: form === 'Corporate' ? company : `${first} ${last}`, contact: `${first} ${last}`, first, last, mobile: values['Mobile'], email: values['Email'] };
}

/** Only the values a "mandatory fields" create needs (+ the last name, which is part of the duplicate rule). */
export function basicValues(lead: LeadData): Record<string, string> {
  const keep = new Set([...mandatoryFields(lead.form).map(f => f.label), LAST[lead.form]]);
  return Object.fromEntries(Object.entries(lead.values).filter(([k]) => keep.has(k)));
}

/** Another lead built from a different row, keeping the given fields of `base` (for duplicate-rule cases). */
export function variantOf(base: LeadData, keep: ('name' | 'mobile' | 'email')[]): LeadData {
  const other = newLead(base.form, { exclude: [base.dataId] });
  const v = { ...other.values };
  if (keep.includes('name')) { v[FIRST[base.form]] = base.first; v[LAST[base.form]] = base.last; }
  if (keep.includes('mobile')) v['Mobile'] = base.mobile;
  if (keep.includes('email')) v['Email'] = base.email;
  return { ...other, values: v, first: v[FIRST[base.form]], last: v[LAST[base.form]], mobile: v['Mobile'], email: v['Email'],
    contact: `${v[FIRST[base.form]]} ${v[LAST[base.form]]}`,
    name: base.form === 'Corporate' ? other.name : `${v[FIRST[base.form]]} ${v[LAST[base.form]]}` };
}

/** Human-readable summary of the data used, for the report's "observed values". */
export const describe = (lead: LeadData) => `${lead.dataId}: ${Object.entries(lead.values).map(([k, v]) => `${k}=${v}`).join('; ')}`;

// ── Other sheets ────────────────────────────────────────────────────────────
export type InvalidValue = { caseId: string; form: Form; label: string; value: string; message: string; onBlur: boolean };
export const invalidValues = (caseId: string): InvalidValue[] => sheet('Invalid Values').filter(r => r['Case ID'] === caseId).map(r => ({
  caseId, form: r['Form'] as Form, label: r['Field Label'], value: r['Invalid Value'], message: r['Expected Message'], onBlur: /leaving/i.test(r['Checked When']),
}));

/** Qualification checklist: field label (as in the Lead Detail panel) → value */
export const qualification = (): [string, string][] => sheet('Qualification').map(r => [r['Field Label'], r['Value']]);

export const actionValue = (action: string, label: string): string => {
  const r = sheet('Lead Actions').find(x => x['Action'] === action && x['Field Label'] === label);
  if (!r) throw new Error(`Lead Actions row "${action} / ${label}" missing`);
  return r['Value'];
};

export type TabRule = { tab: string; route: string; owner: string; statuses: string[]; description: string };
export const tabRules = (): TabRule[] => sheet('Tab Rules').map(r => ({
  tab: r['Tab'], route: r['Route'], owner: r['Owner Rule'], statuses: r['Allowed Statuses'].split(',').map(s => s.trim()).filter(Boolean),
  description: r['Page Description Starts With'],
}));
export const tabRule = (tab: string) => {
  const r = tabRules().find(x => x.tab === tab);
  if (!r) throw new Error(`Tab "${tab}" missing on the Tab Rules sheet`);
  return r;
};

/** Expected change of every count after an action: column → +1 / -1 / 0 */
export function countChanges(action: string): Record<string, number> {
  const r = sheet('Count Changes').find(x => x['Action'] === action);
  if (!r) throw new Error(`Count Changes row "${action}" missing`);
  return Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'Action').map(([k, v]) => [k, Number(v)]));
}
