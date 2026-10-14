/**
 * Runs once before the suite. Makes sure auth.json holds a working login session, so every test
 * (and every worker) reuses the same token instead of logging in again.
 *
 *  - CRM_USERNAME / CRM_PASSWORD set in .env → logs in fresh and saves auth.json
 *  - otherwise → reuses auth.json if it still works (from "npm run login")
 *
 * Why a fresh login every run: the app rotates its refresh token on use (POST /auth/refresh), so a
 * saved session stops working as soon as any browser refreshes it. A new login gives the run a
 * fresh access token that every worker can share.
 */
import 'dotenv/config';
import fs from 'fs';
import { chromium, expect, FullConfig, Page } from '@playwright/test';

const AUTH_FILE = 'auth.json';

async function isLoggedIn(page: Page): Promise<boolean> {
  await page.goto('/reports-analytics');
  await page.waitForLoadState('networkidle').catch(() => {});
  return !new URL(page.url()).pathname.startsWith('/login');
}

/**
 * The login inputs are readonly until focused (anti-autofill): the app makes them editable on focus.
 * Type like a user (focus, wait until editable, key presses) so the app's own state gets the value.
 */
async function type(page: Page, name: string, value: string) {
  const input = page.locator(`form.crm-login-form input[name="${name}"]`);
  await expect(async () => {
    await input.click();
    await expect(input).toBeEditable({ timeout: 2_000 });
    await input.clear();
    await input.pressSequentially(value);
    await expect(input).toHaveValue(value, { timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
}

/** Logs in through the login form; throws with the page's message when the login is rejected. */
export async function login(page: Page, user: string, pass: string) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle').catch(() => {}); // login options load after the page and re-render the form
  await page.getByRole('button', { name: 'Password Login' }).click();
  // typing in one field can reset the other, so re-check both right before submitting
  await expect(async () => {
    await type(page, 'username', user);
    await type(page, 'password', pass);
    await expect(page.locator('form.crm-login-form input[name="username"]')).toHaveValue(user, { timeout: 500 });
  }).toPass({ timeout: 30_000 });
  await page.locator('button.crm-login-submit').click();
  try {
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30_000 });
  } catch {
    const msg = (await page.locator('form.crm-login-form').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    throw new Error(`Login failed for "${user}". Page says: ${msg.slice(0, 300)}`);
  }
  await page.waitForLoadState('networkidle').catch(() => {});
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL;
  const browser = await chromium.launch();
  try {
    const user = process.env.CRM_USERNAME;
    const pass = process.env.CRM_PASSWORD;
    if ((!user || !pass) && fs.existsSync(AUTH_FILE)) {
      const ctx = await browser.newContext({ baseURL, storageState: AUTH_FILE });
      const ok = await isLoggedIn(await ctx.newPage());
      if (ok) await ctx.storageState({ path: AUTH_FILE }); // keep the rotated token
      await ctx.close();
      if (ok) return;
    }

    if (!user || !pass) {
      throw new Error('Login session missing or expired. Set CRM_USERNAME and CRM_PASSWORD in .env (or run "npm run login").');
    }

    const ctx = await browser.newContext({ baseURL });
    await login(await ctx.newPage(), user, pass);
    await ctx.storageState({ path: AUTH_FILE });
    await ctx.close();
    console.log(`🔑 Logged in as ${user}; session saved to ${AUTH_FILE}`);
  } finally {
    await browser.close();
  }
}
