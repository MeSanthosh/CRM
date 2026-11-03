/**
 * Shared pieces of the Inventory page suite: test cases (Testcase/Inventory_Page_Test_Cases.xlsx),
 * test data (TestData/Inventory_Test_Data.xlsx), the page fixture and helpers to read the KPI cards and
 * create the records of the data sheets.
 */
import { test as base, expect } from '../auth';
import { makeCatalog } from '../leads-page/catalog';
import { moduleData, fill, formValues, seq } from '../sales-chain/data';
import { InventoryPage, testProject, mayCreate } from '../sales-chain/inventory';
import { ModalForm } from '../pages/SalesPages';
import type { Page } from '@playwright/test';
import type { Row } from '../leads-page/test-data';

export { expect };
export const DATA = moduleData('Inventory_Test_Data.xlsx', 'Inventory');
const CAT = makeCatalog('Inventory_Page_Test_Cases.xlsx', '@inventory-page');
export const INVENTORY_CASES = CAT.CASES;
export const TAG = CAT.tag;
export const ivp = CAT.tc;
export const ivpRow = CAT.tcRow;

export const test = base.extend<{ inv: InventoryPage }>({
  inv: async ({ page }, use) => {
    page.setDefaultTimeout(30_000);
    await use(new InventoryPage(page, DATA.setting('Inventory Route')));
  },
});

export function note(type: string, description: string) {
  test.info().annotations.push({ type, description });
}

export const tabs = () => DATA.sheet('Tabs');
export const cardNames = () => DATA.sheet('KPI Cards').map(r => r['Card']);
/** Every KPI card of the page. */
export async function cards(inv: InventoryPage): Promise<Record<string, number>> {
  await inv.open();
  const out: Record<string, number> = {};
  for (const c of cardNames()) out[c] = await inv.kpi(c);
  return out;
}
/** Percentage tolerance for amounts shown rounded. */
export const tolerance = () => Number(DATA.setting('Value Tolerance %')) / 100;
/** Two rounded amounts agree: within the tolerance, or within the rounding step of the shown value. */
export function sameAmount(a: number, b: number, step = 0) {
  return Math.abs(a - b) <= Math.max(Math.abs(b) * tolerance(), step);
}
/** Rounding step of a shown amount: "210.91M" → 0.01M (half of it either side). */
export function stepOf(shown: string) {
  const m = shown.replace(/,/g, '').match(/\d+(?:\.(\d+))?\s*([KMB])?/i);
  if (!m) return 0;
  const decimals = m[1]?.length ?? 0;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] ?? '').toUpperCase() as 'K' | 'M' | 'B'] ?? 1;
  return (10 ** -decimals) * mult;
}

/**
 * Checks the cards after an action against the Count Changes sheet. "Base Price" in the Value column means
 * the unit's base price (`amount`) is added.
 */
export function expectChanges(action: string, before: Record<string, number>, after: Record<string, number>, amount = 0, valueShown = '') {
  const want = DATA.countChanges(action);
  note(`cards ${action}`, `before ${JSON.stringify(before)} → after ${JSON.stringify(after)}`);
  for (const [card, change] of Object.entries(want)) {
    if (!(card in before)) continue;
    if (/^-?\d+$/.test(change)) {
      expect.soft(after[card] - before[card], `${card} card after "${action}"`).toBe(Number(change));
    } else {
      const delta = after[card] - before[card];
      expect.soft(sameAmount(delta, amount, stepOf(valueShown)), `${card} card grows by the ${change} (${amount}); it changed by ${delta}`).toBeTruthy();
    }
  }
}

// ── Records of the data sheets ──────────────────────────────────────────────
export const names = (form: 'Project' | 'Product' | 'Unit') => DATA.fieldNames(form);
export const row = (sheet: string, n = 0): Row => DATA.sheet(sheet)[n];

/** Values of a Projects / Products row for its form (patterns filled). */
export function projectValues(r: Row = row('Projects')) {
  return formValues(r, names('Project'), {});
}
export function productValues(r: Row = row('Products')) {
  return formValues(r, names('Product'), {});
}

export const saveButton = (tab: string) => tabs().find(x => x['Tab'] === tab)!['Save Button'];
/** Opens a New … form of a tab. */
export async function newForm(page: Page, inv: InventoryPage, tab: string): Promise<ModalForm> {
  const t = tabs().find(x => x['Tab'] === tab)!;
  await inv.openTab(tab);
  const form = new ModalForm(page);
  await form.open(t['New Button']);
  return form;
}

/** A project created for this worker (Projects sheet row 1), shared by the project tests. */
let made: Promise<{ values: Record<string, string>; result: Awaited<ReturnType<ModalForm['submit']>> }> | undefined;
export function createdProject(page: Page, inv: InventoryPage) {
  test.skip(!mayCreate(DATA, 'Projects'), 'Not run: the data says Create New Projects = No (no new projects in this round), and this test needs a project of its own to create / edit / deactivate');
  made ??= (async () => {
    const values = projectValues();
    const form = await newForm(page, inv, 'Projects');
    await form.fill(values);
    const result = await form.submit(saveButton('Projects'));
    note('project created', JSON.stringify(values));
    return { values, result };
  })().catch(e => { made = undefined; throw e; });
  return made;
}
let product: Promise<{ values: Record<string, string>; result: Awaited<ReturnType<ModalForm['submit']>> }> | undefined;
export function createdProduct(page: Page, inv: InventoryPage) {
  product ??= (async () => {
    const values = productValues();
    const form = await newForm(page, inv, 'Products');
    await form.fill(values);
    const result = await form.submit(saveButton('Products'));
    await form.close();
    note('product created', JSON.stringify(values));
    return { values, result };
  })().catch(e => { product = undefined; throw e; });
  return product;
}

export { fill, seq, testProject, mayCreate };
