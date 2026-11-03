/**
 * Opportunities page (OPP-001 … OPP-032). One worker, in this order: the list and its cards, the Kanban board,
 * then one opportunity built by the test: hold a new test unit for it, then mark it Lost (which releases the hold).
 */
import { test, expect, opp, note, DATA, S, list, runDeal, runUnit, oppRows, cards, cardNames, isOpen, tolerance, openOpportunity, oppAction, holdsOf } from './shared';
import { ModalForm, ModulePage, PipelineBoard, UnitPicker } from '../pages/SalesPages';
import { XP, at } from '../locators';
import { runValue } from '../sales-chain/data';

const lower = (s: string) => s.toLowerCase();

test.describe('Opportunities · Table register', () => {
  test.describe.configure({ timeout: 300_000 });

  test(...opp('OPP-001'), async ({ opps }) => {
    await opps.open();
    const title = await opps.title();
    note('title', title);
    expect.soft(title, 'Page title').toContain(S('Page Title'));
    for (const c of cardNames()) note(`card ${c}`, await opps.kpiText(c));
    for (const b of [S('List View'), S('Board View'), S('Export Button')]) expect.soft(await opps.page.locator('main').getByRole('button', { name: b, exact: true }).count(), `${b} button`).toBeGreaterThan(0);
    expect.soft(await opps.headers(), 'List columns').toEqual(DATA.sheet('Register Columns').map(r => r['Column']));
  });

  test(...opp('OPP-002'), async ({ opps }) => {
    const c = await cards(opps);
    const total = await opps.pagerTotal();
    const rows = await oppRows(opps);
    const won = rows.filter(r => r.stage === S('Won Stage')).length, lost = rows.filter(r => r.stage === S('Lost Stage')).length;
    note('Total / listed / Open + Won + Lost', `${c['Total']} / ${total} (${rows.length} rows read) / ${c['Open']} + ${won} + ${lost}`);
    expect.soft(c['Total'], 'Total card = opportunities listed ("of N opportunities")').toBe(total);
    expect(c['Total'], 'Total card = Open card + Won rows + Lost rows').toBe(c['Open'] + won + lost);
  });

  test(...opp('OPP-003'), async ({ opps }) => {
    const c = await cards(opps);
    const rows = await oppRows(opps);
    const open = rows.filter(r => isOpen(r.stage));
    note('Open card / open rows', `${c['Open']} / ${open.length} (stages: ${[...new Set(rows.map(r => r.stage))].map(s => `${s} ${rows.filter(r => r.stage === s).length}`).join(', ')})`);
    expect(c['Open'], `Open card = opportunities in an open stage (${list('Open Stages').join(', ')})`).toBe(open.length);
  });

  test(...opp('OPP-004'), async ({ opps }) => {
    const c = await cards(opps);
    const open = (await oppRows(opps)).filter(r => isOpen(r.stage));
    const sum = open.reduce((a, r) => a + r.budget, 0);
    note('Pipeline Value / Σ budget of open rows', `${c['Pipeline Value']} / ${sum} (${open.length} rows)`);
    expect(Math.abs(c['Pipeline Value'] - sum), 'Pipeline Value − total budget of the open opportunities').toBeLessThanOrEqual(tolerance(sum, open.length));
  });

  test(...opp('OPP-005'), async ({ opps }) => {
    const c = await cards(opps);
    const open = (await oppRows(opps)).filter(r => isOpen(r.stage));
    const avg = open.length ? open.reduce((a, r) => a + r.probability, 0) / open.length : 0;
    note('Avg Probability / average of open rows', `${c['Avg Probability']}% / ${avg.toFixed(2)}% (${open.length} rows)`);
    expect(Math.abs(c['Avg Probability'] - avg), 'Avg Probability − average probability of the open opportunities').toBeLessThanOrEqual(1);
  });

  test(...opp('OPP-006'), async ({ opps, chain }) => {
    const d = await runDeal(chain);
    for (const text of [d.opportunity, d.buyer.name, d.leadNo]) {
      await opps.open();
      await opps.search(S('Search Placeholder'), text);
      const rows = await opps.rows();
      note(`search "${text}"`, `${rows.length} rows: ${rows.slice(0, 5).map(r => r.lines[0]).join(', ')}`);
      expect.soft(rows.some(r => r.text.includes(d.opportunity)), `Search "${text}" lists ${d.opportunity}`).toBeTruthy();
      expect.soft(rows.filter(r => !lower(r.text).includes(lower(text))).map(r => r.lines[0]), `Rows of search "${text}" that do not contain it`).toEqual([]);
    }
  });

  test(...opp('OPP-007'), async ({ opps }) => {
    const rows = await oppRows(opps);
    await opps.open();
    const file = await opps.export(S('Export Button'));
    const cells = new Set(file.rows.flatMap(r => Object.values(r)));
    note('export', `${file.name}: ${file.rows.length} rows; list ${rows.length}`);
    expect.soft(file.rows.length, 'Rows in the export = opportunities in the list').toBe(rows.length);
    expect(rows.map(r => r.number).filter(n => !cells.has(n)), 'Every opportunity number is in the export').toEqual([]);
  });
});

test.describe('Opportunities · Kanban board', () => {
  test.describe.configure({ timeout: 600_000 });

  test(...opp('OPP-011'), async ({ opps, page }) => {
    const c = await cards(opps);
    const board = new PipelineBoard(page);
    await board.open(S('Board View'));
    const cols = (await board.columns()).filter(x => isOpen(x.stage));
    const sum = await board.summary();
    const deals = cols.reduce((a, x) => a + x.count, 0), value = cols.reduce((a, x) => a + x.value, 0);
    note('board', `${sum.text} · columns ${cols.map(x => `${x.stage} ${x.count} / ${x.value}`).join(', ')} · cards Open ${c['Open']}, Pipeline Value ${c['Pipeline Value']}`);
    expect.soft(sum.text, 'Board summary').toContain(S('Board Summary Start'));
    expect.soft(deals, 'Open-stage column counts added up = "Open pipeline: N deals"').toBe(sum.deals);
    expect.soft(sum.deals, '"Open pipeline: N deals" = Open card').toBe(c['Open']);
    expect.soft(Math.abs(value - sum.value), 'Open-stage column values added up − summary value').toBeLessThanOrEqual(tolerance(sum.value, cols.length));
    expect(Math.abs(sum.value - c['Pipeline Value']), 'Summary value − Pipeline Value card').toBeLessThanOrEqual(tolerance(c['Pipeline Value'], 1));
  });

  test(...opp('OPP-012'), async ({ opps, page }) => {
    await opps.open();
    const board = new PipelineBoard(page);
    await board.open(S('Board View'));
    for (const col of (await board.columns()).filter(x => !x.collapsed)) {
      const budget = col.cards.reduce((a, x) => a + x.budget, 0);
      note(`column ${col.stage}`, `count ${col.count}, cards ${col.cards.length}, value ${col.value}, Σ card budgets ${budget}`);
      expect.soft(col.cards.length, `${col.stage}: cards shown = column count`).toBe(col.count);
      expect.soft(Math.abs(col.value - budget), `${col.stage}: column value − Σ card budgets`).toBeLessThanOrEqual(tolerance(col.value, col.cards.length));
    }
  });

  test(...opp('OPP-013'), async ({ opps, page }) => {
    await opps.open();
    const board = new PipelineBoard(page);
    await board.open(S('Board View'));
    const [all, ...owners] = await board.filterOptions(S('Owner Filter'));
    for (const owner of owners) {
      await board.filter(S('Owner Filter'), owner);
      const shown = (await board.columns()).filter(x => !x.collapsed).flatMap(x => x.cards);
      const other = shown.filter(x => !x.text.includes(owner));
      note(`owner ${owner}`, `${shown.length} cards${other.length ? `; other owners on ${other.slice(0, 5).map(x => x.opportunity).join(', ')}` : ''}`);
      expect.soft(other.map(x => x.opportunity), `Cards not owned by "${owner}" with that owner filter`).toEqual([]);
    }
    await board.filter(S('Owner Filter'), all);
  });

  test(...opp('OPP-014'), async ({ opps, page }) => {
    const rows = await oppRows(opps);
    await opps.open();
    const board = new PipelineBoard(page);
    await board.open(S('Board View'));
    const [all, ...projects] = await board.filterOptions(S('Project Filter'));
    for (const project of projects) {
      const code = project.split(' · ')[0].trim();
      await board.filter(S('Project Filter'), project);
      const onBoard = (await board.columns()).filter(x => isOpen(x.stage)).reduce((a, x) => a + x.count, 0);
      const inList = rows.filter(r => isOpen(r.stage) && r.project === code).length;
      note(`project ${code}`, `board ${onBoard} open deals · list ${inList} open rows with Project ${code}`);
      expect.soft(onBoard, `Open deals on the board for "${project}" = open rows of the list with Project ${code}`).toBe(inList);
    }
    await board.filter(S('Project Filter'), all);
  });

  test(...opp('OPP-015'), async ({ opps, page }) => {
    await opps.open();
    const board = new PipelineBoard(page);
    await board.open(S('Board View'));
    const cardsShown = (await board.columns()).filter(x => !x.collapsed).flatMap(x => x.cards.map(c => ({ ...c, stage: x.stage })));
    note('cards checked', String(cardsShown.length));
    for (const c of cardsShown) {
      const [prompt, ...moves] = c.moves;
      const lost = moves.find(m => m.label === S('Lost Stage'));
      const notFromBoard = moves.filter(m => m.label.endsWith(S('Not From Board')));
      expect.soft(prompt?.label, `${c.opportunity}: first option of the move menu`).toBe(S('Board Move Prompt'));
      expect.soft(lost && !lost.disabled, `${c.opportunity} (${c.stage}): "${S('Lost Stage')}" can be chosen`).toBeTruthy();
      expect.soft(notFromBoard.filter(m => !m.disabled).map(m => m.label), `${c.opportunity} (${c.stage}): "(not from board)" options that can still be chosen`).toEqual([]);
      expect.soft(moves.map(m => m.label.replace(S('Not From Board'), '').trim()), `${c.opportunity}: its own stage is not offered`).not.toContain(c.stage);
    }
  });
});

test.describe('Opportunities · Unit hold', () => {
  test.describe.configure({ timeout: 1_200_000 });

  test(...opp('OPP-022'), async ({ opps, chain }) => {
    const d = await runDeal(chain);
    const panel = await openOpportunity(opps, d.opportunity);
    const before = await panel.status();
    const seen = await oppAction(panel, 'Hold Without Unit');
    note('status before / after', `${before} / ${await panel.status()}`);
    expect.soft(seen.length, 'A message (or a disabled Hold Unit button) stops a hold without a unit').toBeGreaterThan(0);
    expect(seen.filter(n => /held|success/i.test(n.title) && n.kind !== 'error').map(n => n.text), 'No hold confirmed').toEqual([]);
    await panel.close();
  });

  test(...opp('OPP-021'), async ({ opps, chain, page }) => {
    const d = await runDeal(chain);
    const unit = await runUnit(chain);
    if (!runValue.get<boolean>('opportunities-held')) {
      const panel = await openOpportunity(opps, d.opportunity);
      const before = await panel.status();
      await panel.chooseUnit(unit.code, DATA.action('Opportunity Actions', 'Hold Unit').submit);
      const seen = await oppAction(panel, 'Hold Unit');
      expect.soft(seen.find(n => n.kind === 'error')?.text, 'Hold Unit error').toBeUndefined();
      expect.soft(await panel.status(), 'Stage unchanged by the hold').toBe(before);
      await panel.close();
      runValue.set('opportunities-held', true);
    }
    const holds = await holdsOf(page, unit.code);
    note('holds of the unit', holds.map(h => h.text.replace(/\s+/g, ' ')).join(' | ') || 'none');
    expect(holds.length, `Active hold of ${unit.code} in Inventory → Holds`).toBeGreaterThan(0);
    expect.soft(holds[0].opportunity, 'Hold lists the opportunity').toContain(d.opportunity);
    expect.soft(holds[0].status, 'Hold status').toBe(S('Hold Active Status'));
    expect.soft(holds[0].until, 'Hold shows a time left').toMatch(/left/i);
  });

  test(...opp('OPP-023'), async ({ chain, page }) => {
    const unit = await runUnit(chain);
    test.skip(!runValue.get<boolean>('opportunities-held'), 'The unit could not be held (OPP-021)');
    const rsv = new ModulePage(page, S('Reservations Route'));
    await rsv.open();
    const form = new ModalForm(page);
    await form.open(S('New Reservation Button'));
    const f = chain.names('Reservation');
    // another opportunity, not the one the unit is held for
    const d = await runDeal(chain);
    const other = (await form.options(f['Opportunity'])).slice(1).find(o => o && !o.includes(d.opportunity));
    test.skip(!other, 'No other opportunity is ready for a reservation');
    await form.set(f['Opportunity'], other!);
    note('reservation for', await form.selected(f['Opportunity']));
    await form.root.getByRole('button', { name: S('Choose Unit Button') }).click();
    const picker = new UnitPicker(page);
    await picker.offered(unit.code);
    const row = at(page, XP.unitPickerRow(unit.code));
    const shown = (await row.count()) > 0;
    const text = shown ? (await row.innerText()).replace(/\s+/g, ' ') : 'not listed';
    const select = row.getByRole('button', { name: 'Select' });
    const canSelect = shown && (await select.count()) > 0 && (await select.isEnabled());
    note('unit in the picker', text);
    expect.soft(!shown || text.includes(DATA.message('Held By')), `Held unit marked "${DATA.message('Held By')}" (or not listed)`).toBeTruthy();
    expect(canSelect, `Held unit ${unit.code} can be selected for another opportunity`).toBeFalsy();
    await page.keyboard.press('Escape');
    await form.close();
  });
});

test.describe('Opportunities · Mark Lost', () => {
  test.describe.configure({ timeout: 900_000 });

  test(...opp('OPP-031'), async ({ opps, chain }) => {
    const d = await runDeal(chain);
    test.skip(runValue.get<boolean>('opportunities-lost') === true, 'The opportunity was already marked Lost in this run');
    const panel = await openOpportunity(opps, d.opportunity);
    const seen = await oppAction(panel, 'Lost Without Reason');
    const status = await panel.status();
    note('status after', status);
    expect.soft(seen.length, 'A message (or a disabled Mark Lost button) asks for the Lost Reason').toBeGreaterThan(0);
    expect(status, 'Opportunity not marked Lost without a reason').not.toBe(S('Lost Stage'));
    await panel.close();
  });

  test(...opp('OPP-032'), async ({ opps, chain, page }) => {
    const d = await runDeal(chain);
    const unit = await runUnit(chain);
    const before = await cards(opps);
    if (!runValue.get<boolean>('opportunities-lost')) {
      const panel = await openOpportunity(opps, d.opportunity);
      const seen = await oppAction(panel, 'Mark Lost');
      expect.soft(seen.find(n => n.kind === 'error')?.text, 'Mark Lost error').toBeUndefined();
      await expect.poll(() => panel.status(), { timeout: 20_000, message: 'Stage after Mark Lost' }).toBe(S('Lost Stage'));
      await panel.close();
      runValue.set('opportunities-lost', true);
      const after = await cards(opps);
      note('cards Mark Lost', `before ${JSON.stringify(before)} → after ${JSON.stringify(after)}`);
      for (const [card, change] of Object.entries(DATA.countChanges('Mark Lost'))) {
        if (card in before) expect.soft(after[card] - before[card], `${card} card after Mark Lost`).toBe(Number(change));
      }
    }
    await opps.open();
    await opps.search(S('Search Placeholder'), d.opportunity);
    const row = (await opps.rows()).find(r => r.lines[0] === d.opportunity);
    expect.soft(row?.cells['Stage'], `Stage of ${d.opportunity} in the list`).toBe(S('Lost Stage'));
    if (runValue.get<boolean>('opportunities-held')) {
      const holds = await holdsOf(page, unit.code);
      note('active holds of the unit after Lost', holds.map(h => h.text.replace(/\s+/g, ' ')).join(' | ') || 'none');
      expect(holds.length, `Active holds of ${unit.code} after the deal is lost (hold released)`).toBe(0);
    }
  });
});
