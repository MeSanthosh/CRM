/**
 * Shared pieces of the SPA / Sales Contracts page suite: test cases (Testcase/SPA_Contracts_Page_Test_Cases.xlsx),
 * test data (TestData/Contracts_Test_Data.xlsx), the page fixture, the deals built for the run and card /
 * register readers.
 */
import { test as base, expect } from '../auth';
import { makeCatalog } from '../leads-page/catalog';
import { moduleData, numberPattern, runOnce } from '../sales-chain/data';
import { DealChain, Deal } from '../sales-chain/deal';
import { ModulePage, ModalForm, RegisterRow } from '../pages/SalesPages';
import { withSalesLock } from '../sales-chain/inventory';
import { parseNum } from '../helpers';

export { expect };
export const DATA = moduleData('Contracts_Test_Data.xlsx', 'Contracts');
const CAT = makeCatalog('SPA_Contracts_Page_Test_Cases.xlsx', '@contracts-page');
export const CONTRACT_CASES = CAT.CASES;
export const TAG = CAT.tag;
export const spc = CAT.tc;
export const spcRow = CAT.tcRow;
export const S = (k: string) => DATA.setting(k);

export const test = base.extend<{ contracts: ModulePage; chain: DealChain }>({
  contracts: async ({ page }, use) => {
    page.setDefaultTimeout(30_000);
    await use(new ModulePage(page, S('Contracts Route')));
  },
  chain: async ({ page }, use) => use(new DealChain(page, DATA, note)),
});

export function note(type: string, description: string) {
  test.info().annotations.push({ type, description });
}

// ── Deals built for the run (the suite runs with --workers=1) ─────────────────
const deals: Record<number, Promise<Deal> | undefined> = {};
/** Buyer `index`: approved reservation on a new test unit + accepted proposal. */
export function acceptedDeal(chain: DealChain, index: number): Promise<Deal> {
  deals[index] ??= runOnce(`contracts-accepted-deal-${index}`, async () => {
    const d = await chain.reservedDeal(index);
    const p = await chain.proposal(d, S('Proposals Route'));
    return chain.acceptProposal(p, S('Proposals Route'), 'Proposal Steps');
  }); // once per run, even across worker restarts
  return deals[index]!;
}

// ── Register & cards ─────────────────────────────────────────────────────────
export type ContractRow = { number: string; reservation: string; customer: string; unit: string; status: string; value: number; erp: string; row: RegisterRow };
export async function contractRows(p: ModulePage): Promise<ContractRow[]> {
  await p.open();
  return (await p.allRows()).map(r => ({
    number: r.lines[0], reservation: r.lines[1] ?? '', customer: r.cells['Customer'] ?? '', unit: r.cells['Unit'] ?? '',
    status: r.cells['Status'] ?? '', value: /\d/.test(r.cells['Value'] ?? '') ? parseNum(r.cells['Value']) : 0, erp: r.cells['ERP'] ?? '', row: r,
  }));
}
export async function cards(p: ModulePage): Promise<Record<string, number>> {
  await p.open();
  const out: Record<string, number> = {};
  for (const c of DATA.cardRules()) out[c.card] = await p.kpi(c.card);
  return out;
}
/**
 * Cards after an action: re-reads them until they show the change of the Count Changes sheet or the
 * Refresh Wait Seconds run out (the app may update its cards a while after a change). Notes how long it took.
 */
export async function cardsAfter(p: ModulePage, before: Record<string, number>, action: string): Promise<Record<string, number>> {
  const want = DATA.countChanges(action);
  const ok = (c: Record<string, number>) => Object.entries(want).every(([k, v]) => !(k in before) || c[k] - before[k] === Number(v));
  const start = Date.now(), limit = Number(S('Refresh Wait Seconds')) * 1000;
  let now = await cards(p);
  while (!ok(now) && Date.now() - start < limit) {
    await p.page.waitForTimeout(10_000);
    now = await cards(p);
  }
  const secs = Math.round((Date.now() - start) / 1000);
  note(`cards update delay "${action}"`, ok(now) ? (secs > 5 ? `cards showed the change after about ${secs} s` : 'cards changed at once') : `cards still not changed after ${secs} s`);
  return now;
}
export function expectedCard(card: string, rows: ContractRow[]): number {
  const rule = DATA.cardRules().find(c => c.card === card)!;
  const hit = rows.filter(r => !rule.statuses.length || rule.statuses.includes(r.status));
  return /sum/i.test(rule.measure) ? hit.reduce((a, r) => a + r.value, 0) : hit.length;
}
export function expectChanges(action: string, before: Record<string, number>, after: Record<string, number>) {
  note(`cards ${action}`, `before ${JSON.stringify(before)} → after ${JSON.stringify(after)}`);
  for (const [card, change] of Object.entries(DATA.countChanges(action))) {
    if (card in before) expect.soft(after[card] - before[card], `${card} card after "${action}"`).toBe(Number(change));
  }
}
export const contractNo = () => numberPattern(S('Contract No. Format'));
export const CON = /\bCON-[A-Z0-9]+-[A-Z0-9]+\b/;

export async function openContract(p: ModulePage, number: string) {
  await p.open();
  await p.search(S('Search Placeholder'), number);
  return p.openRecord(number);
}
/** Applies an action of the Contract Actions sheet on a contract (opens it first). */
export async function contractAction(p: ModulePage, number: string, action: string, overrides: Record<string, string> = {}, opts: { goBack?: boolean } = {}) {
  const panel = await openContract(p, number);
  const a = DATA.action('Contract Actions', action);
  const seen = await panel.act(a.submit, { ...a.fields, ...overrides }, opts);
  note(`${action} pop-ups`, seen.map(n => `${n.title}: ${n.text}`).join(' | ') || 'none');
  return { panel, seen };
}

/** New Contract for a deal's reservation with `value` and `currency` (defaults: the accepted price, Expected Default Currency). */
export async function newContract(p: ModulePage, deal: Deal, value?: string, currency = S('Expected Default Currency')) {
  const f = DATA.fieldNames();
  await p.open();
  const form = new ModalForm(p.page);
  await form.open(S('New Contract Button'));
  await form.set(f['Approved Reservation'], `~${deal.reservation}`);
  await p.page.waitForTimeout(800);
  await form.set(f['Currency'], currency);
  await form.set(f['Contract Value'], value ?? String(deal.unit!.price));
  const r = await withSalesLock(() => form.submit(S('Create Contract Button')));
  const number = r.notices.map(n => n.text.match(CON)?.[0]).find(Boolean) ?? '';
  note('contract created', `${number || 'none'} · ${deal.reservation} · value "${value ?? deal.unit!.price}" · ${currency} · pop-up: ${r.notice?.text ?? 'none'}`);
  await form.closeNotice(); // the "Contract Created" / error pop-up stays open over the page until OK
  await form.close();
  return { result: r, number };
}

export type { Deal };
