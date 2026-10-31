/** Qualify Lead: checklist, dropdowns, combinations, score, Ready to Convert and conversion (LDP-051 … LDP-060). */
import { test, expect, note, ldp, ldpRow, freshLead, workerLead, listedFields } from './shared';
import { message, setting, checklist, checklistValues, combinations, dropdownOptions } from './test-data';
import { tabRule } from '../leads-page/test-data';
import { OpportunitiesPage } from '../pages/TasksPage';
import { LeadDetail } from '../pages/LeadDetail';
import { parseNum } from '../helpers';

/** Score shown in "Qualified with score N" of the newest Status History entry. */
async function historyScore(d: LeadDetail) {
  const top = (await d.historyEntries('Status History'))[0]?.text ?? '';
  return top.match(/(\d+)\s*$/)?.[1] ?? '';
}

let checklistLead = '';

test.describe('Lead Detail · Qualify Lead', () => {
  test.describe.configure({ timeout: 600_000 });

  test(...ldp('LDP-051'), async ({ leads }) => {
    // a lead of its own: logged calls fill Last Interaction / Interaction Type on a shared lead
    const { detail } = await freshLead(leads);
    const n = await detail.press('Qualify lead', true);
    await detail.notice.dismiss();
    note('pop-up', n?.text ?? 'none');
    expect.soft(n?.title, 'Pop-up').toBe(message('Qualify Missing Title'));
    expect.soft(listedFields(n?.text), 'Items listed').toEqual(checklist().map(c => c.item));
    expect(await detail.statusChip(), 'Still not qualified').not.toBe(setting('Status After Qualify'));
  });

  checklist().forEach((c, i) => {
    test(...ldpRow('LDP-052', i + 1, `${c.item} left empty`, `"${message('Qualify Missing Title')}" names only "${c.item}"; the lead is not qualified`, `Empty: ${c.label}`), async ({ leads }) => {
      // a lead of its own: if the app wrongly qualifies it, the next item gets a new lead
      if (checklistLead) {
        const d = await leads.openLead(checklistLead);
        if ((await d.statusChip()) === setting('Status After Qualify')) checklistLead = '';
      }
      if (!checklistLead) checklistLead = (await freshLead(leads)).leadNo;
      const detail = await leads.openLead(checklistLead);
      for (const o of checklist()) if (o.item !== c.item) await detail.set(o.label, o.value);
      const n = await detail.press('Qualify lead', true);
      await detail.notice.dismiss();
      note('pop-up', n?.text ?? 'none');
      expect.soft(n?.title, 'Pop-up').toBe(message('Qualify Missing Title'));
      expect(listedFields(n?.text), 'Items listed').toEqual([c.item]);
    });
  });

  test(...ldp('LDP-053'), async ({ leads }) => {
    const { detail } = await workerLead(leads);
    for (const d of dropdownOptions('Qualify Lead')) {
      const got = await detail.options(d.label);
      expect.soft(got, `Options of ${d.label}`).toEqual(d.options);
    }
  });

  combinations().forEach((c, i) => {
    test(...ldpRow('LDP-054', i + 1, c.id, `Status ${setting('Status After Qualify')}; budget ${c.budget}, timeline ${c.timeline}; "${message('History Qualified', { score: 'N' })}" with N = Score`, c.values.map(([k, v]) => `${k}=${v}`).join('; ')), async ({ leads }) => {
      const { lead, leadNo, detail } = await freshLead(leads);
      const n = await detail.qualify(c.values);
      note('pop-up', n?.text ?? 'none');
      expect.soft(n?.title, 'Pop-up').toBe(message('Qualified Title'));
      expect.soft(n?.text ?? '', 'Pop-up text').toContain(message('Qualified Body', { name: lead.name }));
      const d = await leads.openLead(leadNo);
      const budget = await d.value('Budget'), timeline = await d.value('Timeline'), status = await d.statusChip(), hist = await historyScore(d);
      await d.close();
      const listScore = (await leads.find(lead.email))[0]?.score ?? '';
      note('status / budget / timeline / history score / list score', `${status} / ${budget} / ${timeline} / ${hist} / ${listScore}`);
      expect.soft(status, 'Status').toBe(setting('Status After Qualify'));
      expect.soft(parseNum(budget), `BUDGET ${budget}`).toBeCloseTo(Number(c.budget), -3);
      expect.soft(timeline, 'TIMELINE').toBe(c.timeline);
      expect.soft(hist, 'Score written in Status History').toMatch(/^\d+$/);
      expect(listScore, 'Score in the Leads list = score in Status History').toBe(hist);
    });
  });

  test(...ldp('LDP-055'), async ({ leads }) => {
    const { detail } = await workerLead(leads);
    const n = await detail.recalculate();
    const b = await detail.scoreBreakdown();
    const score = await detail.score();
    const sum = b.items.reduce((a, x) => a + x.points, 0);
    note('pop-up / score / breakdown', `${n?.text} / ${score} / ${b.items.map(x => `${x.name} ${x.points}/${x.max}`).join(', ')}`);
    expect.soft(n?.title, 'Pop-up').toBe(message('Score Title'));
    expect.soft(n?.text ?? '', 'Pop-up text').toContain(message('Score Body', { score: b.computed, rating: b.suggested }));
    expect.soft(b.items.length, 'Breakdown items shown').toBeGreaterThan(0);
    for (const x of b.items) expect.soft(x.points, `${x.name} within its maximum`).toBeLessThanOrEqual(x.max);
    expect.soft(Number(score), 'Score field = computed score').toBe(b.computed);
    expect(sum, 'Sum of the breakdown = computed score').toBe(b.computed);
  });

  test(...ldp('LDP-056'), async ({ leads }) => {
    const { lead, leadNo, detail } = await freshLead(leads);
    await detail.recalculate();
    const before = (await detail.scoreBreakdown()).computed;
    await detail.qualify(checklistValues());
    const d = await leads.openLead(leadNo);
    const hist = await historyScore(d);
    await d.close();
    const listScore = (await leads.find(lead.email))[0]?.score ?? '';
    note('score before / history after / list after', `${before} / ${hist} / ${listScore}`);
    expect.soft(hist, 'Score written in Status History').toMatch(/^\d+$/);
    expect.soft(listScore, 'Score in the Leads list = Status History').toBe(hist);
    expect(Number(hist), 'Score higher after qualifying').toBeGreaterThan(before);
  });

  test(...ldp('LDP-057'), async ({ leads }) => {
    const { detail } = await workerLead(leads);
    await detail.recalculate();
    const { suggested } = await detail.scoreBreakdown();
    const n = await detail.applySuggestedRating();
    const { current } = await detail.scoreBreakdown();
    note('suggested / pop-up / current rating / Rating dropdown', `${suggested} / ${n?.text ?? 'none'} / ${current} / ${await detail.selected('Rating')}`);
    expect.soft(current, '"Current rating" in the score box').toBe(suggested);
    expect(await detail.selected('Rating'), 'Rating dropdown').toBe(suggested);
  });

  test(...ldp('LDP-058'), async ({ leads }) => {
    const { lead, detail } = await freshLead(leads);
    await detail.qualify(checklistValues());
    await leads.openRoute(tabRule('Ready to Convert').route);
    const rows = await leads.find(lead.email);
    expect(rows.map(r => r.status), 'Listed on Ready to Convert').toEqual([setting('Status After Qualify')]);
  });

  test(...ldp('LDP-059'), async ({ leads }) => {
    const { leadNo, detail } = await freshLead(leads);
    await detail.qualify(checklistValues());
    const d = await leads.openLead(leadNo);
    const n = await d.press('Move to Opportunity');
    note('pop-up', n?.text ?? 'none');
    expect.soft(n?.title, 'Confirmation').toBe(message('Convert Confirm Title'));
    await d.notice.close(message('Convert Go Back'));
    expect(await (await leads.openLead(leadNo)).statusChip(), 'Still qualified after Go back').toBe(setting('Status After Qualify'));
  });

  test(...ldp('LDP-060'), async ({ leads }) => {
    const { lead, leadNo, detail } = await freshLead(leads);
    await detail.qualify(checklistValues());
    const d = await leads.openLead(leadNo);
    const n = await d.convert(message('Convert Button'));
    note('pop-up', n?.text ?? 'none');
    const opp = new OpportunitiesPage(leads.page, setting('Opportunities Route'));
    await opp.open();
    const rows = await opp.rowsWith(leadNo);
    note('opportunity rows', rows.join(' | '));
    expect.soft(rows.length, 'Opportunity linked to the Lead No.').toBe(1);
    expect.soft(rows[0] ?? '', 'Opportunity shows the lead name').toContain(lead.name);
    await leads.openRoute();
    expect.soft((await leads.find(lead.email))[0]?.status, 'Lead status').toBe(setting('Status After Convert'));
    const after = await leads.openLead(leadNo);
    for (const b of ['Qualify lead', 'Move to Opportunity', 'Disqualify lead', 'Reassign lead', 'Change Status'])
      expect.soft(await after.root.getByRole('button', { name: b, exact: true }).count(), `"${b}" no longer offered`).toBe(0);
  });
});
