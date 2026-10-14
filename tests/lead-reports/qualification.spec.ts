/** Lead Reports workbook — Qualification & Conversion (LR-117…125). */
import { test, expect, note } from '../pages/fixtures';
import { num, sum, expectNear } from '../helpers';
import { LeadReportsPage, toHours } from '../pages/LeadReportsPage';
import { lr } from './catalog';
import { expectRate, labelOf } from './shared';

const TIME_CARDS = ['Capture → First Contact', 'Capture → Qualified', 'Capture → Opportunity', 'Capture → SPA Signed'];

/** Leads Captured and the Lost total for the period, then opens the Qualification tab. */
async function openWithTotals(lead: LeadReportsPage) {
  await lead.openWith('last_12_months');
  const captured = await lead.kpi('Leads Captured');
  await lead.openTab('Source & Channel');
  const lost = num((await lead.breakdown.total())?.['Lost'] ?? '');
  await lead.openTab('Qualification & Conversion');
  return { captured, lost };
}

test.describe('Lead Reports · Qualification & Conversion', () => {
  test(...lr('LR-117'), async ({ leadReports }) => {
    await leadReports.openAt('qualification', 'last_12_months');
    const cards = [];
    for (const c of TIME_CARDS) {
      const t = await leadReports.timeCard(c);
      cards.push(t);
      expect.soft(t.text, `${c} value with a unit`).toMatch(/^[\d.]+\s?(d|h)$/);
      expect.soft(t.subtitle, `${c} subtitle`).toMatch(/^Median · average [\d.]+\s?(d|h)$/);
    }
    note('cards', cards.map((t, i) => `${TIME_CARDS[i]} ${t.text} (${t.subtitle})`).join(' | '));
    for (let i = 1; i < cards.length; i++) {
      expect.soft(cards[i].median, `${TIME_CARDS[i]} median ≥ ${TIME_CARDS[i - 1]}`).toBeGreaterThanOrEqual(cards[i - 1].median);
    }
  });

  test(...lr('LR-118'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const overview = toHours(await leadReports.kpiText('Avg Time to First Contact'));
    await leadReports.openTab('Qualification & Conversion');
    const card = await leadReports.timeCard('Capture → First Contact');
    expectNear(card.average, overview, 'Capture → First Contact average vs Overview (hours)', 0.02, 0.5);
  });

  for (const [id, table, label] of [['LR-119', 'byRating', 'Rating'], ['LR-120', 'byScore', 'Score']] as const) {
    test(...lr(id), async ({ leadReports }) => {
      const { captured } = await openWithTotals(leadReports);
      const t = leadReports[table];
      expect.soft((await t.headers())[0], 'First column').toBe(label);
      const rows = await t.rows();
      note('rows', rows.map(r => `${labelOf(r)} ${r['Leads']}`).join(' | '));
      expect.soft(sum(rows.map(r => num(r['Leads']))), 'Leads add up to Leads Captured').toBe(captured);
      if (label === 'Score') {
        expect.soft(rows.map(labelOf).filter(l => !/^\d+(–\d+|\+)$/.test(l)), 'Bands look like "40–59" or "80+"').toEqual([]);
      }
      for (const r of rows) {
        const leads = num(r['Leads']);
        if (!leads) continue;
        expectRate(num(r['Contact %']), num(r['Contacted']), leads, `${labelOf(r)} Contact %`);
        expectRate(num(r['Conv. %']), num(r['Opportunity']), leads, `${labelOf(r)} Conv. %`);
        expectRate(num(r['Win %']), num(r['SPA Signed']), leads, `${labelOf(r)} Win %`);
      }
    });
  }

  test(...lr('LR-121'), async ({ leadReports }) => {
    await leadReports.openAt('qualification', 'last_12_months');
    const bad: string[] = [];
    for (const t of [leadReports.byRating, leadReports.byScore]) {
      for (const r of await t.rows()) {
        const v = r['Avg First Contact'];
        const h = toHours(v);
        if (/h$/.test(v) && h >= 24) bad.push(`${labelOf(r)}: "${v}" (a day or more shown in hours)`);
        if (/d$/.test(v) && h < 24) bad.push(`${labelOf(r)}: "${v}" (under a day shown in days)`);
      }
    }
    expect(bad, 'Hours below a day, days above').toEqual([]);
  });

  test(...lr('LR-122'), async ({ leadReports }) => {
    const { captured } = await openWithTotals(leadReports);
    const statuses = await leadReports.whereNow();
    note('statuses', statuses.map(s => `${s.label} ${s.count}`).join(' | '));
    expect.soft(statuses.length, 'Statuses listed').toBeGreaterThan(0);
    expect.soft(sum(statuses.map(s => s.count)), 'Add up to Leads Captured').toBe(captured);
    await expect.soft(leadReports.panel('Where the Leads Are Now').locator('button, a'), 'Not links').toHaveCount(0);
  });

  test(...lr('LR-123'), async ({ leadReports }) => {
    const { lost } = await openWithTotals(leadReports);
    const reasons = await leadReports.lostReasons();
    const total = sum(reasons.map(r => r.count));
    note('reasons', reasons.map(r => `${r.reason} ${r.count} (${r.percent}%)`).join(' | '));
    expect.soft(total, 'Reasons add up to Lost (Source & Channel Total)').toBe(lost);
    for (const r of reasons) expectRate(r.percent, r.count, total, r.reason);
  });

  test(...lr('LR-124'), async ({ leadReports }) => {
    await leadReports.openAt('qualification', 'last_12_months');
    const total = sum((await leadReports.lostReasons()).map(r => r.count));
    const { drill } = await leadReports.drill.verify(leadReports.viewLostLeads, { expected: total });
    expect.soft(drill.title).toMatch(/Lost or disqualified leads/i);
  });

  test(...lr('LR-125'), async ({ leadReports }) => {
    await leadReports.openAt('qualification', 'last_12_months');
    for (const t of [leadReports.byRating, leadReports.byScore]) {
      await expect.soft(t.table.locator('tbody button, tbody a'), `${await t.title()}: no links`).toHaveCount(0);
    }
  });
});
