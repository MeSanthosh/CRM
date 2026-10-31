/**
 * Common checks of a report-module workbook. declareCommon() declares one test for every Test Cases row whose
 * "Automation key" is a common key (general:…, tabs:…, views:…, period:…, custom:…, filter:…, filters:…, cards:…,
 * table:…, nf:…), driven by the page's ModuleConfig. Every expected value is read from the page itself.
 */
import 'dotenv/config';
import { test, expect, note } from '../pages/fixtures';
import type { Pages } from '../pages/fixtures';
import type { Page as PwPage } from '@playwright/test';
import { num, sum } from '../helpers';
import { XP, at } from '../locators';
import { PERIODS, MODULE_TABS, ReportModulePage } from '../pages/ReportModulePage';
import type { ReportsHubPage } from '../pages/ReportsHubPage';
import { opensFromHub } from '../modules/checks';
import { ERROR_TEXT } from '../scenarios/support';
import type { Workbook } from './catalog';
import { ModuleConfig, TableConfig, additiveCards } from './config';
import { NAMED_PERIODS, previousMonth, futureRange, todayInFileName, shownTolerance, sameCell, isBlank, expectNothingHappens, expectRequest } from './helpers';
import { ymd } from '../helpers';

type Ctx = { m: ReportModulePage; page: PwPage; hub: ReportsHubPage };
type Check = (cfg: ModuleConfig, c: Ctx) => Promise<void>;
type Snap = Record<string, number>;

const BAD = /^\s*$|NaN|undefined|Infinity/;
const BUDGET = Number(process.env.PERF_BUDGET_MS ?? 5000);
const SIZES = { tablet: { width: 768, height: 1024 }, phone: { width: 390, height: 844 } };
const NO_AUTH = { cookies: [], origins: [] };
const FORMATS: Record<string, RegExp> = {
  count: /^-?\d[\d,]*$/, money: /^(-?\d[\d,]*(\.\d+)?\s?[KMB]?\s?USD|—)$/, percent: /^(-?\d[\d,]*(\.\d+)?%|—)$/,
  number: /^(-?\d[\d,]*(\.\d+)?|—)$/, days: /^(-?\d+(\.\d+)?\s?d|—)$/,
};

// ── shared reads ────────────────────────────────────────────────────────────
/** Cards that follow the period and add up (counts and summed amounts). */
const periodCounts = (cfg: ModuleConfig) => cfg.cards.filter(c => (c.kind === 'count' || c.sum) && c.period).map(c => c.label);
const fixedCards = (cfg: ModuleConfig) => cfg.cards.filter(c => !c.period).map(c => c.label);
const mainCount = (cfg: ModuleConfig) => cfg.main ?? periodCounts(cfg)[0] ?? additiveCards(cfg)[0];

async function snapshot(cfg: ModuleConfig, m: ReportModulePage): Promise<Snap> {
  const shown = await m.shownAll();
  return Object.fromEntries(additiveCards(cfg).map(k => [k, isBlank(shown[k]) ? 0 : num(shown[k])]));
}

function expectNarrower(narrow: Snap, wide: Snap, what: string) {
  for (const k of Object.keys(wide)) expect.soft(narrow[k], `${what}: ${k} ${narrow[k]} ≤ ${wide[k]}`).toBeLessThanOrEqual(wide[k] * 1.005 + 1e-9); // amounts are shown rounded
}

/** Total row cells that equal a card, per the config (counts exact, amounts / % within display rounding). */
async function expectTablesMatchCards(cfg: ModuleConfig, m: ReportModulePage, where: string) {
  const shown = await m.shownAll();
  for (const t of cfg.tables.filter(t => t.total && t.cards)) {
    const total = await m.table(t.heading).total();
    for (const [col, card] of Object.entries(t.cards!)) {
      if (!total) { expect.soft(num(shown[card] === '—' ? '0' : shown[card]), `${where}: ${t.heading} has no Total row, so ${card} is 0`).toBe(0); continue; }
      const a = total[col], b = shown[card];
      if (isBlank(a) || isBlank(b)) { expect.soft(isBlank(a) === isBlank(b) || num(isBlank(a) ? b : a) === 0, `${where}: ${t.heading} Total ${col} "${a}" vs ${card} "${b}"`).toBeTruthy(); continue; }
      expect.soft(Math.abs(num(a) - num(b)), `${where}: ${t.heading} Total ${col} ${a} = ${card} ${b}`).toBeLessThanOrEqual(shownTolerance(a) + shownTolerance(b) + 1e-9);
    }
  }
}

/** Options of a filter as { label, index } (index 1 = first after "All …"). */
async function options(m: ReportModulePage, all: string) {
  return (await m.filterOptions(all)).map((label, i) => ({ label, index: i + 1 }));
}

/** The option of a filter with the highest main count, and that count. */
async function busiest(cfg: ModuleConfig, m: ReportModulePage, all: string) {
  let best: { label: string; index: number; n: number } | undefined;
  for (const o of await options(m, all)) {
    await m.setFilterIndex(all, o.index);
    const n = num(await m.shown(mainCount(cfg)));
    if (!best || n > best.n) best = { ...o, n };
  }
  await m.setFilterIndex(all, 0);
  return best;
}

/** Every table's rows as shown (for comparing two states of the page). */
async function tableTexts(cfg: ModuleConfig, m: ReportModulePage) {
  const out: Record<string, string[]> = {};
  for (const t of cfg.tables) out[t.heading] = (await m.table(t.heading).root.count()) ? (await m.table(t.heading).rows()).map(r => Object.values(r).join(' | ')) : [];
  return out;
}

// ── checks by key ───────────────────────────────────────────────────────────
const C: Record<string, Check> = {
  'general:hub': async (cfg, { m, hub }) => {
    await opensFromHub(hub, m);
    await expect.soft(m.page.locator('main'), 'Intro text').toContainText(cfg.intro);
  },
  'general:url': async (cfg, { m }) => {
    m.watchErrors();
    await m.open();
    for (const k of m.kpiLabels) expect.soft(await m.shown(k), k).not.toMatch(/^\s*$|NaN|undefined/);
    for (const t of cfg.tables) await expect.soft(m.page.locator(`xpath=${XP.reportPanel(t.heading)}`), t.heading).toBeVisible();
    await m.expectNoBrokenValues();
    m.expectNoErrors();
  },
  'general:breadcrumb': async (_cfg, { m }) => { await m.open(); await m.backToHub(); },
  'general:errors': async (cfg, { m }) => {
    m.watchErrors();
    await m.open();
    await m.setPeriod('this_month');
    await m.setFilterIndex(cfg.filters[0].all, 1);
    await m.setView('Mine');
    await m.setView('All');
    m.expectNoErrors();
  },
  'general:currency': async (cfg, { m }) => {
    await m.open();
    await expect.soft(m.page.locator('main'), 'Intro').toContainText('Values in base currency');
    for (const c of cfg.cards.filter(c => c.kind === 'money')) expect.soft(await m.shown(c.label), c.label).toMatch(FORMATS.money);
    await m.expectNoBrokenValues();
  },
  'tabs:list': async (cfg, { m }) => {
    await m.open();
    expect(await m.moduleTabLabels(), 'Tabs in order').toEqual(Object.keys(MODULE_TABS));
    await expect(m.moduleTab(m.tabLabel!), `${m.tabLabel} is active`).toHaveClass(/is-active/);
  },
  'tabs:open': async (_cfg, { m, page }) => {
    for (const [tab, path] of Object.entries(MODULE_TABS).filter(([t]) => t !== m.tabLabel)) {
      await m.open();
      await m.moduleTab(tab).click();
      await expect.soft(page, `${tab} opens ${path}`).toHaveURL(new RegExp(`${path}(\\?.*)?$`));
    }
  },
  'tabs:back': async (_cfg, { m, page }) => {
    await m.open();
    const other = m.tabLabel === 'Sales' ? 'Inventory' : 'Sales';
    await m.moduleTab(other).click();
    await expect(page).toHaveURL(new RegExp(MODULE_TABS[other]));
    await page.goBack();
    await expect(page, 'Back returns to the report').toHaveURL(new RegExp(`${m.path}(\\?.*)?$`));
    await expect(m.heading()).toBeVisible();
  },
  'views:buttons': async (_cfg, { m }) => {
    await m.open();
    for (const v of ['All', 'You and your team', 'Mine'] as const) await expect.soft(m.viewButton(v), v).toBeEnabled();
    await expect(m.viewButton('All'), 'All is active for the administrator').toHaveClass(/is-active/);
  },
  'views:team': async (cfg, { m }) => {
    await m.openWith('last_12_months');
    const all = await snapshot(cfg, m);
    await expectRequest(m, cfg.api, /view=team/, () => m.setView('You and your team'));
    const team = await snapshot(cfg, m);
    note('values', `All ${JSON.stringify(all)} | You and your team ${JSON.stringify(team)}`);
    expectNarrower(team, all, 'You and your team ≤ All');
    await expectTablesMatchCards(cfg, m, 'You and your team');
  },
  'views:mine': async (cfg, { m }) => {
    await m.openWith('last_12_months');
    await m.setView('You and your team');
    const team = await snapshot(cfg, m);
    await expectRequest(m, cfg.api, /view=self/, () => m.setView('Mine'));
    const mine = await snapshot(cfg, m);
    note('values', `You and your team ${JSON.stringify(team)} | Mine ${JSON.stringify(mine)}`);
    expectNarrower(mine, team, 'Mine ≤ You and your team');
    await expectTablesMatchCards(cfg, m, 'Mine');
  },
  'views:all': async (_cfg, { m }) => {
    await m.openWith('last_12_months');
    const all = await m.shownAll();
    await m.setView('Mine');
    await m.setView('All');
    expect(await m.shownAll()).toEqual(all);
  },
  'views:mine-salesperson': async (cfg, { m }) => {
    const sp = cfg.filters.find(f => f.label === 'Salesperson');
    test.skip(!sp, 'No Salesperson filter');
    await m.openWith('last_12_months');
    const user = await m.signedInUser();
    const match = (await options(m, sp!.all)).filter(o => o.label === user);
    test.skip(match.length !== 1, `Signed-in user "${user}" is not exactly once in the Salesperson list`);
    await m.setView('Mine');
    const mine = await m.shownAll();
    await m.setView('All');
    await m.setFilterIndex(sp!.all, match[0].index);
    const filtered = await m.shownAll();
    note('values', `${user}: Mine ${JSON.stringify(mine)} | Salesperson filter ${JSON.stringify(filtered)}`);
    expect(filtered, `Mine = Salesperson "${user}"`).toEqual(mine);
  },
  'period:options': async (cfg, { m }) => {
    await m.open();
    await expect(m.page.locator('main label').filter({ has: m.periodSelect }), 'Label').toContainText(cfg.periodLabel);
    expect(await m.periodOptions()).toEqual([...PERIODS]);
  },
  'period:default': async (_cfg, { m }) => {
    await m.open();
    expect(await m.period(), 'Default period').toBe('this_month');
  },
  'period:reload': async (cfg, { m }) => {
    await m.open();
    const seen: string[] = [];
    // a period already loaded is served from the app's cache, so only the first visit sends a request
    const loaded = new Set([await m.period()]);
    for (const p of NAMED_PERIODS) {
      const req = m.page.waitForRequest(r => r.url().includes(cfg.api) && r.url().includes(`period=${p}`), { timeout: 10_000 }).catch(() => null);
      await m.setPeriod(p);
      const sent = await req;
      if (!loaded.has(p)) expect.soft(sent, `${p}: request sent`).not.toBeNull();
      loaded.add(p);
      const shown = await m.shownAll();
      seen.push(`${p}: ${mainCount(cfg)} ${shown[mainCount(cfg)]}`);
      for (const [k, v] of Object.entries(shown)) expect.soft(v, `${p} › ${k}`).not.toMatch(BAD);
    }
    note('periods', seen.join(' | '));
  },
  'period:follows': async (cfg, { m }) => {
    await m.open();
    const by: Record<string, Snap> = {};
    for (const p of NAMED_PERIODS) { await m.setPeriod(p); by[p] = await snapshot(cfg, m); }
    const month = new Date().getMonth();
    for (const k of periodCounts(cfg)) {
      const n = Object.fromEntries(NAMED_PERIODS.map(p => [p, by[p][k]]));
      note(k, JSON.stringify(n));
      if (cfg.futurePeriods) {
        // due dates: This month / This quarter run to their end (future instalments), so only past periods nest
        expect.soft(n.this_month, `${k}: This month ≤ This quarter`).toBeLessThanOrEqual(n.this_quarter * 1.005);
        expect.soft(n.last_month, `${k}: Last month ≤ Last 12 months`).toBeLessThanOrEqual(n.last_12_months * 1.005);
        expect.soft(n.last_quarter, `${k}: Last quarter ≤ Last 12 months`).toBeLessThanOrEqual(n.last_12_months * 1.005);
        if (month >= 3) expect.soft(n.last_quarter, `${k}: Last quarter ≤ Year to date`).toBeLessThanOrEqual(n.ytd * 1.005);
        continue;
      }
      expect.soft(n.this_month, `${k}: This month ≤ This quarter`).toBeLessThanOrEqual(n.this_quarter);
      expect.soft(n.this_quarter, `${k}: This quarter ≤ Year to date`).toBeLessThanOrEqual(n.ytd);
      expect.soft(n.ytd, `${k}: Year to date ≤ Last 12 months`).toBeLessThanOrEqual(n.last_12_months);
      expect.soft(n.last_month, `${k}: Last month ≤ Last 12 months`).toBeLessThanOrEqual(n.last_12_months);
      expect.soft(n.last_quarter, `${k}: Last quarter ≤ Last 12 months`).toBeLessThanOrEqual(n.last_12_months);
      if (month >= 3) expect.soft(n.last_quarter + n.this_quarter, `${k}: Last + this quarter ≤ Year to date`).toBeLessThanOrEqual(n.ytd);
      if (month >= 1) expect.soft(n.last_month + n.this_month, `${k}: Last + this month ≤ Year to date`).toBeLessThanOrEqual(n.ytd);
      if (month % 3 !== 0) expect.soft(n.last_month + n.this_month, `${k}: Last + this month ≤ This quarter`).toBeLessThanOrEqual(n.this_quarter);
    }
  },
  'period:fixed': async (cfg, { m }) => {
    await m.open();
    const by: Record<string, Record<string, string>> = {};
    for (const p of NAMED_PERIODS) { await m.setPeriod(p); by[p] = await m.shownAll(); }
    const first = by[NAMED_PERIODS[0]];
    note('fixed cards', fixedCards(cfg).map(k => `${k} ${first[k]}`).join(' | '));
    for (const p of NAMED_PERIODS.slice(1)) for (const k of fixedCards(cfg)) expect.soft(by[p][k], `${k}: ${p} = ${NAMED_PERIODS[0]}`).toBe(first[k]);
  },
  'custom:fields': async (_cfg, { m }) => {
    await m.open();
    await expect(m.fromInput).toHaveCount(0);
    await m.setPeriod('custom');
    await expect(m.fromInput).toBeVisible();
    await expect(m.toInput).toBeVisible();
  },
  'custom:previous-month': async (cfg, { m }) => {
    const [from, to] = previousMonth();
    await m.openWith('last_month');
    const cards = await m.shownAll();
    const tables = await tableTexts(cfg, m);
    await m.setCustomRange(from, to);
    note('range', `${from} → ${to}: ${mainCount(cfg)} ${await m.shown(mainCount(cfg))} (Last month ${cards[mainCount(cfg)]})`);
    expect.soft(await m.shownAll(), 'Cards = Last month').toEqual(cards);
    expect.soft(await tableTexts(cfg, m), 'Tables = Last month').toEqual(tables);
  },
  'custom:invalid': async (_cfg, { m, page }) => {
    const [from, to] = previousMonth();
    await m.open();
    await m.setPeriod('custom');
    const sent: string[] = [];
    page.on('request', r => { if (r.url().includes('period=custom')) sent.push(r.url()); });
    await m.fromInput.fill(to);
    await m.toInput.fill(from);
    await page.waitForLoadState('networkidle').catch(() => {});
    const invalid = sent.filter(u => (u.match(/from=([\d-]+)/)?.[1] ?? '') > (u.match(/to=([\d-]+)/)?.[1] ?? '~'));
    expect.soft(invalid, 'No request with From after To').toEqual([]);
    await expect(m.dateError, 'Validation message').toContainText('To on or after From');
  },
  'custom:future': async (cfg, { m }) => {
    await m.openWith('last_12_months');
    const before = await m.shownAll();
    // due-date reports have instalments due next year, so "no activity" uses a range long past
    await m.setCustomRange(...(cfg.futurePeriods ? ['2000-01-01', '2000-01-31'] as [string, string] : futureRange()));
    const after = await m.shownAll();
    for (const k of periodCounts(cfg)) expect.soft(num(after[k]), `${k} is 0`).toBe(0);
    for (const k of fixedCards(cfg)) expect.soft(after[k], `${k} unchanged`).toBe(before[k]);
    await m.expectNoBrokenValues();
  },
  'filters:combine': async (cfg, { m }) => {
    test.setTimeout(240_000);
    const [a, b] = cfg.filters;
    await m.openWith('last_12_months');
    const pa = (await busiest(cfg, m, a.all))!, pb = (await busiest(cfg, m, b.all))!;
    await m.setFilterIndex(a.all, pa.index);
    const sa = await snapshot(cfg, m);
    await m.setFilterIndex(a.all, 0);
    await m.setFilterIndex(b.all, pb.index);
    const sb = await snapshot(cfg, m);
    await m.setFilterIndex(a.all, pa.index);
    const both = await snapshot(cfg, m);
    note('values', `${a.label} ${pa.label} ${JSON.stringify(sa)} | ${b.label} ${pb.label} ${JSON.stringify(sb)} | both ${JSON.stringify(both)}`);
    expectNarrower(both, sa, `Both ≤ ${a.label} alone`);
    expectNarrower(both, sb, `Both ≤ ${b.label} alone`);
    await expectTablesMatchCards(cfg, m, 'Both filters');
  },
  'filters:clear-one': async (cfg, { m }) => {
    test.setTimeout(240_000);
    const [a, b] = cfg.filters;
    await m.openWith('last_12_months');
    const pb = (await busiest(cfg, m, b.all))!;
    await m.setFilterIndex(b.all, pb.index);
    const alone = await m.shownAll();
    await m.setFilterIndex(a.all, 1);
    await m.setFilter(a.all, a.all);
    expect.soft((await m.filterSelect(b.all).locator('option:checked').innerText()).trim(), `${b.label} kept`).toBe(pb.label);
    expect(await m.shownAll(), `Cards = ${pb.label} alone`).toEqual(alone);
  },
  'filters:reset': async (cfg, { m }) => {
    await m.open();
    const period = await m.period();
    const before = await m.shownAll();
    await expect.soft(m.resetButton, 'Disabled before any change').toBeDisabled();
    await m.setPeriod(period === 'this_month' ? 'last_month' : 'this_month');
    for (const f of cfg.filters) await m.setFilterIndex(f.all, 1);
    await expect.soft(m.resetButton, 'Enabled after a change').toBeEnabled();
    await m.resetFilters();
    expect.soft(await m.period(), 'Period back to the default').toBe(period);
    for (const f of cfg.filters) expect.soft(await m.filterSelect(f.all).inputValue(), `"${f.all}"`).toBe('');
    expect.soft(await m.shownAll(), 'Cards back to the original values').toEqual(before);
  },
  'filters:reload': async (cfg, { m, page }) => {
    await m.open();
    const period = await m.period();
    await m.setFilterIndex(cfg.filters[0].all, 1);
    await page.reload();
    await page.waitForLoadState('networkidle').catch(() => {});
    await m.kpiText(mainCount(cfg)).catch(() => {});
    note('after reload', `URL ${page.url().replace(/^https?:\/\/[^/]+/, '')}`);
    expect.soft(await m.period(), 'Default period').toBe(period);
    for (const f of cfg.filters) expect.soft(await m.filterSelect(f.all).inputValue(), `"${f.all}" after reload`).toBe('');
  },
  'filters:view-keeps': async (cfg, { m }) => {
    const f = cfg.filters[0];
    await m.openWith('last_12_months');
    await m.setFilterIndex(f.all, 1);
    const filtered = await m.shownAll();
    const label = await m.filterSelect(f.all).locator('option:checked').innerText();
    await m.setView('Mine');
    await m.setView('All');
    expect.soft(await m.filterSelect(f.all).locator('option:checked').innerText(), `${f.label} still selected`).toBe(label);
    expect(await m.shownAll(), 'Figures follow the filter').toEqual(filtered);
  },
  'filters:empty': async (cfg, { m }) => {
    test.setTimeout(240_000);
    await m.openWith('last_12_months');
    let empty: string | undefined;
    for (const f of cfg.filters) {
      for (const o of await options(m, f.all)) {
        await m.setFilterIndex(f.all, o.index);
        if (num(await m.shown(mainCount(cfg))) === 0) { empty = `${f.label} = ${o.label}`; break; }
      }
      if (empty) break;
      await m.setFilterIndex(f.all, 0);
    }
    test.skip(!empty, 'Every filter value has data');
    note('selection', `${empty}: no ${mainCount(cfg)}`);
    const shown = await m.shownAll();
    for (const k of periodCounts(cfg)) expect.soft(num(shown[k]), `${k} is 0`).toBe(0);
    for (const [k, v] of Object.entries(shown)) expect.soft(v, k).not.toMatch(BAD);
    await m.expectNoBrokenValues();
    await expectTablesMatchCards(cfg, m, empty!);
  },
  'cards:valid': async (cfg, { m }) => {
    await m.openWith('last_12_months');
    const shown = await m.shownAll();
    note('cards', JSON.stringify(shown));
    expect(Object.keys(shown)).toEqual(cfg.cards.map(c => c.label));
    for (const c of cfg.cards) {
      expect.soft(shown[c.label], `${c.label} (${c.kind})`).toMatch(FORMATS[c.kind]);
      if (c.subtitle) await expect.soft(at(m.page, XP.kpiCard(c.label)), `${c.label} subtitle`).toContainText(c.subtitle);
    }
  },
  'cards:not-links': async (cfg, { m }) => {
    await m.open();
    for (const c of cfg.cards) {
      await expect.soft(at(m.page, XP.kpiCard(c.label)).locator('a, button'), `${c.label}: no link inside`).toHaveCount(0);
      await expectNothingHappens(m, at(m.page, XP.kpiCard(c.label)), c.label);
    }
  },
  'nf:responsive': async (_cfg, { m, page }) => {
    for (const [name, size] of Object.entries(SIZES)) {
      await page.setViewportSize(size);
      await m.open();
      const overflow = await page.evaluate(() => {
        const wide = [...document.querySelectorAll('main section.crm-panel, main article.crm-card')]
          .filter(e => e.getBoundingClientRect().right > window.innerWidth + 1)
          .map(e => `"${(e.querySelector('h3') as HTMLElement | null)?.innerText.trim()}" ${Math.round(e.getBoundingClientRect().right - window.innerWidth)}px too wide`);
        return { px: document.documentElement.scrollWidth - window.innerWidth, wide };
      });
      expect.soft(overflow.px, `${name}: no page-wide horizontal scroll (${overflow.wide.join(', ') || 'no single panel'})`).toBeLessThanOrEqual(1);
      const unscrollable = await page.evaluate(() => [...document.querySelectorAll('main table')].filter(t => {
        if (t.getBoundingClientRect().width <= window.innerWidth) return false;
        for (let e = t.parentElement; e && e.tagName !== 'MAIN'; e = e.parentElement) if (/(auto|scroll)/.test(getComputedStyle(e).overflowX)) return false;
        return true;
      }).length);
      expect.soft(unscrollable, `${name}: wide tables scroll inside their panel`).toBe(0);
      await expect.soft(m.periodSelect, `${name}: period usable`).toBeVisible();
    }
  },
  'nf:keyboard': async (cfg, { m, page }) => {
    await m.openWith('last_12_months');
    const focusVisible = (l: ReturnType<typeof page.locator>) => l.evaluate(e => { const s = getComputedStyle(e); return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none'; });
    await m.viewButton('Mine').focus();
    expect.soft(await focusVisible(m.viewButton('Mine')), 'View button shows focus').toBeTruthy();
    await page.keyboard.press('Enter');
    await expect.soft(m.viewButton('Mine'), 'Enter on a view selects it').toHaveClass(/is-active/);
    await m.viewButton('All').focus();
    await page.keyboard.press('Enter');
    const exportButton = m.table(cfg.tables[0].heading).exportButton;
    await exportButton.focus();
    expect.soft(await focusVisible(exportButton), 'Export shows focus').toBeTruthy();
    const download = page.waitForEvent('download', { timeout: 15_000 }).then(() => true).catch(() => false);
    await page.keyboard.press('Enter');
    expect.soft(await download, 'Enter on Export downloads the file').toBe(true);
    const other = m.tabLabel === 'Sales' ? 'Inventory' : 'Sales';
    await m.moduleTab(other).focus();
    await page.keyboard.press('Enter');
    await expect(page, 'Enter on a module tab opens it').toHaveURL(new RegExp(MODULE_TABS[other]));
  },
  'nf:performance': async (cfg, { m, page }) => {
    let t = Date.now();
    await page.goto(m.path);
    for (const k of m.kpiLabels) await m.shown(k);
    const pageMs = Date.now() - t;
    t = Date.now();
    await m.setPeriod('this_month');
    await m.shown(mainCount(cfg));
    const periodMs = Date.now() - t;
    note('timings', `page ${pageMs} ms | period change ${periodMs} ms (budget ${BUDGET} ms)`);
    expect.soft(pageMs, 'Page loads within budget').toBeLessThanOrEqual(BUDGET);
    expect.soft(periodMs, 'Period change within budget').toBeLessThanOrEqual(BUDGET);
  },
  'nf:api-error': async (cfg, { m, page }) => {
    await page.route(`**/api/v1${cfg.api}**`, r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Internal Server Error"}' }));
    await page.goto(m.path);
    await expect(page.locator('main').getByText(ERROR_TEXT).first(), 'Error message after the app\'s retries').toBeVisible({ timeout: 20_000 });
    await expect.soft(page.locator('main').getByText(/^\s*loading/i), 'Not stuck loading').toHaveCount(0);
    await m.expectNoBrokenValues();
  },
  'nf:api-empty': async (cfg, { m, page }) => {
    await page.route(`**/api/v1${cfg.api}**`, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.goto(m.path);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
    expect(await m.crashed(), 'No error screen').toBeFalsy();
    await expect.soft(m.heading(), 'Page still shows its heading').toBeVisible();
    await m.expectNoBrokenValues();
  },
  'nf:labels': async (cfg, { m, page }) => {
    await m.open();
    const unlabelled = await page.evaluate(() => [...document.querySelectorAll('main select')].filter(s => !(s.closest('label')?.textContent?.trim() || s.getAttribute('aria-label'))).length);
    expect.soft(unlabelled, 'Dropdowns without a label').toBe(0);
    const unnamed = await page.evaluate(() => [...document.querySelectorAll('main button, main a')].filter(b => !((b as HTMLElement).innerText.trim() || b.getAttribute('aria-label') || b.getAttribute('title'))).length);
    expect.soft(unnamed, 'Buttons or links without a name').toBe(0);
    for (const t of cfg.tables) {
      const table = m.table(t.heading);
      if (await table.root.count()) expect.soft(await table.root.locator('thead th').count(), `${t.heading}: column headers`).toBeGreaterThan(0);
    }
  },
};

// per filter / per table checks (key = filter:<label>:… / table:<heading>:…)
const filterCheck = (part: string, label: string): Check | undefined => {
  if (part === 'options') return async (cfg, { m }) => {
    const f = cfg.filters.find(x => x.label === label)!;
    await m.open();
    const all = (await m.filterSelect(f.all).locator('option').allInnerTexts()).map(o => o.trim());
    expect(all[0], 'First option').toBe(f.all);
    const opts = all.slice(1);
    note('options', opts.join(', '));
    expect.soft(opts.length, 'Values listed').toBeGreaterThan(0);
    expect.soft(opts.filter(o => !o), 'Blank options').toEqual([]);
    expect(opts.filter((o, i) => opts.indexOf(o) !== i), 'Values listed more than once').toEqual([]);
  };
  if (part === 'narrows') return async (cfg, { m }) => {
    test.setTimeout(240_000);
    const f = cfg.filters.find(x => x.label === label)!;
    await m.openWith('last_12_months');
    const all = await snapshot(cfg, m);
    const seen: string[] = [];
    for (const o of (await options(m, f.all)).slice(0, 6)) {
      await expectRequest(m, cfg.api, f.param, () => m.setFilterIndex(f.all, o.index));
      const k = await snapshot(cfg, m);
      seen.push(`${o.label}: ${mainCount(cfg)} ${k[mainCount(cfg)]}`);
      expectNarrower(k, all, o.label);
      await expectTablesMatchCards(cfg, m, o.label);
    }
    note('values', `All: ${all[mainCount(cfg)]} | ${seen.join(' | ')}`);
  };
};

const tableCheck = (part: string, heading: string): Check | undefined => {
  if (part === 'total') return async (cfg, { m }) => {
    const t = cfg.tables.find(x => x.heading === heading)!;
    await m.openWith('last_12_months');
    const table = m.table(heading);
    const rows = await table.rows();
    const total = await table.total();
    expect(total, `${heading}: Total row`).toBeTruthy();
    for (const col of t.sums) {
      const values = rows.map(r => r[col]);
      const tol = sum(values.map(shownTolerance)) + shownTolerance(total![col]);
      expect.soft(Math.abs(num(total![col]) - sum(values.map(v => (isBlank(v) ? 0 : num(v))))), `${heading}: Total ${col} ${total![col]} = sum of ${rows.length} rows (±${tol})`).toBeLessThanOrEqual(tol + 1e-9);
    }
    note(heading, `${rows.length} rows | Total ${t.sums.map(c => `${c} ${total![c]}`).join(', ')}`);
    await expectTablesMatchCards({ ...cfg, tables: [t] }, m, heading);
  };
  if (part === 'export') return async (cfg, { m }) => {
    const t = cfg.tables.find(x => x.heading === heading)!;
    await m.openWith('last_12_months');
    const table = m.table(heading);
    const screen = (await table.root.count()) ? await table.rows() : [];
    if (!screen.length) {
      // nothing to export: the button is disabled (the list shows "Nothing matches these filters.")
      await expect(table.exportButton, 'Export is disabled when the table is empty').toBeDisabled();
      note('export', 'Table empty in Last 12 months: Export disabled');
      return;
    }
    const total = t.total ? await table.total() : undefined;
    const sheet = await table.export();
    note('export', `${sheet.name} (sheet "${sheet.sheetName}"): ${sheet.rows.length} rows${sheet.total ? ' + Total row' : ''}`);
    expect.soft(sheet.name, 'File name').toMatch(new RegExp(`^${cfg.exportPrefix}-${t.file}-${todayInFileName()}\\.xlsx$`));
    const headers = await table.headers();
    expect.soft(sheet.header, 'Columns').toEqual(headers);
    if (t.capped) {
      // "Showing 200 of 209. Export for the full list.": the file has every row, the screen the first ones
      const shown = (await at(m.page, XP.reportPanel(heading)).innerText()).match(/Showing\s+([\d,]+)\s+of\s+([\d,]+)/i);
      note('list', shown ? `screen shows ${shown[1]} of ${shown[2]}` : 'not cut now (every row on screen)');
      expect.soft(sheet.rows.length, 'Export rows = the full count').toBe(shown ? num(shown[2]) : screen.length);
    } else expect.soft(sheet.rows.length, 'Rows').toBe(screen.length);
    expect.soft(!!sheet.total, 'Total row in the file').toBe(t.total);
    const diffs: string[] = [];
    const compare = (s: Record<string, string>, f: Record<string, unknown> | undefined, where: string) => {
      if (!f) { diffs.push(`${where}: missing in the file`); return; }
      for (const h of headers) if (!sameCell(s[h] ?? '', f[h])) diffs.push(`${where} › ${h}: file ${JSON.stringify(f[h])} vs screen "${s[h]}"`);
    };
    // rows with the same sort value can come in another order, so match each screen row to an unused equal file row
    const unused = new Set(sheet.rows.map((_, i) => i));
    screen.forEach((s, i) => {
      const j = [...unused].find(k => headers.every(h => sameCell(s[h] ?? '', sheet.rows[k][h])));
      if (j === undefined) compare(s, sheet.rows[i], `row ${i + 1}`);
      else unused.delete(j);
    });
    if (total) compare(total, sheet.total, 'Total row');
    expect.soft(diffs.slice(0, 15), 'Export vs table').toEqual([]);
  };
  if (part === 'not-links') return async (cfg, { m }) => {
    const t = cfg.tables.find(x => x.heading === heading)!;
    await m.openWith('last_12_months');
    const table = m.table(heading);
    if (!(await table.root.count())) {
      // an empty list has no table, only the message
      const panel = at(m.page, XP.reportPanel(heading));
      await expect.soft(panel, `${heading}: empty message`).toContainText('Nothing matches these filters.');
      await expect.soft(panel.locator('a'), `${heading}: no links`).toHaveCount(0);
      note('table', `${heading} is empty in Last 12 months`);
      return;
    }
    const firstRow = table.root.locator('tbody tr').first();
    if (t.links) await expect.soft(firstRow.locator('a, button'), 'Only the record link').toHaveCount(1);
    else await expect.soft(table.root.locator('tbody a, tbody button'), 'No links in the table').toHaveCount(0);
    const order = (await table.rows()).map(r => Object.values(r).join('|'));
    const cells = await firstRow.locator('td').count();
    for (let i = t.links ? 1 : 0; i < Math.min(cells, 6); i++) await expectNothingHappens(m, firstRow.locator('td').nth(i), `${heading} cell ${i + 1}`);
    for (let i = 0; i < Math.min(cells, 6); i++) await expectNothingHappens(m, table.root.locator('thead th').nth(i), `${heading} header ${i + 1}`);
    if (t.total) await expectNothingHappens(m, at(m.page, XP.reportTableTotal(heading)).locator('td, th').nth(1), `${heading} Total row`);
    expect.soft((await table.rows()).map(r => Object.values(r).join('|')), 'Order unchanged').toEqual(order);
  };
};

function checkFor(key: string): Check | undefined {
  if (C[key]) return C[key];
  const [kind, name, part] = key.split(':');
  if (kind === 'filter') return filterCheck(part, name);
  if (kind === 'table') return tableCheck(part, name);
  if (kind === 'map') return mapCheck(key);
}

// Clickable Map rows (key = map:…); map:cells:<A>|<B> and map:export:<A>|<B> run the table checks for each table named
const M: Record<string, Check> = {
  'map:breadcrumb': (cfg, c) => C['general:breadcrumb'](cfg, c),
  'map:views': async (cfg, { m }) => {
    await m.open();
    for (const [v, p] of [['You and your team', 'team'], ['Mine', 'self'], ['All', 'all']] as const) {
      await expectRequest(m, cfg.api, new RegExp(`view=${p}`), () => m.setView(v));
      await expect(m.viewButton(v)).toHaveClass(/is-active/);
    }
  },
  'map:tabs': (cfg, c) => C['tabs:open'](cfg, c),
  'map:leads-tab': async (_cfg, { m, page }) => {
    await m.open();
    expect(await m.moduleTab('Leads').evaluate(e => e.tagName), 'Leads is a link').toBe('A');
    await m.moduleTab('Leads').click();
    await expect(page).toHaveURL(/\/reports\/leads(\?.*)?$/);
  },
  'map:period': async (cfg, { m }) => {
    await m.open();
    expect(await m.periodOptions()).toEqual([...PERIODS]);
    await expectRequest(m, cfg.api, /period=this_month/, () => m.setPeriod('this_month'));
  },
  'map:custom': async (cfg, { m }) => {
    const [from, to] = previousMonth();
    await m.open();
    await m.setPeriod('custom');
    await expect(m.fromInput).toBeEditable();
    await expect(m.toInput).toBeEditable();
    await expectRequest(m, cfg.api, new RegExp(`from=${from}`), () => m.setCustomRange(from, to));
    await m.fromInput.fill(to);
    await m.toInput.fill(from);
    await expect(m.dateError, 'Message when To is before From').toBeVisible();
  },
  'map:filters': async (cfg, { m }) => {
    await m.open();
    for (const f of cfg.filters) {
      await expectRequest(m, cfg.api, f.param, () => m.setFilterIndex(f.all, 1));
      await m.setFilterIndex(f.all, 0);
    }
  },
  'map:reset': async (cfg, { m }) => {
    await m.open();
    const period = await m.period();
    await expect(m.resetButton, 'Disabled when nothing is changed').toBeDisabled();
    await m.setFilterIndex(cfg.filters[0].all, 1);
    await expect(m.resetButton, 'Enabled after a change').toBeEnabled();
    await m.resetFilters();
    expect(await m.period()).toBe(period);
    expect(await m.filterSelect(cfg.filters[0].all).inputValue()).toBe('');
  },
  'map:cards': (cfg, c) => C['cards:not-links'](cfg, c),
};
function mapCheck(key: string): Check | undefined {
  if (M[key]) return M[key];
  const [, part, list] = key.split(':');
  if ((part === 'cells' || part === 'export') && list) {
    const checks = list.split('|').map(h => tableCheck(part === 'cells' ? 'not-links' : 'export', h)!);
    return async (cfg, c) => { for (const check of checks) await check(cfg, c); };
  }
}

/** Observations run here: defects whose related check is a common one. The page spec covers the others. */
export const isCommonObservation = (o: { kind: string; related: string }) => o.kind === 'defect' && !o.related.startsWith('page:') && !!checkFor(o.related);
/** Clickable Map rows run here; the page spec covers the others (e.g. map:record). */
export const isCommonMapRow = (r: { key: string }) => !!mapCheck(r.key);

/** Common keys this module knows; any other key must be implemented by the page's spec. */
export const isCommonKey = (key: string) => key === 'general:login' || key === 'views:role' || !!checkFor(key);

type AllFixtures = Pages & { page: PwPage };

/** Declares one test per common-key row of the workbook. */
export function declareCommon(wb: Workbook, cfg: ModuleConfig) {
  const rows = Object.values(wb.CASES).filter(c => c.key && isCommonKey(c.key));
  test.describe(`${cfg.name} · Common checks`, () => {
    for (const row of rows) {
      if (row.key === 'views:role') { test(...wb.skipped(row.id, 'Needs manager and salesperson test accounts (only an administrator account is configured)')); continue; }
      if (row.key === 'general:login') continue;
      test(...wb.tc(row.id), async ({ page, hub, brokers, marketing, reservations, customers, sales, spa, collections, exceptions }: AllFixtures) => {
        const m = ({ brokers, marketing, reservations, customers, sales, spa, collections, exceptions } as Record<string, ReportModulePage>)[cfg.fixture];
        await checkFor(row.key)!(cfg, { m, page, hub });
      });
    }
    for (const row of wb.MAP_ROWS.filter(r => mapCheck(r.key))) {
      test(...wb.mapKey(row.key), async ({ page, hub, brokers, marketing, reservations, customers, sales, spa, collections, exceptions }: AllFixtures) => {
        test.setTimeout(180_000);
        const m = ({ brokers, marketing, reservations, customers, sales, spa, collections, exceptions } as Record<string, ReportModulePage>)[cfg.fixture];
        await mapCheck(row.key)!(cfg, { m, page, hub });
      });
    }
    // observations that are defects of a common rule: re-run that rule (fails until fixed)
    for (const o of wb.OBSERVATIONS.filter(isCommonObservation)) {
      test(...wb.obs(o.id), async ({ page, hub, brokers, marketing, reservations, customers, sales, spa, collections, exceptions }: AllFixtures) => {
        const m = ({ brokers, marketing, reservations, customers, sales, spa, collections, exceptions } as Record<string, ReportModulePage>)[cfg.fixture];
        await checkFor(o.related)!(cfg, { m, page, hub });
      });
    }
    const login = rows.find(r => r.key === 'general:login');
    if (login) test.describe('signed out', () => {
      test.use({ storageState: NO_AUTH });
      test(...wb.tc(login.id), async ({ page, brokers, marketing, reservations, spa, collections, exceptions }: AllFixtures) => {
        const m = ({ brokers, marketing, reservations, spa, collections, exceptions } as Record<string, ReportModulePage>)[cfg.fixture];
        await page.goto(m.path);
        await expect(page, 'Sent to the login page').toHaveURL(/\/login/, { timeout: 20_000 });
        await expect(page.locator('main article.crm-card'), 'No KPI cards').toHaveCount(0);
      });
    });
  });
}

/** Coverage: every workbook row has a test (common key or listed by the page spec). */
export function declareCoverage(wb: Workbook, dir: string) {
  test(`${wb.prefix}-COV-01 Every test case in ${wb.file} is automated`, { tag: wb.tag }, async () => {
    const { execSync } = await import('child_process');
    const path = await import('path');
    const root = path.resolve(__dirname, '../..');
    const listing = execSync(`npx playwright test ${dir} --list --reporter=list`, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const automated = [...listing.matchAll(new RegExp(`›\\s(${wb.prefix}-\\d{3})\\s`, 'g'))].map(m => m[1]);
    const missing = Object.keys(wb.CASES).filter(id => !automated.includes(id));
    const duplicated = automated.filter((id, i, a) => a.indexOf(id) !== i);
    const others = [...listing.matchAll(new RegExp(`›\\s(${wb.prefix}-(?:MAP|OBS)-\\d{2})\\s`, 'g'))].map(m => m[1]);
    const expectedOthers = [...wb.MAP_ROWS.map(r => r.id), ...wb.OBSERVATIONS.map(o => `${wb.prefix}-${o.id}`)];
    test.info().annotations.push({ type: 'coverage', description: `${new Set(automated).size} of ${Object.keys(wb.CASES).length} test cases, ${new Set(others).size} of ${expectedOthers.length} map rows and observations automated` });
    expect.soft(missing, 'Workbook test cases without a test').toEqual([]);
    expect.soft(duplicated, 'Test cases automated twice').toEqual([]);
    expect.soft(expectedOthers.filter(id => !others.includes(id)), 'Clickable Map rows / observations without a test').toEqual([]);
    expect.soft(others.filter((id, i, a) => a.indexOf(id) !== i), 'Map rows / observations automated twice').toEqual([]);
  });
}

export type { TableConfig };
