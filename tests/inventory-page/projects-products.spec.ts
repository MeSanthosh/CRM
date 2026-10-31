/** Manage projects (IVP-011 … IVP-018) and unit products (IVP-021 … IVP-026). */
import { test, expect, ivp, ivpRow, note, DATA, tabs, cards, expectChanges, names, row, projectValues, productValues, newForm, saveButton, createdProject, createdProduct } from './shared';
import { withSalesLock } from '../sales-chain/inventory';
import { ModalForm } from '../pages/SalesPages';

const S = (k: string) => DATA.setting(k);
const tab = (shows: string) => tabs().find(t => t['Shows'] === shows)!['Tab'];
const PROJECTS = () => tab('Project Register');
const PRODUCTS = () => tab('Unit Product Catalogue');
const fieldsOf = (form: string) => DATA.sheet('Form Fields').filter(r => r['Form'] === form);
const invalid = (caseId: string) => DATA.sheet('Invalid Values').filter(r => r['Case ID'] === caseId);

test.describe('Inventory · Projects', () => {
  test.describe.configure({ timeout: 300_000 });

  test(...ivp('IVP-011'), async ({ inv, page }) => {
    const form = await newForm(page, inv, PROJECTS());
    const text = await form.text();
    note('form', text.slice(0, 300));
    for (const f of fieldsOf('Project')) expect.soft(text, `Field "${f['Field Label']}"`).toContain(f['Field Label']);
    const statuses = await form.options(names('Project')['Status']);
    note('Status options', statuses.join(', '));
    expect(statuses, 'Status options').toEqual(expect.arrayContaining([S('Active Status'), S('Inactive Status')]));
    await form.close();
  });

  test(...ivp('IVP-012'), async ({ inv, page }) => {
    const form = await newForm(page, inv, PROJECTS());
    const r = await form.submit(saveButton(PROJECTS()));
    note('pop-up', r.notice?.text ?? 'none');
    expect.soft(r.notice?.title, 'Pop-up title').toBe(DATA.message('Project Required Title'));
    expect.soft(r.notice?.text ?? '', 'Pop-up text').toContain(DATA.message('Project Required Body'));
    expect(r.closed, 'Form stays open (nothing created)').toBeFalsy();
    await form.closeNotice();
    await form.close();
  });

  invalid('IVP-013').forEach((v, i) => {
    test(...ivpRow('IVP-013', i + 1, `${v['Field Left Empty']} empty`, `"${v['Expected Message Contains']}"; not saved`, `${v['Form']} without ${v['Field Left Empty']}`), async ({ inv, page }) => {
      const values = projectValues();
      delete values[names('Project')[v['Field Left Empty']]];
      note('test data', JSON.stringify(values));
      const form = await newForm(page, inv, PROJECTS());
      await form.fill(values);
      const r = await form.submit(saveButton(PROJECTS()));
      note('pop-up', r.notice?.text ?? 'none');
      expect.soft(r.notice?.text ?? '', 'Message').toContain(v['Expected Message Contains']);
      expect(r.closed, 'Form stays open (nothing created)').toBeFalsy();
      await form.closeNotice();
      await form.close();
    });
  });

  test(...ivp('IVP-014'), async ({ inv, page }) => {
    await withSalesLock(async () => {
      const before = await cards(inv);
      const { values, result } = await createdProject(page, inv);
      note('pop-up', result.notice?.text ?? 'none');
      expect.soft(result.closed, 'Form closed after saving').toBeTruthy();
      const after = await cards(inv);
      expectChanges('Create Project', before, after);
      const n = names('Project');
      await inv.tab(PROJECTS());
      await inv.search(S('Project Search Placeholder'), values[n['Project Code']]);
      const r = (await inv.rows()).find(x => x.lines[0] === values[n['Project Code']]);
      note('register row', r?.text ?? 'not listed');
      expect(r, 'Project listed').toBeTruthy();
      expect.soft(r!.text, 'Name').toContain(values[n['Project Name']]);
      expect.soft(r!.cells['Location'], 'Location').toBe(values[n['Location']]);
      expect.soft(r!.cells['Currency'], 'Currency').toBe(values[n['Currency']].split(' - ')[0]);
      expect.soft(r!.cells['Status'], 'Status').toBe(S('Active Status'));
    });
  });

  test(...ivp('IVP-015'), async ({ inv, page }) => {
    const { values } = await createdProject(page, inv);
    const n = names('Project');
    const again = { ...projectValues(row('Projects', 1)), [n['Project Code']]: values[n['Project Code']] };
    note('test data', JSON.stringify(again));
    const form = await newForm(page, inv, PROJECTS());
    await form.fill(again);
    const r = await form.submit(saveButton(PROJECTS()));
    note('pop-up', r.notice?.text ?? 'none');
    expect.soft(r.notice?.title, 'Pop-up title').toBe(DATA.message('Project Duplicate Title'));
    expect.soft(r.notice?.text ?? '', 'Message says the code exists').toContain(DATA.message('Duplicate Code'));
    await form.closeNotice();
    await form.close();
    await inv.openTab(PROJECTS());
    await inv.search(S('Project Search Placeholder'), values[n['Project Code']]);
    expect((await inv.rows()).filter(x => x.lines[0] === values[n['Project Code']]).length, 'One project with that code').toBe(1);
  });

  test(...ivp('IVP-016'), async ({ inv, page }) => {
    const { values } = await createdProject(page, inv);
    const n = names('Project');
    await inv.openTab(PROJECTS());
    for (const text of [values[n['Project Code']], values[n['Location']]]) {
      await inv.search(S('Project Search Placeholder'), text);
      const rows = await inv.rows();
      note(`search "${text}"`, rows.map(r => r.lines[0]).join(', '));
      expect.soft(rows.some(r => r.lines[0] === values[n['Project Code']]), `"${text}" finds the project`).toBeTruthy();
      expect.soft(rows.filter(r => !r.text.toUpperCase().includes(text.toUpperCase())).map(r => r.text), `Every row matches "${text}"`).toEqual([]);
    }
  });

  test(...ivp('IVP-017'), async ({ inv, page }) => {
    const { values } = await createdProject(page, inv);
    const n = names('Project');
    const data = row('Projects');
    const code = values[n['Project Code']];
    await inv.openTab(PROJECTS());
    await inv.search(S('Project Search Placeholder'), code);
    let r = (await inv.rows()).find(x => x.lines[0] === code)!;
    await inv.rowAction(r, S('Edit Button'));
    const form = new ModalForm(page);
    await form.fill({ [n['Location']]: data['Edited Location'], [n['Description']]: data['Edited Description'] });
    const res = await form.submit(S('Project Update Button'));
    note('pop-up', res.notice?.text ?? 'none');
    await form.close();
    await inv.openTab(PROJECTS());
    await inv.search(S('Project Search Placeholder'), code);
    r = (await inv.rows()).find(x => x.lines[0] === code)!;
    expect.soft(r.cells['Location'], 'Location in the register').toBe(data['Edited Location']);
    await inv.rowAction(r, S('Edit Button'));
    const desc = await new ModalForm(page).value(n['Description']);
    note('edited', `${r.cells['Location']} · ${desc}`);
    expect(desc, 'Description saved').toBe(data['Edited Description']);
    await new ModalForm(page).close();
  });

  test(...ivp('IVP-018'), async ({ inv, page }) => {
    const { values } = await createdProject(page, inv);
    const code = values[names('Project')['Project Code']];
    await withSalesLock(async () => {
      const before = await cards(inv);
      await inv.tab(PROJECTS());
      await inv.search(S('Project Search Placeholder'), code);
      const r = (await inv.rows()).find(x => x.lines[0] === code)!;
      const asked = await inv.rowAction(r, S('Deactivate Button'));
      note('confirmation', asked ?? 'none');
      expect.soft(asked, 'The app asks for confirmation').toBeTruthy();
      const after = await cards(inv);
      expectChanges('Deactivate Project', before, after);
      await inv.tab(PROJECTS());
      await inv.search(S('Project Search Placeholder'), code);
      const now = (await inv.rows()).find(x => x.lines[0] === code);
      note('status', now?.cells['Status'] ?? 'not listed');
      expect(now?.cells['Status'], 'Status after Deactivate').toBe(S('Inactive Status'));
    });
  });
});

test.describe('Inventory · Products', () => {
  test.describe.configure({ timeout: 300_000 });

  test(...ivp('IVP-021'), async ({ inv, page }) => {
    const form = await newForm(page, inv, PRODUCTS());
    const text = await form.text();
    for (const f of fieldsOf('Product')) {
      const label = f['Field Label'];
      expect.soft(text, `Field "${label}"`).toContain(label);
      if (/^y/i.test(f['Mandatory'])) expect.soft(text, `"${label}" marked required`).toContain(`${label} *`);
    }
    const values = await form.root.locator('input').evaluateAll(es => es.map(e => (e as HTMLInputElement).value));
    note('read-only values', values.filter(Boolean).join(' | '));
    expect(values.join(' | '), 'Matrix Base Rate is governed by the business rules').toContain(S('Base Rate Note'));
    await form.close();
  });

  invalid('IVP-022').forEach((v, i) => {
    test(...ivpRow('IVP-022', i + 1, `${v['Field Left Empty']} empty`, `A message names "${v['Expected Message Contains']}"; not saved`, `${v['Form']} without ${v['Field Left Empty']}`), async ({ inv, page }) => {
      const values = productValues();
      delete values[names('Product')[v['Field Left Empty']]];
      note('test data', JSON.stringify(values));
      const form = await newForm(page, inv, PRODUCTS());
      await form.fill(values);
      const r = await form.submit(saveButton(PRODUCTS()), { wait: 8_000 });
      note('pop-up', r.notice?.text ?? 'none');
      expect(r.closed, 'Form stays open (nothing created)').toBeFalsy();
      expect(r.notice?.text ?? 'no message at all', 'Message names the missing field').toContain(v['Expected Message Contains']);
      await form.closeNotice();
      await form.close();
    });
  });

  test(...ivp('IVP-023'), async ({ inv, page }) => {
    await withSalesLock(async () => {
      const n = names('Product');
      const type = productValues()[n['Unit Type']];
      const chip = async () => Number(((await page.locator('main button').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim()).find(t => t.startsWith(`${type} `)) ?? `${type} 0`).split(' ').pop());
      const before = await cards(inv);
      await inv.tab(PRODUCTS());
      const chipBefore = await chip();
      const { values, result } = await createdProduct(page, inv);
      note('pop-up', result.notice?.text ?? 'none');
      const after = await cards(inv);
      expectChanges('Create Product', before, after);
      await inv.tab(PRODUCTS());
      const chipAfter = await chip();
      note(`chip ${type}`, `${chipBefore} → ${chipAfter}`);
      expect.soft(chipAfter - chipBefore, `Chip "${type}" +1`).toBe(1);
      await inv.search(S('Product Search Placeholder'), values[n['Product Code']]);
      const r = (await inv.rows()).find(x => x.lines[0] === values[n['Product Code']]);
      note('catalogue row', r?.text ?? 'not listed');
      expect(r, 'Product listed').toBeTruthy();
      expect.soft(r!.text, 'Name').toContain(values[n['Product Name']]);
      expect.soft(r!.cells['Type'], 'Type').toBe(type);
    });
  });

  test(...ivp('IVP-024'), async ({ inv, page }) => {
    const { values } = await createdProduct(page, inv);
    const n = names('Product');
    const form = await newForm(page, inv, PRODUCTS());
    await form.fill({ ...productValues(row('Products', 1)), [n['Product Code']]: values[n['Product Code']] });
    const r = await form.submit(saveButton(PRODUCTS()));
    note('pop-up', r.notice?.text ?? 'none');
    expect.soft(r.notice?.text ?? 'no message', 'Message says the product code exists').toContain(DATA.message('Duplicate Code'));
    await form.closeNotice();
    await form.close();
    await inv.openTab(PRODUCTS());
    await inv.search(S('Product Search Placeholder'), values[n['Product Code']]);
    expect((await inv.rows()).filter(x => x.lines[0] === values[n['Product Code']]).length, 'One product with that code').toBe(1);
  });

  test(...ivp('IVP-025'), async ({ inv, page }) => {
    const { values } = await createdProduct(page, inv);
    const n = names('Product');
    await inv.openTab(PRODUCTS());
    for (const text of [values[n['Product Code']], values[n['Product Name']]]) {
      await inv.search(S('Product Search Placeholder'), text);
      const rows = await inv.rows();
      note(`search "${text}"`, rows.map(r => r.lines[0]).join(', '));
      expect.soft(rows.some(r => r.lines[0] === values[n['Product Code']]), `"${text}" finds the product`).toBeTruthy();
      expect.soft(rows.filter(r => !r.text.toLowerCase().includes(text.toLowerCase())).map(r => r.lines[0]), `Every row matches "${text}"`).toEqual([]);
    }
  });

  test(...ivp('IVP-026'), async ({ inv, page }) => {
    const { values } = await createdProduct(page, inv);
    const n = names('Product');
    const edited = row('Products')['Edited Target Buyer'];
    await inv.openTab(PRODUCTS());
    await inv.search(S('Product Search Placeholder'), values[n['Product Code']]);
    let r = (await inv.rows()).find(x => x.lines[0] === values[n['Product Code']])!;
    await inv.rowAction(r, S('Edit Button'));
    const form = new ModalForm(page);
    await form.set(n['Target Buyer'], edited);
    const res = await form.submit(saveButton(PRODUCTS()));
    note('pop-up', res.notice?.text ?? 'none');
    await form.close();
    await inv.openTab(PRODUCTS());
    await inv.search(S('Product Search Placeholder'), values[n['Product Code']]);
    r = (await inv.rows()).find(x => x.lines[0] === values[n['Product Code']])!;
    await inv.rowAction(r, S('View Button'));
    const details = await new ModalForm(page).text();
    note('Product Details', details.slice(0, 600));
    expect.soft(details, 'Target Buyer').toContain(edited);
    expect.soft(details, 'Type').toContain(values[n['Unit Type']]);
    expect(details, 'Carpet area').toContain(values[n['Carpet Area']]);
    await new ModalForm(page).close();
  });
});
