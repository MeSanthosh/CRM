/** Service Requests workbook — Ticket detail of an existing ticket, read only (SR-052 … SR-059). */
import { test as base, expect, note } from '../pages/fixtures';
import { SR_XP } from '../locators';
import { parseOpened, type QueueRow } from '../pages/ServiceRequestsPage';
import { sr } from './catalog';

/** Every test opens the first ticket of the queue (auto fixture); `ticket` is its queue row. */
const test = base.extend<{ ticket: QueueRow }>({
  ticket: [async ({ serviceRequests: srp }, use) => {
    await srp.open();
    const [row] = await srp.rows();
    base.skip(!row, 'No service requests in the queue');
    await srp.openTicket(row.requestNo);
    note('ticket', row.requestNo);
    await use(row);
  }, { auto: true }],
});

const dateOf = (meta: string) => parseOpened(meta.split(' · ')[0]);

test.describe('Service Requests · Ticket detail', () => {
  test(...sr('SR-052'), async ({ serviceRequests: srp, ticket }) => {
    await expect(srp.detailTitle).toHaveText(`${ticket.requestNo} — ${ticket.subject}`);
    await expect.soft(srp.detailSubtitle, 'Customer line').toHaveText(new RegExp(`^${ticket.customer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( · .+)?$`));
    await expect.soft(srp.detailDescription, 'Description').toBeVisible();
    expect.soft((await srp.detailDescription.innerText()).trim(), 'Description not blank').not.toBe('');
  });

  test(...sr('SR-053'), async ({ serviceRequests: srp, ticket }) => {
    expect.soft(await srp.selected('Status'), 'Status').toBe(ticket.status);
    expect.soft(await srp.selected('Priority'), 'Priority').toBe(ticket.priority);
  });

  test(...sr('SR-054'), async ({ serviceRequests: srp }) => {
    expect(await srp.options('Status')).toEqual(await srp.statusOptions());
  });

  test(...sr('SR-055'), async ({ serviceRequests: srp }) => {
    const options = await srp.options('Assigned to');
    note('assignees', options.join(', '));
    expect.soft(options[0], 'First option').toBe('Unassigned');
    expect.soft(options.length, 'At least one staff user').toBeGreaterThan(1);
    expect.soft(options.filter(o => !o), 'Blank names').toEqual([]);
  });

  test(...sr('SR-056'), async ({ serviceRequests: srp }) => {
    const entries = await srp.timeline();
    note('timeline', entries.map(e => `${e.status} (${e.meta})`).join(' → '));
    expect(entries.length, 'At least one entry').toBeGreaterThan(0);
    const bad = entries.filter(e => !e.status || isNaN(dateOf(e.meta).getTime()) || !/ · \S/.test(e.meta));
    expect.soft(bad.map(e => `${e.status}: "${e.meta}"`), 'Entries without status, date or user').toEqual([]);
    const backwards = entries.slice(1).filter((e, i) => dateOf(e.meta) < dateOf(entries[i].meta));
    expect.soft(backwards.map(e => e.status), 'Entries dated before the previous one').toEqual([]);
    expect.soft(entries.at(-1)!.status, 'Last entry = current Status').toBe(await srp.selected('Status'));
  });

  test(...sr('SR-057'), async ({ serviceRequests: srp }) => {
    const history = srp.x(SR_XP.history);
    await expect(history.locator('h4')).toHaveText('History');
    await srp.refreshHistory();
    await expect.soft(history.locator('.crm-field-error'), 'No load error').toHaveCount(0);
    const entries = await srp.historyEntries();
    if (!entries.length) await expect(history).toContainText('No changes recorded yet');
    expect.soft(entries.filter(e => !/\d{4}, \d{1,2}:\d{2}/.test(e)), 'Entries without date/time').toEqual([]);
  });

  test(...sr('SR-058'), async ({ serviceRequests: srp }) => {
    const comments = await srp.comments();
    note('comments', String(comments.length));
    if (!comments.length) return expect(srp.x(SR_XP.conversation)).toContainText('No comments yet.');
    const bad = comments.filter(c => !/^(Customer|Staff)( · .+)?$/.test(c.author) || isNaN(parseOpened(c.time).getTime()) || !c.body);
    expect(bad, 'Comments without author, date/time or text').toEqual([]);
  });

  test(...sr('SR-059'), async ({ serviceRequests: srp }) => {
    await expect.soft(srp.x(SR_XP.addFile), '"Add File"').toBeVisible();
    const files = await srp.attachments();
    note('attachments', String(files.length));
    if (!files.length) return expect(srp.x(SR_XP.attachments)).toContainText('No attachments.');
    expect(files.filter(f => !f.name || !f.href), 'Attachments without name or link').toEqual([]);
  });
});
