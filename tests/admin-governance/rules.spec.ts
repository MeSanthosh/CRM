/**
 * Business Rules Configuration, read only (ADM-041 … ADM-053) and the broken-value sweep of the admin pages (ADM-063).
 * Run: npx playwright test tests/admin-governance/rules.spec.ts
 */
import { test, expect, note, adm, S, engines, never, broken, list } from './shared';
import { AvailabilityPage } from '../pages/AvailabilityPage';
import { XP, at } from '../locators';

const inRange = (hint: string, v: number) => { const m = hint.match(/\((\d+)[–-](\d+)\)/); return !m || (v >= Number(m[1]) && v <= Number(m[2])); };

test.describe('Admin & Governance · Business Rules', () => {
  test.describe.configure({ timeout: 300_000 });

  test(...adm('ADM-041'), async ({ rules, page }) => {
    await rules.open(engines()[0]['Code']);
    const names = await rules.engineNames();
    note('engines', names.join(' | '));
    expect.soft(names.length, 'Every engine is listed').toBe(engines().length);
    for (const e of engines()) {
      await rules.open(e['Code']);
      expect.soft(names.some(n => n.startsWith(e['Name'])), `${e['Name']} is listed`).toBeTruthy();
      await expect.soft(page, `${e['Code']} address`).toHaveURL(new RegExp(`engine=${e['Code']}`));
      const v = await rules.version(S('Version Word'));
      note(e['Code'], v.text);
      expect.soft(v.text, `${e['Code']}: version line`).toContain(S('Published Status'));
      expect.soft(await rules.lines(), `${e['Code']}: heading`).toContain(e['Name']);
      for (const b of [S('Save Draft Button'), S('Publish Button')]) await expect.soft(rules.button(b), `${e['Code']}: ${b}`).toBeVisible();
    }
  });

  test(...adm('ADM-042'), async ({ rules, page }) => {
    await rules.open('LEAD_DUPLICATE');
    expect.soft(await rules.read('label:Match Mode'), 'Match Mode has a value').not.toBe('');
    const rows = await page.locator('main table').last().locator('tbody tr').evaluateAll(rs => rs.map(r => (r as HTMLElement).innerText.replace(/\s+/g, ' ').trim()));
    note('fields', rows.join(' | '));
    expect.soft(rows.map(r => r.split(/ (?:trim_lower|digits|Always)/)[0]), 'Field list').toEqual(['First name', 'Last name', 'Mobile', 'Email', 'Passport number', 'National ID number']);
    for (const f of ['Mobile', 'Email']) expect.soft(rows.find(r => r.startsWith(f)) ?? '', `${f} is always unique`).toContain('Always unique');
  });

  test(...adm('ADM-043'), async ({ rules, page }) => {
    await rules.open('LEAD_SCORING');
    const rows = page.locator('main table').last().locator('tbody tr');
    let total = 0; const seen: string[] = [];
    for (let i = 0; i < await rows.count(); i++) {
      const v = Number(await rows.nth(i).locator('input[type=number]').inputValue());
      const on = await rows.nth(i).locator('input[type=checkbox]').isChecked();
      if (on) total += v;
      seen.push(`${v}${on ? '' : ' (off)'}`);
    }
    const line = (await rules.lines()).find(l => l.startsWith('Enabled criteria total')) ?? '';
    note('scores', `${seen.join(' + ')} = ${total} · ${line}`);
    expect.soft(total, 'Enabled Max Scores total').toBe(Number(S('Scoring Total')));
    expect(line, 'The line shows the total').toContain(`${total} / ${S('Scoring Total')}`);
  });

  test(...adm('ADM-044'), async ({ rules }) => {
    await rules.open('LEAD_QUALIFICATION');
    const v = Number(await rules.read('label:Auto-qualify minimum score'));
    note('threshold', String(v));
    expect.soft(v >= 0 && v <= 100, `Minimum score ${v} is 0–100`).toBeTruthy();
    expect(await rules.read('label:Warning message'), 'Warning message').not.toBe('');
  });

  test(...adm('ADM-045'), async ({ rules }) => {
    await rules.open('LEAD_CLASSIFICATION');
    const n = await rules.numbers();
    const bands = Array.from({ length: n.length / 2 }, (_, i) => ({ min: n[2 * i], max: n[2 * i + 1] })).sort((a, b) => a.min - b.min);
    note('bands', bands.map(b => `${b.min}–${b.max}`).join(', '));
    const [lo, hi] = S('Band Range').split('-').map(Number);
    expect.soft(bands[0].min, 'Starts at the bottom of the range').toBe(lo);
    expect.soft(bands[bands.length - 1].max, 'Ends at the top of the range').toBe(hi);
    expect(bands.slice(1).filter((b, i) => b.min !== bands[i].max + 1).map(b => b.min), 'No gaps or overlaps').toEqual([]);
  });

  test(...adm('ADM-046'), async ({ rules }) => {
    await rules.open('DATE_OF_BIRTH');
    const [min, max] = [Number(await rules.read('label:Minimum age')), Number(await rules.read('label:Maximum age'))];
    note('ages', `${min} – ${max}`);
    expect(Number.isFinite(min) && Number.isFinite(max) && min <= max, `Minimum ${min} ≤ maximum ${max}`).toBeTruthy();
  });

  test(...adm('ADM-047'), async ({ rules }) => {
    await rules.open('CUSTOMER_CREATION');
    const t = await rules.read('label:Promote to Customer when');
    note('trigger', t);
    expect.soft(t, 'A trigger is chosen').not.toBe('');
    expect(await rules.read('label:Policy note'), 'Policy note').not.toBe('');
  });

  test(...adm('ADM-048'), async ({ rules, page }) => {
    await rules.open('UNIT_HOLD');
    const def = Number(await rules.read('label:Default hold length')), max = Number(await rules.read('label:Maximum hold length'));
    note('default / maximum hours', `${def} / ${max}`);
    expect.soft(def <= max, 'Default ≤ maximum').toBeTruthy();
    const av = new AvailabilityPage(page, S('Inventory Route'), S('Availability Tab'));
    await av.open();
    await av.view(S('Stack Plan View'));
    const tile = (await av.tiles()).find(t => t.letter === 'A');
    test.skip(!tile, 'No Available unit');
    const w = await av.openTile(tile!.code);
    const btn = w.buttons.find(b => b.startsWith(S('Hold Button Prefix'))) ?? '';
    expect.soft(btn, `The Hold button names the default ${def} h`).toContain(`${def}h`);
    await av.press(av.unitButtonStarting(S('Hold Button Prefix')), btn);
    const form = at(page, XP.avsHoldForm(S('Hold Submit Button')));
    await expect(form, 'Hold form').toBeVisible();
    const opts = (await form.locator('select').nth(1).locator('option').allTextContents()).map(o => o.trim());
    const hours = opts.map(o => Number((o.match(/\((\d+)h\)/) ?? o.match(/(\d+) hours?/) ?? ['', 'NaN'])[1]));
    note('hold options', opts.join(' | '));
    await form.getByRole('button', { name: S('Cancel Button'), exact: true }).click();
    expect(Math.max(...hours), 'The longest option = the maximum hold length').toBe(max);
  });

  test(...adm('ADM-049'), async ({ rules, page }) => {
    await rules.open('DISCOUNT_APPROVAL');
    const free = Number(await rules.read('label:No approval needed'));
    const fields = page.locator('main label').filter({ hasText: /^Up to \(%\)/ }).locator('input');
    const ups = (await fields.evaluateAll(es => es.map(e => Number((e as HTMLInputElement).value))));
    const names = await page.locator('main label').filter({ hasText: /^Tier name/ }).locator('input').evaluateAll(es => es.map(e => (e as HTMLInputElement).value));
    note('tiers', `free ${free} · ${names.map((n, i) => `${n} ${ups[i]}%`).join(' · ')}`);
    expect.soft(free < ups[0], 'The free limit is below the first tier').toBeTruthy();
    expect.soft(ups.slice(1).filter((u, i) => u <= ups[i]), 'Tiers rise').toEqual([]);
    expect.soft(ups[ups.length - 1], 'The last tier reaches 100').toBe(100);
    expect(names.filter(n => !n), 'Every tier has a name').toEqual([]);
  });

  test(...adm('ADM-050'), async ({ rules, page }) => {
    await rules.open('COMMUNICATION_CHANNELS');
    const lines = await rules.lines();
    for (const l of ['Email Channel (Microsoft 365 Graph)', 'WhatsApp Business (Meta Cloud API)']) expect.soft(lines, `Section ${l}`).toContain(l);
    note('setup state', lines.filter(l => l === S('Setup Needed') || /not connected/.test(l)).join(' | '));
    for (const b of never().filter(x => /Email Settings|WhatsApp Settings|Verify/.test(x))) await expect.soft(page.locator('main').getByRole('button', { name: b, exact: true }), `"${b}" is there (never pressed)`).toBeVisible();
  });

  test(...adm('ADM-051'), async ({ rules }) => {
    await rules.open('LOGIN_OTP');
    const lines = await rules.lines();
    // table rows read "1<tab>Show on screen": the channel name shares a line with its order
    for (const c of ['Show on screen', 'WhatsApp', 'SMS', 'Email']) expect.soft(lines.some(l => new RegExp(`^\\d\\s+${c}$`).test(l)), `Channel ${c}`).toBeTruthy();
    const out: string[] = [];
    for (const [i, l] of lines.entries()) {
      if (!/\(\d+[–-]\d+\)/.test(lines[i + 1] ?? '')) continue;
      const v = Number(await rules.read(`label:${l}`).catch(() => 'NaN'));
      note(l, `${v} ${lines[i + 1]}`);
      if (!inRange(lines[i + 1], v)) out.push(`${l} = ${v}; ${lines[i + 1]}`);
    }
    expect(out, 'Each setting lies within the range its hint gives').toEqual([]);
  });

  test(...adm('ADM-052'), async ({ rules }) => {
    await rules.open('PII_PROTECTION');
    const lines = await rules.lines();
    for (const l of ['Mask personal data', 'Data to mask', 'Who sees full data', 'Names', 'Email']) expect.soft(lines, `Shows ${l}`).toContain(l);
  });

  test(...adm('ADM-053'), async ({ rules }) => {
    await rules.open('UNIT_PRICING_RULES');
    const lines = await rules.lines();
    expect(lines.filter(l => /^\d\. /.test(l) || l.includes('Live Simulator')).length, 'Rule tabs and the Live Simulator').toBeGreaterThanOrEqual(7);
  });

  test(...adm('ADM-063'), async ({ rules, page }) => {
    const found: string[] = [];
    const check = async (where: string) => { for (const b of broken(await page.locator('main').innerText())) found.push(`${where}: ${b}`); };
    for (const r of list(`${S('Currencies Route')}, ${S('Reference Route')}, ${S('Preferences Route')}`)) { await page.goto(r); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(800); await check(r); }
    for (const e of engines()) { await rules.open(e['Code']); await check(e['Code']); }
    expect(found, 'No broken values').toEqual([]);
  });
});
