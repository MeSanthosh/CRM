/** Manage units (IVP-031 … IVP-039). Units are created in the test project only. */
import { test, expect, ivp, ivpRow, note, DATA, tabs, cards, expectChanges, names, row, newForm, saveButton, testProject, seq } from './shared';
import { withSalesLock, createUnit, findUnit, CreatedUnit } from '../sales-chain/inventory';
import { ModalForm } from '../pages/SalesPages';
import { parseNum } from '../helpers';
import { formValues } from '../sales-chain/data';
import type { Page } from '@playwright/test';

const S = (k: string) => DATA.setting(k);
const UNITS = () => tabs().find(t => t['Shows'] === 'Unit Register')!['Tab'];
const invalid = (caseId: string) => DATA.sheet('Invalid Values').filter(r => r['Case ID'] === caseId);

/** One unit for this worker (Units row 1), shared by the unit tests after IVP-033. */
let made: Promise<{ unit: CreatedUnit; result: Awaited<ReturnType<ModalForm['submit']>>; project: { code: string } }> | undefined;
function createdUnit(page: Page) {
  made ??= createUnit(page, DATA, row('Units')).then(r => { note('unit created', JSON.stringify(r.unit.values)); return r; })
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

