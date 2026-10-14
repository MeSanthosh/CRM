/** Lead Reports workbook — Aging & Follow-up (LR-103…116). Every figure is "as of today" and compared with the page's own totals. */
import { test, expect, note } from '../pages/fixtures';
import { num, sum } from '../helpers';
import { XP, at } from '../locators';
import { AGING_LINK_COLUMNS, CLOSED_STATUSES } from '../pages/LeadReportsPage';
import { lr } from './catalog';
import { rowsWithData, labelOf } from './shared';

const CARDS = ['Open Leads', 'Idle Over 30 Days', 'Never Contacted', 'Overdue Follow-ups'];

test.describe('Lead Reports · Aging & Follow-up', () => {
  test(...lr('LR-103'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const open = await leadReports.kpi('Open Leads Now');
    const links = await leadReports.cardLinks('Open Leads Now').allInnerTexts();
    await leadReports.openTab('Aging & Follow-up');
    for (const c of CARDS) await expect.soft(leadReports.card(c), c).toBeVisible();
    const aging = await leadReports.kpis(CARDS);
    note('values', `Overview Open Leads Now ${open} (${links.join(', ')}) | Aging ${JSON.stringify(aging)}`);
    expect.soft(aging['Open Leads'], 'Open Leads = Overview Open Leads Now').toBe(open);
    expect.soft(aging['Idle Over 30 Days'], 'Idle Over 30 Days = Overview "idle over 30 days"').toBe(num(links[1]));
    expect.soft(aging['Never Contacted'], 'Never Contacted = Overview "never contacted"').toBe(num(links[2]));
  });

  for (const [id, card, title] of [['LR-104', 'Open Leads', /Open leads/i], ['LR-105', 'Idle Over 30 Days', /idle over 30 days/i], ['LR-106', 'Never Contacted', /never contacted/i]] as const) {
    test(...lr(id), async ({ leadReports }) => {
      await leadReports.openAt('aging');
      const { drill } = await leadReports.drill.verify(leadReports.cardLinks(card).first());
      expect.soft(drill.title).toMatch(title);
      expect.soft(drill.asOfToday, 'Marked "as of today"').toBeTruthy();
    });
  }

  test(...lr('LR-107'), async ({ leadReports }) => {
    await leadReports.openAt('aging');
    const overdue = await leadReports.kpi('Overdue Follow-ups');
    note('value', `Overdue Follow-ups ${overdue}`);
    expect.soft(overdue).toBeGreaterThanOrEqual(0);
    if (overdue > 0) await leadReports.drill.verify(leadReports.cardLinks('Overdue Follow-ups').first(), { expected: overdue });
    else await expect(leadReports.cardLinks('Overdue Follow-ups'), 'Not a link at 0').toHaveCount(0);
  });

  test(...lr('LR-108'), async ({ leadReports }) => {
    await leadReports.openAt('aging', 'last_12_months');
    const a = await leadReports.kpis(CARDS);
    await leadReports.setPeriod('this_month');
    const b = await leadReports.kpis(CARDS);
    expect(b, 'Same values for This month and Last 12 months').toEqual(a);
  });

  for (const [id, panel] of [['LR-109', 'Idle Time'], ['LR-110', 'Lead Age']] as const) {
    test(...lr(id), async ({ leadReports }) => {
      await leadReports.openAt('aging');
      const buckets = await leadReports.buckets(panel);
      note('buckets', buckets.map(b => `${b.label} ${b.count}`).join(' | '));
      expect.soft(buckets.map(b => b.label)).toEqual(['0–7 days', '8–14 days', '15–30 days', '31–60 days', '61–90 days', 'Over 90 days']);
      expect(sum(buckets.map(b => b.count)), `${panel} buckets add up to Open Leads`).toBe(await leadReports.kpi('Open Leads'));
      await expect.soft(leadReports.panel(panel).locator('button, a'), 'Buckets are not links').toHaveCount(0);
    });
  }

  test(...lr('LR-111'), async ({ leadReports }) => {
    await leadReports.openAt('aging');
    const t = leadReports.agingBySalesperson;
    const rows = await t.rows();
    expect.soft(await t.sum('Open'), 'Open column = Open Leads').toBe(await leadReports.kpi('Open Leads'));
    expect.soft(await t.sum('Never Contacted'), 'Never Contacted column = card').toBe(await leadReports.kpi('Never Contacted'));
    expect.soft(await t.sum('Overdue Follow-ups'), 'Overdue column = card').toBe(await leadReports.kpi('Overdue Follow-ups'));
    for (const b of await leadReports.buckets('Idle Time')) {
      expect.soft(await t.sum(`Idle ${b.label}`), `"Idle ${b.label}" column = Idle Time bucket`).toBe(b.count);
    }
    note('salespeople', rows.map(r => `${labelOf(r)} ${r['Open']}`).join(' | '));
  });

  test(...lr('LR-112'), async ({ leadReports }) => {
    test.setTimeout(240_000);
    await leadReports.openAt('aging');
    const t = leadReports.agingBySalesperson;
    const headers = await t.headers();
    const rows = await t.rows();
    for (const col of AGING_LINK_COLUMNS) {
      for (const r of rowsWithData(rows, col)) {
        await leadReports.drill.verify(t.link(r, col, headers), { rowLabel: labelOf(r), withExport: false });
      }
    }
    for (const col of headers.filter(h => !AGING_LINK_COLUMNS.includes(h) && h !== 'Salesperson')) {
      const r = rowsWithData(rows, col)[0];
      if (r) await expect.soft(t.link(r, col, headers), `${col} is not a link`).toHaveCount(0);
    }
  });

  test(...lr('LR-113'), async ({ leadReports }) => {
    await leadReports.openAt('aging');
    const rows = await leadReports.agingBySalesperson.rows();
    const sheet = await leadReports.agingBySalesperson.export();
    expect.soft(sheet.name).toMatch(/^lead-report-aging-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect.soft(sheet.rows.length, 'Same rows').toBe(rows.length);
    const byName = Object.fromEntries(sheet.rows.map(r => [String(r['Salesperson']), r]));
    for (const r of rows) expect.soft(Number(byName[labelOf(r)]?.['Open Leads']), `${labelOf(r)} Open`).toBe(num(r['Open']));
  });

  test(...lr('LR-114'), async ({ leadReports }) => {
    await leadReports.openAt('aging');
    const rows = await leadReports.agingByStatus.rows();
    expect.soft(sum(rows.map(r => num(r['Open']))), 'Open column = Open Leads').toBe(await leadReports.kpi('Open Leads'));
    expect.soft(rows.map(labelOf).filter(s => CLOSED_STATUSES.includes(s)), 'Only open statuses').toEqual([]);
    for (const r of rows) expect.soft(r['Avg Idle'], `${labelOf(r)} Avg Idle in days`).toMatch(/^[\d.]+ d$/);
  });

  test(...lr('LR-115'), async ({ leadReports }) => {
    await leadReports.openAt('aging');
    const rows = await leadReports.longestIdle.rows();
    expect.soft(rows.length, 'At most 25 leads').toBeLessThanOrEqual(25);
    expect.soft(rows.length, 'Lists 25, or every open lead when fewer').toBe(Math.min(25, await leadReports.kpi('Open Leads')));
    expect.soft(await leadReports.longestIdle.headers()).toEqual(['Lead', 'Salesperson', 'Status', 'Idle', 'Captured']);
    const idle = rows.map(r => num(r['Idle']));
    expect.soft(idle, 'Sorted by Idle, longest first').toEqual([...idle].sort((a, b) => b - a));
    expect.soft(rows.filter(r => CLOSED_STATUSES.includes(r['Status'])).map(labelOf), 'Only open leads').toEqual([]);
  });

  test(...lr('LR-116'), async ({ leadReports, page }) => {
    await leadReports.openAt('aging');
    const link = leadReports.longestIdle.table.locator('tbody a').first();
    const leadNo = (await link.innerText()).match(/LD-[A-Z0-9-]+/)?.[0] ?? '';
    expect.soft(await link.getAttribute('href')).toMatch(/^\/leads\?selected=/);
    await link.click();
    await expect(page).toHaveURL(/\/leads/);
    const detail = at(page, XP.leadDetail).first();
    await expect(detail.getByText(/Loading lead details/i), 'Lead Detail finishes loading').toHaveCount(0, { timeout: 30_000 });
    await expect(detail, 'Lead Detail').toContainText(leadNo);
  });
});
