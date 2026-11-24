/**
 * Pricing Matrix → row Edit → unit window (IVP-083 … IVP-090): the nine left-side sections, Identification and
 * Sales against the matrix row, the Sales edit form (wrong values, combinations, manual price override) and the
 * New (Create Unit) form, which is never saved.
 *
 * IVP-087 … IVP-089 save the Sales section of ONE unit: the first Available unit the matrix lists at run time.
 * Its values are read first and put back in `finally`; only that unit is re-priced (no Recalculate button is
 * pressed). No project, product or unit is created.
 * Run: npx playwright test tests/inventory-page/pricing-sales.spec.ts --workers=1
 */
import { test, expect, note, ivp, ivpRow, PS, SS, list, sheet, sameMoney, sameShown, money, pct, floorColumn, discountOf, tierColumns, tierOf, premiums, blockFloor, figures, broken } from './pricing-shared';
import type { PMRow, PMHeader } from './pricing-shared';
import { watchWrites, UnitSales, PricingMatrixPage } from '../pages/PricingMatrixPage';
import { UnitView } from '../pages/SalesPages';
import { withSalesLock } from '../sales-chain/inventory';
import { DATA } from './shared';

const FULL = () => sheet('Pricing Views').find(v => v['Group'] === 'Layers' && v['Default'] !== 'Yes')!['Button'];
const SECTIONS = () => DATA.sheet('Unit Sections').map(r => r['Section']);
const FIELDS = () => sheet('Sales Fields');
const fieldName = (label: string) => FIELDS().find(f => f['Field Label'] === label)!['Field Name'];
const NAMES = () => FIELDS().map(f => f['Field Name']);
const WAIT = () => Number(PS('Save Wait Seconds')) * 1000;
const value = (lines: string[], caption: string) => UnitView.value(lines, caption);

/** Reads the matrix in Full 2-Layer view; returns the row of `code` (or every row). */
async function matrix(pm: PricingMatrixPage) {
  await pm.open();
  await pm.view(FULL());
  return { header: await pm.header(), rows: await pm.rows() };
}
/** The unit used by the tests that save: the first Available unit of the list. */
async function availableUnit(pm: PricingMatrixPage) {
  const m = await matrix(pm);
  const r = m.rows.find(x => x.cells['Status'] === PS('Available Status'));
  test.skip(!r, `No ${PS('Available Status')} unit on the Pricing Matrix`);
  return { ...m, row: r! };
}
/** Opens the unit from its matrix row (Edit) on the Sales section. */
async function openSales(pm: PricingMatrixPage, code: string): Promise<UnitSales> {
  const u = await pm.editUnit(code, PS('Row Edit Button'));
  await u.open(SS('Sales Section'));
  return u;
}
async function closeUnit(u: UnitSales) { await u.close(SS('Close Button'), SS('Discard Button')); }
const sales = (u: UnitSales) => u.open(SS('Sales Section'));

/** Sales section figures (view mode), by the captions of the Unit Window Captions sheet. */
function salesFigures(lines: string[]) {
  const cap = (col: string) => sheet('Unit Window Captions').find(c => c['Section'] === 'Sales' && c['Matrix Column'] === col)!['Caption'];
  const baseLine = lines[lines.findIndex(l => l.toUpperCase() === cap('Std Price').toUpperCase()) + 2] ?? '';
  // amounts as shown (1M and more are rounded, e.g. "5.76M USD"): compare them with sameShown
  const raw = { current: value(lines, cap('Current Price')), floor: value(lines, cap('Floor (')), adj: value(lines, cap('Adj Std')), std: value(lines, cap('Std Price')), netAdj: value(lines, cap('Net Adj')) };
  return {
    raw,
    current: money(value(lines, cap('Current Price'))), floor: money(value(lines, cap('Floor ('))), adj: money(value(lines, cap('Adj Std'))),
    std: money(value(lines, cap('Std Price'))), totalPct: pct(value(lines, cap('Total %'))), netAdj: money(value(lines, cap('Net Adj'))), otherPct: pct(value(lines, cap('Other %'))),
    carpet: Number((baseLine.match(/([\d.,]+)\s*m²/) ?? ['', 'NaN'])[1].replace(/,/g, '')), rate: money((baseLine.match(/\$([\d.,]+)/) ?? ['', ''])[1]),
    discount: pct(lines.find(l => /^Discount Limit:/i.test(l)) ?? '', false),
  };
}
/** Tier table of the Sales section: name, %, price, floor, active. */
async function tierTable(u: UnitSales) {
  return u.view.root.locator('table').last().evaluate(t => [...t.querySelectorAll('tbody tr')].map(r => {
    const c = [...r.querySelectorAll('td')].map(td => (td as HTMLElement).innerText.replace(/\s+/g, ' ').trim());
    return { name: c[0], pct: c[1], price: c[2], floor: c[3], status: c.slice(4).join(' ') };
  }));
}

test.describe('Inventory · Pricing Matrix unit window', () => {
  test.describe.configure({ timeout: 600_000 });

  test(...ivp('IVP-083'), async ({ pm, page }) => {
    const { rows } = await matrix(pm);
    const r = rows[0];
    const u = await pm.editUnit(r.code, PS('Row Edit Button'));
    const list_ = await u.sectionList();
    note('unit / sections', `${r.code}: ${list_.map(s => `${s.name} ${s.state}`).join(' · ')}`);
    expect.soft(list_.map(s => s.name), 'Nine left-side sections in order').toEqual(SECTIONS());
    expect.soft(list_.find(s => s.name === SS('Sales Section'))?.state, 'Opens on Sales').toBe('VIEW');
    expect.soft((await u.lines()).includes(r.code), `Window of ${r.code}`).toBeTruthy();
    for (const s of SECTIONS()) {
      const l = await u.open(s);
      expect.soft(l[0], `Section "${s}" opens with its heading`).toBe(s);
      expect.soft(l.length, `Section "${s}" shows content`).toBeGreaterThan(2);
    }
    await closeUnit(u);
    await expect(page.locator('main'), 'Back on the matrix').toContainText(PS('Pricing Title'));
  });

  test(...ivp('IVP-084'), async ({ pm }) => {
    const { header, rows } = await matrix(pm);
    const picks = [rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]];
    for (const r of picks) {
      const f = figures(r, header);
      const p = premiums(r);
      const u = await pm.editUnit(r.code, PS('Row Edit Button'));
      const id = await u.open(SECTIONS()[0]);
      for (const c of sheet('Unit Window Captions').filter(x => x['Section'] === 'Identification')) {
        const shown = value(id, c['Caption']);
        const col = c['Matrix Column'].startsWith('Floor (') ? floorColumn(header) : c['Matrix Column'];
        const want = r.cells[col];
        const ok = c['Compare'] === 'same' ? shown === want : c['Compare'] === 'starts with' ? shown.startsWith(want)
          : c['Compare'] === 'amount' ? sameShown(shown, money(want))
          : shown.replace(/\s/g, '') === `${blockFloor(r).code}/${blockFloor(r).floorText}`;
        expect.soft(ok, `${r.code} Identification ${c['Caption']} "${shown}" vs matrix ${col} "${want}"${c['Compare'] === 'block code / floor' ? ` (${r.titles['Blk/Flr']})` : ''}`).toBeTruthy();
      }
      const l = await sales(u);
      const s = salesFigures(l);
      note(`${r.code} Sales`, JSON.stringify(s));
      for (const [k, want] of [['current', f.current], ['floor', f.floor], ['adj', f.adj], ['std', f.std], ['netAdj', f.netAdj]] as const) expect.soft(sameShown(s.raw[k], want), `${r.code} Sales ${k} ${s.raw[k]} = matrix ${want}`).toBeTruthy();
      expect.soft([s.carpet, s.rate], `${r.code} Sales "carpet × rate" = matrix`).toEqual([f.carpet, f.rate]);
      expect.soft(s.totalPct, `${r.code} Sales total % = matrix`).toBe(f.totalPct);
      expect.soft(s.otherPct, `${r.code} Sales other % = matrix`).toBe(f.otherPct);
      expect.soft(pct(l[l.findIndex(x => x.startsWith('Floor (')) + 1] ?? ''), `${r.code} Sales floor %`).toBe(f.floorPct);
      expect.soft(pct(l[l.findIndex(x => x.startsWith('View (')) + 1] ?? ''), `${r.code} Sales view %`).toBe(f.viewPct);
      expect.soft(pct(l[l.findIndex(x => x.startsWith('Orientation (')) + 1] ?? ''), `${r.code} Sales orientation %`).toBe(p['Orient'].pct);
      expect.soft(pct(l[l.findIndex(x => x.startsWith('Position (')) + 1] ?? ''), `${r.code} Sales position %`).toBe(p['Pos'].pct);
      expect.soft(s.discount, `${r.code} Sales discount limit = matrix header`).toBe(discountOf(header));
      const tiers = await tierTable(u);
      note(`${r.code} tier table`, tiers.map(t => `${t.name} ${t.pct} ${t.price} / ${t.floor} ${t.status}`).join(' · '));
      for (const t of tiers) {
        const col = f.tiers.find(c => c.pct === pct(t.pct, false));
        expect.soft(sameShown(t.price, col?.price ?? NaN), `${r.code} tier ${t.name} price ${t.price} = matrix ${col?.header} ${col?.price}`).toBeTruthy();
        expect.soft(sameShown(t.floor, (col?.price ?? NaN) * (1 - s.discount / 100)), `${r.code} tier ${t.name} floor ${t.floor} = price × (1 − ${s.discount}%)`).toBeTruthy();
      }
      const active = tiers.filter(t => /active/i.test(t.status) || /active/i.test(l[l.findIndex(x => x.startsWith(t.name)) + 1] ?? ''));
      const tierRow = tierOf(r);
      expect.soft(active.map(t => t.name), `${r.code}: the active tier is the matrix tier ${r.cells['Tier']}`).toEqual(tierRow ? [tierRow['Sales Edit Option']] : ['?']);
      await closeUnit(u);
    }
  });

  test(...ivp('IVP-085'), async ({ pm }) => {
    const { rows } = await matrix(pm);
    const r = rows[Math.floor(rows.length / 3)];
    const u = await pm.editUnit(r.code, PS('Row Edit Button'));
    const empty: string[] = [];
    for (const s of SECTIONS()) {
      const l = await u.open(s);
      note(`${s}`, l.slice(1, 30).join(' | '));
      expect.soft(broken(l.join(' ')), `${r.code} ${s}: no broken values`).toEqual([]);
      if (l.length < 3) empty.push(s);
    }
    expect(empty, `${r.code}: every section shows values`).toEqual([]);
    await closeUnit(u);
  });

  test(...ivp('IVP-086'), async ({ pm, page }) => {
    const { row, header } = await availableUnit(pm);
    const writes = watchWrites(page);
    let u = await openSales(pm, row.code);
    const view = await sales(u);
    await u.edit(SS('Edit Mode Button'));
    const v = await u.values(NAMES());
    note(`${row.code} Sales edit fields`, JSON.stringify(v));
    expect.soft(Object.entries(v).filter(([, x]) => x === '(missing)').map(([k]) => k), 'Every field of the Sales Fields sheet is in the form').toEqual([]);
    const s = salesFigures(view);
    for (const c of sheet('Sales View Captions')) {
      const shown = c['Field Name'] === 'carpetAreaPricing' ? String(s.carpet) : c['Field Name'] === 'baseRatePerSqm' ? String(s.rate)
        : c['Field Name'] === 'discountLimitPct' ? String(s.discount) : value(view, c['Caption']);
      const field = v[c['Field Name']];
      const same = /amount|percent/.test(c['How']) || ['carpetAreaPricing', 'baseRatePerSqm', 'discountLimitPct'].includes(c['Field Name'])
        ? Math.abs(Number(field) - (c['How'] === 'percent' ? pct(shown) : money(shown))) < 0.01 : field.trim() === shown.trim();
      expect.soft(same, `${c['Field Name']} "${field}" = view mode ${c['Caption']} "${shown}"`).toBeTruthy();
    }
    expect.soft(v[fieldName('Active Commercial Tier (Layer 2)')], 'Tier = the matrix tier').toBe(tierOf(row)?.['Sales Edit Option'] ? `${tierOf(row)!['Sales Edit Option']} (${tierColumns(header).find(t => t.header.startsWith(tierOf(row)!['Matrix Tier Header']))?.header.match(/\(([^)]+)\)/)?.[1]})` : '?');
    // change a value, then leave without saving
    const other = fieldName('Other Additive Adjustment %');
    await u.set(other, String(Number(v[other] || 0) + 1));
    await closeUnit(u);
    u = await openSales(pm, row.code);
    const again = await sales(u);
    expect.soft(again, 'Sales section unchanged after leaving without saving').toEqual(view);
    expect(writes.map(w => `${w.method} ${w.url}`), 'Leaving edit mode sends nothing').toEqual([]);
    await closeUnit(u);
  });

  test(...ivp('IVP-090'), async ({ pm, page }) => {
    const { rows } = await matrix(pm);
    const writes = watchWrites(page);
    const u = await pm.editUnit(rows[0].code, PS('Row Edit Button'));
    await u.button(SS('New Button')).click();
    await page.waitForTimeout(1000);
    const l = await u.lines();
    note('Create Unit form', l.slice(0, 40).join(' | '));
    expect.soft(l[0], 'Heading').toBe(SS('Create Unit Heading'));
    expect.soft((await u.sectionList()).find(s => s.name === SECTIONS()[0])?.state, 'Identification in edit mode').toBe('EDITING');
    const unitFields = DATA.sheet('Form Fields').filter(f => f['Form'] === 'Unit');
    const v = await u.values(unitFields.map(f => f['Field Name']));
    expect.soft(Object.entries(v).filter(([, x]) => x === '(missing)').map(([k]) => k), 'Create Unit fields of the Form Fields sheet').toEqual([]);
    expect.soft(l.includes(SS('New Unit Note')), `"${SS('New Unit Note')}"`).toBeTruthy();
    // "Default project currency", or the project currency itself (the window shows "Amounts in USD")
    const cur = v[unitFields.find(f => f['Field Label'] === 'Currency')!['Field Name']];
    const projectCurrency = await u.currency();
    note('currency at first / project currency', `${cur} / ${projectCurrency}`);
    expect.soft(cur === SS('Default Currency Option') || (!!projectCurrency && cur.startsWith(`${projectCurrency} `)), `Currency starts with "${SS('Default Currency Option')}" or the project currency ${projectCurrency} ("${cur}")`).toBeTruthy();
    await expect.soft(u.button(SS('Create Unit Button')), `"${SS('Create Unit Button')}" is there (never clicked)`).toBeVisible();
    await closeUnit(u);
    expect(writes.map(w => `${w.method} ${w.url}`), 'Nothing is created').toEqual([]);
  });
});

// ── Saves on one unit (values put back at the end) ─────────────────────────
test.describe('Inventory · Pricing Matrix Sales edit (saves, restored)', () => {
  test.describe.configure({ mode: 'default', timeout: 900_000 });

  /** Original Sales values and matrix row of the unit, and a way to put them back. */
  async function snapshot(pm: PricingMatrixPage) {
    const { header, row } = await availableUnit(pm);
    const u = await openSales(pm, row.code);
    const view = await sales(u);
    await u.edit(SS('Edit Mode Button'));
    const values = await u.values(NAMES());
    await closeUnit(u);
    note('unit used / original values', `${row.code}: ${JSON.stringify(values)}`);
    return { header, row, view, values };
  }
  async function restore(pm: PricingMatrixPage, writes: ReturnType<typeof watchWrites>, s: Awaited<ReturnType<typeof snapshot>>) {
    const { rows } = await matrix(pm);
    const now = rows.find(r => r.code === s.row.code);
    if (now && JSON.stringify(now.cells) === JSON.stringify(s.row.cells)) {
      const u = await openSales(pm, s.row.code);
      const same = JSON.stringify(await sales(u)) === JSON.stringify(s.view);
      await closeUnit(u);
      if (same) return;
    }
    const u = await openSales(pm, s.row.code);
    await u.edit(SS('Edit Mode Button'));
    for (const n of NAMES()) if (s.values[n] !== '(missing)') await u.set(n, s.values[n]);
    const r = await u.save(SS('Save Button'), writes, WAIT());
    note('restored', `${s.row.code}: ${r.writes.map(w => `${w.method} ${w.status}`).join(', ')} ${r.message}`);
    await u.dismissMessages();
    await closeUnit(u).catch(() => {});
    const after = (await matrix(pm)).rows.find(x => x.code === s.row.code);
    expect(after?.cells, `${s.row.code} back to its original matrix row`).toEqual(s.row.cells);
  }
  const ok = (w: { status: number }[]) => w.some(x => x.status >= 200 && x.status < 300);

  sheet('Sales Invalid Values').forEach((c, n) => {
    test(...ivpRow('IVP-087', n + 1, `${c['Field Label']} = "${c['Value']}"`, c['Expected Message Contains'] ? `Not saved; message contains "${c['Expected Message Contains']}"; prices unchanged` : 'Not saved (a message about the field, or the field does not take the value); prices and the matrix row unchanged', `Sales Invalid Values row ${n + 1}`), async ({ pm, page }) => {
      await withSalesLock(async () => {
        const writes = watchWrites(page);
        const s = await snapshot(pm);
        try {
          const u = await openSales(pm, s.row.code);
          await u.edit(SS('Edit Mode Button'));
          const name = fieldName(c['Field Label']);
          await u.set(name, c['Value']);
          const typed = (await u.values([name]))[name];
          note('typed / field shows', `"${c['Value']}" / "${typed}"`);
          if (typed !== c['Value']) {
            // the field does not take the value: nothing to save
            expect.soft(typed, `${c['Field Label']} does not take "${c['Value']}"`).not.toBe(c['Value']);
            await closeUnit(u);
          } else {
            const r = await u.save(SS('Save Button'), writes, WAIT());
            note('save result', `${r.writes.map(w => `${w.method} ${w.url} ${w.status}`).join(', ') || 'no request'} · message "${r.message}" · still editing ${r.editing}`);
            expect.soft(ok(r.writes), `"${c['Value']}" in ${c['Field Label']} is not saved`).toBeFalsy();
            expect.soft(r.message, 'A message tells the user what is wrong').not.toBe('');
            if (c['Expected Message Contains']) expect.soft(r.message, 'Message').toContain(c['Expected Message Contains']);
            await u.dismissMessages();
            await closeUnit(u);
          }
          const after = (await matrix(pm)).rows.find(x => x.code === s.row.code);
          expect(after?.cells, 'Matrix row unchanged').toEqual(s.row.cells);
        } finally {
          await restore(pm, writes, s);
        }
      });
    });
  });

  test(...ivp('IVP-088'), async ({ pm, page }) => {
    await withSalesLock(async () => {
      const writes = watchWrites(page);
      const s = await snapshot(pm);
      const physical = figures(s.row, s.header).totalPct - figures(s.row, s.header).otherPct;
      const cols = Object.keys(sheet('Sales Edit Combinations')[0]).filter(k => FIELDS().some(f => f['Field Label'] === k));
      const tierPct = new Map(sheet('Tier Codes').map(t => [t['Sales Edit Option'], tierColumns(s.header).find(c => c.header.startsWith(`${t['Matrix Tier Header']} (`))?.pct ?? NaN]));
      try {
        for (const [n, c] of sheet('Sales Edit Combinations').entries()) {
          const label = `IVP-088.${n + 1} ${c['What it covers']}`;
          const u = await openSales(pm, s.row.code);
          await u.edit(SS('Edit Mode Button'));
          const typed: Record<string, string> = {};
          for (const k of cols) {
            if (!c[k]) continue;
            const name = fieldName(k);
            const v = /^[+-]\d/.test(c[k]) ? String(Number(s.values[name]) + Number(c[k])) : c[k];
            await u.set(name, v);
            typed[k] = v;
          }
          const r = await u.save(SS('Save Button'), writes, WAIT());
          note(label, `typed ${JSON.stringify(typed)} · ${r.writes.map(w => `${w.method} ${w.status}`).join(', ')} · "${r.message}"`);
          expect.soft(ok(r.writes) && !r.writes.some(w => w.status >= 400), `${label}: saved`).toBeTruthy();
          await u.dismissMessages();
          const v = await (async () => { const l = await sales(u); return salesFigures(l); })();
          await closeUnit(u).catch(() => {});
          const get = (k: string) => (typed[k] ?? s.values[fieldName(k)]);
          const carpet = Number(get('Carpet Area for Pricing (sqm)')), rate = Number(get('Base Rate ($/sqm)'));
          const other = Number(get('Other Additive Adjustment %')), disc = Number(get('Discount Limit % (Price Floor)'));
          const tier = get('Active Commercial Tier (Layer 2)').replace(/\s*\(.*$/, '');
          const want = { std: carpet * rate, total: physical + other };
          const adj = want.std * (1 + want.total / 100);
          const current = adj * (1 + (tierPct.get(tier) ?? NaN) / 100);
          const expected = { std: want.std, totalPct: want.total, adj, current, floor: current * (1 - disc / 100) };
          note(`${label} expected / Sales`, `${JSON.stringify(expected)} / ${JSON.stringify(v)}`);
          expect.soft(sameShown(v.raw.std, expected.std), `${label}: Sales standard ${v.raw.std} = ${carpet} × ${rate}`).toBeTruthy();
          expect.soft(v.totalPct, `${label}: Sales total % = physical ${physical}% + other ${other}%`).toBe(expected.totalPct);
          expect.soft(sameShown(v.raw.adj, expected.adj, 2), `${label}: Sales adjusted ${v.raw.adj} = ${Math.round(expected.adj)}`).toBeTruthy();
          expect.soft(sameShown(v.raw.current, expected.current, 3), `${label}: Sales current ${v.raw.current} = ${tier} ${Math.round(expected.current)}`).toBeTruthy();
          expect.soft(sameShown(v.raw.floor, expected.floor, 3), `${label}: Sales floor ${v.raw.floor} = current × (1 − ${disc}%) ${Math.round(expected.floor)}`).toBeTruthy();
          expect.soft(v.discount, `${label}: Sales discount limit`).toBe(disc);
          const m = await matrix(pm);
          const row = m.rows.find(x => x.code === s.row.code)!;
          const f = figures(row, m.header);
          note(`${label} matrix row`, `${JSON.stringify(row.cells)} · Tier title "${row.titles['Tier']}"`);
          expect.soft(sameShown(v.raw.current, f.current) && sameShown(v.raw.std, f.std) && sameShown(v.raw.adj, f.adj), `${label}: matrix row = Sales (current ${f.current} / ${v.raw.current}, std ${f.std} / ${v.raw.std}, adj ${f.adj} / ${v.raw.adj})`).toBeTruthy();
          expect.soft(sameMoney(f.current, expected.current, 3), `${label}: matrix current ${f.current} = ${Math.round(expected.current)}`).toBeTruthy();
          expect.soft(tierOf(row)?.['Sales Edit Option'], `${label}: matrix Tier = ${tier}`).toBe(tier);
          expect.soft(sameShown(v.raw.floor, f.floor), `${label}: matrix floor ${f.floor} = Sales floor ${v.raw.floor}`).toBeTruthy();
        }
      } finally {
        await restore(pm, writes, s);
      }
    });
  });

  test(...ivp('IVP-089'), async ({ pm, page }) => {
    await withSalesLock(async () => {
      const writes = watchWrites(page);
      const s = await snapshot(pm);
      const f0 = figures(s.row, s.header);
      const c = sheet('Override Cases')[0];
      // "{current}+25000" → the current price plus 25000
      const price = String(Math.round(f0.current + Number(c['Approved Selling Price'].replace('{current}', '').replace(/\s/g, '') || 0)));
      try {
        const u = await openSales(pm, s.row.code);
        await u.edit(SS('Edit Mode Button'));
        await u.set(fieldName('Enable Manual Price Override'), 'true');
        await u.set(fieldName('Approved Selling Price'), price);
        const r = await u.save(SS('Save Button'), writes, WAIT());
        note('override save', `${price} · ${r.writes.map(w => `${w.method} ${w.status}`).join(', ')} · "${r.message}"`);
        expect.soft(ok(r.writes), 'Override saved').toBeTruthy();
        await u.dismissMessages();
        const l = await sales(u);
        const v = salesFigures(l);
        note('Sales with override', l.slice(0, 25).join(' | '));
        expect.soft(sameShown(v.raw.current, Number(price)), `Operative current price ${v.raw.current} = approved ${price}`).toBeTruthy();
        expect.soft(sameShown(v.raw.floor, Number(price) * (1 - v.discount / 100)), `Price floor ${v.raw.floor} follows the approved price`).toBeTruthy();
        expect.soft((l.find(x => x.startsWith(SS('Governance Line'))) ?? ''), 'Governance line names the manual price').toContain(SS('Override Word'));
        await closeUnit(u);
        const row = (await matrix(pm)).rows.find(x => x.code === s.row.code)!;
        expect(sameMoney(money(row.cells['Current Price']), Number(price)), `Matrix Current Price ${row.cells['Current Price']} = approved ${price}`).toBeTruthy();
      } finally {
        await restore(pm, writes, s);
      }
    });
  });
});
