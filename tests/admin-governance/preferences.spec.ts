/**
 * Preferences (ADM-031 … ADM-037). Everything is read only except ADM-037, which saves Rows per page and puts the
 * original value back. ETL buttons and the SMTP / security saves are never pressed.
 * Run: npx playwright test tests/admin-governance/preferences.spec.ts --workers=1
 */
import { test, expect, note, adm, S, sheet, never, broken } from './shared';
import { press, mainLines, shownMessage } from '../pages/AdminPages';
import { ModulePage } from '../pages/SalesPages';
import { XP, at } from '../locators';
import type { Page } from '@playwright/test';

const open = async (page: Page) => {
  await page.goto(S('Preferences Route'));
  await page.waitForLoadState('networkidle').catch(() => {});
  await expect(at(page, XP.adminButton(sheet('Preference Sections')[0]['Tab'])).first(), 'Preferences open').toBeVisible({ timeout: 30_000 });
};
const section = async (page: Page, tab: string, sub = '') => {
  await press(at(page, XP.adminButton(tab)).first());
  if (sub) await press(at(page, XP.adminButton(sub)).first());
  await page.waitForTimeout(400);
};
const sec = (name: string) => sheet('Preference Sections').find(s => (s['Section'] || s['Tab']) === name)!;
const selects = (page: Page) => page.locator('main select').filter({ visible: true });
const optionsAt = async (page: Page, i: number) => (await selects(page).nth(i).locator('option').allTextContents()).map(o => o.trim());
const chosenAt = async (page: Page, i: number) => ((await selects(page).nth(i).locator('option:checked').textContent()) ?? '').trim();
const wanted = (s: string) => s.split(',').map(x => x.trim().replace(/;/g, ','));
const pageSizePos = () => Number(sheet('Preference Options').find(o => o['Label'] === 'Rows per page')!['Position']);

test.describe('Admin & Governance · Preferences', () => {
  test.describe.configure({ timeout: 300_000 });

  for (const [id, name] of [['ADM-031', 'Application defaults'], ['ADM-032', 'Time & locale']] as const) {
    test(...adm(id), async ({ page }) => {
      await open(page);
      const s = sec(name);
      await section(page, s['Tab'], s['Section']);
      const lines = await mainLines(page);
      expect.soft(lines, `Heading ${s['Heading']}`).toContain(s['Heading']);
      await expect.soft(at(page, XP.adminButton(s['Save Button'])).first(), `Button ${s['Save Button']}`).toBeVisible();
      for (const o of sheet('Preference Options').filter(x => x['Section'] === name)) {
        const i = Number(o['Position']);
        const got = await optionsAt(page, i);
        note(o['Label'], `${await chosenAt(page, i)} of ${got.join(' | ')}`);
        expect.soft(lines, `Label ${o['Label']}`).toContain(o['Label']);
        expect.soft(got, `${o['Label']} options`).toEqual(wanted(o['Options']));
        expect.soft(await chosenAt(page, i), `${o['Label']} has a value`).not.toBe('');
      }
    });
  }

  test(...adm('ADM-033'), async ({ page }) => {
    await open(page);
    const s = sec('Email (SMTP)');
    await section(page, s['Tab'], s['Section']);
    const lines = await mainLines(page);
    for (const l of ['SMTP host', 'Port', 'Username', 'SMTP password', 'From email', 'From name']) expect.soft(lines, `Field ${l}`).toContain(l);
    await expect.soft(page.locator('main input[type=password]').first(), 'The password is not shown in clear').toBeAttached();
    const enabled = await page.locator('main input[type=checkbox]').first().isChecked(); // a switch: its input is hidden
    const send = at(page, XP.adminButton('Send test email')).first();
    note('email sending', `${enabled ? 'on' : 'off'} · test button ${await send.isDisabled() ? 'disabled' : 'enabled'}`);
    if (!enabled) await expect(send, 'While email sending is off, the test email is disabled').toBeDisabled();
  });

  test(...adm('ADM-034'), async ({ page }) => {
    await open(page);
    const s = sec('Notification channel');
    await section(page, s['Tab'], s['Section']);
    const lines = await mainLines(page);
    expect.soft(lines, `Heading ${s['Heading']}`).toContain(s['Heading']);
    for (const l of ['Email Notifications', 'WhatsApp Messaging', 'In-App Push & Bell Notifications']) expect.soft(lines, `Channel ${l}`).toContain(l);
    await expect(at(page, XP.adminButton(s['Save Button'])).first(), `Button ${s['Save Button']}`).toBeVisible();
  });

  test(...adm('ADM-035'), async ({ page }) => {
    await open(page);
    const s = sec('Security');
    await section(page, s['Tab']);
    const nums = await page.locator('main input[type=number]').filter({ visible: true }).evaluateAll(es => es.map(e => Number((e as HTMLInputElement).value)));
    note('session timeout / max failed / lock interval', nums.join(' / '));
    expect.soft(nums.length, 'Three numeric policies').toBe(3);
    expect.soft(nums.filter(n => !(n > 0)), 'All above 0').toEqual([]);
    await expect.soft(page.locator('main input[type=checkbox]').first(), 'MFA is disabled').toBeDisabled();
    expect.soft(await mainLines(page), 'MFA note').toContain('Planned in next release');
    const b = never().find(x => x === s['Save Button'])!;
    await expect(page.locator('main').getByRole('button', { name: b }), `"${b}" is there (never pressed)`).toBeVisible();
  });

  test(...adm('ADM-036'), async ({ page }) => {
    await open(page);
    const s = sec('Operations & ETL');
    await section(page, s['Tab']);
    for (const b of never().filter(x => x.startsWith('Run '))) await expect.soft(page.locator('main').getByRole('button', { name: b, exact: true }), `"${b}" is there (never pressed)`).toBeVisible();
    const text = (await page.locator('main').innerText());
    const logged = Number((text.match(/(\d+) total logged/) ?? ['', 'NaN'])[1]);
    const rows = await page.locator('main table').last().locator('tbody tr').evaluateAll(rs => rs.map(r => [...r.children].map(c => (c as HTMLElement).innerText.replace(/\s+/g, ' ').trim())));
    note('ETL log', `${logged} logged · ${rows.length} rows`);
    expect.soft(rows.length, '"N total logged" = the log rows').toBe(logged);
    expect.soft(rows.filter(r => !r[0] || !r[1] || !r[r.length - 1]).map(r => r.join(' | ')), 'Every row has a type, a status and who ran it').toEqual([]);
    expect(broken(text), 'No broken values').toEqual([]);
  });

  test(...adm('ADM-037'), async ({ page }) => {
    await open(page);
    const s = sec('Application defaults');
    await section(page, s['Tab'], s['Section']);
    const i = pageSizePos();
    const original = await chosenAt(page, i);
    const change = S('Page Size Change');
    test.skip(original === change, `Rows per page is already ${change}`);
    note('rows per page', `${original} → ${change}`);
    const save = async (v: string) => {
      await selects(page).nth(i).selectOption({ label: v });
      await press(at(page, XP.adminButton(s['Save Button'])).first());
      await page.waitForTimeout(1200);
      return shownMessage(page);
    };
    try {
      note('save message', await save(change) || 'none');
      await open(page);
      await section(page, s['Tab'], s['Section']);
      expect.soft(await chosenAt(page, i), 'The choice is kept after a reload').toBe(change);
      const ref = new ModulePage(page, S('Reference Route'));
      await ref.open();
      const n = Number(change.match(/\d+/)![0]);
      await expect.poll(async () => (await ref.rows()).length, { message: `Registers list ${n} rows per page`, timeout: 15_000 }).toBe(n);
    } finally {
      await open(page);
      await section(page, s['Tab'], s['Section']);
      note('restored', `${original}: ${await save(original) || 'no message'}`);
      await open(page);
      await section(page, s['Tab'], s['Section']);
      expect(await chosenAt(page, i), 'The original value is back').toBe(original);
    }
  });
});
