/**
 * Shared pieces of the Lead Detail suite: catalog helpers, fixtures (from the Leads page suite) and
 * leads created for the tests.
 */
import { test, expect, note, createAndGetLeadNo } from '../leads-page/shared';
import { makeCatalog } from '../leads-page/catalog';
import { newLead, LeadData } from '../leads-page/test-data';
import type { LeadsPage } from '../pages/LeadsPage';
import { LeadDetail } from '../pages/LeadDetail';

export { test, expect, note };

const CAT = makeCatalog('Lead_Detail_Test_Cases.xlsx', '@lead-detail');
export const LEAD_DETAIL_CASES = CAT.CASES;
export const TAG = CAT.tag;
/** Title + details from Testcase/Lead_Detail_Test_Cases.xlsx: test(...ldp('LDP-011'), …) */
export const ldp = CAT.tc;
/** Sub-case per data row: test(...ldpRow('LDP-025', 3, 'Not interested', expected, data), …) */
export const ldpRow = CAT.tcRow;

export type MyLead = { lead: LeadData; leadNo: string };

/** A new Individual lead for this test (its Lead Detail is left open). */
export async function freshLead(leads: LeadsPage): Promise<MyLead & { detail: LeadDetail }> {
  const lead = newLead('Individual');
  const leadNo = await createAndGetLeadNo(leads, lead);
  const detail = new LeadDetail(leads.page);
  await detail.waitOpen();
  return { lead, leadNo, detail };
}

/** One lead per worker for tests that only read or that add their own calls / tasks; opened fresh each time. */
let shared: Promise<MyLead> | undefined;
export async function workerLead(leads: LeadsPage): Promise<MyLead & { detail: LeadDetail }> {
  shared ??= (async () => {
    const { lead, leadNo } = await freshLead(leads);
    return { lead, leadNo };
  })().catch(e => { shared = undefined; throw e; });
  const { lead, leadNo } = await shared;
  const detail = await leads.openLead(leadNo);
  return { lead, leadNo, detail };
}

/** Lines of a "Required Fields Missing" / "Qualification Details Missing" pop-up after the bullets. */
export const listedFields = (text = '') => text.split('•').slice(1).map(s => s.replace(/\bOK\s*$/, '').trim());

export const digits = (s: string) => s.replace(/\D/g, '');
