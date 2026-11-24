/**
 * Recalculate & Publish (IVP-095 … IVP-099), asked for on 5 Nov 2026: presses ⚡ Recalculate Pricing Matrix (one unit),
 * ⚡ Recalculate All (matrix), ⚡ Recalculate All Units Live, Save Draft and Publish (Pricing Rules) on the existing
 * units and products. The matrix and the base rates are read first; every rule value a test changes is put back,
 * published and recalculated in `finally`, and the matrix is then compared with its first state.
 * Runs in order on one worker, under the inventory lock. No project, product or unit is created.
 * Run: npx playwright test tests/inventory-page/pricing-recalc.spec.ts --workers=1
 */
import { test, expect, note, ivp, PS, SS, sheet, money, figures, formulaErrors, tierColumns } from './pricing-shared';
import { watchWrites, PricingMatrixPage, PricingRulesPage, UnitSales } from '../pages/PricingMatrixPage';
import { Notice } from '../pages/Notice';
import { withSalesLock } from '../sales-chain/inventory';
import { XP, at } from '../locators';
import type { PMRow, PMHeader } from './pricing-shared';

const FULL = () => sheet('Pricing Views').find(v => v['Group'] === 'Layers' && v['Default'] !== 'Yes')!['Button'];
const BASE_TAB = () => sheet('Rules Tabs')[0]['Tab'];
const WAIT = () => Number(PS('Save Wait Seconds')) * 1000;
const bad = (xs: string[], max = 8) => (xs.length ? `${xs.length}: ${xs.slice(0, max).join(' | ')}${xs.length > max ? ' …' : ''}` : '');
const ok = (w: { status: number }[]) => w.length > 0 && w.every(x => x.status >= 200 && x.status < 300);
const changed = (a: PMRow[], b: PMRow[]) => {
  const before = new Map(a.map(r => [r.code, JSON.stringify(r.cells)]));
  return b.filter(r => before.get(r.code) !== JSON.stringify(r.cells)).map(r => r.code);
};

async function matrix(pm: PricingMatrixPage) {
  await pm.open();
  await pm.view(FULL());
  return { header: await pm.header(), rows: await pm.rows() };
}
async function openRules(pm: PricingMatrixPage) {
  await pm.open();
  await pm.press(pm.button(PS('Rules Button')), PS('Rules Button'));
  await expect(at(pm.page, XP.rulesEngine(PS('Rules Engine'))), 'Rules page open').toHaveClass(/is-active/);
  await pm.page.waitForLoadState('networkidle').catch(() => {});
}
/** Product code → base rate of the published rules. */
async function baseRates(rules: PricingRulesPage) {
  await rules.tab(BASE_TAB());
  return new Map((await rules.table()).rows.map(r => [r[0], Number(r[r.length - 1])]));
}
/** Presses a button and waits for its writes; returns them and the message shown. */
async function pressAndWait(page: import('@playwright/test').Page, loc: import('@playwright/test').Locator, writes: ReturnType<typeof watchWrites>) {
  const from = writes.length;
  await loc.click();
  const notice = new Notice(page);
  const until = Date.now() + WAIT();
  let msg = '';
  while (Date.now() < until) {
    await page.waitForTimeout(500);
    msg = await page.evaluate(() => [...document.querySelectorAll('.crm-app-toast, .crm-notice-dialog, [role=alert]')].map(e => (e as HTMLElement).innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | '));
    if (writes.length > from && msg) break;
  }
  await page.waitForLoadState('networkidle').catch(() => {});
  if (await notice.visible().catch(() => false)) await notice.close().catch(() => {});
  return { writes: writes.slice(from), message: msg };
}
/** Matrix "⚡ Recalculate All" with its confirmation. */
async function recalcAll(pm: PricingMatrixPage, writes: ReturnType<typeof watchWrites>) {
  await pm.open();
  await pm.press(pm.button(PS('Recalc All Button')), PS('Recalc All Button'));
  const n = new Notice(pm.page);
  const info = await n.wait(10_000);
  const confirm = n.root.getByRole('button', { name: PS('Recalc Confirm Button'), exact: true });
  const r = info ? await pressAndWait(pm.page, confirm, writes) : { writes: [], message: '' };
  return { confirmation: info, ...r };
}
/** Puts a base rate back, publishes and recalculates, then compares the matrix with its first state. */
async function putBack(pm: PricingMatrixPage, rules: PricingRulesPage, writes: ReturnType<typeof watchWrites>, product: string, rate: number, first: PMRow[]) {
  await openRules(pm);
  const now = await baseRates(rules);
  if (now.get(product) !== rate || /Unpublished/i.test((await rules.version(PS('Rules Version Word'))).text)) {
    await rules.setRow(product, String(rate));
    const p = await pressAndWait(pm.page, rules.button(PS('Publish Button')), writes);
    note('put back', `${product} base rate ${rate} published: ${p.writes.map(w => `${w.method} ${w.status}`).join(', ')} ${p.message}`);
  }
  const r = await recalcAll(pm, writes);
  note('recalculated after putting back', `${r.writes.map(w => `${w.method} ${w.url} ${w.status}`).join(', ') || 'no request'} ${r.message}`);
  const m = await matrix(pm);
  expect(changed(first, m.rows), 'Every unit back to its first price').toEqual([]);
}

test.describe('Inventory · Pricing Matrix recalculate & publish (existing units)', () => {
  test.describe.configure({ mode: 'default', timeout: 900_000 });

  test(...ivp('IVP-095'), async ({ pm, page }) => {
    await withSalesLock(async () => {
      const writes = watchWrites(page);
      const before = await matrix(pm);
      const row = before.rows.find(r => r.cells['Status'] === PS('Available Status'));
      test.skip(!row, 'No Available unit');
      const u = await pm.editUnit(row!.code, PS('Row Edit Button'));
      await u.open(SS('Sales Section'));
      const r = await pressAndWait(page, u.button(PS('Unit Recalc Button')), writes);
      note('unit recalculated', `${row!.code}: ${r.writes.map(w => `${w.method} ${w.url} ${w.status}`).join(', ')} · "${r.message}"`);
      expect.soft(ok(r.writes), 'Recalculation sent and succeeded').toBeTruthy();
      await u.close(SS('Close Button'), SS('Discard Button'));
      const after = await matrix(pm);
      const a = after.rows.find(x => x.code === row!.code)!;
      expect.soft(bad(formulaErrors(after.header, [a])), `${row!.code} follows the formulas`).toBe('');
      expect(a.cells, `${row!.code} unchanged (rules unchanged)`).toEqual(row!.cells);
    });
  });

  test(...ivp('IVP-096'), async ({ pm, page }) => {
    await withSalesLock(async () => {
      const writes = watchWrites(page);
      const before = await matrix(pm);
      // Cancel first: nothing is sent
      await pm.press(pm.button(PS('Recalc All Button')), PS('Recalc All Button'));
      const n = new Notice(page);
      const info = await n.wait(10_000);
      note('confirmation', info?.text ?? 'none');
      expect.soft(info?.title, 'Confirmation title').toBe(PS('Recalc Confirm Title'));
      expect.soft(info?.buttons ?? [], 'Confirmation buttons').toEqual(expect.arrayContaining([PS('Recalc Cancel Button'), PS('Recalc Confirm Button')]));
      const from = writes.length;
      await n.close(PS('Recalc Cancel Button'));
      await page.waitForTimeout(2000);
      expect.soft(writes.slice(from).map(w => `${w.method} ${w.url}`), 'Cancel sends nothing').toEqual([]);
      // then Recalculate
      const r = await recalcAll(pm, writes);
      note('recalculate all', `${r.writes.map(w => `${w.method} ${w.url} ${w.status}`).join(', ') || 'no request'} · "${r.message}"`);
      expect.soft(r.writes.length, 'Recalculate sends the recalculation').toBeGreaterThan(0);
      expect.soft(ok(r.writes), 'The recalculation succeeds').toBeTruthy();
      expect.soft(r.message, 'A message tells the user the units were recalculated').not.toBe('');
      const after = await matrix(pm);
      expect.soft(bad(formulaErrors(after.header, after.rows)), 'Every row follows the formulas').toBe('');
      expect(changed(before.rows, after.rows), 'No price changes (rules unchanged)').toEqual([]);
    });
  });

  test(...ivp('IVP-097'), async ({ pm, rules, page }) => {
    await withSalesLock(async () => {
      const writes = watchWrites(page);
      const before = await matrix(pm);
      await openRules(pm);
      const r = await pressAndWait(page, rules.button(PS('Rules Recalc Button')), writes);
      note('recalculate all units live', `${r.writes.map(w => `${w.method} ${w.url} ${w.status}`).join(', ') || 'no request'} · "${r.message}"`);
      expect.soft(r.writes.length, 'The recalculation is sent').toBeGreaterThan(0);
      expect.soft(ok(r.writes), 'The recalculation succeeds').toBeTruthy();
      expect.soft(r.message, 'A message tells the user the units were recalculated').not.toBe('');
      const after = await matrix(pm);
      expect.soft(bad(formulaErrors(after.header, after.rows)), 'Every row follows the formulas').toBe('');
      expect(changed(before.rows, after.rows), 'No price changes (rules unchanged)').toEqual([]);
    });
  });

  test(...ivp('IVP-098'), async ({ pm, rules, page }) => {
    await withSalesLock(async () => {
      const writes = watchWrites(page);
      const first = await matrix(pm);
      await openRules(pm);
      const rates = await baseRates(rules);
      // the product with the fewest units in the matrix
      const count = (p: string) => first.rows.filter(r => r.cells['Product'] === p).length;
      const product = [...rates.keys()].filter(count).sort((a, b) => count(a) - count(b))[0];
      const rate = rates.get(product)!;
      const changedRate = rate + Number(PS('Rule Change'));
      const v0 = await rules.version(PS('Rules Version Word'));
      note('product / rate / version', `${product} (${count(product)} units) ${rate} → ${changedRate} · ${v0.text}`);
      try {
        await rules.setRow(product, String(changedRate));
        const r = await pressAndWait(page, rules.button(PS('Save Draft Button')), writes);
        note('save draft', `${r.writes.map(w => `${w.method} ${w.url} ${w.status}`).join(', ')} · "${r.message}"`);
        expect.soft(ok(r.writes), 'Draft saved').toBeTruthy();
        expect.soft(r.message, 'A message tells the user the draft was saved').not.toBe('');
        const v1 = await rules.version(PS('Rules Version Word'));
        note('version after Save Draft', v1.text);
        expect.soft(v1.number, 'Version number goes up').toBeGreaterThan(v0.number);
        expect.soft(v1.text, `Version line shows ${PS('Draft Status')}`).toContain(PS('Draft Status'));
        expect.soft(v1.text, `Version line shows "${PS('Unpublished Text')}"`).toContain(PS('Unpublished Text'));
        const m = await matrix(pm);
        expect(changed(first.rows, m.rows), 'The draft does not change any live price').toEqual([]);
      } finally {
        await putBack(pm, rules, writes, product, rate, first.rows);
      }
    });
  });

  test(...ivp('IVP-099'), async ({ pm, rules, page }) => {
    await withSalesLock(async () => {
      const writes = watchWrites(page);
      const first = await matrix(pm);
      await openRules(pm);
      const rates = await baseRates(rules);
      const count = (p: string) => first.rows.filter(r => r.cells['Product'] === p).length;
      const product = [...rates.keys()].filter(count).sort((a, b) => count(a) - count(b))[0];
      const rate = rates.get(product)!;
      const changedRate = rate + Number(PS('Rule Change'));
      const v0 = await rules.version(PS('Rules Version Word'));
      note('product / rate / version', `${product} (${count(product)} units) ${rate} → ${changedRate} · ${v0.text}`);
      try {
        await rules.setRow(product, String(changedRate));
        const r = await pressAndWait(page, rules.button(PS('Publish Button')), writes);
        note('publish', `${r.writes.map(w => `${w.method} ${w.url} ${w.status}`).join(', ')} · "${r.message}"`);
        expect.soft(ok(r.writes), 'Published').toBeTruthy();
        expect.soft(r.message, 'A message tells the user the rules were published').not.toBe('');
        const v1 = await rules.version(PS('Rules Version Word'));
        note('version after Publish', v1.text);
        expect.soft(v1.number, 'Version number goes up').toBeGreaterThan(v0.number);
        expect.soft(v1.text, `Version line shows ${PS('Published Status')}`).toContain(PS('Published Status'));
        // the matrix may re-price by itself; otherwise Recalculate All
        let m = await matrix(pm);
        if (!changed(first.rows, m.rows).length) {
          const rc = await recalcAll(pm, writes);
          note('recalculate all after publish', `${rc.writes.map(w => `${w.method} ${w.url} ${w.status}`).join(', ') || 'no request'} · "${rc.message}"`);
          m = await matrix(pm);
        }
        const mine = m.rows.filter(x => x.cells['Product'] === product);
        const others = m.rows.filter(x => x.cells['Product'] !== product);
        note('units of the product after publish', mine.map(x => `${x.code} ${x.cells['Base Rate']} ${x.cells['Current Price']}`).join(' · '));
        expect.soft(mine.filter(x => money(x.cells['Base Rate']) !== changedRate).map(x => `${x.code} ${x.cells['Base Rate']}`), `Units of ${product} get the published rate ${changedRate}`).toEqual([]);
        expect.soft(bad(formulaErrors(m.header, mine)), `Units of ${product} follow the formulas`).toBe('');
        expect(changed(first.rows.filter(x => x.cells['Product'] !== product), others), 'Other units do not change').toEqual([]);
      } finally {
        await putBack(pm, rules, writes, product, rate, first.rows);
      }
    });
  });
});
