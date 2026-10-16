/**
 * Lead Reports workbook — Filter counts (LR-157…166).
 * Each of the 8 header filters is applied on its own, in turn, and every count on the page is checked.
 * The value is the busiest one that has some (not all) of the leads in Performance by <field>, and the expected
 * figures come from that unfiltered row, from the other panels on the page, or from the drill-down lists.
 */
import { test, expect, note } from '../pages/fixtures';
import { num, sum, expectNear } from '../helpers';
import { LeadReportsPage, GROUPINGS, FUNNEL_STEPS } from '../pages/LeadReportsPage';
import type { Row } from '../pages/LeadTable';
import { lr } from './catalog';
import { expectRate, labelOf, isTotalOrUnspecified } from './shared';
import { Grouping, Applied, EXPORT_COLUMN, SCREEN_COLUMN, captured, selectedCode, uniqueOptions, outsideRows } from './filters';

type Period = Parameters<LeadReportsPage['setPeriod']>[0];
/** A field, the value picked for it and that value's row in the unfiltered Performance by <field>. */
type Pick = { g: Grouping; value: string; row: Row; total: number };

/** Funnel step → column of Performance by <field> that counts the same leads. */
const FUNNEL_COLUMN: Record<string, string> = { Captured: 'Leads', Contacted: 'Contacted', Qualified: 'Qualified', Opportunity: 'Opportunity',
  Reserved: 'Reserved', 'SPA Signed': 'SPA Signed' };
const TOTAL_COLUMNS = ['Contacted', 'Qualified', 'Opportunity', 'Reserved', 'SPA Signed'];

/** For each field, the busiest selectable value with some but not all of the leads in `period`, and its unfiltered row. */
async function picks(lead: LeadReportsPage, period: Period = 'last_12_months'): Promise<Pick[]> {
  await lead.openWith(period);
  await lead.openTab('Source & Channel');
  const out: Pick[] = [];
  for (const g of GROUPINGS) {
    await lead.groupBy(g.name);
    const total = num((await lead.breakdown.total())?.['Leads'] ?? '');
    const options = await uniqueOptions(lead, g);
    const row = (await lead.breakdown.rows())
      .filter(r => options.includes(labelOf(r)) && num(r['Leads']) > 0 && num(r['Leads']) < total)
      .sort((a, b) => num(b['Leads']) - num(a['Leads']))[0];
    if (row) out.push({ g, value: labelOf(row), row, total });
  }
  note('values picked', out.map(p => `${p.g.name} = ${p.value} (${num(p.row['Leads'])} of ${p.total})`).join(' | ') || 'none');
  return out;
}

/** Reloads the report on `period` with only this field's filter set. */
async function applyOnly(lead: LeadReportsPage, p: Pick, period: Period = 'last_12_months'): Promise<Applied> {
  await lead.openWith(period);
  await lead.setFilter(p.g.filter, p.value);
  const lc = await captured(lead);
  return { g: p.g, value: p.value, code: await selectedCode(lead, p.g), leads: num(p.row['Leads']), captured: lc };
}

const tag = (p: Pick) => `${p.g.name} = ${p.value}`;

/** Funnel step counts by label, read on the Overview tab. */
async function funnelCounts(lead: LeadReportsPage) {
  await lead.openTab('Overview & Funnel');
  return Object.fromEntries((await lead.funnel()).map(s => [s.label, s]));
}

/** Leads Captured, every funnel step, SPA Signed and Won Value = the value's row in Performance by <field>. */
async function expectCardsMatchRow(lead: LeadReportsPage, p: Pick, a: Applied) {
  const by = await funnelCounts(lead);
  expect.soft(a.captured, `${tag(p)}: Leads Captured = row Leads`).toBe(num(p.row['Leads']));
  for (const step of FUNNEL_STEPS) expect.soft(by[step]?.count, `${tag(p)}: funnel ${step} = row ${FUNNEL_COLUMN[step]}`).toBe(num(p.row[FUNNEL_COLUMN[step]]));
  expect.soft(await lead.kpi('SPA Signed'), `${tag(p)}: SPA Signed card = row`).toBe(num(p.row['SPA Signed']));
  expectNear(await lead.kpi('Won Value'), num(p.row['Won Value']), `${tag(p)}: Won Value card = row`, 0.01, 0);
  note(p.g.name, `${p.value}: ${FUNNEL_STEPS.map(s => `${s} ${by[s]?.count}`).join(', ')} | Won ${await lead.kpiText('Won Value')}`);
}

/** Runs `check` once per field, each with only that field's filter set. */
async function eachFilter(lead: LeadReportsPage, check: (p: Pick, a: Applied) => Promise<void>, period: Period = 'last_12_months') {
  const ps = await picks(lead, period);
  test.skip(!ps.length, 'No filter value with some, but not all, of the leads');
  for (const p of ps) await test.step(tag(p), async () => check(p, await applyOnly(lead, p, period)));
}

test.describe('Lead Reports · Filter counts', () => {
  test.describe.configure({ timeout: 600_000 });

  test(...lr('LR-157'), async ({ leadReports }) => {
    await eachFilter(leadReports, (p, a) => expectCardsMatchRow(leadReports, p, a));
  });

  test(...lr('LR-158'), async ({ leadReports }) => {
    await eachFilter(leadReports, async (p, a) => {
      const by = await funnelCounts(leadReports);
      const k = await leadReports.kpis(['Contact Rate', 'Qualification Rate', 'Opportunity Conversion', 'SPA Signed']);
      for (const [card, step, column] of [['Contact Rate', 'Contacted', 'Contact %'], ['Qualification Rate', 'Qualified', 'Qual. %'],
        ['Opportunity Conversion', 'Opportunity', 'Conv. %']] as const) {
        expectRate(k[card], by[step].count, a.captured, `${tag(p)}: ${card} = ${step} ÷ Leads Captured`);
        expectNear(by[step].rate ?? NaN, k[card], `${tag(p)}: funnel ${step} % = ${card}`, 0, 0.1);
        expectNear(k[card], num(p.row[column]), `${tag(p)}: ${card} = row ${column}`, 0, 0.1);
      }
      const win = Number((await leadReports.cardSubtitle('SPA Signed')).match(/Win rate\s+([\d.]+)%/)?.[1] ?? NaN);
      expectRate(win, k['SPA Signed'], a.captured, `${tag(p)}: Win rate = SPA Signed ÷ Leads Captured`);
      expectNear(win, num(p.row['Win %']), `${tag(p)}: Win rate = row Win %`, 0, 0.1);
    });
  });

  test(...lr('LR-159'), async ({ leadReports }) => {
    await eachFilter(leadReports, async (p, a) => {
      await leadReports.openTab('Overview & Funnel');
      const spa = await leadReports.kpi('SPA Signed');
      const open = await leadReports.kpi('Open Leads Now');
      const all = await leadReports.drill.verify(leadReports.cardLinks('Leads Captured').first(), { expected: a.captured });
      const fromExport = outsideRows(all.exported?.rows ?? [], [a], EXPORT_COLUMN);
      expect.soft(fromExport.outside.slice(0, 10), `${tag(p)}: Leads Captured list — leads outside the filter`).toEqual([]);
      const lists = [`Leads Captured ${all.drill.count}`];
      for (const [card, n] of [['SPA Signed', spa], ['Open Leads Now', open]] as const) {
        if (!n) continue;
        const { drill } = await leadReports.drill.verify(leadReports.cardLinks(card).first(), { expected: n, withExport: false });
        const shown = outsideRows(drill.rows, [a], SCREEN_COLUMN, 'LeadNo');
        expect.soft(shown.outside.slice(0, 10), `${tag(p)}: ${card} list — leads outside the filter`).toEqual([]);
        lists.push(`${card} ${drill.count}`);
      }
      note(`${p.g.name} lists`, `${p.value}: ${lists.join(', ')}${fromExport.checked.length ? ` (checked ${fromExport.checked.join(', ')})` : ''}`);
    });
  });

  test(...lr('LR-160'), async ({ leadReports }) => {
    await eachFilter(leadReports, async (p, a) => {
      await leadReports.openTab('Overview & Funnel');
      for (const r of await leadReports.dataCompleteness()) {
        expect.soft(r.total, `${tag(p)}: Data Completeness "${r.label}" total = Leads Captured`).toBe(a.captured);
        expect.soft(r.filled, `${tag(p)}: "${r.label}" filled ≤ total`).toBeLessThanOrEqual(r.total);
      }
      const months = await leadReports.trend();
      expect.soft(sum(months.map(m => m.value)), `${tag(p)}: 12-Month Trend adds up to Leads Captured`).toBe(a.captured);
    });
  });

  test(...lr('LR-161'), async ({ leadReports }) => {
    await eachFilter(leadReports, async (p, a) => {
      const by = await funnelCounts(leadReports);
      await leadReports.openTab('Source & Channel');
      for (const g of GROUPINGS) {
        await leadReports.groupBy(g.name);
        const t = await leadReports.breakdown.total();
        expect.soft(num(t?.['Leads'] ?? ''), `${tag(p)}: Performance by ${g.name} Total = Leads Captured`).toBe(a.captured);
        for (const c of TOTAL_COLUMNS) expect.soft(num(t?.[c] ?? ''), `${tag(p)}: Performance by ${g.name} Total ${c} = funnel`).toBe(by[c].count);
        if (g === p.g) expect.soft((await leadReports.breakdown.rows()).map(labelOf), `${tag(p)}: only the selected value is listed`).toEqual([p.value]);
      }
    });
  });

  test(...lr('LR-162'), async ({ leadReports }) => {
    await eachFilter(leadReports, async (p) => {
      await leadReports.openTab('Overview & Funnel');
      const openNow = await leadReports.kpi('Open Leads Now');
      await leadReports.openTab('Aging & Follow-up');
      const k = await leadReports.kpis(['Open Leads', 'Idle Over 30 Days', 'Never Contacted', 'Overdue Follow-ups']);
      note(`${p.g.name} aging`, `${p.value}: Open Leads Now ${openNow} | ${JSON.stringify(k)}`);
      expect.soft(k['Open Leads'], `${tag(p)}: Aging Open Leads = Open Leads Now`).toBe(openNow);
      expect.soft(k['Never Contacted'], `${tag(p)}: Never Contacted ≤ Open Leads`).toBeLessThanOrEqual(k['Open Leads']);
      expect.soft(k['Idle Over 30 Days'], `${tag(p)}: Idle Over 30 Days ≤ Open Leads`).toBeLessThanOrEqual(k['Open Leads']);
      if (!k['Open Leads']) return;
      for (const panel of ['Idle Time', 'Lead Age']) {
        expect.soft(sum((await leadReports.buckets(panel)).map(b => b.count)), `${tag(p)}: ${panel} buckets add up to Open Leads`).toBe(k['Open Leads']);
      }
      const t = leadReports.agingBySalesperson;
      expect.soft(await t.sum('Open'), `${tag(p)}: Open Leads by Salesperson Open = Open Leads`).toBe(k['Open Leads']);
      expect.soft(await t.sum('Never Contacted'), `${tag(p)}: Never Contacted column = card`).toBe(k['Never Contacted']);
      expect.soft(await t.sum('Overdue Follow-ups'), `${tag(p)}: Overdue column = card`).toBe(k['Overdue Follow-ups']);
    });
  });

  test(...lr('LR-163'), async ({ leadReports }) => {
    await eachFilter(leadReports, async (p, a) => {
      await leadReports.openTab('Source & Channel');
      await leadReports.groupBy(p.g.name);
      const lost = num((await leadReports.breakdown.total())?.['Lost'] ?? '');
      await leadReports.openTab('Qualification & Conversion');
      for (const t of [leadReports.byRating, leadReports.byScore]) {
        expect.soft(sum((await t.rows()).map(r => num(r['Leads']))), `${tag(p)}: ${t.heading} adds up to Leads Captured`).toBe(a.captured);
      }
      expect.soft(sum((await leadReports.whereNow()).map(s => s.count)), `${tag(p)}: Where the Leads Are Now adds up to Leads Captured`).toBe(a.captured);
      const reasons = sum((await leadReports.lostReasons()).map(r => r.count));
      note(`${p.g.name} lost`, `${p.value}: Lost ${lost} | reasons ${reasons}`);
      expect.soft(reasons, `${tag(p)}: Lost Reasons add up to Lost`).toBe(lost);
      if (lost) await leadReports.drill.verify(leadReports.viewLostLeads, { expected: lost, withExport: false });
    });
  });

  test(...lr('LR-164'), async ({ leadReports }) => {
    /** Column totals per salesperson name (two salespeople can share a name). */
    const byName = (rows: Row[], column: string) =>
      rows.reduce<Record<string, number>>((m, r) => ({ ...m, [labelOf(r)]: (m[labelOf(r)] ?? 0) + num(r[column]) }), {});
    await eachFilter(leadReports, async (p, a) => {
      const by = await funnelCounts(leadReports);
      const k = await leadReports.kpis(['SPA Signed', 'Open Leads Now']);
      await leadReports.openTab('Aging & Follow-up');
      const agingOpen = (await leadReports.kpi('Open Leads')) ? byName(await leadReports.agingBySalesperson.rows(), 'Open') : {};
      await leadReports.openTab('Salesperson Scorecard');
      const rows = await leadReports.scorecard.rows();
      const total = (c: string) => sum(rows.map(r => num(r[c])));
      expect.soft(total('Leads'), `${tag(p)}: Scorecard Leads = Leads Captured`).toBe(a.captured);
      for (const c of ['Contacted', 'Qualified', 'Opportunity']) expect.soft(total(c), `${tag(p)}: Scorecard ${c} = funnel`).toBe(by[c].count);
      expect.soft(total('SPA Signed'), `${tag(p)}: Scorecard SPA Signed = card`).toBe(k['SPA Signed']);
      expect.soft(total('Open Now'), `${tag(p)}: Scorecard Open Now = Open Leads Now`).toBe(k['Open Leads Now']);
      const scoreOpen = byName(rows, 'Open Now');
      for (const [name, n] of Object.entries(agingOpen)) expect.soft(scoreOpen[name] ?? 0, `${tag(p)}: ${name} Open Now = Aging Open`).toBe(n);
    });
  });

  test(...lr('LR-165'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    await leadReports.openTab('Source & Channel');
    const fields: { g: Grouping; total: number; unspecified: number; options: number }[] = [];
    for (const g of GROUPINGS) {
      await leadReports.groupBy(g.name);
      const rows = await leadReports.breakdown.rows();
      fields.push({ g, total: num((await leadReports.breakdown.total())?.['Leads'] ?? ''), options: (await leadReports.filterOptions(g.filter)).length,
        unspecified: sum(rows.filter(r => isTotalOrUnspecified(labelOf(r))).map(r => num(r['Leads']))) });
    }
    for (const f of fields) {
      await test.step(f.g.name, async () => {
        // select by position: two options can share a label (e.g. two salespeople with the same name)
        const counts: number[] = [];
        for (let i = 1; i <= f.options; i++) {
          const resp = leadReports.dataResponse().catch(() => null);
          await leadReports.filterSelect(f.g.filter).selectOption({ index: i });
          await resp;
          counts.push(await captured(leadReports));
        }
        await leadReports.setFilter(f.g.filter, f.g.filter);
        note(f.g.name, `${f.options} options: ${counts.join(' + ')} = ${sum(counts)} | Total ${f.total} − Unspecified ${f.unspecified} = ${f.total - f.unspecified}`);
        expect.soft(sum(counts), `${f.g.name}: the values add up to Total − Unspecified`).toBe(f.total - f.unspecified);
      });
    }
  });

  test(...lr('LR-166'), async ({ leadReports }) => {
    await eachFilter(leadReports, (p, a) => expectCardsMatchRow(leadReports, p, a), 'this_month');
  });
});
