/**
 * Rule integration on real deals (ADM-120, ADM-121): Discount Approval Tiers on the New Proposal form and When Lead
 * Becomes Customer at reservation and proposal. Each case publishes a rule, checks the page that applies it and publishes
 * the original rule again (BusinessRulesPage.withRule).
 * WRITES TO QA: creates the test project (Coral Bay Residences) when missing and ONE test unit in it, reused by every
 * deal of this file; creates buyers / opportunities; approves reservations (ERP sync of test records) and cancels them
 * so the unit is free again. Real Palm Exotica units are never used. The discount cases only read the New Proposal form:
 * no proposal is saved for them.
 * Run: npx playwright test tests/admin-governance/integration-proposals.spec.ts --workers=1
 */
import fs from 'fs';
import path from 'path';
import { test as base, expect, note, admRow, S, sheet } from './shared';
import { DATA as PRO } from '../proposals-page/shared';
import { openReservation, rsvAction, S as RS } from '../reservations-page/shared';
import { DealChain, Deal } from '../sales-chain/deal';
import { testProject, createUnit, findUnit, CreatedUnit } from '../sales-chain/inventory';
import type { ModuleData } from '../sales-chain/data';
import { ModulePage, ModalForm } from '../pages/SalesPages';
import type { Page } from '@playwright/test';

const test = base.extend<{ chain: DealChain }>({ chain: async ({ page }, use) => { page.setDefaultTimeout(30_000); await use(new DealChain(page, PRO, note)); } });
const PUBLISH = () => S('Publish Button');
const softly = expect.configure({ soft: true });
const STATE = path.resolve(__dirname, '../../test-results/admin-rule-deals.json');
type State = { unit?: CreatedUnit; discountDeal?: Deal };
const state = (): State => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; } };
const save = (s: State) => { fs.mkdirSync(path.dirname(STATE), { recursive: true }); fs.writeFileSync(STATE, JSON.stringify({ ...state(), ...s })); };

/** The deal data with "Create New Projects / Units" switched on: used only for the one test project and the one test unit. */
const allow = new Proxy(PRO, { get: (t, k) => k === 'setting' ? (name: string) => (/^Create New (Projects|Units)$/.test(name) ? 'Yes' : t.setting(name)) : (t as any)[k] }) as ModuleData;

/** The one test unit of this file: an Available unit of the test project, created when the project has none. */
async function testUnit(page: Page): Promise<CreatedUnit> {
  const kept = state().unit;
  if (kept) return kept;
  const project = await testProject(page, allow); // created once when missing
  const names = PRO.formFields('Unit');
  let made: Awaited<ReturnType<typeof createUnit>>;
  try { made = await createUnit(page, PRO, PRO.sheet('Deal Unit')[0], { names }); } // an existing Available unit, when there is one
  catch (e) {
    note('no free unit in the test project', String(e).split('\n')[0].slice(0, 200));
    made = await createUnit(page, allow, PRO.sheet('Deal Unit')[0], { names });
    for (let i = 0; i < 3 && !made.result.closed; i++) made = await createUnit(page, allow, PRO.sheet('Deal Unit')[0], { names });
  }
  expect(made.result.closed, `Test unit ready in ${project.code} (${made.result.notice?.text ?? ''})`).toBeTruthy();
  note('test unit', `${made.unit.code} · ${project.name} (${project.code})${made.unit.reused ? ' · existing unit' : ' · created'}`);
  save({ unit: made.unit });
  return made.unit;
}
async function customerStatus(page: Page, deal: Deal) {
  const customers = new ModulePage(page, PRO.setting('Customers Route'));
  await customers.open();
  return (await customers.allRows()).find(r => r.text.includes(deal.buyer.email))?.cells['Status'] ?? 'not listed';
}
async function expectStatus(page: Page, deal: Deal, want: string, when: string) {
  await softly.poll(() => customerStatus(page, deal), { message: `Status of ${deal.buyer.name} (${deal.buyer.email}) ${when}`, timeout: 40_000, intervals: [3000, 5000, 8000] }).toBe(want);
  note(`status ${when}`, await customerStatus(page, deal));
}
/** Cancels the deal's reservation so the test unit is Available for the next deal. */
async function freeUnit(page: Page, deal: Deal) {
  if (!deal.reservation) return;
  const panel = await openReservation(new ModulePage(page, PRO.setting('Reservations Route')), deal.reservation);
  await rsvAction(panel, 'Cancel Reservation');
  await softly.poll(() => panel.status(), { message: `${deal.reservation} cancelled`, timeout: 20_000 }).toBe(RS('Cancelled Status'));
  await panel.close();
  const unit = await findUnit(page, PRO, deal.unit!.code);
  note('unit after cancel', `${deal.unit!.code}: ${unit?.cells['Status']}`);
  expect.soft(unit?.cells['Status'], `${deal.unit!.code} is Available again`).toBe(PRO.setting('Available Status'));
}

test.describe('Admin & Governance · Rule integration · Proposals and customers', () => {
  test.describe.configure({ mode: 'default', timeout: 1_500_000 });

  const stages = () => sheet('Customer Stage Triggers');

  stages().forEach((c, n) => {
    test(...admRow('ADM-121', n + 1, c['Trigger'], `After conversion: ${c['After Conversion']}; after the reservation is approved: ${c['After Reservation Approved']}${c['After Proposal Accepted'] ? `; after the proposal is accepted: ${c['After Proposal Accepted']}` : ''}.`, `Customer Stage Triggers row ${n + 1}`), async ({ rules, chain, page }) => {
      const unit = await testUnit(page);
      let deal: Deal | undefined;
      try {
        await rules.withRule('CUSTOMER_CREATION', PUBLISH(), [['label:Promote to Customer when', c['Trigger']]], async () => {
          deal = await chain.opportunity(n);
          await expectStatus(page, deal, c['After Conversion'], 'after conversion');
          deal = await chain.toReservationReady(deal);
          deal = await chain.reserve({ ...deal, unit });
          await expectStatus(page, deal, c['After Reservation Approved'], 'after the reservation is approved');
          if (c['After Proposal Accepted']) {
            deal = await chain.proposal(deal, PRO.setting('Proposals Route'));
            deal = await chain.acceptProposal(deal, PRO.setting('Proposals Route'), 'Proposal Actions');
            await expectStatus(page, deal, c['After Proposal Accepted'], 'after the proposal is accepted');
          }
        });
      } finally {
        // the first deal keeps its reservation for the discount cases; it is cancelled after them. Every other reservation
        // (also one with an accepted proposal: no contract is signed, so it cancels at once) is cancelled here.
        if (deal?.reservation && n === 0) save({ discountDeal: deal });
        else if (deal?.reservation) await freeUnit(page, deal);
      }
    });

    if (n === 0) {
      sheet('Discount Cases').forEach((d, i) => {
        const rule = `no approval up to ${d['Free Limit']}%, first tier "${d['Tier 1 Name']}" up to ${d['Tier 1 Up To']}%`;
        test(...admRow('ADM-120', i + 1, `${rule}; discount ${d['Discount %']}%`, d['Expected Tier'] ? `The form says the discount needs ${d['Expected Tier']} approval.` : `The form says no approval is needed (up to ${d['Free Limit']}%).`, `Discount Cases row ${i + 1}`), async ({ rules, page }) => {
          const deal = state().discountDeal;
          test.skip(!deal?.reservation, 'The reserved deal of ADM-121.1 was not built');
          await rules.withRule('DISCOUNT_APPROVAL', PUBLISH(), [['text:0', d['Free Limit']], ['text:1', d['Tier 1 Name']], ['text:2', d['Tier 1 Up To']]], async () => {
            const proposals = new ModulePage(page, PRO.setting('Proposals Route'));
            await proposals.open();
            const form = new ModalForm(page);
            await form.open(PRO.setting('New Proposal Button'));
            const f = PRO.formFields('Proposal');
            await form.set(f['Opportunity'], `~${deal!.opportunity}`);
            await expect.poll(() => form.value(f['Proposed Price']), { message: 'List price is filled in', timeout: 15_000 }).not.toBe('');
            const list = Number((await form.value('listPrice')).replace(/[^\d.]/g, ''));
            const proposed = Math.round(list * (1 - Number(d['Discount %']) / 100));
            await form.set(f['Proposed Price'], String(proposed));
            await page.waitForTimeout(800);
            const shown = await form.value('discountPercent');
            const hint = (await form.root.locator('label', { has: page.locator('input[name=discountPercent]') }).locator('p').allInnerTexts()).join(' ').replace(/\s+/g, ' ').trim();
            note('form', `opportunity ${deal!.opportunity} · list price ${list} · proposed price ${proposed} · Discount % shows ${shown} · note: "${hint}"`);
            expect.soft(Number(shown), 'Discount % on the form').toBeCloseTo(Number(d['Discount %']), 1);
            if (d['Expected Tier']) {
              expect.soft(hint, 'The form names the tier that must approve').toContain(`needs ${d['Expected Tier']} approval`);
              expect.soft(hint, 'The form names the published free limit').toContain(`above ${d['Free Limit']}%`);
            } else expect.soft(hint, 'The form says no approval is needed').toContain(`No approval needed (discounts up to ${d['Free Limit']}%)`);
            await page.goto(PRO.setting('Proposals Route')); // leaves the form: nothing is saved
          });
        });
      });

      test(...admRow('ADM-121', stages().length + 1, 'test unit is free again', 'The reservation used by the discount cases is cancelled and the test unit is Available.', 'no data'), async ({ page }) => {
        const deal = state().discountDeal;
        test.skip(!deal?.reservation, 'No reservation to cancel');
        await freeUnit(page, deal!);
        save({ discountDeal: undefined });
      });
    }
  });
});
