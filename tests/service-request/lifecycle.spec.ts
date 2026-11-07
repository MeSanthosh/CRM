/**
 * Service Requests workbook — one ticket from creation to attachments (SR-046 … SR-051, SR-060 … SR-070).
 *
 * WRITES TO THE QA DATABASE: SR-046 creates ONE ticket per run (subject "[AUTO] Service request test <timestamp>")
 * and the later tests change, reply to and attach a file to that ticket only. Set SKIP_SR_WRITE_TESTS=true in .env
 * to skip them all.
 *
 * The tests run in order in one worker. The ticket is shared through a file in test-results (cleared at the start of
 * every run), not a variable: a failing test restarts the worker, and the tests after it must still find the ticket.
 * So a defect in one step is reported without skipping the rest.
 */
import fs from 'fs';
import path from 'path';
import { test, expect, note } from '../pages/fixtures';
import { SR_TEXT, SR_XP } from '../locators';
import { parseOpened, type ServiceRequestsPage } from '../pages/ServiceRequestsPage';
import { sr } from './catalog';
import { writesAllowed } from './shared';

/** The ticket created by SR-046, what was typed, and the values last saved on it. */
type Ticket = {
  requestNo: string; customer: string; status: string; priority: string; type: string;
  stamp: string; typedSubject: string; typedDescription: string;
};

const stateFile = () => path.join(test.info().project.outputDir, 'sr-lifecycle-ticket.json');
const save = (t: Ticket) => {
  fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
  fs.writeFileSync(stateFile(), JSON.stringify(t, null, 2));
};
const load = (): Ticket | undefined => {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return undefined; }
};

/** The ticket of this run; skips the test when SR-046 did not create one. */
function ticket(): Ticket {
  const t = load();
  test.skip(!t, 'SR-046 did not create a ticket in this run');
  return t!;
}

async function openTicket(srp: ServiceRequestsPage): Promise<Ticket> {
  const t = ticket();
  await srp.reopen(t.requestNo);
  return t;
}

const attachment = (t: Ticket) => ({ name: 'sr-auto-attachment.txt', content: `Service request attachment uploaded by the Playwright suite (${t.stamp}).` });
const replyText = (t: Ticket, n: number) => `Automated reply ${t.stamp} (${n})`;
/** The app shows times in the company time zone, which can be a different calendar day from this PC: accept ±1 day. */
const recent = (d: Date) => Math.abs(d.getTime() - Date.now()) < 26 * 3600_000;

test.describe('Service Requests · Ticket lifecycle (creates QA data)', () => {
  test.describe.configure({ mode: 'default' }); // in order, one worker; a failure does not skip the rest
  test.skip(!writesAllowed, 'SKIP_SR_WRITE_TESTS=true');

  test(...sr('SR-046'), async ({ serviceRequests: srp }) => {
    if (fs.existsSync(stateFile())) fs.rmSync(stateFile());
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const typedSubject = `  [AUTO] Service request test ${stamp}  `;
    const typedDescription = '  Automated test ticket created by the Playwright suite. Please ignore.  ';

    await srp.open();
    const before = await srp.queueCount();
    await srp.openForm();
    const customer = await srp.testCustomer();
    const types = (await srp.options('Type')).slice(1);
    const type = types.find(t => t !== 'General') ?? types[0];
    const priorities = (await srp.options('Priority')).slice(1);
    const priority = priorities.includes('24 hours') ? '24 hours' : priorities.find(p => p !== '48 hours') ?? priorities[0];

    const created = await srp.create({ customer, type, priority, subject: typedSubject, description: typedDescription });
    note('ticket', `${created.requestNo} · ${customer} · ${type} · ${priority}`);
    save({ requestNo: created.requestNo, customer: customer.replace(/ \([^()]*\)$/, ''), status: 'Open', priority, type, stamp, typedSubject, typedDescription });

    await expect.soft(srp.successBanner, 'Banner').toHaveText(SR_TEXT.created(created.requestNo));
    await expect(srp.detailTitle, 'New ticket opens').toHaveText(new RegExp(`^${created.requestNo} — `));
    await expect.soft(srp.queueHeading, 'Queue count + 1').toHaveText(`Queue (${before + 1})`);
    await expect.poll(async () => (await srp.rows())[0]?.requestNo, { message: 'New ticket is the first row' }).toBe(created.requestNo);
    expect.soft((await srp.rows())[0].status, 'Status Open').toBe('Open');
  });

  test(...sr('SR-047'), async ({ serviceRequests: srp }) => {
    const t = await openTicket(srp);
    await expect.soft(srp.detailTitle, 'Heading').toHaveText(`${t.requestNo} — ${t.typedSubject.trim()}`);
    await expect.soft(srp.detailSubtitle, 'Customer').toContainText(t.customer);
    await expect.soft(srp.detailDescription, 'Description').toHaveText(t.typedDescription.trim());
    expect.soft(await srp.selected('Status'), 'Status').toBe('Open');
    expect.soft(await srp.selected('Priority'), 'Priority').toBe(t.priority);
    expect.soft(await srp.selected('Type'), 'Type').toBe(t.type);
    expect.soft(await srp.selected('Assigned to'), 'Assigned to').toBe('Unassigned');
  });

  test(...sr('SR-048'), async ({ serviceRequests: srp }) => {
    await openTicket(srp);
    const entries = await srp.timeline();
    note('timeline', entries.map(e => `${e.status} (${e.meta})`).join(' → '));
    expect(entries.map(e => e.status), 'One entry "Open"').toEqual(['Open']);
    const [date, user] = entries[0].meta.split(' · ');
    expect.soft(recent(parseOpened(date)), `Dated now (${date})`).toBeTruthy();
    expect.soft(user?.trim(), 'Created by').toBeTruthy();
  });

  test(...sr('SR-049'), async ({ serviceRequests: srp }) => {
    await openTicket(srp);
    await srp.refreshHistory();
    const entries = await srp.historyEntries();
    note('history', entries.join(' | '));
    const created = entries.at(-1) ?? ''; // newest first: the creation is the last entry
    expect.soft(created, 'Creation entry').toMatch(/^Created\b/);
    expect.soft(recent(parseOpened(created.match(/(\d{1,2} \w+ \d{4}, \d{1,2}:\d{2})/)?.[1] ?? '')), `Dated now (${created})`).toBeTruthy();
  });

  test(...sr('SR-050'), async ({ serviceRequests: srp }) => {
    const t = ticket();
    await srp.open();
    await srp.search(t.requestNo);
    expect.soft((await srp.rows()).map(r => r.requestNo), 'Found by number').toEqual([t.requestNo]);
    await srp.search(t.typedSubject.trim());
    expect.soft((await srp.rows()).map(r => r.requestNo), 'Found by subject').toContain(t.requestNo);
  });

  test(...sr('SR-051'), async ({ serviceRequests: srp }) => {
    const t = await openTicket(srp);
    expect.soft((await srp.row(t.requestNo))?.subject, 'Subject in the queue').toBe(t.typedSubject.trim());
    await expect.soft(srp.detailTitle, 'Subject in the heading').toHaveText(`${t.requestNo} — ${t.typedSubject.trim()}`);
    expect.soft(await srp.detailDescription.evaluate(e => e.textContent), 'Description').toBe(t.typedDescription.trim());
  });

  test(...sr('SR-060'), async ({ serviceRequests: srp }) => {
    const t = await openTicket(srp);
    const statuses = await srp.options('Status');
    const target = statuses.includes('In Progress') ? 'In Progress' : statuses.find(s => s !== t.status)!;
    const from = t.status;
    await srp.setField('Status', target);
    save({ ...t, status: target });
    await expect.poll(async () => (await srp.row(t.requestNo))?.status, { message: 'Queue row status' }).toBe(target);
    await expect.poll(async () => (await srp.timeline()).at(-1)?.status, { message: 'Timeline last entry' }).toBe(target);
    await srp.refreshHistory();
    const entries = await srp.historyEntries();
    note('history', entries.join(' | '));
    expect.soft(entries.some(e => new RegExp(`Status:?\\s*${from}\\s*(→\\s*)?(changed to\\s*)?${target}`).test(e)), `History has "Status: ${from} → ${target}"`).toBeTruthy();
  });

  test(...sr('SR-061'), async ({ serviceRequests: srp }) => {
    const t = await openTicket(srp);
    const target = (await srp.options('Priority')).slice(1).find(p => p !== t.priority);
    test.skip(!target, 'Only one priority exists');
    await srp.setField('Priority', target!);
    save({ ...t, priority: target! });
    await expect.poll(async () => (await srp.row(t.requestNo))?.priority, { message: 'Queue row priority' }).toBe(target);
    await srp.refreshHistory();
    const entries = await srp.historyEntries();
    note('history', entries.join(' | '));
    expect.soft(entries.some(e => e.includes(target!)), `History mentions "${target}"`).toBeTruthy();
  });

  test(...sr('SR-062'), async ({ serviceRequests: srp }) => {
    const t = await openTicket(srp);
    const target = (await srp.options('Type')).slice(1).find(x => x !== t.type);
    test.skip(!target, 'Only one type exists');
    await srp.setField('Type', target!);
    save({ ...t, type: target! });
    await srp.reopen(t.requestNo);
    expect(await srp.selected('Type'), 'Type after reload').toBe(target);
  });

  test(...sr('SR-063'), async ({ serviceRequests: srp }) => {
    const t = await openTicket(srp);
    const staff = (await srp.options('Assigned to')).slice(1)[0];
    test.skip(!staff, 'No staff user to assign');
    note('assignee', staff);
    await srp.setField('Assigned to', staff);
    await srp.reopen(t.requestNo);
    expect.soft(await srp.selected('Assigned to'), 'Assigned after reload').toBe(staff);
    await srp.setField('Assigned to', 'Unassigned');
    await srp.reopen(t.requestNo);
    expect(await srp.selected('Assigned to'), 'Unassigned after reload').toBe('Unassigned');
  });

  test(...sr('SR-064'), async ({ serviceRequests: srp }) => {
    const t = await openTicket(srp);
    expect.soft(await srp.selected('Status'), 'Status').toBe(t.status);
    expect.soft(await srp.selected('Priority'), 'Priority').toBe(t.priority);
    expect.soft(await srp.selected('Type'), 'Type').toBe(t.type);
  });

  test(...sr('SR-065'), async ({ serviceRequests: srp }) => {
    const t = ticket();
    test.skip(t.status === 'Open', 'SR-060 did not change the status');
    await srp.open();
    await srp.search(t.requestNo);
    await srp.filterStatus(t.status);
    expect.soft((await srp.rows()).map(r => r.requestNo), `Listed under "${t.status}"`).toEqual([t.requestNo]);
    await srp.filterStatus('Open');
    expect.soft((await srp.rows()).map(r => r.requestNo), 'Not listed under "Open"').toEqual([]);
  });

  test(...sr('SR-066'), async ({ serviceRequests: srp }) => {
    await openTicket(srp);
    await expect.soft(srp.postReplyButton, 'Empty: disabled').toBeDisabled();
    await srp.replyBox.fill('   ');
    await expect.soft(srp.postReplyButton, 'Spaces only: disabled').toBeDisabled();
    await srp.replyBox.fill('x');
    await expect.soft(srp.postReplyButton, 'Text: enabled').toBeEnabled();
    await srp.replyBox.fill('');
  });

  test(...sr('SR-067'), async ({ serviceRequests: srp }) => {
    const t = await openTicket(srp);
    const text = replyText(t, 1);
    await srp.reply(text);
    await expect.soft(srp.replyBox, 'Reply box cleared').toHaveValue('');
    await expect.poll(async () => (await srp.comments()).at(-1)?.body, { message: 'New comment' }).toBe(text);
    const last = (await srp.comments()).at(-1)!;
    note('comment', `${last.author} · ${last.time}`);
    expect.soft(last.staff, 'Shown as a staff comment').toBeTruthy();
    expect.soft(last.author, 'Author "Staff · <user>"').toMatch(/^Staff( · .+)?$/);
    expect.soft(recent(parseOpened(last.time)), `Dated now (${last.time})`).toBeTruthy();
    await expect.soft(srp.x(SR_XP.conversation), '"No comments yet." gone').not.toContainText('No comments yet.');
  });

  test(...sr('SR-068'), async ({ serviceRequests: srp }) => {
    const t = await openTicket(srp);
    const [first, second] = [replyText(t, 1), replyText(t, 2)];
    await srp.reply(second);
    await srp.reopen(t.requestNo);
    const bodies = (await srp.comments()).map(c => c.body);
    note('comments', bodies.join(' | '));
    expect.soft(bodies, 'First reply kept').toContain(first);
    expect.soft(bodies, 'Second reply kept').toContain(second);
    expect(bodies.indexOf(first), 'Oldest first').toBeLessThan(bodies.indexOf(second));
  });

  test(...sr('SR-069'), async ({ serviceRequests: srp }) => {
    const t = await openTicket(srp);
    const file = attachment(t);
    const resp = await srp.upload(file.name, file.content);
    const body = resp.ok() ? '' : await resp.text().catch(() => '');
    expect(resp.ok(), `Upload → HTTP ${resp.status()} ${body.slice(0, 200)}`).toBeTruthy();
    await expect.soft(srp.successBanner, 'Banner').toHaveText(SR_TEXT.attachmentUploaded);
    await expect.poll(async () => (await srp.attachments()).map(a => a.name), { message: 'File listed' }).toContain(file.name);
    await expect.soft(srp.x(SR_XP.attachments), '"No attachments." gone').not.toContainText('No attachments.');
  });

  test(...sr('SR-070'), async ({ serviceRequests: srp }) => {
    const t = await openTicket(srp);
    const expected = attachment(t);
    const file = (await srp.attachments()).find(a => a.name === expected.name);
    test.skip(!file, 'SR-069 did not upload the file');
    expect.soft(file!.target, 'Opens in a new tab').toBe('_blank');
    const resp = await srp.page.request.get(file!.href);
    expect(resp.status(), 'Download HTTP status').toBe(200);
    expect.soft(await resp.text(), 'Downloaded content').toBe(expected.content);
  });
});
