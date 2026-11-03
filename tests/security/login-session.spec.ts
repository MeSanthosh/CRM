/** User Login & Session Management (SEC-001 … SEC-018). */
import { test, expect, note, sc, newSession, signIn } from './shared';
import { setting, list, message, policy, newPassword, wrongPassword, fill, policyValue } from './test-data';
import { UserEditor } from '../pages/SecurityPages';

test.describe('Security · Login & Session', () => {
  test.describe.configure({ timeout: 600_000 });

  test(...sc('SEC-001'), async ({ browser, baseURL }) => {
    const s = await newSession(browser, baseURL!);
    for (const route of list('Protected Routes')) {
      await s.page.goto(route);
      await s.page.waitForLoadState('networkidle').catch(() => {});
      note(route, s.page.url());
      expect.soft(await s.login.isSignInPage(), `${route} asks to sign in`).toBeTruthy();
    }
    await s.close();
  });

  test(...sc('SEC-002'), async ({ browser, baseURL }) => {
    const s = await newSession(browser, baseURL!);
    await s.login.open();
    const text = await s.login.pageText();
    for (const t of ['Password Login', 'OTP Login', 'Forgot password?']) expect.soft(text, `"${t}" offered`).toContain(t);
    expect.soft(await s.page.locator('form.crm-login-form input[name=username]').count(), 'Login ID field').toBe(1);
    expect.soft(await s.login.passwordType(), 'Password field').toBe('password');
    expect(text, 'Lockout hint').toContain(message('Lockout Hint'));
    await s.close();
  });

  test(...sc('SEC-003'), async ({ browser, baseURL }) => {
    const s = await newSession(browser, baseURL!);
    await s.login.open();
    await s.login.submit();
    await s.page.waitForTimeout(1000);
    expect.soft(await s.login.isSignInPage(), 'Still on the sign-in page').toBeTruthy();
    expect(await s.login.formText(), 'Message').toContain(message('Login Empty'));
    await s.close();
  });

  test(...sc('SEC-004'), async ({ browser, baseURL }) => {
    const s = await newSession(browser, baseURL!);
    await s.login.open();
    await s.login.type('password', newPassword());
    expect.soft(await s.login.passwordType(), 'Hidden while typing').toBe('password');
    await s.login.toggleShow();
    expect.soft(await s.login.passwordType(), 'Shown after Show').toBe('text');
    await s.login.toggleShow();
    expect(await s.login.passwordType(), 'Hidden again').toBe('password');
    await s.close();
  });

  test(...sc('SEC-005'), async ({ browser, baseURL }) => {
    const s = await newSession(browser, baseURL!);
    const r = await s.login.signIn(fill(setting('Unknown User Pattern')), wrongPassword());
    note('message', r.message);
    expect.soft(r.ok, 'Not signed in').toBeFalsy();
    expect(r.message, 'Generic message').toContain(message('Invalid Login'));
    await s.close();
  });

  test(...sc('SEC-006'), async ({ sec, browser, baseURL }) => {
    const user = await sec.makeUser('U-SESS');
    const s = await newSession(browser, baseURL!);
    const r = await s.login.signIn(user.username, wrongPassword());
    note('message', r.message);
    expect.soft(r.ok, 'Not signed in').toBeFalsy();
    expect(r.message, 'Same generic message as for an unknown user').toContain(message('Invalid Login'));
    await s.close();
  });

  test(...sc('SEC-007'), async ({ sec, browser, baseURL }) => {
    const user = await sec.makeUser('U-SESS');
    const s = await signIn(browser, baseURL!, user);
    expect(s.ok, `Signed in (${s.message})`).toBeTruthy();
    const label = await s.menu.label();
    note('user menu', label.join(' / '));
    expect.soft(label, 'Full name').toContain(user.fullName);
    expect(label, 'Primary role').toContain(user.role);
    await s.close();
  });

  for (const [id, field] of [['SEC-008', 'email'], ['SEC-009', 'mobile']] as const) {
    test(...sc(id), async ({ sec, browser, baseURL }) => {
      const user = await sec.makeUser('U-SESS');
      const first = await signIn(browser, baseURL!, user); // completes the first-time change
      expect(first.ok, 'First sign-in with the username').toBeTruthy();
      await first.close();
      const s = await signIn(browser, baseURL!, user, user[field]);
      note('signed in with', `${field}: ${user[field]}`);
      expect(s.ok, `Signed in with the ${field} (${s.message})`).toBeTruthy();
      expect((await s.menu.label()), 'Same user').toContain(user.fullName);
      await s.close();
    });
  }

  test(...sc('SEC-010'), async ({ sec, browser, baseURL }) => {
    const user = await sec.makeUser('U-SESS');
    const s = await signIn(browser, baseURL!, user);
    expect(s.ok, 'Signed in').toBeTruthy();
    await s.menu.logOut();
    expect.soft(await s.login.isSignInPage(), 'Sign-in page after Log Out').toBeTruthy();
    await s.page.goto(list('Protected Routes')[1] ?? '/');
    await s.page.waitForLoadState('networkidle').catch(() => {});
    expect(await s.login.isSignInPage(), 'Protected page asks to sign in again').toBeTruthy();
    await s.close();
  });

  test(...sc('SEC-011'), async ({ sec, browser, baseURL }) => {
    const user = await sec.makeUser('U-SESS');
    const a = await signIn(browser, baseURL!, user);
    const b = await signIn(browser, baseURL!, user);
    expect(a.ok && b.ok, 'Signed in on two browsers').toBeTruthy();
    await b.menu.choose('My Profile');
    const devices = await b.menu.devices();
    note('devices', devices.replace(/\s+/g, ' ').slice(0, 400));
    expect.soft((devices.match(/Signed in \d/g) ?? []).length, 'Both sessions listed').toBeGreaterThanOrEqual(2);
    expect(devices, 'Current session marked').toContain('This device');
    await a.close(); await b.close();
  });

  test(...sc('SEC-012'), async ({ sec, browser, baseURL }) => {
    const user = await sec.makeUser('U-SESS');
    const a = await signIn(browser, baseURL!, user);
    const b = await signIn(browser, baseURL!, user);
    await b.menu.choose('My Profile');
    const ask = await b.menu.signOutOthers(message('Sign Out Others Button'));
    note('confirmation', ask?.text ?? 'none');
    expect.soft(ask?.title, 'Confirmation').toBe(message('Sign Out Others Title'));
    await a.page.goto(list('Protected Routes')[1] ?? '/');
    await a.page.waitForLoadState('networkidle').catch(() => {});
    await a.page.waitForTimeout(2000);
    expect.soft(await a.login.isSignInPage(), 'Other browser signed out').toBeTruthy();
    await b.page.goto(list('Protected Routes')[1] ?? '/');
    await b.page.waitForLoadState('networkidle').catch(() => {});
    expect(await b.login.isSignInPage(), 'This browser still signed in').toBeFalsy();
    await a.close(); await b.close();
  });

  test(...sc('SEC-013'), async ({ sec, browser, baseURL }) => {
    const user = await sec.makeUser('U-SESS');
    const s = await signIn(browser, baseURL!, user);
    expect(s.ok, 'Signed in').toBeTruthy();
    const ed: UserEditor = await sec.users.edit(user.username);
    const n = await ed.signOutAll();
    note('pop-up', n?.text ?? 'none');
    await s.page.goto(list('Protected Routes')[1] ?? '/');
    await s.page.waitForLoadState('networkidle').catch(() => {});
    await s.page.waitForTimeout(2000);
    expect(await s.login.isSignInPage(), 'User signed out by the admin').toBeTruthy();
    await s.close();
  });

  test(...sc('SEC-014'), async ({ sec }) => {
    await sec.prefs.open('Security');
    for (const p of policy()) {
      const got = await sec.prefs.setting(p.policy).inputValue();
      note(p.policy, got);
      expect.soft(got, p.policy).toBe(p.expected);
    }
    const mfa = sec.admin.locator('main input[type=checkbox]').first();
    expect(await mfa.isDisabled(), 'MFA / OTP enforcement cannot be switched on yet').toBeTruthy();
  });

  test(...sc('SEC-015'), async ({ browser, baseURL, sec }) => {
    const user = await sec.makeUser('U-SESS');
    const s = await newSession(browser, baseURL!);
    await s.login.open('OTP Login');
    const form = await s.login.formText();
    note('form', form);
    expect.soft(await s.page.locator('form.crm-login-form input[name=otp]').getAttribute('maxlength'), 'Code is 6 digits').toBe('6');
    expect.soft(form, 'Send code offered').toContain('Send code');
    await s.login.type('username', user.email);
    await s.login.submit();
    await s.page.waitForTimeout(1500);
    expect(await s.login.formText(), 'Asks to send a code first').toContain(message('OTP Send First'));
    await s.close();
  });

  test(...sc('SEC-016'), async () => {
    test.skip(true, 'Manual: needs the one-time code from email / SMS');
  });

  test(...sc('SEC-017'), async ({ sec, browser, baseURL }) => {
    const user = await sec.makeUser('U-LOCK');
    const first = await signIn(browser, baseURL!, user);
    expect(first.ok, 'User can sign in before the test').toBeTruthy();
    await first.close();
    const max = policyValue('Max Failed');
    const s = await newSession(browser, baseURL!);
    const seen: string[] = [];
    for (let i = 1; i <= max; i++) seen.push((await s.login.signIn(user.username, wrongPassword())).message);
    note('messages', seen.map((m, i) => `${i + 1}: ${m.replace(/^.*Forgot password\?/, '')}`).join(' | '));
    for (let i = 0; i < max - 1; i++) expect.soft(seen[i], `Attempt ${i + 1}`).toContain(message('Invalid Login'));
    expect.soft(seen[max - 1], `Attempt ${max} locks`).toContain(message('Locked'));
    expect.soft(seen[max - 1], 'OTP hint').toContain(message('Locked OTP Hint'));
    const until = seen[max - 1].match(/after (\d{1,2}:\d{2}\s*[AP]M)/i)?.[1];
    if (until) {
      const [h, m] = until.replace(/\s*[AP]M/i, '').split(':').map(Number);
      const t = new Date(); t.setHours((h % 12) + (/PM/i.test(until) ? 12 : 0), m, 0, 0);
      const minutes = Math.round((t.getTime() - Date.now()) / 60_000);
      note('lock ends in (minutes)', String(minutes));
      expect.soft(Math.abs(minutes - policyValue('Interval')), 'Lock lasts the policy interval').toBeLessThanOrEqual(1);
    }
    const right = await s.login.signIn(user.username, user.password);
    expect(right.ok, 'Right password refused while locked').toBeFalsy();
    expect(right.message, 'Still locked').toContain(message('Locked'));
    await s.close();
  });

  test(...sc('SEC-018'), async () => {
    test.skip(true, `Manual: needs ${policyValue('Session Timeout')} minutes of inactivity`);
  });
});
