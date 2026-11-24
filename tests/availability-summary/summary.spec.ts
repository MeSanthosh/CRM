/**
 * Availability Summary: top cards, summary line, Summary Table, views, Refresh (AVS-001 … AVS-006), filters, category
 * chips and Export (AVS-007 … AVS-011). Read only. Run: npx playwright test tests/availability-summary/summary.spec.ts
 */
import { test, expect, note, avs, S, DATA, statuses, sameAmount, bad, card, amount } from './shared';
import { download } from '../helpers';
import type { SumRow } from '../pages/AvailabilityPage';

const COLS = () => statuses().map(s => s['Summary Column']);
const TOTAL = 'Total';
/** A + H + R + S = Total for a row (counts, and values within rounding). */
function rowErrors(r: SumRow): string[] {
  const out: string[] = [];
  const n = COLS().reduce((a, c) => a + (r.cells[c]?.n ?? 0), 0);
  if (n !== r.cells[TOTAL]?.n) out.push(`${r.label}: ${COLS().map(c => r.cells[c]?.n).join(' + ')} ≠ ${r.cells[TOTAL]?.n}`);
  const v = COLS().reduce((a, c) => a + (r.cells[c]?.value ?? 0), 0);
  if (!sameAmount(v, r.cells[TOTAL]?.value ?? NaN, r.cells[TOTAL]?.shown)) out.push(`${r.label}: values ${Math.round(v)} ≠ ${r.cells[TOTAL]?.title || r.cells[TOTAL]?.shown}`);
  return out;
}
const sumOf = (rows: SumRow[], col: string, k: 'n' | 'value') => rows.reduce((a, r) => a + (r.cells[col]?.[k] ?? 0), 0);

test.describe('Availability Summary · Cards & Summary', () => {
  test.describe.configure({ timeout: 300_000 });

  test(...avs('AVS-001'), async ({ av, page }) => {
    await av.open();
    const units = await card(page, 'Units'), avail = await card(page, 'Available'), value = await card(page, 'Value');
    const sum = await av.summary(S('Summary Units Word'));
    note('cards', `Units ${units.value} (${units.sub}) · Available ${avail.value} (${avail.sub}) · Value ${value.value} (${value.sub})`);
    note('summary line', sum.text);
    const U = Number(units.value.replace(/,/g, '')), A = Number(avail.value.replace(/,/g, ''));
    const words = Object.fromEntries(statuses().filter(s => s['Card Word']).map(s => [s['Card Word'], Number((units.sub.match(new RegExp(`(\\d+)\\s+${s['Card Word']}\\b`)) ?? ['', '0'])[1])]));
    expect.soft(Object.values(words).reduce((a, b) => a + b, 0), `Units ${U} = ${units.sub}`).toBe(U);
    expect.soft(U, 'Units card = total units of the summary line').toBe(sum.total);
    expect.soft(A, 'Available card = Available of the summary line').toBe(sum.parts['Available']?.n);
    const p = Number((avail.sub.match(/([\d.]+)%/) ?? ['', 'NaN'])[1]);
    expect.soft(Math.abs(p - (A / U) * 100) <= 0.05, `Available % ${p} = ${A} ÷ ${U}`).toBeTruthy();
    const [availV, booked] = value.sub.split('·').map(x => x.replace(/^[^\d]*/, ''));
    expect.soft(sameAmount(amount(value.value), amount(availV) + amount(booked), value.value), `Value ${value.value} = Avail ${availV} + Booked ${booked}`).toBeTruthy();
    expect.soft(sameAmount(amount(availV), sum.parts['Available']?.value ?? NaN, availV), `Avail ${availV} = Available value of the summary line ${sum.parts['Available']?.shown}`).toBeTruthy();
    const booked2 = statuses().filter(s => !['Available', 'Held'].includes(s['Summary Column'])).reduce((a, s) => a + (sum.parts[s['Summary Column']]?.value ?? 0), 0);
    expect.soft(sameAmount(amount(booked), booked2, booked), `Booked ${booked} = Reserved + Sold of the summary line (${Math.round(booked2)})`).toBeTruthy();
  });

  test(...avs('AVS-002'), async ({ av }) => {
    await av.open();
    const as = await av.asOf(S('As Of Word'));
    note('as of', as);
    expect.soft(as, '"As of <date, time>"').toMatch(new RegExp(`^${S('As Of Word')} \\d{2} \\w{3} \\d{4}, \\d{2}:\\d{2}$`));
    for (const b of [S('Refresh Button'), S('Export Button')]) await expect.soft(av.button(b), `Button ${b}`).toBeVisible();
    for (const f of [S('Project Label'), S('Block Label')]) expect.soft((await av.options(f)).length, `${f} filter has options`).toBeGreaterThan(0);
    expect.soft((await av.options(S('Block Label')))[0], 'Block filter starts with "All blocks"').toMatch(new RegExp(`^${S('All Blocks Option')}`));
    const cats = await av.categories();
    note('category chips', cats.map(c => `${c.name} ${c.avail}/${c.total}`).join(' · '));
    expect.soft(cats[0]?.name, `First chip is "${S('All Category Chip')}"`).toBe(S('All Category Chip'));
    expect.soft((await av.summary(S('Summary Units Word'))).text, 'Summary line').not.toBe('');
    for (const v of [...DATA.sheet('Page Views'), ...DATA.sheet('Table Views')]) {
      const pressed = await av.page.locator('main button.crm-dashboard-view-segment-button', { hasText: v['View'] }).first().getAttribute('aria-pressed');
      expect.soft(pressed, `View "${v['View']}" ${v['Default'] === 'Yes' ? 'selected' : 'not selected'} at first`).toBe(v['Default'] === 'Yes' ? 'true' : 'false');
    }
  });

  test(...avs('AVS-003'), async ({ av }) => {
    await av.open();
    const s = await av.summary(S('Summary Units Word'));
    const rows = await av.rows();
    const total = rows.find(r => r.kind === 'total')!;
    const blocks = rows.filter(r => r.kind === 'block');
    note('summary / grand total', `${s.text} // ${total.text}`);
    expect.soft(s.total, 'Total units = Grand Total').toBe(total.cells[TOTAL].n);
    expect.soft(s.blocks, 'Blocks = block rows').toBe(blocks.length);
    for (const c of COLS()) {
      const part = s.parts[c];
      if (!part) { expect.soft(total.cells[c].n, `${c}: not in the summary line → 0 in Grand Total`).toBe(0); continue; }
      expect.soft(part.n, `${c} count = Grand Total`).toBe(total.cells[c].n);
      if (part.shown) expect.soft(sameAmount(part.value, total.cells[c].value, part.shown), `${c} value ${part.shown} = Grand Total ${total.cells[c].title}`).toBeTruthy();
    }
  });

  test(...avs('AVS-004'), async ({ av }) => {
    await av.open();
    await av.expandAll(S('Expand All Button'));
    const rows = await av.rows();
    const errs = rows.flatMap(rowErrors);
    // floors of each block add up to the block
    const sums: string[] = [];
    let block: SumRow | undefined; let floors: SumRow[] = [];
    const flush = () => {
      if (!block) return;
      for (const c of [...COLS(), TOTAL]) if (sumOf(floors, c, 'n') !== block.cells[c].n) sums.push(`${block.label} ${c}: floors ${sumOf(floors, c, 'n')} ≠ ${block.cells[c].n}`);
      const nf = Number((block.extra.match(/(\d+) flrs?/) ?? ['', 'NaN'])[1]);
      if (nf !== floors.length) sums.push(`${block.label}: "${nf} flrs" but ${floors.length} floor rows`);
    };
    for (const r of rows) {
      if (r.kind === 'block') { flush(); block = r; floors = []; } else if (r.kind === 'floor') floors.push(r); else if (r.kind === 'total') flush();
    }
    const blocks = rows.filter(r => r.kind === 'block'), total = rows.find(r => r.kind === 'total')!;
    for (const c of [...COLS(), TOTAL]) {
      if (sumOf(blocks, c, 'n') !== total.cells[c].n) sums.push(`Grand Total ${c}: blocks ${sumOf(blocks, c, 'n')} ≠ ${total.cells[c].n}`);
      if (!sameAmount(sumOf(blocks, c, 'value'), total.cells[c].value, total.cells[c].shown)) sums.push(`Grand Total ${c} value: blocks ${Math.round(sumOf(blocks, c, 'value'))} ≠ ${total.cells[c].title}`);
    }
    note('rows read', `${blocks.length} blocks, ${rows.filter(r => r.kind === 'floor').length} floors`);
    expect.soft(bad(errs), 'Available + Held + Reserved + Sold = Total on every row').toBe('');
    expect(bad(sums), 'Floors add up to their block; blocks add up to the Grand Total').toBe('');
  });

  test(...avs('AVS-005'), async ({ av }) => {
    await av.open();
    const views = DATA.sheet('Table Views').map(v => v['View']);
    await av.view(views[0]);
    const both = await av.rows();
    await av.view(views[1]);
    const units = await av.rows();
    await av.view(views[2]);
    const values = await av.rows();
    await av.view(views[0]);
    const diff: string[] = [];
    both.forEach((r, i) => {
      for (const c of [...COLS(), TOTAL]) {
        if (units[i]?.cells[c]?.n !== r.cells[c].n) diff.push(`${views[1]} ${r.label} ${c}: ${units[i]?.cells[c]?.n} ≠ ${r.cells[c].n}`);
        if (units[i]?.cells[c]?.shown) diff.push(`${views[1]} ${r.label} ${c} shows a value "${units[i].cells[c].shown}"`);
        const v = values[i]?.cells[c];
        if (r.cells[c].n === 0 ? v?.shown !== '–' && v?.value !== 0 : !sameAmount(v?.value ?? NaN, r.cells[c].value, v?.shown)) diff.push(`${views[2]} ${r.label} ${c}: "${v?.shown}" ≠ ${r.cells[c].shown || 0}`);
      }
    });
    expect(bad(diff), 'Units Only = the counts; Value ($) = the values ("–" for none)').toBe('');
  });

  test(...avs('AVS-006'), async ({ av }) => {
    await av.open();
    const before = await av.asOf(S('As Of Word'));
    const rows = await av.rows();
    await av.page.waitForTimeout(61_000); // the time shows minutes: wait for the next minute
    await av.press(av.button(S('Refresh Button')), S('Refresh Button'));
    await av.stable();
    const after = await av.asOf(S('As Of Word'));
    note('as of before / after', `${before} / ${after}`);
    const t = (s: string) => new Date(s.replace(S('As Of Word'), '').replace(',', '')).getTime();
    expect.soft(t(after), 'The time moves on after Refresh').toBeGreaterThan(t(before));
    expect((await av.rows()).map(r => r.text), 'Same figures after Refresh').toEqual(rows.map(r => r.text));
  });
});

test.describe('Availability Summary · Filters & categories', () => {
  test.describe.configure({ timeout: 600_000 });

  test(...avs('AVS-007'), async ({ av }) => {
    await av.open();
    const label = S('Block Label');
    const all = await av.rows();
    const opts = await av.options(label);
    expect.soft(Number((opts[0].match(/\((\d+)\)/) ?? ['', 'NaN'])[1]), `"${opts[0]}" = number of blocks`).toBe(all.filter(r => r.kind === 'block').length);
    for (const o of opts.slice(1)) {
      const name = o.replace(/\s*\(\d+\)$/, '');
      await av.choose(label, o);
      const rows = await av.rows(), s = await av.summary(S('Summary Units Word'));
      const blocks = rows.filter(r => r.kind === 'block');
      const full = all.find(r => r.kind === 'block' && r.label === name);
      note(o, s.text);
      expect.soft(blocks.map(b => b.label), `${o}: only that block`).toEqual([name]);
      expect.soft(Number((o.match(/\((\d+)\)/) ?? ['', 'NaN'])[1]), `${o}: (N) = block Total`).toBe(full?.cells[TOTAL].n);
      expect.soft(s.total, `${o}: summary line total`).toBe(full?.cells[TOTAL].n);
    }
    await av.choose(label, 0);
    expect((await av.rows()).length, 'All blocks again').toBe(all.length);
  });

  test(...avs('AVS-008'), async ({ av, page }) => {
    await av.open();
    const label = S('Project Label');
    const opts = await av.options(label);
    let total = 0;
    for (const o of opts) {
      await av.choose(label, o);
      const s = await av.summary(S('Summary Units Word'));
      const g = (await av.rows()).find(r => r.kind === 'total');
      note(`project ${o}`, s.text);
      expect.soft(s.text.startsWith(`${o}:`), `${o}: summary line of that project`).toBeTruthy();
      expect.soft(g?.cells[TOTAL].n, `${o}: Grand Total = summary line`).toBe(s.total);
      total += s.total;
    }
    expect(total, 'All projects add up to the Units card').toBe(Number((await card(page, 'Units')).value.replace(/,/g, '')));
  });

  test(...avs('AVS-009'), async ({ av }) => {
    await av.open();
    const chips = await av.categories();
    note('chips', chips.map(c => `${c.name} ${c.avail}/${c.total}`).join(' · '));
    const [allChip, ...cats] = chips;
    const grand = (await av.rows()).find(r => r.kind === 'total')!;
    expect.soft([allChip.avail, allChip.total], `"${allChip.name}" chip = Available / Total of the Grand Total`).toEqual([grand.cells['Available'].n, grand.cells[TOTAL].n]);
    expect.soft(cats.reduce((a, c) => a + c.total, 0), 'Categories add up to all units').toBe(allChip.total);
    expect.soft(cats.reduce((a, c) => a + c.avail, 0), 'Categories add up to all available units').toBe(allChip.avail);
    for (const c of cats) {
      await av.category(c.name);
      const s = await av.summary(S('Summary Units Word'));
      const g = (await av.rows()).find(r => r.kind === 'total');
      note(`category ${c.name}`, s.text);
      expect.soft(s.text, `${c.name}: summary line names the category`).toContain(`${S('Category Word')} ${c.name}`);
      expect.soft([s.total, s.parts['Available']?.n], `${c.name}: summary line = chip ${c.avail}/${c.total}`).toEqual([c.total, c.avail]);
      expect.soft([g?.cells['Available'].n, g?.cells[TOTAL].n], `${c.name}: Grand Total = chip`).toEqual([c.avail, c.total]);
    }
    await av.category(allChip.name);
    expect((await av.summary(S('Summary Units Word'))).total, 'All units again').toBe(allChip.total);
  });

  test(...avs('AVS-010'), async ({ av }) => {
    await av.open();
    const [allChip, ...cats] = await av.categories();
    const c = cats.find(x => x.total > 0)!;
    await av.category(c.name);
    const byBlock = (await av.rows()).filter(r => r.kind === 'block');
    const b = byBlock[0];
    await av.choose(S('Block Label'), (await av.options(S('Block Label'))).find(o => o.startsWith(`${b.label} (`))!);
    const rows = await av.rows();
    await av.view(DATA.sheet('Page Views')[1]['View']);
    const tiles = await av.tiles();
    note('category + block', `${c.name} + ${b.label}: table ${rows.find(r => r.kind === 'block')?.text} · tiles ${tiles.length}`);
    expect.soft(rows.filter(r => r.kind === 'block').map(r => r.label), 'Only that block').toEqual([b.label]);
    expect.soft(rows.find(r => r.kind === 'block')?.cells[TOTAL].n, `Block row = the ${c.name} units of the block`).toBe(b.cells[TOTAL].n);
    expect(tiles.length, 'Stack Plan shows the same number of units').toBe(b.cells[TOTAL].n);
    await av.view(DATA.sheet('Page Views')[0]['View']);
    await av.choose(S('Block Label'), 0);
    await av.category(allChip.name);
  });

  test(...avs('AVS-011'), async ({ av }) => {
    await av.open();
    await av.expandAll(S('Expand All Button'));
    const rows = await av.rows();
    const file = await download(av.page, av.button(S('Export Button')), 30_000);
    note('export', `${file.name}: ${file.rows.length} rows · ${file.header.join(' | ')}`);
    // the file has one row per floor ("Block D" | "Floor 43"), "<block> total" per block and "Grand total"
    const [blockCol, floorCol] = file.header;
    const all = [...file.rows, ...(file.total ? [file.total] : [])];
    const s = (v: unknown) => String(v ?? '').trim().toLowerCase();
    const miss: string[] = [];
    let block = '';
    for (const r of rows) {
      if (r.kind === 'block') block = r.label;
      // a block's "Floor Tally (N floors)" row (shown when floors are expanded) is the same as its block row
      const tally = r.label.includes(S('Floor Tally Word'));
      const x = r.kind === 'floor' ? all.find(y => s(y[blockCol]) === block.toLowerCase() && s(y[floorCol]) === r.label.toLowerCase())
        : r.kind === 'block' || tally ? all.find(y => s(y[blockCol]) === `${block} ${S('Export Total Word')}`.toLowerCase())
        : file.total;
      if (!x) { miss.push(`${r.kind === 'floor' ? `${block} ${r.label}` : r.label}: not in the file`); continue; }
      for (const c of [...COLS(), TOTAL]) {
        const h = file.header.find(k => k.toLowerCase().startsWith(c.toLowerCase()));
        if (h && Number(String(x[h]).replace(/[^\d.-]/g, '')) !== r.cells[c].n) miss.push(`${r.label} ${c}: file ${x[h]} ≠ ${r.cells[c].n}`);
      }
    }
    expect(bad(miss), 'File rows = the table').toBe('');
  });
});
