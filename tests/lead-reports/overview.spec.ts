/** Lead Reports workbook — Overview & Funnel (LR-042…067). All expected values are derived from the page itself. */
import { test, expect, note } from '../pages/fixtures';
import { expectNear } from '../helpers';
import { FUNNEL_STEPS, LEAD_FILTERS, toHours } from '../pages/LeadReportsPage';
import { lr } from './catalog';
import { expectRate, futureRange, rowWithData, labelOf } from './shared';

const NON_LINK_CARDS = ['Contact Rate', 'Qualification Rate', 'Opportunity Conversion', 'Won Value', 'Avg Time to First Contact'];

test.describe('Lead Reports · Overview & Funnel', () => {
  test(...lr('LR-042'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const shown: string[] = [];
    for (const label of leadReports.kpiLabels) {
      await expect.soft(leadReports.card(label), label).toBeVisible();
      const value = await leadReports.kpiText(label);
      const sub = await leadReports.cardSubtitle(label);
      shown.push(`${label}: ${value} (${sub})`);
      expect.soft(value, `${label} value`).not.toMatch(/^\s*$|NaN|undefined/);
      expect.soft(sub, `${label} subtitle`).not.toBe('');
    }
    note('cards', shown.join(' | '));
  });

  test(...lr('LR-043'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const captured = await leadReports.kpi('Leads Captured');
    const { drill } = await leadReports.drill.verify(leadReports.cardLinks('Leads Captured').first(), { expected: captured });
    expect.soft(drill.title, 'List title').toMatch(/Leads captured/i);
  });

  for (const [id, card, re] of [['LR-044', 'Contact Rate', /(\d[\d,]*)\s+contacted/], ['LR-045', 'Qualification Rate', /(\d[\d,]*)\s+qualified/],
    ['LR-046', 'Opportunity Conversion', /(\d[\d,]*)\s+converted to opportunity/]] as const) {
    test(...lr(id), async ({ leadReports }) => {
      await leadReports.openWith('last_12_months');
      const sub = await leadReports.cardSubtitle(card);
      const part = Number(sub.match(re)?.[1].replace(/,/g, '') ?? NaN);
      const captured = await leadReports.kpi('Leads Captured');
      note('values', `${card} ${await leadReports.kpiText(card)} | "${sub}" | Leads Captured ${captured}`);
      expect.soft(sub, 'Subtitle').toMatch(re);
      expectRate(await leadReports.kpi(card), part, captured, card);
    });
  }

  test(...lr('LR-047'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const spa = await leadReports.kpi('SPA Signed');
    const captured = await leadReports.kpi('Leads Captured');
    const sub = await leadReports.cardSubtitle('SPA Signed');
    expectRate(Number(sub.match(/Win rate\s+([\d.]+)%/)?.[1] ?? NaN), spa, captured, 'Win rate');
    const { drill } = await leadReports.drill.verify(leadReports.cardLinks('SPA Signed').first(), { expected: spa });
    expect.soft(drill.title, 'List title').toMatch(/signed SPA/i);
  });

  test(...lr('LR-048'), async ({ leadReports, sales }) => {
    await leadReports.openWith('last_12_months');
    const text = await leadReports.kpiText('Won Value');
    expect.soft(text, 'Format "<amount>[K|M|B] <currency>"').toMatch(/^\d[\d,]*(\.\d+)?\s?[KMB]?\s[A-Z]{3}$/);
    const won = await leadReports.kpi('Won Value');
    await sales.openWith('last_12_months');
    expectNear(won, await sales.kpi('Won value'), 'Lead Reports Won Value vs Sales Reports Won value (Last 12 months)', 0.005, 0);
  });

  test(...lr('LR-049'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const text = await leadReports.kpiText('Avg Time to First Contact');
    expect.soft(text, 'Shown with a unit').toMatch(/^[\d.]+\s?(d|h)$/);
    const overview = toHours(text);
    await leadReports.openTab('Qualification & Conversion');
    const card = await leadReports.timeCard('Capture → First Contact');
    note('values', `Overview ${text} | Qualification "${card.subtitle}"`);
    expectNear(overview, card.average, 'Overview average vs Capture → First Contact average (hours)', 0.02, 0.5);
  });

  for (const [id, index, title] of [['LR-050', 0, /Open leads \(today\)/i], ['LR-051', 1, /idle over 30 days/i], ['LR-052', 2, /never contacted/i]] as const) {
    test(...lr(id), async ({ leadReports }) => {
      await leadReports.openWith('last_12_months');
      const link = leadReports.cardLinks('Open Leads Now').nth(index);
      const { drill } = await leadReports.drill.verify(link);
      expect.soft(drill.title, 'List title').toMatch(title);
      expect.soft(drill.asOfToday, 'Marked "as of today"').toBeTruthy();
    });
  }

  test(...lr('LR-053'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    for (const card of NON_LINK_CARDS) await expect.soft(leadReports.card(card).locator('button, a'), `${card} has no link`).toHaveCount(0);
    for (const card of ['Leads Captured', 'SPA Signed', 'Open Leads Now']) expect.soft(await leadReports.cardLinks(card).count(), `${card} has a link`).toBeGreaterThan(0);
  });

  test(...lr('LR-054'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const steps = await leadReports.funnel();
    expect(steps.map(s => s.label)).toEqual(FUNNEL_STEPS);
    for (const s of steps) expect.soft(Number.isFinite(s.width), `${s.label} has a bar`).toBeTruthy();
  });

  test(...lr('LR-055'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const steps = await leadReports.funnel();
    note('funnel', steps.map(s => `${s.label} ${s.count} (${s.rate}% · step ${s.step}%)`).join(' → '));
    const top = steps[0].count;
    steps.forEach((s, i) => {
      if (i) expect.soft(s.count, `${s.label} ≤ ${steps[i - 1].label}`).toBeLessThanOrEqual(steps[i - 1].count);
      expectRate(s.rate, s.count, top, `${s.label} %`);
      if (i) expectRate(s.step, s.count, steps[i - 1].count, `${s.label} step %`);
      expectNear(s.width, s.rate ?? NaN, `${s.label} bar width`, 0, 0.5);
    });
  });

  test(...lr('LR-056'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const by = Object.fromEntries((await leadReports.funnel()).map(s => [s.label, s]));
    expect.soft(by['Captured'].count, 'Captured = Leads Captured').toBe(await leadReports.kpi('Leads Captured'));
    expectNear(by['Contacted'].rate ?? NaN, await leadReports.kpi('Contact Rate'), 'Contacted % = Contact Rate', 0, 0.1);
    expectNear(by['Qualified'].rate ?? NaN, await leadReports.kpi('Qualification Rate'), 'Qualified % = Qualification Rate', 0, 0.1);
    expectNear(by['Opportunity'].rate ?? NaN, await leadReports.kpi('Opportunity Conversion'), 'Opportunity % = Opportunity Conversion', 0, 0.1);
    expect.soft(by['SPA Signed'].count, 'SPA Signed = SPA Signed card').toBe(await leadReports.kpi('SPA Signed'));
  });

  // LR-057 … LR-062: each funnel step's count opens a list of exactly that many leads
  FUNNEL_STEPS.forEach((step, i) => {
    test(...lr(`LR-0${57 + i}`), async ({ leadReports }) => {
      await leadReports.openWith('last_12_months');
      const count = (await leadReports.funnel())[i].count;
      test.skip(count === 0, `${step} is 0 in this period`);
      const { drill } = await leadReports.drill.verify(leadReports.funnelLink(step), { expected: count });
      expect.soft(drill.title, 'List title').toBe(step);
    });
  });

  test(...lr('LR-063'), async ({ leadReports }) => {
    leadReports.watchErrors();
    await leadReports.open();
    await leadReports.setCustomRange(...futureRange());
    for (const s of await leadReports.funnel()) {
      expect.soft(s.count, `${s.label} count`).toBe(0);
      expect.soft(Number.isNaN(s.width) ? 0 : s.width, `${s.label} bar`).toBe(0);
    }
    await leadReports.expectNoBrokenValues();
    leadReports.expectNoErrors();
  });

  test(...lr('LR-064'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const rows = await leadReports.dataCompleteness();
    const captured = await leadReports.kpi('Leads Captured');
    note('rows', rows.map(r => `${r.label} ${r.filled}/${r.total} (${r.percent}%)`).join(' | '));
    expect.soft(rows.map(r => r.label)).toEqual(['Lead source recorded', 'Salesperson assigned', 'First contact recorded', 'Interaction logged']);
    for (const r of rows) {
      expect.soft(r.total, `${r.label}: total = Leads Captured`).toBe(captured);
      expect.soft(r.filled, `${r.label}: filled ≤ total`).toBeLessThanOrEqual(r.total);
      expectRate(r.percent, r.filled, r.total, r.label);
    }
  });

  test(...lr('LR-065'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    await leadReports.openTab('Source & Channel');
    const options = await leadReports.filterOptions(LEAD_FILTERS['Lead Source']);
    const row = rowWithData((await leadReports.breakdown.rows()).filter(r => options.includes(labelOf(r))), 'Leads');
    test.skip(!row, 'No named lead source with leads');
    await leadReports.setFilter(LEAD_FILTERS['Lead Source'], labelOf(row!));
    await leadReports.openTab('Overview & Funnel');
    const captured = await leadReports.kpi('Leads Captured');
    for (const r of await leadReports.dataCompleteness()) {
      expect.soft(r.total, `${r.label}: total follows the filter`).toBe(captured);
      expectRate(r.percent, r.filled, r.total, r.label);
    }
    const source = (await leadReports.dataCompleteness()).find(r => r.label === 'Lead source recorded');
    expect.soft(source?.filled, 'Every filtered lead has this lead source recorded').toBe(captured);
  });

  test(...lr('LR-066'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const months = await leadReports.trend();
    expect(months).toHaveLength(12);
    const now = new Date();
    const expected = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      return `${d.toLocaleString('en-GB', { month: 'short' }).slice(0, 3)} ${String(d.getFullYear()).slice(2)}`;
    });
    expect.soft(months.map(m => m.label), 'Last 12 months ending with the current month').toEqual(expected);
    for (const m of months) expect.soft(m.detail, `${m.label} detail`).toMatch(/^\d+ opp · \d+ SPA$/);
  });

  test(...lr('LR-067'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const months = await leadReports.trend();
    const total = months.reduce((a, m) => a + m.value, 0);
    note('trend', months.map(m => `${m.label} ${m.value} (${m.opp}/${m.spa})`).join(', '));
    expect.soft(total, 'Sum of the 12 months = Leads Captured').toBe(await leadReports.kpi('Leads Captured'));
    const max = Math.max(...months.map(m => m.value));
    for (const m of months) {
      if (max) expectNear(m.height, (m.value / max) * 100, `${m.label} bar height`, 0, 15);
      expect.soft(m.opp, `${m.label}: opp ≤ captured`).toBeLessThanOrEqual(m.value);
      expect.soft(m.spa, `${m.label}: SPA ≤ captured`).toBeLessThanOrEqual(m.value);
    }
  });
});
