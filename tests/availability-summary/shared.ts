/**
 * Shared pieces of the Availability Summary suite (AVS-001 …): test cases (Testcase/Availability_Summary_Test_Cases.xlsx),
 * test data (TestData/Availability_Summary_Test_Data.xlsx), the `avs` / `pm` fixtures and the number helpers.
 * No unit, block or figure is fixed: the tests compare what the page shows at run time.
 */
import { test as base, expect } from '../auth';
import { makeCatalog } from '../leads-page/catalog';
import { moduleData } from '../sales-chain/data';
import { AvailabilityPage, amount, step } from '../pages/AvailabilityPage';
import { PricingMatrixPage } from '../pages/PricingMatrixPage';
import { XP, at } from '../locators';
import type { Page } from '@playwright/test';

export { expect, amount, step };
export const DATA = moduleData('Availability_Summary_Test_Data.xlsx', 'Availability_Summary');
const CAT = makeCatalog('Availability_Summary_Test_Cases.xlsx', '@availability-summary');
export const AVS_CASES = CAT.CASES;
export const TAG = CAT.tag;
export const avs = CAT.tc;
export const avsRow = CAT.tcRow;

export const S = (k: string) => DATA.setting(k);
/** Setting of a key / value sheet (Hold Form, Reservation). */
export const kv = (sheet: string) => (k: string): string => {
  const r = DATA.sheet(sheet).find(x => x['Setting'] === k);
  if (!r) throw new Error(`"${k}" missing on the ${sheet} sheet of ${DATA.source}`);
  return r['Value'];
};
export const HF = kv('Hold Form');
export const RV = kv('Reservation');
export const list = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);
export const statuses = () => DATA.sheet('Statuses');

export const test = base.extend<{ av: AvailabilityPage; pm: PricingMatrixPage }>({
  av: async ({ page }, use) => {
    page.setDefaultTimeout(30_000);
    await use(new AvailabilityPage(page, S('Inventory Route'), S('Tab')));
  },
  pm: async ({ page }, use) => { await use(new PricingMatrixPage(page, S('Inventory Route'), S('Pricing Tab'))); },
});

export function note(type: string, description: string) {
  test.info().annotations.push({ type, description });
}

/** Two amounts agree: within the rounding of the shown one ("$73.79M" → ±5,000) or the tolerance %. */
export function sameAmount(a: number, b: number, shown = '') {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= Math.max(step(shown) / 2 + Number(S('Rounding Tolerance')), Math.abs(b) * Number(S('Value Tolerance %')) / 100);
}
export const bad = (xs: string[], max = 8) => (xs.length ? `${xs.length}: ${xs.slice(0, max).join(' | ')}${xs.length > max ? ' …' : ''}` : '');
export const broken = (text: string) => list(S('Broken Values')).filter(b => new RegExp(`(^|\\W)${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\W|$)`).test(text));

/** KPI card value and its second line ("128 Avail + 1 Res + 4 Sold"). */
export async function card(page: Page, label: string) {
  const lines = (await at(page, XP.kpiCard(label)).first().innerText()).split('\n').map(s => s.trim()).filter(Boolean);
  return { value: lines[1] ?? '', sub: lines.slice(2).join(' ') };
}

/** Pricing Matrix rows (Full 2-Layer) by unit code. */
export async function matrixRows(pm: PricingMatrixPage) {
  await pm.open();
  await pm.view(S('Pricing Full View'));
  const rows = await pm.rows();
  return new Map(rows.map(r => [r.code, r]));
}
