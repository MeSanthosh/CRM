/**
 * Availability Summary → Stack Plan (AVS-012 … AVS-016): status chips, block headers, status filter, search, every
 * tile against the Pricing Matrix, a block's own Stack Plan. Read only.
 * Run: npx playwright test tests/availability-summary/stack.spec.ts
 */
import { test, expect, note, avs, S, DATA, statuses, sameAmount, bad, matrixRows, amount } from './shared';
import { XP, at } from '../locators';

const STACK = () => DATA.sheet('Page Views')[1]['View'];

test.describe('Availability Summary · Stack Plan', () => {
  test.describe.configure({ timeout: 600_000 });

  test(...avs('AVS-012'), async ({ av }) => {
    await av.open();
    const table = await av.rows();
    const sum = await av.summary(S('Summary Units Word'));
    await av.view(STACK());
    const chips = await av.statusChips();
    const tiles = await av.tiles();
    const heads = await av.blockHeaders();
    note('status chips', JSON.stringify(chips));
    note('block headers', heads.map(h => `${h.block}: ${h.floors} floors · ${h.units} units · ${JSON.stringify(h.parts)}`).join(' | '));
    const all = chips[S('Stack All Chip')];
    expect.soft(statuses().reduce((a, s) => a + (chips[s['Status']] ?? 0), 0), `${S('Stack All Chip')} = Available + Held + Reserved + Sold`).toBe(all);
    expect.soft(all, 'All = total units of the summary line').toBe(sum.total);
    expect.soft(tiles.length, 'One tile per unit').toBe(all);
    for (const s of statuses()) {
      expect.soft(chips[s['Status']] ?? 0, `${s['Status']} chip = summary line`).toBe(sum.parts[s['Summary Column']]?.n ?? 0);
      expect.soft(tiles.filter(t => t.status === s['Status']).length, `${s['Status']} chip = its tiles`).toBe(chips[s['Status']] ?? 0);
    }
    for (const h of heads) {
      const row = table.find(r => r.kind === 'block' && r.label === h.block);
      expect.soft(h.units, `${h.block} header units = its Summary Table Total`).toBe(row?.cells['Total'].n);
      expect.soft(h.floors, `${h.block} header floors = "N flrs" of its row`).toBe(Number((row?.extra.match(/(\d+) flrs?/) ?? ['', 'NaN'])[1]));
      expect.soft(h.parts['Avail'], `${h.block} header Avail = its row`).toBe(row?.cells['Available'].n);
      for (const s of statuses().filter(x => !['Available'].includes(x['Status']))) {
        if (h.parts[s['Status']] !== undefined) expect.soft(h.parts[s['Status']], `${h.block} header ${s['Status']} = its row`).toBe(row?.cells[s['Summary Column']].n);
      }
    }
    expect(heads.length, 'One header per block').toBe(table.filter(r => r.kind === 'block').length);
  });

  test(...avs('AVS-013'), async ({ av }) => {
    await av.open();
    await av.view(STACK());
    const chips = await av.statusChips();
    for (const s of statuses()) {
      // chips add up (Available + Held …): start each status from All
      await av.statusChip(S('Stack All Chip'));
      await av.statusChip(s['Status']);
      const tiles = (await av.tiles()).filter(t => !t.dimmed);
      const wrong = tiles.filter(t => t.status !== s['Status'] || t.letter !== s['Letter']).map(t => `${t.code} ${t.status}/${t.letter}`);
      note(`${s['Status']} chip`, `${chips[s['Status']]} · tiles ${tiles.length}`);
      expect.soft(tiles.length, `${s['Status']}: tiles = chip`).toBe(chips[s['Status']] ?? 0);
      expect.soft(bad(wrong), `${s['Status']}: every tile has that status and letter ${s['Letter']}`).toBe('');
    }
    await av.statusChip(S('Stack All Chip'));
    expect((await av.tiles()).filter(t => !t.dimmed).length, 'All shows every tile again (none dimmed)').toBe(chips[S('Stack All Chip')]);
  });

  test(...avs('AVS-014'), async ({ av }) => {
    await av.open();
    await av.view(STACK());
    const all = await av.tiles();
    const t = all[Math.floor(all.length / 2)];
    for (const [what, term, want] of [['unit code', t.code, all.filter(x => x.code === t.code)], ['product', t.product, all.filter(x => x.product === t.product)]] as const) {
      await av.search(term, S('Stack Search Placeholder'));
      const shown = (await av.tiles()).filter(x => !x.dimmed);
      note(`search ${what}`, `${term}: ${shown.length} tiles`);
      expect.soft(shown.map(x => x.code).sort(), `Search by ${what} "${term}" shows exactly its tiles`).toEqual(want.map(x => x.code).sort());
    }
    await av.search('', S('Stack Search Placeholder'));
    expect((await av.tiles()).filter(x => !x.dimmed).length, 'Clearing the search shows every tile (none dimmed)').toBe(all.length);
  });

  test(...avs('AVS-015'), async ({ av, pm }) => {
    await av.open();
    await av.view(STACK());
    const tiles = await av.tiles();
    const m = await matrixRows(pm);
    const wrong: string[] = [];
    for (const t of tiles) {
      const r = m.get(t.code);
      if (!r) { wrong.push(`${t.code}: not in the Pricing Matrix`); continue; }
      const cur = amount(r.cells['Current Price']);
      if (r.cells['Status'] !== t.status) wrong.push(`${t.code} status ${t.status} ≠ matrix ${r.cells['Status']}`);
      if (r.cells['Product'] !== t.product) wrong.push(`${t.code} product ${t.product} ≠ ${r.cells['Product']}`);
      if (Number(r.cells['Carpet']) !== t.area) wrong.push(`${t.code} area ${t.area} ≠ ${r.cells['Carpet']}`);
      if (!sameAmount(t.operative, cur, t.operativeShown)) wrong.push(`${t.code} operative ${t.operative} ≠ matrix ${cur}`);
      if (!sameAmount(amount(t.price), cur, t.price)) wrong.push(`${t.code} tile ${t.price} ≠ matrix ${r.cells['Current Price']}`);
    }
    const missing = [...m.keys()].filter(c => !tiles.some(t => t.code === c));
    note('tiles / matrix rows', `${tiles.length} / ${m.size}`);
    expect.soft(missing, 'Every Pricing Matrix unit has a tile').toEqual([]);
    expect(bad(wrong), 'Every tile = its Pricing Matrix row (status, product, area, price)').toBe('');
  });

  test(...avs('AVS-016'), async ({ av }) => {
    await av.open();
    const blocks = (await av.rows()).filter(r => r.kind === 'block');
    const b = blocks[blocks.length - 1];
    await av.press(at(av.page, XP.avsRowButton(b.label, S('Stack Plan Button'))).first(), `${S('Stack Plan Button')} of ${b.label}`);
    await av.stable();
    const heads = await av.blockHeaders();
    const tiles = await av.tiles();
    note(`${b.label} stack plan`, `${heads.map(h => h.block).join(', ')} · ${tiles.length} tiles`);
    expect.soft(heads.map(h => h.block), `Only ${b.label}`).toEqual([b.label]);
    expect.soft(tiles.length, `${b.label}: one tile per unit`).toBe(b.cells['Total'].n);
    await av.press(av.button(S('Back Button')), S('Back Button'));
    await expect(av.table, 'Back to the Summary Table').toBeVisible();
    // the block's Stack Plan button also chooses the block in the Block filter, and Back keeps it
    expect.soft((await av.rows()).filter(r => r.kind === 'block').map(r => r.label), `Back shows the Summary Table of ${b.label}`).toEqual([b.label]);
    await av.choose(S('Block Label'), 0);
    expect((await av.rows()).filter(r => r.kind === 'block').length, 'All blocks again').toBe(blocks.length);
  });
});
