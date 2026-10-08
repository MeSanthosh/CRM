/**
 * Runs once before the suite. Makes sure auth.json holds a working login session, so every test
 * (and every worker) reuses the same token instead of logging in again.
 *
 *  - auth.json still logged in → reused as is
 *  - otherwise → logs in with CRM_USERNAME / CRM_PASSWORD from .env and saves a fresh auth.json
 *
 * Set AUTH_REFRESH=true to force a new login.
 */
import 'dotenv/config';
import fs from 'fs';
import { chromium, FullConfig, Page } from '@playwright/test';

const AUTH_FILE = 'auth.json';

async function isLoggedIn(page: Page): Promise<boolean> {
  await page.goto('/reports-analytics');
  await page.waitForLoadState('networkidle').catch(() => {});
  return !new URL(page.url()).pathname.startsWith('/login');
}

/** The login inputs are readonly until focused (anti-autofill), so focus before typing. */
async function type(page: Page, name: string, value: string) {
  const input = page.locator(`form.crm-login-form input[name="${name}"]`);
  await input.click();
  if (await input.getAttribute('readonly') !== null) await input.evaluate(el => el.removeAttribute('readonly'));
  await input.fill(value);
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL;
  const browser = await chromium.launch();
  try {
    if (fs.existsSync(AUTH_FILE) && process.env.AUTH_REFRESH !== 'true') {
      const ctx = await browser.newContext({ baseURL, storageState: AUTH_FILE });
      const ok = await isLoggedIn(await ctx.newPage());
      await ctx.close();
      if (ok) return;
    }

    const user = process.env.CRM_USERNAME;
    const pass = process.env.CRM_PASSWORD;
    if (!user || !pass) {
      throw new Error('Login session missing or expired. Set CRM_USERNAME and CRM_PASSWORD in .env (or run "npm run login").');
    }

    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    await page.goto('/login');
    await page.getByRole('button', { name: 'Password Login' }).click();
    await type(page, 'username', user);
    await type(page, 'password', pass);
    await page.locator('button.crm-login-submit').click();
    try {
      await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30_000 });
    } catch {
      const msg = (await page.locator('form.crm-login-form').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      throw new Error(`Login failed for "${user}". Page says: ${msg.slice(0, 300)}`);
    }
    await page.waitForLoadState('networkidle').catch(() => {});
    await ctx.storageState({ path: AUTH_FILE });
    await ctx.close();
    console.log(`🔑 Logged in as ${user}; session saved to ${AUTH_FILE}`);
  } finally {
    await browser.close();
  }
}
