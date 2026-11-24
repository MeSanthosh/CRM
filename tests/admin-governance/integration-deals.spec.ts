/**
 * Rule integration, inventory and customer engines (ADM-110 … ADM-121): each combination publishes a rule, tests the page
 * that applies it and publishes the original rule again (BusinessRulesPage.withRule, also when a check fails).
 * WRITES TO QA: rules change for a moment for every QA user, leads and opportunities are created, Available units are
 * held and released. Pricing: only the published rule changes; ⚡ Recalculate All Units Live is never pressed, ADM-116
 * goes first and the other pricing tabs run only when no unit's price moved. Login & OTP and Personal Data are only read.
 * Run: npx playwright test tests/admin-governance/integration-deals.spec.ts --workers=1
 */
import fs from 'fs';
import path from 'path';
import { test as base, expect, note, adm, admRow, S, sheet } from './shared';
import { DATA as AVD, S as AS, HF } from '../availability-summary/shared';
import { release, confirmRelease, holdForm } from '../availability-summary/holds';
import { DATA as PRO } from '../proposals-page/shared';
import { DealChain, Deal } from '../sales-chain/deal';
import { runOnce } from '../sales-chain/data';
import { AvailabilityPage } from '../pages/AvailabilityPage';
import { PricingMatrixPage, PricingRulesPage, money, watchWrites } from '../pages/PricingMatrixPage';
import { ModulePage } from '../pages/SalesPages';
import { shownMessage } from '../pages/AdminPages';
import { XP, at } from '../locators';
import type { Locator } from '@playwright/test';

const test = base.extend<{ av: AvailabilityPage; pm: PricingMatrixPage; pricing: PricingRulesPage; chain: DealChain }>({
  av: async ({ page }, use) => { page.setDefaultTimeout(30_000); await use(new AvailabilityPage(page, AS('Inventory Route'), AS('Tab'))); },
  pm: async ({ page }, use) => { await use(new PricingMatrixPage(page, AS('Inventory Route'), AS('Pricing Tab'))); },
  pricing: async ({ page }, use) => { await use(new PricingRulesPage(page)); },
  chain: async ({ page }, use) => { await use(new DealChain(page, PRO, note)); },
});
const PUBLISH = () => S('Publish Button');
const HOLD_RULE = 'UNIT_HOLD', PRICING_RULE = 'UNIT_PRICING_RULES';
const DEFAULT = 'text:0', MAXIMUM = 'text:1', LIMIT = 'text:2', EXTEND = 'checkbox:0';

// ── Holds ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const STACK = () => AVD.sheet('Page Views')[1]['View'];
const hoursOf = (o: string) => Number((o.match(/\((\d+)h\)/) ?? o.match(/(\d+)\s*hours?/) ?? ['', 'NaN'])[1]);
const leftMinutes = (t: string) => { const m = t.match(/(?:(\d+)d\s*)?(?:(\d+)h\s*)?(?:(\d+)m\s*)?left/); return m && (m[1] || m[2] || m[3]) ? Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : NaN; };
/** An open opportunity of a new test buyer, made once per run. */
const openOpportunity = (chain: DealChain, i: number): Promise<Deal> => runOnce(`adm-rule-opportunity-${i}`, () => chain.opportunity(i));
/** The Stack Plan of the hold project (the page opens on the first project, which can be the one-unit test project). */
async function stackPlan(av: AvailabilityPage) {
  await av.open();
  await av.choose(AS('Project Label'), S('Hold Project'));
  await av.view(STACK());
}
async function availableCodes(av: AvailabilityPage): Promise<string[]> {
  await stackPlan(av);
  return (await av.tiles()).filter(t => t.status === AS('Available Status')).map(t => t.code);
}
const durationList = (form: Locator) => form.locator('select').nth(1);
async function openHoldForm(av: AvailabilityPage, code: string) {
  const w = await av.openTile(code);
  const label = w.buttons.find(b => b.startsWith(AS('Hold Button Prefix'))) ?? '';
  if (!label) return { label, form: undefined };
  await av.press(av.unitButtonStarting(AS('Hold Button Prefix')), label);
  const form = holdForm(av);
  await expect(form, 'Hold form').toBeVisible();
  await expect.poll(() => form.locator('select').nth(0).locator('option').count(), { message: 'Opportunities load', timeout: 15_000 }).toBeGreaterThan(1);
  return { label, form };
}
/** Tries to hold a unit: true when the server accepted it; `said` is the app's message. */
async function place(av: AvailabilityPage, code: string, opportunity: string, duration?: string) {
  await stackPlan(av);
  const { label, form } = await openHoldForm(av, code);
  if (!form) return { placed: false, said: `no Hold button on ${code}` };
  const options = (await form.locator('select').nth(0).locator('option').allTextContents()).map(s => s.trim());
  const option = options.find(o => o.includes(opportunity));
  expect(option, `Opportunity ${opportunity} can be chosen on the Hold form`).toBeTruthy();
  await form.locator('select').nth(0).selectOption({ label: option! });
  if (duration) await durationList(form).selectOption({ label: duration });
  await form.locator('input:not([type]), input[type=text], textarea').first().fill(HF('Reason Text'));
  const answer = av.page.waitForResponse(r => r.request().method() !== 'GET' && r.url().includes('/unit-holds'), { timeout: 60_000 });
  await form.getByRole('button', { name: HF('Submit Button'), exact: true }).click();
  const r = await answer;
  await av.page.waitForTimeout(1200);
  const said = await shownMessage(av.page);
  note('hold', `${code} (${label}) for ${opportunity}: ${r.status()} · ${said}`);
  return { placed: r.status() < 300, said };
}
async function endHold(av: AvailabilityPage, code: string) {
  const how = await release(av, code, S('Hold Project'));
  const said = await confirmRelease(av);
  note('released', `${code}: ${how} · ${said}`);
}
const holdsRow = async (av: AvailabilityPage, code: string) => {
  await av.page.goto(AS('Inventory Route'));
  await av.page.waitForLoadState('networkidle').catch(() => {});
  await av.press(at(av.page, XP.pageTab(HF('Holds Tab'))).first(), HF('Holds Tab'));
  await av.page.waitForTimeout(1500);
  return (await av.main.locator('table tbody tr', { hasText: code }).first().innerText()).replace(/\s+/g, ' ');
};

// ── Pricing ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const GATE = path.resolve(__dirname, '../../test-results/admin-pricing-gate.json');
const gateOpen = () => { try { return JSON.parse(fs.readFileSync(GATE, 'utf8')).pricesStayed === true; } catch { return false; } };
const SIM = () => '🔍 Live Simulator';
/** Every unit's figures of the Pricing Matrix (the status columns can change for other reasons). */
async function prices(pm: PricingMatrixPage) {
  await pm.open();
  const rows = await pm.rows();
  return new Map(rows.map(r => [r.code, JSON.stringify(Object.entries(r.cells).filter(([k]) => !/status/i.test(k)))]));
}
function moved(a: Map<string, string>, b: Map<string, string>) {
  const out = [...a.keys()].filter(k => a.get(k) !== b.get(k));
  if (a.size !== b.size) out.push(`units listed ${a.size} → ${b.size}`);
  return out;
}
const simulatorLines = async (rules: { open(e: string): Promise<void> }, pricing: PricingRulesPage) => {
  await rules.open(PRICING_RULE);
  await pricing.tab(SIM());
  await pricing.page.waitForTimeout(800);
  return pricing.lines();
};
const nextLine = (lines: string[], caption: string) => { const i = lines.findIndex(l => l.startsWith(caption)); return i >= 0 ? lines[i + 1] ?? '' : ''; };
const signed = (n: number) => `${n > 0 ? '+' : ''}${n}%`;
/** Result line "Early Bird (-5%): $901,740" (the Commercial Tier list above it has lines that start the same). */
const resultLine = (lines: string[], caption: string) => lines.find(l => l.startsWith(`${caption} (`) && l.includes(':')) ?? '';

test.describe('Admin & Governance · Rule integration · Inventory and customers', () => {
  test.describe.configure({ mode: 'default', timeout: 600_000 });

  sheet('Hold Defaults').forEach((c, n) => {
    test(...admRow('ADM-110', n + 1, `default ${c['Default Hours']} hours`, `The button reads Hold for ${c['Default Hours']}h and "${c['Preselected Option']}" is selected.`, `Hold Defaults row ${n + 1}`), async ({ rules, av }) => {
      await rules.withRule(HOLD_RULE, PUBLISH(), [[DEFAULT, c['Default Hours']]], async () => {
        const code = (await availableCodes(av)).pop()!;
        const { label, form } = await openHoldForm(av, code);
        note('hold button', `${code}: ${label}`);
        expect.soft(label, 'Hold button shows the published default').toBe(`${AS('Hold Button Prefix')} ${c['Default Hours']}h`);
        expect(form, 'Hold form opens').toBeTruthy();
        const selected = await durationList(form!).evaluate(e => (e as HTMLSelectElement).selectedOptions[0]?.text.trim());
        note('selected length', selected);
        expect.soft(selected, 'Published default is pre-selected').toBe(c['Preselected Option']);
      });
    });
  });

  sheet('Hold Maximums').forEach((c, n) => {
    test(...admRow('ADM-111', n + 1, `maximum ${c['Maximum Hours']} hours`, `No length above ${c['Maximum Hours']} hours; the longest offered is ${c['Longest Option Hours']} hours.`, `Hold Maximums row ${n + 1}`), async ({ rules, av }) => {
      await rules.withRule(HOLD_RULE, PUBLISH(), [[DEFAULT, c['Default Hours']], [MAXIMUM, c['Maximum Hours']]], async () => {
        const { form } = await openHoldForm(av, (await availableCodes(av)).pop()!);
        expect(form, 'Hold form opens').toBeTruthy();
        const options = (await durationList(form!).locator('option').allTextContents()).map(s => s.trim());
        note('lengths offered', options.join(' | '));
        const hours = options.map(hoursOf);
        expect.soft(hours.filter(h => h > Number(c['Maximum Hours'])), 'No length above the published maximum').toEqual([]);
        expect.soft(Math.max(...hours), 'Longest length offered').toBe(Number(c['Longest Option Hours']));
      });
    });
  });

  sheet('Hold Limits').forEach((c, n) => {
    const limit = Number(c['Limit']);
    test(...admRow('ADM-112', n + 1, `limit ${limit}`, `${limit} hold(s) are placed; hold number ${limit + 1} is refused with a message.`, `Hold Limits row ${n + 1}`), async ({ rules, av, chain }) => {
      const deals: Deal[] = [];
      for (let i = 0; i <= limit; i++) deals.push(await openOpportunity(chain, i));
      await rules.withRule(HOLD_RULE, PUBLISH(), [[LIMIT, c['Limit']]], async () => {
        const codes = (await availableCodes(av)).slice(-(limit + 1));
        const held: string[] = [];
        try {
          for (let i = 0; i < limit; i++) {
            const r = await place(av, codes[i], deals[i].opportunity, '4 hours');
            expect.soft(r.placed, `Hold ${i + 1} of ${limit} is placed (${r.said})`).toBe(true);
            if (r.placed) held.push(codes[i]);
          }
          const extra = await place(av, codes[limit], deals[limit].opportunity, '4 hours');
          if (extra.placed) held.push(codes[limit]);
          expect.soft(extra.placed, `Hold ${limit + 1} is refused by the limit of ${limit} (${extra.said})`).toBe(false);
          if (!extra.placed) expect.soft(extra.said, 'A message explains why').not.toBe('');
        } finally {
          for (const code of held) await endHold(av, code);
        }
        const after = await availableCodes(av);
        expect.soft(codes.filter(x => !after.includes(x)), 'Every unit is Available again').toEqual([]);
      });
    });
  });

  sheet('Hold Length').forEach((c, n) => {
    test(...admRow('ADM-113', n + 1, `default ${c['Default Hours']} hours`, `The hold has about ${c['Default Hours']} hours left.`, `Hold Length row ${n + 1}`), async ({ rules, av, chain }) => {
      const deal = await openOpportunity(chain, 0);
      await rules.withRule(HOLD_RULE, PUBLISH(), [[DEFAULT, c['Default Hours']]], async () => {
        const code = (await availableCodes(av)).pop()!;
        const r = await place(av, code, deal.opportunity);
        expect(r.placed, `Hold placed (${r.said})`).toBe(true);
        try {
          const row = await holdsRow(av, code);
          note('Holds tab', row);
          const left = leftMinutes(row);
          expect.soft(Math.abs(left - Number(c['Default Hours']) * 60), `Time left (${left} min) is the published default`).toBeLessThanOrEqual(Number(c['Tolerance Minutes']));
        } finally { await endHold(av, code); }
      });
    });
  });

  sheet('Hold Extend').forEach((c, n) => {
    test(...admRow('ADM-114', n + 1, `managers can extend ${c['Managers Can Extend']}`, c['Extend Offered'] === 'Yes' ? 'Extend is offered and adds time.' : 'Extend is not offered.', `Hold Extend row ${n + 1}`), async ({ rules, av, chain, page }) => {
      const deal = await openOpportunity(chain, 0);
      const code = (await availableCodes(av)).pop()!;
      const r = await place(av, code, deal.opportunity, '4 hours');
      expect(r.placed, `Hold placed (${r.said})`).toBe(true);
      try {
        await rules.open(HOLD_RULE);
        const maximum = Number(await rules.read(MAXIMUM));
        await rules.withRule(HOLD_RULE, PUBLISH(), [[EXTEND, String(c['Managers Can Extend'] === 'On')]], async () => {
          const opps = new ModulePage(page, PRO.setting('Opportunities Route'));
          await opps.open();
          await opps.openRecord(deal.opportunity);
          await page.waitForTimeout(1500);
          const by = page.locator('select[aria-label="Extend by"]');
          const offered = await by.isVisible().catch(() => false);
          note('Extend by shown', String(offered));
          expect.soft(offered, 'Extend control follows the rule').toBe(c['Extend Offered'] === 'Yes');
          if (!offered) return;
          const options = (await by.locator('option').allTextContents()).map(s => s.trim());
          note('extend lengths', options.join(' | '));
          expect.soft(options.map(hoursOf).filter(h => h > maximum), `No extension above the published maximum (${maximum} hours)`).toEqual([]);
          const before = leftMinutes(await holdsRow(av, code));
          await opps.open();
          await opps.openRecord(deal.opportunity);
          await page.waitForTimeout(1500);
          const answer = page.waitForResponse(x => x.request().method() !== 'GET' && /\/unit-holds\/.*\/extend/.test(x.url()), { timeout: 60_000 });
          await page.locator('.crm-unit-hold-actions button', { hasText: /extend/i }).first().click();
          expect.soft((await answer).status(), 'Extension accepted').toBeLessThan(300);
          await page.waitForLoadState('networkidle').catch(() => {});
          const after = leftMinutes(await holdsRow(av, code));
          note('time left', `${before} → ${after} minutes`);
          expect.soft(after, 'Extending adds time').toBeGreaterThan(before);
        });
      } finally { await endHold(av, code); }
    });
  });

  sheet('Customer Triggers').forEach((c, n) => {
    test(...admRow('ADM-115', n + 1, c['Trigger'], `After conversion the person's status is ${c['Status After Conversion']}.`, `Customer Triggers row ${n + 1}`), async ({ rules, chain, page }) => {
      await rules.withRule('CUSTOMER_CREATION', PUBLISH(), [['label:Promote to Customer when', c['Trigger']]], async () => {
        const deal = await chain.opportunity(n);
        const customers = new ModulePage(page, PRO.setting('Customers Route'));
        const status = async () => { await customers.open(); return (await customers.allRows()).find(r => r.text.includes(deal.buyer.email))?.cells['Status'] ?? 'not listed'; };
        await expect.poll(status, { message: `Status of ${deal.buyer.name} (${deal.buyer.email})`, timeout: 40_000, intervals: [3000, 5000, 8000] }).toBe(c['Status After Conversion']);
        note('status', `${deal.buyer.email}: ${c['Status After Conversion']}`);
      });
    });
  });

  sheet('Pricing Base Rate').forEach((c, n) => {
    test(...admRow('ADM-116', n + 1, `${c['Product']} ${c['Change']}`, 'The Live Simulator uses the published rate and no unit price changes.', `Pricing Base Rate row ${n + 1}`), async ({ rules, pm, pricing }) => {
      fs.mkdirSync(path.dirname(GATE), { recursive: true });
      fs.writeFileSync(GATE, JSON.stringify({ pricesStayed: false }));
      const before = await prices(pm);
      note('units compared', String(before.size));
      await rules.open(PRICING_RULE);
      const field = `rownum:${c['Product']}:0`;
      const original = Number(await rules.read(field));
      const published = original + Number(c['Change']);
      const dollars = (v: number) => `$${v.toLocaleString('en-US')}`;
      let duringMoved: string[] = [];
      await rules.withRule(PRICING_RULE, PUBLISH(), [[field, String(published)]], async () => {
        const shown = nextLine(await simulatorLines(rules, pricing), c['Simulator Caption']);
        note('simulator while published', shown);
        expect.soft(shown, 'Live Simulator uses the published base rate').toContain(dollars(published));
        duringMoved = moved(before, await prices(pm));
        expect.soft(duringMoved, 'No unit price moved after the publish').toEqual([]);
      });
      const back = nextLine(await simulatorLines(rules, pricing), c['Simulator Caption']);
      note('simulator after restore', back);
      expect.soft(back, 'Live Simulator shows the original rate again').toContain(dollars(original));
      const afterMoved = moved(before, await prices(pm));
      expect.soft(afterMoved, 'No unit price moved after the rule was put back').toEqual([]);
      fs.writeFileSync(GATE, JSON.stringify({ pricesStayed: !duringMoved.length && !afterMoved.length }));
    });
  });

  sheet('Pricing Changes').forEach((c, n) => {
    test(...admRow('ADM-117', n + 1, `${c['Rule']} (${c['Tab']})`, 'The Live Simulator shows the published change and no unit price moves.', `Pricing Changes row ${n + 1}`), async ({ rules, pm, pricing }) => {
      test.skip(!gateOpen(), 'ADM-116 did not confirm that unit prices stay the same, so the other pricing tabs are not changed');
      const before = await prices(pm);
      const tab = () => pricing.tab(c['Tab']);
      await rules.open(PRICING_RULE);
      await tab();
      const original = await rules.read(c['Field']);
      const next = c['Change'].startsWith('to:') ? c['Change'].slice(3) : String(Number(original) + Number(c['Change']));
      await rules.withRule(PRICING_RULE, PUBLISH(), [[c['Field'], next]], async () => {
        let lines = await simulatorLines(rules, pricing);
        // the simulator opens on the first row in saved order, which a publish can change: choose the row of this rule
        if (c['Simulator Field']) { await pricing.simulate(c['Simulator Field'], c['Simulator Option']); await pricing.page.waitForTimeout(500); lines = await pricing.lines(); }
        const shown = c['Check'] === 'value' ? c['Caption'] : resultLine(lines, c['Caption']);
        note('simulator', `${shown} ${nextLine(lines, c['Caption'])}`);
        if (c['Check'] === 'value') expect.soft(nextLine(lines, c['Caption']), `${c['Rule']} in the simulator`).toBe(signed(Number(next)));
        if (c['Check'] === 'tier') {
          const adjusted = money(nextLine(lines, 'Adjusted Standard Price:'));
          const want = Math.round(adjusted * (1 + Number(next) / 100));
          expect.soft(money(shown.split(':').pop() ?? ''), `${c['Rule']}: the amount uses the published ${signed(Number(next))} of ${adjusted}`).toBe(want);
          expect.soft(shown, `${c['Rule']}: the name shows the published percentage`).toContain(`${c['Caption']} (${signed(Number(next))})`);
        }
        if (c['Check'] === 'floor') expect.soft(shown, `${c['Rule']} in the simulator`).toContain(`${c['Caption']} (-${next}%)`);
        if (c['Check'] === 'round') expect.soft(money(shown.split(':').pop() ?? '') % 100, `${shown}: rounded to the nearest hundred`).toBe(0);
        const m = moved(before, await prices(pm));
        expect.soft(m, 'No unit price moved after the publish').toEqual([]);
        if (m.length) fs.writeFileSync(GATE, JSON.stringify({ pricesStayed: false }));
      }, tab);
    });
  });

  test(...adm('ADM-118'), async ({ rules, browser, baseURL, page }) => {
    const writes = watchWrites(page);
    await rules.open('LOGIN_OTP');
    const otp = await rules.read('check:CRM'), forgot = await rules.read('check:Allow users to reset their own password');
    note('current rule', `OTP login on the CRM: ${otp} · Forgot password: ${forgot}`);
    expect(writes, 'The rule is only read').toEqual([]);
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, baseURL });
    try {
      const p = await ctx.newPage();
      await p.goto('/login');
      await p.waitForLoadState('networkidle').catch(() => {});
      await expect.soft(at(p, XP.loginMode('OTP Login')), 'OTP Login follows the rule').toHaveCount(otp === 'true' ? 1 : 0);
      await expect.soft(p.getByText('Forgot password?', { exact: true }), 'Forgot password? follows the rule').toHaveCount(forgot === 'true' ? 1 : 0);
    } finally { await ctx.close(); }
  });

  test(...adm('ADM-119'), async ({ rules, page }) => {
    const writes = watchWrites(page);
    await rules.open('PII_PROTECTION');
    const mask = await rules.read('check:Mask personal data'), full = await rules.read('check:CRM Administrator');
    note('current rule', `Mask personal data: ${mask} · CRM Administrator sees full data: ${full}`);
    const customers = new ModulePage(page, PRO.setting('Customers Route'));
    await customers.open();
    const contacts = (await customers.rows()).map(r => r.cells['Contact'] ?? '');
    note('contacts read', String(contacts.length));
    expect(contacts.length, 'Customers are listed').toBeGreaterThan(0);
    const masked = contacts.filter(x => x.includes('•'));
    if (mask === 'true' && full === 'false') expect.soft(masked.length, 'Contacts are masked for this role').toBe(contacts.length);
    else expect.soft(masked, 'Contacts are shown in full to this role').toEqual([]);
    expect(writes, 'The rule is only read').toEqual([]);
  });

});
