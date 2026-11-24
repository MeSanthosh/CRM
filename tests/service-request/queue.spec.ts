/** Service Requests workbook — Queue: count, columns, rows, sorting, API match, selection (SR-009 … SR-018). */
import { test, expect, note } from '../pages/fixtures';
import { SR_TEXT, SR_XP } from '../locators';
import { parseOpened } from '../pages/ServiceRequestsPage';
import { sr } from './catalog';
import { isDash } from './shared';

test.describe('Service Requests · Queue', () => {
  test(...sr('SR-009'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const api = srp.lastQueue!;
    note('queue', `Queue (${await srp.queueCount()}), API totalCount ${api.totalCount}`);
    expect(await srp.queueCount()).toBe(api.totalCount);
  });

  test(...sr('SR-010'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const headers = (await srp.x(SR_XP.queueColumns).allInnerTexts()).map(h => h.trim());
    expect(headers).toEqual(SR_TEXT.columns);
  });

  test(...sr('SR-011'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const [count, rows] = [await srp.queueCount(), (await srp.rows()).length];
    note('queue', `Queue (${count}), ${rows} rows listed`);
    expect(rows, `Rows listed = Queue (${count})`).toBe(count);
  });

  test(...sr('SR-012'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const rows = await srp.rows();
    test.skip(!rows.length, 'No service requests in the queue');
    const bad: string[] = [];
    for (const r of rows) {
      if (!/^SR-\d+$/.test(r.requestNo)) bad.push(`request no "${r.requestNo}"`);
      if (!r.subject) bad.push(`${r.requestNo}: no subject`);
      if (!r.customer || isDash(r.customer)) bad.push(`${r.requestNo}: no customer`);
      if (!r.priority) bad.push(`${r.requestNo}: priority blank`);
      if (!r.status || isDash(r.status)) bad.push(`${r.requestNo}: status "${r.status}"`);
      if (isNaN(parseOpened(r.opened).getTime())) bad.push(`${r.requestNo}: opened "${r.opened}"`);
    }
    expect(bad, 'Invalid rows').toEqual([]);
  });

  test(...sr('SR-013'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const nos = (await srp.rows()).map(r => r.requestNo);
    expect(nos.filter((n, i) => nos.indexOf(n) !== i), 'Duplicate request numbers').toEqual([]);
  });

  test(...sr('SR-014'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const rows = await srp.rows();
    test.skip(rows.length < 2, 'Fewer than two tickets');
    const out: string[] = [];
    for (let i = 1; i < rows.length; i++) {
      if (parseOpened(rows[i].opened) > parseOpened(rows[i - 1].opened)) out.push(`${rows[i].requestNo} (${rows[i].opened}) is below ${rows[i - 1].requestNo} (${rows[i - 1].opened})`);
    }
    expect(out, 'Rows out of order (newest first)').toEqual([]);
  });

  test(...sr('SR-015'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const rows = await srp.rows();
    const items = srp.lastQueue!.items;
    expect(rows.length, 'Rows = API items').toBe(items.length);
    const diff: string[] = [];
    items.forEach((it, i) => {
      const r = rows[i];
      const want = { requestNo: it.requestNo, subject: it.subject.trim(), customer: it.customer.name.trim(),
        priority: it.priority?.name ?? '—', status: it.status?.name ?? '—' };
      for (const k of Object.keys(want) as (keyof typeof want)[]) {
        if (r?.[k] !== want[k]) diff.push(`row ${i + 1} ${k}: UI "${r?.[k]}" vs API "${want[k]}"`);
      }
    });
    expect(diff, 'Rows that differ from the API').toEqual([]);
  });

  test(...sr('SR-016'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const [first] = await srp.rows();
    test.skip(!first, 'No service requests in the queue');
    await srp.openTicket(first.requestNo, 'link');
    await expect(srp.detailTitle).toHaveText(`${first.requestNo} — ${first.subject}`);
    await expect.soft(srp.rowLocator.first(), 'Row is highlighted').toHaveClass(/\bis-selected\b/);
  });

  test(...sr('SR-017'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const [first] = await srp.rows();
    test.skip(!first, 'No service requests in the queue');
    await srp.openTicket(first.requestNo, 'row');
    await expect(srp.detailTitle).toHaveText(`${first.requestNo} — ${first.subject}`);
  });

  test(...sr('SR-018'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const rows = await srp.rows();
    test.skip(rows.length < 2, 'Fewer than two tickets');
    await srp.openTicket(rows[0].requestNo);
    await srp.openTicket(rows[1].requestNo);
    await expect(srp.detailTitle).toHaveText(`${rows[1].requestNo} — ${rows[1].subject}`);
    const selected = await srp.rowLocator.evaluateAll(trs => trs.map((tr, i) => (tr.classList.contains('is-selected') ? i : -1)).filter(i => i >= 0));
    expect.soft(selected, 'Only the second row is highlighted').toEqual([1]);
  });
});
