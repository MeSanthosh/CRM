/**
 * Cross-checks and UI/UX (EXD-066…071): one figure in several places, workspace vs dashboards, font size, widths, speed,
 * keyboard. Read only. Run: npx playwright test tests/executive-dashboards/cross.spec.ts
 */
import { test, expect } from './fixtures';
import { tc, tcRow, sheet, note, N, S, shown, expectSameShown } from './shared';
import { EXD } from '../locators';
import type { DashboardsPage } from './DashboardsPage';

/** Reads "Tab › tile", "Tab › table › row › column" or "Tab › section › line" (value after that line). */
async function read(dash: DashboardsPage, src: string, figure: string): Promise<string> {
  const [tab, ...rest] = src.split('›').map(s => s.trim());
  if ((await dash.activeTab()) !== tab) await dash.tab(tab);
  if (rest.length === 1) return dash.tileValue(rest[0]);
  if (rest.length === 3) return (await dash.table(rest[0])).get(rest[1], rest[2]) ?? '';
  const ls = await dash.section(rest[0]);
  const i = ls.findIndex(l => l.toUpperCase() === rest[1].toUpperCase());
  const after = ls.slice(i + 1);
  return i < 0 ? '' : (/achievement/i.test(figure) ? after.find(l => /%$/.test(l)) : after.find(l => /\d/.test(l))) ?? '';
}

test.describe('Executive Dashboards · Cross-check and UI', () => {
  sheet('Same Figures').forEach((r, i) => {
    test(...tcRow('EXD-066', i + 1, r['Figure'], `${r['Figure']} is the same everywhere.`, `Same Figures "${r['Figure']}"`), async ({ dash }) => {
      await dash.open(S('Default Tab'), 'this_month');
      const sources = r['Sources'].split('|').map(s => s.trim());
      const vals: string[] = [];
      for (const s of sources) vals.push(await read(dash, s, r['Figure']));
      note('values', sources.map((s, j) => `${s}: "${vals[j]}"`).join(' | '));
      vals.forEach((x, j) => expect.soft(x, `${sources[j]} is shown`).not.toBe(''));
      for (let j = 1; j < vals.length; j++) expectSameShown(vals[0], vals[j], `${r['Figure']}: ${sources[0]} vs ${sources[j]}`);
    });
  });

  test(...tc('EXD-067'), async ({ ws, dash }) => {
    await ws.open();
    const leads = await ws.findCard(0, 'Leads'), opp = await ws.findCard(0, 'Opportunities'), inv = await ws.findCard(0, 'Inventory');
    await dash.open('Lead & Customer Insights', 'this_month');
    const d = { active: await dash.tileValue('Active Leads'), open: await dash.tileValue('Open Opportunities') };
    await dash.tab('Monthly Sales & Marketing');
    const m = { total: await dash.tileValue('TOTAL INVENTORY'), avail: await dash.tileValue('UNITS AVAILABLE'), res: await dash.tileValue('UNITS RESERVED') };
    note('workspace / dashboards', `${leads?.num}, ${opp?.num}, ${inv?.num} · ${inv?.sub} / ${JSON.stringify({ ...d, ...m })}`);
    if (leads) expectSameShown(leads.num, d.active, 'Active leads');
    if (opp) expectSameShown(opp.num, d.open, 'Open deals');
    if (inv) {
      expectSameShown(inv.num, m.total, 'Total units');
      expectSameShown(inv.sub.match(/([\d,]+)\s*available/)?.[1], m.avail, 'Available units');
      expectSameShown(inv.sub.match(/([\d,]+)\s*reserved/)?.[1], m.res, 'Reserved units');
    }
  });

  test(...tc('EXD-068'), async ({ dash }) => {
    test.setTimeout(300_000);
    const min = N('Min Font Px');
    for (const tab of ['Commercial / Sales', 'Monthly Sales & Marketing']) {
      await dash.open(tab);
      const labels = sheet('Tiles').filter(t => t['Tab'] === tab).map(t => t['Label']);
      const sizes = await dash.main.evaluate((root, labels) => labels.map(l => {
        const e = [...root.querySelectorAll('*')].find(x => [...x.childNodes].some(n => n.nodeType === 3 && n.textContent?.trim().toUpperCase() === l));
        const date = e?.parentElement?.querySelector('div:last-child');
        return { label: l, label_px: e ? parseFloat(getComputedStyle(e).fontSize) : NaN, sub_px: date ? parseFloat(getComputedStyle(date).fontSize) : NaN };
      }), labels);
      note(tab, sizes.map(s => `${s.label} ${s.label_px}px / ${s.sub_px}px`).join(' | '));
      for (const s of sizes) {
        expect.soft(s.label_px, `${tab} › ${s.label}: label at least ${min} px`).toBeGreaterThanOrEqual(min);
        if (!Number.isNaN(s.sub_px)) expect.soft(s.sub_px, `${tab} › ${s.label}: line under the figure at least ${min} px`).toBeGreaterThanOrEqual(min);
      }
    }
  });

  test(...tc('EXD-069'), async ({ dash, page }) => {
    test.setTimeout(600_000);
    for (const vp of sheet('Viewports')) {
      await page.setViewportSize({ width: Number(vp['Width']), height: Number(vp['Height']) });
      for (const t of sheet('Tabs')) {
        await dash.open(t['Tab']);
        const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
        note(`${vp['Name']} · ${t['Tab']}`, `page ${r.sw}px in ${r.w}px`);
        expect.soft(r.sw, `${vp['Name']} › ${t['Tab']}: no sideways scrolling`).toBeLessThanOrEqual(r.w + 1);
      }
    }
  });

  test(...tc('EXD-070'), async ({ dash }) => {
    await dash.open();
    for (const t of sheet('Tabs')) {
      const t0 = Date.now();
      await dash.tab(t['Tab']);
      await expect(dash.main.getByText(new RegExp(`^${t['Unique Text'].replace(/[.()]/g, m => `\\${m}`)}`, 'i')).first()).toBeVisible({ timeout: N('Load Wait Ms') });
      const ms = Date.now() - t0;
      note(t['Tab'], `${ms} ms`);
      expect.soft(ms, `${t['Tab']} ready within ${N('Load Budget Ms')} ms`).toBeLessThanOrEqual(N('Load Budget Ms'));
    }
  });

  test(...tc('EXD-071'), async ({ dash, page }) => {
    await dash.open();
    const tabs = page.locator(EXD.dashTabs);
    const info = await tabs.evaluateAll(bs => bs.map(b => ({ text: (b as HTMLElement).innerText.trim(), role: b.getAttribute('role'), selected: b.getAttribute('aria-selected'), pressed: b.getAttribute('aria-pressed'), tabindex: (b as HTMLElement).tabIndex })));
    const sel = page.locator(EXD.dashPeriod).first();
    const selName = await sel.evaluate(s => s.getAttribute('aria-label') || (s.id && document.querySelector(`label[for="${s.id}"]`)?.textContent) || s.closest('label')?.textContent || '');
    note('tabs / period', `${JSON.stringify(info)} · period name "${selName}"`);
    for (const b of info) expect.soft(b.tabindex, `${b.text}: reachable with the keyboard`).toBeGreaterThanOrEqual(0);
    const active = info.find(b => b.text === S('Default Tab'));
    expect.soft(active?.selected === 'true' || active?.pressed === 'true', 'Active tab is marked for screen readers (aria-selected / aria-pressed)').toBeTruthy();
    expect.soft(selName.trim(), 'Report Period list has an accessible name').not.toBe('');
    await tabs.nth(0).focus();
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => (document.activeElement as HTMLElement)?.innerText?.trim() ?? '');
    expect.soft(focused, 'Tab key moves to the next tab').toBe(info[1]?.text);
    await page.keyboard.press('Enter');
    await dash.ready();
    expect.soft(await dash.activeTab(), 'Enter opens the focused tab').toBe(info[1]?.text);
    void shown;
  });
});
