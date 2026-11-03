/**
 * Shared pieces of the Lead Insights suite (Leads → Insights → Sources): test cases
 * (Testcase/Lead_Insights_Page_Test_Cases.xlsx), test data (TestData/Lead_Insights_Test_Data.xlsx) and the page fixture.
 */
import { test as base, expect } from '../auth';
import { makeCatalog } from '../leads-page/catalog';
import { moduleData } from '../sales-chain/data';
import { LeadInsightsPage } from '../pages/LeadInsightsPage';

export { expect };
export const DATA = moduleData('Lead_Insights_Test_Data.xlsx', 'Lead_Insights');
const CAT = makeCatalog('Lead_Insights_Page_Test_Cases.xlsx', '@lead-insights-page');
export const LEAD_INSIGHTS_CASES = CAT.CASES;
export const TAG = CAT.tag;
export const lsi = CAT.tc;
export const S = (k: string) => DATA.setting(k);
export const list = (k: string) => S(k).split('|').map(s => s.trim());

export const test = base.extend<{ insights: LeadInsightsPage }>({
  insights: async ({ page }, use) => {
    page.setDefaultTimeout(30_000);
    await use(new LeadInsightsPage(page, S('Insights Route')));
  },
});

export function note(type: string, description: string) {
  test.info().annotations.push({ type, description });
}
