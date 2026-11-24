/**
 * Business Rules → Sales Velocity Targets (ADM-122 … ADM-126): the form, wrong input, zero targets, Save Draft / Publish
 * and the dashboard that compares sales with the targets.
 * WRITES TO QA: the targets are published for a moment and the original values are published again (withRule / finally).
 * Run: npx playwright test tests/admin-governance/rules-sales-targets.spec.ts --workers=1
 */
import { test, expect, note, adm, admRow, S, sheet, broken } from './shared';
import type { Page } from '@playwright/test';

const ENGINE = 'SALES_TARGETS';
const PUBLISH = () => S('Publish Button');
const F = () => sheet('Sales Target Fields');
const field = (label: string) => `label:${label}`;
const num = (s: string) => Number(String(s).replace(/[^\d.-]/g, ''));

/** What the dashboard receives: the targets and the budget / forecast it compares sales with (This month). */
async function dashboardTargets(page: Page) {
  const got = page.waitForResponse(r => r.url().includes(S('Dashboard Summary Api')) && r.url().includes('period=this_month') && r.status() === 200, { timeout: 60_000 });
  await page.goto(S('Dashboard Route'));
  const body = await (await got).json();
  await page.waitForLoadState('networkidle').catch(() => {});
  const v = body.salesVelocity ?? {};
  return { targets: v.targets ?? {}, units: v.comparison?.units ?? {}, revenue: v.comparison?.revenueUsd ?? {}, text: (await page.locator('main').innerText()).replace(/\s+/g, ' ') };
}

test.describe('Admin & Governance · Business Rules · Sales Velocity Targets', () => {
  test.describe.configure({ mode: 'default', timeout: 300_000 });

  test(...adm('ADM-122'), async ({ rules, page }) => {
    await rules.open(ENGINE);
    const lines = await rules.lines();
    for (const h of sheet('Sales Target Headings')) expect.soft(lines, `Heading "${h['Heading']}"`).toContain(h['Heading']);
    const values: Record<string, number> = {};
    for (const f of F()) {
      await expect.soft(rules.control(field(f['Field Label'])), `Field "${f['Field Label']}"`).toBeVisible();
      values[f['Field Label']] = Number(await rules.read(field(f['Field Label'])));
      expect.soft(values[f['Field Label']], `${f['Field Label']} holds a number of 0 or more`).toBeGreaterThanOrEqual(0);
    }
    note('published targets', JSON.stringify(values));
    // "Implied Avg Price / Unit" of each panel = revenue ÷ units
    const implied = lines.filter(l => l.startsWith(S('Implied Price Caption'))).map(num);
    note('implied prices shown', implied.join(' | '));
    const pairs = [['Budget', 0], ['Forecast', 1]] as const;
    for (const [kind, i] of pairs) {
      const units = values[F().find(f => f['Kind'] === 'units' && f['Field Label'].includes(kind))!['Field Label']];
      const revenue = values[F().find(f => f['Kind'] === 'revenue' && f['Field Label'].includes(kind))!['Field Label']];
      expect.soft(implied[i], `${kind}: implied price = ${revenue} ÷ ${units}`).toBe(units > 0 ? Math.round(revenue / units) : 0);
    }
    expect.soft(broken((await page.locator('main').innerText())), 'No broken values on the form').toEqual([]);
  });

  sheet('Sales Target Invalid Values').forEach((c, n) => {
    test(...admRow('ADM-123', n + 1, `${c['Field Label']}: "${c['Typed']}"`, c['Expected'], `Sales Target Invalid Values row ${n + 1}`), async ({ rules }) => {
      await rules.open(ENGINE);
      const f = field(c['Field Label']);
      const original = await rules.read(f);
      const v0 = await rules.version(S('Version Word'));
      await rules.control(f).fill(c['Typed']).catch(async () => { await rules.control(f).focus(); await rules.page.keyboard.type(c['Typed']); });
      await rules.control(f).blur().catch(() => {});
      const shown = await rules.read(f);
      note('typed / field shows', `${c['Typed']} / ${shown} (published value ${original})`);
      const value = Number(shown);
      expect.soft(value, 'The field never holds a negative number').toBeGreaterThanOrEqual(0);
      if (c['Kind'] === 'units') expect.soft(Number.isInteger(value), 'Units stay a whole number').toBeTruthy();
      expect.soft(shown, 'The wrong value is not kept as typed').not.toBe(c['Typed']);
      // nothing was saved: the published rule is unchanged
      await rules.open(ENGINE);
      expect.soft(await rules.read(f), 'Published value unchanged').toBe(original);
      expect.soft((await rules.version(S('Version Word'))).number, 'Version unchanged').toBe(v0.number);
    });
  });

  test(...adm('ADM-124'), async ({ rules, page }) => {
    const changes = F().map(f => [field(f['Field Label']), '0'] as [string, string]);
    let published = true;
    await rules.withRule(ENGINE, PUBLISH(), changes, async () => {
      const d = await dashboardTargets(page);
      note('dashboard with zero targets', `${JSON.stringify(d.targets)} · units ${JSON.stringify(d.units)} · revenue ${JSON.stringify(d.revenue)}`);
      expect.soft(broken(d.text), 'The dashboard shows no NaN / Infinity / undefined with zero targets').toEqual([]);
    }).catch(e => { if (/Publish (can be pressed|accepted)/.test(String(e))) { published = false; note('publish of zero targets', String(e).split('\n')[0]); } else throw e; });
    note('zero targets published', String(published));
    if (!published) {
      // refused is fine: the rule must be unchanged
      await rules.open(ENGINE);
      for (const f of F()) expect.soft(Number(await rules.read(field(f['Field Label']))), `${f['Field Label']} unchanged`).toBeGreaterThan(0);
    }
  });

  test(...adm('ADM-125'), async ({ rules, page }) => {
    // a draft must not reach the dashboard; only Publish does
    await rules.open(ENGINE);
    const f = field(F()[0]['Field Label']);
    const original = await rules.read(f);
    const draft = String(Number(original) + Number(S('Sales Target Units Step')));
    const before = await dashboardTargets(page);
    try {
      await rules.open(ENGINE);
      await rules.write(f, draft);
      await rules.publish(S('Save Draft Button'));
      await rules.open(ENGINE);
      const v = await rules.version(S('Version Word'));
      note('after Save Draft', `${v.text} · field ${await rules.read(f)}`);
      expect.soft(v.text, 'Shows DRAFT').toContain(S('Draft Status'));
      expect.soft(await rules.read(f), 'The draft value is kept on the form').toBe(draft);
      const during = await dashboardTargets(page);
      note('dashboard while only a draft exists', JSON.stringify(during.targets));
      expect.soft(during.targets, 'A draft does not change the dashboard targets').toEqual(before.targets);
    } finally {
      await rules.open(ENGINE);
      await rules.write(f, original);
      await rules.publish(PUBLISH());
      await rules.open(ENGINE);
      expect(await rules.read(f), 'Original value published again').toBe(original);
      expect.soft((await rules.version(S('Version Word'))).text, 'Published again').toContain(S('Published Status'));
    }
  });

  test(...adm('ADM-126'), async ({ rules, page }) => {
    await rules.open(ENGINE);
    const original: Record<string, number> = {}, next: Record<string, number> = {};
    for (const f of F()) {
      original[f['Api Field']] = Number(await rules.read(field(f['Field Label'])));
      next[f['Api Field']] = original[f['Api Field']] + Number(S(f['Kind'] === 'units' ? 'Sales Target Units Step' : 'Sales Target Revenue Step'));
    }
    note('original → published', `${JSON.stringify(original)} → ${JSON.stringify(next)}`);
    const before = await dashboardTargets(page);
    expect.soft(before.targets, 'Before: the dashboard uses the published targets').toEqual(original);
    await rules.withRule(ENGINE, PUBLISH(), F().map(f => [field(f['Field Label']), String(next[f['Api Field']])] as [string, string]), async () => {
      const d = await dashboardTargets(page);
      note('dashboard after publish', `${JSON.stringify(d.targets)} · units ${JSON.stringify(d.units)} · revenue ${JSON.stringify(d.revenue)}`);
      expect.soft(d.targets, 'The dashboard uses the new targets').toEqual(next);
      expect.soft(d.units.budget, 'Units budget compared with sales').toBe(next.monthlyUnitsBudget);
      expect.soft(d.units.forecast, 'Units forecast compared with sales').toBe(next.monthlyUnitsForecast);
      expect.soft(d.revenue.budget, 'Revenue budget compared with sales').toBe(next.monthlyRevenueBudgetUsd);
      expect.soft(d.revenue.forecast, 'Revenue forecast compared with sales').toBe(next.monthlyRevenueForecastUsd);
      for (const line of sheet('Sales Target Dashboard Lines')) {
        const want = line['Text'].replace('{unitsBudget}', String(next.monthlyUnitsBudget)).replace('{unitsForecast}', String(next.monthlyUnitsForecast));
        expect.soft(d.text, `Dashboard shows "${want}"`).toContain(want);
      }
      expect.soft(broken(d.text), 'No broken values on the dashboard').toEqual([]);
    });
    const after = await dashboardTargets(page);
    expect.soft(after.targets, 'After the rule is put back the dashboard uses the original targets').toEqual(original);
  });
});
