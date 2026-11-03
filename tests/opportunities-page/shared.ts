/**
 * Shared pieces of the Opportunities page suite: test cases (Testcase/Opportunities_Page_Test_Cases.xlsx), test
 * data (TestData/Opportunities_Test_Data.xlsx), the page fixture, the deal and unit built for the run, list /
 * card readers and the Inventory → Holds reader.
 */
import { test as base, expect } from '../auth';
import { makeCatalog } from '../leads-page/catalog';
import { moduleData, runOnce } from '../sales-chain/data';
import { DealChain, Deal } from '../sales-chain/deal';
import { InventoryPage } from '../sales-chain/inventory';
import { ModulePage, RegisterRow, RecordPanel } from '../pages/SalesPages';
import { XP, at } from '../locators';
import { parseNum } from '../helpers';
import type { Page } from '@playwright/test';

export { expect };
export const DATA = moduleData('Opportunities_Test_Data.xlsx', 'Opportunities');
const CAT = makeCatalog('Opportunities_Page_Test_Cases.xlsx', '@opportunities-page');
export const OPPORTUNITY_CASES = CAT.CASES;
export const TAG = CAT.tag;
export const opp = CAT.tc;
export const S = (k: string) => DATA.setting(k);
export const list = (k: string) => S(k).split(',').map(s => s.trim()).filter(Boolean);

export const test = base.extend<{ opps: ModulePage; chain: DealChain }>({
  opps: async ({ page }, use) => {
    page.setDefaultTimeout(30_000);
    await use(new ModulePage(page, S('Opportunities Route')));
  },
  chain: async ({ page }, use) => use(new DealChain(page, DATA, note)),
});

export function note(type: string, description: string) {
  test.info().annotations.push({ type, description });
}

// ── Deal and unit built for the run (the suite runs with --workers=1) ────────
let deal: Promise<Deal> | undefined;
/** Buyer 1: lead → qualified → opportunity (stage Qualified). */
export function runDeal(chain: DealChain) {
  deal ??= runOnce('opportunities-deal', () => chain.opportunity(0)); // once per run, even across worker restarts
  return deal;
}
let unit: Promise<{ code: string; name: string; price: number }> | undefined;
/** A new unit of the test project, held for the deal. */
export function runUnit(chain: DealChain) {
  unit ??= runOnce('opportunities-unit', () => chain.unit().then(u => ({ code: u.code, name: u.name, price: u.price })));
  return unit;
}

// ── List & cards ─────────────────────────────────────────────────────────────
export type OppRow = { number: string; lead: string; customer: string; stage: string; probability: number; budget: number; project: string; row: RegisterRow };
const num = (s?: string) => (s && /\d/.test(s) ? parseNum(s) : 0);
export async function oppRows(p: ModulePage): Promise<OppRow[]> {
  await p.open();
  return (await p.allRows()).map(r => ({
    number: r.lines[0], lead: r.lines[1] ?? '', customer: r.cells['Customer'] ?? '', stage: r.cells['Stage'] ?? '',
    probability: num(r.cells['Probability']), budget: num(r.cells['Budget']), project: r.cells['Project'] ?? '', row: r,
  }));
}
export const cardNames = () => DATA.sheet('Card Rules').map(r => r['Card']);
export async function cards(p: ModulePage): Promise<Record<string, number>> {
  await p.open();
  const out: Record<string, number> = {};
  for (const c of cardNames()) out[c] = await p.kpi(c);
  return out;
}
export const isOpen = (stage: string) => list('Open Stages').includes(stage);
/** Allowed difference between a figure and a total of rounded amounts. */
export const tolerance = (total: number, parts: number) => Math.max(total * Number(S('Value Tolerance %')) / 100, 0.01e6 * parts);

export async function openOpportunity(p: ModulePage, number: string): Promise<RecordPanel> {
  await p.open();
  await p.search(S('Search Placeholder'), number);
  return p.openRecord(number);
}
/** Applies an action of the Opportunity Actions sheet; returns the pop-ups seen. */
export async function oppAction(panel: RecordPanel, action: string) {
  const a = DATA.action('Opportunity Actions', action);
  const seen = await panel.act(a.submit, a.fields);
  note(`${action} pop-ups`, seen.map(n => `${n.title}: ${n.text}`).join(' | ') || 'none');
  return seen;
}

// ── Inventory → Holds ────────────────────────────────────────────────────────
export type HoldRow = { unit: string; opportunity: string; status: string; until: string; text: string };
/** Holds of a unit, read with the scope / status filters of the data (default: every user, Active). */
export async function holdsOf(page: Page, code: string, status = S('Holds Active')): Promise<HoldRow[]> {
  const inv = new InventoryPage(page, S('Inventory Route'));
  await inv.openTab(S('Inventory Holds Tab'));
  for (const [label, option] of [[S('Holds Scope Filter'), S('Holds Scope All')], [S('Holds Status Filter'), status]]) {
    await at(page, XP.selectByLabel(label)).selectOption({ label: option });
    await page.waitForLoadState('networkidle').catch(() => {});
  }
  await page.waitForTimeout(1500);
  return (await inv.allRows()).filter(r => r.lines[0] === code).map(r => ({
    unit: r.lines[0], opportunity: r.cells['Opportunity'] ?? '', status: r.cells['Status'] ?? '', until: r.cells['Held Until'] ?? '', text: r.text,
  }));
}

export type { Deal };
