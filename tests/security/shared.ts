/**
 * Shared pieces of the security suite: catalog helpers, a `sec` fixture (admin page objects + a factory
 * for test users that are retired when the test ends) and sign-in helpers for a separate browser.
 * Passwords never go into notes or reports.
 */
import fs from 'fs';
import path from 'path';
import type { Browser, Page } from '@playwright/test';
import { test as base, expect } from '../auth';
import { makeCatalog } from '../leads-page/catalog';
import { LoginPage, ChangePasswordDialog, AccountMenu, UsersPage, RolesPage, AuditLogPage, PreferencesPage } from '../pages/SecurityPages';
import { setting, message, userFrom, newPassword, UserRow, rolePermissions } from './test-data';

const CAT = makeCatalog('Security_Test_Cases.xlsx', '@security');
export const SECURITY_CASES = CAT.CASES;
export const TAG = CAT.tag;
export const sc = CAT.tc;
export const scRow = CAT.tcRow;
export { expect };

export function note(type: string, description: string) {
  test.info().annotations.push({ type, description });
}

export type TestUser = UserRow & { password: string };

/** A user signed in on its own browser context. */
export type Session = { page: Page; login: LoginPage; menu: AccountMenu; close: () => Promise<void> };

export async function newSession(browser: Browser, baseURL: string): Promise<Session> {
  const ctx = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20_000);
  const rateLimit = { text: message('Rate Limited'), waitMs: Number(setting('Rate Limit Wait Seconds')) * 1000, retries: Number(setting('Rate Limit Retries')) };
  return { page, login: new LoginPage(page, setting('Login Route'), rateLimit), menu: new AccountMenu(page), close: () => ctx.close() };
}

/**
 * Signs `user` in on a new browser. When the app asks for a new password (first sign-in after an admin
 * set it), the change is completed with a new generated password and `user.password` is updated.
 * The test stops when the sign-in fails, unless `mayFail` (the test expects a refusal).
 */
export async function signIn(browser: Browser, baseURL: string, user: TestUser, loginId = user.username, mayFail = false): Promise<Session & { ok: boolean; message: string; forced: boolean }> {
  const s = await newSession(browser, baseURL);
  const r = await s.login.signIn(loginId, user.password);
  if (r.rateLimited) note('rate limit', `waited ${r.rateLimited} time(s) for "${message('Rate Limited')}"`);
  if (!mayFail) expect(r.ok, `${user.fullName} signed in (${r.message})`).toBeTruthy();
  let forced = false;
  if (r.ok) {
    const cp = new ChangePasswordDialog(s.page);
    await s.page.waitForTimeout(1500);
    if (await cp.isOpen()) {
      forced = true;
      const next = newPassword();
      await cp.fill(user.password, next, next);
      await cp.submit();
      await expect(cp.root, 'First-time password change completed').toBeHidden({ timeout: 20_000 });
      user.password = next;
    }
  }
  return { ...s, ...r, forced };
}

const LOCK = path.resolve(__dirname, '../../.auth/users-write.lock');
/** Runs `fn` while no other worker creates or retires users (the user counts must stay still). */
export async function withUsersLock<T>(fn: () => Promise<T>): Promise<T> {
  fs.mkdirSync(path.dirname(LOCK), { recursive: true });
  const until = Date.now() + 5 * 60_000;
  for (;;) {
    try { fs.mkdirSync(LOCK); break; } catch {
      try { if (Date.now() - fs.statSync(LOCK).mtimeMs > 3 * 60_000) fs.rmSync(LOCK, { recursive: true, force: true }); } catch { /* gone */ }
      if (Date.now() > until) throw new Error('Waited 5 minutes for the users lock');
      await new Promise(r => setTimeout(r, 500));
    }
  }
  try { return await fn(); } finally { fs.rmSync(LOCK, { recursive: true, force: true }); }
}

export type Sec = {
  admin: Page;
  users: UsersPage;
  roles: RolesPage;
  audit: AuditLogPage;
  prefs: PreferencesPage;
  /** Creates a user from a Test Users row (role assigned, initial password set) and retires it after the test. */
  makeUser: (dataId: string, opts?: { role?: string }) => Promise<TestUser>;
};

export const test = base.extend<{ sec: Sec }>({
  sec: async ({ page }, use) => {
    page.setDefaultTimeout(30_000);
    const users = new UsersPage(page, setting('Users Route'));
    const roles = new RolesPage(page, users);
    const made: TestUser[] = [];
    const makeUser = async (dataId: string, opts: { role?: string } = {}) => {
      const row = userFrom(dataId);
      const user: TestUser = { ...row, role: opts.role ?? row.role, password: newPassword() };
      const r = await withUsersLock(() => users.create({ username: user.username, email: user.email, fullName: user.fullName, mobile: user.mobile, password: user.password }));
      expect(r.closed, `Test user ${user.username} created (${r.message})`).toBeTruthy();
      made.push(user);
      if (user.role === setting('Test Role Name') && (await roles.ensure(setting('Test Role Code'), setting('Test Role Name'), setting('Test Role Description'))))
        await roles.setMatrix(setting('Test Role Code'), rolePermissions('Base'));
      const ed = await users.edit(user.username);
      await ed.setRole(user.role);
      await ed.close();
      note('test user', `${user.dataId}: ${user.fullName} (${user.username}, ${user.email}, ${user.mobile}) · role ${user.role}`);
      return user;
    };
    await use({ admin: page, users, roles, audit: new AuditLogPage(page, setting('Audit Route')), prefs: new PreferencesPage(page, setting('Preferences Route')), makeUser });
    if (/^y/i.test(setting('Retire Test Users'))) {
      for (const u of made) {
        try {
          await withUsersLock(async () => {
            const ed = await users.edit(u.username);
            if ((await ed.loginButton()) === 'Disable Login') await ed.toggleLogin();
            const again = await users.edit(u.username);
            await again.setStatus('Inactive');
          });
        } catch (e) {
          console.warn(`Could not retire ${u.username}: ${String(e).split('\n')[0]}`);
        }
      }
    }
  },
});

/** Visible fragments of a masked value, e.g. "+2547••••••55" → ["+2547", "55"]. */
export const fragments = (masked: string, mask: string) => masked.split(mask).map(s => s.trim()).filter(Boolean);
