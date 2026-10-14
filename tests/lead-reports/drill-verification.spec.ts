/**
 * Lead Reports workbook — "Drill-down Verification" sheet, run live: every count link the page shows right now
 * (no fixed list or numbers) is clicked and fully checked, export included. One test per area.
 */
import { test, expect, note } from '../pages/fixtures';
import { Locator } from '../auth';
import { LeadReportsPage, GROUPINGS, LEAD_FILTERS } from '../pages/LeadReportsPage';
import { lrDdv } from './catalog';
import { rowWithData, labelOf } from './shared';

const AREA_TIMEOUT = 20 * 60_000;

/** Where a count link sits: KPI card, funnel step, or table row › column (row label used for the grouping check). */
async function whereIs(link: Locator): Promise<{ location: string; rowLabel?: string }> {
  return link.evaluate(el => {
    const t = (e: Element | null | undefined) => ((e as HTMLElement | null)?.innerText ?? '').replace(/\s+/g, ' ').trim();
    const card = el.closest('article.crm-card');
    if (card) return { location: `KPI "${t(card.querySelector('h3'))}"` };
    const step = el.closest('.crm-report-funnel-step');
    if (step) return { location: `Funnel "${t(step.querySelector('.crm-report-funnel-label'))}"` };
    const td = el.closest('td');
    if (!td) return { location: t(el) };
    const tr = td.closest('tr')!;
    const table = td.closest('table')!;
    const col = t(table.querySelectorAll('thead th')[[...tr.children].indexOf(td)]);
    const rowLabel = t(tr.children[0]);
    return { location: `${t(td.closest('section')?.querySelector('h3'))} › ${rowLabel} › ${col}`, rowLabel };
  });
}

/** Checks every count link currently on the page (optionally only some columns). */
async function verifyAll(lead: LeadReportsPage, only?: (location: string) => boolean) {
  const links = lead.countLinks();
  const n = await links.count();
  const done: string[] = [];
  for (let i = 0; i < n; i++) {
    const link = links.nth(i);
    const where = await whereIs(link);
    if (only && !only(where.location)) continue;
    await test.step(where.location, async () => {
      const { clicked, drill } = await lead.drill.verify(link, { rowLabel: where.rowLabel });
      done.push(`${where.location}: ${clicked} → ${drill.rows.length} rows${drill.truncated ? ' (first 500)' : ''}`);
    });
  }
  note('links checked', `${done.length}\n${done.join('\n')}`);
  expect(done.length, 'Count links found').toBeGreaterThan(0);
}

test.describe('Lead Reports · Drill-down Verification', () => {
  test.describe.configure({ timeout: AREA_TIMEOUT });

  test(...lrDdv(1, 'Overview & Funnel (KPI cards and funnel)'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    await verifyAll(leadReports);
  });

  GROUPINGS.forEach((g, i) => {
    const all = g.name === 'Lead Source';
    test(...lrDdv(2 + i, `Source & Channel grouped by ${g.name} (${all ? 'every count' : '"Leads" of every row'})`), async ({ leadReports }) => {
      await leadReports.openAt('source', 'last_12_months');
      await leadReports.groupBy(g.name);
      await verifyAll(leadReports, all ? undefined : loc => loc.endsWith('› Leads'));
    });
  });

  test(...lrDdv(10, 'Aging & Follow-up (cards and Open Leads by Salesperson)'), async ({ leadReports }) => {
    await leadReports.openAt('aging', 'last_12_months');
    await verifyAll(leadReports);
  });

  test(...lrDdv(11, 'Qualification & Conversion — View lost leads = Lost Reasons total'), async ({ leadReports }) => {
    await leadReports.openAt('qualification', 'last_12_months');
    const total = (await leadReports.lostReasons()).reduce((a, r) => a + r.count, 0);
    await leadReports.drill.verify(leadReports.viewLostLeads, { expected: total });
  });

  test(...lrDdv(12, 'Salesperson Scorecard (every salesperson × every count column)'), async ({ leadReports }) => {
    await leadReports.openAt('scorecard', 'last_12_months');
    await verifyAll(leadReports);
  });

  test(...lrDdv(13, 'A list with a header filter applied (Lead Source)'), async ({ leadReports }) => {
    await leadReports.openAt('source', 'last_12_months');
    const options = await leadReports.filterOptions(LEAD_FILTERS['Lead Source']);
    const row = rowWithData((await leadReports.breakdown.rows()).filter(r => options.includes(labelOf(r))), 'Leads');
    test.skip(!row, 'No named lead source with leads');
    await leadReports.setFilter(LEAD_FILTERS['Lead Source'], labelOf(row!));
    await leadReports.openTab('Overview & Funnel');
    const { drill } = await leadReports.drill.verify(leadReports.cardLinks('Leads Captured').first());
    expect.soft(drill.rows.filter(r => r['Source'] !== labelOf(row!)).map(r => r.LeadNo).slice(0, 10), `Rows outside ${labelOf(row!)}`).toEqual([]);
  });
});
