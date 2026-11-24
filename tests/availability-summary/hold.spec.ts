/**
 * Availability Summary → Hold (AVS-028.1 …): holds an Available unit for each duration of the data, for an open
 * opportunity of our own test leads (names of TestData/Leads_Test_Data.xlsx), checks the tile, the counts and the
 * Holds tab, then releases the hold. The longer durations run only when the first (shortest) hold could be
 * released, so no unit stays held for days. Runs in order on one worker, under the inventory lock.
 * Run: npx playwright test tests/availability-summary/hold.spec.ts --workers=1
 */
import { test, expect, note, avsRow, S, DATA, HF, statuses } from './shared';
import { watchWrites } from '../pages/PricingMatrixPage';
import { withSalesLock } from '../sales-chain/inventory';
import { XP, at } from '../locators';
import { counts, release, confirmRelease, fillHold, holdForm } from './holds';

let releasable: boolean | undefined; // learnt by the first hold

test.describe('Availability Summary · Hold (writes, released)', () => {
  test.describe.configure({ mode: 'default', timeout: 600_000 });

  DATA.sheet('Hold Durations').forEach((d, n) => {
    test(...avsRow('AVS-028', n + 1, `hold for ${d['Option']}`, `The unit is held for ${d['Option']} (tile H, Held +1, Available −1, Holds tab: Held Until = now + ${d['Hours']} h) and released again.`, `Hold Durations row ${n + 1}: ${d['Option']} (${d['Placed By Test']})`), async ({ av, page }) => {
      test.skip(n > 0 && releasable === false, 'The first hold could not be released, so longer holds are not placed (a unit would stay held for days)');
      test.skip(n > 0 && releasable === undefined, 'The first hold did not run');
      await withSalesLock(async () => {
        const writes = watchWrites(page);
        const before = await counts(av);
        const tile = (await av.tiles()).filter(t => t.status === S('Available Status')).pop();
        test.skip(!tile, 'No Available unit');
        const w = await av.openTile(tile!.code);
        await av.press(av.unitButtonStarting(S('Hold Button Prefix')), w.buttons.find(b => b.startsWith(S('Hold Button Prefix'))) ?? 'Hold');
        const form = holdForm(av);
        const opp = await fillHold(form, d['Option']);
        note('test data', `unit ${tile!.code} · duration ${d['Option']} · opportunity ${opp || 'none of our own'}`);
        test.skip(!opp, 'No open opportunity of our own test leads to hold the unit for');
        const from = writes.length;
        const at0 = Date.now();
        await form.getByRole('button', { name: HF('Submit Button'), exact: true }).click();
        await expect.poll(() => writes.length > from, { message: 'The hold is sent', timeout: Number(S('Save Wait Seconds')) * 1000 }).toBeTruthy();
        await page.waitForTimeout(1500);
        const sent = writes.slice(from);
        note('hold sent', sent.map(x => `${x.method} ${x.url} ${x.status}`).join(', '));
        expect(sent.some(x => x.status >= 200 && x.status < 300), 'Hold placed').toBeTruthy();
        let released = '';
        try {
          const after = await counts(av);
          const t = (await av.tiles()).find(x => x.code === tile!.code);
          note('after hold', `${tile!.code} ${t?.status}/${t?.letter} · chips ${JSON.stringify(after.chips)} · ${after.sum.text}`);
          const held = statuses().find(s => s['Status'] === S('Held Status'))!;
          expect.soft(t?.status, 'Tile shows Held').toBe(held['Status']);
          expect.soft(t?.letter, `Tile letter ${held['Letter']}`).toBe(held['Letter']);
          expect.soft((after.chips[held['Status']] ?? 0) - (before.chips[held['Status']] ?? 0), 'Held chip +1').toBe(1);
          expect.soft((after.chips[S('Available Status')] ?? 0) - (before.chips[S('Available Status')] ?? 0), 'Available chip −1').toBe(-1);
          expect.soft((after.sum.parts[held['Summary Column']]?.n ?? 0) - (before.sum.parts[held['Summary Column']]?.n ?? 0), 'Summary line Held +1').toBe(1);
          expect.soft((after.sum.parts['Available']?.n ?? 0) - (before.sum.parts['Available']?.n ?? 0), 'Summary line Available −1').toBe(-1);
          // Holds tab: the hold with its duration and end time
          await av.press(at(page, XP.pageTab(HF('Holds Tab'))).first(), HF('Holds Tab'));
          await page.waitForTimeout(1500);
          for (const sel of await av.main.locator('select').all()) {
            const o = (await sel.locator('option').allTextContents()).map(x => x.trim()).find(x => x === HF('Holds Scope All'));
            if (o) await sel.selectOption({ label: o });
          }
          await page.waitForTimeout(1500);
          const row = (await av.main.locator('table tbody tr', { hasText: tile!.code }).first().innerText().catch(() => '')).replace(/\s+/g, ' ');
          note('Holds tab row', row || 'not listed');
          expect.soft(row, 'Holds tab lists the hold').toContain(tile!.code);
          expect.soft(row, 'with the opportunity').toContain(opp!.split(' · ')[0]);
          const until = row.match(/(\d{2} \w{3} \d{4},? \d{2}:\d{2})/)?.[1];
          if (until) {
            const diffMin = Math.abs(new Date(until.replace(',', '')).getTime() - (at0 + Number(d['Hours']) * 3_600_000)) / 60_000;
            expect.soft(diffMin, `Held Until ${until} = now + ${d['Hours']} h (±${HF('Held Until Tolerance Minutes')} min)`).toBeLessThanOrEqual(Number(HF('Held Until Tolerance Minutes')));
          } else expect.soft(until, 'Held Until shown').toBeTruthy();
        } finally {
          const rf = writes.length;
          released = await release(av, tile!.code);
          if (released) {
            const ask = await confirmRelease(av);
            note('release pop-up', ask || 'none');
            expect.soft(ask, `Release asks "${HF('Release Confirm Title')}"`).toContain(HF('Release Confirm Title'));
            expect.soft(writes.slice(rf).some(x => /release/i.test(x.url) && x.status >= 200 && x.status < 300), 'The release is sent and succeeds').toBeTruthy();
          }
          if (n === 0) releasable = !!released;
          note('released by', released || 'no release button found: the hold ends by itself');
        }
        expect(released, 'The hold can be released (a Release button in the unit window or the Holds tab)').not.toBe('');
        const end = await counts(av);
        expect.soft((await av.tiles()).find(x => x.code === tile!.code)?.status, 'Unit Available again').toBe(S('Available Status'));
        expect(end.chips, 'Every count back as before').toEqual(before.chips);
      });
    });
  });
});
