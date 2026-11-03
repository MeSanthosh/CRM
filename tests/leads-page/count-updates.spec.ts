/**
 * HLUC-03 Validate Lead Counts — counts update after create / assign / qualify / disqualify / convert
 * (LP-076 … LP-080). Each test works on a lead it created; the expected change of every count is read
 * from the Count Changes sheet. The before → action → after sequence runs under the leads lock so no
 * other test of this run creates a lead in between.
 */
import { test, expect, note, createAndGetLeadNo, withLeadsLock } from './shared';
import { lp } from './catalog';
import { newLead, countChanges, qualification, actionValue, basicValues, describe } from './test-data';
import { LeadForm } from '../pages/LeadForm';
import type { LeadsPage, CountSnapshot } from '../pages/LeadsPage';
import type { LeadDetail } from '../pages/LeadDetail';

test.describe.configure({ timeout: 600_000 }); // includes waiting for the leads lock

function expectChanges(action: string, before: CountSnapshot, after: CountSnapshot) {
  const want = countChanges(action);
  note('before', JSON.stringify(before));
  note('after', JSON.stringify(after));
  for (const [k, d] of Object.entries(want)) {
    expect.soft(after[k] - before[k], `${k}: ${before[k]} → ${after[k]} (expected ${d >= 0 ? '+' : ''}${d})`).toBe(d);
  }
}

/** Snapshot → action on the lead → snapshot, all under the lock. */
async function measure(leads: LeadsPage, action: string, leadNo: string, fn: (d: LeadDetail) => Promise<unknown>) {
  await withLeadsLock(async () => {
    const before = await leads.snapshot();
    const d = await leads.openLead(leadNo);
    const n = await fn(d);
    if (n) note('pop-up', JSON.stringify(n));
    await leads.page.waitForTimeout(1500); // counts are recalculated after the change
    expectChanges(action, before, await leads.snapshot());
  });
}

test.describe('Leads page · Count updates', () => {
  test(...lp('LP-076'), async ({ leads }) => {
    const lead = newLead('Individual');
    await withLeadsLock(async () => {
      const before = await leads.snapshot();
      const f = new LeadForm(leads.page, 'Individual');
      await f.open();
      note('test data', describe(lead));
      await f.fill(basicValues(lead));
      const r = await f.submit();
      expect(r.saved, `Lead saved (${r.notice?.text ?? 'no pop-up'})`).toBeTruthy();
      await f.closeNotice();
      await leads.page.waitForTimeout(1500);
      expectChanges('Create', before, await leads.snapshot());
    });
  });

  test(...lp('LP-077'), async ({ leads }) => {
    const leadNo = await createAndGetLeadNo(leads, newLead('Individual'));
    const user = actionValue('Assign', 'Assign To User');
    await measure(leads, 'Assign', leadNo, d => d.assign(user));
    const d = await leads.openLead(leadNo);
    expect(await d.value('Assigned'), 'New owner').toBe(user);
  });

  test(...lp('LP-078'), async ({ leads }) => {
    const leadNo = await createAndGetLeadNo(leads, newLead('Individual'));
    await measure(leads, 'Qualify', leadNo, d => d.qualify(qualification()));
    const d = await leads.openLead(leadNo);
    expect(await d.status(), 'Status after qualifying').toBe('Qualified');
  });

  test(...lp('LP-079'), async ({ leads }) => {
    const leadNo = await createAndGetLeadNo(leads, newLead('Individual'));
    await measure(leads, 'Disqualify', leadNo, d => d.disqualify(actionValue('Disqualify', 'Disqualification Reason'), actionValue('Disqualify', 'Disqualification Remarks')));
    const d = await leads.openLead(leadNo);
    expect(await d.history('Status History'), 'Status History').toMatch(/Disqualified/);
  });

  test(...lp('LP-080'), async ({ leads }) => {
    // a lead of its own, qualified first (outside the measurement)
    const qualifiedLead = await createAndGetLeadNo(leads, newLead('Individual'));
    await withLeadsLock(async () => {
      const d = await leads.openLead(qualifiedLead);
      await d.qualify(qualification());
      expect(await d.status(), 'Qualified before converting').toBe('Qualified');
    });
    await measure(leads, 'Convert', qualifiedLead, d => d.convert(actionValue('Convert', 'Confirm Button')));
    await leads.openRoute();
    expect((await leads.find(qualifiedLead))[0]?.status, 'Status after converting').toMatch(/Converted|Opportunity/);
  });
});
