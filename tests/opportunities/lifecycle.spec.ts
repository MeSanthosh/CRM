/**
 * Opportunities lifecycle on live QA data — runs in order in one worker:
 *   pick a Ready to Convert lead → convert it (UC-OPP-002, UC-OPP-010) → schedule a visit so it moves to
 *   Site Visit (UC-OPP-007) → add a note (UC-OPP-004) → mark it Lost (UC-OPP-009) → check it is closed for
 *   good (UC-OPP-008/009/011/012).
 *
 * Every run uses up one qualified lead and leaves one Lost opportunity (remarks "Automated test …").
 * The lead and opportunity are passed between tests through test-results/opportunity-lifecycle.json, so a
 * failure in one test does not stop the next; tests that need the opportunity skip if it was not created.
 */
import fs from 'fs';
import path from 'path';
import { Response } from '@playwright/test';
import { test, expect, note, lifecycle, saveLifecycle, needOpportunity, WRITE_ENDPOINT } from './fixtures';
import { opp } from './catalog';
import { OPP } from '../locators';
import { parseNum } from '../helpers';
import { halfUnit } from '../sales-reports/shared';
import { OpportunitiesPage } from './OpportunitiesPage';
import { CrmApi } from './api';

test.describe.configure({ mode: 'default' });

const REMARKS = 'Automated test - Opportunities lifecycle';
const BOARD_REMARKS = 'Automated test - Board mark Lost';
const isConvert = (r: Response) => /\/api\/v1\/leads\/[0-9a-f-]{36}\/convert$/.test(r.url()) && r.request().method() === 'POST';
const isStage = (r: Response) => /\/api\/v1\/opportunities\/[0-9a-f-]{36}\/stage$/.test(r.url()) && r.request().method() === 'POST';
const refused = (status: number) => status >= 400 && status < 500;

async function stageId(api: CrmApi, name: string) {
  const s = (await api.reference('OPPORTUNITY/STAGE')).find(x => x.level2Name === name);
  if (!s) throw new Error(`Stage "${name}" is not configured`);
  return s.id;
}
/** Records the data-changing requests a page sends. */
function writesOf(page: OpportunitiesPage['page']) {
  const out: string[] = [];
  page.on('request', r => { if (r.method() !== 'GET' && r.method() !== 'OPTIONS' && WRITE_ENDPOINT.test(r.url())) out.push(`${r.method()} ${r.url()}`); });
  return out;
}
/** Stage history oldest first. */
const history = (rec: any): string[] => [...(rec.stageHistory ?? [])]
  .sort((a, b) => Date.parse(a.changedAt) - Date.parse(b.changedAt)).map(h => h.opportunityStage?.name);

test.describe('Opportunities · Lifecycle (live QA data)', () => {
  // ── OPP-046 · Ready to Convert lists only qualified leads
  // Use case: UC-OPP-010 Convert Lead to Opportunity
  // Checks: Every lead on the tab has status Qualified, and the tab count equals the list total
  test(...opp('OPP-046'), async ({ leads, opps }) => {
    await leads.open();
    await leads.openTab('Ready to Convert');
    const ready = await leads.tabCount('Ready to Convert');
    const rows = await leads.rows();
    note('ready to convert', `${ready} leads; page 1: ${rows.length}`);
    expect.soft(rows.filter(r => r.status !== 'Qualified').map(r => `${r.leadNo} (${r.status})`), 'Leads that are not Qualified').toEqual([]);
    expect.soft(await leads.total(), 'Tab count vs list total').toBe(ready);
    const candidates = rows.filter(r => r.status === 'Qualified');
    test.skip(!candidates.length, 'No qualified lead to convert');
    const lead = candidates[Math.floor(Math.random() * candidates.length)];
    // figures to compare after the conversion
    await opps.open();
    const total = await opps.kpi('Total'), open = await opps.kpi('Open');
    await opps.showBoard();
    const q = (await opps.boardColumns()).find(c => c.stage === 'Qualified')!;
    saveLifecycle({ leadNo: lead.leadNo, customer: lead.name, leadId: lead.href.split('selected=')[1], before: { total, open, ready, qualified: { count: q.count, value: q.value } } });
    note('lead', lead);
  });

  // ── OPP-047 · Move to Opportunity asks for confirmation
  // Use case: UC-OPP-010 Convert Lead to Opportunity
  // Checks: A "Convert lead to opportunity?" dialog names the lead and offers Go back and Convert
  test(...opp('OPP-047'), async ({ leads }) => {
    const s = lifecycle();
    test.skip(!s.leadNo, 'No lead picked by OPP-046');
    await leads.findAndOpen(s.leadNo!);
    saveLifecycle({ leadBudget: (await leads.fact('Budget').innerText()).trim(), leadOwner: (await leads.fact('Assigned').innerText()).trim() });
    await leads.moveButton.click();
    await expect(leads.confirmDialog).toBeVisible();
    await expect.soft(leads.confirmDialog.locator('h3')).toHaveText('Convert lead to opportunity?');
    await expect.soft(leads.confirmDialog, 'Dialog names the lead').toContainText(s.leadNo!);
    await expect.soft(leads.confirmDialog.getByRole('button', { name: 'Go back', exact: true })).toBeVisible();
    await expect.soft(leads.confirmDialog.getByRole('button', { name: 'Convert', exact: true })).toBeVisible();
    await leads.confirmDialog.getByRole('button', { name: 'Go back', exact: true }).click();
  });

  // ── OPP-048 · Go back cancels the conversion
  // Use case: UC-OPP-010 Convert Lead to Opportunity
  // Checks: The dialog closes, no request is sent, the lead stays Qualified and "Move to Opportunity" is still
  //   offered
  test(...opp('OPP-048'), async ({ leads, page }) => {
    const s = lifecycle();
    test.skip(!s.leadNo, 'No lead picked by OPP-046');
    await leads.findAndOpen(s.leadNo!);
    const writes = writesOf(page);
    await leads.moveButton.click();
    await leads.confirmDialog.getByRole('button', { name: 'Go back', exact: true }).click();
    await expect(leads.confirmDialog, 'Dialog closed').toHaveCount(0);
    await page.waitForTimeout(1_000);
    expect.soft(writes, 'No request after Go back').toEqual([]);
    await expect.soft(leads.status, 'Lead still Qualified').toHaveText('Qualified');
    await expect.soft(leads.moveButton, '"Move to Opportunity" still offered').toBeVisible();
  });

  // ── OPP-009 · Converting a qualified lead creates an opportunity
  // Use case: UC-OPP-002 Create Opportunity
  // Checks: POST /leads/<id>/convert succeeds; notice "Lead Converted" names the customer; the Opportunity
  //   Detail of the new OPP-… number opens on /opportunities
  test(...opp('OPP-009'), async ({ leads, opps, page }) => {
    const s = lifecycle();
    test.skip(!s.leadNo, 'No lead picked by OPP-046');
    await leads.findAndOpen(s.leadNo!);
    await leads.moveButton.click();
    const converted = page.waitForResponse(isConvert);
    await leads.confirmDialog.getByRole('button', { name: 'Convert', exact: true }).click();
    const res = await converted;
    const body = await res.json().catch(() => ({}));
    const rec = body.items?.[0] ?? body;
    note('convert', `${res.status()} → ${rec.opportunityNo}`);
    expect(res.status(), 'POST …/convert').toBeLessThan(300);
    saveLifecycle({ oppId: rec.id, oppNo: rec.opportunityNo, budgetAmount: rec.budgetAmount, createdBy: rec.createdBy?.name });
    const n = await opps.readNotice();
    expect.soft(n.title, 'Notice').toBe('Lead Converted');
    expect.soft(n.body, 'Notice names the customer').toContain(s.customer!);
    await opps.noticeButton('OK');
    await expect(page).toHaveURL(/\/opportunities/);
    await opps.detailLoaded(rec.opportunityNo);
  });

  // ── OPP-010 · New opportunity is listed and searchable
  // Use case: UC-OPP-002 Create Opportunity
  // Checks: The new opportunity is on page 1 and searching its number lists exactly that opportunity
  test(...opp('OPP-010'), async ({ opps }) => {
    const s = needOpportunity();
    await opps.open();
    expect.soft((await opps.rows()).map(r => r.opp), 'On page 1 (newest first)').toContain(s.oppNo);
    await opps.search(s.oppNo);
    expect((await opps.rows()).map(r => r.opp), 'Search by number').toEqual([s.oppNo]);
  });

  // ── OPP-011 · Customer, budget and lead number carry over from the lead
  // Use case: UC-OPP-002 Create Opportunity
  // Checks: The opportunity shows the lead's customer name, budget and lead number
  test(...opp('OPP-011'), async ({ opps }) => {
    const s = needOpportunity();
    await opps.open();
    await opps.openRecord(s.oppNo);
    const h = await opps.detailHeader();
    note('detail', h);
    expect.soft(h.customer, 'Customer from the lead').toBe(s.customer);
    expect.soft(h.Budget, 'Budget from the lead').toBe(s.leadBudget);
    expect.soft(h.Lead, 'Lead number').toBe(s.leadNo);
  });

  // ── OPP-012 · New opportunity starts at Qualified
  // Use case: UC-OPP-002 Create Opportunity
  // Checks: Stage Qualified, status OPEN, probability as configured for Qualified (same as other Qualified
  //   deals), owner = the lead's assignee; workflow shows Open Done, Qualified In progress, later steps Up next
  test(...opp('OPP-012'), async ({ opps, api }) => {
    const s = needOpportunity();
    await opps.open();
    const others = (await opps.rows()).filter(r => r.stage === 'Qualified' && r.opp !== s.oppNo).map(r => r.probability);
    const rec = await opps.openRecord(s.oppNo);
    expect.soft(rec.opportunityStage?.name, 'Stage').toBe('Qualified');
    expect.soft(rec.status, 'Status').toBe('OPEN');
    expect.soft(rec.assignedToUser?.name, 'Owner = lead assignee').toBe(s.leadOwner);
    expect.soft(await opps.status.innerText(), 'Status pill').toBe('Qualified');
    expect.soft(await opps.fact('Probability').innerText(), 'Probability shown').toBe(`${rec.probabilityPercent}%`);
    if (others.length) expect.soft(`${rec.probabilityPercent}%`, `Same probability as other Qualified deals (${[...new Set(others)].join(', ')})`).toBe(others[0]);
    const steps = await opps.workflow();
    expect.soft(steps.slice(0, 2).map(x => `${x.name}:${x.state}`), 'Workflow').toEqual(['Open:done', 'Qualified:current']);
    expect.soft(steps.slice(2).filter(x => x.state !== 'next').map(x => x.name), 'Later steps Up next').toEqual([]);
    expect.soft((await api.opportunity(s.oppId)).isActive, 'Active').toBe(true);
  });

  // ── OPP-013 · Total and Open KPIs go up by one
  // Use case: UC-OPP-002 Create Opportunity
  // Checks: Total and Open each increase by exactly 1
  test(...opp('OPP-013'), async ({ opps }) => {
    const s = needOpportunity();
    await opps.open();
    const total = await opps.kpi('Total'), open = await opps.kpi('Open');
    note('kpis', { before: s.before, after: { total, open } });
    expect.soft(total, 'Total +1').toBe(s.before!.total + 1);
    expect.soft(open, 'Open +1').toBe(s.before!.open + 1);
  });

  // ── OPP-014 · Board Qualified column takes the new deal
  // Use case: UC-OPP-002 Create Opportunity
  // Checks: Board › Qualified: count +1 and value + the opportunity's budget (within display rounding)
  test(...opp('OPP-014'), async ({ opps }) => {
    const s = needOpportunity();
    await opps.open();
    await opps.showBoard();
    const q = (await opps.boardColumns()).find(c => c.stage === 'Qualified')!;
    note('qualified column', { before: s.before!.qualified, after: q, budget: s.budgetAmount });
    expect.soft(q.count, 'Qualified count +1').toBe(s.before!.qualified.count + 1);
    const grew = parseNum(q.value) - parseNum(s.before!.qualified.value);
    const tol = halfUnit(q.value) + halfUnit(s.before!.qualified.value);
    expect.soft(Math.abs(grew - (s.budgetAmount ?? 0)), `Qualified value grew by ${grew} vs budget ${s.budgetAmount} (±${tol})`).toBeLessThanOrEqual(tol + 1e-6);
  });

  // ── OPP-015 · Board card shows the new opportunity
  // Use case: UC-OPP-002 Create Opportunity
  // Checks: The card shows the customer, the lead's budget, a probability tag and the owner (the lead's
  //   assignee)
  test(...opp('OPP-015'), async ({ opps }) => {
    const s = needOpportunity();
    await opps.open();
    await opps.showBoard();
    const card = (await opps.boardCards('Qualified')).find(c => c.oppNo === s.oppNo);
    expect(card, `${s.oppNo} card in Qualified`).toBeTruthy();
    note('card', card);
    expect.soft(card!.customer, 'Customer').toBe(s.customer);
    expect.soft(card!.value, 'Budget').toBe(s.leadBudget);
    expect.soft(card!.tags.find(t => /%$/.test(t)), 'Probability tag').toMatch(/^\d+%$/);
    expect.soft(card!.owner, 'Owner').toBe(s.leadOwner);
  });

  // ── OPP-016 · Only one opportunity is created per conversion
  // Use case: UC-OPP-002 Create Opportunity
  // Checks: Exactly one opportunity — the new one — for the lead
  test(...opp('OPP-016'), async ({ opps, api }) => {
    const s = needOpportunity();
    await opps.open();
    await opps.search(s.leadNo!);
    expect.soft((await opps.rows()).map(r => r.opp), `Opportunities for ${s.leadNo}`).toEqual([s.oppNo]);
    const fromApi = (await api.searchOpportunities(s.leadNo!)).filter(o => o.lead?.leadNo === s.leadNo);
    expect.soft(fromApi.map(o => o.opportunityNo), 'API: opportunities for the lead').toEqual([s.oppNo]);
  });

  // ── OPP-017 · Lead link in the opportunity opens the source lead
  // Use case: UC-OPP-002 Create Opportunity
  // Checks: Lead Detail of that lead opens
  test(...opp('OPP-017'), async ({ opps, leads }) => {
    const s = needOpportunity();
    await opps.open();
    await opps.openRecord(s.oppNo);
    await opps.fact('Lead').locator('a').click();
    await expect(leads.detail, 'Lead Detail opens').toBeVisible();
    await expect(leads.detail).toContainText(s.leadNo!);
  });

  // ── OPP-049 · Converted lead is closed as Converted
  // Use case: UC-OPP-010 Convert Lead to Opportunity
  // Checks: Lead status Converted; Status History shows "Qualified → Converted"
  test(...opp('OPP-049'), async ({ leads }) => {
    const s = needOpportunity();
    await leads.findAndOpen(s.leadNo!);
    await expect.soft(leads.status, 'Lead status').toHaveText('Converted');
    await expect.soft(leads.detail, 'Status history').toContainText(/Qualified\s*→\s*Converted/);
  });

  // ── OPP-050 · Ready to Convert count goes down by one
  // Use case: UC-OPP-010 Convert Lead to Opportunity
  // Checks: The Ready to Convert count decreases by exactly 1
  test(...opp('OPP-050'), async ({ leads }) => {
    const s = needOpportunity();
    await leads.open();
    const ready = await leads.tabCount('Ready to Convert');
    note('ready to convert', { before: s.before!.ready, after: ready });
    expect.soft(ready, 'Ready to Convert −1').toBe(s.before!.ready - 1);
  });

  // ── OPP-051 · Converted lead links to its opportunity
  // Use case: UC-OPP-010 Convert Lead to Opportunity
  // Checks: The lead shows the new OPP number under Opportunities and no longer offers "Move to Opportunity"
  test(...opp('OPP-051'), async ({ leads }) => {
    const s = needOpportunity();
    await leads.findAndOpen(s.leadNo!);
    await expect.soft(leads.fact('Opportunities'), 'Linked opportunity').toContainText(s.oppNo);
    await expect.soft(leads.moveButton, '"Move to Opportunity" no longer offered').toHaveCount(0);
  });

  // ── OPP-052 · Converting the same lead again is refused
  // Use case: UC-OPP-010 Convert Lead to Opportunity
  // Checks: Refused (4xx), or answered with the existing opportunity; either way there is still exactly one
  //   opportunity for the lead
  test(...opp('OPP-052'), async ({ api }) => {
    const s = needOpportunity();
    const again = await api.call('POST', `/leads/${s.leadId}/convert`, { probabilityPercent: 35, remarks: `${REMARKS} (repeat conversion)` });
    const returned = (again.body?.items?.[0] ?? again.body)?.opportunityNo;
    note('repeat conversion', `${again.status} → ${returned ?? JSON.stringify(again.body).slice(0, 300)}`);
    // acceptable: refused (4xx), or answered with the existing opportunity (idempotent, nothing new created)
    expect.soft(refused(again.status) || (again.status < 300 && returned === s.oppNo),
      `Repeat conversion refused or returns the existing ${s.oppNo} (got ${again.status} → ${returned})`).toBe(true);
    const forLead = (await api.searchOpportunities(s.leadNo!)).filter(o => o.lead?.leadNo === s.leadNo);
    expect.soft(forLead.map(o => o.opportunityNo), 'Still one opportunity for the lead').toEqual([s.oppNo]);
  });

  // ── OPP-053 · Conversion is traceable on both records
  // Use case: UC-OPP-010 Convert Lead to Opportunity
  // Checks: The first stage is Qualified, set by the converting user at creation time (within a minute); the
  //   lead reference is the converted lead
  test(...opp('OPP-053'), async ({ api }) => {
    const s = needOpportunity();
    const rec = await api.opportunity(s.oppId);
    const first = [...(rec.stageHistory ?? [])].sort((a, b) => Date.parse(a.changedAt) - Date.parse(b.changedAt))[0];
    note('created', { by: rec.createdBy?.name, at: rec.createdAt, firstStage: first });
    expect.soft(first?.opportunityStage?.name, 'First stage').toBe('Qualified');
    expect.soft(first?.changedByUser?.name, 'Changed by the converting user').toBe(rec.createdBy?.name);
    expect.soft(rec.lead?.leadNo, 'Lead reference').toBe(s.leadNo);
    expect.soft(Math.abs(Date.parse(first?.changedAt) - Date.parse(rec.createdAt)), 'First stage set at creation').toBeLessThan(60_000);
  });

  // ── OPP-042 · Visit without a date is rejected
  // Use case: UC-OPP-007 Change Opportunity Stage
  // Checks: "Select a visit date and time." and no request is sent
  test(...opp('OPP-042'), async ({ opps, page }) => {
    const s = needOpportunity();
    await opps.open();
    await opps.openRecord(s.oppNo);
    const writes = writesOf(page);
    const posted = await opps.submitVisit(3_000);
    expect.soft(posted, 'No visit request without a date').toBeNull();
    await expect.soft(opps.visitForm.locator(OPP.fieldError), 'Message').toHaveText('Select a visit date and time.');
    expect.soft(writes, 'No data change').toEqual([]);
  });

  // ── OPP-023 · Visit date cannot be in the past
  // Use case: UC-OPP-004 Edit Opportunity
  // Checks: In the date picker every day before today is disabled and today can be picked
  test(...opp('OPP-023'), async ({ opps, page }) => {
    const s = needOpportunity();
    await opps.open();
    await opps.openRecord(s.oppNo);
    await opps.openVisitPicker();
    const today = new Date().getDate();
    const days = await page.locator(OPP.calendarDay).evaluateAll(bs => bs.map(b => ({ day: Number(b.textContent), disabled: (b as HTMLButtonElement).disabled })));
    expect.soft(days.filter(d => d.day < today && !d.disabled).map(d => d.day), 'Past days that can be picked').toEqual([]);
    expect.soft(days.find(d => d.day === today)?.disabled, 'Today can be picked').toBe(false);
  });

  // ── OPP-038 · Scheduling the first visit moves Qualified → Site Visit
  // Use case: UC-OPP-007 Change Opportunity Stage
  // Checks: Notice "Site Visit Saved"; stage Site Visit in the detail, the list and the API; probability rises;
  //   the visit is listed as "Virtual · Scheduled" with the chosen date and time 11:00
  test(...opp('OPP-038'), async ({ opps, api, page }) => {
    const s = needOpportunity();
    await opps.open();
    const before = await opps.openRecord(s.oppNo);
    await opps.visitForm.locator(OPP.visitType).selectOption({ label: 'Virtual' });
    const shown = await opps.pickVisitDate(15, '11:00');
    const next = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 15);
    note('visit date', `picked 15 ${next.toLocaleString('en-GB', { month: 'short' })} ${next.getFullYear()} 11:00 → shown "${shown}"`);
    expect.soft(shown, 'Picked day shown').toContain(`15 ${next.toLocaleString('en-GB', { month: 'short' })} ${next.getFullYear()}`);
    expect.soft(shown, 'Picked time shown').toContain('11:00');
    await opps.visitForm.locator(OPP.remarks).fill(REMARKS);
    const res = await opps.submitVisit();
    expect(res?.status(), 'POST …/site-visits').toBeLessThan(300);
    const n = await opps.readNotice();
    expect.soft(n.title, 'Notice').toBe('Site Visit Saved');
    await opps.noticeButton('OK');
    saveLifecycle({ visitShown: shown });
    const rec = await api.opportunity(s.oppId);
    expect.soft(rec.opportunityStage?.name, 'API stage').toBe('Site Visit');
    expect.soft(rec.probabilityPercent, 'Probability rises').toBeGreaterThan(before.probabilityPercent);
    await page.reload();
    await opps.open();
    const row = (await (async () => { await opps.search(s.oppNo); return opps.rows(); })())[0];
    expect.soft(row.stage, 'List stage').toBe('Site Visit');
    expect.soft(row.probability, 'List probability').toBe(`${rec.probabilityPercent}%`);
    await opps.openRecord(s.oppNo);
    expect.soft(await opps.status.innerText(), 'Status pill').toBe('Site Visit');
    await expect.soft(opps.section('Site Visits'), 'Visit listed').toContainText(/Virtual\s*·\s*Scheduled/);
    await expect.soft(opps.section('Site Visits'), 'Visit remarks').toContainText(REMARKS);
  });

  // ── OPP-045 · Workflow and stage history follow the stage
  // Use case: UC-OPP-007 Change Opportunity Stage
  // Checks: Open and Qualified Done, Site Visit In progress, later steps Up next; stage history lists Qualified
  //   then Site Visit
  test(...opp('OPP-045'), async ({ opps, api }) => {
    const s = needOpportunity();
    await opps.open();
    await opps.openRecord(s.oppNo);
    const steps = await opps.workflow();
    note('workflow', steps.map(x => `${x.name}: ${x.text}`).join(' · '));
    expect.soft(steps.slice(0, 3).map(x => `${x.name}:${x.state}`), 'Done, Done, In progress').toEqual(['Open:done', 'Qualified:done', 'Site Visit:current']);
    expect.soft(steps.slice(3).filter(x => x.state !== 'next').map(x => x.name), 'Later steps Up next').toEqual([]);
    expect.soft(history(await api.opportunity(s.oppId)), 'Stage history').toEqual(['Qualified', 'Site Visit']);
  });

  // ── OPP-043 · Board only offers moves the workflow allows
  // Use case: UC-OPP-007 Change Opportunity Stage
  // Checks: Moves marked "(not from board)" are disabled, and choosing one does not change the stage
  test(...opp('OPP-043'), async ({ opps, api, page }) => {
    const s = needOpportunity();
    await opps.open();
    await opps.showBoard();
    const card = (await opps.boardCards('Site Visit')).find(c => c.oppNo === s.oppNo);
    expect(card, `${s.oppNo} in Site Visit column`).toBeTruthy();
    note('moves', card!.moves);
    const notAllowed = card!.moves.filter(m => /not from board/i.test(m.label));
    expect.soft(notAllowed.filter(m => !m.disabled).map(m => m.label), 'Moves marked "(not from board)" that can still be chosen').toEqual([]);
    const attempt = notAllowed.find(m => !m.disabled && !/^Won/.test(m.label));
    if (attempt) {
      await opps.boardCard(s.oppNo).locator(OPP.boardMoveSelect).selectOption({ label: attempt.label });
      await page.waitForTimeout(2_000);
      if (await opps.notice.count()) {
        note('after choosing', (await opps.readNotice()).body);
        const back = opps.notice.getByRole('button', { name: /^(Go back|Cancel|Close|OK)$/ }).first();
        if (await back.count()) await back.click();
      }
    }
    expect.soft((await api.opportunity(s.oppId)).opportunityStage?.name, 'Stage unchanged').toBe('Site Visit');
  });

  // ── OPP-044 · Backend rejects a prohibited stage change
  // Use case: UC-OPP-007 Change Opportunity Stage
  // Checks: The backend refuses the change (4xx) and the stage stays Site Visit
  test(...opp('OPP-044'), async ({ api }) => {
    const s = needOpportunity();
    const r = await api.call('POST', `/opportunities/${s.oppId}/stage`, { opportunityStageRefId: await stageId(api, 'Won'), probabilityPercent: 100, remarks: `${REMARKS} (forbidden move)` });
    note('forbidden move', `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    expect.soft(refused(r.status), `Site Visit → Won refused (got ${r.status})`).toBe(true);
    expect.soft((await api.opportunity(s.oppId)).opportunityStage?.name, 'Stage unchanged').toBe('Site Visit');
  });

  // ── OPP-021 · Add Note saves a note on the opportunity
  // Use case: UC-OPP-004 Edit Opportunity
  // Checks: The note appears under Notes; the stage does not change
  test(...opp('OPP-021'), async ({ opps, api }) => {
    const s = needOpportunity();
    const text = `${REMARKS} note ${Date.now()}`;
    await opps.open();
    await opps.openRecord(s.oppNo);
    const res = await opps.addNote(text);
    note('note request', res ? `${res.request().method()} ${res.status()} ${res.url()}` : 'none');
    expect(res?.status(), 'Note saved').toBeLessThan(300);
    if (await opps.notice.count()) await opps.noticeButton((await opps.notice.getByRole('button').last().innerText()).trim());
    saveLifecycle({ note: text });
    await expect.soft(opps.section('Notes'), 'Note listed').toContainText(text);
    expect.soft((await api.opportunity(s.oppId)).opportunityStage?.name, 'Stage unchanged').toBe('Site Visit');
  });

  // ── OPP-022 · An empty note is not saved
  // Use case: UC-OPP-004 Edit Opportunity
  // Checks: No request is sent and the user is told a note is needed (message, notice or disabled button)
  test(...opp('OPP-022'), async ({ opps, page }) => {
    const s = needOpportunity();
    await opps.open();
    await opps.openRecord(s.oppNo);
    const writes = writesOf(page);
    const res = await opps.addNote('', 3_000);
    expect.soft(res, 'No request for an empty note').toBeNull();
    expect.soft(writes, 'No data change').toEqual([]);
    const told = (await opps.notice.count()) > 0 || (await opps.noteForm.locator(OPP.fieldError).count()) > 0
      || await opps.noteForm.getByRole('button', { name: 'Add Note', exact: true }).isDisabled();
    expect.soft(told, 'User is told a note is needed (message, notice or disabled button)').toBe(true);
  });

  // ── OPP-025 · Saved changes persist after reopening
  // Use case: UC-OPP-004 Edit Opportunity
  // Checks: The note (OPP-021) and the site visit (OPP-038) are still shown
  test(...opp('OPP-025'), async ({ opps, page }) => {
    const s = needOpportunity();
    test.skip(!s.note, 'No note was saved by OPP-021');
    await opps.open();
    await page.reload();
    await opps.listSettled();
    await opps.openRecord(s.oppNo);
    await expect.soft(opps.section('Notes'), 'Note still there').toContainText(s.note!);
    await expect.soft(opps.section('Site Visits'), 'Visit still there').toContainText(REMARKS);
  });

  // ── OPP-040 · Mark Lost requires a reason, can be cancelled, and records the loss
  // Use case: UC-OPP-009 Mark Opportunity as Lost
  // Checks: No reason → "Required Fields Missing • Lost Reason"; Go back sends nothing and the deal stays open;
  //   Confirm → notice "Opportunity Lost", status Lost, probability 0%, reason / remarks / marked-lost-by
  //   shown, list row Lost, Open card −1
  test(...opp('OPP-040'), async ({ opps, api, page }) => {
    const s = needOpportunity();
    await opps.open();
    const openBefore = await opps.kpi('Open');
    await opps.openRecord(s.oppNo);
    const stageCalls: string[] = [];
    page.on('request', r => { if (/\/stage$/.test(r.url()) && r.method() === 'POST') stageCalls.push(r.url()); });
    // no reason
    await opps.fillLost('', REMARKS);
    await opps.clickMarkLost();
    const missing = await opps.readNotice();
    expect.soft(missing.title, 'Missing reason').toBe('Required Fields Missing');
    expect.soft(missing.body, 'Names the field').toContain('Lost Reason');
    await opps.noticeButton('OK');
    // cancel
    const reasons = await opps.lostReasons();
    const reason = reasons.includes('No Decision') ? 'No Decision' : reasons[0];
    await opps.fillLost(reason, REMARKS);
    await opps.clickMarkLost();
    expect.soft((await opps.readNotice()).title, 'Confirmation').toBe('Mark deal as Lost?');
    await opps.noticeButton('Go back');
    await page.waitForTimeout(1_000);
    expect.soft(stageCalls, 'Nothing sent before confirming').toEqual([]);
    expect.soft((await api.opportunity(s.oppId)).status, 'Still open after Go back').toBe('OPEN');
    // confirm
    await opps.clickMarkLost();
    const saved = page.waitForResponse(isStage);
    await opps.noticeButton('Confirm');
    expect((await saved).status(), 'POST …/stage').toBeLessThan(300);
    const done = await opps.readNotice();
    expect.soft(done.title, 'Notice').toBe('Opportunity Lost');
    await opps.noticeButton('OK');
    const rec = await api.opportunity(s.oppId);
    expect.soft([rec.status, rec.opportunityStage?.name, rec.probabilityPercent, rec.lostReason?.name], 'API').toEqual(['LOST', 'Lost', 0, reason]);
    await expect.soft(opps.status, 'Status pill').toHaveText('Lost');
    await expect.soft(opps.fact('Probability'), 'Probability').toHaveText('0%');
    await expect.soft(opps.lostForm, 'Reason shown').toContainText(reason);
    await expect.soft(opps.lostForm, 'Remarks shown').toContainText(REMARKS);
    await expect.soft(opps.lostForm, 'Marked lost by').toContainText(rec.updatedBy?.name ?? '');
    // the list behind the modal should follow without a reload
    await opps.closeDetail();
    await expect.configure({ soft: true }).poll(async () => (await opps.rows()).find(r => r.opp === s.oppNo)?.stage,
      { message: 'List refreshes to Lost after closing the detail', timeout: 10_000 }).toBe('Lost');
    await opps.open();
    expect.soft(await opps.kpi('Open'), 'Open −1').toBe(openBefore - 1);
    await opps.search(s.oppNo);
    expect.soft((await opps.rows())[0]?.stage, 'List stage after reload').toBe('Lost');
  });

  // ── OPP-041 · A closed opportunity cannot change stage again
  // Use case: UC-OPP-008, UC-OPP-009 Mark Opportunity as Won / Mark Opportunity as Lost
  // Checks: Lost cards have no move menu, and the backend refuses the stage change (4xx); the opportunity stays
  //   Lost
  test(...opp('OPP-041'), async ({ opps, api }) => {
    const s = needOpportunity();
    await opps.open();
    await opps.showBoard();
    const lost = await opps.boardCards('Lost');
    const won = await opps.boardCards('Won');
    expect.soft(lost.map(c => c.oppNo), 'Lost column shows the opportunity').toContain(s.oppNo);
    expect.soft(lost.filter(c => c.moves.length).map(c => c.oppNo), 'Lost cards with a move menu').toEqual([]);
    // whether a Won deal may still be marked Lost is a business rule to confirm (see OPP-039), so it is recorded, not failed
    const wonMoves = won.filter(c => c.moves.length);
    if (wonMoves.length) note('observation', `${wonMoves.length} Won card(s) still offer moves: ${[...new Set(wonMoves.flatMap(c => c.moves.map(m => m.label)))].join(', ')}`);
    const r = await api.call('POST', `/opportunities/${s.oppId}/stage`, { opportunityStageRefId: await stageId(api, 'Qualified'), probabilityPercent: 35, remarks: `${REMARKS} (reopen attempt)` });
    note('reopen attempt', `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    expect.soft(refused(r.status), `Lost → Qualified refused (got ${r.status})`).toBe(true);
    expect.soft((await api.opportunity(s.oppId)).status, 'Still Lost').toBe('LOST');
  });

  // ── OPP-026 · A closed opportunity offers no workflow actions
  // Use case: UC-OPP-004, UC-OPP-012 Edit Opportunity / Validate Role-Based Access
  // Checks: Lost reason / by / on shown read-only; "Marked Lost" disabled; no visit or stage actions; Unit Hold
  //   says "This opportunity is closed, so units cannot be held."
  test(...opp('OPP-026'), async ({ opps }) => {
    const s = needOpportunity();
    await opps.open();
    await opps.openRecord(s.oppNo);
    const forms = await opps.formHeadings();
    note('actions', forms.join(' · '));
    expect.soft(forms.filter(f => /Visit/.test(f)), 'Visit / stage actions on a Lost opportunity').toEqual([]);
    await expect.soft(opps.lostForm.getByRole('button', { name: 'Marked Lost' }), '"Marked Lost" disabled').toBeDisabled();
    await expect.soft(opps.detail, 'Unit Hold closed').toContainText('This opportunity is closed, so units cannot be held.');
  });

  // ── OPP-055 · Backend does not delete an opportunity
  // Use case: UC-OPP-011 Delete Opportunity
  // Checks: The DELETE is refused (4xx) and the record is still returned and active
  test(...opp('OPP-055'), async ({ api }) => {
    const s = needOpportunity();
    const r = await api.call('DELETE', `/opportunities/${s.oppId}`);
    note('delete', `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    expect.soft(r.status, 'DELETE refused').toBeGreaterThanOrEqual(400);
    const after = await api.get(`/opportunities/${s.oppId}`);
    expect.soft(after.status, 'Record still returned').toBe(200);
    expect.soft(after.body?.isActive, 'Record still active').toBe(true);
  });

  // ── OPP-056 · A closed (Lost) opportunity stays on record
  // Use case: UC-OPP-011 Delete Opportunity
  // Checks: The Lost opportunity is still listed (stage Lost), searchable and opens as Lost
  test(...opp('OPP-056'), async ({ opps }) => {
    const s = needOpportunity();
    await opps.open();
    await opps.search(s.oppNo);
    const rows = await opps.rows();
    expect.soft(rows.map(r => `${r.opp}:${r.stage}`), 'Listed as Lost').toEqual([`${s.oppNo}:Lost`]);
    await opps.openRecord(s.oppNo);
    await expect.soft(opps.status, 'Opens as Lost').toHaveText('Lost');
  });
});

type BoardState = { oppNo?: string; oppId?: string; customer?: string; owner?: string; qualifiedBefore?: number };
const BOARD_STATE = path.resolve(__dirname, '../../test-results/board-lifecycle.json');
const state = (): BoardState => { try { return JSON.parse(fs.readFileSync(BOARD_STATE, 'utf8')); } catch { return {}; } };
const save = (p: BoardState) => { fs.mkdirSync(path.dirname(BOARD_STATE), { recursive: true }); fs.writeFileSync(BOARD_STATE, JSON.stringify({ ...state(), ...p }, null, 2)); };
function needOpp() {
  const s = state();
  test.skip(!s.oppNo || !s.oppId, 'Not run: depends on OPP-074 (convert a lead and find it on the Board), which did not complete in this run. Fix that step first; this test case was not checked.');
  return s as Required<BoardState>;
}
async function openBoard(opps: OpportunitiesPage) {
  await opps.open();
  await opps.showBoard();
}

test.describe('Opportunities · Board lifecycle (live QA data)', () => {
  // ── OPP-074 · A newly converted opportunity appears on the Board
  // Use case: UC-OPP-002 Create Opportunity
  // Checks: The new card is in Qualified with "35%" (or the configured probability), "0d in stage" and the
  //   lead's owner; Qualified count +1
  test(...opp('OPP-074'), async ({ opps, leads, page }) => {
    await openBoard(opps);
    const qualifiedBefore = (await opps.boardColumns()).find(c => c.stage === 'Qualified')!.count;
    await leads.open();
    await leads.openTab('Ready to Convert');
    const candidates = (await leads.rows()).filter(r => r.status === 'Qualified');
    test.skip(!candidates.length, 'No qualified lead to convert');
    const lead = candidates[Math.floor(Math.random() * candidates.length)];
    await leads.openLead(lead.leadNo);
    const owner = (await leads.fact('Assigned').innerText()).trim();
    await leads.moveButton.click();
    const converted = page.waitForResponse(isConvert);
    await leads.confirmDialog.getByRole('button', { name: 'Convert', exact: true }).click();
    const res = await converted;
    expect(res.status(), 'POST …/convert').toBeLessThan(300);
    const rec = (await res.json()).items?.[0];
    save({ oppNo: rec.opportunityNo, oppId: rec.id, customer: rec.customer?.name, owner, qualifiedBefore });
    await opps.noticeButton('OK');
    await openBoard(opps);
    const card = (await opps.boardCards('Qualified')).find(c => c.oppNo === rec.opportunityNo);
    note('card', card);
    expect(card, `${rec.opportunityNo} in Qualified`).toBeTruthy();
    expect.soft(card!.tags, 'Tags').toEqual([`${rec.probabilityPercent}%`, '0d in stage']);
    expect.soft(card!.owner, 'Owner').toBe(owner);
    expect.soft(card!.customer, 'Customer').toBe(rec.customer?.name);
    expect.soft((await opps.boardColumns()).find(c => c.stage === 'Qualified')!.count, 'Qualified +1').toBe(qualifiedBefore + 1);
  });

  // ── OPP-075 · Dragging a card to a stage the workflow does not allow is refused
  // Use case: UC-OPP-007 Change Opportunity Stage
  // Checks: Message "Can't move to Negotiation — Complete a site visit with outcome notes to move to
  //   Negotiation." with Close and Open opportunity; the stage stays Qualified and the card stays in Qualified
  test(...opp('OPP-075'), async ({ opps, api }) => {
    const s = needOpp();
    await openBoard(opps);
    await opps.dragCard(s.oppNo, 'Negotiation');
    const d = opps.cantMoveDialog;
    await expect(d, '"Can\'t move" message').toBeVisible();
    await expect.soft(d, 'Message').toContainText("Can't move to Negotiation");
    await expect.soft(d, 'What to do first').toContainText('Complete a site visit with outcome notes to move to Negotiation.');
    await expect.soft(d.getByRole('button', { name: 'Open opportunity' }), 'Open opportunity').toBeVisible();
    await d.getByRole('button', { name: 'Close', exact: true }).click();
    expect.soft((await api.opportunity(s.oppId)).opportunityStage?.name, 'Stage unchanged').toBe('Qualified');
    expect.soft((await opps.boardCards('Qualified')).some(c => c.oppNo === s.oppNo), 'Card still in Qualified').toBe(true);
  });

  // ── OPP-076 · Dropping a card on Lost asks for the loss details
  // Use case: UC-OPP-009 Mark Opportunity as Lost
  // Checks: The "Mark as Lost" dialog opens; Cancel leaves the opportunity Qualified
  test(...opp('OPP-076'), async ({ opps, api }) => {
    const s = needOpp();
    await openBoard(opps);
    await opps.dragCard(s.oppNo, 'Lost');
    await expect(opps.lostDialog, 'Mark as Lost opens').toBeVisible();
    await opps.lostDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(opps.lostDialog).toHaveCount(0);
    expect.soft((await api.opportunity(s.oppId)).status, 'Still open').toBe('OPEN');
  });

  // ── OPP-077 · Mark as Lost from the Board needs a reason
  // Use case: UC-OPP-009 Mark Opportunity as Lost
  // Checks: "Required Fields Missing — Lost Reason"; nothing is saved and the stage stays Qualified
  test(...opp('OPP-077'), async ({ opps, api, page }) => {
    const s = needOpp();
    await openBoard(opps);
    const stageCalls: string[] = [];
    page.on('request', r => { if (/\/stage$/.test(r.url()) && r.method() === 'POST') stageCalls.push(r.url()); });
    await opps.moveCard(s.oppNo, 'Lost');
    await opps.lostDialog.getByRole('button', { name: 'Continue' }).click();
    const n = await opps.readNotice();
    expect.soft(n.title, 'Notice').toBe('Required Fields Missing');
    expect.soft(n.body, 'Names the field').toContain('Lost Reason');
    await opps.noticeButton('OK');
    if (await opps.lostDialog.count()) await opps.lostDialog.getByRole('button', { name: 'Cancel' }).click();
    expect.soft(stageCalls, 'Nothing saved').toEqual([]);
    expect.soft((await api.opportunity(s.oppId)).opportunityStage?.name, 'Stage unchanged').toBe('Qualified');
  });

  // ── OPP-078 · Mark as Lost from the Board
  // Use case: UC-OPP-009 Mark Opportunity as Lost
  // Checks: "Mark deal as Lost?" (Go back changes nothing); Confirm → "Opportunity Lost"; the card leaves
  //   Qualified and is listed under Lost; Qualified −1 and Lost +1; the opportunity is Lost with reason Timing
  test(...opp('OPP-078'), async ({ opps, api, page }) => {
    const s = needOpp();
    await openBoard(opps);
    const before = Object.fromEntries((await opps.boardColumns()).map(c => [c.stage, c.count]));
    await opps.moveCard(s.oppNo, 'Lost');
    const d = opps.lostDialog;
    await d.locator('select').selectOption({ label: 'Timing' });
    await d.locator('textarea').fill(BOARD_REMARKS);
    await d.getByRole('button', { name: 'Continue' }).click();
    const ask = await opps.readNotice();
    expect.soft(ask.title, 'Confirmation').toBe('Mark deal as Lost?');
    await opps.noticeButton('Go back');
    expect.soft((await api.opportunity(s.oppId)).status, 'Go back changes nothing').toBe('OPEN');
    if (!(await d.isVisible().catch(() => false))) {
      await opps.moveCard(s.oppNo, 'Lost');
      await d.locator('select').selectOption({ label: 'Timing' });
      await d.locator('textarea').fill(BOARD_REMARKS);
    }
    await d.getByRole('button', { name: 'Continue' }).click();
    await expect(opps.notice).toBeVisible();
    const saved = page.waitForResponse(isStage);
    await opps.noticeButton('Confirm');
    expect((await saved).status(), 'POST …/stage').toBeLessThan(300);
    const done = await opps.readNotice();
    expect.soft(done.title, 'Notice').toBe('Opportunity Lost');
    await opps.noticeButton('OK');
    const rec = await api.opportunity(s.oppId);
    expect.soft([rec.status, rec.opportunityStage?.name, rec.lostReason?.name], 'Opportunity').toEqual(['LOST', 'Lost', 'Timing']);
    // the board should follow without a reload…
    await expect.configure({ soft: true }).poll(async () => (await opps.boardColumns()).find(c => c.stage === 'Lost')?.count,
      { message: 'Lost count +1 without reloading', timeout: 10_000 }).toBe(before['Lost'] + 1);
    // …and after a reload the card has moved
    await openBoard(opps);
    const after = Object.fromEntries((await opps.boardColumns()).map(c => [c.stage, c.count]));
    note('counts', { before, after });
    expect.soft((await opps.boardCards('Qualified')).some(c => c.oppNo === s.oppNo), 'Left Qualified').toBe(false);
    expect.soft((await opps.boardCards('Lost')).some(c => c.oppNo === s.oppNo), 'Listed under Lost').toBe(true);
  });
});
