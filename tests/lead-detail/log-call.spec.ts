/** Tasks & Calls · Log call (LDP-081 … LDP-089). */
import { test, expect, note, ldp, ldpRow, freshLead, workerLead } from './shared';
import { message, setting, calls, CallRow, durationInputs, formDefaults, minutesAgo, daysAhead, shownDateTime, shownTime } from './test-data';
import { ActivityDialog } from '../pages/ActivityDialog';
import { TasksPage } from '../pages/TasksPage';

/** "(me)" → the signed-in user's name. */
const who = (v: string, me: string) => (v === setting('Me Suffix') ? me : v);

async function fillCall(d: ActivityDialog, c: CallRow) {
  await d.fill('Subject', c.subject);
  const when = minutesAgo(c.minutesAgo);
  await d.setDate('occurredAt', when, shownTime(when));
  await d.select('Direction', c.direction);
  await d.select('Outcome', c.outcome);
  await d.fill('Duration (minutes)', c.duration);
  await d.select('Priority', c.priority);
  await d.select('Logged for', c.loggedFor);
  await d.fill('Call notes', c.notes);
  if (c.followUp) {
    await d.tick('Schedule a follow-up task');
    await d.setDate('followUpDueAt', daysAhead(c.followUpDays, c.followUpTime), c.followUpTime);
  }
  return when;
}

test.describe('Lead Detail · Log call', () => {
  test.describe.configure({ timeout: 600_000 });

  test(...ldp('LDP-081'), async ({ leads }) => {
    const { leadNo, detail } = await workerLead(leads);
    const d = await detail.openActivity('Log call');
    note('linked to', await d.linkedTo());
    expect.soft(await d.linkedTo(), 'Linked to').toContain(message('Linked To', { leadNo }));
    for (const [label, def] of formDefaults('Log call')) {
      const got = label === 'Subject' ? await d.value(label) : await d.selected(label);
      expect.soft(got, `Default of ${label}`).toContain(def);
    }
    const stored = new Date(await d.dateValue('occurredAt'));
    expect.soft(Math.abs(Date.now() - stored.getTime()), 'Call time defaults to now (within 5 minutes)').toBeLessThan(5 * 60_000);
    expect.soft(await d.field('Schedule a follow-up task').locator('input').isChecked(), 'Follow-up unticked').toBeFalsy();
    await d.cancel();
  });

  test(...ldp('LDP-082'), async ({ leads }) => {
    const { detail } = await freshLead(leads);
    const d = await detail.openActivity('Log call');
    await d.fill('Subject', '');
    expect.soft(await d.save(), 'Form stays open').toBeFalsy();
    expect.soft(await d.errors(), 'Messages').toContain(message('Subject Required'));
    await d.cancel();
    expect(await detail.activities(), 'Nothing logged').toEqual([]);
  });

  test(...ldp('LDP-083'), async ({ leads }) => {
    const { detail } = await freshLead(leads);
    const d = await detail.openActivity('Log call');
    await d.fill('Subject', calls()[0].subject);
    await d.setDate('occurredAt', daysAhead(3, '11:00'), '11:00');
    expect.soft(await d.save(), 'Form stays open').toBeFalsy();
    expect.soft(await d.errors(), 'Messages').toContain(message('Call Future'));
    await d.cancel();
    expect(await detail.activities(), 'Nothing logged').toEqual([]);
  });

  durationInputs().forEach((x, i) => {
    test(...ldpRow('LDP-084', i + 1, `"${x.typed}"`, `Duration field holds ${x.expected.startsWith('not ') ? `anything but "${x.expected.slice(4)}"` : `"${x.expected}"`} (${x.why})`, `Typed: ${x.typed}`), async ({ leads }) => {
      const { detail } = await workerLead(leads);
      const d = await detail.openActivity('Log call');
      const got = await d.type('Duration (minutes)', x.typed);
      note('field holds', `"${got}"`);
      await d.cancel();
      if (x.expected.startsWith('not ')) expect(got, `"${x.typed}" must not become "${x.expected.slice(4)}"`).not.toBe(x.expected.slice(4));
      else expect(got, `"${x.typed}" becomes`).toBe(x.expected);
    });
  });

  test(...ldp('LDP-085'), async ({ leads }) => {
    const { detail } = await workerLead(leads);
    const d = await detail.openActivity('Log call');
    expect.soft(await d.hasDateField('followUpDueAt'), 'No follow-up date while unticked').toBeFalsy();
    await d.tick('Schedule a follow-up task');
    expect.soft(await d.hasDateField('followUpDueAt'), 'Follow-up date shown when ticked').toBeTruthy();
    expect.soft(await d.save(), 'Form stays open without a follow-up date').toBeFalsy();
    expect.soft(await d.errors(), 'Messages').toContain(message('Follow-up Required'));
    await d.tick('Schedule a follow-up task', false);
    expect(await d.hasDateField('followUpDueAt'), 'Follow-up date hidden when unticked').toBeFalsy();
    await d.cancel();
  });

  calls().forEach((c, i) => {
    test(...ldpRow('LDP-086', i + 1, `${c.direction} · ${c.outcome} · ${c.priority}`, `"${c.subject}" in Call log & completed with "${c.direction} · ${c.outcome} · ${c.duration} min", time, user and notes; on the Tasks & Calendar Call log with the Lead No.`, `${c.id}: ${c.subject}`), async ({ leads }) => {
      const { lead, leadNo, detail } = await workerLead(leads);
      const me = await leads.signedInUser();
      const d = await detail.openActivity('Log call');
      const when = await fillCall(d, c);
      expect(await d.save(), `Call saved (${(await d.errors().catch(() => [])).join(', ')})`).toBeTruthy();
      const item = await detail.waitActivity(c.subject, 'done');
      note('call shown', JSON.stringify(item));
      expect.soft(item?.list, 'Listed under Call log & completed').toBe('done');
      expect.soft(item?.lines[0], 'Direction · outcome · duration').toBe(`${c.direction} · ${c.outcome} · ${c.duration} min`);
      expect.soft(item?.lines[1], 'Time and user').toBe(`${shownDateTime(when)} · ${who(c.loggedFor, me)}`);
      expect.soft(item?.notes, 'Notes').toBe(c.notes);
      const tp = new TasksPage(leads.page, setting('Tasks Route'));
      await tp.open();
      await tp.view('Call log');
      await tp.whose(setting('Tasks Whose All'));
      const rows = await tp.findOnPages(r => r.text.includes(c.subject) && r.text.includes(leadNo)); // 20 calls per page
      note('call log rows', rows.map(r => r.text).join(' | '));
      expect(rows.length, 'On the Tasks & Calendar Call log with the Lead No.').toBeGreaterThan(0);
      expect.soft(rows[0]?.text ?? '', 'Record shows the lead name').toContain(lead.name);
    });
  });

  calls().filter(c => c.followUp).forEach((c, i) => {
    test(...ldpRow('LDP-087', i + 1, c.subject, `Open task "${message('Follow-up Subject', { subject: c.subject })}" due ${c.followUpDays} day(s) later at ${c.followUpTime}, notes "${message('Follow-up Notes', { outcome: c.outcome })}"`, `${c.id}: follow-up in ${c.followUpDays} day(s) at ${c.followUpTime}`), async ({ leads }) => {
      const { detail } = await freshLead(leads);
      const d = await detail.openActivity('Log call');
      await fillCall(d, c);
      expect(await d.save(), 'Call saved').toBeTruthy();
      const task = await detail.waitActivity(message('Follow-up Subject', { subject: c.subject }), 'open');
      note('follow-up task', JSON.stringify(task));
      expect.soft(task?.list, 'Listed under Open tasks').toBe('open');
      expect.soft(task?.lines ?? [], 'Due date').toContain(`Due ${shownDateTime(daysAhead(c.followUpDays, c.followUpTime))}`);
      expect(task?.notes, 'Notes').toBe(message('Follow-up Notes', { outcome: c.outcome }));
    });
  });

  test(...ldp('LDP-088'), async ({ leads }) => {
    const { detail } = await freshLead(leads);
    const c = calls()[0];
    let d = await detail.openActivity('Log call');
    await d.fill('Subject', c.subject);
    await d.cancel();
    d = await detail.openActivity('Log call');
    await d.fill('Subject', c.editedSubject);
    await d.close();
    expect(await detail.activities(), 'Nothing logged').toEqual([]);
  });

  test(...ldp('LDP-089'), async ({ leads }) => {
    const { detail } = await freshLead(leads);
    const me = await leads.signedInUser();
    const c = calls()[0];
    let d = await detail.openActivity('Log call');
    const when = await fillCall(d, c);
    expect(await d.save(), 'Call saved').toBeTruthy();
    await detail.waitActivity(c.subject, 'done');
    d = (await detail.activityAction(c.subject, 'Edit'))!;
    note('edit form', `${await d.title()} / ${await d.saveLabel()}`);
    expect.soft(await d.saveLabel(), 'Save button of the edit form').toBe(message('Edit Save Button'));
    expect.soft(await d.value('Subject'), 'Saved subject').toBe(c.subject);
    expect.soft(await d.selected('Outcome'), 'Saved outcome').toBe(c.outcome);
    expect.soft(await d.value('Duration (minutes)'), 'Saved duration').toBe(c.duration);
    expect.soft(await d.value('Call notes'), 'Saved notes').toBe(c.notes);
    await d.fill('Subject', c.editedSubject);
    await d.fill('Call notes', c.editedNotes);
    expect(await d.save(), 'Changes saved').toBeTruthy();
    const item = await detail.waitActivity(c.editedSubject, 'done');
    note('after edit', JSON.stringify(item));
    expect.soft(await detail.waitActivity(c.subject, 'gone'), 'Old subject gone').toBeUndefined();
    expect.soft(item?.notes, 'New notes').toBe(c.editedNotes);
    expect.soft(item?.lines[0], 'Direction · outcome · duration unchanged').toBe(`${c.direction} · ${c.outcome} · ${c.duration} min`);
    expect(item?.lines[1], 'Time and user unchanged').toBe(`${shownDateTime(when)} · ${who(c.loggedFor, me)}`);
  });
});
