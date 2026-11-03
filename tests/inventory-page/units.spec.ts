/** Manage units (IVP-031 … IVP-039) and the unit view (IVP-050 … IVP-053). Units are created in the test project only. */
import { test, expect, ivp, ivpRow, note, DATA, tabs, cards, expectChanges, names, row, newForm, saveButton, testProject, seq, mayCreate } from './shared';
import { withSalesLock, createUnit, findUnit, CreatedUnit } from '../sales-chain/inventory';
import { ModalForm, MediaPanel, UnitView } from '../pages/SalesPages';
import { parseNum } from '../helpers';
import { formValues, fill } from '../sales-chain/data';
import type { Page } from '@playwright/test';

const S = (k: string) => DATA.setting(k);
const UNITS = () => tabs().find(t => t['Shows'] === 'Unit Register')!['Tab'];
const invalid = (caseId: string) => DATA.sheet('Invalid Values').filter(r => r['Case ID'] === caseId);

/** One unit for this worker (Units row 1), shared by the unit tests after IVP-033. */
let made: Promise<{ unit: CreatedUnit; result: Awaited<ReturnType<ModalForm['submit']>>; project: { code: string } }> | undefined;
function createdUnit(page: Page) {
  made ??= createUnit(page, DATA, row('Units')).then(r => { note(r.unit.reused ? 'unit used (existing, Create New Units = No)' : 'unit created', JSON.stringify(r.unit.values)); return r; })
    .catch(e => { made = undefined; throw e; });
  return made;
}

test.describe('Inventory · Units', () => {
  test.describe.configure({ timeout: 300_000 });

  test(...ivp('IVP-031'), async ({ inv, page }) => {
    const form = await newForm(page, inv, UNITS());
    const text = await form.text();
    note('form', text.slice(0, 400));
    expect.soft(text, 'Availability note').toContain(S('New Unit Status Note'));
    expect(text, 'Availability').toContain(S('New Unit Status'));
    for (const f of DATA.sheet('Form Fields').filter(r => r['Form'] === 'Unit')) expect.soft(text, `Field "${f['Field Label']}"`).toContain(f['Field Label']);
    await form.close();
  });

  invalid('IVP-032').forEach((v, i) => {
    test(...ivpRow('IVP-032', i + 1, `${v['Field Left Empty']} empty`, `A message names "${v['Expected Message Contains']}"; not saved`, `${v['Form']} without ${v['Field Left Empty']}`), async ({ inv, page }) => {
      const proj = await testProject(page, DATA);
      const n = names('Unit');
      const values = formValues(row('Units'), n, { project: proj.code, seq: seq() });
      if (v['Field Left Empty'] !== 'Project') values[n['Project']] = `~${proj.code}`;
      delete values[n[v['Field Left Empty']]];
      note('test data', JSON.stringify(values));
      const form = await newForm(page, inv, UNITS());
      await form.fill(values);
      const r = await form.submit(saveButton(UNITS()), { wait: 8_000 });
      note('pop-up', r.notice?.text ?? 'none');
      expect(r.closed, 'Form stays a new unit (nothing created)').toBeFalsy();
      expect(r.notice?.text ?? 'no message at all', 'Message names the missing field').toContain(v['Expected Message Contains']);
      await form.closeNotice();
      await form.close();
    });
  });

  test(...ivp('IVP-033'), async ({ inv, page }) => {
    test.skip(!mayCreate(DATA, 'Units'), 'Not run: the data says Create New Units = No (no new units in this round); the other unit tests use an existing unit of the test project');
    await testProject(page, DATA);
    await withSalesLock(async () => {
      const before = await cards(inv);
      const { unit, result, project } = await createdUnit(page);
      note('pop-up', result.notice?.text ?? 'none');
      expect.soft(result.closed, 'Unit saved (form switched to the unit)').toBeTruthy();
      const valueShown = await (async () => { await inv.open(); return inv.kpiText('Value'); })();
      const after = await cards(inv);
      expectChanges('Create Unit', before, after, unit.price, valueShown);
      const r = await findUnit(page, DATA, unit.code);
      note('register row', r?.text ?? 'not listed');
      expect(r, 'Unit listed').toBeTruthy();
      const n = names('Unit');
      expect.soft(r!.cells['Project'] ?? '', 'Project').toContain(project.code);
      expect.soft(r!.cells['Type'], 'Type').toBe(unit.values[n['Unit Type']]);
      expect.soft(r!.cells['Area'], 'Area').toBe(unit.values[n['Net Area']]);
      expect.soft(parseNum(r!.cells['Price'] ?? '0'), 'Price').toBeCloseTo(unit.price, -3);
      expect(r!.cells['Status'], 'Status').toBe(S('New Unit Status'));
    });
  });

  test(...ivp('IVP-034'), async ({ inv, page }) => {
    const form = await newForm(page, inv, UNITS());
    const selected = await form.selected(names('Unit')['Currency']);
    note('Currency before choosing', selected);
    expect(selected, 'Currency starts with').toBe(S('Default Unit Currency Option'));
    await form.close();
  });

  test(...ivp('IVP-035'), async ({ inv, page }) => {
    const { unit, project } = await createdUnit(page);
    const n = names('Unit');
    const form = await newForm(page, inv, UNITS());
    await form.fill({ [n['Project']]: `~${project.code}`, [n['Unit Code']]: unit.code, [n['Unit Name']]: unit.name });
    const r = await form.submit(saveButton(UNITS()), { wait: 10_000 });
    note('pop-up', r.notice?.text ?? 'none');
    expect.soft(r.notice?.text ?? 'no message', 'Message says the unit code exists').toContain(DATA.message('Duplicate Code'));
    await form.closeNotice();
    await form.close();
    await inv.openTab(UNITS());
    await inv.search(S('Unit Search Placeholder'), unit.code);
    expect((await inv.rows()).filter(x => x.lines[0] === unit.code).length, 'One unit with that code').toBe(1);
  });

  test(...ivp('IVP-036'), async ({ inv }) => {
    await inv.openTab(UNITS());
    const all = await inv.pagerTotal();
    const options = (await inv.statusOptions()).filter(o => o !== S('All Statuses Option'));
    let sum = 0;
    for (const o of options) {
      await inv.filterStatus(o);
      const total = await inv.pagerTotal();
      const rows = await inv.rows();
      sum += total;
      note(`status ${o}`, `${total}`);
      expect.soft(rows.filter(r => r.cells['Status'] !== o).map(r => `${r.lines[0]}: ${r.cells['Status']}`), `Filter "${o}" lists only ${o}`).toEqual([]);
    }
    note('sum of statuses / All', `${sum} / ${all}`);
    expect(sum, 'Status totals add up to All Statuses').toBe(all);
  });

  test(...ivp('IVP-037'), async ({ inv, page }) => {
    const { unit } = await createdUnit(page);
    await inv.openTab(UNITS());
    await inv.search(S('Unit Search Placeholder'), unit.code);
    const rows = await inv.rows();
    note('search', rows.map(r => r.lines[0]).join(', '));
    expect.soft(rows.some(r => r.lines[0] === unit.code), 'Unit found').toBeTruthy();
    expect(rows.filter(r => !r.text.includes(unit.code)).map(r => r.lines[0]), 'Every row matches').toEqual([]);
  });

  test(...ivp('IVP-038'), async ({ inv, page }) => {
    const { unit, project } = await createdUnit(page);
    const n = names('Unit');
    const edited = row('Units')['Edited Remarks'];
    const open = async () => {
      const r = (await findUnit(page, DATA, unit.code))!;
      await inv.rowAction(r, S('Open Button'));
      return new ModalForm(page);
    };
    let view = await open();
    const text = await view.text();
    note('unit view', text.slice(0, 400));
    for (const v of [project.code, unit.code, unit.name]) expect.soft(text, `Shows ${v}`).toContain(v);
    await view.root.getByRole('button', { name: S('Unit Edit Button'), exact: true }).first().click();
    await view.set(n['Remarks'], edited);
    const res = await view.submit(S('Unit Update Button'));
    note('pop-up', res.notice?.text ?? 'none');
    await view.close();
    view = await open();
    await view.root.getByRole('button', { name: S('Unit Edit Button'), exact: true }).first().click();
    const saved = await view.value(n['Remarks']);
    note('remarks after reopening', saved);
    expect(saved, 'New remarks saved').toBe(edited);
    await view.close();
  });

  test(...ivp('IVP-039'), async ({ inv }) => {
    await inv.openTab(UNITS());
    const total = await inv.pagerTotal();
    const firstPage = (await inv.rows()).map(r => r.lines[0]);
    const file = await inv.export(S('Export Button'));
    const codes = new Set(file.rows.flatMap(r => Object.values(r)));
    note('export', `${file.name}: ${file.rows.length} rows; register ${total}`);
    expect.soft(file.rows.length, 'Rows in the export = units in the register').toBe(total);
    expect(firstPage.filter(c => !codes.has(c)), 'First-page units are in the export').toEqual([]);
  });
});


// ── Unit view (IVP-050 … IVP-053) ─────────────────────────────────────────────
const sections = () => DATA.sheet('Unit Sections').map(r => r['Section']);
const amount = (s: string) => (/\d/.test(s) ? parseNum(s.replace(/\s*[A-Z]{3}$/, '')) : NaN);
const pct = (s: string) => Number((s.match(/[+-]?\d+(\.\d+)?(?=%)/) ?? ['NaN'])[0]);
/** Whole-currency amounts: allow 1 unit of rounding (or 0.01% of the amount; 1% when the unit shows rounded amounts like "5.34M"). */
let roundedAmounts = false;
const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * (roundedAmounts ? 1e-2 : 1e-4));
async function openUnit(page: import('@playwright/test').Page, inv: import('../sales-chain/inventory').InventoryPage, code: string) {
  const r = await findUnit(page, DATA, code);
  expect(r, `${code} listed`).toBeTruthy();
  await inv.rowAction(r!, S('Open Button'));
  const view = new UnitView(page);
  await expect(view.root).toBeVisible();
  return { view, row: r! };
}

test.describe('Inventory · Unit view', () => {
  test.describe.configure({ timeout: 300_000 });

  test(...ivp('IVP-050'), async ({ inv, page }) => {
    const { unit, project } = await createdUnit(page);
    const { view, row: r } = await openUnit(page, inv, unit.code);
    const state = await view.sections(sections());
    note('sections', JSON.stringify(state));
    for (const s of sections()) {
      expect.soft(state[s], `Section "${s}" listed`).not.toBe('');
      if (!state[s]) continue;
      const lines = await view.open(s);
      expect.soft(lines.length, `Section "${s}" opens`).toBeGreaterThan(1);
    }
    const id = await view.open(sections()[0]);
    const shown = Object.fromEntries(DATA.sheet('Unit Identification Fields').map(f => [f['Caption'], UnitView.value(id, f['Caption'])]));
    note('Identification / register row', `${JSON.stringify(shown)} / ${r.text}`);
    expect.soft(shown['Project'], 'Project').toMatch(new RegExp(`^${project.code}\\b`));
    expect.soft(shown['Unit'], 'Unit').toBe(unit.code);
    expect.soft(shown['Unit Name'], 'Unit Name').toBe(unit.name);
    expect.soft(shown['Area'].startsWith(r.cells['Area']), `Area starts with ${r.cells['Area']}`).toBeTruthy();
    expect.soft(amount(shown['Price']), 'Price').toBe(amount(r.cells['Price']));
    expect(shown['Status'], 'Status').toBe(r.cells['Status']);
    await view.close();
  });

  test(...ivp('IVP-051'), async ({ inv, page }) => {
    await inv.openTab(UNITS());
    // a unit with a product whose price is shown in full (amounts of 1M and more are shown rounded, e.g. "5.34M USD")
    const linked = (r: { cells: Record<string, string> }) => (r.cells[S('Product Column')] ?? S('No Product')) !== S('No Product');
    const exact = (r: { cells: Record<string, string> }) => !/\d[KMB]\s*[A-Z]{3}$/.test(r.cells['Price'] ?? '');
    const all = await inv.allRows();
    const withProduct = all.find(r => linked(r) && exact(r)) ?? all.find(linked);
    test.skip(!withProduct, 'No unit linked to a product in the Unit Register');
    roundedAmounts = !exact(withProduct!);
    const { view } = await openUnit(page, inv, withProduct!.lines[0]);
    const l = await view.open('Sales');
    const v = (label: string) => UnitView.value(l, label);
    const current = amount(v(S('Current Price Label')));
    const floor = amount(v(S('Price Floor Label')));
    const adjusted = amount(v(S('Adjusted Price Label')));
    const base = amount(v(S('Base Price Label')));
    const formula = l[l.findIndex(x => x.toUpperCase() === S('Base Price Label').toUpperCase()) + 2] ?? '';
    const [carpet, rate] = [Number((formula.match(/([\d.,]+)\s*m²/) ?? ['', 'NaN'])[1].replace(/,/g, '')), amount((formula.match(/\$([\d.,]+)/) ?? ['', ''])[1])];
    const premium = pct(v(S('Premium Label')));
    const discount = pct(l.find(x => x.startsWith(S('Discount Limit Word'))) ?? '');
    const tiers = l.map(x => x.split('\t').map(s => s.trim())).filter(c => c.length >= 4 && /%$/.test(c[1]) && /\d/.test(c[2]))
      .map(c => ({ name: c[0], pct: pct(c[1]), price: amount(c[2]), floor: amount(c[3]), rounded: /\d[KMB]\s/.test(`${c[2]} ${c[3]}`) }));
    note('unit', `${withProduct!.lines[0]} · ${withProduct!.cells[S('Product Column')]}`);
    note('Sales figures', `current ${current} · floor ${floor} (limit ${discount}%) · adjusted ${adjusted} · base ${base} = ${formula} · premium ${premium}% · tiers ${tiers.map(t => `${t.name} ${t.pct}% ${t.price}/${t.floor}`).join(', ')}`);
    expect.soft(near(base, carpet * rate), `Standard base ${base} = ${carpet} m² × ${rate}`).toBeTruthy();
    expect.soft(near(adjusted, base * (1 + premium / 100)), `Adjusted ${adjusted} = base × (1 ${premium >= 0 ? '+' : '−'} ${Math.abs(premium)}%)`).toBeTruthy();
    expect.soft(near(floor, current * (1 - discount / 100)), `Price floor ${floor} = current ${current} × (1 − ${discount}%)`).toBeTruthy();
    expect.soft(tiers.length, 'Commercial tiers listed').toBeGreaterThan(0);
    for (const t of tiers) {
      roundedAmounts = !exact(withProduct!) || t.rounded; // e.g. "1.02M USD"
      expect.soft(near(t.price, adjusted * (1 + t.pct / 100)), `${t.name}: price ${t.price} = adjusted × (1 ${t.pct >= 0 ? '+' : '−'} ${Math.abs(t.pct)}%)`).toBeTruthy();
      expect.soft(near(t.floor, t.price * (1 - discount / 100)), `${t.name}: floor ${t.floor} = price × (1 − ${discount}%)`).toBeTruthy();
    }
    const active = l.findIndex(x => x === S('Active Tier Word'));
    const activeTier = tiers.find(t => l.slice(Math.max(0, active - 1), active).some(x => x.startsWith(t.name)));
    if (activeTier) expect.soft(near(current, activeTier.price), `Current price = active tier ${activeTier.name} price`).toBeTruthy();
    await view.close();
  });

  test(...ivp('IVP-052'), async ({ inv, page }) => {
    const proj = await testProject(page, DATA);
    await inv.openTab(UNITS());
    await inv.search(S('Unit Search Placeholder'), proj.code);
    const rows = await inv.allRows();
    const reserved = rows.find(r => r.cells['Status'] === S('Reserved Status'));
    const free = rows.find(r => r.cells['Status'] === S('New Unit Status'));
    for (const [r, hasReservation] of [[reserved, true], [free, false]] as const) {
      if (!r) { note('skipped', `no ${hasReservation ? S('Reserved Status') : S('New Unit Status')} unit in ${proj.code}`); continue; }
      const { view } = await openUnit(page, inv, r.lines[0]);
      const lines = await view.open('Linked Modules');
      const shown = UnitView.value(lines, S('Linked Reservation Label'));
      note(`${r.lines[0]} (${r.cells['Status']})`, `${S('Linked Reservation Label')}: ${shown}`);
      if (hasReservation) expect.soft(shown, `${r.lines[0]} (Reserved) shows its reservation`).not.toBe(S('No Reservation Text'));
      else expect.soft(shown, `${r.lines[0]} (Available) has no reservation`).toBe(S('No Reservation Text'));
      await view.close();
    }
    expect(reserved || free, 'Units of the test project to check').toBeTruthy();
  });

  test(...ivp('IVP-053'), async ({ inv, page }) => {
    const { unit } = await createdUnit(page);
    const m = DATA.sheet('Media Uploads').find(r => r['Case ID'] === 'IVP-053')!;
    const link = fill(m['Virtual Tour Link']);
    const file = m['File'].split('/').pop()!;
    note('test data', `${unit.code} · tour ${link} · ${m['File Type']} "${m['Caption']}" ${m['File']}`);
    let { view } = await openUnit(page, inv, unit.code);
    await view.open('Floor Plans & Media');
    const media = new MediaPanel(page);
    expect.soft(await media.text(), 'Before: no link').toContain(S('No Tour Text'));
    const seen = [...(await media.saveTourLink(link, S('Save Link Button'))), ...(await media.upload({ type: m['File Type'], caption: m['Caption'], file: m['File'] }, S('Upload Button')))];
    note('pop-ups', seen.map(x => `${x.title}: ${x.text}`).join(' | ') || 'none');
    await view.close();
    ({ view } = await openUnit(page, inv, unit.code));
    await view.open('Floor Plans & Media');
    const tour = await new MediaPanel(page).tourLink();
    const after = await new MediaPanel(page).text();
    note('media after re-opening', after.slice(0, 600));
    note('virtual tour link after re-opening', tour || 'none');
    expect.soft(tour, 'Virtual tour link kept').toBe(link);
    expect(after.includes(file) || after.includes(m['Caption']), `${file} ("${m['Caption']}") listed under "${S('Unit Files Heading')}"`).toBeTruthy();
    await view.close();
  });
});
