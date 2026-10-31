/**
 * Shared pieces of the Proposals page suite: test cases (Testcase/Proposals_Page_Test_Cases.xlsx), test data
 * (TestData/Proposals_Test_Data.xlsx), the page fixture, the deal built for the run and card / register readers.
 */
import { test as base, expect } from '../auth';
import { makeCatalog } from '../leads-page/catalog';
import { moduleData, numberPattern, runOnce } from '../sales-chain/data';
import { DealChain, Deal } from '../sales-chain/deal';
import { ModulePage, RegisterRow } from '../pages/SalesPages';
import { parseNum } from '../helpers';
import type { Page } from '@playwright/test';

export { expect };
export const DATA = moduleData('Proposals_Test_Data.xlsx', 'Proposals');
const CAT = makeCatalog('Proposals_Page_Test_Cases.xlsx', '@proposals-page');
export const PROPOSAL_CASES = CAT.CASES;
export const TAG = CAT.tag;
export const pro = CAT.tc;
export const proRow = CAT.tcRow;
export const S = (k: string) => DATA.setting(k);

export const test = base.extend<{ proposals: ModulePage; chain: DealChain }>({
  proposals: async ({ page }, use) => {
    page.setDefaultTimeout(30_000);
    await use(new ModulePage(page, S('Proposals Route')));
  },
  chain: async ({ page }, use) => use(new DealChain(page, DATA, note)),
});

export function note(type: string, description: string) {
  test.info().annotations.push({ type, description });
}

// ── Deals built for the run (one worker: the suite runs with --workers=1) ──
let reserved: Promise<Deal> | undefined;
/** Buyer 1: opportunity → approved reservation on a new test unit. */
export function reservedDeal(chain: DealChain) {
  reserved ??= runOnce('proposals-reserved-deal', () => chain.reservedDeal(0)); // once per run, even across worker restarts
  return reserved;
}
let readyOnly: Promise<Deal> | undefined;
/** Buyer 2: opportunity at Reservation Ready, never reserved. */
export function unreservedDeal(chain: DealChain) {
  readyOnly ??= runOnce('proposals-unreserved-deal', () => chain.opportunity(1).then(d => chain.toReservationReady(d)));
  return readyOnly;
}

// ── Register & cards ─────────────────────────────────────────────────────────
export type ProposalRow = { number: string; opportunity: string; customer: string; unit: string; status: string; discount: string; proposed: number; row: RegisterRow };
export async function proposalRows(p: ModulePage): Promise<ProposalRow[]> {
  await p.open();
  return (await p.allRows()).map(r => ({
    number: r.lines[0], opportunity: r.lines[1] ?? '', customer: r.cells['Customer'] ?? '', unit: r.cells['Unit'] ?? '',
    status: r.cells['Status'] ?? '', discount: r.cells['Discount'] ?? '', proposed: /\d/.test(r.cells['Proposed'] ?? '') ? parseNum(r.cells['Proposed']) : 0, row: r,
  }));
}
export async function cards(p: ModulePage): Promise<Record<string, number>> {
  await p.open();
  const out: Record<string, number> = {};
  for (const c of DATA.cardRules()) out[c.card] = await p.kpi(c.card);
  return out;
}
/** What a card should show, from the register and the Card Rules sheet. */
export function expectedCard(card: string, rows: ProposalRow[]): number {
  const rule = DATA.cardRules().find(c => c.card === card)!;
  const hit = rows.filter(r => !rule.statuses.length || rule.statuses.includes(r.status));
  return /sum/i.test(rule.measure) ? hit.reduce((a, r) => a + r.proposed, 0) : hit.length;
}
/** Card changes after an action, checked against the Count Changes sheet. */
export function expectChanges(action: string, before: Record<string, number>, after: Record<string, number>) {
  note(`cards ${action}`, `before ${JSON.stringify(before)} → after ${JSON.stringify(after)}`);
  for (const [card, change] of Object.entries(DATA.countChanges(action))) {
    if (card in before) expect.soft(after[card] - before[card], `${card} card after "${action}"`).toBe(Number(change));
  }
}
export const proposalNo = () => numberPattern(S('Proposal No. Format'));

/** Opens a proposal's detail panel. */
export async function openProposal(p: ModulePage, number: string) {
  await p.open();
  await p.search(S('Search Placeholder'), number);
  return p.openRecord(number);
}

/** Applies an action of the Proposal Actions sheet on a proposal (opens it first). */
export async function proposalAction(p: ModulePage, number: string, action: string, overrides: Record<string, string> = {}, opts: { goBack?: boolean } = {}) {
  const panel = await openProposal(p, number);
  const a = DATA.action('Proposal Actions', action);
  const seen = await panel.act(a.submit, { ...a.fields, ...overrides }, opts);
  note(`${action} pop-ups`, seen.map(n => `${n.title}: ${n.text}`).join(' | ') || 'none');
  return { panel, seen };
}

export type { Page, Deal };
