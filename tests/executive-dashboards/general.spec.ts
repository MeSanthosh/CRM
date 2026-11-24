/**
 * Executive Dashboards page, tabs and periods (EXD-001…010). Read only; AI Insights is never clicked.
 * Run: npx playwright test tests/executive-dashboards/general.spec.ts
 */
import { test, expect } from './fixtures';
import { tc, tcRow, S, sheet, note, periodRange, BAD } from './shared';
import { EXD, at } from '../locators';

const TABS = () => sheet('Tabs').map(r => r['Tab']);
const PERIODS = () => sheet('Periods').filter(p => p['Key'] !== 'custom');

test.describe('Executive Dashboards · Page', () => {
  test(...tc('EXD-001'), async ({ dash, page }) => {
    await page.goto(S('Workspace Route'));
    await at(page, EXD.wsButton(S('Executive Button'))).click();
    await expect(page, 'Dashboards open').toHaveURL(new RegExp(`${S('Dashboards Route')}(\\?.*)?$`));
    await dash.ready();
    const user = (await page.locator('.crm-user-menu-text').first().innerText()).split('\n')[0].trim();
    await expect.soft(page.locator(EXD.dashTitle), 'Heading').toHaveText(S('Dashboard Heading'));
    const sub = (await page.locator(EXD.dashSubtitle).first().innerText()).replace(/\s+/g, ' ').trim();
    note('subtitle', sub);
    expect.soft(sub, 'Welcome line').toContain(`${S('Dashboard Welcome')} ${user}!`);
    expect.soft(sub.replace(/\s*·\s*$/, ''), 'No empty separator after the welcome').toBe(sub);
    await expect.soft(page.locator('main'), 'Currency').toContainText(S('Currency Text'));
  });

  test(...tc('EXD-002'), async ({ dash, page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
    await dash.open();
    for (const t of TABS()) {
      await dash.tab(t);
      const text = (await dash.lines()).join('\n');
      expect.soft(text.match(BAD)?.[0] ?? '', `${t}: broken value`).toBe('');
      const empty = await dash.main.evaluate(m => [...m.querySelectorAll('strong, .crm-kpi')].filter(e => !(e as HTMLElement).innerText.trim()).length);
      expect.soft(empty, `${t}: empty figures`).toBe(0);
    }
    const failed = dash.replies.filter(r => r.status >= 400).map(r => `${r.url} → ${r.status}`);
    note('requests', `${dash.replies.length} sent; failed: ${failed.join(' | ') || 'none'}`);
    expect.soft(failed, 'Requests that failed').toEqual([]);
    expect.soft(errors, 'Script errors').toEqual([]);
  });

  test(...tc('EXD-003'), async ({ dash, page }) => {
    await dash.open();
    const tabs = (await page.locator(EXD.dashTabs).allInnerTexts()).map(s => s.trim());
    note('tabs', tabs.join(' | '));
    expect.soft(tabs, 'Tabs').toEqual(TABS());
    expect.soft(await dash.activeTab(), 'Active tab on opening').toBe(S('Default Tab'));
    for (const r of sheet('Tabs')) {
      await dash.tab(r['Tab']);
      expect.soft(await dash.activeTab(), `${r['Tab']} marked active`).toBe(r['Tab']);
      expect.soft((await dash.lines()).some(l => l.toUpperCase().startsWith(r['Unique Text'].toUpperCase())), `${r['Tab']} shows its own content ("${r['Unique Text']}")`).toBeTruthy();
    }
  });

  test(...tc('EXD-004'), async ({ dash }) => {
    await dash.open();
    const opts = await dash.periodOptions();
    note('periods', opts.map(o => `${o.value}=${o.label}`).join(', '));
    expect.soft(opts.map(o => `${o.value}=${o.label}`), 'Periods offered').toEqual(sheet('Periods').map(p => `${p['Key']}=${p['Label']}`));
    const selected = await dash.page.locator(EXD.dashPeriod).first().evaluate(s => (s as HTMLSelectElement).selectedOptions[0]?.text.trim());
    expect.soft(selected, 'Selected on opening').toBe(S('Default Period'));
  });

  let n = 0;
  for (const t of sheet('Tabs')) for (const p of PERIODS()) {
    n++;
    test(...tcRow('EXD-005', n, `${t['Tab']} · ${p['Label']}`, `Loads within 30 s and shows ${p['Label']} figures.`, `Tabs "${t['Tab']}" × Periods "${p['Label']}"`), async ({ dash }) => {
      await dash.open(t['Tab']);
      const t0 = Date.now();
      await dash.page.locator(EXD.dashPeriod).first().selectOption(p['Key']);
      const done = await dash.ready();
      const loading = await dash.loadingText();
      note('result', done ? `loaded in ${Date.now() - t0} ms` : `still "${loading}" after ${Date.now() - t0} ms`);
      expect(done, `${t['Tab']} with ${p['Label']} finishes loading (shown: "${loading}")`).toBeTruthy();
      if (t['Tab'] !== 'Lead & Customer Insights') {
        const r = periodRange(p['Key']);
        const dates = (await dash.lines()).filter(l => /^\d{4}-\d{2}-\d{2}/.test(l) || /→/.test(l));
        note('date lines', [...new Set(dates)].join(' | '));
        const all = await dash.lines();
        const ok = dates.some(d => d.includes(`${r.from} → ${r.to}`)) || (r.from === r.to && all.some(l => l === `On ${r.to}` || l === r.to));
        if (p['Key'] !== 'upto_date') expect.soft(ok, `Tiles show the ${p['Label']} dates (${r.from} → ${r.to})`).toBeTruthy();
      } else {
        expect.soft((await dash.lines()).some(l => /^LEADS CAPTURED$/i.test(l)), 'Cards shown').toBeTruthy();
      }
    });
  }

  test(...tc('EXD-006'), async ({ dash, page }) => {
    await dash.open();
    await page.locator(EXD.dashPeriod).first().selectOption('custom');
    await page.waitForTimeout(800);
    const from = page.locator(EXD.dashDate('From date')), to = page.locator(EXD.dashDate('To date'));
    await expect(from, 'From date shown').toBeVisible();
    await expect(to, 'To date shown').toBeVisible();
    const r = periodRange('this_month');
    expect.soft(await from.inputValue(), 'From = first day of the month').toBe(r.from);
    expect.soft(await to.inputValue(), 'To = today').toBe(r.to);
    await expect.poll(() => dash.replies.some(x => x.url.includes(`fromDate=${r.from}`) && x.url.includes(`toDate=${r.to}`)), { message: 'The request carries From and To', timeout: 15_000 }).toBeTruthy();
    const before = dash.replies.length;
    await from.fill(`${r.to.slice(0, 4)}-12-31`);
    await to.fill(r.from);
    await to.press('Tab');
    await page.waitForTimeout(1500);
    const f2 = await from.inputValue(), t2 = await to.inputValue();
    const sent = dash.replies.slice(before).filter(x => /fromDate=/.test(x.url)).map(x => `${x.url} → ${x.status}`);
    const msg = await page.locator('[role="alert"], .crm-field-error, .crm-notice-dialog').allInnerTexts().catch(() => []);
    note('From after To', `fields ${f2} → ${t2} · requests: ${sent.join(' | ') || 'none'} · message: ${msg.join(' | ') || 'none'}`);
    expect.soft(f2 <= t2 || msg.length > 0, 'A From date after To is refused or corrected').toBeTruthy();
  });

  test(...tc('EXD-007'), async ({ dash }) => {
    for (const key of ['this_month', 'this_year']) {
      await dash.open(S('Default Tab'), key);
      const r = periodRange(key);
      const tile = await dash.tile('TOTAL LEADS');
      note(key, `${tile?.lines.join(' · ')}`);
      expect.soft(tile?.lines.join(' ') ?? '', `${key}: tile dates`).toContain(`${r.from} → ${r.to}`);
    }
  });

  test(...tc('EXD-008'), async ({ dash, page }) => {
    await dash.open();
    const badge = (await page.locator(EXD.dashAsOf).first().innerText()).replace(/\s+/g, ' ').trim();
    const snap = dash.api.snapshot;
    note('as of', `${badge} · API asOfDate ${snap?.asOfDate} refreshedAt ${snap?.refreshedAt}`);
    const today = periodRange('today').to;
    const d = new Date(`${today}T00:00:00`);
    const shownDay = `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })} ${d.getFullYear()}`;
    expect.soft(badge, 'As-of date is today').toContain(shownDay);
    expect.soft(snap?.asOfDate, 'API date of the figures is today').toBe(today);
  });

  test(...tc('EXD-009'), async ({ dash, page }) => {
    test.setTimeout(600_000);
    for (const q of sheet('Quick Actions')) {
      await dash.open();
      const a = at(page, EXD.quickAction(q['Label']));
      expect.soft(await a.getAttribute('href'), `${q['Label']} link`).toBe(q['Route']);
      await a.click();
      await page.waitForLoadState('networkidle').catch(() => {});
      expect.soft(new URL(page.url()).pathname, `${q['Label']} opens ${q['Route']}`).toBe(q['Route']);
      const text = await page.locator('main').innerText().catch(() => '');
      expect.soft(/not found|something went wrong/i.test(text) || text.length < 50, `${q['Label']}: page loads`).toBeFalsy();
    }
  });

  test(...tc('EXD-010'), async ({ dash }) => {
    for (const tab of ['Commercial / Sales', 'Monthly Sales & Marketing']) {
      await dash.open(tab);
      const r = periodRange('this_month');
      for (const t of sheet('Tiles').filter(x => x['Tab'] === tab)) {
        const tile = await dash.tile(t['Label']);
        expect.soft(tile?.tooltip ?? '', `${tab} › ${t['Label']}: tooltip explains it`).not.toBe('');
        if (tile?.tooltip && t['Scope'] === 'period' && !t['Source'].startsWith('calc:')) expect.soft(tile.tooltip, `${t['Label']}: tooltip uses the period`).toMatch(new RegExp(`${r.from}|${r.to}`));
      }
    }
  });
});
