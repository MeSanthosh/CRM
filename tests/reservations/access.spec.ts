/** Unit Reservations · Access (UR-053…055). Changes no data. */
import { test, expect, note } from './fixtures';
import { ur, urSkipped } from './catalog';
import { ROUTES } from '../locators';

/** A UUID that matches no record, so a call that slipped through could not change anything. */
const NO_SUCH_ID = '00000000-0000-0000-0000-000000000000';

test.describe('Reservations · Access', () => {
  // ── UR-053 · Backend rejects reservation requests without a valid login
  // Area: Access › API
  // Checks: Every call returns 401
  test(...ur('UR-053'), async ({ api }) => {
    await api.ready();
    const calls = [
      ['GET', '/reservations?limit=1&offset=0', 'none'], ['GET', '/reservations?limit=1&offset=0', 'invalid'],
      ['POST', '/reservations', 'none'], ['POST', `/reservations/${NO_SUCH_ID}/approve`, 'none'], ['POST', `/reservations/${NO_SUCH_ID}/cancel`, 'none'],
    ] as const;
    const got: Record<string, number> = {};
    for (const [method, path, auth] of calls) {
      const r = await api.call(method, path, method === 'POST' ? { remarks: 'unauthenticated' } : undefined, { auth });
      got[`${method} ${path} (${auth === 'none' ? 'no token' : 'invalid token'})`] = r.status;
    }
    note('statuses', got);
    expect.soft(Object.entries(got).filter(([, s]) => s !== 401).map(([k, s]) => `${k} → ${s}`), 'Calls not answered 401').toEqual([]);
  });

  // ── UR-054 · Signed-out user is sent to the login page
  // Area: Access › Navigation
  // Checks: Redirected to /login; no reservation data shown
  test(...ur('UR-054'), async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto(ROUTES.reservations);
    await expect(page, 'Signed-out user sent to login').toHaveURL(/\/login/, { timeout: 15_000 });
    await expect.soft(page.getByRole('heading', { name: 'Unit Reservations' }), 'No reservation data').toHaveCount(0);
    await ctx.close();
  });

  // ── UR-055 · Only permitted roles can approve and cancel
  // Area: Access › Roles
  // Checks: Users without approval rights do not get Approve; the backend refuses it
  test(...urSkipped('UR-055', 'Needs test accounts for each role (e.g. Sales Executive, Sales Manager); only the CRM Administrator login is configured.'));
});
