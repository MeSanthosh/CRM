/** Password Management & Admin Reset (SEC-041 … SEC-048). */
import { test, expect, note, sc, scRow, signIn, newSession } from './shared';
import { message, passwordRules, newPassword, wrongPassword, policyValue } from './test-data';
import { ChangePasswordDialog } from '../pages/SecurityPages';

test.describe('Security · Passwords', () => {
  test.describe.configure({ timeout: 600_000 });

  test(...sc('SEC-041'), async ({ sec, browser, baseURL }) => {
    const s = await signIn(browser, baseURL!, await sec.makeUser('U-PWD'));
    await s.menu.choose('Change Password');
    const cp = new ChangePasswordDialog(s.page);
    expect.soft(await cp.text(), 'Rule shown').toContain(message('Password Rule'));
    expect.soft(await cp.fieldTypes(), 'Three hidden fields').toEqual(['password', 'password', 'password']);
    await cp.showPasswords();
    expect(await cp.fieldTypes(), 'Show passwords reveals them').toEqual(['text', 'text', 'text']);
    await s.close();
  });

  // one sub-case per Password Rules row; the current password is known only at run time
  passwordRules('{current}').forEach((rule, i) => {
    test(...scRow('SEC-042', i + 1, rule.case, `"${rule.message}"; the password is not changed`, `Case: ${rule.case}`), async ({ sec, browser, baseURL }) => {
      const user = await sec.makeUser('U-PWD');
      const s = await signIn(browser, baseURL!, user);
      const r = passwordRules(user.password)[i];
      await s.menu.choose('Change Password');
      const cp = new ChangePasswordDialog(s.page);
      await cp.fill(r.current, r.next, r.confirm);
      const n = await cp.submit();
      const text = await cp.text().catch(() => '');
      note('shown', (n?.text ?? text).replace(/^.*Confirm New Password/, '').slice(0, 300));
      expect.soft(`${text} ${n?.text ?? ''}`, 'Message').toContain(r.message);
      await s.close();
      const check = await signIn(browser, baseURL!, user);
      expect(check.ok, 'Old password still works (not changed)').toBeTruthy();
      await check.close();
    });
  });

  test(...sc('SEC-043'), async ({ sec, browser, baseURL }) => {
    const user = await sec.makeUser('U-PWD');
    const s = await signIn(browser, baseURL!, user);
    const old = user.password, next = newPassword();
    await s.menu.choose('Change Password');
    const cp = new ChangePasswordDialog(s.page);
    await cp.fill(old, next, next);
    const n = await cp.submit();
    note('pop-up', n?.text ?? 'none');
    await s.close();
    const withOld = await signIn(browser, baseURL!, { ...user, password: old }, user.username, true);
    expect.soft(withOld.ok, 'Old password refused').toBeFalsy();
    await withOld.close();
    user.password = next;
    const withNew = await signIn(browser, baseURL!, user);
    expect(withNew.ok, `New password signs in (${withNew.message})`).toBeTruthy();
    await withNew.close();
  });

  test(...sc('SEC-044'), async ({ sec }) => {
    const user = await sec.makeUser('U-PWD');
    const ed = await sec.users.edit(user.username);
    const d = await ed.openReset();
    const auto = d.getByLabel(/Auto-generate Temporary Password/);
    expect.soft(await auto.isChecked(), 'Auto-generate selected').toBeTruthy();
    const read = async () => ((await d.innerText()).split('Generated Temporary Password:')[1] ?? '').trim().split('\n')[0].trim();
    const first = await read();
    await d.getByRole('button', { name: 'Regenerate' }).click();
    await sec.admin.waitForTimeout(500);
    const second = await read();
    note('generated', `${first.length} and ${second.length} characters (values not recorded)`);
    expect.soft(first.length, 'A password is shown').toBeGreaterThanOrEqual(8);
    expect.soft(second, 'Regenerate gives a different one').not.toBe(first);
    expect.soft(await d.innerText(), 'Forced-change note').toContain(message('Reset Forced Note'));
    await d.getByRole('button', { name: 'Cancel' }).click();
  });

  test(...sc('SEC-045'), async ({ sec, browser, baseURL }) => {
    const user = await sec.makeUser('U-PWD');
    (await signIn(browser, baseURL!, user)).close();
    const reset = newPassword();
    await (await sec.users.edit(user.username)).resetTo(reset);
    const s = await newSession(browser, baseURL!);
    const r = await s.login.signIn(user.username, reset);
    expect(r.ok, 'Signs in with the reset password').toBeTruthy();
    const cp = new ChangePasswordDialog(s.page);
    await s.page.waitForTimeout(1500);
    expect(await cp.isOpen(), 'Forced change dialog').toBeTruthy();
    expect.soft(await cp.text(), 'Explains why').toContain(message('Forced Change Note'));
    expect.soft((await cp.buttons()).sort(), 'Only Change Password and Log Out').toEqual(['Change Password', 'Log Out'].sort());
    await s.page.keyboard.press('Escape');
    expect.soft(await cp.isOpen(), 'Cannot be dismissed with Escape').toBeTruthy();
    const next = newPassword();
    await cp.fill(reset, next, next);
    await cp.submit();
    await expect(cp.root, 'Dialog closes after the change').toBeHidden({ timeout: 20_000 });
    await s.close();
    const withReset = await signIn(browser, baseURL!, { ...user, password: reset }, user.username, true);
    expect(withReset.ok, 'Reset password no longer works').toBeFalsy();
    await withReset.close();
  });

  test(...sc('SEC-046'), async ({ sec, browser, baseURL }) => {
    const user = await sec.makeUser('U-LOCK');
    (await signIn(browser, baseURL!, user)).close();
    const s = await newSession(browser, baseURL!);
    for (let i = 0; i < policyValue('Max Failed'); i++) await s.login.signIn(user.username, wrongPassword());
    const locked = await s.login.signIn(user.username, user.password);
    expect.soft(locked.message, 'Account locked').toContain(message('Locked'));
    await s.close();
    user.password = newPassword();
    await (await sec.users.edit(user.username)).resetTo(user.password);
    const after = await signIn(browser, baseURL!, user);
    expect(after.ok, `Signs in right after the reset (${after.message})`).toBeTruthy();
    await after.close();
  });

  test(...sc('SEC-047'), async ({ browser, baseURL }) => {
    const s = await newSession(browser, baseURL!);
    await s.login.open();
    await s.page.getByRole('button', { name: 'Forgot password?' }).click();
    await s.page.waitForTimeout(1000);
    const text = (await s.page.locator('form').last().innerText()).replace(/\s+/g, ' ');
    note('form', text);
    for (const t of ['Send code', 'New password', 'Confirm new password', 'Back to sign in']) expect.soft(text, `"${t}"`).toContain(t);
    expect(text, 'Email / Mobile').toMatch(/Email \/ Mobile/);
    await s.close();
  });

  test(...sc('SEC-048'), async () => {
    test.skip(true, 'Manual: needs the reset code from email / SMS');
  });
});
