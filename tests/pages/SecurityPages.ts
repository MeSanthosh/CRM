/**
 * Page objects for the security flows: sign-in page, user menu (My Profile, Change Password, Log Out),
 * Users & Roles (users, user editor, reset password, roles and permission matrix), Audit Log and
 * Preferences → Security. Locators come from ../locators.ts.
 */
import { Page, Locator, expect } from '@playwright/test';
import { Notice, NoticeInfo } from './Notice';
import { XP, at } from '../locators';
import { act } from '../helpers';

/** Reads a table (header → cell text) — used for the users, roles and audit registers and Customers. */
export async function readTable(table: Locator): Promise<Record<string, string>[]> {
  await expect(table).toBeVisible({ timeout: 20_000 });
  return table.evaluate(t => {
    const heads = [...t.querySelectorAll('thead th')].map(h => (h as HTMLElement).innerText.replace(/[↕▲▼]/g, '').trim());
    return [...t.querySelectorAll('tbody tr')].filter(r => r.querySelectorAll('td').length > 1).map(r => {
      const o: Record<string, string> = { _text: (r as HTMLElement).innerText.replace(/\s+/g, ' ').trim() };
      [...r.children].forEach((c, i) => { if (heads[i]) o[heads[i]] = (c as HTMLElement).innerText.trim(); });
      return o;
    });
  });
}

// ── Sign-in page ─────────────────────────────────────────────────────────────
export type RateLimit = { text: string; waitMs: number; retries: number };

export class LoginPage {
  constructor(readonly page: Page, readonly route = '/login', readonly rateLimit?: RateLimit) {}

  async open(mode: 'Password Login' | 'OTP Login' = 'Password Login') {
    await this.page.goto(this.route);
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await at(this.page, XP.loginMode(mode)).click();
    await expect(at(this.page, XP.loginSubmit)).toBeVisible();
  }
  /** The inputs are read-only until focused (anti-autofill): focus, then type key by key. */
  async type(name: string, value: string) {
    const input = at(this.page, XP.loginField(name));
    await expect(async () => {
      await input.click();
      await expect(input).toBeEditable({ timeout: 2_000 });
      await input.fill('');
      if (value) await input.pressSequentially(value);
      await expect(input).toHaveValue(value, { timeout: 1_000 });
    }).toPass({ timeout: 20_000 });
  }
  async formText() {
    return (await at(this.page, XP.loginForm).innerText()).replace(/\s+/g, ' ').trim();
  }
  async pageText() {
    return (await this.page.locator('body').innerText()).replace(/\s+/g, ' ');
  }
  async passwordType() {
    return (await at(this.page, XP.loginField('password')).getAttribute('type')) ?? '';
  }
  async toggleShow() {
    await at(this.page, XP.loginShow).click();
  }
  async submit() {
    await at(this.page, XP.loginSubmit).click();
  }
  /**
   * Signs in; returns whether the CRM opened and the form's message when it did not. When QA answers
   * with its network-wide rate limit ("Too many authentication attempts"), waits and tries again.
   */
  async signIn(user: string, pass: string): Promise<{ ok: boolean; message: string; rateLimited: number }> {
    let rateLimited = 0;
    for (;;) {
      await this.open();
      await this.type('username', user);
      await this.type('password', pass);
      await expect(at(this.page, XP.loginField('username'))).toHaveValue(user);
      await this.submit();
      const ok = await this.page.waitForURL(u => !u.pathname.startsWith(this.route), { timeout: 30_000 }).then(() => true).catch(() => false);
      const message = ok ? '' : await this.formText();
      if (!ok && this.rateLimit && message.includes(this.rateLimit.text) && rateLimited < this.rateLimit.retries) {
        rateLimited++;
        await this.page.waitForTimeout(this.rateLimit.waitMs);
        continue;
      }
      return { ok, message, rateLimited };
    }
  }
  async isSignInPage() {
    return new URL(this.page.url()).pathname.startsWith(this.route) && (await at(this.page, XP.loginForm).count()) > 0;
  }
}

// ── Change Password (user menu or forced after an admin reset) ──────────────
export class ChangePasswordDialog {
  readonly notice: Notice;
  constructor(readonly page: Page) {
    this.notice = new Notice(page);
  }
  get root() {
    return at(this.page, XP.dialogTitled('Change Password'));
  }
  async isOpen() {
    return this.root.isVisible().catch(() => false);
  }
  async text() {
    return (await this.root.innerText()).replace(/\s+/g, ' ');
  }
  inputs() {
    return this.root.locator('input[type=password], input[type=text]').filter({ hasNot: this.page.locator('[type=checkbox]') });
  }
  async fill(current: string, next: string, confirm: string) {
    const pw = this.root.locator('input:not([type=checkbox])');
    await pw.nth(0).fill(current);
    await pw.nth(1).fill(next);
    await pw.nth(2).fill(confirm);
  }
  async submit(): Promise<NoticeInfo | undefined> {
    await this.root.getByRole('button', { name: 'Change Password', exact: true }).click();
    await this.page.waitForTimeout(800);
    const n = await this.notice.wait(3_000);
    if (n) await this.notice.close();
    return n;
  }
  async fieldTypes() {
    return this.root.locator('input:not([type=checkbox])').evaluateAll(es => es.map(e => (e as HTMLInputElement).type));
  }
  async showPasswords() {
    await this.root.getByLabel('Show passwords').check();
  }
  async buttons() {
    return (await this.root.getByRole('button').allTextContents()).map(b => b.trim()).filter(Boolean);
  }
}

// ── User menu ───────────────────────────────────────────────────────────────
export class AccountMenu {
  readonly notice: Notice;
  constructor(readonly page: Page) {
    this.notice = new Notice(page);
  }
  async label() {
    return (await at(this.page, XP.userMenu).innerText()).split('\n').map(s => s.trim()).filter(s => s && s !== '▾');
  }
  async choose(item: 'My Profile' | 'Change Password' | 'Log Out') {
    await at(this.page, XP.userMenu).click();
    await at(this.page, XP.userMenuItem(item)).click();
    await this.page.waitForTimeout(800);
  }
  async logOut() {
    await this.choose('Log Out');
    await this.page.waitForURL(u => u.pathname.startsWith('/login'), { timeout: 20_000 }).catch(() => {});
  }
  profile() {
    return at(this.page, XP.dialogTitled('My Profile'));
  }
  /** "Signed-in devices" block of My Profile. */
  async devices(): Promise<string> {
    const t = await this.profile().innerText();
    return t.split('Signed-in devices')[1] ?? '';
  }
  /** Sign out other devices; the confirmation is answered with `confirm`. Returns the confirmation. */
  async signOutOthers(confirm: string): Promise<NoticeInfo | undefined> {
    await this.profile().getByRole('button', { name: 'Sign out other devices' }).click();
    const ask = await this.notice.wait(5_000);
    if (ask) await this.notice.close(confirm);
    const after = await this.notice.wait(3_000);
    if (after) await this.notice.close();
    return ask;
  }
}

// ── Users & Roles ────────────────────────────────────────────────────────────
export type NewUser = { username: string; email: string; fullName: string; mobile: string; password?: string };

export class UsersPage {
  readonly notice: Notice;
  constructor(readonly page: Page, readonly route = '/admin') {
    this.notice = new Notice(page);
  }
  async open() {
    await this.page.goto(this.route);
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await expect(at(this.page, XP.adminButton('Users'))).toBeVisible({ timeout: 20_000 });
  }
  async tab(name: 'Users' | 'Roles & Permissions') {
    await act(this.page, () => at(this.page, XP.adminButton(name)).click());
  }
  async search(text: string) {
    await act(this.page, () => at(this.page, XP.usersSearch).fill(text));
    await this.page.waitForTimeout(800);
  }
  async rows() {
    return readTable(this.page.locator('main table').first());
  }
  /** Rows of every page of the register (20 per page), following Next. */
  async allRows(maxPages = 30) {
    const all: Record<string, string>[] = [];
    for (let p = 0; p < maxPages; p++) {
      all.push(...(await this.rows()));
      const next = at(this.page, XP.adminButton('Next'));
      if (!(await next.count()) || (await next.isDisabled())) break;
      await act(this.page, () => next.click());
    }
    return all;
  }
  /** Fills New User and clicks Create User; returns whether the dialog closed and any message shown (dialog or page). */
  async create(u: NewUser): Promise<{ closed: boolean; message: string; status?: number }> {
    await this.open();
    let status: number | undefined;
    const onResp = (r: import('@playwright/test').Response) => { if (r.request().method() === 'POST' && /\/admin\/users$/.test(new URL(r.url()).pathname)) status = r.status(); };
    this.page.on('response', onResp);
    try {
      await at(this.page, XP.adminButton('New User')).click();
      const d = at(this.page, XP.dialogTitled('New User'));
      await expect(d).toBeVisible();
      await d.locator('[name=username]').fill(u.username);
      await d.locator('[name=email]').fill(u.email);
      await d.locator('[name=fullName]').fill(u.fullName);
      await d.locator('[name=mobileNo]').fill(u.mobile);
      if (u.password !== undefined) await d.locator('[name=password]').fill(u.password);
      await d.getByRole('button', { name: 'Create User', exact: true }).click();
      await this.page.waitForTimeout(1500);
      // the refusal message can appear outside the dialog (banner / toast): read the page right away
      const pageText = (await this.page.locator('body').innerText()).replace(/\s+/g, ' ');
      await this.page.waitForTimeout(1000);
      const closed = !(await d.isVisible().catch(() => false));
      const n = await this.notice.wait(1_000);
      if (n) await this.notice.close();
      const message = n?.text ?? (closed ? '' : pageText);
      if (!closed) await d.getByRole('button', { name: 'Close' }).first().click().catch(() => {});
      return { closed, message, status };
    } finally {
      this.page.off('response', onResp);
    }
  }
  /** Opens a user's editor ("Edit User") by username. */
  async edit(username: string): Promise<UserEditor> {
    await this.open();
    await this.search(username);
    await this.page.locator('main table tbody tr', { hasText: username }).first().click();
    const ed = new UserEditor(this.page);
    await expect(ed.root).toBeVisible({ timeout: 15_000 });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    return ed;
  }
}

export class UserEditor {
  readonly notice: Notice;
  constructor(readonly page: Page) {
    this.notice = new Notice(page);
  }
  get root() {
    return at(this.page, XP.dialogTitled('Edit User'));
  }
  private async done(): Promise<NoticeInfo | undefined> {
    const n = await this.notice.wait(8_000);
    if (n) await this.notice.close();
    await this.page.waitForLoadState('networkidle').catch(() => {});
    return n;
  }
  /** Ticks a role (by its name) and makes it the primary role, then saves the roles. */
  async setRole(roleName: string) {
    // the label text runs together: "Sales ExecutiveSALES_EXECUTIVE"
    const rows = this.root.locator('label', { hasText: new RegExp(`^\\s*${roleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|[A-Z][A-Z_]+\\s*$)`) });
    await rows.locator('input[type=checkbox]').first().check();
    const radio = rows.locator('input[type=radio]').first();
    await expect(radio).toBeEnabled();
    await radio.check();
    await this.root.getByRole('button', { name: 'Save User Roles' }).click();
    return this.done();
  }
  async status() {
    return this.root.locator('[name=status]').inputValue();
  }
  async setStatus(label: string) {
    await this.root.locator('[name=status]').selectOption({ label });
    await this.root.getByRole('button', { name: 'Update User' }).click();
    return this.done();
  }
  async loginButton(): Promise<string> {
    return (await this.root.getByRole('button', { name: /^(Disable|Enable) Login$/ }).first().textContent())?.trim() ?? '';
  }
  async toggleLogin() {
    await this.root.getByRole('button', { name: /^(Disable|Enable) Login$/ }).first().click();
    const n = await this.notice.wait(5_000);
    if (n && n.buttons.length > 1) await this.notice.close(n.buttons[n.buttons.length - 1]);
    else if (n) await this.notice.close();
    await this.page.waitForLoadState('networkidle').catch(() => {});
    return n;
  }
  async signOutAll() {
    await this.root.getByRole('button', { name: 'Sign out all devices' }).click();
    const n = await this.notice.wait(5_000);
    if (n && n.buttons.length > 1) await this.notice.close(n.buttons[n.buttons.length - 1]);
    else if (n) await this.notice.close();
    return this.done();
  }
  /** Opens Reset Password; returns the dialog. */
  async openReset(): Promise<Locator> {
    await this.root.getByRole('button', { name: 'Reset Password' }).click();
    const d = at(this.page, XP.dialogTitled('Reset User Password'));
    await expect(d).toBeVisible();
    return d;
  }
  /** Resets the password to `password` (Set Custom Password) and confirms. */
  async resetTo(password: string) {
    const d = await this.openReset();
    await d.getByLabel('Set Custom Password').check();
    await d.locator('input[type=password], input[type=text]').filter({ hasNot: this.page.locator('[type=radio]') }).first().fill(password);
    await d.getByRole('button', { name: 'Confirm & Reset Password' }).click();
    return this.done();
  }
  async close() {
    await this.root.getByRole('button', { name: 'Close' }).first().click().catch(() => {});
  }
}

// ── Roles & Permissions ──────────────────────────────────────────────────────
export const ACTIONS = ['View', 'Create', 'Update', 'Delete', 'Approve', 'Export'] as const;

export class RolesPage {
  readonly notice: Notice;
  constructor(readonly page: Page, readonly users: UsersPage) {
    this.notice = new Notice(page);
  }
  async open() {
    await this.users.open();
    await this.users.tab('Roles & Permissions');
    await expect(this.page.locator('main table').first()).toBeVisible();
  }
  async rows() {
    return readTable(this.page.locator('main table').first());
  }
  async openRole(code: string) {
    await this.open();
    await this.page.locator('main table tbody tr', { hasText: code }).first().click();
    const d = at(this.page, XP.dialogTitled('Edit Role'));
    await expect(d).toBeVisible();
    // the matrix loads after the dialog opens ("Select a role to load permissions.")
    await expect(d.locator('table tbody tr input[type=checkbox]').first()).toBeVisible({ timeout: 30_000 });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    return d;
  }
  /** Permission codes listed in a role's matrix. */
  async matrixCodes(dialog: Locator): Promise<string[]> {
    // since build 3110-10 the first cell is "<module> / <route> / <CODE> / <description>" and group rows sit between
    return dialog.locator('table tbody tr:has(input[type=checkbox])').evaluateAll(rs => rs.map(r =>
      ((r.querySelector('td') as HTMLElement)?.innerText ?? '').split('\n').map(s => s.trim()).find(s => /^[A-Z][A-Z0-9_]+$/.test(s)) ?? ''));
  }
  async matrixHeader(dialog: Locator) {
    return (await dialog.locator('table thead th').allTextContents()).map(s => s.trim());
  }
  /** Creates the role if it is not listed yet. */
  async ensure(code: string, name: string, description: string) {
    await this.open();
    if (await this.page.locator('main table tbody tr', { hasText: code }).count()) return false;
    await at(this.page, XP.adminButton('New Role')).click();
    const d = this.page.locator('[role=dialog]').last();
    await d.locator('[name=code]').fill(code);
    await d.locator('[name=name]').fill(name);
    await d.locator('[name=description]').fill(description);
    await d.getByRole('button', { name: /^(Create Role|Save Role|Create|Save)$/ }).first().click();
    const n = await this.notice.wait(8_000);
    if (n) await this.notice.close();
    return true;
  }
  /** Sets the matrix: `grants` = permission code → actions to tick; every other box is cleared. Saves. */
  async setMatrix(code: string, grants: Record<string, string[]>) {
    const d = await this.openRole(code);
    // a box belongs to the action of its column (rows offer only some actions; group rows have none)
    const header = await this.matrixHeader(d);
    const rows = d.locator('table tbody tr:has(input[type=checkbox])');
    const codes = await this.matrixCodes(d);
    for (let i = 0; i < codes.length; i++) {
      const cells = rows.nth(i).locator(':scope > td');
      for (const action of ACTIONS) {
        const col = header.indexOf(action);
        if (col < 0) continue;
        const box = cells.nth(col).locator('input[type=checkbox]');
        if (!(await box.count())) continue;
        const want = (grants[codes[i]] ?? []).includes(action);
        if ((await box.isChecked()) !== want) await box.setChecked(want);
      }
    }
    await d.getByRole('button', { name: 'Save Permission Matrix' }).click();
    const done = await this.notice.wait(8_000);
    if (done) await this.notice.close();
    return done;
  }
}

// ── Audit Log ────────────────────────────────────────────────────────────────
export class AuditLogPage {
  constructor(readonly page: Page, readonly route = '/admin/audit-log') {}
  async open(tab: 'Record changes' | 'Login activity' = 'Login activity') {
    await this.page.goto(this.route);
    await this.page.waitForLoadState('networkidle').catch(() => {});
    if (await at(this.page, XP.adminButton(tab)).count()) await act(this.page, () => at(this.page, XP.adminButton(tab)).click());
    await this.page.waitForTimeout(800);
  }
  table() {
    return at(this.page, XP.auditTable).filter({ visible: true }).first();
  }
  async rows() {
    return readTable(this.table());
  }
  async filter(label: string, option: string) {
    await act(this.page, () => at(this.page, XP.auditSelect(label)).selectOption({ label: option }));
    await this.page.waitForTimeout(800);
  }
  async options(label: string) {
    return (await at(this.page, XP.auditSelect(label)).locator('option').allTextContents()).map(o => o.trim());
  }
  async search(placeholder: string, text: string) {
    await act(this.page, () => at(this.page, XP.auditSearch(placeholder)).fill(text));
    await this.page.waitForTimeout(1200);
  }
  async mainText() {
    return (await this.page.locator('main').innerText()).replace(/\s+/g, ' ');
  }
}

// ── Preferences ──────────────────────────────────────────────────────────────
export class PreferencesPage {
  constructor(readonly page: Page, readonly route = '/preferences') {}
  async open(tab: string) {
    await this.page.goto(this.route);
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await at(this.page, XP.adminButton(tab)).click();
    await this.page.waitForTimeout(800);
  }
  setting(caption: string) {
    return at(this.page, XP.prefInput(caption));
  }
}
