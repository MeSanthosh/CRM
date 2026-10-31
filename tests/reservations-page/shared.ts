/**
 * Shared pieces of the Reservations page suite: test cases (Testcase/Reservations_Page_Test_Cases.xlsx), test
 * data (TestData/Reservations_Test_Data.xlsx), the page fixture, the deal built for the run and register /
 * card readers.
 */
import { test as base, expect } from '../auth';
import { makeCatalog } from '../leads-page/catalog';
import { moduleData, runOnce } from '../sales-chain/data';
import { DealChain, Deal } from '../sales-chain/deal';
import { ModulePage, RegisterRow, RecordPanel } from '../pages/SalesPages';
import { parseNum } from '../helpers';

export { expect };
export const DATA = moduleData('Reservations_Test_Data.xlsx', 'Reservations');
const CAT = makeCatalog('Reservations_Page_Test_Cases.xlsx', '@reservations-page');
export const RESERVATION_CASES = CAT.CASES;
export const TAG = CAT.tag;
export const rsv = CAT.tc;
export const S = (k: string) => DATA.setting(k);

export const test = base.extend<{ reservations: ModulePage; chain: DealChain }>({
  reservations: async ({ page }, use) => {
    page.setDefaultTimeout(30_000);
    await use(new ModulePage(page, S('Reservations Route')));
  },
  chain: async ({ page }, use) => use(new DealChain(page, DATA, note)),
});

export function note(type: string, description: string) {
  test.info().annotations.push({ type, description });
}

// ── Deal built for the run (the suite runs with --workers=1) ─────────────────
let deal: Promise<Deal> | undefined;
/** Buyer 1: opportunity → reservation on a new test unit → approved. */
export function runDeal(chain: DealChain) {
  deal ??= runOnce('reservations-deal', () => chain.reservedDeal(0)); // once per run, even across worker restarts
  return deal;
}

// ── Register & cards ─────────────────────────────────────────────────────────
export type RsvRow = { number: string; opportunity: string; customer: string; unit: string; status: string; amount: number; row: RegisterRow };
export async function rsvRows(p: ModulePage): Promise<RsvRow[]> {
  await p.open();
  return (await p.allRows()).map(r => ({
    number: r.lines[0], opportunity: r.lines[1] ?? '', customer: r.cells['Customer'] ?? '', unit: r.cells['Unit'] ?? '',
    status: r.cells['Status'] ?? '', amount: /\d/.test(r.cells['Amount'] ?? '') ? parseNum(r.cells['Amount']) : 0, row: r,
  }));
}
export async function cards(p: ModulePage): Promise<Record<string, number>> {
  await p.open();
  const out: Record<string, number> = {};
  for (const c of DATA.cardRules()) out[c.card] = await p.kpi(c.card);
  return out;
}
export function expectedCard(card: string, rows: RsvRow[]): number {
  const rule = DATA.cardRules().find(c => c.card === card)!;
  return rows.filter(r => !rule.statuses.length || rule.statuses.includes(r.status)).length;
}
export const byStatus = (rows: RsvRow[]) => [...new Set(rows.map(r => r.status))].map(s => `${s} ${rows.filter(r => r.status === s).length}`).join(', ');

export async function openReservation(p: ModulePage, number: string): Promise<RecordPanel> {
  await p.open();
  await p.search(S('Search Placeholder'), number);
  return p.openRecord(number);
}
/** Applies an action of the Reservation Actions sheet; returns the pop-ups seen. */
export async function rsvAction(panel: RecordPanel, action: string) {
  const a = DATA.action('Reservation Actions', action);
  const seen = await panel.act(a.submit, a.fields);
  note(`${action} pop-ups`, seen.map(n => `${n.title}: ${n.text}`).join(' | ') || 'none');
  return seen;
}

export type { Deal };
