/** Customers & Brokers · Access (CB-042…044). Changes no data. */
import { test, expect, note } from './fixtures';
import { cb, cbSkipped } from './catalog';
import { ROUTES } from '../locators';

/** A UUID that matches no record, so a call that slipped through could not change anything. */
const NO_SUCH_ID = '00000000-0000-0000-0000-000000000000';

test.describe('Customers & Brokers · Access', () => {
  // ── CB-042 · Backend rejects customer and broker requests without a login
  // Area: Access › API
  // Checks: Every call returns 401
  test(...cb('CB-042'), async ({ api }) => {
    await api.ready();
    const calls = [
      ['GET', '/customers?limit=1&offset=0', 'none'], ['GET', '/customers?limit=1&offset=0', 'invalid'],
      ['GET', '/brokers?limit=1&offset=0', 'none'], ['PATCH', `/customers/${NO_SUCH_ID}`, 'none'],
      ['POST', '/brokers', 'none'], ['POST', `/kyc/customers/${NO_SUCH_ID}/documents`, 'none'],
    ] as const;
    const got: Record<string, number> = {};
    for (const [method, path, auth] of calls) {
      const r = await api.call(method, path, method === 'GET' ? undefined : { remarks: 'unauthenticated' }, { auth });
      got[`${method} ${path} (${auth === 'none' ? 'no token' : 'invalid token'})`] = r.status;
    }
    note('statuses', got);
    expect.soft(Object.entries(got).filter(([, s]) => s !== 401).map(([k, s]) => `${k} → ${s}`), 'Calls not answered 401').toEqual([]);
  });

  // ── CB-043 · Signed-out user is sent to the login page
  // Area: Access › Navigation
  // Checks: Redirected to /login; no customer data shown
  test(...cb('CB-043'), async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto(ROUTES.customers);
    await expect(page, 'Signed-out user sent to login').toHaveURL(/\/login/, { timeout: 15_000 });
    await expect.soft(page.getByRole('heading', { name: 'Customer and Broker Workspace' }), 'No customer data').toHaveCount(0);
    await ctx.close();
  });

  // ── CB-044 · Only permitted roles can edit customers and brokers
  // Area: Access › Roles
  // Checks: Users without rights cannot edit or create, in the UI or through the API
  test(...cbSkipped('CB-044', 'Needs test accounts for each role; only the CRM Administrator login is configured.'));
});
