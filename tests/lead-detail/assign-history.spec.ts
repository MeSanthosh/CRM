/** Assign Lead (LDP-041 … LDP-045) and Status / Owner History (LDP-071, LDP-072). */
import { test, expect, note, ldp, freshLead, workerLead } from './shared';
import { message, setting, checklistValues, statusChanges, shownDate } from './test-data';

test.describe('Lead Detail · Assign Lead', () => {
  test.describe.configure({ timeout: 600_000 });
  const USER = () => setting('Assign User');

  test(...ldp('LDP-041'), async ({ leads }) => {
    const { detail } = await workerLead(leads);
    expect(await detail.assignDisabled(), 'Assign Lead disabled with "Select user"').toBeTruthy();
  });

  test(...ldp('LDP-042'), async ({ leads }) => {
    const { detail } = await workerLead(leads);
    const me = await leads.signedInUser();
    const users = await detail.options('Assign to');
    note('users', users.join(', '));
    const repeated = users.filter((u, i) => users.indexOf(u) !== i);
    if (repeated.length) note('names listed more than once', repeated.join(', '));
    expect.soft(users, 'Signed-in user offered').toContain(me);
    expect(users, 'Assign User offered').toContain(USER());
  });

  test(...ldp('LDP-043'), async ({ leads }) => {
    const { lead, leadNo, detail } = await freshLead(leads);
    const me = await leads.signedInUser();
    const n = await detail.assign(USER());
    note('pop-up', n?.text ?? 'none');
    expect.soft(n?.title, 'Pop-up').toBe(message('Assigned Title'));
    expect.soft(n?.text ?? '', 'Pop-up text').toContain(message('Assigned Body', { user: USER() }));
    const again = await leads.openLead(leadNo);
    expect.soft(await again.value('Assigned'), 'ASSIGNED after reopening').toBe(USER());
    const top = (await again.historyEntries('Owner History'))[0];
    note('owner history', JSON.stringify(top));
    expect.soft(top?.text ?? '', 'Owner History').toBe(`${me} → ${USER()} · ${message('Owner Reassigned')}`);
    await again.close();
    expect((await leads.find(lead.email))[0]?.assigned, 'Assigned column on the Leads list').toBe(USER());
  });

  test(...ldp('LDP-044'), async ({ leads }) => {
    const { detail } = await freshLead(leads);
    await detail.assign(USER());
    expect(await detail.value('Assigned'), 'ASSIGNED straight after Assign Lead').toBe(USER());
  });

  test(...ldp('LDP-045'), async ({ leads }) => {
    const { leadNo, detail } = await freshLead(leads);
    await detail.assign(USER());
    const again = await leads.openLead(leadNo);
    const n = await again.qualify(checklistValues());
    note('pop-up', n?.text ?? 'none');
    expect.soft(n?.title, 'Pop-up').toBe(message('Assignee Required Title'));
    expect.soft(n?.text ?? '', 'Pop-up text').toContain(message('Assignee Required Body'));
    expect(await (await leads.openLead(leadNo)).statusChip(), 'Lead not qualified').not.toBe(setting('Status After Qualify'));
  });

  test(...ldp('LDP-046'), async ({ leads }) => {
    const { leadNo, detail } = await freshLead(leads);
    const me = await leads.signedInUser();
    const reason = setting('Reassign Reason');
    const n = await detail.assign(USER(), reason);
    note('pop-up', n?.text ?? 'none');
    const top = (await (await leads.openLead(leadNo)).historyEntries('Owner History'))[0];
    note('owner history', JSON.stringify(top));
    expect(top?.text ?? '', 'Owner History').toBe(`${me} → ${USER()} · ${reason}`);
  });

  test(...ldp('LDP-047'), async ({ leads }) => {
    const { detail } = await workerLead(leads);
    const owner = await detail.owner();
    const disabled = await detail.disabledAssignees();
    note('owner / options that cannot be picked', `${owner} / ${disabled.join(', ')}`);
    expect.soft(await detail.root.innerText(), 'Note under "Assign to"').toContain(message('Current Owner Note'));
    expect(disabled, 'Current owner cannot be picked').toContain(owner);
  });
});

test.describe('Lead Detail · Status and Owner History', () => {
  test.describe.configure({ timeout: 600_000 });

  test(...ldp('LDP-071'), async ({ leads }) => {
    const { leadNo } = await freshLead(leads);
    const me = (await leads.signedInUser()).toUpperCase();
    let prev = '';
    const expected: string[] = [];
    for (const s of statusChanges()) {
      const d = await leads.openLead(leadNo);
      prev = await d.statusChip();
      await d.changeStatus(s.status, s.reason);
      expected.unshift(`${prev} → ${s.status} · ${s.reason}`);
    }
    const q = await leads.openLead(leadNo);
    const n = await q.qualify(checklistValues());
    note('qualify pop-up', n?.text ?? 'none');
    const d = await leads.openLead(leadNo);
    const entries = await d.historyEntries('Status History');
    note('status history', entries.map(e => `${e.when} | ${e.text}`).join('\n'));
    const today = shownDate(new Date()).toUpperCase();
    expect.soft(entries[0]?.text ?? '', 'Newest entry: qualified').toContain(`→ ${setting('Status After Qualify')}`);
    expect.soft(entries[0]?.text ?? '', 'Newest entry: score').toMatch(new RegExp(message('History Qualified', { score: '\\d+' })));
    expect.soft(entries.slice(1, 1 + expected.length).map(e => e.text), 'Status changes, newest first').toEqual(expected);
    expect.soft(entries[entries.length - 1]?.text ?? '', 'Oldest entry').toContain(message('History Created'));
    for (const e of entries) expect.soft(e.when, 'Date and user of each entry').toMatch(new RegExp(`^${today}, \\d{2}:\\d{2} · ${me}$`));
  });

  test(...ldp('LDP-072'), async ({ leads }) => {
    const { leadNo, detail } = await freshLead(leads);
    const me = await leads.signedInUser();
    const user = setting('Assign User');
    await detail.assign(user);
    const entries = await (await leads.openLead(leadNo)).historyEntries('Owner History');
    note('owner history', entries.map(e => `${e.when} | ${e.text}`).join('\n'));
    expect.soft(entries.map(e => e.text), 'Owner History, newest first').toEqual([
      `${me} → ${user} · ${message('Owner Reassigned')}`, `${me} · ${message('Owner Created')}`]);
    const today = shownDate(new Date()).toUpperCase();
    for (const e of entries) expect.soft(e.when, 'Date and user of each entry').toMatch(new RegExp(`^${today}, \\d{2}:\\d{2} · BY ${me.toUpperCase()}$`));
  });
});
