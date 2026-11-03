/** Change Status: Disqualify (LDP-021 … LDP-025) and Move Back To (LDP-031 … LDP-034). */
import { test, expect, note, ldp, ldpRow, freshLead, workerLead, listedFields } from './shared';
import { message, setting, disqualifyReasons, statusChanges, optionsOf } from './test-data';

test.describe('Lead Detail · Change Status', () => {
  test.describe.configure({ timeout: 600_000 });
  const REQUIRED = message('Required Title');

  test(...ldp('LDP-021'), async ({ leads }) => {
    const { detail } = await workerLead(leads);
    const before = await detail.statusChip();
    const n = await detail.press('Disqualify lead');
    note('pop-up', n?.text ?? 'none');
    await detail.notice.dismiss();
    expect.soft(n?.title, 'Pop-up').toBe(REQUIRED);
    expect.soft(listedFields(n?.text), 'Fields listed').toEqual(['Disqualification Reason', 'Disqualification Remarks']);
    expect(await detail.statusChip(), 'Status unchanged').toBe(before);
  });

  test(...ldp('LDP-022'), async ({ leads }) => {
    const { detail } = await workerLead(leads);
    await detail.set('Disqualification Reason', disqualifyReasons()[0].reason);
    const n = await detail.press('Disqualify lead');
    await detail.notice.dismiss();
    expect.soft(n?.title, 'Pop-up').toBe(REQUIRED);
    expect(listedFields(n?.text), 'Fields listed').toEqual(['Disqualification Remarks']);
  });

  test(...ldp('LDP-023'), async ({ leads }) => {
    const { detail } = await workerLead(leads);
    await detail.set('Disqualification Remarks', disqualifyReasons()[0].remarks);
    const n = await detail.press('Disqualify lead');
    await detail.notice.dismiss();
    expect.soft(n?.title, 'Pop-up').toBe(REQUIRED);
    expect(listedFields(n?.text), 'Fields listed').toEqual(['Disqualification Reason']);
  });

  test(...ldp('LDP-024'), async ({ leads }) => {
    const { detail } = await workerLead(leads);
    expect(await detail.options('Disqualification Reason')).toEqual(optionsOf('Disqualification Reason'));
  });

  disqualifyReasons().forEach((r, i) => {
    test(...ldpRow('LDP-025', i + 1, r.reason, `"${message('Disqualified Title')}"; status ${setting('Status After Disqualify')}; Status History "→ ${setting('Status After Disqualify')}" with "${r.remarks}"`, `${r.reason} / ${r.remarks}`), async ({ leads }) => {
      const { lead, leadNo, detail } = await freshLead(leads);
      const before = await detail.statusChip();
      await detail.set('Disqualification Reason', r.reason);
      await detail.set('Disqualification Remarks', r.remarks);
      const ask = await detail.press('Disqualify lead');
      note('confirmation', ask?.text ?? 'none');
      expect.soft(ask?.title, 'Confirmation').toBe(message('Disqualify Confirm Title'));
      await detail.notice.close(message('Disqualify Confirm Button'));
      const n = await detail.notice.wait(30_000);
      if (n) await detail.notice.close();
      note('pop-up', n?.text ?? 'none');
      expect.soft(n?.title, 'Pop-up').toBe(message('Disqualified Title'));
      expect.soft(n?.text ?? '', 'Pop-up text').toContain(message('Disqualified Body'));
      const again = await leads.openLead(leadNo);
      const top = (await again.historyEntries('Status History'))[0];
      note('status history', JSON.stringify(top));
      expect.soft(await again.statusChip(), 'Status in the panel').toBe(setting('Status After Disqualify'));
      expect.soft(top?.text ?? '', 'Latest Status History entry').toContain(`${before} → ${setting('Status After Disqualify')}`);
      expect.soft(top?.text ?? '', 'Remarks in Status History').toContain(r.remarks);
      await again.close();
      expect((await leads.find(lead.email))[0]?.status, 'Status in the Leads list').toBe(setting('Status After Disqualify'));
    });
  });

  test(...ldp('LDP-026'), async ({ leads }) => {
    const { leadNo, detail } = await freshLead(leads);
    const before = await detail.statusChip();
    const r = disqualifyReasons()[0];
    await detail.set('Disqualification Reason', r.reason);
    await detail.set('Disqualification Remarks', r.remarks);
    const ask = await detail.press('Disqualify lead');
    note('confirmation', ask?.text ?? 'none');
    expect.soft(ask?.buttons ?? [], 'Confirmation buttons').toEqual([message('Disqualify Cancel Button'), message('Disqualify Confirm Button')]);
    await detail.notice.close(message('Disqualify Cancel Button'));
    expect(await (await leads.openLead(leadNo)).statusChip(), 'Status unchanged after Cancel').toBe(before);
  });

  test(...ldp('LDP-027'), async ({ leads }) => {
    const { lead, leadNo, detail } = await freshLead(leads);
    const r = disqualifyReasons()[0];
    await detail.disqualify(r.reason, r.remarks, message('Disqualify Confirm Button'));
    const d = await leads.openLead(leadNo);
    const options = await d.options('Reopen As');
    note('Reopen As options', options.join(', '));
    expect.soft(options, 'Reopen As options').toEqual(optionsOf('Reopen As'));
    const status = setting('Reopen Status'), reason = setting('Reopen Reason');
    const n = await d.reopen(status, reason);
    note('pop-up', n?.text ?? 'none');
    const again = await leads.openLead(leadNo);
    const top = (await again.historyEntries('Status History'))[0];
    note('status history', JSON.stringify(top));
    expect.soft(await again.statusChip(), 'Status after reopening').toBe(status);
    expect.soft(top?.text ?? '', 'Latest Status History entry').toBe(`${setting('Status After Disqualify')} → ${status} · ${reason}`);
    await again.close();
    expect((await leads.find(lead.email))[0]?.status, 'Status in the Leads list').toBe(status);
  });

  test(...ldp('LDP-031'), async ({ leads }) => {
    const { detail } = await workerLead(leads);
    const before = await detail.statusChip();
    const n = await detail.press('Change Status');
    await detail.notice.dismiss();
    note('pop-up', n?.text ?? 'none');
    expect.soft(n?.title, 'Pop-up').toBe(REQUIRED);
    expect.soft(listedFields(n?.text), 'Fields listed').toEqual(['Move Back To', 'Status Change Reason']);
    expect(await detail.statusChip(), 'Status unchanged').toBe(before);
  });

  test(...ldp('LDP-032'), async ({ leads }) => {
    const { detail } = await workerLead(leads);
    await detail.set('Move Back To', statusChanges()[0].status);
    const n = await detail.press('Change Status');
    await detail.notice.dismiss();
    expect.soft(n?.title, 'Pop-up').toBe(REQUIRED);
    expect(listedFields(n?.text), 'Fields listed').toEqual(['Status Change Reason']);
  });

  test(...ldp('LDP-033'), async ({ leads }) => {
    const { leadNo } = await freshLead(leads);
    for (const s of statusChanges()) {
      const detail = await leads.openLead(leadNo);
      const options = await detail.options('Move Back To');
      note(`options before step ${s.step}`, options.join(', '));
      expect.soft(options, `Move Back To options before moving to ${s.status}`).toEqual(s.optionsBefore);
      await detail.changeStatus(s.status, s.reason);
    }
  });

  test(...ldp('LDP-034'), async ({ leads }) => {
    const { lead, leadNo } = await freshLead(leads);
    for (const s of statusChanges()) {
      const detail = await leads.openLead(leadNo);
      const n = await detail.changeStatus(s.status, s.reason);
      note(`step ${s.step}`, n?.text ?? 'none');
      expect.soft(n?.title, `Pop-up for ${s.status}`).toBe(message('Status Changed Title'));
      expect.soft(n?.text ?? '', `Pop-up for ${s.status}`).toContain(message('Status Changed Body', { status: s.status }));
      expect.soft(await (await leads.openLead(leadNo)).statusChip(), `Panel status after moving to ${s.status}`).toBe(s.status);
      await leads.openRoute();
      expect.soft((await leads.find(lead.email))[0]?.status, `List status after moving to ${s.status}`).toBe(s.status);
    }
  });
});
