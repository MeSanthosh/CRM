/**
 * Inventory → Pricing Matrix (IVP-061 … IVP-076, IVP-091 … IVP-094): views, 2-layer formulas on every row,
 * summary line, breakdown, filters and their combinations, search, export and design. Read only: nothing is
 * saved and no Recalculate button is pressed. Units, prices and option lists are read from the page at run time.
 * Run: npx playwright test tests/inventory-page/pricing-matrix.spec.ts --workers=1
 */
import {
  test, expect, note, ivp, ivpRow, PS, SS, list, sheet, sameMoney, sameShown, r2, tol, money, pct, nameOf,
  floorColumn, discountOf, tierColumns, tierOf, tierColumnOf, premiums, blockFloor, figures, parseSummary,
  neverClick, broken, filters, filterLabels, optionOf, matches,
} from './pricing-shared';
import type { PMRow, PMHeader } from './pricing-shared';
import { Breakdown, coverOf, UnitSales } from '../pages/PricingMatrixPage';
import { InventoryPage } from '../sales-chain/inventory';
import { DATA } from './shared';

const FULL = () => sheet('Pricing Views').find(v => v['Group'] === 'Layers' && v['Default'] !== 'Yes')!['Button'];
const STANDARD = () => sheet('Pricing Views').find(v => v['Group'] === 'Layers' && v['Default'] === 'Yes')!['Button'];
const EXACT = () => sheet('Pricing Views').find(v => v['Group'] === 'Amounts' && v['Default'] === 'Yes')!['Button'];
const COMPACT = () => sheet('Pricing Views').find(v => v['Group'] === 'Amounts' && v['Default'] !== 'Yes')!['Button'];
const SUMMARY = () => [PS('Summary Start'), list(PS('Summary Labels'))[2]] as const;
const bad = (xs: string[], max = 8) => (xs.length ? `${xs.length} rows: ${xs.slice(0, max).join(' | ')}${xs.length > max ? ' …' : ''}` : '');

async function fullRows(pm: import('../pages/PricingMatrixPage').PricingMatrixPage) {
  await pm.view(FULL());
  return { header: await pm.header(), rows: await pm.rows() };
}

test.describe('Inventory · Pricing Matrix', () => {
  test.describe.configure({ timeout: 600_000 });

  test(...ivp('IVP-061'), async ({ pm, page }) => {
    await pm.open();
    const main = page.locator('main');
    await expect.soft(main.getByRole('heading', { name: PS('Pricing Title'), exact: true }), 'Heading').toBeVisible();
    await expect.soft(main.getByText(PS('Pricing Subtitle'), { exact: true }), 'Subtitle').toBeVisible();
    for (const v of sheet('Pricing Views')) {
      expect.soft(await pm.viewPressed(v['Button']), `View "${v['Button']}" ${v['Default'] === 'Yes' ? 'selected' : 'not selected'} at first`).toBe(v['Default'] === 'Yes');
    }
    for (const a of sheet('Pricing Actions')) await expect.soft(pm.button(a['Button']), `Button "${a['Button']}"`).toBeVisible();
    for (const f of filters()) {
      const opts = await pm.filterOptions(f['Label']);
      note(`filter ${f['Filter']}`, opts.join(' | '));
      expect.soft(opts[0] ?? '', `${f['Filter']} filter starts with "${f['All Option']}"`).toMatch(new RegExp(`^${f['All Option']}\\b`));
      expect.soft(opts.length, `${f['Filter']} filter has options`).toBeGreaterThan(1);
    }
    await expect(page.locator(`main input[placeholder="${PS('Search Placeholder')}"]`), 'Search box').toBeVisible();
    note('never clicked', neverClick().join(', '));
  });

  test(...ivp('IVP-062'), async ({ pm }) => {
    await pm.open();
    for (const view of [STANDARD(), FULL()]) {
      await pm.view(view);
      const h = await pm.header();
      note(`${view} header`, `${h.groups.map(g => `${g.name}{${g.span}}`).join(' | ')} :: ${h.columns.join(' | ')}`);
      const tiers = tierColumns(h).map(t => t.header);
      const want = sheet('Pricing Columns').filter(c => c['View'] === view);
      expect.soft(h.groups.map(g => g.name), `${view}: column groups`).toEqual(want.map(c => c['Group']));
      const cols = want.flatMap(c => list(c['Columns'].replace('{discount}', String(discountOf(h)))).flatMap(x => (x === '{tiers}' ? tiers : [x])));
      expect.soft(h.columns, `${view}: columns`).toEqual(cols);
      expect.soft(h.groups.reduce((a, g) => a + g.span, 0), `${view}: groups span every column`).toBe(h.columns.length);
      if (view === FULL()) expect.soft(tiers.length, 'Full 2-Layer: one column per commercial tier').toBe(sheet('Tier Codes').length);
      for (const [i, g] of h.groups.entries()) {
        const start = h.groups.slice(0, i).reduce((a, x) => a + x.span, 0);
        const under = h.columns.slice(start, start + g.span);
        const w = want.find(c => c['Group'] === g.name);
        if (w) expect.soft(under, `${view}: "${g.name}" spans its own columns`).toEqual(list(w['Columns'].replace('{discount}', String(discountOf(h)))).flatMap(x => (x === '{tiers}' ? tiers : [x])));
      }
    }
  });

  test(...ivp('IVP-063'), async ({ pm }) => {
    await pm.open();
    const rows = await pm.rows();
    note('rows read', String(rows.length));
    expect(rows.length, 'The matrix lists units').toBeGreaterThan(0);
    const wrong = rows.filter(r => !sameMoney(money(r.cells['Std Price']), Number(r.cells['Carpet']) * money(r.cells['Base Rate'])))
      .map(r => `${r.code}: ${r.cells['Carpet']} × ${r.cells['Base Rate']} ≠ ${r.cells['Std Price']}`);
    expect(bad(wrong), 'Std Price = Carpet × Base Rate on every row').toBe('');
  });

  test(...ivp('IVP-064'), async ({ pm }) => {
    await pm.open();
    const { header, rows } = await fullRows(pm);
    const sums: string[] = [], adjs: string[] = [], nets: string[] = [];
    for (const r of rows) {
      const f = figures(r, header);
      const p = premiums(r);
      const parts = f.floorPct + f.viewPct + p['Orient'].pct + p['Pos'].pct + f.otherPct;
      if (Math.abs(parts - f.totalPct) > 1e-6) sums.push(`${r.code}: ${f.floorPct} + ${f.viewPct} + ${p['Orient'].pct} + ${p['Pos'].pct} + ${f.otherPct} ≠ ${f.totalPct}%`);
      if (!sameMoney(f.netAdj, f.std * f.totalPct / 100)) nets.push(`${r.code}: ${f.std} × ${f.totalPct}% ≠ ${f.netAdj}`);
      if (!sameMoney(f.adj, f.std + f.netAdj)) adjs.push(`${r.code}: ${f.std} + ${f.netAdj} ≠ ${f.adj}`);
      // the tooltip and the Floor % / View columns tell the same premiums
      if (p['Floor'].pct !== f.floorPct || p['View'].pct !== f.viewPct) sums.push(`${r.code}: tooltip floor/view ${p['Floor'].pct}/${p['View'].pct} ≠ columns ${f.floorPct}/${f.viewPct}`);
    }
    note('rows read', String(rows.length));
    expect.soft(bad(sums), 'Total % = Floor % + View % + Orientation % + Position % + Other %').toBe('');
    expect.soft(bad(nets), 'Net Adj = Std Price × Total %').toBe('');
    expect(bad(adjs), 'Adj Std = Std Price + Net Adj').toBe('');
  });

  test(...ivp('IVP-065'), async ({ pm }) => {
    await pm.open();
    const { header, rows } = await fullRows(pm);
    const disc = discountOf(header);
    note('tier columns / discount', `${tierColumns(header).map(t => t.header).join(', ')} / ${disc}%`);
    const tiers: string[] = [], current: string[] = [], floors: string[] = [], unknown: string[] = [];
    for (const r of rows) {
      const f = figures(r, header);
      for (const t of f.tiers) if (!sameMoney(t.price, f.adj * (1 + t.pct / 100))) tiers.push(`${r.code} ${t.header}: ${f.adj} × (1 ${t.pct >= 0 ? '+' : '−'} ${Math.abs(t.pct)}%) ≠ ${t.price}`);
      const col = tierColumnOf(header, tierOf(r));
      if (!col) unknown.push(`${r.code}: tier "${r.cells['Tier']}" (${r.titles['Tier']})`);
      else if (!sameMoney(f.current, money(r.cells[col.header]))) current.push(`${r.code}: tier ${r.cells['Tier']} → ${col.header} ${r.cells[col.header]} ≠ Current ${r.cells['Current Price']}`);
      if (!sameMoney(f.floor, f.current * (1 - disc / 100))) floors.push(`${r.code}: ${f.current} × (1 − ${disc}%) ≠ ${f.floor}`);
    }
    expect.soft(bad(unknown), 'Every row\'s Tier is a commercial tier of the header (Tier Codes sheet)').toBe('');
    expect.soft(bad(tiers), 'Each tier column = Adj Std × (1 + tier %)').toBe('');
    expect.soft(bad(current), 'Current Price = the column of the row\'s tier').toBe('');
    expect(bad(floors), `Floor = Current Price × (1 − ${disc}%)`).toBe('');
  });

  test(...ivp('IVP-066'), async ({ pm }) => {
    await pm.open();
    const status = filters().find(f => f['Filter'] === 'Status')!['Label'];
    const opts = (await pm.filterOptions(status)).slice(1);
    for (const choice of [0, ...opts.map((_, i) => i + 1).slice(0, 2)]) {
      await pm.choose(status, choice);
      const { header, rows } = await fullRows(pm);
      const text = await pm.summary(...SUMMARY());
      const s = parseSummary(text);
      const f = rows.map(r => figures(r, header));
      const add = (k: 'carpet' | 'std' | 'netAdj' | 'current' | 'floor') => f.reduce((a, x) => a + x[k], 0);
      const label = choice === 0 ? 'no filter' : `Status = ${opts[choice - 1]}`;
      note(`summary (${label})`, text);
      expect.soft(s.units, `${label}: "Showing N units" = rows`).toBe(rows.length);
      expect.soft(Math.abs(s.carpet - add('carpet')) < 0.05 * Math.max(1, rows.length), `${label}: Total Carpet ${s.carpet} = Σ Carpet ${r2(add('carpet'))}`).toBeTruthy();
      if (rows.length) expect.soft(Math.abs(s.avg - add('carpet') / rows.length) <= 0.05, `${label}: Avg ${s.avg} = Total ÷ N (${r2(add('carpet') / rows.length)})`).toBeTruthy();
      expect.soft(sameMoney(s.std, add('std'), rows.length), `${label}: Standard Value ${s.std} = Σ Std Price ${add('std')}`).toBeTruthy();
      expect.soft(sameMoney(s.uplift, add('netAdj'), rows.length), `${label}: Net Uplift ${s.uplift} = Σ Net Adj ${add('netAdj')}`).toBeTruthy();
      if (s.std) expect.soft(Math.abs(s.upliftPct - (s.uplift / s.std) * 100) <= 0.01, `${label}: Net Uplift % ${s.upliftPct} = Net Uplift ÷ Standard Value (${r2((s.uplift / s.std) * 100)})`).toBeTruthy();
      expect.soft(sameMoney(s.gdv, add('current'), rows.length), `${label}: Operative GDV ${s.gdv} = Σ Current Price ${add('current')}`).toBeTruthy();
      expect.soft(sameMoney(s.floor, add('floor'), rows.length), `${label}: Total Price Floor ${s.floor} = Σ Floor ${add('floor')}`).toBeTruthy();
    }
    await pm.choose(status, 0);
  });

  test(...ivp('IVP-067'), async ({ pm }) => {
    await pm.open();
    await pm.view(FULL());
    const header = await pm.header();
    const exact = await pm.rows();
    const sumExact = await pm.summary(...SUMMARY());
    await pm.view(COMPACT());
    const compact = await pm.rows();
    const sumCompact = await pm.summary(...SUMMARY());
    note('summary exact / compact', `${sumExact} // ${sumCompact}`);
    expect.soft(compact.map(r => r.code), 'Same rows in the same order').toEqual(exact.map(r => r.code));
    const amountCols = ['Base Rate', 'Std Price', 'Net Adj', 'Adj Std', ...tierColumns(header).map(t => t.header), 'Current Price', floorColumn(header)];
    const keepCols = ['Unit Code', 'Product', 'Blk/Flr', 'Status', 'Carpet', 'Floor %', 'View', 'Orient.', 'Pos.', 'Other %', 'Total %', 'Tier'];
    const step = (s: string) => { const m = s.replace(/,/g, '').match(/\d+(?:\.(\d+))?\s*([kKmM])?/); return m ? 10 ** -(m[1]?.length ?? 0) * ({ k: 1e3, m: 1e6 }[(m[2] ?? '').toLowerCase() as 'k' | 'm'] ?? 1) : 0; };
    const ok = (e: number, s: string) => Math.abs(money(s) - e) <= Math.max(step(s) / 2 + tol(), Math.abs(e) * Number(PS('Compact Tolerance %')) / 100);
    const wrong: string[] = [], changed: string[] = [];
    exact.forEach((r, i) => {
      const c = compact[i];
      if (!c) return;
      for (const k of amountCols) if (!ok(money(r.cells[k]), c.cells[k])) wrong.push(`${r.code} ${k}: ${r.cells[k]} → ${c.cells[k]}`);
      for (const k of keepCols) if (r.cells[k] !== c.cells[k]) changed.push(`${r.code} ${k}: ${r.cells[k]} → ${c.cells[k]}`);
    });
    expect.soft(bad(wrong), 'Compact amounts = exact amounts rounded to $k / $M').toBe('');
    expect.soft(bad(changed), 'Carpet, rates, % and tiers do not change').toBe('');
    const se = parseSummary(sumExact), sc = parseSummary(sumCompact);
    for (const k of ['std', 'uplift', 'gdv', 'floor'] as const) {
      const shown = (sumCompact.split(`${list(PS('Summary Labels'))[['std', 'uplift', 'gdv', 'floor'].indexOf(k)]}:`)[1] ?? '').split('·')[0];
      expect.soft(ok(se[k], shown), `Summary ${k}: ${se[k]} → ${shown}`).toBeTruthy();
    }
    expect(sc.units, 'Summary units unchanged').toBe(se.units);
    await pm.view(EXACT());
  });

  test(...ivp('IVP-068'), async ({ pm }) => {
    await pm.open();
    const { header, rows } = await fullRows(pm);
    const disc = discountOf(header);
    // one unit of each status, tier and product first, then the next rows, up to the sample size
    const pick: PMRow[] = [];
    const add = (r?: PMRow) => { if (r && !pick.includes(r) && pick.length < Number(PS('Breakdown Sample'))) pick.push(r); };
    for (const key of [(r: PMRow) => r.cells['Status'], (r: PMRow) => r.cells['Tier'], (r: PMRow) => r.cells['Product']]) {
      for (const v of [...new Set(rows.map(key))]) add(rows.find(r => key(r) === v));
    }
    note('units opened', pick.map(r => r.code).join(', '));
    const steps = list(PS('Breakdown Steps'));
    for (const r of pick) {
      const f = figures(r, header);
      const p = premiums(r);
      const b = await pm.breakdown(r.code, PS('Breakdown Title'), { button: PS('Breakdown Button') });
      const l = await b.lines();
      const at = (c: string) => Breakdown.after(l, c);
      const s3 = l.findIndex(x => x.startsWith(steps[2]));
      const tierLines = l.slice(s3 + 1).filter(x => /\([+-]?\d+(?:\.\d+)?%\)(\s*·\s*\S+)?$/.test(x) && !/^Price Floor/i.test(x));
      const shownTiers = tierLines.map(x => ({ name: x, pct: pct(x, false), price: money(l[l.indexOf(x) + 1]), active: x.includes(PS('Active Tier Word')) }));
      const label = `${r.code}`;
      note(`breakdown ${label}`, l.join(' | '));
      expect.soft(l[0], `${label}: title`).toBe(PS('Breakdown Title'));
      expect.soft(l.some(x => x.startsWith(`${r.code} · ${r.cells['Product']}`)), `${label}: unit and product`).toBeTruthy();
      expect.soft(l.some(x => x.includes(`Status: ${r.cells['Status']}`)), `${label}: status ${r.cells['Status']}`).toBeTruthy();
      for (const s of steps) expect.soft(l.some(x => x.startsWith(s)), `${label}: step "${s}"`).toBeTruthy();
      expect.soft(Number(at('Carpet Area').replace(/[^\d.]/g, '')), `${label}: carpet`).toBe(f.carpet);
      expect.soft(money(at('Product Base Rate')), `${label}: base rate`).toBe(f.rate);
      expect.soft(sameMoney(money(at('Standard Base Price')), f.std), `${label}: standard ${at('Standard Base Price')} = row ${f.std}`).toBeTruthy();
      expect.soft(pct(at(`Floor (`)), `${label}: floor %`).toBe(f.floorPct);
      expect.soft(pct(at(`View (`)), `${label}: view %`).toBe(f.viewPct);
      expect.soft(pct(at(`Orientation (`)), `${label}: orientation %`).toBe(p['Orient'].pct);
      expect.soft(pct(at(`Position (`)), `${label}: position %`).toBe(p['Pos'].pct);
      const l1 = at('Total Layer 1 Adj');
      expect.soft(pct(l1), `${label}: Total Layer 1 Adj % = Total %`).toBe(f.totalPct);
      expect.soft(sameMoney(money(l1.split('(')[1] ?? ''), f.netAdj), `${label}: Layer 1 $ ${l1} = Net Adj ${f.netAdj}`).toBeTruthy();
      expect.soft(sameMoney(money(at('Adjusted Standard')), f.adj), `${label}: adjusted ${at('Adjusted Standard')} = Adj Std ${f.adj}`).toBeTruthy();
      expect.soft(shownTiers.map(t => t.pct), `${label}: tier % = header tiers`).toEqual(f.tiers.map(t => t.pct));
      for (const t of shownTiers) {
        const col = f.tiers.find(x => x.pct === t.pct);
        expect.soft(sameMoney(t.price, col?.price ?? NaN), `${label}: ${t.name} ${t.price} = row ${col?.header} ${col?.price}`).toBeTruthy();
      }
      const active = shownTiers.filter(t => t.active);
      expect.soft(active.length, `${label}: one tier marked ${PS('Active Tier Word')}`).toBe(1);
      if (active[0]) expect.soft(sameMoney(active[0].price, f.current), `${label}: ACTIVE tier price = Current Price ${f.current}`).toBeTruthy();
      const floorLine = l.find(x => /^Price Floor/i.test(x)) ?? '';
      expect.soft(pct(floorLine, false), `${label}: price-floor discount = header`).toBe(-disc);
      expect.soft(sameMoney(money(l[l.indexOf(floorLine) + 1]), f.floor), `${label}: price floor = row ${f.floor}`).toBeTruthy();
      const closing = l.find(x => x.startsWith('Operative Current Price:')) ?? '';
      expect.soft(sameMoney(money(closing.split('·')[0]), f.current) && sameMoney(money(closing.split('·')[1] ?? ''), f.floor), `${label}: closing line "${closing}" = Current / Floor`).toBeTruthy();
      expect.soft(broken(l.join(' ')), `${label}: no broken values`).toEqual([]);
      await b.close('button', PS('Breakdown Close Button'));
    }
    if (Object.keys(pm.covered).length) note('buttons covered', JSON.stringify(pm.covered));
  });

  test(...ivp('IVP-069'), async ({ pm, page }) => {
    await pm.open();
    const rows = await pm.rows();
    const r = rows[Math.floor(rows.length / 2)];
    const viaButton = await pm.breakdown(r.code, PS('Breakdown Title'), { button: PS('Breakdown Button') });
    const a = await viaButton.lines();
    await viaButton.close('button', PS('Breakdown Close Button'));
    for (const how of ['button', 'x', 'escape'] as const) {
      const b = await pm.breakdown(r.code, PS('Breakdown Title'));
      expect.soft(await b.lines(), `Unit code of ${r.code} opens the same breakdown as ${PS('Breakdown Button')}`).toEqual(a);
      await b.close(how, PS('Breakdown Close Button'));
    }
    note('unit', r.code);
    expect(await pm.rows().then(x => x.length), 'Matrix unchanged after closing').toBe(rows.length);
    await expect(page.locator('main'), 'Back on the matrix').toContainText(PS('Pricing Title'));
  });

  test(...ivp('IVP-070'), async ({ pm }) => {
    await pm.open();
    const { header, rows } = await fullRows(pm);
    const r = rows[rows.length - 1];
    const f = figures(r, header);
    const b = await pm.breakdown(r.code, PS('Breakdown Title'), { button: PS('Breakdown Button') });
    await b.root.getByRole('button', { name: PS('Breakdown Edit Button'), exact: true }).click();
    const u = new UnitSales(pm.page);
    await expect(u.view.root, 'Unit window opens').toBeVisible({ timeout: 20_000 });
    await u.ready(r.code);
    const lines = await u.lines();
    note('unit window', lines.slice(0, 40).join(' | '));
    expect.soft(await u.title(), `Window of ${r.code}`).toBe(r.code);
    const state = Object.fromEntries((await u.sectionList()).map(s => [s.name, s.state]));
    expect.soft(state[SS('Sales Section')], 'Opens on Sales (view mode)').toBe('VIEW');
    const v = (c: string) => lines[lines.findIndex(x => x.toUpperCase() === c.toUpperCase()) + 1] ?? '';
    const cap = sheet('Unit Window Captions').filter(c => c['Section'] === 'Sales');
    const cur = v(cap.find(c => c['Matrix Column'] === 'Current Price')!['Caption']), fl = v(cap.find(c => c['Matrix Column'] === 'Floor (')!['Caption']);
    expect.soft(sameShown(cur, f.current), `Operative current price ${cur} = breakdown / row ${f.current}`).toBeTruthy();
    expect(sameShown(fl, f.floor), `Price floor ${fl} = breakdown / row ${f.floor}`).toBeTruthy();
    await u.close(SS('Close Button'), SS('Discard Button'));
  });
});

test.describe('Inventory · Pricing Matrix filters', () => {
  test.describe.configure({ timeout: 900_000 });

  /** Which project each unit belongs to, learnt by choosing each project. */
  async function projects(pm: import('../pages/PricingMatrixPage').PricingMatrixPage) {
    const label = filters().find(f => f['Filter'] === 'Project')!['Label'];
    const out = new Map<string, string>();
    const opts = (await pm.filterOptions(label)).slice(1);
    for (const o of opts) {
      await pm.choose(label, o);
      for (const r of await pm.rows()) out.set(r.code, o);
    }
    await pm.choose(label, 0);
    return { map: out, options: opts };
  }

  test(...ivp('IVP-071'), async ({ pm }) => {
    await pm.open();
    await pm.view(FULL());
    const header = await pm.header();
    const all = await pm.rows();
    for (const f of filters()) {
      const opts = await pm.filterOptions(f['Label']);
      const first = optionOf(opts[0]);
      note(`${f['Filter']} options`, opts.join(' | '));
      if (!Number.isNaN(first.count)) expect.soft(first.count, `"${opts[0]}" = number of ${f['Filter']} options`).toBe(opts.length - 1);
      if (f['Filter'] === 'Project') {
        const p = await projects(pm);
        expect.soft(p.map.size, 'Every unit belongs to one of the projects listed').toBe(all.length);
        continue;
      }
      if (f['Filter'] === 'Tier') {
        expect.soft(opts.slice(1).map(o => pct(o, false)), 'Tier options show the % of the header tiers').toEqual(tierColumns(header).map(t => t.pct));
        continue;
      }
      for (const o of opts.slice(1)) {
        const n = all.filter(r => matches(r, f['Filter'], o)).length;
        expect.soft(optionOf(o).count, `${f['Filter']} "${o}": (N) = units with that value`).toBe(n);
      }
      const values = new Set(all.map(r => (f['Filter'] === 'Block' ? blockFloor(r).block : r.cells[f['Matrix Column']].toLowerCase())));
      const listed = new Set(opts.slice(1).map(o => (f['Filter'] === 'Block' ? optionOf(o).name : optionOf(o).name.toLowerCase())));
      expect.soft([...values].filter(v => !listed.has(v)), `Every ${f['Filter']} of the units is an option`).toEqual([]);
    }
  });

  filters().forEach((f, n) => {
    test(...ivpRow('IVP-072', n + 1, `${f['Filter']} filter`, `Every row shown matches the chosen ${f['Filter']}; rows = its (N) = units of the unfiltered list with that value; the summary counts the rows; All brings every unit back.`, `Pricing Filters row ${n + 1}: ${f['Filter']}`), async ({ pm }) => {
      await pm.open();
      const all = await pm.rows();
      const p = f['Filter'] === 'Project' ? await projects(pm) : undefined;
      const opts = (await pm.filterOptions(f['Label'])).slice(1);
      const seen: string[] = [];
      for (const o of opts) {
        await pm.choose(f['Label'], o);
        const rows = await pm.rows();
        const s = parseSummary(await pm.summary(...SUMMARY()));
        const want = all.filter(r => matches(r, f['Filter'], o, p?.map)).map(r => r.code);
        seen.push(`${o}: ${rows.length}`);
        expect.soft(rows.filter(r => !matches(r, f['Filter'], o, p?.map)).map(r => r.code), `${o}: only matching units`).toEqual([]);
        expect.soft(rows.map(r => r.code), `${o}: every matching unit of the full list`).toEqual(want);
        if (!Number.isNaN(optionOf(o).count)) expect.soft(rows.length, `${o}: rows = (N)`).toBe(optionOf(o).count);
        expect.soft(s.units, `${o}: summary "Showing N units"`).toBe(rows.length);
      }
      note('options / rows', seen.join(' · '));
      await pm.choose(f['Label'], 0);
      expect((await pm.rows()).length, 'All shows every unit again').toBe(all.length);
    });
  });

  sheet('Filter Combinations').forEach((c, n) => {
    test(...ivpRow('IVP-073', n + 1, `filters ${c['Filters']}`, `For every combination of ${c['Filters']} options (${c['What it checks']}) the rows = units of the unfiltered list that match all of them; the summary follows; All on every filter shows every unit again.`, `Filter Combinations row ${n + 1}: ${c['Filters']}`), async ({ pm }) => {
      await pm.open();
      const all = await pm.rows();
      const p = await projects(pm);
      const used = list(c['Filters']).map(name => filters().find(f => f['Filter'] === name)!);
      const options: string[][] = [];
      for (const f of used) options.push((await pm.filterOptions(f['Label'])).slice(1));
      let combos: string[][] = options.reduce<string[][]>((acc, os) => acc.flatMap(a => os.map(o => [...a, o])), [[]]);
      if (used.length >= 4) combos = combos.filter(cmb => all.some(r => used.every((f, i) => matches(r, f['Filter'], cmb[i], p.map)))).slice(0, 1);
      const done: string[] = [];
      for (const cmb of combos) {
        for (const [i, f] of used.entries()) await pm.choose(f['Label'], cmb[i]);
        const rows = await pm.rows();
        const want = all.filter(r => used.every((f, i) => matches(r, f['Filter'], cmb[i], p.map))).map(r => r.code);
        const s = parseSummary(await pm.summary(...SUMMARY()));
        const label = cmb.join(' + ');
        done.push(`${label}: ${rows.length}`);
        expect.soft(rows.map(r => r.code), `${label}: units matching every filter`).toEqual(want);
        if (!want.length) expect.soft(await pm.emptyText(), `${label}: empty-state line`).toBe(PS('Empty Text'));
        expect.soft(s.units, `${label}: summary "Showing N units"`).toBe(rows.length);
        await pm.resetFilters(used.map(f => f['Label']));
      }
      note('combinations / rows', done.join(' · '));
      expect((await pm.rows()).length, 'All on every filter shows every unit again').toBe(all.length);
    });
  });

  sheet('Search Terms').forEach((s, n) => {
    test(...ivpRow('IVP-074', n + 1, `search by ${s['How']}`, s['Expected'], `Search Terms row ${n + 1}`), async ({ pm }) => {
      await pm.open();
      await pm.view(FULL());
      const all = await pm.rows();
      const r = all[Math.floor(all.length / 3)];
      const col = s['Take From Column'];
      const term = /zzz/.test(s['How']) ? `zzz${Date.now()}` : col === 'Blk/Flr' ? blockFloor(r).floorText : col === 'View' ? nameOf(r.cells['View']) : r.cells[col];
      note('search term', `${term} (from ${r.code} ${col})`);
      await pm.search(term, PS('Search Placeholder'));
      const shown = await pm.rows();
      const sum = parseSummary(await pm.summary(...SUMMARY()));
      const has = (x: PMRow) => [...Object.values(x.cells), ...Object.values(x.titles)].join(' ').toLowerCase().includes(term.toLowerCase());
      note('rows shown', `${shown.length}: ${shown.slice(0, 10).map(x => x.code).join(', ')}`);
      expect.soft(sum.units, 'Summary counts the rows shown').toBe(shown.length);
      if (/zzz/.test(s['How'])) {
        expect.soft(shown.length, 'No unit matches').toBe(0);
        expect.soft(await pm.emptyText(), 'Empty-state line').toBe(PS('Empty Text'));
      }
      else {
        expect.soft(shown.filter(x => !has(x)).map(x => x.code), `Every row shown contains "${term}"`).toEqual([]);
        const same = col === 'Unit Code' ? [r.code] : col === 'View' ? all.filter(x => nameOf(x.cells['View']) === term).map(x => x.code) : all.filter(x => blockFloor(x).floorText === term).map(x => x.code);
        expect.soft(same.filter(c => !shown.some(x => x.code === c)), `Every unit with ${col} "${term}" is shown`).toEqual([]);
      }
      await pm.search('', PS('Search Placeholder'));
      expect((await pm.rows()).length, 'Clearing the search shows every unit').toBe(all.length);
    });
  });

  test(...ivp('IVP-075'), async ({ pm }) => {
    await pm.open();
    const [status, block] = ['Status', 'Block'].map(n => filters().find(f => f['Filter'] === n)!['Label']);
    const sOpts = (await pm.filterOptions(status)).slice(1);
    const bOpts = (await pm.filterOptions(block)).slice(1);
    const all = await pm.rows();
    const s = sOpts.find(o => all.some(r => matches(r, 'Status', o) && bOpts.some(b => matches(r, 'Block', b))))!;
    const b = bOpts.find(o => all.some(r => matches(r, 'Status', s) && matches(r, 'Block', o)))!;
    await pm.choose(status, s);
    await pm.choose(block, b);
    const codes = (await pm.rows()).map(r => r.code);
    note('filters / units', `${s} + ${b}: ${codes.length}`);
    for (const v of [FULL(), COMPACT(), EXACT(), STANDARD()]) {
      await pm.view(v);
      expect.soft((await pm.rows()).map(r => r.code), `${v}: same units`).toEqual(codes);
      expect.soft([await pm.filterValue(status), await pm.filterValue(block)], `${v}: filters keep their choice`).toEqual([s, b]);
    }
    await pm.resetFilters([status, block]);
  });

  test(...ivp('IVP-076'), async ({ pm }) => {
    await pm.open();
    const status = filters().find(f => f['Filter'] === 'Status')!['Label'];
    const opt = (await pm.filterOptions(status)).slice(1).sort((a, b) => optionOf(b).count - optionOf(a).count)[0];
    await pm.choose(status, opt);
    await pm.view(FULL());
    const header = await pm.header();
    const rows = await pm.rows();
    const file = await pm.export(PS('Export Button'));
    note('export', `${file.name}: ${file.rows.length} rows · columns ${file.header.join(' | ')}`);
    const codeCol = file.header.find(h => /unit\s*code/i.test(h)) ?? file.header[0];
    const curCol = file.header.find(h => /current/i.test(h));
    // the price floor ("Price Floor", "Floor (-3%)"), not the floor number or the floor premium
    const floorCol = file.header.find(h => /price\s*floor/i.test(h)) ?? file.header.find(h => /^floor\s*\(/i.test(h.trim()));
    expect.soft(floorCol, `File has a price floor column (${file.header.join(' | ')})`).toBeTruthy();
    expect.soft(file.rows.length, `Export rows = units shown (${opt})`).toBe(rows.length);
    const byCode = new Map(file.rows.map(x => [String(x[codeCol]).trim(), x]));
    expect.soft(rows.map(r => r.code).filter(c => !byCode.has(c)), 'Every unit shown is in the file').toEqual([]);
    expect.soft(curCol, 'File has a current price column').toBeTruthy();
    const wrong: string[] = [];
    for (const r of rows) {
      const x = byCode.get(r.code);
      if (!x) continue;
      const f = figures(r, header);
      if (curCol && !sameMoney(money(String(x[curCol])), f.current)) wrong.push(`${r.code} current ${x[curCol]} ≠ ${f.current}`);
      if (floorCol && !sameMoney(money(String(x[floorCol])), f.floor)) wrong.push(`${r.code} floor ${x[floorCol]} ≠ ${f.floor}`);
    }
    expect(bad(wrong), 'File prices = matrix').toBe('');
    await pm.choose(status, 0);
  });
});

test.describe('Inventory · Pricing Matrix design', () => {
  test.describe.configure({ timeout: 600_000 });

  test(...ivp('IVP-091'), async ({ pm, page }) => {
    await pm.open();
    for (const v of [STANDARD(), FULL()]) {
      await pm.view(v);
      const header = await pm.header();
      const rows = await pm.rows();
      const moneyCols = ['Base Rate', 'Std Price', 'Net Adj', 'Adj Std', ...tierColumns(header).map(t => t.header), 'Current Price', floorColumn(header)].filter(c => header.columns.includes(c));
      const pctCols = ['Floor %', 'Other %', 'Total %'].filter(c => header.columns.includes(c));
      const money_: string[] = [], pct_: string[] = [], empty: string[] = [];
      for (const r of rows) {
        for (const c of moneyCols) if (!/^[+-]?\$\d{1,3}(,\d{3})*$/.test(r.cells[c])) money_.push(`${r.code} ${c} "${r.cells[c]}"`);
        for (const c of pctCols) if (!/^([+-]\d+(\.\d+)?|0)%$/.test(r.cells[c])) pct_.push(`${r.code} ${c} "${r.cells[c]}"`);
        if (header.columns.includes('View') && !/^(.+ \(([+-]\d+(\.\d+)?|0)%\)|-)$/.test(r.cells['View'])) pct_.push(`${r.code} View "${r.cells['View']}"`);
        for (const c of ['Status', 'Tier']) if (!r.cells[c]) empty.push(`${r.code} ${c}`);
      }
      const text = await page.locator('main').innerText();
      expect.soft(broken(text), `${v}: no broken values on the tab`).toEqual([]);
      expect.soft(bad(money_), `${v}: amounts read "$" + digits with thousands commas`).toBe('');
      expect.soft(bad(pct_), `${v}: % read +N%, -N% or 0%`).toBe('');
      expect.soft(bad(empty), `${v}: every row has a status and a tier`).toBe('');
    }
    await pm.view(STANDARD());
  });

  test(...ivp('IVP-092'), async ({ pm }) => {
    await pm.open();
    const rows = await pm.rows();
    const covered: string[] = [];
    for (const r of rows) {
      for (const [what, loc] of [['unit code', pm.unitCode(r.code)], [PS('Breakdown Button'), pm.rowButton(r.code, PS('Breakdown Button'))], [PS('Row Edit Button'), pm.rowButton(r.code, PS('Row Edit Button'))]] as const) {
        const c = await coverOf(loc);
        if (c) covered.push(`${r.code} ${what}: ${c}`);
      }
    }
    for (const f of filterLabels()) { const c = await coverOf(pm.filter(f)); if (c) covered.push(`filter ${f} ${c}`); }
    note('covered', bad(covered, 20) || 'nothing');
    expect(bad(covered, 10), 'Nothing lies on top of the row buttons and filters').toBe('');
  });

  test(...ivp('IVP-093'), async ({ pm, page }) => {
    const size = page.viewportSize()!;
    const out: string[] = [];
    try {
      for (const w of list(PS('Layout Widths')).map(Number)) {
        await page.setViewportSize({ width: w, height: size.height });
        await pm.open();
        for (const v of [STANDARD(), FULL()]) {
          await pm.view(v);
          const sideScroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          const h = await pm.header();
          out.push(`${w}px ${v}: side-scroll ${sideScroll}px`);
          expect.soft(sideScroll, `${w}px ${v}: the page does not scroll sideways`).toBeLessThanOrEqual(1);
          expect.soft(h.groups.reduce((a, g) => a + g.span, 0), `${w}px ${v}: header groups span every column`).toBe(h.columns.length);
          for (const b of [...sheet('Pricing Views').map(x => x['Button']), ...sheet('Pricing Actions').map(x => x['Button'])]) {
            const loc = page.locator('main').getByRole('button', { name: b, exact: true }).first();
            const box = await loc.boundingBox();
            expect.soft(!!box && box.x >= 0 && box.x + box.width <= w + 1, `${w}px ${v}: "${b}" inside the window`).toBeTruthy();
          }
        }
      }
    } finally {
      await page.setViewportSize(size);
      note('layout', out.join(' · '));
    }
  });

  test(...ivp('IVP-094'), async ({ pm, page }) => {
    await pm.open();
    const matrix = new Map((await pm.rows()).map(r => [r.code, r.cells['Status']]));
    const inv = new InventoryPage(page, DATA.setting('Inventory Route'));
    await inv.openTab(DATA.sheet('Tabs').find(t => t['Shows'] === 'Unit Register')!['Tab']);
    const register = new Map((await inv.allRows()).map(r => [r.lines[0], (r.cells['Status'] ?? '').trim()]));
    note('units matrix / register', `${matrix.size} / ${register.size}`);
    expect.soft([...register.keys()].filter(c => !matrix.has(c)), 'Register units missing from the matrix').toEqual([]);
    expect.soft([...matrix.keys()].filter(c => !register.has(c)), 'Matrix units missing from the register').toEqual([]);
    const diff = [...matrix].filter(([c, s]) => register.has(c) && register.get(c)!.toLowerCase() !== s.toLowerCase()).map(([c, s]) => `${c}: matrix ${s} / register ${register.get(c)}`);
    expect(bad(diff), 'Same status in the matrix and the Unit Register').toBe('');
  });
});
