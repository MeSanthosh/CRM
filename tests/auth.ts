/**
 * Every spec imports `test` from here instead of '@playwright/test' (everything else is re-exported).
 *
 * Why: the app's access token lasts 15 minutes and its refresh token is rotated on use. When all
 * workers shared auth.json, the first browser to refresh made the others' refresh token invalid and
 * they were sent to the login page (a full `npm test` broke ~15 minutes in). Now each worker logs in
 * on its own and logs in again before its token expires, so no new browser ever needs a refresh.
 *
 * Without CRM_USERNAME / CRM_PASSWORD it falls back to the shared auth.json, as before.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { test as base } from '@playwright/test';
import { login } from './global-setup';

export * from '@playwright/test';

const AUTH_DIR = '.auth';
const MARGIN_S = 3 * 60; // log in again when the token has less than this left

/** Seconds until the access token stored in a storage-state file expires (0 if missing). */
function secondsLeft(file: string): number {
  if (!fs.existsSync(file)) return 0;
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  let exp = 0;
  for (const o of state.origins ?? []) for (const { value } of o.localStorage ?? []) {
    for (const m of String(value).matchAll(/eyJ[\w-]+\.([\w-]+)\.[\w-]+/g)) {
      try { exp = Math.max(exp, JSON.parse(Buffer.from(m[1], 'base64url').toString()).exp ?? 0); } catch { /* not a JWT */ }
    }
  }
  return exp - Date.now() / 1000;
}

export const test = base.extend({
  storageState: async ({ browser, baseURL }, use, testInfo) => {
    const user = process.env.CRM_USERNAME, pass = process.env.CRM_PASSWORD;
    if (!user || !pass) return use('auth.json');
    const file = path.join(AUTH_DIR, `worker-${testInfo.parallelIndex}.json`);
    if (secondsLeft(file) < MARGIN_S) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
      const ctx = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
      await login(await ctx.newPage(), user, pass);
      await ctx.storageState({ path: file });
      await ctx.close();
    }
    await use(file);
  },
  // The "REMINDER · TASK" cards (.crm-reminder-stack, bottom right) lie on top of buttons and figures on every page and
  // have no close button; their Dismiss / Mark done would change real tasks. So they are hidden on screen only (no data
  // changes). SHOW_REMINDERS=1 keeps them, e.g. to show defect #232.
  context: async ({ context }, use) => {
    if (process.env.SHOW_REMINDERS !== '1') {
      await context.addInitScript(() => {
        const css = '.crm-reminder-stack{display:none !important}';
        const add = () => { if (!document.getElementById('qa-hide-reminders')) { const s = document.createElement('style'); s.id = 'qa-hide-reminders'; s.textContent = css; (document.head ?? document.documentElement).appendChild(s); } };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
      });
    }
    await use(context);
  },
});
