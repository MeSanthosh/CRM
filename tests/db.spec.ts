import { test, expect, Page } from './auth';
import { cardValue, tabBadge, listCount, act } from './helpers';
import { dbConfigured, dbNumber, dbRows, sameValue } from './db';
import { DB_CHECKS, STATUS_BREAKDOWN_SQL, UiSource } from './db-queries';

const PAGES = { reports: '/reports-analytics', leads: process.env.LEADS_PATH ?? '/leads' };

test.skip(!dbConfigured, 'Database tests off (SKIP_DB_TESTS=true) or not configured — see .env');

async function readUi(page: Page, ui: UiSource): Promise<number> {
  if (ui.kind === 'card') return cardValue(page, ui.label);
  if (ui.kind === 'tab') return (await tabBadge(page, ui.label)).value;
  if (ui.tab) {
    const { tab } = await tabBadge(page, ui.tab);
    await act(page, () => tab.click());
  }
  return listCount(page);
}

test.describe('UI vs PostgreSQL', () => {
  for (const check of DB_CHECKS) {
    test(`${check.id} ${check.title}: UI = DB`, async ({ page }) => {
      test.skip(Boolean(check.skip), check.skip);
      // Read DB and UI at the same moment so live data changes don't cause false failures.
      const dbPromise = dbNumber(check.sql);
      await page.goto(PAGES[check.page]);
      await page.waitForLoadState('networkidle');
      const [ui, db] = await Promise.all([readUi(page, check.ui), dbPromise]);

      test.info().annotations.push({ type: 'values', description: `UI ${ui} | DB ${db}` });
      expect(sameValue(ui, db), `${check.title}: UI shows ${ui}, database has ${db}\nSQL: ${check.sql}`).toBeTruthy();
    });
  }

  test('DB-L-10 every status count in the Leads filter = DB GROUP BY status', async ({ page }) => {
    const dbCounts = Object.fromEntries(
      (await dbRows<{ status: string; n: number }>(STATUS_BREAKDOWN_SQL)).map(r => [String(r.status).toLowerCase(), Number(r.n)]),
    );
    await page.goto(PAGES.leads);
    await page.waitForLoadState('networkidle');
    const select = page.locator('select').filter({ has: page.locator('option', { hasText: /all statuses/i }) }).first();
    const options = (await select.locator('option').allInnerTexts()).map(o => o.trim()).filter(o => o && !/^all/i.test(o));

    const rows: string[] = [];
    for (const opt of options) {
      await act(page, () => select.selectOption({ label: opt }));
      const ui = await listCount(page);
      const db = dbCounts[opt.toLowerCase()] ?? 0;
      rows.push(`${ui === db ? '✔' : '✖'} ${opt}: UI ${ui} | DB ${db}`);
      expect.soft(ui, `Status "${opt}"`).toBe(db);
    }
    const missing = Object.keys(dbCounts).filter(k => !options.some(o => o.toLowerCase() === k));
    if (missing.length) rows.push(`⚠ In DB but not in the UI dropdown: ${missing.join(', ')}`);
    await test.info().attach('status-ui-vs-db.txt', { body: rows.join('\n'), contentType: 'text/plain' });
    expect.soft(missing, 'Statuses in DB that the UI cannot filter').toEqual([]);
  });
});
