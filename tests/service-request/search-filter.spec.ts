/** Service Requests workbook — Search and Status filter (SR-019 … SR-031). */
import { test, expect, note } from '../pages/fixtures';
import { SR_TEXT } from '../locators';
import type { QueueRow } from '../pages/ServiceRequestsPage';
import { sr } from './catalog';
import { longestWord } from './shared';

/** Rows that do not contain the text in their request no., customer or subject (what the search box promises). */
const notMatching = (rows: QueueRow[], text: string) => {
  const t = text.trim().toLowerCase();
  return rows.filter(r => ![r.requestNo, r.customer, r.subject].some(v => v.toLowerCase().includes(t))).map(r => r.requestNo);
};
const nos = (rows: QueueRow[]) => rows.map(r => r.requestNo);

test.describe('Service Requests · Search', () => {
  test(...sr('SR-019'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const [first] = await srp.rows();
    test.skip(!first, 'No service requests in the queue');
    await srp.search(first.requestNo);
    expect(await srp.queueCount(), 'Queue (1)').toBe(1);
    expect(nos(await srp.rows())).toEqual([first.requestNo]);
  });

  test(...sr('SR-020'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const [first] = await srp.rows();
    test.skip(!first, 'No service requests in the queue');
    const digits = first.requestNo.replace(/\D/g, '');
    const part = digits.slice(Math.max(0, Math.floor(digits.length / 2) - 3)).slice(0, 6);
    note('search', part);
    await srp.search(part);
    const rows = await srp.rows();
    expect.soft(nos(rows), `${first.requestNo} is listed`).toContain(first.requestNo);
    expect.soft(notMatching(rows, part), 'Listed tickets that do not contain the text').toEqual([]);
  });

  test(...sr('SR-021'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const all = await srp.rows();
    test.skip(!all.length, 'No service requests in the queue');
    const customer = all[0].customer;
    const theirs = nos(all.filter(r => r.customer === customer));
    note('search', `${customer} (${theirs.length} tickets in the queue)`);
    await srp.search(customer);
    const rows = await srp.rows();
    expect.soft(theirs.filter(n => !nos(rows).includes(n)), `Tickets of ${customer} missing from the result`).toEqual([]);
    expect.soft(notMatching(rows, customer), 'Listed tickets that do not contain the text').toEqual([]);
  });

  test(...sr('SR-022'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const row = (await srp.rows()).find(r => longestWord(r.subject));
    test.skip(!row, 'No ticket subject with a word of 4+ letters');
    const word = longestWord(row!.subject)!;
    note('search', word);
    await srp.search(word);
    const rows = await srp.rows();
    expect.soft(nos(rows), `${row!.requestNo} is listed`).toContain(row!.requestNo);
    expect.soft(notMatching(rows, word), 'Listed tickets that do not contain the text').toEqual([]);
  });

  test(...sr('SR-023'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const row = (await srp.rows()).find(r => longestWord(r.subject));
    test.skip(!row, 'No ticket subject with a word of 4+ letters');
    const word = longestWord(row!.subject)!;
    await srp.search(word.toLowerCase());
    const lower = nos(await srp.rows());
    await srp.search(word.toUpperCase());
    const upper = nos(await srp.rows());
    expect.soft(lower, `"${word.toLowerCase()}" finds the ticket`).toContain(row!.requestNo);
    expect(upper, `"${word.toUpperCase()}" lists the same tickets`).toEqual(lower);
  });

  test(...sr('SR-024'), async ({ serviceRequests: srp }) => {
    await srp.open();
    await srp.search('zzz-no-such-request-xyz');
    expect(await srp.queueCount()).toBe(0);
    await expect(srp.emptyRow).toHaveText(SR_TEXT.queueEmpty);
  });

  test(...sr('SR-025'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const [count, before] = [await srp.queueCount(), nos(await srp.rows())];
    await srp.search('zzz-no-such-request-xyz');
    await srp.search('');
    expect.soft(await srp.queueCount(), 'Queue count restored').toBe(count);
    expect.soft(nos(await srp.rows()), 'Same rows as before').toEqual(before);
  });

  test(...sr('SR-026'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const [first] = await srp.rows();
    test.skip(!first, 'No service requests in the queue');
    await srp.search(`  ${first.requestNo}  `);
    expect(nos(await srp.rows()), `"  ${first.requestNo}  " finds the ticket`).toEqual([first.requestNo]);
  });
});

test.describe('Service Requests · Status filter', () => {
  test(...sr('SR-027'), async ({ serviceRequests: srp }) => {
    await srp.open();
    await srp.statusOptions(); // waits until the statuses have loaded
    const all = (await srp.statusFilter.locator('option').allInnerTexts()).map(o => o.trim());
    note('statuses', all.join(', '));
    expect.soft(all[0], 'First option').toBe('All statuses');
    expect.soft(await srp.statusFilter.inputValue(), '"All statuses" is selected').toBe('');
    const statuses = all.slice(1);
    for (const s of ['Open', 'In Progress']) expect.soft(statuses, `Includes "${s}"`).toContain(s);
    expect.soft(statuses.filter((s, i) => statuses.indexOf(s) !== i), 'Duplicate statuses').toEqual([]);
    expect.soft(statuses.filter(s => !s), 'Blank statuses').toEqual([]);
  });

  test(...sr('SR-028'), async ({ serviceRequests: srp }) => {
    await srp.open();
    for (const status of await srp.statusOptions()) {
      await srp.filterStatus(status);
      const rows = await srp.rows();
      const count = await srp.queueCount();
      note(status, String(count));
      expect.soft(rows.filter(r => r.status !== status).map(r => `${r.requestNo}: ${r.status}`), `${status}: rows in another status`).toEqual([]);
      expect.soft(rows.length, `${status}: rows = Queue (${count})`).toBe(count);
      if (!count) await expect.soft(srp.emptyRow, `${status}: empty message`).toHaveText(SR_TEXT.queueEmpty);
    }
  });

  test(...sr('SR-029'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const total = await srp.queueCount();
    const counts: Record<string, number> = {};
    for (const status of await srp.statusOptions()) {
      await srp.filterStatus(status);
      counts[status] = await srp.queueCount();
    }
    const sum = Object.values(counts).reduce((a, b) => a + b, 0);
    note('counts', `${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' + ')} = ${sum}; All statuses ${total}`);
    expect(sum, 'Sum of status counts = All statuses').toBe(total);
  });

  test(...sr('SR-030'), async ({ serviceRequests: srp }) => {
    await srp.open();
    await srp.filterStatus('Open');
    const [first] = await srp.rows();
    test.skip(!first, 'No Open tickets');
    await srp.search(first.customer);
    const rows = await srp.rows();
    expect.soft(nos(rows), `${first.requestNo} is listed`).toContain(first.requestNo);
    expect.soft(rows.filter(r => r.status !== 'Open').map(r => r.requestNo), 'Listed tickets not Open').toEqual([]);
    expect.soft(notMatching(rows, first.customer), 'Listed tickets that do not contain the text').toEqual([]);
  });

  test(...sr('SR-031'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const [count, before] = [await srp.queueCount(), nos(await srp.rows())];
    await srp.filterStatus('Open');
    await srp.filterStatus('All statuses');
    expect.soft(await srp.queueCount(), 'Queue count restored').toBe(count);
    expect.soft(nos(await srp.rows()), 'Same rows as before').toEqual(before);
  });
});
