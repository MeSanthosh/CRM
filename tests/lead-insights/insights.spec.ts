/**
 * Leads → Insights → Sources — "Lead Source & Channel Insights Workspace" (LSI-001 … LSI-023).
 * Expected values come from the page itself (cards, tabs, column sums, the drill-down list) and from
 * TestData/Lead_Insights_Test_Data.xlsx; nothing is hard-coded.
 */
import { test, expect, lsi, note, DATA, S, list } from './shared';
import { LeadsPage } from '../pages/LeadsPage';
import { LeadForm } from '../pages/LeadForm';
import { LeadDetail } from '../pages/LeadDetail';
import { createAndGetLeadNo, withLeadsLock } from '../leads-page/shared';
import { newLead } from '../leads-page/test-data';
import { checklistValues, message as ldMessage } from '../lead-detail/test-data';
import { fill, runOnce, runValue } from '../sales-chain/data';
import type { LeadInsightsPage, SourceRow } from '../pages/LeadInsightsPage';

const round1 = (n: number) => Math.round(n * 10 ** Number(S('Percent Decimals'))) / 10 ** Number(S('Percent Decimals'));

test.describe('Lead Insights · Sources view', () => {
  test.describe.configure({ timeout: 300_000 });

  test(...lsi('LSI-001'), async ({ insights }) => {
    await insights.open();
    const text = await insights.text();
    const subs = await insights.subTabs(list('Sub-tabs'));
    const heads = await insights.headers();
    note('sub-tabs / columns', `${subs.join(', ')} / ${heads.join(', ')}`);
    expect.soft(text, 'Description').toContain(S('Page Description'));
    for (const c of [S('Active Leads Card'), S('Sources Card'), S('Table Heading'), S('Drill Hint')]) expect.soft(text, `"${c}" shown`).toContain(c);
    expect.soft(subs, 'Sub-tabs').toEqual(list('Sub-tabs'));
    expect(heads, 'Table columns').toEqual(list('Table Columns'));
  });

  test(...lsi('LSI-002'), async ({ insights }) => {
    await insights.open();
    const active = await insights.card(S('Active Leads Card'));
    const all = await insights.tabCount(S('All Leads Tab'));
    note('Active Leads / All Leads', `${active} / ${all}`);
    expect(active, 'Active Leads = All Leads').toBe(all);
  });

  test(...lsi('LSI-003'), async ({ insights }) => {
    await insights.open();
    const card = await insights.card(S('Sources Card'));
    const rows = await insights.sources();
    note('Sources card / rows', `${card} / ${rows.length}`);
    expect(rows.length, 'Rows of "By source" = Sources card').toBe(card);
  });

  test(...lsi('LSI-004'), async ({ insights }) => {
    await insights.open();
    const active = await insights.card(S('Active Leads Card'));
    const rows = await insights.sources();
    const sum = rows.reduce((a, r) => a + r.total, 0);
    note('sum of Total / Active Leads', `${sum} / ${active} (${rows.map(r => `${r.source} ${r.total}`).join(', ')})`);
    expect(sum, 'Sum of Total = Active Leads').toBe(active);
  });

  test(...lsi('LSI-005'), async ({ insights }) => {
    await insights.open();
    for (const r of await insights.sources()) {
      const q = r.total ? round1((r.qualified / r.total) * 100) : 0;
      const c = r.total ? round1((r.converted / r.total) * 100) : 0;
      note(r.source, `Qual. ${r.qualPct}% (calc ${q}%) · Conv. ${r.convPct}% (calc ${c}%)`);
      expect.soft(r.qualPct, `${r.source}: Qual. % = ${r.qualified} ÷ ${r.total}`).toBeCloseTo(q, 1);
      expect.soft(r.convPct, `${r.source}: Conv. % = ${r.converted} ÷ ${r.total}`).toBeCloseTo(c, 1);
    }
  });

  test(...lsi('LSI-006'), async ({ insights }) => {
    await insights.open();
    for (const r of await insights.sources()) {
      expect.soft(r.converted <= r.qualified, `${r.source}: Converted (${r.converted}) ≤ Qualified (${r.qualified})`).toBeTruthy();
      expect.soft(r.qualified <= r.total, `${r.source}: Qualified (${r.qualified}) ≤ Total (${r.total})`).toBeTruthy();
      expect.soft(r.unassigned <= r.total, `${r.source}: Unassigned (${r.unassigned}) ≤ Total (${r.total})`).toBeTruthy();
    }
  });

  test(...lsi('LSI-007'), async ({ insights }) => {
    await insights.open();
    const rows = await insights.sources();
    const sum = rows.reduce((a, r) => a + r.unassigned, 0);
    const tab = await insights.tabCount(S('Unassigned Tab'));
    note('sum of Unassigned / Unassigned tab', `${sum} / ${tab}`);
    expect(sum, 'Sum of Unassigned = Unassigned tab').toBe(tab);
  });

  test(...lsi('LSI-008'), async ({ insights, page }) => {
    await insights.open();
    const sources = (await insights.sources()).map(r => r.source);
    const leads = new LeadsPage(page);
    await leads.openRoute();
    const form = new LeadForm(page, 'Individual');
    await form.open();
    const control = form.control('Lead Source');
    await expect.poll(async () => (await control.locator('option').count()) > 1, { timeout: 15_000 }).toBeTruthy();
    const options = (await control.locator('option').allTextContents()).map(o => o.trim());
    await form.close();
    const unknown = sources.filter(s => !options.includes(s));
    note('sources / Lead Source options', `${sources.join(', ')} / ${options.join(', ')}`);
    expect(unknown, 'Sources that are not a Lead Source option').toEqual([]);
  });

  test(...lsi('LSI-009'), async ({ insights }) => {
    await insights.open();
    const before = await insights.sources();
    await insights.refresh(S('Refresh Button'));
    const after = await insights.sources();
    expect(after.map(r => r.text), 'Same figures after Refresh').toEqual(before.map(r => r.text));
  });
});

test.describe('Lead Insights · Drill-down', () => {
  test.describe.configure({ timeout: 600_000 });

  test(...lsi('LSI-011'), async ({ insights }) => {
    await insights.open();
    for (const r of await insights.sources()) {
      await insights.open();
      await insights.clickSource(r.source);
      const text = await insights.text();
      const count = await insights.drillCount(S('Drill Count Word'));
      const leads = await insights.drillLeads();
      const other = leads.filter(l => l.source !== r.source);
      note(r.source, `Total ${r.total} · "Leads ${count} ${S('Drill Count Word')}" · listed ${leads.length}${other.length ? ` · other sources: ${other.map(l => `${l.lead} (${l.source})`).join(', ')}` : ''}`);
      expect.soft(text, `${r.source}: list shown`).toContain(S('Drill Shown Text'));
      expect.soft(count, `${r.source}: "Leads N matching" = Total`).toBe(r.total);
      expect.soft(leads.length, `${r.source}: leads listed (all pages) = Total`).toBe(r.total);
      expect.soft(other.map(l => l.lead), `${r.source}: every lead listed has this source`).toEqual([]);
    }
  });

  test(...lsi('LSI-012'), async ({ insights }) => {
    await insights.open();
    for (const r of await insights.sources()) {
      await insights.open();
      await insights.clickSource(r.source);
      const leads = await insights.drillLeads();
      const unassigned = leads.filter(l => l.owner === S('Unassigned Owner')).length;
      note(r.source, `Unassigned column ${r.unassigned} · unassigned leads listed ${unassigned}`);
      expect.soft(unassigned, `${r.source}: unassigned leads listed = Unassigned column`).toBe(r.unassigned);
    }
  });

  test(...lsi('LSI-013'), async ({ insights }) => {
    await insights.open();
    const first = (await insights.sources())[0];
    await insights.clickSource(first.source);
    expect.soft(await insights.text(), 'List shown after the first click').toContain(S('Drill Shown Text'));
    await insights.clickSource(first.source);
    const text = await insights.text();
    expect.soft(text, 'List gone').not.toContain(S('Drill Shown Text'));
    expect(text, 'Hint shown again').toContain(S('Drill Hint'));
  });
});

// ── Count updates: one lead per run, created → qualified → converted ──────────
const SOURCE = () => S('Source For New Lead');
async function rowNow(insights: LeadInsightsPage): Promise<{ active: number; row: SourceRow }> {
  await insights.open();
  const row = (await insights.source(SOURCE())) ?? { source: SOURCE(), total: 0, qualified: 0, converted: 0, unassigned: 0, qualPct: 0, convPct: 0, text: '' };
  return { active: await insights.card(S('Active Leads Card')), row };
}
function expectChanges(action: string, before: { active: number; row: SourceRow }, after: { active: number; row: SourceRow }) {
  const want = DATA.countChanges(action);
  note(`${action}: before → after`, `Active ${before.active} → ${after.active}; ${SOURCE()}: ${before.row.text || 'not listed'} → ${after.row.text}`);
  const got: Record<string, number> = {
    'Active Leads': after.active - before.active, Total: after.row.total - before.row.total, Qualified: after.row.qualified - before.row.qualified,
    Converted: after.row.converted - before.row.converted, Unassigned: after.row.unassigned - before.row.unassigned,
  };
  for (const [k, v] of Object.entries(want)) expect.soft(got[k], `${k} after "${action}"`).toBe(Number(v));
}
/** The lead of this run (kept across retries / worker restarts). */
const leadNo = () => runValue.get<string>('lead-insights-lead');

test.describe('Lead Insights · Count updates', () => {
  test.describe.configure({ timeout: 600_000 });

  test(...lsi('LSI-021'), async ({ insights, page }) => {
    await withLeadsLock(async () => {
      const before = await rowNow(insights);
      const made = await runOnce('lead-insights-create', async () => {
        const b = DATA.sheet('Buyers')[0];
        const ctx = { first: b['First Name'], last: b['Last Name'] };
        const lead = newLead('Individual');
        const values = { ...lead.values, Title: b['Title'], 'First Name': b['First Name'], 'Last Name': b['Last Name'], Mobile: fill(b['Mobile'], ctx), Email: fill(b['Email'], ctx), 'Lead Source': SOURCE() };
        const no = await createAndGetLeadNo(new LeadsPage(page), { ...lead, values, first: b['First Name'], last: b['Last Name'], name: `${b['First Name']} ${b['Last Name']}`, mobile: values.Mobile, email: values.Email });
        return { no, name: `${b['First Name']} ${b['Last Name']}`, mobile: values.Mobile, email: values.Email };
      });
      runValue.set('lead-insights-lead', made.no);
      note('lead created', `${made.no} · ${made.name} · ${made.mobile} · ${made.email} · source ${SOURCE()}`);
      const after = await rowNow(insights);
      expectChanges('Create Lead', before, after);
      await insights.clickSource(SOURCE());
      const listed = (await insights.drillLeads()).some(l => l.lead === made.no);
      expect(listed, `${made.no} listed under ${SOURCE()}`).toBeTruthy();
    });
  });

  test(...lsi('LSI-022'), async ({ insights, page }) => {
    const no = leadNo();
    expect(no, 'Lead created by LSI-021').toBeTruthy();
    await withLeadsLock(async () => {
      const before = await rowNow(insights);
      await runOnce('lead-insights-qualify', async () => {
        const d = await new LeadsPage(page).openLead(no!);
        await d.qualify(checklistValues());
        return true;
      });
      const after = await rowNow(insights);
      expectChanges('Qualify Lead', before, after);
      const r = after.row;
      expect.soft(r.qualPct, 'Qual. % recalculated').toBeCloseTo(round1((r.qualified / r.total) * 100), 1);
    });
  });

  test(...lsi('LSI-023'), async ({ insights, page }) => {
    const no = leadNo();
    expect(no, 'Lead created by LSI-021').toBeTruthy();
    await withLeadsLock(async () => {
      const before = await rowNow(insights);
      await runOnce('lead-insights-convert', async () => {
        const d: LeadDetail = await new LeadsPage(page).openLead(no!);
        await d.convert(ldMessage('Convert Button'));
        return true;
      });
      const after = await rowNow(insights);
      expectChanges('Convert Lead', before, after);
      const r = after.row;
      expect.soft(r.convPct, 'Conv. % recalculated').toBeCloseTo(round1((r.converted / r.total) * 100), 1);
    });
  });
});
