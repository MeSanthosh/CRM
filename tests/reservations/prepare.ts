/**
 * Brings a fresh opportunity to Reservation Ready, the way a user does:
 * Leads › Ready to Convert › Move to Opportunity › Convert → Schedule Visit & Continue (Site Visit)
 * → Complete Site Visit (Negotiation) → negotiation notes › Continue to Reservation Ready.
 */
import { Response } from '@playwright/test';
import { expect } from '../auth';
import { OPP } from '../locators';
import { OpportunitiesPage } from '../opportunities/OpportunitiesPage';
import { LeadsConversion } from '../opportunities/LeadsConversion';

const REMARKS = 'Automated test - Reservations lifecycle';
const isConvert = (r: Response) => /\/api\/v1\/leads\/[0-9a-f-]{36}\/convert$/.test(r.url()) && r.request().method() === 'POST';

export async function reservationReadyOpportunity(leads: LeadsConversion, opps: OpportunitiesPage) {
  const page = opps.page;
  // 1. convert a qualified lead
  await leads.open();
  await leads.openTab('Ready to Convert');
  const candidates = (await leads.rows()).filter(r => r.status === 'Qualified');
  if (!candidates.length) throw new Error('No qualified lead on Leads › Ready to Convert');
  const lead = candidates[Math.floor(Math.random() * candidates.length)];
  await leads.openLead(lead.leadNo);
  await leads.moveButton.click();
  const converted = page.waitForResponse(isConvert);
  await leads.confirmDialog.getByRole('button', { name: 'Convert', exact: true }).click();
  const res = await converted;
  expect(res.status(), 'POST …/convert').toBeLessThan(300);
  const body = await res.json();
  const opp = body.items?.[0] ?? body;
  await opps.noticeButton('OK');
  await opps.detailLoaded(opp.opportunityNo);

  // 2. schedule a visit → Site Visit
  await opps.visitForm.locator(OPP.visitType).selectOption({ label: 'Virtual' });
  await opps.pickVisitDate(15, '11:00');
  await opps.visitForm.locator(OPP.remarks).fill(REMARKS);
  expect((await opps.submitVisit())?.status(), 'POST …/site-visits').toBeLessThan(300);
  await opps.noticeButton('OK');

  // 3. complete the visit → Negotiation
  await opps.open();
  await opps.openRecord(opp.opportunityNo);
  const complete = page.locator(`xpath=${OPP.completeVisitForm}`);
  await complete.locator('select[name="visitId"]').selectOption({ index: 1 });
  await complete.locator('textarea[name="outcomeNotes"]').fill(`${REMARKS} - visit completed`);
  await complete.getByRole('button', { name: 'Complete Site Visit' }).click();
  // "Site Visit Completed — Visit outcome saved. Opportunity advanced to Negotiation…" [OK]
  await expect(opps.notice).toBeVisible({ timeout: 20_000 });
  await opps.noticeButton('OK');
  await expect(opps.status, 'Stage after completing the visit').toHaveText('Negotiation', { timeout: 20_000 });

  // 4. negotiation notes → Reservation Ready
  await page.locator(`xpath=${OPP.negotiationNotes}`).fill(`${REMARKS} - price agreed`);
  await opps.detail.getByRole('button', { name: 'Continue to Reservation Ready' }).click();
  await expect(opps.notice).toBeVisible();
  await opps.noticeButton('OK');
  await expect(opps.status, 'Stage after negotiation').toHaveText('Reservation Ready', { timeout: 20_000 });

  return { leadNo: lead.leadNo, oppId: opp.id as string, oppNo: opp.opportunityNo as string, customer: opp.customer?.name as string };
}
