/**
 * Opportunities use cases that only read data:
 * UC-OPP-001 View Opportunities, UC-OPP-003 View Details, UC-OPP-008 (an existing Won record),
 * and the read-only parts of Create (OPP-018), Edit (OPP-020) and Delete (OPP-054).
 */
import { test, expect, note, WRITE_ENDPOINT } from './fixtures';
import { opp, oppSkipped } from './catalog';
import { ROUTES, OPP, OPPORTUNITY_BOARD_COLUMNS, OPPORTUNITY_OPEN_STAGES } from '../locators';
import { parseNum, sum } from '../helpers';
import { expectSame } from '../sales-reports/shared';
import { meanPercent } from './OpportunitiesPage';

const BAD = /^\s*$|NaN|undefined|Infinity|null/;
/** Numbers quoted in a KPI tooltip, e.g. "Formula: Open (43) + Won (78) + Lost (4)" → { Open: 43, Won: 78, Lost: 4 } */
const quoted = (title: string) => Object.fromEntries([...title.matchAll(/([A-Za-z]+)\s*\((\d+)\)/g)].map(m => [m[1], Number(m[2])]));

test.describe('Opportunities · View (UC-OPP-001)', () => {
  // ── OPP-001 · Opportunities opens from the side menu
  // Use case: UC-OPP-001 View Opportunities
  // Checks: URL is /opportunities; heading "Opportunities"; the Opportunities menu item is highlighted
  test(...opp('OPP-001'), async ({ opps, page }) => {
    await page.goto(ROUTES.dashboard);
    const link = page.getByRole('link', { name: 'Opportunities', exact: true }).first();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.opportunities}(\\?.*)?$`));
    await expect(opps.heading()).toBeVisible();
    const active = await page.getByRole('link', { name: 'Opportunities', exact: true }).first()
      .evaluate(e => e.getAttribute('aria-current') === 'page' || /active/.test(e.className));
    expect.soft(active, 'Opportunities menu item highlighted').toBe(true);
  });

  // ── OPP-002 · List loads without errors and shows every column
  // Use case: UC-OPP-001 View Opportunities
  // Checks: Columns Opportunity, Customer, Stage, Probability, Budget, Project, Created Date; every row shows
  //   an OPP-… number with its LD-… lead number, a customer and a probability in %; no JavaScript errors,
  //   failed API calls, NaN or undefined
  test(...opp('OPP-002'), async ({ opps }) => {
    opps.watchErrors();
    await opps.open();
    expect.soft(await opps.headers(), 'List columns').toEqual(opps.columns);
    const rows = await opps.rows();
    expect(rows.length, 'rows on page 1').toBeGreaterThan(0);
    for (const r of rows) {
      // QA also holds older-style numbers such as OPP-2026-0085 and LD-2026-0469
      expect.soft(r.opp, 'Opportunity number').toMatch(/^OPP-(\d{14}-[A-Z0-9]{4}|\d{4}-\d{4})$/);
      expect.soft(r.lead, `${r.opp} lead number`).toMatch(/^LD-(\d{14}-[A-Z0-9]{4}|\d{4}-\d{4})$/);
      expect.soft(r.probability, `${r.opp} probability`).toMatch(/^\d{1,3}%$/);
      expect.soft(r.customer, `${r.opp} customer`).not.toMatch(BAD);
    }
    await opps.expectNoBrokenValues();
    opps.expectNoErrors();
  });

  // ── OPP-003 · KPI cards show loaded values
  // Use case: UC-OPP-001 View Opportunities
  // Checks: All four cards show a value (not blank or —); Pipeline Value is in the base currency named in "All
  //   amounts in"; Avg Probability ends in %
  test(...opp('OPP-003'), async ({ opps, page }) => {
    await opps.open();
    for (const k of opps.kpiLabels) expect.soft(await opps.kpiText(k), k).not.toMatch(BAD);
    const currency = (await page.locator('main .crm-module-header .crm-currency-label strong').innerText()).trim();
    note('currency', currency);
    expect.soft(currency, 'Base currency label').toMatch(/^[A-Z]{3}$/);
    expect.soft(await opps.kpiText('Pipeline Value'), 'Pipeline Value in the base currency').toContain(currency);
    expect.soft(await opps.kpiText('Avg Probability'), 'Avg Probability is a percentage').toMatch(/%$/);
  });

  // ── OPP-004 · Total = Open + Won + Lost
  // Use case: UC-OPP-001 View Opportunities
  // Checks: Total = Open + Won + Lost, and every count quoted in the KPI tooltips equals the card values
  test(...opp('OPP-004'), async ({ opps }) => {
    // the board is read between two readings of the cards; if the cards moved (someone converted or closed a deal), read again
    let total = 0, open = 0, won = 0, lost = 0;
    const tooltips: Record<string, string> = {};
    for (let attempt = 0; attempt < 3; attempt++) {
      await opps.open();
      total = await opps.kpi('Total'); open = await opps.kpi('Open');
      for (const k of opps.kpiLabels) tooltips[k] = (await opps.kpiFormula(k).getAttribute('title')) ?? '';
      await opps.showBoard();
      await opps.setBoardFilter('Closed deals', 'all');
      const cols = await opps.boardColumns();
      won = cols.find(c => c.stage === 'Won')!.count; lost = cols.find(c => c.stage === 'Lost')!.count;
      await opps.open();
      if (await opps.kpi('Total') === total && await opps.kpi('Open') === open) break;
    }
    note('cards', { total, open, wonAllTime: won, lostAllTime: lost });
    note('tooltips', tooltips);
    expect.soft(total, `Total ${total} = Open ${open} + Won ${won} + Lost ${lost}`).toBe(open + won + lost);
    const t = quoted(tooltips['Total']);
    expect.soft(t.Open, `Total tooltip "${tooltips['Total']}": Open count vs Open card`).toBe(open);
    expect.soft(t.Won, 'Total tooltip: Won count vs Board Won (all time)').toBe(won);
    expect.soft(t.Lost, 'Total tooltip: Lost count vs Board Lost (all time)').toBe(lost);
    expect.soft((t.Open ?? 0) + (t.Won ?? 0) + (t.Lost ?? 0), 'Total tooltip adds up to the Total card').toBe(total);
    for (const k of ['Pipeline Value', 'Avg Probability']) {
      const n = tooltips[k].match(/\b(\d+)\s+Open|Open Count \((\d+)\)/i);
      if (n) expect.soft(Number(n[1] ?? n[2]), `${k} tooltip "${tooltips[k]}" counts the Open card's ${open} deals`).toBe(open);
    }
  });

  // ── OPP-005 · Open, Pipeline Value and Avg Probability agree with the Board
  // Use case: UC-OPP-001 View Opportunities
  // Checks: Open = Board open-pipeline deals = sum of the open stage columns; Pipeline Value = Board pipeline
  //   amount; Avg Probability = mean probability of the open cards (±0.5)
  test(...opp('OPP-005'), async ({ opps }) => {
    let openText = '', pipeline = '', avg = '';
    let summary!: Awaited<ReturnType<typeof opps.boardSummary>>;
    for (let attempt = 0; attempt < 3; attempt++) {
      await opps.open();
      openText = await opps.kpiText('Open'); pipeline = await opps.kpiText('Pipeline Value'); avg = await opps.kpiText('Avg Probability');
      await opps.showBoard();
      summary = await opps.boardSummary();
      await opps.open();
      if (await opps.kpiText('Open') === openText && await opps.kpiText('Pipeline Value') === pipeline) break; // nothing moved meanwhile
    }
    await opps.showBoard();
    const cols = (await opps.boardColumns()).filter(c => OPPORTUNITY_OPEN_STAGES.includes(c.stage));
    note('board', { summary: summary.text, columns: cols });
    expect.soft(summary.deals, `Board "Open pipeline" deals vs Open card ${openText}`).toBe(parseNum(openText));
    expect.soft(sum(cols.map(c => c.count)), 'Open stage columns add up to the Open card').toBe(parseNum(openText));
    expectSame(pipeline, summary.value, 'Pipeline Value card vs Board open pipeline amount');
    // Avg Probability: mean of the open cards' probability tags (only when every open card is on the board)
    const probs: string[] = [];
    let complete = true;
    for (const c of cols) {
      const cards = await opps.boardCards(c.stage);
      if (cards.length !== c.count) complete = false;
      probs.push(...cards.map(k => k.tags.find(t => /%$/.test(t)) ?? '0%'));
    }
    if (!complete) return note('avg probability', 'Skipped: the board shows fewer cards than a column count');
    const mean = meanPercent(probs);
    note('avg probability', { card: avg, meanOfOpenCards: mean.toFixed(2), cards: probs.length });
    expect.soft(Math.abs(parseNum(avg) - mean), `Avg Probability ${avg} vs mean ${mean.toFixed(2)}% of ${probs.length} open cards`).toBeLessThanOrEqual(0.5 + 1e-9);
  });

  // ── OPP-006 · Pagination covers every opportunity
  // Use case: UC-OPP-001 View Opportunities
  // Checks: N = Total card; Previous disabled on page 1; Next shows rows 21–40 (page 2); Previous returns to
  //   page 1; the last page ends at N and Next is disabled there; N rows in all, none listed twice
  test(...opp('OPP-006'), async ({ opps }) => {
    test.setTimeout(180_000);
    await opps.open();
    const total = await opps.kpi('Total');
    const p1 = await opps.pagerInfo();
    note('pager', p1.text);
    expect.soft(p1.total, 'Pager total vs Total card').toBe(total);
    expect.soft([p1.from, p1.page], 'Starts at row 1, page 1').toEqual([1, 1]);
    expect.soft((await opps.rows()).length, 'Rows on page 1').toBe(p1.to - p1.from + 1);
    await expect.soft(opps.pagerButton('Previous'), 'Previous disabled on page 1').toBeDisabled();
    test.skip(p1.pages < 2, 'Only one page of opportunities');
    const size = p1.to - p1.from + 1;
    await opps.reload(() => opps.pagerButton('Next').click());
    const p2 = await opps.pagerInfo();
    expect.soft([p2.from, p2.page], 'Next → page 2').toEqual([size + 1, 2]);
    await opps.reload(() => opps.pagerButton('Previous').click());
    expect.soft((await opps.pagerInfo()).page, 'Previous → page 1').toBe(1);
    // page through oldest first: an opportunity created meanwhile lands on the last page instead of shifting the others
    await opps.sortTo('Created Date', 'ascending');
    const all = await opps.allRows();
    const last = await opps.pagerInfo();
    expect.soft(last.page, 'Ends on the last page').toBe(last.pages);
    await expect.soft(opps.pagerButton('Next'), 'Next disabled on the last page').toBeDisabled();
    expect.soft(last.to, 'Last page ends at the total').toBe(last.total);
    expect.soft(all.length, 'Rows across all pages').toBe(last.total);
    expect.soft(new Set(all.map(r => r.opp)).size, 'No opportunity listed twice across pages').toBe(all.length);
  });

  // ── OPP-007 · Board view shows one column per stage
  // Use case: UC-OPP-001 View Opportunities
  // Checks: Board is pressed; columns Qualified, Site Visit, Negotiation, Reservation Ready, Proposal, Won,
  //   Lost; every configured stage except Open has a column; List brings the table back
  test(...opp('OPP-007'), async ({ opps, api }) => {
    await opps.open();
    await opps.showBoard();
    await expect.soft(opps.viewButton('Board'), 'Board pressed').toHaveAttribute('aria-pressed', 'true');
    const cols = (await opps.boardColumns()).map(c => c.stage);
    expect.soft(cols, 'Board columns').toEqual(OPPORTUNITY_BOARD_COLUMNS);
    const stages = (await api.reference('OPPORTUNITY/STAGE')).map(s => s.level2Name);
    note('configured stages', stages.join(', '));
    expect.soft(stages.filter(s => s !== 'Open' && !cols.includes(s)), 'Configured stages with no Board column').toEqual([]);
    await opps.showList();
    await expect.soft(opps.viewButton('List'), 'List pressed').toHaveAttribute('aria-pressed', 'true');
    await expect.soft(opps.page.locator(OPP.table), 'Table back').toBeVisible();
  });

  // ── OPP-008 · Viewing does not change data
  // Use case: UC-OPP-001 View Opportunities
  // Checks: No create / update / delete request (POST, PUT, PATCH, DELETE) to opportunity, lead, visit, note,
  //   reservation, contract or unit-hold endpoints
  test(...opp('OPP-008'), async ({ opps, page }) => {
    const writes: string[] = [];
    page.on('request', r => { if (r.method() !== 'GET' && r.method() !== 'OPTIONS' && WRITE_ENDPOINT.test(r.url())) writes.push(`${r.method()} ${r.url()}`); });
    await opps.open();
    await opps.sortBy('Budget');
    const first = (await opps.rows())[0];
    await opps.openRecord(first.opp);
    await opps.closeDetail();
    await opps.showBoard();
    await opps.showList();
    expect(writes, 'Requests that change data while only viewing').toEqual([]);
  });
});

test.describe('Opportunities · Details (UC-OPP-003)', () => {
  // ── OPP-019 · Opening a record shows its details
  // Use case: UC-OPP-003 View Opportunity Details
  // Checks: Opportunity Detail shows the same number, customer, lead, stage, probability and budget as the row
  //   and the API record; opening it does not modify the record; the second record opens after closing the
  //   first
  test(...opp('OPP-019'), async ({ opps, api }) => {
    await opps.open();
    const [a, b] = await opps.rows();
    const rec = await opps.openRecord(a.opp);
    const h = await opps.detailHeader();
    note('detail', h);
    expect.soft(h.subtitle, 'Subtitle').toBe(`${a.opp} · ${a.customer}`);
    expect.soft(h.customer, 'Customer').toBe(a.customer);
    expect.soft(h.status, 'Stage').toBe(a.stage);
    expect.soft(h.Probability, 'Probability').toBe(a.probability);
    expect.soft(h.Budget, 'Budget').toBe(a.budget);
    expect.soft(h.Lead, 'Lead').toBe(a.lead);
    expect.soft(rec.opportunityNo, 'API number').toBe(a.opp);
    expect.soft(rec.customer?.name, 'API customer').toBe(a.customer);
    expect.soft(rec.opportunityStage?.name, 'API stage').toBe(a.stage);
    expect.soft(`${rec.probabilityPercent}%`, 'API probability').toBe(a.probability);
    expect.soft(rec.lead?.leadNo, 'API lead').toBe(a.lead);
    const fresh = await api.opportunity(rec.id);
    expect.soft(fresh.updatedAt, 'Opening the record did not modify it').toBe(rec.updatedAt);
    // alternate flow: back to the list and open another record
    await opps.closeDetail();
    test.skip(!b, 'Only one opportunity listed');
    await opps.openRecord(b.opp);
    expect.soft((await opps.detailHeader()).subtitle, 'Second record opens').toBe(`${b.opp} · ${b.customer}`);
  });

  // ── OPP-024 · Record link (?selected=id) opens and keeps the record open
  // Use case: UC-OPP-003, UC-OPP-004 View Opportunity Details / Edit Opportunity
  // Checks: That opportunity's detail opens and stays open until closed
  test(...opp('OPP-024'), async ({ opps, page }) => {
    await opps.open();
    const row = (await opps.rows())[0];
    await page.goto(row.href);
    await opps.detailLoaded(row.opp);
    await page.waitForTimeout(3_000);
    await expect(opps.detail, `${row.href} keeps ${row.opp} open`).toBeVisible();
    await expect(opps.detail).toContainText(row.opp);
  });

  // ── OPP-060 · Link to a missing opportunity shows a message
  // Use case: UC-OPP-003 View Opportunity Details
  // Checks: A message says the opportunity was not found (no endless loading, no silent close)
  test(...opp('OPP-060'), async ({ page }) => {
    await page.goto(`${ROUTES.opportunities}?selected=00000000-0000-0000-0000-000000000000`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByText(/not found|no longer (exists|available)|does not exist|unavailable|could not be (found|loaded)|no access/i).first(),
      'A message says the opportunity was not found').toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Opportunities · Won (UC-OPP-008)', () => {
  // ── OPP-039 · A Won opportunity is recorded as Won
  // Use case: UC-OPP-008 Mark Opportunity as Won
  // Checks: Status Won (API status WON), probability 100%, every workflow step Done, no stage-advancing actions
  test(...opp('OPP-039'), async ({ opps }) => {
    await opps.open();
    let won = (await opps.rows()).find(r => r.stage === 'Won');
    if (!won) won = (await opps.allRows(5)).find(r => r.stage === 'Won');
    test.skip(!won, 'No Won opportunity in the first pages');
    const rec = await opps.openRecord(won!.opp);
    expect.soft(await opps.status.innerText(), 'Status pill').toBe('Won');
    expect.soft(await opps.fact('Probability').innerText(), 'Probability').toBe('100%');
    expect.soft(rec.status, 'API status').toBe('WON');
    // the steps of a Won record fill in after its reservation / contract lookups, so allow them time to settle
    await expect.configure({ soft: true }).poll(async () => (await opps.workflow()).filter(s => s.state !== 'done').map(s => s.name),
      { message: 'Workflow steps not Done', timeout: 10_000 }).toEqual([]);
    const forms = await opps.formHeadings();
    note('actions on a Won record', forms.join(' · '));
    expect.soft(forms.filter(f => /Schedule Visit & Continue|Complete Site Visit/.test(f)), 'Stage-advancing actions').toEqual([]);
    if (forms.includes('Mark Lost')) note('observation', 'A Won opportunity still offers "Mark Lost" — confirm whether a won deal may be marked lost');
  });
});

test.describe('Opportunities · Create, Edit, Delete (read-only parts)', () => {
  // ── OPP-018 · A lead that is not qualified cannot be converted
  // Use case: UC-OPP-002 Create Opportunity
  // Checks: Lead Detail does not offer "Move to Opportunity"
  test(...opp('OPP-018'), async ({ leads }) => {
    await leads.open();
    await leads.openTab('To Qualify');
    const row = (await leads.rows()).find(r => r.status && r.status !== 'Qualified');
    test.skip(!row, 'No unqualified lead on the To Qualify tab');
    note('lead', row);
    await leads.openLead(row!.leadNo);
    await expect(leads.moveButton, `${row!.leadNo} (${row!.status}) offers no "Move to Opportunity"`).toHaveCount(0);
  });

  // ── OPP-020 · Opportunity fields can be edited
  // Use case: UC-OPP-004 Edit Opportunity
  // Checks: Budget, probability, expected close and project can be edited, saved and are shown when the record
  //   is reopened
  test(...oppSkipped('OPP-020', 'The app has no edit form for opportunity fields: budget, probability, expected close and project only change through workflow actions (visits, negotiation, reservation). Confirm whether direct editing is in scope.'));

  // ── OPP-054 · Delete is not offered in the UI
  // Use case: UC-OPP-011 Delete Opportunity
  // Checks: List, board and detail have no Delete action (policy to confirm: closing as Lost replaces deletion
  //   — see OBS-09)
  test(...opp('OPP-054'), async ({ opps, page }) => {
    await opps.open();
    const del = /^(delete|remove|archive|deactivate)\b/i;
    await expect.soft(page.locator('main').getByRole('button', { name: del }), 'List: no delete action').toHaveCount(0);
    await opps.openRecord((await opps.rows())[0].opp);
    await expect.soft(opps.detail.getByRole('button', { name: del }), 'Detail: no delete action').toHaveCount(0);
    await opps.closeDetail();
    await opps.showBoard();
    const moves = (await opps.boardCards(OPPORTUNITY_OPEN_STAGES[0])).flatMap(c => c.moves.map(m => m.label));
    expect.soft(moves.filter(m => del.test(m)), 'Board: no delete move').toEqual([]);
    note('policy', 'No delete in the UI; closing as Lost keeps the record (see OPP-056). Confirm this is the intended policy.');
  });
});
