/**
 * Reference Data (ADM-011 … ADM-021): cards, filters, search and forms (read only), then a lifecycle on our own records
 * only. The test records cannot be deleted, so they are created once, reused by later runs and always left inactive.
 * The lifecycle runs in order on one worker. Run: npx playwright test tests/admin-governance/reference.spec.ts --workers=1
 */
import { test, expect, note, adm, admRow, S, sheet, fieldsOf, cardText, setCheck } from './shared';
import { ModalForm, ModulePage } from '../pages/SalesPages';
import type { RegisterRow } from '../pages/SalesPages';
import { watchWrites } from '../pages/PricingMatrixPage';
import { XP, at } from '../locators';
import type { Page } from '@playwright/test';

const search = () => S('Reference Search');
const records = () => sheet('Reference Records');
const rec = (step: string) => records().find(r => r['Step'] === step)!;
const filter = (page: Page, label: string) => at(page, XP.avsFilter(label)).first();
const options = async (page: Page, label: string) => (await filter(page, label).locator('option').allTextContents()).map(o => o.trim());
const settle = async (page: Page) => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(900); };

/** Rows whose Value Code is exactly `code`. */
async function find(ref: ModulePage, code: string): Promise<RegisterRow[]> {
  await ref.open();
  await ref.search(search(), code);
  return (await ref.rows()).filter(r => r.cells['Value Code'] === code);
}
/** Fills a reference form from a Reference Records row. The dropdown of a group fills in after the category is chosen. */
async function fillRecord(page: Page, form: ModalForm, r: Record<string, string>) {
  await form.set('referenceCategory', r['Category']);
  if ((await form.field('level1Code').evaluate(e => e.tagName)) === 'SELECT') {
    await expect.poll(async () => (await form.options('level1Code')).some(o => o.includes(r['Group Code'])), { message: `Group ${r['Group Code']} is offered`, timeout: 15_000 }).toBeTruthy();
    await form.set('level1Code', `~${r['Group Code']}`);
    await page.waitForTimeout(500);
  } else {
    await form.set('level1Code', r['Group Code']);
    await form.set('level1Name', r['Group Name']);
  }
  await form.set('level2Code', r['Value Code']);
  await form.set('level2Name', r['Value Name']);
  await form.set('description', r['Description']);
}
/** Our record, active: created when missing, otherwise made active again. Returns whether it was created. */
async function ensureActive(page: Page, ref: ModulePage, r: Record<string, string>): Promise<boolean> {
  const [row] = await find(ref, r['Value Code']);
  const form = new ModalForm(page);
  if (!row) {
    await ref.open();
    await form.open(r['Button']);
    await fillRecord(page, form, r);
    const res = await form.submit(S('Create Value Button'));
    note(`created ${r['Value Code']}`, res.notice?.text ?? 'no message');
    expect(res.closed, `${r['Value Code']} created (${res.notice?.text ?? 'no message'})`).toBeTruthy();
    await form.closeNotice();
    return true;
  }
  if (row.cells['Status'] !== S('Active Status')) {
    await ref.rowAction(row, S('Edit Button'));
    await form.set('status', 'Active');
    await form.set('isActive', 'yes');
    const res = await form.submit(S('Update Value Button'));
    expect(res.closed, `${r['Value Code']} active again (${res.notice?.text ?? 'no message'})`).toBeTruthy();
    await form.closeNotice();
  }
  return false;
}

test.describe('Admin & Governance · Reference Data', () => {
  test.describe.configure({ timeout: 300_000 });

  test(...adm('ADM-011'), async ({ ref, page }) => {
    await ref.open();
    const c = { values: await cardText(page, 'Values'), cats: await cardText(page, 'Categories'), fams: await cardText(page, 'Families'), inactive: await cardText(page, 'Inactive') };
    note('cards', JSON.stringify(c));
    const total = await ref.pagerTotal();
    expect.soft(Number(c.values.replace(/,/g, '')), 'Values = register total').toBe(total);
    expect.soft(Number(c.cats), 'Categories = Category options').toBe((await options(page, 'Category')).length - 1);
    expect.soft(Number(c.fams), 'Families = Group options').toBe((await options(page, 'Group')).length - 1);
    await setCheck(page, S('Active Only'), true);
    expect(Number(c.inactive), 'Inactive = total − Active only total').toBe(total - await ref.pagerTotal());
  });

  test(...adm('ADM-012'), async ({ ref, page }) => {
    await ref.open();
    const cats = (await options(page, 'Category')).slice(1).filter(c => !c.startsWith('ZZ_'));
    const cat = cats[Math.floor(cats.length / 2)];
    await filter(page, 'Category').selectOption({ label: cat });
    await settle(page);
    const rows = await ref.rows();
    note('category', `${cat}: ${await ref.pagerText()}`);
    expect.soft(rows.filter(r => r.cells['Category'] !== cat).map(r => r.cells['Value Code']), `Only ${cat}`).toEqual([]);
    const groups = (await options(page, 'Group')).slice(1);
    expect.soft(groups.filter(g => !g.startsWith(`${cat} / `)), 'The Group list follows the category').toEqual([]);
    await filter(page, 'Group').selectOption({ label: groups[0] });
    await settle(page);
    const code = groups[0].split(' / ')[1];
    expect.soft((await ref.rows()).filter(r => r.cells['Group'].split(' | ')[0] !== code).map(r => r.cells['Value Code']), `Only group ${code}`).toEqual([]);
    await setCheck(page, S('Active Only'), true);
    expect((await ref.rows()).filter(r => r.cells['Status'] !== S('Active Status')).map(r => r.cells['Value Code']), 'Active only lists only ACTIVE').toEqual([]);
  });

  test(...adm('ADM-013'), async ({ ref }) => {
    await ref.open();
    const rows = await ref.rows();
    const code = rows[Math.floor(rows.length / 2)].cells['Value Code'];
    await ref.search(search(), code);
    const shown = await ref.rows();
    note('search', `${code}: ${shown.length} rows`);
    expect.soft(shown.some(r => r.cells['Value Code'] === code), `${code} is found`).toBeTruthy();
    expect.soft(shown.filter(r => !r.text.toLowerCase().includes(code.toLowerCase())).map(r => r.cells['Value Code']), 'Every row contains the text').toEqual([]);
    await ref.search(search(), `zzz${Date.now()}`);
    expect((await ref.rows()).length, 'A text no value has lists nothing').toBe(0);
  });

  test(...adm('ADM-014'), async ({ ref, page }) => {
    const writes = watchWrites(page);
    await ref.open();
    for (const f of sheet('Reference Forms')) {
      const form = new ModalForm(page);
      await form.open(f['Button']);
      for (const x of fieldsOf('Reference')) await expect.soft(form.field(x['Field Name']), `${f['Button']}: ${x['Field Label']}`).toBeAttached();
      const tag = async (n: string) => (await form.field(n).evaluate(e => e.tagName)).toLowerCase();
      expect.soft(await tag('referenceCategory'), `${f['Button']}: Category control`).toBe(f['Category Control']);
      expect.soft(await tag('level1Code'), `${f['Button']}: Group control`).toBe(f['Group Control']);
      if (f['Group Control'] === 'select') {
        const cats = (await form.options('referenceCategory')).slice(1).filter(c => !c.startsWith('ZZ_'));
        await form.set('referenceCategory', cats[0]);
        await expect.poll(async () => (await form.field('level1Code').locator('option').count()), { message: 'Groups follow the category', timeout: 10_000 }).toBeGreaterThan(1);
      }
      await form.close();
    }
    expect(writes.map(w => w.url), 'Cancel saves nothing').toEqual([]);
  });

  sheet('Reference Forms').forEach((f, n) => {
    test(...admRow('ADM-015', n + 1, f['Button'], 'A message says what is required; nothing is created.', `Reference Forms row ${n + 1}`), async ({ ref, page }) => {
      const writes = watchWrites(page);
      await ref.open();
      const before = await ref.pagerTotal();
      const form = new ModalForm(page);
      await form.open(f['Button']);
      const r = await form.submit(S('Create Value Button'), { wait: 10_000 });
      note('empty save', `${r.notice?.text ?? 'no message'} · ${writes.map(w => `${w.method} ${w.status}`).join(', ') || 'nothing sent'}`);
      expect.soft(r.notice?.text ?? '', 'A message says what is required').not.toBe('');
      expect.soft(writes.filter(w => w.status < 300).map(w => w.url), 'Nothing is created').toEqual([]);
      await form.closeNotice();
      await form.close();
      await ref.open();
      expect(await ref.pagerTotal(), 'Register total unchanged').toBe(before);
    });
  });
});

test.describe('Admin & Governance · Reference Data lifecycle (own test records)', () => {
  test.describe.configure({ mode: 'default', timeout: 300_000 });

  test(...adm('ADM-016'), async ({ ref, page }) => {
    await ref.open();
    const before = { v: Number((await cardText(page, 'Values')).replace(/,/g, '')), c: Number(await cardText(page, 'Categories')) };
    const r = rec('Category');
    const created = await ensureActive(page, ref, r);
    const [row] = await find(ref, r['Value Code']);
    note('category record', `${created ? 'created' : 'reused'} · ${row?.text}`);
    expect.soft(row?.cells['Category'], 'Listed under the test category').toBe(r['Category']);
    expect.soft(row?.cells['Status'], 'Active').toBe(S('Active Status'));
    if (created) {
      await ref.open();
      expect.soft(Number((await cardText(page, 'Values')).replace(/,/g, '')) - before.v, 'Values +1').toBe(1);
      expect.soft(Number(await cardText(page, 'Categories')) - before.c, 'Categories +1').toBe(1);
    }
  });

  test(...adm('ADM-017'), async ({ ref, page }) => {
    const r = rec('Group');
    const created = await ensureActive(page, ref, r);
    const [row] = await find(ref, r['Value Code']);
    note('group record', `${created ? 'created' : 'reused'} · ${row?.text}`);
    expect.soft(row?.cells['Group'].split(' | ')[0], 'Listed under the new group').toBe(r['Group Code']);
    await ref.open();
    expect((await options(page, 'Group')).some(g => g === `${r['Category']} / ${r['Group Code']}`), 'The Group filter offers it').toBeTruthy();
  });

  test(...adm('ADM-018'), async ({ ref, page }) => {
    const r = rec('Value');
    const created = await ensureActive(page, ref, r);
    const [row] = await find(ref, r['Value Code']);
    note('value record', `${created ? 'created' : 'reused'} · ${row?.text}`);
    expect.soft(row?.cells['Group'].split(' | ')[0], 'Listed under the group').toBe(r['Group Code']);
    expect(row?.cells['Group'] ?? '', 'Group Name comes from the group').toContain(r['Group Name']);
  });

  test(...adm('ADM-019'), async ({ ref, page }) => {
    const r = rec('Value');
    await ref.open();
    const form = new ModalForm(page);
    await form.open(r['Button']);
    await fillRecord(page, form, r);
    const res = await form.submit(S('Create Value Button'));
    note('duplicate', res.notice?.text ?? 'no message');
    expect.soft(res.notice?.text ?? '', 'A message says the code already exists').toMatch(/already exists|duplicate/i);
    await form.closeNotice();
    await form.close();
    expect((await find(ref, r['Value Code'])).length, 'Still one such value').toBe(1);
  });

  test(...adm('ADM-020'), async ({ ref, page }) => {
    const r = rec('Category');
    const [row] = await find(ref, r['Value Code']);
    await ref.rowAction(row, S('Edit Button'));
    const form = new ModalForm(page);
    await expect(form.root, 'Edit form opens').toBeVisible();
    for (const n of ['referenceCategory', 'level1Code', 'level1Name', 'level2Code']) await expect.soft(form.field(n), `${n} is read-only`).not.toBeEditable();
    await form.set('level2Name', r['Edited Value Name']);
    const res = await form.submit(S('Update Value Button'));
    expect(res.closed, `Saved (${res.notice?.text ?? 'no message'})`).toBeTruthy();
    await form.closeNotice();
    try {
      const [after] = await find(ref, r['Value Code']);
      note('edited', after?.text ?? '');
      expect(after?.cells['Value Name'], 'New name listed').toBe(r['Edited Value Name']);
    } finally {
      const [again] = await find(ref, r['Value Code']);
      await ref.rowAction(again, S('Edit Button'));
      const f2 = new ModalForm(page);
      await f2.set('level2Name', r['Value Name']);
      await f2.submit(S('Update Value Button'));
      await f2.closeNotice();
    }
  });

  test(...adm('ADM-021'), async ({ ref, page }) => {
    await ref.open();
    const before = Number(await cardText(page, 'Inactive'));
    let done = 0;
    for (const r of records()) {
      const [row] = await find(ref, r['Value Code']);
      test.skip(!row, `${r['Value Code']} is missing`);
      if (row.cells['Status'] !== S('Active Status')) continue;
      const asked = await ref.rowAction(row, S('Deactivate Button'));
      const n = at(page, XP.notice).last();
      if (!asked && await n.isVisible({ timeout: 3000 }).catch(() => false)) {
        note(`deactivate ${r['Value Code']}`, (await n.innerText()).replace(/\s+/g, ' '));
        const b = n.getByRole('button').filter({ hasText: /deactivate|confirm|yes/i }).first();
        if (await b.count()) await b.click();
      } else note(`deactivate ${r['Value Code']}`, asked ?? 'no question');
      await settle(page);
      done++;
    }
    for (const r of records()) expect.soft((await find(ref, r['Value Code']))[0]?.cells['Status'], `${r['Value Code']} inactive`).toBe(S('Inactive Status'));
    await ref.open();
    expect(Number(await cardText(page, 'Inactive')) - before, `Inactive card +${done}`).toBe(done);
  });
});
