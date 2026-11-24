/**
 * Availability Summary → drill-down unit list (⊞ Unit Mix → View Units): Quick View (AVS-030, read only) and Hold
 * (AVS-031: holds one Available unit for an opportunity of our own test leads, then releases it).
 * Runs in order on one worker. Run: npx playwright test tests/availability-summary/drill.spec.ts --workers=1
 */
import { test, expect, note, avs, S, HF, sameAmount, amount, statuses } from './shared';
import { watchWrites } from '../pages/PricingMatrixPage';
import { withSalesLock } from '../sales-chain/inventory';
import { counts, release, confirmRelease, fillHold, holdForm, STACK } from './holds';
import type { AvailabilityPage } from '../pages/AvailabilityPage';

/** Opens the drill-down list of the first block's product with the most Available units; returns its rows. */
async function openDrill(av: AvailabilityPage) {
  await av.open();
  const block = (await av.rows()).find(r => r.kind === 'block')!;
  await av.openUnitMix(block.label, S('Unit Mix Button'));
  const products = (await av.mixRows()).filter(x => !/^Total/i.test(x.label)).sort((a, b) => b.cells['Available'].n - a.cells['Available'].n);
  await av.unitMix.locator('tr', { hasText: products[0].label }).locator('button', { hasText: S('View Units Button') }).first().click();
  await expect(av.drill, 'Drill-down list opens').toBeVisible({ timeout: 15_000 });
  const info = await av.drillInfo(S('Drill Heading'));
  note('drill-down', `${info.title} · ${info.rows.length} rows`);
  return { block: block.label, product: products[0].label, rows: info.rows };
}
const rowOf = (av: AvailabilityPage, code: string) => av.drill.locator('tbody tr', { hasText: code }).first();

test.describe('Availability Summary · Drill-down list', () => {
  test.describe.configure({ mode: 'default', timeout: 600_000 });

  test(...avs('AVS-030'), async ({ av }) => {
    const d = await openDrill(av);
    const avail = d.rows.find(r => r['Status'] === S('Available Status'));
    const other = d.rows.find(r => r['Status'] !== S('Available Status'));
    // only Available rows offer Hold
    for (const r of d.rows) {
      const buttons = (await rowOf(av, r['Unit Code']).locator('button').allInnerTexts()).map(b => b.trim());
      const hasHold = buttons.includes(S('Drill Hold Button'));
      expect.soft(buttons, `${r['Unit Code']}: Quick View`).toContain(S('Drill Quick View Button'));
      expect.soft(hasHold, `${r['Unit Code']} (${r['Status']}): Hold ${r['Status'] === S('Available Status') ? 'offered' : 'not offered'}`).toBe(r['Status'] === S('Available Status'));
    }
    for (const r of [avail, other].filter(Boolean) as Record<string, string>[]) {
      await av.press(rowOf(av, r['Unit Code']).getByRole('button', { name: S('Drill Quick View Button'), exact: true }), `Quick View of ${r['Unit Code']}`);
      await expect(av.unitWindow, `Quick View of ${r['Unit Code']} opens the unit window`).toBeVisible({ timeout: 15_000 });
      const w = await av.readUnitWindow();
      note(`quick view ${r['Unit Code']}`, `${w.header} · ${w.code} · ${w.status} · ${JSON.stringify(w.pairs)}`);
      expect.soft(w.code, 'Same unit').toBe(r['Unit Code']);
      expect.soft(w.status, `${r['Unit Code']}: status = the row`).toBe(r['Status']);
      expect.soft(w.pairs['Product'], `${r['Unit Code']}: product = the row`).toBe(r['Product']);
      expect.soft(Number((w.pairs['Carpet Area'] ?? '').replace(/[^\d.]/g, '')), `${r['Unit Code']}: carpet = the row`).toBe(Number(r['Carpet (m²)'].replace(/[^\d.]/g, '')));
      const lines = w.text.split('\n').map(x => x.trim()).filter(Boolean);
      const op = lines[lines.findIndex(x => /^Operative Current Price$/i.test(x)) + 1] ?? '';
      expect.soft(sameAmount(amount(op), amount(r['Operative Price']), op), `${r['Unit Code']}: operative price ${op} = the row ${r['Operative Price']}`).toBeTruthy();
      await av.closeWindow(av.unitWindow, S('Close Button'));
      await expect.soft(av.drill, 'The list stays open').toBeVisible();
    }
  });

  test(...avs('AVS-031'), async ({ av, page }) => {
    await withSalesLock(async () => {
      const writes = watchWrites(page);
      const before = await counts(av);
      const d = await openDrill(av);
      const r = [...d.rows].reverse().find(x => x['Status'] === S('Available Status'));
      test.skip(!r, 'No Available unit in the list');
      const code = r!['Unit Code'];
      await av.press(rowOf(av, code).getByRole('button', { name: S('Drill Hold Button'), exact: true }), `Hold of ${code}`);
      const form = holdForm(av);
      await expect(form, 'Hold form opens').toBeVisible({ timeout: 10_000 });
      const heading = ((await form.innerText()).split('\n')[0] ?? '').trim();
      expect.soft(heading, 'The form of the unit window').toBe(`${HF('Title Prefix')} ${code}`);
      const opp = await fillHold(form, S('Drill Hold Duration'));
      note('test data', `unit ${code} · duration ${S('Drill Hold Duration')} · opportunity ${opp || 'none of our own'}`);
      test.skip(!opp, 'No open opportunity of our own test leads to hold the unit for');
      const from = writes.length;
      await form.getByRole('button', { name: HF('Submit Button'), exact: true }).click();
      await expect.poll(() => writes.length > from, { message: 'The hold is sent', timeout: Number(S('Save Wait Seconds')) * 1000 }).toBeTruthy();
      await page.waitForTimeout(1500);
      const sent = writes.slice(from);
      note('hold sent', sent.map(x => `${x.method} ${x.url} ${x.status}`).join(', '));
      expect(sent.some(x => x.status >= 200 && x.status < 300), 'Hold placed').toBeTruthy();
      let released = '';
      try {
        const rowText = (await rowOf(av, code).innerText().catch(() => '')).replace(/\s+/g, ' ');
        note('row after hold', rowText || 'list closed');
        const held = statuses().find(s => s['Status'] === S('Held Status'))!;
        if (rowText) expect.soft(rowText, 'The row shows Held').toContain(held['Status']);
        const after = await counts(av);
        const t = (await av.tiles()).find(x => x.code === code);
        note('after hold', `${code} ${t?.status}/${t?.letter} · chips ${JSON.stringify(after.chips)} · ${after.sum.text}`);
        expect.soft(t?.status, 'Tile shows Held').toBe(held['Status']);
        expect.soft((after.chips[held['Status']] ?? 0) - (before.chips[held['Status']] ?? 0), 'Held chip +1').toBe(1);
        expect.soft((after.chips[S('Available Status')] ?? 0) - (before.chips[S('Available Status')] ?? 0), 'Available chip −1').toBe(-1);
      } finally {
        const rf = writes.length;
        released = await release(av, code);
        if (released) {
          const ask = await confirmRelease(av);
          note('release pop-up', ask || 'none');
          expect.soft(writes.slice(rf).some(x => /release/i.test(x.url) && x.status >= 200 && x.status < 300), 'The release is sent and succeeds').toBeTruthy();
        }
        note('released by', released || 'no release button found');
      }
      expect(released, 'The hold can be released').not.toBe('');
      const end = await counts(av);
      await av.view(STACK());
      expect.soft((await av.tiles()).find(x => x.code === code)?.status, 'Unit Available again').toBe(S('Available Status'));
      expect(end.chips, 'Every count back as before').toEqual(before.chips);
    });
  });
});
