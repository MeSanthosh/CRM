/**
 * Currency Master (ADM-001 … ADM-009): cards, tabs, register, New / Edit forms, Policy and Exchange Rates.
 * Nothing is saved: forms are read and cancelled, and only an empty New Currency is submitted.
 * Run: npx playwright test tests/admin-governance/currencies.spec.ts
 */
import { test, expect, note, adm, S, list, never, fieldsOf, bad, cardText, setCheck, WAIT } from './shared';
import { ModalForm } from '../pages/SalesPages';
import { watchWrites } from '../pages/PricingMatrixPage';
import { XP, at } from '../locators';
import type { Page } from '@playwright/test';

const tab = async (page: Page, name: string) => {
  await at(page, XP.admTab(name)).first().dispatchEvent('click');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(800);
};

test.describe('Admin & Governance · Currency Master', () => {
  test.describe.configure({ timeout: 300_000 });

  test(...adm('ADM-001'), async ({ cur, page }) => {
    await cur.open();
    const c = { all: await cardText(page, 'Currencies'), active: await cardText(page, 'Active'), pay: await cardText(page, 'Payment'), contract: await cardText(page, 'Contract') };
    note('cards', JSON.stringify(c));
    const total = await cur.pagerTotal();
    const rows = await cur.allRows();
    expect.soft(Number(c.all), 'Currencies card = register total').toBe(total);
    expect.soft(Number(c.pay), 'Payment card = currencies with the Payment role').toBe(rows.filter(r => (r.cells['Policy Roles'] ?? '').includes(S('Payment Word'))).length);
    const base = rows.find(r => (r.cells['Policy Roles'] ?? '').split(' | ').includes(S('Base Word')));
    expect.soft(c.contract, 'Contract card = the Base currency').toBe(base?.lines[0]);
    await setCheck(page, S('Active Only'), true);
    expect(Number(c.active), 'Active card = register total with Active only').toBe(await cur.pagerTotal());
  });

  test(...adm('ADM-002'), async ({ cur, page }) => {
    await cur.open();
    const badge = async (n: string) => Number(((await at(page, XP.admTab(n)).first().innerText()).match(/\d+/) ?? ['NaN'])[0]);
    const curN = await badge(S('Currencies Tab')), rateN = await badge(S('Rates Tab'));
    expect.soft(curN, 'Currencies tab count = register total').toBe(await cur.pagerTotal());
    await tab(page, S('Policy Tab'));
    await expect.soft(page.locator(`main [name="baseCurrencyCode"]`), 'Policy tab opens').toBeVisible();
    await tab(page, S('Rates Tab'));
    note('tab counts', `${curN} / ${rateN}`);
    expect(rateN, 'Exchange Rates tab count = rate register total').toBe(await cur.pagerTotal());
  });

  test(...adm('ADM-003'), async ({ cur, page }) => {
    await cur.open();
    const rows = await cur.rows();
    const r = rows[Math.floor(rows.length / 2)];
    const [code, symbol, ...rest] = r.lines;
    const name = rest[rest.length - 1 - 0] && r.cells['Currency'].split(' | ').pop()!;
    for (const term of [code, name, symbol]) {
      await cur.search(S('Currency Search'), term);
      const shown = await cur.rows();
      note(`search ${term}`, `${shown.length} rows`);
      expect.soft(shown.some(x => x.lines[0] === code), `Search "${term}" lists ${code}`).toBeTruthy();
      expect.soft(shown.filter(x => !x.text.toLowerCase().includes(term.toLowerCase())).map(x => x.lines[0]), `Every row contains "${term}"`).toEqual([]);
    }
    await cur.search(S('Currency Search'), '');
    await setCheck(page, S('Active Only'), true);
    const active = await cur.allRows();
    expect(active.filter(x => !x.text.includes(S('Active Status'))).map(x => x.lines[0]), 'Active only lists only ACTIVE').toEqual([]);
  });

  test(...adm('ADM-004'), async ({ cur, page }) => {
    const writes = watchWrites(page);
    await cur.open();
    const form = new ModalForm(page);
    await form.open('New Currency');
    for (const f of fieldsOf('Currency')) await expect.soft(form.field(f['Field Name']), `Field ${f['Field Label']}`).toBeAttached();
    const text = await form.text();
    for (const f of fieldsOf('Currency').filter(x => x['Mandatory'] === 'Yes')) expect.soft(text, `${f['Field Label']} is marked *`).toContain(`${f['Field Label']} *`);
    await form.close();
    expect(writes.map(w => w.url), 'Cancel saves nothing').toEqual([]);
  });

  test(...adm('ADM-005'), async ({ cur, page }) => {
    const writes = watchWrites(page);
    await cur.open();
    const before = await cur.pagerTotal();
    const form = new ModalForm(page);
    await form.open('New Currency');
    const r = await form.submit(S('Create Currency Button'), { wait: 10_000 });
    note('empty save', `${r.notice?.text ?? 'no message'} · ${writes.map(w => `${w.method} ${w.status}`).join(', ') || 'nothing sent'}`);
    expect.soft(r.notice?.text ?? '', 'A message says what is required').not.toBe('');
    expect.soft(writes.filter(w => w.status < 300).map(w => w.url), 'Nothing is created').toEqual([]);
    await form.closeNotice();
    await form.close();
    await cur.open();
    expect(await cur.pagerTotal(), 'Register total unchanged').toBe(before);
  });

  test(...adm('ADM-006'), async ({ cur, page }) => {
    const writes = watchWrites(page);
    await cur.open();
    const rows = await cur.rows();
    const r = rows.find(x => !(x.cells['Policy Roles'] ?? '').includes(S('Base Word'))) ?? rows[0];
    await cur.rowAction(r, S('Edit Button'));
    const form = new ModalForm(page);
    await expect(form.root, 'Edit form opens').toBeVisible();
    const code = r.lines[0];
    expect.soft(await form.heading(), 'Heading').toContain(code);
    expect.soft(await form.value('currencyCode'), 'Code').toBe(code);
    expect.soft(r.cells['Currency'], 'Name of the row').toContain(await form.value('currencyName'));
    expect.soft(await form.value('decimalPlaces'), 'Decimals').toBe(r.cells['Decimals']);
    expect.soft(await form.selected('status'), 'Status').toBe(r.cells['Status'].charAt(0) + r.cells['Status'].slice(1).toLowerCase());
    await form.close();
    expect(writes.map(w => w.url), 'Cancel saves nothing').toEqual([]);
  });

  test(...adm('ADM-007'), async ({ cur, page }) => {
    await cur.open();
    const contract = await cardText(page, 'Contract');
    const rows = await cur.allRows();
    await tab(page, S('Policy Tab'));
    const base = (await page.locator('main [name="baseCurrencyCode"] option:checked').textContent())?.trim() ?? '';
    const name = await page.locator('main [name="policyName"]').inputValue();
    const status = (await page.locator('main [name="status"] option:checked').textContent())?.trim();
    note('policy', `${base} · ${name} · ${status}`);
    expect.soft(base.startsWith(`${contract} `), `Core Operating Currency "${base}" = Contract card ${contract}`).toBeTruthy();
    expect.soft(rows.find(r => (r.cells['Policy Roles'] ?? '').split(' | ').includes(S('Base Word')))?.lines[0], 'Base role in the register').toBe(contract);
    expect.soft(name, 'Policy name').not.toBe('');
    expect.soft(status, 'Policy status').toBeTruthy();
    const b = never().find(x => x.startsWith('Save Policy'))!;
    await expect(page.locator('main').getByRole('button', { name: b, exact: true }), `"${b}" is there (never pressed)`).toBeVisible();
  });

  test(...adm('ADM-008'), async ({ cur, page }) => {
    await cur.open();
    await tab(page, S('Rates Tab'));
    const rows = await cur.allRows();
    note('rates', `${rows.length} · ${rows.slice(0, 3).map(r => r.text).join(' || ')}`);
    expect.soft(rows.length, 'Rates are listed').toBeGreaterThan(0);
    const wrong = rows.filter(r => !/^[A-Z]{3} to [A-Z]{3}$/.test(r.lines[0]) || !(Number(r.cells['Rate']) > 0)).map(r => `${r.lines[0]} rate ${r.cells['Rate']}`);
    expect.soft(bad(wrong), 'Every row is "<code> to <code>" with a rate above 0').toBe('');
    const pair = rows[0].lines[0];
    await cur.search(S('Rate Search'), pair);
    const shown = await cur.rows();
    expect.soft(shown.filter(x => !x.text.includes(pair)).map(x => x.lines[0]), `Search lists only ${pair}`).toEqual([]);
    await cur.search(S('Rate Search'), '');
    await setCheck(page, S('Active Rates Only'), true);
    const act = await cur.allRows();
    expect.soft(act.filter(x => /inactive|superseded|expired/i.test(x.cells['Status'] ?? '')).map(x => x.lines[0]), 'Active Rates only lists no inactive rate').toEqual([]);
    const b = list(S('Never Click')).find(x => x.includes('Get Latest'))!;
    await expect(page.locator('main').getByRole('button', { name: b, exact: true }), `"${b}" is there (never pressed)`).toBeVisible();
  });

  test(...adm('ADM-009'), async ({ cur, page }) => {
    const writes = watchWrites(page);
    await cur.open();
    const contract = await cardText(page, 'Contract');
    await tab(page, S('Rates Tab'));
    const form = new ModalForm(page);
    await form.open('➕ Add Exchange Rate');
    for (const f of fieldsOf('Rate')) await expect.soft(form.field(f['Field Name']), `Field ${f['Field Label']}`).toBeAttached();
    expect.soft(await form.text(), 'Formula line').toContain(S('Rate Formula'));
    expect.soft((await form.selected('toCurrencyCode')).startsWith(`${contract} `), 'To Currency starts on the base currency').toBeTruthy();
    await form.close();
    await form.open('⚙️ Rate Settings');
    expect.soft(await form.text(), 'Provider URL').toContain('Rate Provider');
    await form.close();
    await page.waitForTimeout(Math.min(WAIT(), 500));
    expect(writes.map(w => w.url), 'Cancel saves nothing').toEqual([]);
  });
});
