/** Login Activity & Security Audit (SEC-071 … SEC-079) and the coverage check. */
import fs from 'fs';
import path from 'path';
import { test, expect, note, sc, signIn, newSession, SECURITY_CASES, TAG, TestUser } from './shared';
import { setting, auditEvent, wrongPassword, fill, newPassword, policyValue, message } from './test-data';
import { ChangePasswordDialog } from '../pages/SecurityPages';
import type { Sec } from './shared';

const SEARCH = 'Search name, login ID or IP';
const today = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.getFullYear()}`;
};

/** Login activity rows of a user (by full name), newest first. */
async function activity(sec: Sec, name: string) {
  await sec.audit.open('Login activity');
  await sec.audit.search(SEARCH, name);
  return (await sec.audit.rows()).filter(r => r['User'] === name);
}
const matches = (r: Record<string, string>, key: string) => {
  const e = auditEvent(key);
  return r['Event'] === e.event && (r['Result'] ?? '').startsWith(e.result) && (!e.detail || r._text.includes(e.detail));
};

test.describe('Security · Audit', () => {
  test.describe.configure({ timeout: 600_000 });

  test(...sc('SEC-071'), async ({ sec, browser, baseURL }) => {
    const user = await sec.makeUser('U-SESS');
    (await signIn(browser, baseURL!, user)).close();
    const rows = await activity(sec, user.fullName);
    note('rows', rows.slice(0, 5).map(r => r._text).join(' | '));
    const ok = rows.find(r => matches(r, 'Login Success'));
    expect(ok, 'Password login · Success').toBeTruthy();
    expect.soft(ok?.['When'] ?? '', 'Today').toContain(today());
    expect.soft(ok?.['App / channel'] ?? '', 'App').toBe(setting('App Channel'));
    expect.soft(ok?.['Login ID'] ?? '', 'Login ID masked').toContain(setting('Mask Character'));
  });

  test(...sc('SEC-072'), async ({ sec, browser, baseURL }) => {
    const user = await sec.makeUser('U-SESS');
    const s = await newSession(browser, baseURL!);
    await s.login.signIn(user.username, wrongPassword());
    await s.close();
    const rows = await activity(sec, user.fullName);
    note('rows', rows.slice(0, 5).map(r => r._text).join(' | '));
    expect(rows.some(r => matches(r, 'Login Failed')), 'Password login · Failed · INVALID_CREDENTIALS').toBeTruthy();
  });

  test(...sc('SEC-073'), async ({ sec, browser, baseURL }) => {
    const id = fill(setting('Unknown User Pattern'));
    const s = await newSession(browser, baseURL!);
    await s.login.signIn(id, wrongPassword());
    await s.close();
    await sec.audit.open('Login activity'); // newest first; search does not find login IDs that do not exist
    const rows = (await sec.audit.rows()).filter(r => r['User'] === setting('Unknown User Label') && matches(r, 'Login Failed'));
    note('rows', rows.slice(0, 3).map(r => r._text).join(' | '));
    const mine = rows.find(r => (r['Login ID'] ?? '').startsWith(id.slice(0, Number(setting('Login ID Visible Characters')))) && (r['When'] ?? '').includes(today()));
    expect(mine, 'Failed row with User "Unknown" and the masked login ID').toBeTruthy();
  });

  test(...sc('SEC-074'), async ({ sec, browser, baseURL }) => {
    const user = await sec.makeUser('U-LOCK');
    (await signIn(browser, baseURL!, user)).close();
    const s = await newSession(browser, baseURL!);
    for (let i = 0; i <= policyValue('Max Failed'); i++) await s.login.signIn(user.username, wrongPassword());
    await s.close();
    const rows = await activity(sec, user.fullName);
    note('rows', rows.slice(0, 8).map(r => r._text).join(' | '));
    expect(rows.some(r => matches(r, 'Login Locked')), 'Password login · Failed · ACCOUNT_LOCKED').toBeTruthy();
  });

  test(...sc('SEC-075'), async ({ sec, browser, baseURL }) => {
    const user = await sec.makeUser('U-PWD');
    const s = await signIn(browser, baseURL!, user);
    await s.menu.choose('Change Password');
    const cp = new ChangePasswordDialog(s.page);
    const next = newPassword();
    await cp.fill(wrongPassword(), next, next);
    await cp.submit();
    await cp.fill(user.password, next, next);
    await cp.submit();
    await s.close();
    const rows = await activity(sec, user.fullName);
    note('rows', rows.slice(0, 6).map(r => r._text).join(' | '));
    expect.soft(rows.some(r => matches(r, 'Password Changed')), 'Password changed · Success').toBeTruthy();
    expect(rows.some(r => matches(r, 'Password Change Failed')), 'Password changed · Failed · CURRENT_PASSWORD_INVALID').toBeTruthy();
  });

  test(...sc('SEC-076'), async ({ sec }) => {
    const user = await sec.makeUser('U-PWD');
    await (await sec.users.edit(user.username)).resetTo(newPassword());
    const rows = await activity(sec, user.fullName);
    note('rows', rows.slice(0, 5).map(r => r._text).join(' | '));
    expect(rows.some(r => matches(r, 'Password Reset')), 'Password reset row').toBeTruthy();
  });

  test(...sc('SEC-077'), async ({ sec }) => {
    await sec.audit.open('Login activity');
    for (const label of ['Event', 'Result', 'App']) {
      for (const option of (await sec.audit.options(label)).slice(1)) {
        await sec.audit.open('Login activity');
        await sec.audit.filter(label, option);
        const rows = await sec.audit.rows();
        const col = label === 'App' ? 'App / channel' : label;
        const bad = rows.filter(r => {
          const v = r[col] ?? '';
          if (label === 'Result') return /success/i.test(option) ? !v.startsWith('Success') : !v.startsWith('Failed');
          if (label === 'App') return !v.toUpperCase().startsWith(option.split(' ')[0].toUpperCase());
          return v !== option;
        });
        note(`${label} = ${option}`, `${rows.length} rows, ${bad.length} not matching`);
        expect.soft(bad.map(r => r._text).slice(0, 3), `${label} = ${option}: every row matches`).toEqual([]);
      }
    }
  });

  test(...sc('SEC-078'), async ({ sec }) => {
    for (const label of ['Record type', 'Action']) {
      await sec.audit.open('Record changes');
      for (const option of (await sec.audit.options(label)).slice(1)) {
        await sec.audit.open('Record changes');
        await sec.audit.filter(label, option);
        const rows = await sec.audit.rows();
        const col = label === 'Record type' ? 'Record' : 'Action';
        const bad = rows.filter(r => !(r[col] ?? '').split('\n')[0].trim().toLowerCase().startsWith(option.toLowerCase()));
        note(`${label} = ${option}`, `${rows.length} rows, ${bad.length} not matching`);
        expect.soft(bad.map(r => r._text).slice(0, 3), `${label} = ${option}: every row matches`).toEqual([]);
      }
    }
  });

  test(...sc('SEC-079'), async ({ sec, browser, baseURL }) => {
    const user: TestUser = await sec.makeUser('U-SESS');
    const a = await signIn(browser, baseURL!, user);
    const b = await signIn(browser, baseURL!, user);
    await b.menu.choose('My Profile');
    await b.menu.signOutOthers(message('Sign Out Others Button'));
    await a.close(); await b.close();
    const rows = await activity(sec, user.fullName);
    note('events', rows.map(r => r['Event']).join(' | '));
    const raw = rows.map(r => r['Event']).filter(e => /^[A-Z]+(_[A-Z]+)+$/.test(e ?? ''));
    expect(raw, 'Events shown with readable names').toEqual([]);
  });
});

test('SEC-COV-01 Every security test case is automated or marked manual', { tag: [TAG], annotation: { type: 'expected', description: 'Each TC ID of Security_Test_Cases.xlsx has a test in tests/security' } }, async () => {
  const code = fs.readdirSync(__dirname).filter(f => f.endsWith('.ts')).map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
  const missing = Object.keys(SECURITY_CASES).filter(id => !code.includes(`'${id}'`));
  expect(missing, 'Test cases without a test').toEqual([]);
});
