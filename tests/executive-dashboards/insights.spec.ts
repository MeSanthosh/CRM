/**
 * Lead & Customer Insights tab (EXD-048…065): cards, source / channel / geography panels and the two status charts, against
 * /dashboard/summary and the Leads, Opportunities, Inventory and SPA / Sales Contracts modules. Read only.
 * Run: npx playwright test tests/executive-dashboards/insights.spec.ts
 */
import { test, expect } from './fixtures';
import { tc, tcRow, sheet, note, shown, expectShows, expectRate, expectSameShown, fmt } from './shared';
import { tilesMatchApi } from './checks';
import { EXD } from '../locators';
import type { DashboardsPage } from './DashboardsPage';

const TAB = 'Lead & Customer Insights';
const v = async (dash: DashboardsPage, label: string) => shown(await dash.tileValue(label)).value;
/** "282 Active · 30 Converted · 2 Disqualified" → { Active: 282, … } */
const parts = (line: string) => Object.fromEntries([...line.matchAll(/([\d,]+)\s+([A-Za-z.]+)/g)].map(m => [m[2], Number(m[1].replace(/,/g, ''))]));
/** A status chart: centre total, the parts with their %, the footnote. */
async function chart(dash: DashboardsPage, heading: string) {
  const ls = await dash.section(heading);
  const total = shown(ls.find(l => /^\d[\d,]*$/.test(l)) ?? '').value;
  const items: { name: string; count: number; pct: string }[] = [];
  ls.forEach((l, i) => {
    if (/^\d[\d,]*$/.test(ls[i + 1] ?? '') && /^\(([\d.]+)%\)$/.test(ls[i + 2] ?? '')) items.push({ name: l, count: shown(ls[i + 1]).value, pct: ls[i + 2].replace(/[()]/g, '') });
  });
  return { total, items, foot: ls.find(l => /^Status of /.test(l)) ?? '' };
}

test.describe('Executive Dashboards · Lead & Customer Insights', () => {
  test.beforeEach(async ({ dash }) => { await dash.open(TAB, 'this_month'); });

  test(...tc('EXD-048'), async ({ dash, src }) => {
    dash.api.collections ??= await src.collections();
    await tilesMatchApi(dash, TAB);
  });

  test(...tc('EXD-049'), async ({ dash, src }) => {
    const t = await dash.tile('Total Leads');
    const s = (await src.leads()).summary;
    const p = parts(t?.lines.find(l => /Active/.test(l)) ?? '');
    note('card / Leads module', `${t?.value} · ${JSON.stringify(p)} / total ${s.total}, converted ${s.converted}, disqualified ${s.disqualified}`);
    expectShows(t?.value, s.total, 'Total Leads = Leads module total');
    expect.soft((p.Active ?? 0) + (p.Converted ?? 0) + (p.Disqualified ?? 0), 'Active + Converted + Disqualified = Total').toBe(shown(t?.value ?? '').value);
    expect.soft(p.Converted, 'Converted = Leads module converted').toBe(s.converted);
    expect.soft(p.Disqualified, 'Disqualified = Leads module disqualified').toBe(s.disqualified);
    expect.soft(p.Active, 'Active = total − converted − disqualified').toBe(s.total - s.converted - s.disqualified);
  });

  test(...tc('EXD-050'), async ({ dash, src }) => {
    const t = await dash.tile('Active Leads');
    const line = t?.lines.find(l => /New/.test(l)) ?? '';
    const p = parts(line);
    const open = (await src.leads()).items.filter(l => !['CONVERTED', 'DISQUALIFIED'].includes(l.leadStatus?.code));
    const byStatus: Record<string, number> = {};
    for (const l of open) byStatus[l.leadStatus?.code ?? '?'] = (byStatus[l.leadStatus?.code ?? '?'] ?? 0) + 1;
    note('card / open leads by status', `${t?.value} · "${line}" / ${JSON.stringify(byStatus)}`);
    const sum = Object.values(p).reduce((a, b) => a + b, 0);
    expect.soft(sum, `New + Assigned + Qual. + Other = Active Leads ("${line}")`).toBe(shown(t?.value ?? '').value);
    expect.soft(p.New, 'New = open leads with status New').toBe(byStatus.NEW ?? 0);
    expect.soft(p.Assigned, 'Assigned = open leads with status Assigned').toBe(byStatus.ASSIGNED ?? 0);
    expect.soft(p['Qual.'], 'Qual. = open leads with status Qualified').toBe(byStatus.QUALIFIED ?? 0);
  });

  test(...tc('EXD-051'), async ({ dash, src }) => {
    const s = (await src.opportunities()).summary;
    note('Opportunities', `open ${s.open}`);
    expectShows(await dash.tileValue('Open Opportunities'), s.open, 'Open Opportunities = Opportunities Open card');
  });

  test(...tc('EXD-052'), async ({ dash, src }) => {
    const t = await dash.tile('Won / SPAs Executed');
    const s = (await src.contracts()).summary;
    note('card / contracts', `${t?.value} · ${t?.lines.join(' · ')} / signed ${s.signed}`);
    expect.soft(t?.lines.join(' ') ?? '', 'Card says "to date"').toMatch(/to date/i);
    expectShows(t?.value, s.signed, 'Won / SPAs Executed (to date) = signed contracts (SPA / Sales Contracts)');
  });

  test(...tc('EXD-053'), async ({ dash, src }) => {
    expectShows(await dash.tileValue('Disqualified Leads'), (await src.leads()).summary.disqualified, 'Disqualified Leads = Leads Disqualified card');
  });

  test(...tc('EXD-054'), async ({ dash, src }) => {
    const s = (await src.units()).summary;
    const t = await dash.tile('Units Available');
    note('cards / Inventory', `${t?.value} · ${t?.lines.join(' · ')} / available ${s.available} of ${s.total}, reserved ${s.reserved}`);
    expectShows(t?.value, s.available, 'Units Available = Inventory');
    expect.soft(t?.lines.join(' ') ?? '', '"of N sellable units" = Inventory total').toContain(`of ${s.total}`);
    expectShows(await dash.tileValue('Reserved Units'), s.reserved, 'Reserved Units = Inventory reserved');
  });

  test(...tc('EXD-055'), async ({ dash, src }) => {
    const t = await dash.tile('Sales Value (SPAs)');
    const s = (await src.contracts()).summary;
    const n = Number(t?.lines.join(' ').match(/([\d,]+)\s+signed SPAs/)?.[1]?.replace(/,/g, '') ?? NaN);
    note('card / contracts', `${t?.value} · ${t?.lines.join(' · ')} / ${s.signed} signed, value ${fmt(s.value)}`);
    expectShows(t?.value, s.value, 'Sales Value (SPAs) = contracts Value');
    expect.soft(n, '"N signed SPAs to date" = signed contracts').toBe(s.signed);
  });

  test(...tc('EXD-056'), async ({ dash, src }) => {
    const c = await src.collections();
    note('contracts collections', `received ${fmt(c.totals.amountReceived)}, outstanding ${fmt(c.totals.outstanding)}`);
    expectShows(await dash.tileValue('Collections Received'), c.totals.amountReceived, 'Collections Received = amount received');
    expectShows(await dash.tileValue('Outstanding Amount'), c.totals.outstanding, 'Outstanding Amount = outstanding');
  });

  test(...tc('EXD-057'), async ({ dash, src }) => {
    const cap = await v(dash, 'Leads Captured'), conv = await v(dash, 'Converted');
    expectRate(await dash.tileValue('Period Conversion'), conv, cap, 'Period Conversion = Converted ÷ Captured');
    const s = (await src.leads()).summary;
    expectRate(await dash.tileValue('Overall Conversion'), s.converted, s.total, 'Overall Conversion = converted ÷ total leads');
    await dash.tab('Commercial / Sales');
    const com = { leads: await dash.tileValue('TOTAL LEADS'), conv: (await dash.section('SALES FUNNEL')).find((l, i, a) => a[i - 1] === 'Converted Leads') ?? '' };
    note('Commercial', JSON.stringify(com));
    expectShows(com.leads, cap, 'Leads Captured = Commercial Total Leads');
    expectShows(com.conv, conv, 'Converted = Commercial funnel Converted Leads');
  });

  test(...tc('EXD-058'), async ({ dash }) => {
    const mix = await dash.pairs('Lead Source Mix');
    const conv = await dash.pairs('Conversion by Source');
    await dash.tab('Monthly Sales & Marketing');
    const t = await dash.table('8. LEAD SOURCE PERFORMANCE');
    note('mix / conversion / Monthly', `${mix.map(p => `${p.label} ${p.value}`).join(', ')} / ${conv.map(p => `${p.label} ${p.value}`).join(', ')} / ${t.rows.map(r => r.join(' ')).join(', ')}`);
    for (const p of mix) expectShows(t.get(p.label, 'Leads'), shown(p.value).value, `${p.label}: leads = Monthly Lead Source Performance`);
    for (const p of conv) expectSameShown(p.value, t.get(p.label, 'Conv %'), `${p.label}: conversion = Monthly Conv %`);
  });

  test(...tc('EXD-059'), async ({ dash }) => {
    const geo = await dash.pairs('Geography');
    const api = dash.api.summary.audience;
    note('geography / API', `${geo.map(p => `${p.label} ${p.value}`).join(', ')} / ${JSON.stringify(api.byInterestCountry.map((x: any) => [x.name, x.count]))}`);
    for (const p of geo) expect.soft(shown(p.value).value, `${p.label} = API`).toBe(api.byInterestCountry.find((x: any) => x.name === p.label)?.count);
    expect.soft(geo.reduce((s, p) => s + shown(p.value).value, 0), 'Countries do not exceed Leads Captured').toBeLessThanOrEqual(await v(dash, 'Leads Captured'));
  });

  test(...tc('EXD-060'), async ({ dash }) => {
    const ch = await dash.pairs('Capture Channel');
    await dash.tab('Monthly Sales & Marketing');
    const t = await dash.table('12. MARKETING CAMPAIGNS PERFORMANCE');
    note('channels / Monthly', `${ch.map(p => `${p.label} ${p.value}`).join(', ')} / ${t.rows.map(r => r.join(' ')).join(', ')}`);
    for (const p of ch) expectShows(t.get(p.label, 'Leads'), shown(p.value).value, `${p.label}: leads = Monthly Marketing Campaigns`);
  });

  test(...tc('EXD-061'), async ({ dash, page }) => {
    const c = await chart(dash, 'LEADS PIPELINE · STATUS');
    note('chart', `${c.total} · ${c.items.map(i => `${i.name} ${i.count} (${i.pct})`).join(', ')} · ${c.foot}`);
    expect.soft(c.items.reduce((s, i) => s + i.count, 0), `Parts add up to the total of ${c.total}`).toBe(c.total);
    expect.soft(c.foot, 'Footnote total').toContain(`${c.total}`);
    for (const i of c.items) expectRate(i.pct, i.count, c.total, `${i.name} %`);
    await page.locator(EXD.pieCard).nth(0).locator(EXD.pieLink).click();
    await expect.soft(page, 'View details opens Leads').toHaveURL(/\/leads/);
  });

  test(...tc('EXD-062'), async ({ dash, src, page }) => {
    const c = await chart(dash, 'UNIT INVENTORY · STATUS');
    const s = (await src.units()).summary;
    note('chart / Inventory', `${c.total} · ${c.items.map(i => `${i.name} ${i.count} (${i.pct})`).join(', ')} / ${JSON.stringify(s.byStatus.map((b: any) => [b.code, b.count]))}`);
    expect.soft(c.total, 'Total = Inventory units').toBe(s.total);
    expect.soft(c.items.reduce((a, i) => a + i.count, 0), `Available + Reserved + Sold = ${c.total}`).toBe(c.total);
    for (const i of c.items) expectRate(i.pct, i.count, c.total, `${i.name} %`);
    await page.locator(EXD.pieCard).nth(1).locator(EXD.pieLink).click();
    await expect.soft(page, 'View details opens Inventory').toHaveURL(/\/inventory/);
  });

  test(...tc('EXD-063'), async ({ dash }) => {
    const money = sheet('Tiles').filter(t => t['Tab'] === TAB && t['Kind'] === 'money');
    const vals = await Promise.all(money.map(async t => `${t['Label']}: ${await dash.tileValue(t['Label'])}`));
    note('amounts', vals.join(' | '));
    const styles = new Set(vals.map(x => (/\d\.\d+[KMB]\b|\d[KMB]\b/.test(x) ? 'short' : 'long')));
    expect.soft([...styles], 'All amounts use the same style').toHaveLength(1);
    for (const x of vals) expect.soft(/\.\d{2}\s*USD$/.test(x) && /\d{3},\d{3}/.test(x), `Rounded like the other cards: ${x}`).toBeFalsy();
  });

  const periods = sheet('Periods').filter(p => !['this_month', 'custom'].includes(p['Key']));
  periods.forEach((p, i) => {
    test(...tcRow('EXD-064', i + 1, p['Label'], `The cards show the API figures of ${p['Label']}.`, `Periods "${p['Label']}"`), async ({ dash }) => {
      await dash.period(p['Key']);
      const find = () => [...dash.byUrl.keys()].reverse().find(k => k.includes(`period=${p['Key']}&`) && k.includes('view=audience'));
      await expect.poll(find, { message: `API reply for ${p['Label']}`, timeout: 20_000 }).toBeTruthy();
      const api = dash.byUrl.get(find()!);
      expect(api, `API reply for ${p['Label']}`).toBeTruthy();
      const shownNow = { cap: await dash.tileValue('Leads Captured'), conv: await dash.tileValue('Converted'), rate: await dash.tileValue('Period Conversion'), won: await dash.tileValue('Won / SPAs Executed') };
      note('shown / API', `${JSON.stringify(shownNow)} / captured ${api.audience.leadsCaptured}, converted ${api.audience.leadsConverted}, rate ${api.audience.conversionRate}, won ${api.metrics.wonOpportunities}`);
      expectShows(shownNow.cap, api.audience.leadsCaptured, `${p['Label']}: Leads Captured`);
      expectShows(shownNow.conv, api.audience.leadsConverted, `${p['Label']}: Converted`);
      expectShows(shownNow.rate, api.audience.conversionRate, `${p['Label']}: Period Conversion`, 0.05);
      expectShows(shownNow.won, api.metrics.wonOpportunities, `${p['Label']}: Won / SPAs Executed`);
    });
  });

  test(...tc('EXD-065'), async ({ dash, page }) => {
    test.setTimeout(600_000);
    for (const r of sheet('KPI Links')) {
      await dash.open(TAB);
      const card = page.locator(EXD.kpiCard).filter({ hasText: new RegExp(`^\\s*${r['Card'].replace(/[/()]/g, m => `\\${m}`)}`, 'i') }).first();
      expect.soft(await card.getAttribute('href'), `${r['Card']} link`).toBe(r['Route']);
      await card.click();
      await page.waitForLoadState('networkidle').catch(() => {});
      expect.soft(new URL(page.url()).pathname, `${r['Card']} opens ${r['Route']}`).toBe(new URL(r['Route'], page.url()).pathname);
      const text = await page.locator('main').innerText().catch(() => '');
      expect.soft(/not found|something went wrong/i.test(text) || text.length < 50, `${r['Card']}: page loads`).toBeFalsy();
    }
  });
});
