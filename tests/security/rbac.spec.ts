/** Role-Based Access Control & Permissions (SEC-021 … SEC-034). */
import { test, expect, note, sc, signIn, withUsersLock, Sec } from './shared';
import { setting, message, noAccess, moduleRoutes, rolePermissions, newPassword, userFrom } from './test-data';
import { ACTIONS } from '../pages/SecurityPages';
import { kpi } from '../helpers';
import { XP, at } from '../locators';
import type { Page } from '@playwright/test';

/** Main-menu labels the user sees (Settings flyout not included). */
async function menu(page: Page) {
  return (await at(page, XP.mainMenuLinks).allTextContents()).map(s => s.trim()).filter(s => s && !/^https?:/.test(s));
}
/** True when a page refuses access: redirect away, a no-access message, or nothing of the page shown. */
async function refused(page: Page, route: string) {
  await page.goto(route);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  const path = new URL(page.url()).pathname;
  const text = await page.locator('main').innerText().catch(() => '');
  return { refused: path !== route || noAccess().test(text), path, text: text.replace(/\s+/g, ' ').slice(0, 200) };
}
async function ensureTestRole(sec: Sec, step: 'Base' | 'Grant') {
  await sec.roles.ensure(setting('Test Role Code'), setting('Test Role Name'), setting('Test Role Description'));
  return sec.roles.setMatrix(setting('Test Role Code'), rolePermissions(step));
}

test.describe('Security · Roles & Permissions', () => {
  test.describe.configure({ timeout: 600_000 });

  test(...sc('SEC-021'), async ({ sec }) => {
    await withUsersLock(async () => {
      await sec.users.open();
      const cards = { users: await kpi(sec.admin, 'Users'), active: await kpi(sec.admin, 'Active Users'), roles: await kpi(sec.admin, 'Roles'), disabled: await kpi(sec.admin, 'Login Disabled') };
      // default filter (staff only, as the cards): every page of the register
      const all = await sec.users.allRows(); // 20 users per page
      const listed = { users: all.length, active: all.filter(r => /ACTIVE/i.test(r['Status'] ?? '') && !/INACTIVE/i.test(r['Status'] ?? '')).length, disabled: all.filter(r => /Disabled/i.test(r['Login'] ?? '')).length };
      await sec.users.tab('Roles & Permissions');
      const roles = (await sec.roles.rows()).length;
      note('cards / listed', `${JSON.stringify(cards)} / ${JSON.stringify({ ...listed, roles })}`);
      expect.soft(listed.users, 'Users card').toBe(cards.users);
      expect.soft(listed.active, 'Active Users card').toBe(cards.active);
      expect.soft(listed.disabled, 'Login Disabled card').toBe(cards.disabled);
      expect(roles, 'Roles card').toBe(cards.roles);
    });
  });

  test(...sc('SEC-022'), async ({ sec }) => {
    await sec.roles.open();
    const roles = (await sec.roles.rows()).map(r => (r['Role'] ?? '').split('\n').pop()!.trim());
    note('roles', roles.join(', '));
    for (const code of roles) {
      const d = await sec.roles.openRole(code);
      const header = await sec.roles.matrixHeader(d);
      const codes = await sec.roles.matrixCodes(d);
      expect.soft(header.slice(1), `${code}: actions`).toEqual([...ACTIONS]);
      for (const m of moduleRoutes()) expect.soft(codes, `${code}: permission ${m.permission}`).toContain(m.permission);
      await d.getByRole('button', { name: 'Close' }).first().click();
    }
  });

  test(...sc('SEC-023'), async ({ sec }) => {
    const user = await sec.makeUser('U-SESS');
    const again = await withUsersLock(() => sec.users.create({ username: user.username, email: `x${user.email}`, fullName: user.fullName, mobile: user.mobile, password: newPassword() }));
    note('second create', `${again.status} ${again.message}`);
    expect.soft(again.closed, 'Second user refused').toBeFalsy();
    expect.soft(again.message, 'Duplicate message').toContain(message('Duplicate User'));
    await sec.users.open();
    await sec.users.search(user.username);
    expect((await sec.users.rows()).filter(r => r._text.includes(user.username)).length, 'Only one user').toBe(1);
  });

  test(...sc('SEC-024'), async ({ sec }) => {
    const u = userFrom('U-SESS');
    const short = newPassword().slice(0, 3);
    const r = await withUsersLock(() => sec.users.create({ username: u.username, email: u.email, fullName: u.fullName, mobile: u.mobile, password: short }));
    note('result', `${r.status ?? ''} closed=${r.closed} ${r.message}`);
    if (r.closed) { // created anyway: retire it
      const ed = await sec.users.edit(u.username);
      await ed.toggleLogin();
      await (await sec.users.edit(u.username)).setStatus('Inactive');
    }
    expect.soft(r.closed, 'User with a 3-character password is not created').toBeFalsy();
    expect(r.message, 'Password rule shown').toMatch(/8 characters/);
  });

  test(...sc('SEC-025'), async ({ sec, browser, baseURL }) => {
    const user = await sec.makeUser('U-SE');
    const s = await signIn(browser, baseURL!, user);
    expect(s.ok, 'Signed in').toBeTruthy();
    const label = await s.menu.label();
    note('user menu', label.join(' / '));
    expect(label, 'Assigned role').toContain(user.role);
    await s.close();
  });

  test(...sc('SEC-026'), async ({ sec, browser, baseURL }) => {
    const s = await signIn(browser, baseURL!, await sec.makeUser('U-SE'));
    await s.page.goto(setting('Audit Route'));
    await s.page.waitForLoadState('networkidle').catch(() => {});
    const text = await s.page.locator('main').innerText();
    expect.soft(text, 'No-access message').toContain(message('Audit No Access'));
    expect(await s.page.locator('main table tbody tr td').count(), 'No audit rows').toBe(0);
    await s.close();
  });

  for (const [id, key] of [['SEC-027', 'Users Route'], ['SEC-028', 'Preferences Route']] as const) {
    test(...sc(id), async ({ sec, browser, baseURL }) => {
      const s = await signIn(browser, baseURL!, await sec.makeUser('U-SE'));
      const r = await refused(s.page, setting(key));
      note('page shown', `${r.path} · ${r.text}`);
      if (key === 'Users Route') expect.soft(await s.page.getByRole('button', { name: 'New User' }).count(), 'New User not offered').toBe(0);
      expect(r.refused, `${setting(key)} refused for a Sales Executive`).toBeTruthy();
      await s.close();
    });
  }

  test.describe('custom role', () => {
    // each test sets the matrix it needs (SEC-032 restores Base when done); the suite runs one worker

    test(...sc('SEC-029'), async ({ sec, browser, baseURL }) => {
      await ensureTestRole(sec, 'Base');
      const s = await signIn(browser, baseURL!, await sec.makeUser('U-ROLE'));
      const view = Object.entries(rolePermissions('Base')).filter(([, a]) => a.includes('View')).map(([p]) => p);
      const want = moduleRoutes().filter(m => view.includes(m.permission)).map(m => m.label);
      const shown = await menu(s.page);
      note('menu', shown.join(', '));
      const mainLabels = moduleRoutes().map(m => m.label);
      expect(shown.filter(l => mainLabels.includes(l)).sort(), 'Menu = modules with View permission').toEqual([...want].sort());
      await s.close();
    });

    test(...sc('SEC-030'), async ({ sec, browser, baseURL }) => {
      await ensureTestRole(sec, 'Base');
      const s = await signIn(browser, baseURL!, await sec.makeUser('U-ROLE'));
      const view = Object.entries(rolePermissions('Base')).filter(([, a]) => a.includes('View')).map(([p]) => p);
      for (const m of moduleRoutes()) {
        const r = await refused(s.page, m.route);
        note(m.route, `${r.refused ? 'refused' : 'opened'} · ${r.path}`);
        if (view.includes(m.permission)) expect.soft(r.refused, `${m.label} (permitted) opens`).toBeFalsy();
        else expect.soft(r.refused, `${m.label} (no View) refused`).toBeTruthy();
      }
      await s.close();
    });

    test(...sc('SEC-031'), async ({ sec, browser, baseURL }) => {
      await ensureTestRole(sec, 'Base');
      const s = await signIn(browser, baseURL!, await sec.makeUser('U-ROLE'));
      const leads = moduleRoutes().find(m => m.permission === 'LEADS')!.route;
      await s.page.goto(leads);
      await s.page.waitForLoadState('networkidle').catch(() => {});
      const create = await at(s.page, XP.leadsCreate('individual')).count() + await at(s.page, XP.leadsCreate('corporate')).count();
      expect(create, 'No create buttons without Create permission').toBe(0);
      await s.close();
    });

    test(...sc('SEC-032'), async ({ sec, browser, baseURL }) => {
      const user = await sec.makeUser('U-ROLE');
      await ensureTestRole(sec, 'Grant');
      try {
        const s = await signIn(browser, baseURL!, user);
        const view = Object.entries(rolePermissions('Grant')).filter(([, a]) => a.includes('View')).map(([p]) => p);
        const shown = await menu(s.page);
        note('menu after grant', shown.join(', '));
        for (const m of moduleRoutes().filter(x => view.includes(x.permission))) expect.soft(shown, `${m.label} in the menu`).toContain(m.label);
        const leads = moduleRoutes().find(m => m.permission === 'LEADS')!.route;
        await s.page.goto(leads);
        await s.page.waitForLoadState('networkidle').catch(() => {});
        const canCreate = (rolePermissions('Grant')['LEADS'] ?? []).includes('Create');
        expect(await at(s.page, XP.leadsCreate('individual')).count() > 0, 'Create buttons follow the Create permission').toBe(canCreate);
        await s.close();
      } finally {
        await ensureTestRole(sec, 'Base');
      }
    });
  });

  test(...sc('SEC-033'), async ({ sec, browser, baseURL }) => {
    const user = await sec.makeUser('U-PWD');
    const first = await signIn(browser, baseURL!, user);
    await first.close();
    let ed = await sec.users.edit(user.username);
    expect.soft(await ed.loginButton(), 'Login enabled before').toBe('Disable Login');
    await ed.toggleLogin();
    const off = await signIn(browser, baseURL!, user, user.username, true);
    note('disabled sign-in', off.message);
    expect.soft(off.ok, 'Refused while login is disabled').toBeFalsy();
    await off.close();
    ed = await sec.users.edit(user.username);
    await ed.toggleLogin();
    const on = await signIn(browser, baseURL!, user);
    expect(on.ok, `Signs in again after Enable Login (${on.message})`).toBeTruthy();
    await on.close();
  });

  test(...sc('SEC-034'), async ({ sec, browser, baseURL }) => {
    const user = await sec.makeUser('U-PWD');
    const first = await signIn(browser, baseURL!, user);
    await first.close();
    await (await sec.users.edit(user.username)).setStatus('Inactive');
    const off = await signIn(browser, baseURL!, user, user.username, true);
    note('inactive sign-in', off.message);
    expect.soft(off.ok, 'Refused while Inactive').toBeFalsy();
    await off.close();
    await (await sec.users.edit(user.username)).setStatus('Active');
    const on = await signIn(browser, baseURL!, user);
    expect(on.ok, `Signs in again when Active (${on.message})`).toBeTruthy();
    await on.close();
  });
});
