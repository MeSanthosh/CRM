/** Opportunities · UC-OPP-005 Search (OPP-027…031) and UC-OPP-006 Filter and Sort (OPP-032…037). Read-only. */
import { test, expect, note } from './fixtures';
import { opp } from './catalog';
import { OPPORTUNITY_OPEN_STAGES } from '../locators';
import { parseNum } from '../helpers';
import { halfUnit } from '../sales-reports/shared';
import { OpportunitiesPage, OppRow, BoardColumn } from './OpportunitiesPage';

/** Opportunities the list currently reports (pager total, or the rows when the pager is hidden). */
async function count(opps: OpportunitiesPage): Promise<number> {
  if (await opps.emptyState.count()) return 0;
  return (await opps.pager.count()) ? (await opps.pagerInfo()).total : (await opps.rows()).length;
}
const has = (r: OppRow, term: string) => [r.opp, r.lead, r.customer, r.project].some(v => v.toLowerCase().includes(term.toLowerCase()));

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** "30 Sept 2026, 20:44" or "27 Jan 2026" (older rows show no time) → epoch ms */
function created(text: string): number {
  const m = text.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:,?\s*(\d{1,2}):(\d{2}))?/);
  if (!m) throw new Error(`Unexpected date "${text}"`);
  return new Date(+m[3], MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()), +m[1], +(m[4] ?? 0), +(m[5] ?? 0)).getTime();
}

/** Each value is in order with the next, allowing the display rounding of amounts (e.g. "0.45M USD" ± 5K). */
function expectOrdered(values: string[], dir: 'ascending' | 'descending', what: string, toNum: (s: string) => number = parseNum, slack: (s: string) => number = () => 0) {
  const bad: string[] = [];
  for (let i = 0; i + 1 < values.length; i++) {
    const [a, b] = [toNum(values[i]), toNum(values[i + 1])];
    const tol = slack(values[i]) + slack(values[i + 1]);
    if (dir === 'ascending' ? a > b + tol : a < b - tol) bad.push(`${values[i]} before ${values[i + 1]}`);
  }
  expect.soft(bad, `${what} ${dir}`).toEqual([]);
}
const amountSlack = (s: string) => halfUnit(s);

/**
 * Choosing a filter value and going back to "All" gives the same board as a freshly loaded one. Repeated
 * when a deal moved while it ran (the fresh boards before and after differ), since QA data is live.
 */
async function expectFreshBoard(opps: OpportunitiesPage, aria: 'Owner' | 'Project', value: string, what: string) {
  let fresh: BoardColumn[] = [], restored: BoardColumn[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    await opps.open();
    await opps.showBoard();
    fresh = await opps.boardColumns();
    await opps.setBoardFilter(aria, value);
    await opps.setBoardFilter(aria, '');
    restored = await opps.boardColumns();
    await opps.open();
    await opps.showBoard();
    if (JSON.stringify(await opps.boardColumns()) === JSON.stringify(fresh)) break;
  }
  const core = (cols: BoardColumn[]) => cols.map(({ stage, count, value }) => ({ stage, count, value })); // Show/Hide state is not part of the data
  expect.soft(core(restored), what).toEqual(core(fresh));
}

test.describe('Opportunities · Search (UC-OPP-005)', () => {
  // ── OPP-027 · Search by opportunity number
  // Use case: UC-OPP-005 Search Opportunity
  // Checks: Exactly the matching opportunity is listed, with the same values as before searching
  test(...opp('OPP-027'), async ({ opps }) => {
    await opps.open();
    const rows = await opps.rows();
    const target = rows[Math.min(3, rows.length - 1)];
    await opps.search(target.opp);
    const found = await opps.rows();
    note('search', `${target.opp} → ${found.map(r => r.opp).join(', ')}`);
    expect(found.map(r => r.opp), `Search "${target.opp}"`).toEqual([target.opp]);
    expect.soft(found[0], 'Same row as before searching').toEqual(target);
  });

  // ── OPP-028 · Search by customer name and by lead number
  // Use case: UC-OPP-005 Search Opportunity
  // Checks: Customer search: every row matches the term (number, lead, customer or project) and includes the
  //   2nd row; lead search: only that lead's opportunity
  test(...opp('OPP-028'), async ({ opps }) => {
    await opps.open();
    const target = (await opps.rows())[1];
    await opps.search(target.customer);
    const byCustomer = await opps.rows();
    note('customer search', `${target.customer} → ${byCustomer.length} rows`);
    expect.soft(byCustomer.map(r => r.opp), 'Searched record is found').toContain(target.opp);
    expect.soft(byCustomer.filter(r => !has(r, target.customer)).map(r => `${r.opp} ${r.customer}`), 'Rows not matching the customer').toEqual([]);
    await opps.search(target.lead);
    const byLead = await opps.rows();
    expect.soft(byLead.map(r => r.opp), `Search lead ${target.lead}`).toContain(target.opp);
    expect.soft(byLead.filter(r => r.lead !== target.lead).map(r => r.opp), 'Rows with another lead').toEqual([]);
  });

  // ── OPP-029 · Search with no match shows the empty state
  // Use case: UC-OPP-005 Search Opportunity
  // Checks: "No opportunities found." and Export disabled
  test(...opp('OPP-029'), async ({ opps }) => {
    await opps.open();
    await opps.search(`zz-no-such-opportunity-${Date.now()}`);
    await expect(opps.emptyState, 'Empty state').toBeVisible();
    expect.soft(await opps.rows(), 'No rows').toEqual([]);
    await expect.soft(opps.exportButton, 'Export disabled with nothing to export').toBeDisabled();
  });

  // ── OPP-030 · Clearing the search restores the list
  // Use case: UC-OPP-005 Search Opportunity
  // Checks: The search narrows the list; after clearing, the box is empty and the total and page 1 are as
  //   before
  test(...opp('OPP-030'), async ({ opps }) => {
    await opps.open();
    const before = await count(opps), firstPage = (await opps.rows()).map(r => r.opp);
    await opps.search((await opps.rows())[0].customer);
    expect.soft(await count(opps), 'Search narrows the list').toBeLessThan(before);
    await opps.clearSearch();
    await expect.soft(opps.searchBox, 'Search box emptied').toHaveValue('');
    expect.soft(await count(opps), 'All opportunities again').toBe(before);
    expect.soft((await opps.rows()).map(r => r.opp), 'Same first page as before').toEqual(firstPage);
  });

  // ── OPP-031 · Search ignores letter case
  // Use case: UC-OPP-005 Search Opportunity
  // Checks: All three searches return the same opportunities
  test(...opp('OPP-031'), async ({ opps }) => {
    await opps.open();
    const name = (await opps.rows()).find(r => /[a-z]/.test(r.customer) && /[A-Z]/.test(r.customer))?.customer ?? (await opps.rows())[0].customer;
    const results: Record<string, string[]> = {};
    for (const term of [name, name.toUpperCase(), name.toLowerCase()]) {
      await opps.search(term);
      results[term] = (await opps.rows()).map(r => r.opp).sort();
    }
    note('case', Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.length])));
    expect.soft(results[name.toUpperCase()], 'UPPER-CASE finds the same opportunities').toEqual(results[name]);
    expect.soft(results[name.toLowerCase()], 'lower-case finds the same opportunities').toEqual(results[name]);
  });
});

test.describe('Opportunities · Filter and Sort (UC-OPP-006)', () => {
  // ── OPP-032 · Sort by Budget
  // Use case: UC-OPP-006 Filter and Sort Opportunities
  // Checks: Budget sorts ascending and descending by the amount shown, the header shows the direction, and the
  //   order continues across pages
  test(...opp('OPP-032'), async ({ opps }) => {
    await opps.open();
    for (const dir of ['ascending', 'descending'] as const) {
      await opps.sortTo('Budget', dir);
      const p1 = (await opps.rows()).map(r => r.budget);
      expectOrdered(p1, dir, 'Budget, page 1', parseNum, amountSlack);
      if (await opps.pagerButton('Next').isEnabled()) {
        await opps.reload(() => opps.pagerButton('Next').click());
        const p2 = (await opps.rows()).map(r => r.budget);
        expectOrdered([p1[p1.length - 1], ...p2], dir, 'Budget, page 1 → page 2', parseNum, amountSlack);
        await opps.reload(() => opps.pagerButton('Previous').click());
      }
      note(`budget ${dir}`, p1.slice(0, 5).join(' | '));
    }
  });

  // ── OPP-033 · Sort by Created Date
  // Use case: UC-OPP-006 Filter and Sort Opportunities
  // Checks: Default is newest first (Created Date ▼); ascending gives oldest first
  test(...opp('OPP-033'), async ({ opps }) => {
    await opps.open();
    expect.soft(await opps.sortHeader('Created Date').getAttribute('aria-sort'), 'Default sort').toBe('descending');
    expectOrdered((await opps.rows()).map(r => r.created), 'descending', 'Created Date (default)', created);
    await opps.sortTo('Created Date', 'ascending');
    expectOrdered((await opps.rows()).map(r => r.created), 'ascending', 'Created Date', created);
  });

  // ── OPP-034 · Sort by Probability and Customer
  // Use case: UC-OPP-006 Filter and Sort Opportunities
  // Checks: Probability sorts numerically and Customer alphabetically (letters and digits; spaces and
  //   punctuation ignored, as the database does), both directions
  test(...opp('OPP-034'), async ({ opps }) => {
    await opps.open();
    for (const dir of ['ascending', 'descending'] as const) {
      await opps.sortTo('Probability', dir);
      expectOrdered((await opps.rows()).map(r => r.probability), dir, 'Probability');
      await opps.sortTo('Customer', dir);
      // the database collation ignores spaces and punctuation ("Buyer19 Demo" < "Buyer1 Demo"), so compare letters and digits only
      const key = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '');
      const names = (await opps.rows()).map(r => r.customer);
      const bad = names.slice(1).map((n, i) => [names[i], n]).filter(([a, b]) => (dir === 'ascending' ? 1 : -1) * key(a).localeCompare(key(b), 'en') > 0);
      expect.soft(bad.map(([a, b]) => `${a} before ${b}`), `Customer ${dir}`).toEqual([]);
    }
  });

  // ── OPP-035 · Board Owner filter
  // Use case: UC-OPP-006 Filter and Sort Opportunities
  // Checks: Only that owner's cards are shown and no column count rises; "All owners" gives the same board as a
  //   freshly loaded one
  test(...opp('OPP-035'), async ({ opps }) => {
    await opps.open();
    await opps.showBoard();
    const all = await opps.boardColumns();
    const owners = (await opps.boardOptions('Owner')).filter(o => o.value);
    let checked = 0;
    for (const o of owners) {
      await opps.setBoardFilter('Owner', o.value);
      const cols = await opps.boardColumns();
      const cards = (await Promise.all(cols.map(c => opps.boardCards(c.stage)))).flat();
      for (const c of cols) expect.soft(c.count, `${o.label}: ${c.stage} count ≤ all owners`).toBeLessThanOrEqual(all.find(a => a.stage === c.stage)!.count);
      expect.soft(cards.filter(c => c.owner !== o.label).map(c => `${c.oppNo} (${c.owner})`), `Cards of other owners under "${o.label}"`).toEqual([]);
      if (cards.length) checked++;
      if (checked >= 2) break;
    }
    test.skip(!checked, 'No owner has opportunities on the board');
    await opps.setBoardFilter('Owner', '');
    await expectFreshBoard(opps, 'Owner', owners[0].value, 'All owners restores the board');
  });

  // ── OPP-036 · Board Project filter
  // Use case: UC-OPP-006 Filter and Sort Opportunities
  // Checks: Only cards of that project are shown and no column count rises; "All projects" gives the same board
  //   as a freshly loaded one
  test(...opp('OPP-036'), async ({ opps, api }) => {
    await opps.open();
    await opps.showBoard();
    const all = await opps.boardColumns();
    const projects = (await opps.boardOptions('Project')).filter(o => o.value);
    test.skip(!projects.length, 'No projects to filter by');
    let checked = false;
    for (const p of projects) {
      await opps.setBoardFilter('Project', p.value);
      const cols = await opps.boardColumns();
      const cards = (await Promise.all(cols.map(c => opps.boardCards(c.stage)))).flat();
      for (const c of cols) expect.soft(c.count, `${p.label}: ${c.stage} count ≤ all projects`).toBeLessThanOrEqual(all.find(a => a.stage === c.stage)!.count);
      if (!cards.length) continue;
      const wrong: string[] = [];
      for (const card of cards.slice(0, 15)) {
        const rec = (await api.searchOpportunities(card.oppNo)).find(r => r.opportunityNo === card.oppNo);
        if (rec && rec.projectCode !== p.value) wrong.push(`${card.oppNo} (${rec.projectCode ?? 'no project'})`);
      }
      note('project', `${p.label}: ${cards.length} cards`);
      expect.soft(wrong, `Cards of other projects under "${p.label}"`).toEqual([]);
      checked = true;
      break;
    }
    if (!checked) note('project', 'No project has opportunities on the board; only the counts were checked');
    await opps.setBoardFilter('Project', '');
    await expectFreshBoard(opps, 'Project', projects[0].value, 'All projects restores the board');
  });

  // ── OPP-037 · Board closed-deals window
  // Use case: UC-OPP-006 Filter and Sort Opportunities
  // Checks: Won/Lost counts never shrink from 30 days → 90 days → all time, and this year ≤ all time; open
  //   columns do not change
  test(...opp('OPP-037'), async ({ opps }) => {
    await opps.open();
    await opps.showBoard();
    const open = (cols: BoardColumn[]) => cols.filter(c => OPPORTUNITY_OPEN_STAGES.includes(c.stage));
    const by: Record<string, BoardColumn[]> = {};
    // if a deal moves while the four windows are read (open columns differ), read them again
    for (let attempt = 0; attempt < 3; attempt++) {
      for (const w of ['30', '90', 'year', 'all']) {
        await opps.setBoardFilter('Closed deals', w);
        by[w] = await opps.boardColumns();
      }
      await opps.setBoardFilter('Closed deals', '30');
      if (JSON.stringify(open(await opps.boardColumns())) === JSON.stringify(open(by['30']))
        && ['90', 'year', 'all'].every(w => JSON.stringify(open(by[w])) === JSON.stringify(open(by['30'])))) break;
    }
    const n = (w: string, stage: string) => by[w].find(c => c.stage === stage)?.count ?? 0;
    note('closed deals', Object.fromEntries(Object.keys(by).map(w => [w, { won: n(w, 'Won'), lost: n(w, 'Lost') }])));
    for (const stage of ['Won', 'Lost']) {
      expect.soft(n('30', stage), `${stage}: 30 days ≤ 90 days`).toBeLessThanOrEqual(n('90', stage));
      expect.soft(n('90', stage), `${stage}: 90 days ≤ all time`).toBeLessThanOrEqual(n('all', stage));
      expect.soft(n('year', stage), `${stage}: this year ≤ all time`).toBeLessThanOrEqual(n('all', stage));
    }
    for (const w of ['90', 'year', 'all']) expect.soft(open(by[w]), `Open columns unchanged with "${w}"`).toEqual(open(by['30']));
  });
});
