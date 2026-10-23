/** Opportunities · UC-OPP-012 Role-Based Access (and the unauthenticated part of UC-OPP-011). Changes no data. */
import { test, expect, note } from './fixtures';
import { opp, oppSkipped } from './catalog';
import { ROUTES } from '../locators';

/** A UUID that matches no record, so a DELETE that slipped through could not remove anything. */
const NO_SUCH_ID = '00000000-0000-0000-0000-000000000000';

test.describe('Opportunities · Access (UC-OPP-012)', () => {
  // ── OPP-057 · Backend rejects requests without a valid login
  // Use case: UC-OPP-011, UC-OPP-012 Delete Opportunity / Validate Role-Based Access
  // Checks: Every call returns 401
  test(...opp('OPP-057'), async ({ api }) => {
    await api.ready();
    const calls = [
      ['GET', '/opportunities?limit=1&offset=0', 'none'], ['GET', '/opportunities?limit=1&offset=0', 'invalid'],
      ['GET', `/opportunities/${NO_SUCH_ID}`, 'none'],
      ['DELETE', `/opportunities/${NO_SUCH_ID}`, 'none'], ['DELETE', `/opportunities/${NO_SUCH_ID}`, 'invalid'],
      ['POST', `/opportunities/${NO_SUCH_ID}/stage`, 'none'],
    ] as const;
    const got: Record<string, number> = {};
    for (const [method, path, auth] of calls) {
      const r = await api.call(method, path, method === 'POST' ? { remarks: 'unauthenticated' } : undefined, { auth });
      got[`${method} ${path} (${auth === 'none' ? 'no token' : 'invalid token'})`] = r.status;
    }
    note('statuses', got);
    expect.soft(Object.entries(got).filter(([, s]) => s !== 401).map(([k, s]) => `${k} → ${s}`), 'Calls not answered 401').toEqual([]);
  });

  // ── OPP-058 · Signed-out user is sent to the login page
  // Use case: UC-OPP-012 Validate Role-Based Access
  // Checks: Redirected to /login; no opportunity data shown
  test(...opp('OPP-058'), async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto(ROUTES.opportunities);
    await expect(page, 'Signed-out user sent to login').toHaveURL(/\/login/, { timeout: 15_000 });
    await expect.soft(page.getByRole('heading', { name: 'Opportunities', exact: true }), 'No opportunity data shown').toHaveCount(0);
    await ctx.close();
  });

  // ── OPP-059 · Each role sees only permitted records and actions
  // Use case: UC-OPP-012 Validate Role-Based Access
  // Checks: Sales users see only their records; restricted actions are hidden or disabled and refused by the
  //   backend
  test(...oppSkipped('OPP-059', 'Needs test accounts for each role (e.g. Sales Executive, Sales Manager, Lead Reviewer) to compare which records and actions each one gets; only the CRM Administrator login is configured.'));
});
