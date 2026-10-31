/**
 * Test data for the security suite, read at run time from TestData/Security_Test_Data.xlsx
 * (or TestData/csv/Security/<sheet>.csv when TEST_DATA_FORMAT=csv). Nothing is hard-coded in the specs.
 */
import { dataBook, uniqueToken } from '../leads-page/test-data';

const BOOK = dataBook('Security_Test_Data.xlsx', 'Security');
export const sheet = BOOK.sheet;

export const setting = (name: string): string => {
  const r = sheet('Settings').find(x => x['Setting'] === name);
  if (!r) throw new Error(`Setting "${name}" missing on the Security Settings sheet`);
  return r['Value'];
};
export const list = (name: string) => setting(name).split('|').map(s => s.trim()).filter(Boolean);

export function message(key: string): string {
  const r = sheet('Messages').find(x => x['Message Key'] === key);
  if (!r) throw new Error(`Message "${key}" missing on the Security Messages sheet`);
  return r['Expected Text'];
}
export const noAccess = () => new RegExp(message('No Access Pattern'), 'i');

export const policy = () => sheet('Security Policy').map(r => ({ policy: r['Policy'], expected: r['Expected Value'] }));
export const policyValue = (prefix: string) => {
  const r = policy().find(p => p.policy.startsWith(prefix));
  if (!r) throw new Error(`Security Policy "${prefix}…" missing`);
  return Number(r.expected);
};

export type AuditEvent = { event: string; result: string; detail: string };
export const auditEvent = (key: string): AuditEvent => {
  const r = sheet('Audit Events').find(x => x['Event Key'] === key);
  if (!r) throw new Error(`Audit event "${key}" missing`);
  return { event: r['Event'], result: r['Result'], detail: r['Detail'] };
};

/** Fills # with random digits and {unique} with a run-unique token. */
export const fill = (pattern: string, ctx: Record<string, string> = {}) =>
  pattern.replace(/\{(\w+)\}/g, (m, k) => (k === 'unique' ? uniqueToken() : ctx[k] ?? m)).replace(/#/g, () => String(Math.floor(Math.random() * 10)));
export const newPassword = () => fill(setting('Password Pattern'));
export const wrongPassword = () => fill(setting('Wrong Password Pattern'));

export type UserRow = { dataId: string; fullName: string; username: string; email: string; mobile: string; role: string; usedFor: string };
/** A user built from a Test Users row: proper name, unique username / email / mobile for this run. */
export function userFrom(dataId: string): UserRow {
  const r = sheet('Test Users').find(x => x['Data ID'] === dataId);
  if (!r) throw new Error(`Test user "${dataId}" missing on the Test Users sheet`);
  const [first, ...rest] = r['Full Name'].split(' ');
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const unique = uniqueToken();
  const ctx = { first: slug(first), last: slug(rest.join('')), unique };
  return { dataId, fullName: r['Full Name'], username: fill(r['Username'], ctx), email: fill(r['Email'], ctx), mobile: fill(r['Mobile'], ctx), role: r['Primary Role'], usedFor: r['Used For'] };
}

export const roleMasking = () => sheet('Role Masking').map(r => ({ role: r['Role'], masked: /^y/i.test(r['Expect PII Masked']), note: r['Note'] }));
/** Test Users row for a role (first one). */
export const userIdForRole = (role: string) => {
  const r = sheet('Test Users').find(x => x['Primary Role'] === role);
  if (!r) throw new Error(`No Test Users row with role "${role}"`);
  return r['Data ID'];
};
export const maskingChecks = () => sheet('Masking Checks').map(r => ({ page: r['Page'], route: r['Route'], column: r['Column'], kind: r['Kind'] as 'name' | 'phone' | 'email' }));
export const moduleRoutes = () => sheet('Module Routes').map(r => ({ permission: r['Permission'], label: r['Menu Label'], route: r['Route'] }));

const ACTIONS = ['View', 'Create', 'Update', 'Delete', 'Approve', 'Export'];
/** Permission matrix of a step ("Base" / "Grant"): permission code → ticked actions. Grant adds to Base. */
export function rolePermissions(step: 'Base' | 'Grant'): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const r of sheet('Test Role Permissions').filter(x => x['Step'] === 'Base' || (step === 'Grant' && x['Step'] === 'Grant'))) {
    out[r['Permission']] = [...new Set([...(out[r['Permission']] ?? []), ...ACTIONS.filter(a => /^y/i.test(r[a]))])];
  }
  return out;
}

export type PasswordRule = { case: string; current: string; next: string; confirm: string; message: string };
/** Password Rules with placeholders resolved for a user whose current password is `current`. */
export function passwordRules(current: string): PasswordRule[] {
  return sheet('Password Rules').map(r => {
    const valid = newPassword(), valid2 = newPassword(), wrong = wrongPassword();
    const sub = (v: string, next?: string) => v.replace('{current}', current).replace('{valid2}', valid2).replace('{valid}', valid).replace('{wrong}', wrong).replace('{new}', next ?? '');
    const next = sub(r['New']);
    return { case: r['Case'], current: sub(r['Current']), next, confirm: sub(r['Confirm'], next), message: message(r['Expected Message Key']) };
  });
}
