/** Lead Reports workbook — Drill-down list (LR-068…079, LR-145, LR-146). Counts are read from the page, never fixed. */
import { test, expect, note } from '../pages/fixtures';
import { num } from '../helpers';
import { XP, at } from '../locators';
import { DRILL_CAP, DRILL_COLUMNS, DRILL_EXPORT_COLUMNS, BUCKET_RULES } from '../pages/LeadDrill';
import { LeadReportsPage, FUNNEL_STEPS, BREAKDOWN_LINK_COLUMNS } from '../pages/LeadReportsPage';
import { lr } from './catalog';
import { rowWithData, labelOf } from './shared';

/** First funnel step whose count is between 1 and the 500-row cap (a list that shows every lead). */
async function fullListStep(lead: LeadReportsPage) {
  const step = (await lead.funnel()).find(s => s.count > 0 && s.count <= DRILL_CAP);
  test.skip(!step, 'No funnel step between 1 and 500 leads');
  return step!;
}

/** A count link above the 500 cap on Overview (card or funnel). */
async function bigLink(lead: LeadReportsPage) {
  const links = lead.countLinks();
  for (let i = 0; i < await links.count(); i++) {
    if (num(await links.nth(i).innerText()) > DRILL_CAP) return links.nth(i);
  }
  test.skip(true, 'No count above 500 in this period');
  return links.first();
}

test.describe('Lead Reports · Drill-down list', () => {
  test(...lr('LR-068'), async ({ leadReports, page }) => {
    await leadReports.openWith('last_12_months');
    const step = await fullListStep(leadReports);
    const d = await leadReports.drill.openFrom(leadReports.funnelLink(step.label));
    expect.soft(d.title, 'Title').toBe(step.label);
    expect.soft(d.countLine, '"N leads" line').toMatch(/^\d[\d,]* leads?/);
    await expect.soft(leadReports.drill.exportButton, 'Export').toBeVisible();
    await expect.soft(leadReports.drill.closeButton, 'Close').toBeVisible();
    expect.soft(d.headers, 'Columns').toEqual(DRILL_COLUMNS);
    const box = await leadReports.drill.root.boundingBox();
    const viewport = page.viewportSize()!;
    expect.soft(box && box.y < viewport.height && box.y + box.height > 0, 'Scrolled into view').toBeTruthy();
  });

  test(...lr('LR-069'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const step = await fullListStep(leadReports);
    const d = await leadReports.drill.openFrom(leadReports.funnelLink(step.label));
    expect(d.rows.length, `${step.label}: rows listed`).toBe(step.count);
    expect(d.count).toBe(step.count);
  });

  test(...lr('LR-070'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const link = await bigLink(leadReports);
    const clicked = num(await link.innerText());
    const d = await leadReports.drill.openFrom(link);
    note('list', `${d.title}: ${d.countLine}`);
    expect.soft(d.count).toBe(clicked);
    expect.soft(d.rows.length, 'Rows shown').toBe(DRILL_CAP);
    expect.soft(d.countLine, 'Says it is truncated').toMatch(new RegExp(`showing the first ${DRILL_CAP}`));
  });

  test(...lr('LR-071'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const step = await fullListStep(leadReports);
    const d = await leadReports.drill.openFrom(leadReports.funnelLink(step.label));
    const sheet = await leadReports.drill.export();
    expect.soft(sheet.name, 'File name').toMatch(/^lead-report-leads-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect.soft(sheet.header, 'Columns').toEqual(DRILL_EXPORT_COLUMNS);
    expect.soft(sheet.rows.length, 'One row per lead').toBe(d.count);
    const inFile = new Set(sheet.rows.map(r => String(r['Lead No'])));
    expect.soft(d.rows.filter(r => !inFile.has(r.LeadNo)).map(r => r.LeadNo), 'Listed leads missing from the file').toEqual([]);
  });

  test(...lr('LR-072'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const link = await bigLink(leadReports);
    const d = await leadReports.drill.openFrom(link);
    const sheet = await leadReports.drill.export();
    note('export', `${d.countLine} → ${sheet.rows.length} rows in the file`);
    expect(sheet.rows.length, 'Export has every lead, not only the 500 shown').toBe(d.count);
    expect.soft(new Set(sheet.rows.map(r => r['Lead No'])).size, 'No duplicates in the file').toBe(d.count);
  });

  test(...lr('LR-073'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    await leadReports.drill.openFrom(leadReports.funnelLink((await fullListStep(leadReports)).label));
    await leadReports.drill.close();
  });

  test(...lr('LR-074'), async ({ leadReports, page }) => {
    await leadReports.openWith('last_12_months');
    await leadReports.drill.openFrom(leadReports.funnelLink((await fullListStep(leadReports)).label));
    await page.keyboard.press('Escape');
    await expect(leadReports.drill.root, 'List closed by Esc').toHaveCount(0, { timeout: 3000 });
  });

  test(...lr('LR-075'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const steps = (await leadReports.funnel()).filter(s => s.count > 0);
    test.skip(steps.length < 2, 'Needs two funnel steps with leads');
    await leadReports.drill.openFrom(leadReports.funnelLink(steps[0].label));
    const second = await leadReports.drill.openFrom(leadReports.funnelLink(steps[1].label));
    await expect(leadReports.drill.root, 'Only one list').toHaveCount(1);
    expect(second.title).toBe(steps[1].label);
  });

  test(...lr('LR-076'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    await leadReports.drill.openFrom(leadReports.funnelLink((await fullListStep(leadReports)).label));
    await leadReports.openTab('Source & Channel');
    await expect(leadReports.drill.root).toHaveCount(0);
  });

  test(...lr('LR-077'), async ({ leadReports, page }) => {
    await leadReports.openWith('last_12_months');
    const d = await leadReports.drill.openFrom(leadReports.funnelLink((await fullListStep(leadReports)).label));
    const first = d.rows[0];
    const href = await leadReports.drill.leadLinks().first().getAttribute('href');
    expect.soft(href, 'Link target').toMatch(/^\/leads\?selected=/);
    await leadReports.drill.leadLinks().first().click();
    await expect(page).toHaveURL(/\/leads/);
    const detail = at(page, XP.leadDetail).first();
    await expect(detail, 'Lead Detail opens').toBeVisible();
    await expect(detail.getByText(/Loading lead details/i), 'Lead Detail finishes loading').toHaveCount(0, { timeout: 30_000 });
    await expect.soft(detail, 'Same lead').toContainText(first.LeadNo);
  });

  test(...lr('LR-078'), async ({ leadReports }) => {
    test.setTimeout(240_000);
    await leadReports.openWith('last_12_months');
    const links = [...FUNNEL_STEPS.map(s => ({ name: `Funnel ${s}`, link: leadReports.funnelLink(s) })),
      ...[0, 1, 2].map(i => ({ name: `Open Leads Now link ${i + 1}`, link: leadReports.cardLinks('Open Leads Now').nth(i) }))];
    const checked: string[] = [];
    for (const { name, link } of links) {
      if (!(await link.count())) continue;
      const d = await leadReports.drill.openFrom(link);
      const rule = BUCKET_RULES[d.bucket ?? ''];
      if (!rule) continue;
      const bad = d.rows.filter(r => !rule.ok(r));
      checked.push(`${name} (${d.bucket}): ${d.rows.length} rows, ${bad.length} off`);
      expect.soft(bad.map(r => `${r.LeadNo} ${r['Status']}`).slice(0, 10), `${name}: rows that do not ${rule.text}`).toEqual([]);
    }
    await leadReports.openTab('Qualification & Conversion');
    const lost = await leadReports.drill.openFrom(leadReports.viewLostLeads);
    expect.soft(lost.rows.filter(r => !BUCKET_RULES.lost.ok(r)).map(r => r.LeadNo), 'Lost list').toEqual([]);
    note('checked', checked.join(' | '));
  });

  test(...lr('LR-079'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const a = await leadReports.drill.openFrom(leadReports.cardLinks('Open Leads Now').first());
    await leadReports.drill.close();
    await leadReports.setPeriod('this_month');
    const b = await leadReports.drill.openFrom(leadReports.cardLinks('Open Leads Now').first());
    note('values', `Last 12 months ${a.count} | This month ${b.count}`);
    expect.soft(b.count, 'Same count in both periods').toBe(a.count);
    expect.soft(b.rows.map(r => r.LeadNo).sort(), 'Same leads').toEqual(a.rows.map(r => r.LeadNo).sort());
  });

  test(...lr('LR-145'), async ({ leadReports }) => {
    await leadReports.openAt('source', 'last_12_months');
    const headers = await leadReports.breakdown.headers();
    const rows = await leadReports.breakdown.rows();
    const zeros = rows.flatMap(r => BREAKDOWN_LINK_COLUMNS.filter(c => num(r[c]) === 0).map(c => ({ row: r, col: c })));
    test.skip(!zeros.length, 'No zero counts in the table');
    for (const z of zeros.slice(0, 10)) {
      await expect.soft(leadReports.breakdown.link(z.row, z.col, headers), `${labelOf(z.row)} › ${z.col} (0) is not a link`).toHaveCount(0);
    }
    const nonZero = rowWithData(rows, 'Leads');
    if (nonZero) await expect.soft(leadReports.breakdown.link(nonZero, 'Leads', headers), 'Counts above 0 are links').toHaveCount(1);
  });

  test(...lr('LR-146'), async ({ leadReports }) => {
    test.setTimeout(300_000);
    // one count link per tab, fully checked (every link is covered by the LR-DDV tests)
    await leadReports.openWith('last_12_months');
    await leadReports.drill.verify(leadReports.cardLinks('Leads Captured').first());
    await leadReports.openTab('Source & Channel');
    const sh = await leadReports.breakdown.headers();
    const sr = rowWithData(await leadReports.breakdown.rows(), 'Contacted');
    if (sr) await leadReports.drill.verify(leadReports.breakdown.link(sr, 'Contacted', sh), { rowLabel: labelOf(sr) });
    await leadReports.openTab('Aging & Follow-up');
    await leadReports.drill.verify(leadReports.cardLinks('Never Contacted').first());
    await leadReports.openTab('Qualification & Conversion');
    const reasons = (await leadReports.lostReasons()).reduce((a, r) => a + r.count, 0);
    await leadReports.drill.verify(leadReports.viewLostLeads, { expected: reasons });
    await leadReports.openTab('Salesperson Scorecard');
    const ch = await leadReports.scorecard.headers();
    const cr = rowWithData(await leadReports.scorecard.rows(), 'Qualified');
    if (cr) await leadReports.drill.verify(leadReports.scorecard.link(cr, 'Qualified', ch), { rowLabel: labelOf(cr) });
  });
});
