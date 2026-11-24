/**
 * Availability Summary → ⊞ Unit Mix window (AVS-017 … AVS-022): status cards, By Product, By Bedrooms, the
 * Floor × Product Matrix, the Scope selector, its Stack Plan and View Units. Read only.
 * Run: npx playwright test tests/availability-summary/unit-mix.spec.ts
 */
import { test, expect, note, avs, S, DATA, statuses, sameAmount, bad } from './shared';
import type { SumRow } from '../pages/AvailabilityPage';
import type { AvailabilityPage } from '../pages/AvailabilityPage';

const COLS = () => statuses().map(s => s['Summary Column']);
const VIEWS = () => DATA.sheet('Unit Mix Views').map(v => v['View']);
const view = (start: string) => VIEWS().find(v => v.startsWith(start))!;

/** Mix rows add up: A + H + R + S = Total and Availability % = A ÷ Total; the Total row = Σ rows = the cards. */
async function mixErrors(av: AvailabilityPage, scope: string): Promise<string[]> {
  const rows = await av.mixRows();
  const cards = await av.mixCards();
  const items = rows.filter(r => !/^Total/i.test(r.label));
  const total = rows.find(r => /^Total/i.test(r.label));
  const out: string[] = [];
  for (const r of items) {
    const n = COLS().reduce((a, c) => a + (r.cells[c]?.n ?? 0), 0);
    if (n !== r.cells['Total']?.n) out.push(`${scope} ${r.label}: ${COLS().map(c => r.cells[c]?.n).join(' + ')} ≠ ${r.cells['Total']?.n}`);
    const p = Number((r.text.match(/(\d+)%/) ?? ['', 'NaN'])[1]);
    if (r.cells['Total']?.n && Math.abs(p - (r.cells['Available'].n / r.cells['Total'].n) * 100) > 0.5) out.push(`${scope} ${r.label}: ${p}% ≠ ${r.cells['Available'].n} ÷ ${r.cells['Total'].n}`);
  }
  if (!total) { out.push(`${scope}: no Total row`); return out; }
  for (const c of [...COLS(), 'Total']) {
    const s = items.reduce((a, r) => a + (r.cells[c]?.n ?? 0), 0);
    if (s !== total.cells[c]?.n) out.push(`${scope} Total ${c}: rows ${s} ≠ ${total.cells[c]?.n}`);
    const card = cards[c === 'Total' ? S('Unit Mix Total Card') : c.toUpperCase()];
    if (card && card.n !== total.cells[c]?.n) out.push(`${scope} card ${c} ${card.n} ≠ Total row ${total.cells[c]?.n}`);
    if (card && !sameAmount(card.value, total.cells[c]?.value ?? 0, card.shown)) out.push(`${scope} card ${c} ${card.shown} ≠ ${total.cells[c]?.title}`);
  }
  if (!total.text.includes(S('Tallied Text'))) out.push(`${scope}: "${S('Tallied Text')}" not shown`);
  return out;
}
const cardsEqualRow = (cards: Record<string, { n: number; value: number; shown: string }>, row: SumRow, what: string) => {
  const out: string[] = [];
  for (const c of [...COLS(), 'Total']) {
    const k = c === 'Total' ? S('Unit Mix Total Card') : c.toUpperCase();
    if (cards[k]?.n !== row.cells[c]?.n) out.push(`${what} ${k}: ${cards[k]?.n} units ≠ row ${row.cells[c]?.n}`);
    if (row.cells[c]?.n && !sameAmount(cards[k]?.value ?? NaN, row.cells[c].value, cards[k]?.shown)) out.push(`${what} ${k}: ${cards[k]?.shown} ≠ row ${row.cells[c].title}`);
  }
  return out;
};

test.describe('Availability Summary · Unit Mix', () => {
  test.describe.configure({ timeout: 600_000 });

  test(...avs('AVS-017'), async ({ av }) => {
    await av.open();
    const rows = await av.rows();
    const errs: string[] = [];
    for (const r of rows.filter(x => x.kind === 'block')) {
      await av.openUnitMix(r.label, S('Unit Mix Button'));
      const title = await av.mixTitle();
      const head = (await av.unitMix.innerText()).split('\n')[0].trim();
      const scope = (await av.scope().locator('option:checked').textContent())?.trim() ?? '';
      note(`${r.label} unit mix`, `${head} · ${title} · scope ${scope}`);
      expect.soft(head.toUpperCase(), `${r.label}: window title`).toBe(S('Unit Mix Title'));
      expect.soft(title.startsWith(r.label), `${r.label}: heading names the block ("${title}")`).toBeTruthy();
      expect.soft(scope.startsWith(r.label), `${r.label}: Scope shows the block ("${scope}")`).toBeTruthy();
      errs.push(...cardsEqualRow(await av.mixCards(), r, r.label));
      await av.closeWindow(av.unitMix, S('Close Button'));
    }
    expect(bad(errs), 'Unit Mix cards = the block row').toBe('');
  });

  test(...avs('AVS-018'), async ({ av }) => {
    await av.open();
    const rows = await av.rows();
    const errs: string[] = [];
    for (const r of rows.filter(x => x.kind !== 'floor')) {
      const label = r.kind === 'total' ? S('Grand Total Row') : r.label;
      await av.openUnitMix(label, S('Unit Mix Button'));
      await av.mixView(view('By Product'));
      errs.push(...await mixErrors(av, `${label} by product`));
      errs.push(...cardsEqualRow(await av.mixCards(), r, label));
      const products = (await av.mixRows()).filter(x => !/^Total/i.test(x.label)).length;
      const said = Number((r.extra.match(/(\d+) products?/) ?? ['', 'NaN'])[1]);
      if (said !== products) errs.push(`${label}: row says ${said} products, Unit Mix lists ${products}`);
      await av.closeWindow(av.unitMix, S('Close Button'));
    }
    expect(bad(errs), 'By Product rows add up to the Total row and the cards').toBe('');
  });

  test(...avs('AVS-019'), async ({ av }) => {
    await av.open();
    const rows = await av.rows();
    const errs: string[] = [];
    for (const r of rows.filter(x => x.kind !== 'floor')) {
      const label = r.kind === 'total' ? S('Grand Total Row') : r.label;
      await av.openUnitMix(label, S('Unit Mix Button'));
      await av.mixView(view('By Bedrooms'));
      errs.push(...await mixErrors(av, `${label} by bedrooms`));
      const groups = await av.mixRows();
      note(`${label} bedroom groups`, groups.map(g => `${g.label} ${g.cells['Total']?.n}`).join(' · '));
      await av.closeWindow(av.unitMix, S('Close Button'));
    }
    expect(bad(errs), 'Bedroom groups add up to the Total row and the cards').toBe('');
  });

  test(...avs('AVS-020'), async ({ av }) => {
    await av.open();
    const rows = await av.rows();
    await av.expandAll(S('Expand All Button'));
    const expanded = await av.rows();
    const errs: string[] = [];
    for (const r of rows.filter(x => x.kind === 'block')) {
      await av.openUnitMix(r.label, S('Unit Mix Button'));
      const name = (await av.mixViews()).find(v => v.startsWith(view('Floor')))!;
      await av.mixView(name);
      const m = await av.mixMatrix();
      const floors = m.rows.filter(x => !/^Total/i.test(x.floor));
      const total = m.rows.find(x => /^Total/i.test(x.floor));
      note(`${r.label} matrix`, `${m.products.join(', ')} · ${floors.length} floors · ${total?.cells.map(c => c.shown).join(' | ')}`);
      if (Number((name.match(/\((\d+)\)/) ?? ['', 'NaN'])[1]) !== floors.length) errs.push(`${r.label}: view "${name}" but ${floors.length} floor rows`);
      // the block's floor rows of the Summary Table, in the same order
      const i = expanded.findIndex(x => x.kind === 'block' && x.label === r.label);
      const tableFloors = expanded.slice(i + 1).filter((x, k, a) => a.slice(0, k + 1).every(y => y.kind === 'floor')).filter(x => x.kind === 'floor');
      for (const f of floors) {
        const sum = f.cells.reduce((a, c) => a + c.total, 0);
        if (sum !== f.total) errs.push(`${r.label} ${f.floor}: cells ${sum} ≠ Total ${f.total}`);
        const tf = tableFloors.find(x => x.label === f.floor);
        if (tf && tf.cells['Total'].n !== f.total) errs.push(`${r.label} ${f.floor}: ${f.total} ≠ Summary Table ${tf.cells['Total'].n}`);
        if (tf && f.cells.reduce((a, c) => a + c.avail, 0) !== tf.cells['Available'].n) errs.push(`${r.label} ${f.floor}: available cells ≠ Summary Table ${tf.cells['Available'].n}`);
      }
      m.products.forEach((p, k) => {
        const col = floors.reduce((a, f) => a + f.cells[k].total, 0), av_ = floors.reduce((a, f) => a + f.cells[k].avail, 0);
        if (total && (total.cells[k].total !== col || total.cells[k].avail !== av_)) errs.push(`${r.label} ${p}: column ${av_}/${col} ≠ Total ${total.cells[k].shown}`);
      });
      if (total?.total !== r.cells['Total'].n) errs.push(`${r.label}: matrix Total ${total?.total} ≠ block ${r.cells['Total'].n}`);
      await av.closeWindow(av.unitMix, S('Close Button'));
    }
    expect(bad(errs), 'Floor × Product Matrix cells, rows and columns add up to the floors and the block').toBe('');
  });

  test(...avs('AVS-021'), async ({ av }) => {
    await av.open();
    await av.expandAll(S('Expand All Button'));
    const rows = await av.rows();
    await av.openUnitMix(S('Grand Total Row'), S('Unit Mix Button'));
    const opts = (await av.scope().locator('option').allTextContents()).map(o => o.trim());
    note('scopes', `${opts.length}: ${opts.slice(0, 6).join(' | ')} …`);
    const errs: string[] = [];
    // the project, every block and the first floor of each block
    let block = '';
    const pick = opts.filter((o, i) => i === 0 || / — All Floors/.test(o) || (/ · /.test(o) && !opts.slice(0, i).some(x => x.split(' · ')[0] === o.split(' · ')[0] && / · /.test(x))));
    for (const o of pick) {
      await av.scope().selectOption({ label: o });
      await av.page.waitForTimeout(800);
      const n = Number((o.match(/\((\d+) units?\)/) ?? ['', 'NaN'])[1]);
      const cards = await av.mixCards();
      const blk = o.split(/ — | · /)[0];
      if (/ — All Floors/.test(o)) block = blk;
      const row = /^Entire Project/.test(o) ? rows.find(r => r.kind === 'total')
        : / — All Floors/.test(o) ? rows.find(r => r.kind === 'block' && r.label === blk)
        : (() => { const i = rows.findIndex(r => r.kind === 'block' && r.label === blk); return rows.slice(i + 1).find(r => r.kind === 'floor' && o.endsWith(`${r.label} (${n} units)`) || (r.kind === 'floor' && o.includes(`· ${r.label} (`))); })();
      if (cards[S('Unit Mix Total Card')]?.n !== n) errs.push(`${o}: Total Stock ${cards[S('Unit Mix Total Card')]?.n} ≠ ${n}`);
      if (!row) { errs.push(`${o}: no matching Summary Table row`); continue; }
      errs.push(...cardsEqualRow(cards, row, o));
    }
    void block;
    await av.closeWindow(av.unitMix, S('Close Button'));
    expect(bad(errs), 'Cards follow the scope (project = Grand Total, block = block row, floor = floor row)').toBe('');
  });

  test(...avs('AVS-022'), async ({ av }) => {
    await av.open();
    const r = (await av.rows()).find(x => x.kind === 'block')!;
    await av.openUnitMix(r.label, S('Unit Mix Button'));
    await av.mixView(view('🏢'));
    const tiles = await av.tiles(av.unitMix);
    note(`${r.label} unit mix stack plan`, `${tiles.length} tiles`);
    expect.soft(tiles.length, `${r.label}: one tile per unit of the scope`).toBe(r.cells['Total'].n);
    await av.mixView(view('By Product'));
    const products = (await av.mixRows()).filter(x => !/^Total/i.test(x.label));
    const p = products[0];
    const btn = av.unitMix.locator('tr', { hasText: p.label }).locator('button', { hasText: S('View Units Button') }).first();
    const n = Number(((await btn.innerText()).match(/\((\d+)\)/) ?? ['', 'NaN'])[1]);
    expect.soft(n, `View Units (N) = ${p.label} Total`).toBe(p.cells['Total'].n);
    await btn.click();
    await av.page.waitForTimeout(1200);
    // View Units closes the window and lists the units in the drill-down selection under the table
    await expect.soft(av.unitMix, 'The Unit Mix window closes').toBeHidden();
    await expect(av.drill, 'The drill-down unit selection opens').toBeVisible();
    const d = await av.drillInfo(S('Drill Heading'));
    note('drill-down', `${d.title} · ${d.line} · ${d.rows.length} rows`);
    expect.soft(d.title, `Heading names ${r.label} and ${p.label}`).toMatch(new RegExp(`^${r.label}.*${p.label}.*${n} ${S('Drill Matching Word')}`));
    expect.soft(d.rows.length, `${n} unit rows`).toBe(n);
    expect.soft(d.rows.filter(x => x['Product'] !== p.label).map(x => x['Unit Code']), `Only units of ${p.label}`).toEqual([]);
    const avail = d.rows.filter(x => x['Status'] === S('Available Status')).length;
    expect.soft(d.line, `"Available: ${avail} / ${n}"`).toContain(`Available: ${avail} / ${n}`);
    expect.soft(avail, 'Available units = the product row').toBe(p.cells['Available'].n);
    await av.press(av.button(S('Drill Close Button')), S('Drill Close Button'));
    await expect(av.drill, 'Close Selection hides the list').toBeHidden();
  });
});
