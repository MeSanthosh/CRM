/** Reports & Analytics hub (/reports-analytics). Run alone: npm run test:hub */
import { test, expect, expected, note } from '../pages/fixtures';
import { collectJson, numbersIn, matchesApi } from '../helpers';

const BAD = /NaN|undefined|Infinity|^\s*$/;

test.describe('Reports & Analytics hub', { tag: ['@pages', '@hub'] }, () => {
  test('HUB-01 Executive snapshot shows 8 valid values', expected('All 8 snapshot cards show a valid, non-negative number'), async ({ hub }) => {
    await hub.open();
    await expect(hub.heading()).toBeVisible();
    const shown: string[] = [];
    for (const label of hub.snapshotLabels) {
      const text = await hub.kpiText(label);
      shown.push(`${label}: ${text}`);
      expect.soft(text, label).not.toMatch(BAD);
      expect.soft(await hub.kpi(label), `${label} ≥ 0`).toBeGreaterThanOrEqual(0);
    }
    note('snapshot', shown.join(' | '));
  });

  test('HUB-02 Snapshot values come from the API', expected('Every snapshot value is present in the dashboard API response'), async ({ hub, page }) => {
    const bodies = collectJson(page);
    await hub.open();
    const api = numbersIn(bodies);
    expect(api.length, 'API numbers captured').toBeGreaterThan(0);
    for (const label of hub.snapshotLabels) {
      const v = await hub.kpi(label);
      expect.soft(matchesApi(v, api), `${label}=${v} in API response`).toBeTruthy();
    }
  });

  test('HUB-03 Snapshot values are stable after reload', expected('The 8 values are identical after reloading the page'), async ({ hub, page }) => {
    await hub.open();
    const first: Record<string, string> = {};
    for (const l of hub.snapshotLabels) first[l] = await hub.kpiText(l);
    await page.reload();
    for (const l of hub.snapshotLabels) {
      await expect.poll(() => hub.kpiText(l), { message: `${l} after reload`, timeout: 15_000 }).toBe(first[l]);
    }
  });

  test('HUB-04 Module menu shows the 11 cards', expected('11 module cards, each with its name, status, description and "Open module →", linking to its own page'), async ({ hub }) => {
    await hub.open();
    await expect(hub.cards).toHaveCount(hub.modules.length);
    for (const m of hub.modules) {
      const card = await hub.readCard(m.href);
      expect.soft(card.name, `Card ${m.href} title`).toBe(m.name);
      expect.soft(card.status, `${m.name} status`).toBe('LIVE');
      expect.soft(card.description, `${m.name} description`).not.toBe('');
      expect.soft(card.openText, `${m.name} link text`).toBe('Open module →');
    }
  });

  test('HUB-05 "N live" summary matches the cards', expected('The live count in the summary equals the number of cards marked LIVE'), async ({ hub, page }) => {
    await hub.open();
    const summary = Number((await hub.liveSummary.innerText()).match(/\d+/)![0]);
    const live = await page.locator('a.crm-module-hub-card .crm-module-hub-status.is-live').count();
    expect(live).toBe(summary);
  });

  test('HUB-06 Hub loads without errors', expected('No JavaScript errors, no failed API calls, no broken values'), async ({ hub }) => {
    hub.watchErrors();
    await hub.open();
    await hub.expectNoBrokenValues();
    hub.expectNoErrors();
  });
});
