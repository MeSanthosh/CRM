/**
 * Shared pieces of the Admin & Governance suite (ADM-001 …): test cases (Testcase/Admin_Governance_Test_Cases.xlsx),
 * test data (TestData/Admin_Governance_Test_Data.xlsx) and the page fixtures.
 */
import { test as base, expect } from '../auth';
import { makeCatalog } from '../leads-page/catalog';
import { moduleData } from '../sales-chain/data';
import { ModulePage } from '../pages/SalesPages';
import { BusinessRulesPage } from '../pages/AdminPages';
import { XP, at } from '../locators';
import type { Page } from '@playwright/test';

export { expect };
export const DATA = moduleData('Admin_Governance_Test_Data.xlsx', 'Admin_Governance');
const CAT = makeCatalog('Admin_Governance_Test_Cases.xlsx', '@admin-governance');
export const ADM_CASES = CAT.CASES;
export const TAG = CAT.tag;
export const adm = CAT.tc;
export const admRow = CAT.tcRow;

export const S = (k: string) => DATA.setting(k);
export const list = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);
export const sheet = (n: string) => DATA.sheet(n);
export const fieldsOf = (form: string) => sheet('Form Fields').filter(f => f['Form'] === form);
export const engines = () => sheet('Rule Engines');
export const bad = (xs: string[], max = 8) => (xs.length ? `${xs.length}: ${xs.slice(0, max).join(' | ')}${xs.length > max ? ' …' : ''}` : '');
export const broken = (text: string) => list(S('Broken Values')).filter(b => new RegExp(`(^|\\W)${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\W|$)`).test(text));
export const never = () => list(S('Never Click'));
export const WAIT = () => Number(S('Save Wait Seconds')) * 1000;

export const test = base.extend<{ cur: ModulePage; ref: ModulePage; rules: BusinessRulesPage }>({
  cur: async ({ page }, use) => { page.setDefaultTimeout(30_000); await use(new ModulePage(page, S('Currencies Route'))); },
  ref: async ({ page }, use) => { page.setDefaultTimeout(30_000); await use(new ModulePage(page, S('Reference Route'))); },
  rules: async ({ page }, use) => { page.setDefaultTimeout(30_000); await use(new BusinessRulesPage(page, S('Rules Route'))); },
});

export function note(type: string, description: string) {
  test.info().annotations.push({ type, description });
}
/** Value of a KPI card: a number or currency code on the line after its label, or after its subtitle ("Currencies / Master Catalog / 15"). */
export async function cardText(page: Page, label: string) {
  const lines = (await page.locator('main').innerText()).split('\n').map(s => s.trim()).filter(Boolean);
  const i = lines.findIndex(l => l.toUpperCase() === label.toUpperCase());
  return lines.slice(i + 1, i + 3).find(l => /^(\d[\d,]*|[A-Z]{3})$/.test(l)) ?? '';
}
/** Ticks or unticks a register check box and waits for the list. */
export async function setCheck(page: Page, label: string, on: boolean) {
  const c = at(page, XP.admCheck(label)).first();
  if ((await c.isChecked()) !== on) await c.evaluate(e => (e as HTMLInputElement).click());
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(800);
}
