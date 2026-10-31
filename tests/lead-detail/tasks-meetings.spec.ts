/** Tasks & Calls · Add task (LDP-091 … LDP-099) and Add meeting (LDP-101 … LDP-109): the same use cases. */
import { test, expect, note, ldp, ldpRow, freshLead, workerLead } from './shared';
import { message, setting, tasks, TaskRow, formDefaults, daysAhead, shownDate, shownDateTime } from './test-data';
import { ActivityDialog } from '../pages/ActivityDialog';
import { TasksPage } from '../pages/TasksPage';

const who = (v: string, me: string) => (v === setting('Me Suffix') ? me : v);
const id = (base: number, n: number) => `LDP-${String(base + n).padStart(3, '0')}`;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function fillTask(d: ActivityDialog, t: TaskRow) {
  await d.fill('Subject', t.subject);
  await d.setDate('dueAt', daysAhead(t.dueDays, t.dueTime), t.dueTime);
  await d.select('Reminder', t.reminder);
  await d.select('Priority', t.priority);
  await d.select('Assigned to', t.assignedTo);
  await d.fill('Notes', t.notes);
}

function declare(kind: 'Task' | 'Meeting', base: number) {
  const button = kind === 'Task' ? 'Add task' : 'Add meeting';
  const first = () => tasks(kind)[0];

  test.describe(`Lead Detail · ${button}`, () => {
    test.describe.configure({ timeout: 600_000 });

    test(...ldp(id(base, 1)), async ({ leads }) => {
      const { leadNo, detail } = await workerLead(leads);
      const d = await detail.openActivity(button);
      note('form', `${await d.title()} / ${await d.linkedTo()}`);
      expect.soft(await d.title(), 'Form title').toContain(kind);
      expect.soft(await d.linkedTo(), 'Linked to').toContain(message('Linked To', { leadNo }));
      expect.soft(await d.dateValue('dueAt'), 'Due date empty').toBe('');
      for (const [label, def] of formDefaults(kind)) {
        const got = label === 'Subject' ? await d.value(label) : await d.selected(label);
        if (def === '') expect.soft(got, `Default of ${label}`).toBe('');
        else expect.soft(got, `Default of ${label}`).toContain(def);
      }
      await d.cancel();
    });

    test(...ldp(id(base, 2)), async ({ leads }) => {
      const { detail } = await freshLead(leads);
      const d = await detail.openActivity(button);
      expect.soft(await d.save(), 'Form stays open').toBeFalsy();
      const errors = await d.errors();
      note('messages', errors.join(' | '));
      expect.soft(errors, 'Subject message').toContain(message('Subject Required'));
      expect.soft(errors, 'Due date message').toContain(message('Due Required'));
      await d.cancel();
      expect(await detail.activities(), 'Nothing saved').toEqual([]);
    });

    test(...ldp(id(base, 3)), async ({ leads }) => {
      const { detail } = await workerLead(leads);
      const d = await detail.openActivity(button);
      const day = (n: number) => daysAhead(n, '12:00');
      const [past, today, next] = await d.dayStates('dueAt', [day(-1), day(0), day(1)], day(1), first().dueTime);
      note('disabled: yesterday / today / tomorrow', `${past} / ${today} / ${next}`);
      await d.cancel();
      expect.soft(past, 'Yesterday disabled').toBeTruthy();
      expect.soft(today, 'Today can be picked').toBeFalsy();
      expect(next, 'Tomorrow can be picked').toBeFalsy();
    });

    tasks(kind).forEach((t, i) => {
      test(...ldpRow(id(base, 4), i + 1, `${t.reminder} · ${t.priority} · ${t.assignedTo}`, `"${t.subject}" under Open tasks: "Due <date, time>", "Assigned to <user>" and the notes`, `${t.id}: ${t.subject}`), async ({ leads }) => {
        const { detail } = await workerLead(leads);
        const me = await leads.signedInUser();
        const d = await detail.openActivity(button);
        await fillTask(d, t);
        expect(await d.save(), `${kind} saved (${(await d.errors().catch(() => [])).join(', ')})`).toBeTruthy();
        const item = await detail.waitActivity(t.subject, 'open');
        note('shown', JSON.stringify(item));
        expect.soft(item?.list, 'Listed under Open tasks').toBe('open');
        expect.soft(item?.kind.toLowerCase(), 'Kind').toBe(kind.toLowerCase());
        expect.soft(item?.lines ?? [], 'Due').toContain(`Due ${shownDateTime(daysAhead(t.dueDays, t.dueTime))}`);
        expect.soft(item?.lines ?? [], 'Owner').toContain(`Assigned to ${who(t.assignedTo, me)}`);
        expect(item?.notes, 'Notes').toBe(t.notes);
      });
    });

    test(...ldp(id(base, 5)), async ({ leads }) => {
      const { detail } = await freshLead(leads);
      const me = await leads.signedInUser();
      const t = first();
      let d = await detail.openActivity(button);
      await fillTask(d, t);
      expect(await d.save(), `${kind} saved`).toBeTruthy();
      await detail.waitActivity(t.subject, 'open');
      d = (await detail.activityAction(t.subject, 'Edit'))!;
      const due = daysAhead(t.dueDays, t.dueTime);
      note('edit form', await d.title());
      expect.soft(await d.saveLabel(), 'Save button of the edit form').toBe(message('Edit Save Button'));
      expect.soft(await d.value('Subject'), 'Saved subject').toBe(t.subject);
      expect.soft(await d.dateText('dueAt'), 'Saved due date').toBe(shownDateTime(due));
      expect.soft(await d.selected('Reminder'), 'Saved reminder').toBe(t.reminder);
      expect.soft(await d.selected('Priority'), 'Saved priority').toBe(t.priority);
      expect.soft(await d.selected('Assigned to'), 'Saved owner').toContain(t.assignedTo);
      expect.soft(await d.value('Notes'), 'Saved notes').toBe(t.notes);
      await d.fill('Subject', t.editedSubject);
      expect(await d.save(), 'Changes saved').toBeTruthy();
      const item = await detail.waitActivity(t.editedSubject, 'open');
      note('after edit', JSON.stringify(item));
      expect.soft(await detail.waitActivity(t.subject, 'gone'), 'Old subject gone').toBeUndefined();
      expect.soft(item?.lines ?? [], 'Due unchanged').toContain(`Due ${shownDateTime(due)}`);
      expect(item?.lines ?? [], 'Owner unchanged').toContain(`Assigned to ${who(t.assignedTo, me)}`);
    });

    test(...ldp(id(base, 6)), async ({ leads }) => {
      const { detail } = await freshLead(leads);
      const me = await leads.signedInUser();
      const t = first();
      const d = await detail.openActivity(button);
      await fillTask(d, t);
      expect(await d.save(), `${kind} saved`).toBeTruthy();
      await detail.waitActivity(t.subject, 'open');
      await detail.activityAction(t.subject, 'Mark done');
      const done = await detail.waitActivity(t.subject, 'done');
      note('after Mark done', JSON.stringify(done));
      const doneLine = new RegExp('^' + esc(message('Done Line', { date: '§', user: me })).replace('§', `${esc(shownDate(new Date()))}(, \\d{2}:\\d{2})?`) + '$');
      expect.soft(done?.list, 'Moved to Call log & completed').toBe('done');
      expect.soft((done?.lines ?? []).some(l => doneLine.test(l)), `"${message('Done Line', { date: shownDate(new Date()), user: me })}" shown (${done?.lines.join(' | ')})`).toBeTruthy();
      expect.soft(done?.buttons ?? [], 'Reopen offered').toContain('Reopen');
      await detail.activityAction(t.subject, 'Reopen');
      expect((await detail.waitActivity(t.subject, 'open'))?.list, 'Back under Open tasks after Reopen').toBe('open');
    });

    test(...ldp(id(base, 7)), async ({ leads }) => {
      const { lead, leadNo, detail } = await freshLead(leads);
      const me = await leads.signedInUser();
      const t = first();
      const d = await detail.openActivity(button);
      await fillTask(d, t);
      expect(await d.save(), `${kind} saved`).toBeTruthy();
      const tp = new TasksPage(leads.page, setting('Tasks Route'));
      await tp.open();
      await tp.whose(setting('Tasks Whose All'));
      await tp.filter(setting('Tasks Filter Open'));
      await tp.search(t.subject);
      const row = (await tp.rows()).find(r => r.text.includes(leadNo));
      note('row', JSON.stringify(row));
      expect(row, `${kind} listed with the Lead No.`).toBeTruthy();
      expect.soft(row?.['Record'] ?? '', 'Record').toContain(lead.name);
      expect.soft(row?.['Due'] ?? '', 'Due').toContain(shownDateTime(daysAhead(t.dueDays, t.dueTime)));
      expect.soft(row?.['Priority'] ?? '', 'Priority').toContain(t.priority);
      expect.soft(row?.['Assigned to'] ?? '', 'Owner').toBe(who(t.assignedTo, me));
      expect.soft(row?.['Status'] ?? '', 'Status').toBe(setting('Task Status Open'));
      const again = await leads.openLead(leadNo);
      await again.waitActivity(t.subject, 'open');
      await again.activityAction(t.subject, 'Mark done');
      await again.waitActivity(t.subject, 'done');
      await tp.open();
      await tp.whose(setting('Tasks Whose All'));
      await tp.filter(setting('Tasks Filter Completed'));
      await tp.search(t.subject);
      const doneRow = (await tp.rows()).find(r => r.text.includes(leadNo));
      note('completed row', JSON.stringify(doneRow));
      expect(doneRow?.['Status'] ?? '', 'Listed under Completed').toMatch(/^Done\b/);
    });

    test(...ldp(id(base, 8)), async ({ leads }) => {
      const { detail } = await freshLead(leads);
      const t = first();
      let d = await detail.openActivity(button);
      await d.fill('Subject', t.subject);
      await d.cancel();
      d = await detail.openActivity(button);
      await d.fill('Subject', t.editedSubject);
      await d.close();
      expect(await detail.activities(), 'Nothing saved').toEqual([]);
    });

    test(...ldp(id(base, 9)), async ({ leads }) => {
      const { lead, leadNo, detail } = await freshLead(leads);
      const me = await leads.signedInUser();
      const t = first();
      const d = await detail.openActivity(button);
      await fillTask(d, t);
      expect(await d.save(), `${kind} saved`).toBeTruthy();
      const tp = new TasksPage(leads.page, setting('Tasks Route'));
      await tp.open();
      await tp.whose(setting('Tasks Whose All'));
      await tp.search(t.subject);
      const file = await tp.export();
      const related = setting('Related To Pattern').replace('{leadNo}', leadNo);
      const x = file.rows.find(r => String(r['Related To']) === related && String(r['Subject']) === t.subject);
      note('export row', JSON.stringify(x));
      expect(x, `Row with Related To "${related}"`).toBeTruthy();
      expect.soft(String(x?.['Type']).toLowerCase(), 'Type').toBe(kind.toLowerCase());
      expect.soft(String(x?.['Priority']).toLowerCase(), 'Priority').toBe(t.priority.toLowerCase());
      expect.soft(String(x?.['Status']), 'Status').toBe(setting('Export Open Status'));
      expect.soft(String(x?.['Related Name']), 'Related Name').toBe(lead.name);
      expect.soft(String(x?.['Assigned To']), 'Assigned To').toBe(who(t.assignedTo, me));
      expect.soft(String(x?.['Description'] ?? ''), 'Description').toBe(t.notes);
    });
  });
}

declare('Task', 90);
declare('Meeting', 100);
