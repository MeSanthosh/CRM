/**
 * Availability Summary → Stack Plan tile → unit window (AVS-023 … AVS-027, AVS-029): the unit and its pricing matrix
 * structure, Open in Unit Register, Close, Start Reservation (form opened and closed, never created) and the Hold
 * form (read, then Cancel). Nothing is saved. Run: npx playwright test tests/availability-summary/unit-window.spec.ts
 */
import { test, expect, note, avs, S, DATA, HF, RV, list, sameAmount, bad, broken, matrixRows, amount } from './shared';
import { watchWrites } from '../pages/PricingMatrixPage';
import { XP, at } from '../locators';
import { figures, tierColumns, discountOf } from '../inventory-page/pricing-shared';

const STACK = () => DATA.sheet('Page Views')[1]['View'];

/** An Available tile of the Stack Plan (the middle one, so tests do not always use the same unit). */
async function availableTile(av: import('../pages/AvailabilityPage').AvailabilityPage) {
  await av.open();
  await av.view(STACK());
  const tiles = (await av.tiles()).filter(t => t.status === S('Available Status'));
  test.skip(!tiles.length, `No ${S('Available Status')} unit`);
  return tiles[Math.floor(tiles.length / 2)];
}

test.describe('Availability Summary · Unit window', () => {
  test.describe.configure({ timeout: 600_000 });

  test(...avs('AVS-023'), async ({ av, pm }) => {
    const m = await matrixRows(pm);
    const header = await pm.header();
    await av.open();
    await av.view(STACK());
    const tiles = await av.tiles();
    // one unit of each status, and one of each product, up to 6
    const pick = [...new Map(tiles.map(t => [t.status, t])).values(), ...new Map(tiles.map(t => [t.product, t])).values()].filter((t, i, a) => a.indexOf(t) === i).slice(0, 6);
    const errs: string[] = [];
    for (const t of pick) {
      const w = await av.openTile(t.code);
      const r = m.get(t.code);
      note(`window ${t.code}`, `${w.header} · ${w.status} · ${JSON.stringify(w.pairs)}`);
      if (!r) { errs.push(`${t.code}: not in the Pricing Matrix`); await av.closeWindow(av.unitWindow, S('Close Button')); continue; }
      const f = figures(r, header);
      if (w.code !== t.code) errs.push(`${t.code}: window shows ${w.code}`);
      if (w.status !== t.status) errs.push(`${t.code}: window status ${w.status} ≠ tile ${t.status}`);
      if (!w.header.toUpperCase().includes(/^\d+$/.test(t.floor) ? `FLOOR ${t.floor}`.toUpperCase() : '')) errs.push(`${t.code}: header "${w.header}" without its floor ${t.floor}`);
      for (const fact of DATA.sheet('Unit Window Facts')) {
        const shown = w.pairs[fact['Caption']] ?? '';
        const want = r.cells[fact['Pricing Matrix Column']] ?? '';
        const ok = fact['Compare'] === 'same number' ? Number(shown.replace(/[^\d.]/g, '')) === Number(want) : fact['Compare'] === 'name without %' ? shown === want.replace(/\s*\([^)]*%\)$/, '') : shown === want;
        if (!ok) errs.push(`${t.code} ${fact['Caption']}: "${shown}" ≠ matrix "${want}"`);
      }
      for (const s of DATA.sheet('Matrix Structure')) {
        const col = s['Pricing Matrix Column'] === 'Floor (' ? header.columns.find(c => /^Floor \(/.test(c))! : s['Pricing Matrix Column'];
        const lines = w.text.split('\n').map(x => x.trim()).filter(Boolean);
        const shown = s['Caption'].endsWith(':') ? (w.text.match(new RegExp(`${s['Caption']}\\s*([\\d,.]+\\s*[KMB]?\\s*USD)`)) ?? ['', ''])[1]
          : w.pairs[s['Caption']] ?? lines[lines.findIndex(x => x.toUpperCase() === s['Caption'].toUpperCase()) + 1] ?? '';
        const ok = s['Kind'] === 'percent' ? shown === r.cells[col] : sameAmount(amount(shown), amount(r.cells[col]), shown);
        if (!ok) errs.push(`${t.code} ${s['Caption']}: "${shown}" ≠ matrix ${col} "${r.cells[col]}"`);
      }
      // the five tiers: "Early Bird (-5%)" … equal the matrix tier columns (same %)
      for (const tc of tierColumns(header)) {
        const k = Object.keys(w.pairs).find(x => new RegExp(`\\(${tc.pct >= 0 && tc.pct !== 0 ? '\\+' : ''}${tc.pct}%\\)$`).test(x));
        if (!k || !sameAmount(amount(w.pairs[k]), amount(r.cells[tc.header]), w.pairs[k])) errs.push(`${t.code} tier ${tc.header}: window "${k} ${k ? w.pairs[k] : ''}" ≠ matrix ${r.cells[tc.header]}`);
      }
      // formulas of the structure
      const std = amount(w.pairs['Standard Price']), adj = amount(w.pairs['Adjusted Standard']), net = amount(w.pairs['Net Unit Adj ($)']);
      // amounts from 1M are shown rounded ("1.24M USD"): compare within their rounding
      if (!sameAmount(std, f.carpet * f.rate, w.pairs['Standard Price'])) errs.push(`${t.code}: standard ${std} ≠ ${f.carpet} × ${f.rate}`);
      // the window rounds both figures from 1M: add the exact matrix figures and compare with what it shows
      if (!sameAmount(adj, f.std + f.netAdj, w.pairs['Adjusted Standard']) || !sameAmount(net, f.std * f.totalPct / 100, w.pairs['Net Unit Adj ($)'])) errs.push(`${t.code}: adjusted ${adj} ≠ ${std} + ${net}`);
      const fl = (w.text.match(new RegExp(`${S('Floor Limit Word')}\\s*([\\d,.]+\\s*[KMB]?)`)) ?? ['', ''])[1];
      const floorLimit = amount(fl);
      if (!sameAmount(floorLimit, f.current * (1 - discountOf(header) / 100), fl)) errs.push(`${t.code}: floor limit ${floorLimit} ≠ current × (1 − ${discountOf(header)}%)`);
      expect.soft(broken(w.text), `${t.code}: no broken values`).toEqual([]);
      await av.closeWindow(av.unitWindow, S('Close Button'));
    }
    note('units opened', pick.map(t => `${t.code} (${t.status}, ${t.product})`).join(', '));
    expect(bad(errs), 'Unit window = the Pricing Matrix row, and its structure adds up').toBe('');
  });

  test(...avs('AVS-024'), async ({ av, page }) => {
    const t = await availableTile(av);
    await av.openTile(t.code);
    await av.press(av.unitButton(S('Unit Register Button')), S('Unit Register Button'));
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
    const active = (await page.locator('main button.crm-tab-button.is-active').innerText().catch(() => '')).trim();
    const search = await at(page, XP.searchBox(S('Unit Search Placeholder'))).inputValue().catch(() => '');
    const rows = (await page.locator('main table').last().locator('tbody tr').allInnerTexts()).map(r => r.replace(/\s+/g, ' ').trim());
    const listed = rows.filter(r => r.startsWith(t.code));
    note('after Open in Unit Register', `tab ${active} · search "${search}" · ${rows.length} rows · ${listed[0] ?? 'unit not on the list'}`);
    expect.soft(active, 'The Units tab opens').toBe(S('Units Tab'));
    expect.soft(listed.length, `${t.code} is listed (the register is searched or opened on it)`).toBe(1);
    if (listed[0]) expect(listed[0], 'Same status').toContain(t.status);
  });

  test(...avs('AVS-025'), async ({ av }) => {
    const t = await availableTile(av);
    const before = (await av.tiles()).length;
    for (const how of [S('Close Button'), S('X Close Button'), 'Escape']) {
      await av.openTile(t.code);
      if (how === 'Escape') await av.page.keyboard.press('Escape');
      else await av.unitButton(how).click();
      await expect.soft(av.unitWindow, `${how} closes the unit window`).toBeHidden({ timeout: 10_000 });
      if (await av.unitWindow.isVisible()) await av.unitButton(S('Close Button')).click();
    }
    expect((await av.tiles()).length, 'The Stack Plan stays as it was').toBe(before);
  });

  test(...avs('AVS-026'), async ({ av, page }) => {
    const writes = watchWrites(page);
    const t = await availableTile(av);
    await av.openTile(t.code);
    await av.press(av.unitButton(S('Start Reservation Button')), S('Start Reservation Button'));
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect.soft(page, 'The Reservations page opens').toHaveURL(new RegExp(`${RV('Route')}(\\?.*)?$`));
    const notice = page.locator(`xpath=${XP.notice}`).last();
    await expect.soft(notice, 'A pop-up tells which unit is selected').toBeVisible({ timeout: 15_000 });
    const text = (await notice.innerText().catch(() => '')).replace(/\s+/g, ' ');
    note('pop-up', text);
    expect.soft(text, 'Pop-up title').toContain(RV('Notice Title'));
    expect.soft(text, 'Pop-up names the unit').toContain(RV('Notice Text').replace('{unit}', t.code));
    await notice.getByRole('button', { name: 'OK', exact: true }).click().catch(() => {});
    const form = page.locator(`xpath=${XP.topModal}`).filter({ hasText: RV('Form Heading') }).last();
    await expect(form, 'The Create Reservation form is open').toBeVisible({ timeout: 15_000 });
    const read = () => form.evaluate(f => [...f.querySelectorAll('input, select')].map(e => `${(e.closest('label')?.querySelector('span')?.textContent ?? e.getAttribute('aria-label') ?? '').trim()}=${(e as HTMLInputElement).value}`));
    // the unit, price and deposit are filled a moment after the form opens
    await expect.poll(async () => (await read()).some(v => v.endsWith(`=${t.code}`)), { message: `The form fills in ${t.code}`, timeout: 15_000 }).toBeTruthy();
    await expect.poll(async () => (await read()).find(v => v.startsWith(RV('Price Label')))?.split('=')[1] ?? '', { message: 'The form fills in the unit price', timeout: 15_000 }).not.toBe('');
    const lines = (await form.innerText()).split('\n').map(s => s.trim()).filter(Boolean);
    const after = (label: string) => lines[lines.findIndex(l => l.startsWith(label)) + 1] ?? '';
    const values = await form.evaluate(f => [...f.querySelectorAll('input, select')].map(e => `${(e.closest('label')?.querySelector('span')?.textContent ?? e.getAttribute('aria-label') ?? '').trim()}=${(e as HTMLInputElement).value}`));
    note('form', `${lines.slice(0, 30).join(' | ')} :: ${values.join(' · ')}`);
    expect.soft(lines.join(' ').includes(t.code) || values.some(v => v.includes(t.code)), `The form shows ${t.code} (Unit: "${after(RV('Unit Label'))}")`).toBeTruthy();
    const price = values.find(v => v.startsWith(RV('Price Label')))?.split('=')[1] ?? '';
    expect.soft(sameAmount(amount(price), t.operative, t.operativeShown), `Unit Price "${price}" = the unit's operative price ${t.operativeShown}`).toBeTruthy();
    const dep = values.find(v => v.startsWith(RV('Deposit Label')));
    const pctDep = Number(((dep ?? '').match(/(\d+(?:\.\d+)?)%/) ?? ['', 'NaN'])[1]);
    expect.soft(sameAmount(amount((dep ?? '').split('=')[1] ?? ''), amount(price) * pctDep / 100), `Deposit "${dep}" = ${pctDep}% of the price`).toBeTruthy();
    await form.getByRole('button', { name: RV('Close Button'), exact: true }).first().click();
    const d = page.getByRole('button', { name: /^Discard/ }).first();
    if (await d.isVisible({ timeout: 1500 }).catch(() => false)) await d.click();
    await expect(form, 'Closed without a reservation').toBeHidden({ timeout: 10_000 });
    expect(writes.filter(w => /reservation/i.test(w.url)).map(w => `${w.method} ${w.url}`), 'No reservation is created').toEqual([]);
  });

  test(...avs('AVS-027'), async ({ av, page }) => {
    const writes = watchWrites(page);
    const t = await availableTile(av);
    const w = await av.openTile(t.code);
    const holdBtn = w.buttons.find(b => b.startsWith(S('Hold Button Prefix'))) ?? '';
    note('hold button', holdBtn);
    await av.press(av.unitButtonStarting(S('Hold Button Prefix')), holdBtn);
    const form = at(page, XP.avsHoldForm(HF('Submit Button')));
    await expect(form, 'Hold form opens').toBeVisible({ timeout: 10_000 });
    const text = (await form.innerText()).split('\n').map(s => s.trim()).filter(Boolean);
    const selects = form.locator('select');
    // the opportunity list loads a moment after the form opens ("Loading opportunities...")
    await expect.poll(() => selects.nth(0).locator('option').count(), { message: 'Opportunities load', timeout: 15_000 }).toBeGreaterThan(1);
    const opps = (await selects.nth(0).locator('option').allTextContents()).map(s => s.trim());
    const durs = (await selects.nth(1).locator('option').allTextContents()).map(s => s.trim());
    const chosen = ((await selects.nth(1).locator('option:checked').textContent()) ?? '').trim();
    note('hold form', `${text[0]} · ${opps.length - 1} opportunities · durations ${durs.join(' | ')} · chosen ${chosen}`);
    expect.soft(text[0], 'Heading "Hold <code>"').toBe(`${HF('Title Prefix')} ${t.code}`);
    expect.soft(opps[0], 'Opportunity starts with its placeholder').toBe(HF('Opportunity Placeholder'));
    expect.soft(opps.length, 'Open opportunities are listed').toBeGreaterThan(1);
    expect.soft(durs, 'Every duration of the data').toEqual(DATA.sheet('Hold Durations').map(d => d['Option']));
    expect.soft(chosen, 'Default duration').toBe(HF('Default Duration'));
    expect.soft(holdBtn, `The button names the default duration (${chosen})`).toContain((chosen.match(/\((\d+h)\)/) ?? ['', chosen])[1]);
    expect.soft(text.some(l => l.startsWith(HF('Reason Label'))), 'Reason is optional').toBeTruthy();
    // Hold Unit without an opportunity: no hold
    const from = writes.length;
    await form.getByRole('button', { name: HF('Submit Button'), exact: true }).click();
    await page.waitForTimeout(2000);
    const sent = writes.slice(from).filter(x => x.status < 300);
    note('Hold Unit without opportunity', `${writes.slice(from).map(x => `${x.method} ${x.url} ${x.status}`).join(', ') || 'nothing sent'} · ${(await form.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200)}`);
    expect.soft(sent.map(x => `${x.method} ${x.url}`), 'No hold without an opportunity').toEqual([]);
    if (await form.isVisible()) await form.getByRole('button', { name: HF('Cancel Button'), exact: true }).click();
    await expect.soft(form, 'Cancel closes the form').toBeHidden({ timeout: 10_000 });
    await av.open();
    await av.view(STACK());
    expect((await av.tiles()).find(x => x.code === t.code)?.status, 'The unit is still Available').toBe(S('Available Status'));
  });

  test(...avs('AVS-029'), async ({ av }) => {
    await av.open();
    const texts: [string, string][] = [['Summary Table', await av.main.innerText()]];
    await av.openUnitMix(S('Grand Total Row'), S('Unit Mix Button'));
    texts.push(['Unit Mix', await av.unitMix.innerText()]);
    await av.closeWindow(av.unitMix, S('Close Button'));
    await av.view(STACK());
    texts.push(['Stack Plan', await av.main.innerText()]);
    const t = (await av.tiles())[0];
    const w = await av.openTile(t.code);
    texts.push([`unit window ${t.code}`, w.text]);
    for (const [where, text] of texts) expect.soft(broken(text), `${where}: no broken values`).toEqual([]);
    expect(list(S('Broken Values')).length, 'Broken values listed in the data').toBeGreaterThan(0);
  });
});
