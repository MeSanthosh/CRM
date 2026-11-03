/**
 * Opportunities · Board view (OPP-061…073). Read-only: the Mark as Lost dialog is opened and cancelled.
 * The Board tests that change QA data (OPP-074…078) are at the end of lifecycle.spec.ts, so they never run at the
 * same time as the main lifecycle (both convert a lead, which would upset each other's "+1" counts).
 */
import { test, expect, note, WRITE_ENDPOINT } from './fixtures';
import { opp } from './catalog';
import { OPP, OPPORTUNITY_BOARD_COLUMNS, OPPORTUNITY_OPEN_STAGES } from '../locators';
import { download, parseNum, ymd } from '../helpers';
import { halfUnit } from '../sales-reports/shared';
import { OpportunitiesPage, BoardCard } from './OpportunitiesPage';
import { CrmApi } from './api';

const HINT = 'Drag a card or use "Move / mark Lost…". Most stages advance automatically from site visits and negotiation notes; the board only offers moves the workflow allows.';
const prob = (c: BoardCard) => parseNum(c.tags.find(t => /^\d+%$/.test(t)) ?? '0');
const days = (c: BoardCard) => { const t = c.tags.find(x => /in stage$/.test(x)); return t ? Number(t.match(/(\d+)d/)?.[1]) : NaN; };
/** "Weighted 0.47M USD" → "0.47M USD" */
const weightedText = (t: string) => t.replace(/^Weighted\s*/i, '');
const within = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol + 1e-6;

async function openBoard(opps: OpportunitiesPage) {
  await opps.open();
  await opps.showBoard();
}
/** Opportunity record (with id) by number. */
async function record(api: CrmApi, oppNo: string) {
  const r = (await api.searchOpportunities(oppNo)).find(o => o.opportunityNo === oppNo);
  if (!r) throw new Error(`${oppNo} not found`);
  return api.opportunity(r.id);
}

test.describe('Opportunities · Board', () => {
  // ── OPP-061 · Board view shows its toolbar, hint and stage columns
  // Use case: UC-OPP-001 View Opportunities
  // Checks: Filters "All owners", "All projects", "Won / Lost: last 30 days"; the summary "Open pipeline: N
  //   deals · amount · weighted amount"; the hint "Drag a card or use "Move / mark Lost…"…"; columns Qualified,
  //   Site Visit, Negotiation, Reservation Ready, Proposal, Won, Lost; Search and Export stay available
  test(...opp('OPP-061'), async ({ opps, page }) => {
    await openBoard(opps);
    await expect.soft(opps.boardFilter('Owner'), 'Owner filter').toHaveValue('');
    await expect.soft(opps.boardFilter('Owner').locator('option:checked'), 'Owner label').toHaveText('All owners');
    await expect.soft(opps.boardFilter('Project').locator('option:checked'), 'Project label').toHaveText('All projects');
    await expect.soft(opps.boardFilter('Closed deals').locator('option:checked'), 'Closed-deals window').toHaveText('Won / Lost: last 30 days');
    note('summary', (await opps.boardSummary()).text);
    await expect.soft(page.locator(OPP.boardHint), 'Hint').toHaveText(HINT);
    expect.soft((await opps.boardColumns()).map(c => c.stage), 'Columns').toEqual(OPPORTUNITY_BOARD_COLUMNS);
    await expect.soft(opps.searchBox, 'Search').toBeVisible();
    await expect.soft(opps.exportButton, 'Export').toBeVisible();
  });

  // ── OPP-062 · Board column headers add up their cards
  // Use case: UC-OPP-001 View Opportunities
  // Checks: Count = number of cards; value = sum of the card values; weighted = sum of value × probability
  //   (each within display rounding)
  test(...opp('OPP-062'), async ({ opps }) => {
    await openBoard(opps);
    const cols = (await opps.boardColumns()).filter(c => OPPORTUNITY_OPEN_STAGES.includes(c.stage));
    const report: Record<string, unknown> = {};
    for (const col of cols) {
      const cards = await opps.boardCards(col.stage);
      if (cards.length !== col.count) { report[col.stage] = `count ${col.count} but ${cards.length} cards shown (board shows up to 50)`; continue; }
      const value = cards.reduce((a, c) => a + parseNum(c.value), 0);
      const weighted = cards.reduce((a, c) => a + parseNum(c.value) * prob(c) / 100, 0);
      const tol = halfUnit(col.value) + cards.reduce((a, c) => a + halfUnit(c.value), 0);
      const wTol = halfUnit(weightedText(col.weighted)) + cards.reduce((a, c) => a + halfUnit(c.value) * prob(c) / 100, 0);
      report[col.stage] = { count: col.count, value: col.value, sumOfCards: Math.round(value), weighted: col.weighted, sumWeighted: Math.round(weighted) };
      expect.soft(within(parseNum(col.value), value, tol), `${col.stage}: value ${col.value} vs cards ${Math.round(value)}`).toBe(true);
      expect.soft(within(parseNum(weightedText(col.weighted)), weighted, wTol), `${col.stage}: ${col.weighted} vs Σ value × probability ${Math.round(weighted)}`).toBe(true);
    }
    note('columns', report);
  });

  // ── OPP-063 · Board summary equals the open columns
  // Use case: UC-OPP-001 View Opportunities
  // Checks: Deals = sum of the open column counts; amount = sum of their values; weighted = sum of their
  //   weighted values (within rounding)
  test(...opp('OPP-063'), async ({ opps }) => {
    await openBoard(opps);
    const sum = await opps.boardSummary();
    const cols = (await opps.boardColumns()).filter(c => OPPORTUNITY_OPEN_STAGES.includes(c.stage));
    const value = cols.reduce((a, c) => a + parseNum(c.value), 0), weighted = cols.reduce((a, c) => a + parseNum(weightedText(c.weighted)), 0);
    note('summary', { summary: sum.text, columns: cols.map(c => `${c.stage} ${c.count} · ${c.value} · ${c.weighted}`) });
    expect.soft(sum.deals, 'Deals = Σ open column counts').toBe(cols.reduce((a, c) => a + c.count, 0));
    expect.soft(within(parseNum(sum.value), value, halfUnit(sum.value) + cols.reduce((a, c) => a + halfUnit(c.value), 0)), `${sum.value} vs Σ columns ${Math.round(value)}`).toBe(true);
    expect.soft(within(parseNum(sum.weighted), weighted, halfUnit(sum.weighted) + cols.reduce((a, c) => a + halfUnit(weightedText(c.weighted)), 0)), `weighted ${sum.weighted} vs Σ columns ${Math.round(weighted)}`).toBe(true);
  });

  // ── OPP-064 · Board cards show the deal at a glance
  // Use case: UC-OPP-001 View Opportunities
  // Checks: Every card shows customer, budget, OPP number, probability (%), "Nd in stage", owner and a "Move /
  //   mark Lost…" menu
  test(...opp('OPP-064'), async ({ opps }) => {
    await openBoard(opps);
    const bad: string[] = [];
    for (const stage of OPPORTUNITY_OPEN_STAGES) {
      for (const c of await opps.boardCards(stage)) {
        const miss = [
          !c.customer && 'customer', !/\d/.test(c.value) && 'budget', !/^OPP-[\w-]+$/.test(c.oppNo) && 'number',
          !c.tags.some(t => /^\d+%$/.test(t)) && 'probability', !c.tags.some(t => /^\d+d in stage$/.test(t)) && 'days in stage',
          !c.owner && 'owner', !c.moves.length && 'move menu',
        ].filter(Boolean);
        if (miss.length) bad.push(`${stage} ${c.oppNo || '?'}: missing ${miss.join(', ')}`);
      }
    }
    expect(bad, 'Cards missing information').toEqual([]);
  });

  // ── OPP-065 · Board cards match the List
  // Use case: UC-OPP-001 View Opportunities
  // Checks: Customer, budget and probability are the same as the List row, and the card sits in the column of
  //   the row's stage
  test(...opp('OPP-065'), async ({ opps }) => {
    test.setTimeout(180_000);
    await openBoard(opps);
    const sample: { stage: string; card: BoardCard }[] = [];
    for (const stage of OPPORTUNITY_OPEN_STAGES) for (const card of (await opps.boardCards(stage)).slice(0, 3)) sample.push({ stage, card });
    await opps.showList();
    const diffs: string[] = [];
    for (const { stage, card } of sample) {
      await opps.search(card.oppNo);
      const row = (await opps.rows()).find(r => r.opp === card.oppNo);
      if (!row) { diffs.push(`${card.oppNo}: not found in the List`); continue; }
      if (row.customer !== card.customer) diffs.push(`${card.oppNo} customer: List "${row.customer}" vs card "${card.customer}"`);
      if (row.budget !== card.value) diffs.push(`${card.oppNo} budget: List "${row.budget}" vs card "${card.value}"`);
      if (row.probability !== `${prob(card)}%`) diffs.push(`${card.oppNo} probability: List ${row.probability} vs card ${prob(card)}%`);
      if (row.stage !== stage) diffs.push(`${card.oppNo} stage: List "${row.stage}" vs column "${stage}"`);
    }
    note('compared', sample.length);
    expect.soft(diffs, 'Board cards vs List').toEqual([]);
  });

  // ── OPP-066 · "Days in stage" and the stale highlight
  // Use case: UC-OPP-001 View Opportunities
  // Checks: "Nd in stage" = whole days since the last stage change (±1); every highlighted card has been in its
  //   stage longer than every plain one
  test(...opp('OPP-066'), async ({ opps, api }) => {
    await openBoard(opps);
    const all: BoardCard[] = [];
    for (const stage of OPPORTUNITY_OPEN_STAGES) all.push(...await opps.boardCards(stage));
    const checks: string[] = [];
    for (const c of all.slice(0, 5)) {
      const rec = await record(api, c.oppNo);
      const last = [...(rec.stageHistory ?? [])].sort((a: any, b: any) => Date.parse(b.changedAt) - Date.parse(a.changedAt))[0];
      const expected = last ? Math.floor((Date.now() - Date.parse(last.changedAt)) / 86_400_000) : NaN;
      checks.push(`${c.oppNo}: card ${days(c)}d, since last stage change ${expected}d`);
      expect.soft(Math.abs(days(c) - expected) <= 1, `${c.oppNo}: "${days(c)}d in stage" vs ${expected} days since ${last?.opportunityStage?.name}`).toBe(true);
    }
    const stale = all.filter(c => c.stale).map(days), plain = all.filter(c => !c.stale).map(days);
    note('days in stage', { checks, staleMin: Math.min(...stale), plainMax: Math.max(...plain) });
    if (stale.length && plain.length) expect.soft(Math.min(...stale), 'Every highlighted card is older than every plain one').toBeGreaterThan(Math.max(...plain));
  });

  // ── OPP-067 · "Reserved" tag shows deals with an active reservation
  // Use case: UC-OPP-001 View Opportunities
  // Checks: "Reserved" cards have a Requested or Approved reservation; cards without the tag have none
  test(...opp('OPP-067'), async ({ opps, api }) => {
    await openBoard(opps);
    const cards = await opps.boardCards('Reservation Ready');
    const sample = [...cards.filter(c => c.reserved).slice(0, 5), ...cards.filter(c => !c.reserved).slice(0, 5)];
    test.skip(!sample.length, 'No Reservation Ready cards');
    const diffs: string[] = [], seen: string[] = [];
    for (const c of sample) {
      const rec = await record(api, c.oppNo);
      const res = (await api.get(`/reservations?limit=20&offset=0&opportunityId=${rec.id}`)).body.items ?? [];
      const active = res.filter((r: any) => r.opportunity?.id === rec.id && ['Requested', 'Approved'].includes(r.reservationStatus?.name));
      seen.push(`${c.oppNo}: tag ${c.reserved ? 'Reserved' : '—'}, active reservations ${active.map((r: any) => `${r.reservationNo} ${r.reservationStatus?.name}`).join(', ') || 'none'}`);
      if (c.reserved !== active.length > 0) diffs.push(`${c.oppNo}: "Reserved" ${c.reserved ? 'shown' : 'not shown'} but ${active.length} active reservation(s)`);
    }
    note('reservations', seen);
    expect.soft(diffs, '"Reserved" tag vs active reservations').toEqual([]);
  });

  // ── OPP-068 · Opening a card shows the opportunity
  // Use case: UC-OPP-003 View Opportunity Details
  // Checks: Both open the Opportunity Detail of that card's opportunity
  test(...opp('OPP-068'), async ({ opps, page }) => {
    await openBoard(opps);
    const card = (await opps.boardCards('Qualified'))[0] ?? (await opps.boardCards('Site Visit'))[0];
    test.skip(!card, 'No open card');
    await opps.boardCard(card.oppNo).locator('.crm-board-card-top').click();
    await opps.detailLoaded(card.oppNo);
    await opps.closeDetail();
    await opps.boardCard(card.oppNo).focus();
    await page.keyboard.press('Enter');
    await opps.detailLoaded(card.oppNo);
  });

  // ── OPP-069 · Search filters the Board
  // Use case: UC-OPP-005 Search Opportunity
  // Checks: Only that customer's cards remain; column counts and the summary follow the search; clearing it
  //   restores the board
  test(...opp('OPP-069'), async ({ opps }) => {
    await openBoard(opps);
    const before = await opps.boardSummary();
    const term = (await opps.boardCards('Reservation Ready'))[0]?.customer;
    test.skip(!term, 'No Reservation Ready card');
    await opps.searchBoard(term);
    const cols = await opps.boardColumns();
    const open = cols.filter(c => OPPORTUNITY_OPEN_STAGES.includes(c.stage));
    const cards = (await Promise.all(open.map(c => opps.boardCards(c.stage)))).flat();
    const sum = await opps.boardSummary();
    note('search', { term, summary: sum.text, columns: cols.map(c => `${c.stage} ${c.count}`) });
    expect.soft(cards.filter(c => !c.customer.toLowerCase().includes(term.toLowerCase()) && !c.oppNo.includes(term)).map(c => `${c.oppNo} ${c.customer}`), 'Cards not matching').toEqual([]);
    for (const c of open) expect.soft((await opps.boardCards(c.stage)).length, `${c.stage} count follows the search`).toBe(c.count);
    expect.soft(sum.deals, 'Summary follows the search').toBe(open.reduce((a, c) => a + c.count, 0));
    await opps.searchBoard('');
    expect.soft((await opps.boardSummary()).deals, 'Clearing restores the board').toBe(before.deals);
  });

  // ── OPP-070 · Export from the Board follows the search
  // Use case: UC-OPP-001 View Opportunities
  // Checks: A file "opportunities-<today>.xlsx" downloads with the opportunity columns (Opportunity No,
  //   Customer, Lead No, Stage, Status, …) holding exactly the opportunities the search finds
  test(...opp('OPP-070'), async ({ opps, api, page }) => {
    await openBoard(opps);
    const term = (await opps.boardCards('Reservation Ready'))[0]?.customer;
    test.skip(!term, 'No Reservation Ready card');
    await opps.searchBoard(term);
    const file = await download(page, opps.exportButton);
    const expected = (await api.searchOpportunities(term)).map(o => o.opportunityNo).sort();
    note('export', { term, file: file.name, rows: file.rows.length, expected: expected.length });
    expect.soft(file.name, 'File name').toBe(`opportunities-${ymd(new Date())}.xlsx`);
    expect.soft(file.header.slice(0, 5), 'First columns').toEqual(['Opportunity No', 'Customer', 'Lead No', 'Stage', 'Status']);
    expect.soft(file.rows.map(r => String(r['Opportunity No'])).sort(), 'Same opportunities as the search').toEqual(expected);
  });

  // ── OPP-071 · Won and Lost columns open and close
  // Use case: UC-OPP-006 Filter and Sort Opportunities
  // Checks: Won and Lost say "Closed last 30 days"; a collapsed column offers Show and lists no cards, Show
  //   lists its cards (as many as the count, up to 50) and turns into Hide, Hide collapses it again (the choice
  //   is remembered per user); the header follows the window ("Closed last 90 days")
  test(...opp('OPP-071'), async ({ opps }) => {
    await openBoard(opps);
    for (const stage of ['Won', 'Lost']) {
      const col = (await opps.boardColumns()).find(c => c.stage === stage)!;
      expect.soft(col.weighted, `${stage} header`).toBe('Closed last 30 days');
      const toggle = opps.columnToggle(stage);
      const cards = () => opps.page.locator(OPP.boardColumn(stage)).locator(OPP.boardCard).count();
      // the Show / Hide choice is saved per user, so start from whatever state the column is in
      if (!(await opps.collapsed(stage))) { await toggle.click(); await expect.soft(toggle, `${stage}: Hide collapses`).toHaveText('Show'); }
      expect.soft(await cards(), `${stage}: collapsed shows no cards`).toBe(0);
      await toggle.click();
      await expect.soft(toggle, `${stage}: Show turns into Hide`).toHaveText('Hide');
      await expect.poll(cards, { message: `${stage}: cards listed` }).toBe(Math.min(col.count, 50));
      await toggle.click();
      await expect.soft(toggle, `${stage}: Hide turns back into Show`).toHaveText('Show');
      expect.soft(await cards(), `${stage}: collapsed again`).toBe(0);
    }
    await opps.setBoardFilter('Closed deals', '90');
    for (const stage of ['Won', 'Lost']) expect.soft((await opps.boardColumns()).find(c => c.stage === stage)!.weighted, `${stage} header with 90 days`).toBe('Closed last 90 days');
  });

  // ── OPP-072 · Card menu lists the possible moves
  // Use case: UC-OPP-007 Change Opportunity Stage
  // Checks: The menu never offers the card's own stage; it always offers Lost; Won is marked "(not from board)"
  test(...opp('OPP-072'), async ({ opps }) => {
    await openBoard(opps);
    const seen: Record<string, string[]> = {};
    for (const stage of OPPORTUNITY_OPEN_STAGES) {
      const card = (await opps.boardCards(stage))[0];
      if (!card) continue;
      const labels = card.moves.map(m => m.label);
      seen[stage] = labels;
      expect.soft(labels.filter(l => l.replace(/\s*\(not from board\)$/, '') === stage), `${stage}: own stage offered`).toEqual([]);
      expect.soft(labels, `${stage}: Lost offered`).toContain('Lost');
      expect.soft(labels.find(l => l.startsWith('Won')), `${stage}: Won is not a board move`).toBe('Won (not from board)');
    }
    note('menus', seen);
  });

  // ── OPP-073 · Mark as Lost from a card can be cancelled
  // Use case: UC-OPP-009 Mark Opportunity as Lost
  // Checks: Dialog "Mark as Lost" with Lost Reason (Price, Funding Issue, Competitor, No Decision, Timing),
  //   Remarks, Cancel and Continue; Cancel closes it, sends nothing and leaves the card in its column
  test(...opp('OPP-073'), async ({ opps, page }) => {
    await openBoard(opps);
    const card = (await opps.boardCards('Qualified'))[0] ?? (await opps.boardCards('Site Visit'))[0];
    test.skip(!card, 'No open card');
    const writes: string[] = [];
    page.on('request', r => { if (r.method() !== 'GET' && WRITE_ENDPOINT.test(r.url())) writes.push(`${r.method()} ${r.url()}`); });
    await opps.moveCard(card.oppNo, 'Lost');
    const d = opps.lostDialog;
    await expect(d, 'Mark as Lost dialog').toBeVisible();
    expect.soft((await d.locator('select option').allInnerTexts()).map(t => t.trim()), 'Lost reasons').toEqual(['Select reason', 'Price', 'Funding Issue', 'Competitor', 'No Decision', 'Timing']);
    await expect.soft(d.locator('textarea'), 'Remarks').toBeVisible();
    await expect.soft(d.getByRole('button', { name: 'Continue' }), 'Continue').toBeVisible();
    await d.getByRole('button', { name: 'Cancel' }).click();
    await expect(d, 'Dialog closed').toHaveCount(0);
    await expect.soft(opps.boardCard(card.oppNo).locator(OPP.boardMoveSelect), 'Menu reset').toHaveValue('');
    expect.soft(writes, 'Nothing sent').toEqual([]);
    expect.soft((await opps.boardCards('Qualified')).concat(await opps.boardCards('Site Visit')).some(c => c.oppNo === card.oppNo), 'Card still on the board').toBe(true);
  });
});
