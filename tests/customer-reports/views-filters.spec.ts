/** Customer Reports workbook — Views (CR-010…015) and Filters (CR-016…037). Every expected value is read from the page. */
import { test, expect, note } from '../pages/fixtures';
import { num, sum } from '../helpers';
import { PERIODS, Period } from '../pages/ReportModulePage';
import { CustomerReportsPage, ALL_TIME_KPIS, PROJECTS, SALESPEOPLE } from '../pages/CustomerReportsPage';
import { cr } from './catalog';
import { crSkipped, previousMonth, futureRange, periodRange, shownDate, inRange, COUNT_KPIS } from './shared';

type Snap = Record<string, number>;
const NAMED_PERIODS = PERIODS.filter(p => p !== 'custom') as Exclude<Period, 'custom'>[];
const BAD = /^\s*$|NaN|undefined|Infinity/;

/** Count cards and SPA value as numbers. */
async function snapshot(c: CustomerReportsPage): Promise<Snap> {
  return c.kpis([...COUNT_KPIS, 'SPA value']);
}

/** The Total row of every breakdown table equals the cards. */
async function expectTablesMatchCards(c: CustomerReportsPage, where: string) {
  const k = await snapshot(c);
  for (const { table } of c.breakdowns) {
    const t = await table.total();
    if (!t) { expect.soft(k['Active customers'], `${where}: ${table.heading} has no Total row, so no customers`).toBe(0); continue; }
    expect.soft(num(t['Customers']), `${where}: ${table.heading} Total Customers = Active customers`).toBe(k['Active customers']);
    expect.soft(num(t['New in Period']), `${where}: ${table.heading} Total New in Period = New in period`).toBe(k['New in period']);
    expect.soft(num(t['With SPA']), `${where}: ${table.heading} Total With SPA = Customers with SPA`).toBe(k['Customers with SPA']);
    expect.soft(Math.abs(num(t['SPA Value (USD)']) - k['SPA value']), `${where}: ${table.heading} Total SPA Value = SPA value`).toBeLessThanOrEqual(Math.max(k['SPA value'] * 0.005, 0.01e6));
  }
}

function expectNarrower(narrow: Snap, wide: Snap, what: string) {
  for (const key of Object.keys(wide)) expect.soft(narrow[key], `${what}: ${key} ${narrow[key]} ≤ ${wide[key]}`).toBeLessThanOrEqual(wide[key] * 1.0005 + 1e-9);
}

/** Waits for the report request that carries `param` while running `fn`. */
async function expectRequest(c: CustomerReportsPage, param: RegExp, fn: () => Promise<unknown>) {
  const req = c.page.waitForRequest(r => r.url().includes('/reports/business/customers') && param.test(r.url()), { timeout: 15_000 }).catch(() => null);
  await fn();
  expect.soft(await req, `Request with ${param}`).not.toBeNull();
}

/** Labels and positions of a filter's options (without "All …"). */
async function options(c: CustomerReportsPage, all: string) {
  return (await c.filterOptions(all)).map((label, i) => ({ label, index: i + 1 }));
}

test.describe('Customer Reports · Views', () => {
  test(...cr('CR-010'), async ({ customers }) => {
    await customers.open();
    for (const v of ['All', 'You and your team', 'Mine'] as const) await expect.soft(customers.viewButton(v), v).toBeEnabled();
    await expect(customers.viewButton('All'), 'All is active for the administrator').toHaveClass(/is-active/);
  });

  test(...cr('CR-011'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    const all = await snapshot(customers);
    await expectRequest(customers, /view=team/, () => customers.setView('You and your team'));
    const team = await snapshot(customers);
    note('values', `All ${JSON.stringify(all)} | You and your team ${JSON.stringify(team)}`);
    expectNarrower(team, all, 'You and your team ≤ All');
    await expectTablesMatchCards(customers, 'You and your team');
  });

  test(...cr('CR-012'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    await customers.setView('You and your team');
    const team = await snapshot(customers);
    await expectRequest(customers, /view=self/, () => customers.setView('Mine'));
    const mine = await snapshot(customers);
    note('values', `You and your team ${JSON.stringify(team)} | Mine ${JSON.stringify(mine)}`);
    expectNarrower(mine, team, 'Mine ≤ You and your team');
    await expectTablesMatchCards(customers, 'Mine');
  });

  test(...cr('CR-013'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    const all = await customers.shownAll();
    await customers.setView('Mine');
    await customers.setView('All');
    expect(await customers.shownAll()).toEqual(all);
  });

  test(...cr('CR-014'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    const user = await customers.signedInUser();
    const match = (await options(customers, SALESPEOPLE)).filter(o => o.label === user);
    test.skip(match.length !== 1, `Signed-in user "${user}" is not exactly once in the Salesperson list`);
    await customers.setView('Mine');
    const mine = await customers.shownAll();
    await customers.setView('All');
    await customers.setFilterIndex(SALESPEOPLE, match[0].index);
    const filtered = await customers.shownAll();
    note('values', `${user}: Mine ${JSON.stringify(mine)} | Salesperson filter ${JSON.stringify(filtered)}`);
    expect(filtered, `Mine = Salesperson "${user}"`).toEqual(mine);
  });

  test(...crSkipped('CR-015', 'Needs manager and salesperson test accounts (only an administrator account is configured)'));
});

test.describe('Customer Reports · Filters', () => {
  test(...cr('CR-016'), async ({ customers }) => {
    await customers.open();
    await expect(customers.page.locator('main label').filter({ has: customers.periodSelect }), 'Label').toContainText('Period (customer created)');
    expect(await customers.periodOptions()).toEqual([...PERIODS]);
  });

  test(...cr('CR-017'), async ({ customers }) => {
    await customers.open();
    expect(await customers.period(), 'Default period').toBe('this_month');
  });

  test(...cr('CR-018'), async ({ customers }) => {
    await customers.open();
    const seen: string[] = [];
    for (const p of NAMED_PERIODS) {
      const req = customers.page.waitForRequest(r => r.url().includes('/reports/business/customers') && r.url().includes(`period=${p}`), { timeout: 10_000 }).catch(() => null);
      await customers.setPeriod(p);
      const sent = await req;
      if ((await customers.period()) !== p) expect.soft(sent, `${p}: request sent`).not.toBeNull();
      const shown = await customers.shownAll();
      seen.push(`${p}: New in period ${shown['New in period']}`);
      for (const [k, v] of Object.entries(shown)) expect.soft(v, `${p} › ${k}`).not.toMatch(BAD);
    }
    note('periods', seen.join(' | '));
  });

  test(...cr('CR-019'), async ({ customers }) => {
    await customers.open();
    const n: Record<string, number> = {};
    for (const p of NAMED_PERIODS) { await customers.setPeriod(p); n[p] = await customers.kpi('New in period'); }
    note('New in period', JSON.stringify(n));
    const month = new Date().getMonth();
    expect.soft(n.this_month, 'This month ≤ This quarter').toBeLessThanOrEqual(n.this_quarter);
    expect.soft(n.this_quarter, 'This quarter ≤ Year to date').toBeLessThanOrEqual(n.ytd);
    expect.soft(n.ytd, 'Year to date ≤ Last 12 months').toBeLessThanOrEqual(n.last_12_months);
    expect.soft(n.last_month, 'Last month ≤ Last 12 months').toBeLessThanOrEqual(n.last_12_months);
    expect.soft(n.last_quarter, 'Last quarter ≤ Last 12 months').toBeLessThanOrEqual(n.last_12_months);
    if (month >= 3) expect.soft(n.last_quarter + n.this_quarter, 'Last + this quarter ≤ Year to date (same year)').toBeLessThanOrEqual(n.ytd);
    if (month >= 1) expect.soft(n.last_month + n.this_month, 'Last + this month ≤ Year to date (same year)').toBeLessThanOrEqual(n.ytd);
    if (month % 3 !== 0) expect.soft(n.last_month + n.this_month, 'Last + this month ≤ This quarter (same quarter)').toBeLessThanOrEqual(n.this_quarter);
  });

  test(...cr('CR-020'), async ({ customers }) => {
    await customers.open();
    for (const p of NAMED_PERIODS) {
      await customers.setPeriod(p);
      const created = await customers.newCustomers.column('Created');
      expect.soft(created.length, `${p}: list rows = New in period`).toBe(await customers.kpi('New in period'));
      const range = periodRange(p);
      const outside = created.filter(d => !inRange(shownDate(d), range));
      expect.soft(outside.slice(0, 10), `${p}: Created dates outside the period`).toEqual([]);
    }
  });

  test(...cr('CR-021'), async ({ customers }) => {
    await customers.open();
    const by: Record<string, Record<string, string>> = {};
    for (const p of NAMED_PERIODS) { await customers.setPeriod(p); by[p] = await customers.shownAll(); }
    const first = by[NAMED_PERIODS[0]];
    note('all-time cards', ALL_TIME_KPIS.map(k => `${k} ${first[k]}`).join(' | '));
    for (const p of NAMED_PERIODS.slice(1)) {
      for (const k of ALL_TIME_KPIS) expect.soft(by[p][k], `${k}: ${p} = ${NAMED_PERIODS[0]}`).toBe(first[k]);
    }
  });

  test(...cr('CR-022'), async ({ customers }) => {
    await customers.open();
    await expect(customers.fromInput).toHaveCount(0);
    await customers.setPeriod('custom');
    await expect(customers.fromInput).toBeVisible();
    await expect(customers.toInput).toBeVisible();
  });

  test(...cr('CR-023'), async ({ customers }) => {
    const [from, to] = previousMonth();
    await customers.openWith('last_month');
    const lastMonth = await customers.shownAll();
    const ids = await customers.newCustomers.column('Customer');
    await customers.setCustomRange(from, to);
    note('range', `${from} → ${to}: New in period ${await customers.shown('New in period')} (Last month ${lastMonth['New in period']})`);
    expect.soft(await customers.shownAll(), 'Cards = Last month').toEqual(lastMonth);
    expect.soft((await customers.newCustomers.column('Customer')).sort(), 'Same customers as Last month').toEqual([...ids].sort());
    const outside = (await customers.newCustomers.column('Created')).filter(d => !inRange(shownDate(d), [new Date(`${from}T00:00`), new Date(`${to}T00:00`)]));
    expect.soft(outside, 'Created dates outside the range').toEqual([]);
  });

  test(...cr('CR-024'), async ({ customers, page }) => {
    const [from, to] = previousMonth();
    await customers.open();
    await customers.setPeriod('custom');
    const sent: string[] = [];
    page.on('request', r => { if (r.url().includes('period=custom')) sent.push(r.url()); });
    await customers.fromInput.fill(to);
    await customers.toInput.fill(from);
    await page.waitForLoadState('networkidle').catch(() => {});
    const invalid = sent.filter(u => (u.match(/from=([\d-]+)/)?.[1] ?? '') > (u.match(/to=([\d-]+)/)?.[1] ?? '~'));
    expect.soft(invalid, 'No request with From after To').toEqual([]);
    await expect(customers.dateError, 'Validation message').toContainText('To on or after From');
  });

  test(...cr('CR-025'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    const before = await customers.shownAll();
    await customers.setCustomRange(...futureRange());
    const after = await customers.shownAll();
    expect.soft(num(after['New in period']), 'New in period').toBe(0);
    for (const { table } of customers.breakdowns) expect.soft(num((await table.total())?.['New in Period'] ?? '0'), `${table.heading} New in Period`).toBe(0);
    await expect.soft(customers.emptyMessage, 'Empty list message').toBeVisible();
    for (const k of ALL_TIME_KPIS) expect.soft(after[k], `${k} unchanged`).toBe(before[k]);
    await customers.expectNoBrokenValues();
  });

  test(...cr('CR-026'), async ({ customers }) => {
    await customers.open();
    const all = await customers.filterSelect(PROJECTS).locator('option').allInnerTexts();
    expect(all[0].trim(), 'First option').toBe(PROJECTS);
    const opts = all.slice(1).map(o => o.trim());
    expect.soft(opts.length, 'Projects listed').toBeGreaterThan(0);
    expect.soft(opts.filter(o => !o), 'Blank options').toEqual([]);
    expect.soft(opts.filter((o, i) => opts.indexOf(o) !== i), 'Duplicate projects').toEqual([]);
  });

  test(...cr('CR-027'), async ({ customers }) => {
    test.setTimeout(180_000);
    await customers.openWith('last_12_months');
    const all = await snapshot(customers);
    for (const o of await options(customers, PROJECTS)) {
      await expectRequest(customers, /projectCode=/, () => customers.setFilterIndex(PROJECTS, o.index));
      const k = await snapshot(customers);
      note(o.label, JSON.stringify(k));
      expectNarrower(k, all, o.label);
      await expectTablesMatchCards(customers, o.label);
    }
  });

  test(...cr('CR-028'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    const totalOf = async () => {
      const t = await customers.byNationality.total();
      return { spas: num(t?.['SPAs'] ?? '0'), value: await customers.kpi('SPA value') };
    };
    const all = await totalOf();
    const parts: { label: string; spas: number; value: number }[] = [];
    for (const o of await options(customers, PROJECTS)) { await customers.setFilterIndex(PROJECTS, o.index); parts.push({ label: o.label, ...(await totalOf()) }); }
    note('projects', `${parts.map(p => `${p.label}: ${p.spas} SPAs, ${p.value}`).join(' | ')} | All: ${all.spas} SPAs, ${all.value}`);
    expect.soft(sum(parts.map(p => p.spas)), 'Projects\' SPAs add up to all SPAs').toBe(all.spas);
    expect.soft(Math.abs(sum(parts.map(p => p.value)) - all.value), 'Projects\' SPA values add up to the SPA value').toBeLessThanOrEqual(all.value * 0.005);
  });

  test(...cr('CR-029'), async ({ customers }) => {
    await customers.open();
    const all = await customers.filterSelect(SALESPEOPLE).locator('option').allInnerTexts();
    expect(all[0].trim(), 'First option').toBe(SALESPEOPLE);
    const names = all.slice(1).map(o => o.trim());
    expect.soft(names.filter(o => !o), 'Blank options').toEqual([]);
    expect(names.filter((o, i) => names.indexOf(o) !== i), 'Salesperson names that appear more than once').toEqual([]);
  });

  test(...cr('CR-030'), async ({ customers }) => {
    test.setTimeout(180_000);
    await customers.openWith('last_12_months');
    const all = await snapshot(customers);
    let done = false;
    for (const o of await options(customers, SALESPEOPLE)) {
      await expectRequest(customers, /ownerUserId=/, () => customers.setFilterIndex(SALESPEOPLE, o.index));
      const k = await snapshot(customers);
      expectNarrower(k, all, o.label);
      if (k['Active customers'] > 0) {
        note('salesperson', `${o.label}: ${JSON.stringify(k)} | All ${JSON.stringify(all)}`);
        await expectTablesMatchCards(customers, o.label);
        done = true;
        break;
      }
    }
    test.skip(!done, 'No salesperson has customers');
  });

  test(...cr('CR-031'), async ({ customers }) => {
    test.setTimeout(180_000);
    await customers.openWith('last_12_months');
    const all = await customers.kpi('Active customers');
    const parts: string[] = [];
    let total = 0;
    for (const o of await options(customers, SALESPEOPLE)) {
      await customers.setFilterIndex(SALESPEOPLE, o.index);
      const n = await customers.kpi('Active customers');
      total += n;
      parts.push(`${o.label} ${n}`);
    }
    note('salespeople', `${parts.join(' + ')} = ${total} | All salespeople ${all}`);
    expect(total, 'Salespeople\'s Active customers add up to all customers').toBe(all);
  });

  test(...cr('CR-032'), async ({ customers }) => {
    test.setTimeout(240_000);
    await customers.openWith('last_12_months');
    const project = (await options(customers, PROJECTS))[0];
    await customers.setFilterIndex(PROJECTS, project.index);
    const p = await snapshot(customers);
    await customers.setFilterIndex(PROJECTS, 0);
    // the salesperson with the most customers
    let best: { label: string; index: number; n: number } | undefined;
    for (const o of await options(customers, SALESPEOPLE)) {
      await customers.setFilterIndex(SALESPEOPLE, o.index);
      const n = await customers.kpi('Active customers');
      if (!best || n > best.n) best = { ...o, n };
    }
    await customers.setFilterIndex(SALESPEOPLE, best!.index);
    const pick = { ...best!, snap: await snapshot(customers) };
    await customers.setFilterIndex(PROJECTS, project.index);
    const both = await snapshot(customers);
    note('values', `${project.label} ${JSON.stringify(p)} | ${pick.label} ${JSON.stringify(pick.snap)} | both ${JSON.stringify(both)}`);
    expectNarrower(both, p, 'Both ≤ project alone');
    expectNarrower(both, pick.snap, 'Both ≤ salesperson alone');
    await expectTablesMatchCards(customers, 'Project + Salesperson');
  });

  test(...cr('CR-033'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    const sp = (await options(customers, SALESPEOPLE)).find(o => o.label === 'CRM Administrator') ?? (await options(customers, SALESPEOPLE))[0];
    await customers.setFilterIndex(SALESPEOPLE, sp.index);
    const alone = await customers.shownAll();
    await customers.setFilterIndex(PROJECTS, 1);
    await customers.setFilter(PROJECTS, PROJECTS);
    expect.soft(await customers.filterSelect(SALESPEOPLE).locator('option:checked').innerText(), 'Salesperson kept').toBe(sp.label);
    expect(await customers.shownAll(), `Cards = ${sp.label} alone`).toEqual(alone);
  });

  test(...cr('CR-034'), async ({ customers }) => {
    await customers.open();
    const period = await customers.period();
    const before = await customers.shownAll();
    await expect.soft(customers.resetButton, 'Disabled before any change').toBeDisabled();
    await customers.setPeriod(period === 'this_month' ? 'last_month' : 'this_month');
    await customers.setFilterIndex(PROJECTS, 1);
    await customers.setFilterIndex(SALESPEOPLE, 1);
    await expect.soft(customers.resetButton, 'Enabled after a change').toBeEnabled();
    await customers.resetFilters();
    expect.soft(await customers.period(), 'Period back to the default').toBe(period);
    for (const all of customers.filters) expect.soft(await customers.filterSelect(all).inputValue(), `"${all}"`).toBe('');
    expect.soft(await customers.shownAll(), 'Cards back to the original values').toEqual(before);
  });

  test(...cr('CR-035'), async ({ customers, page }) => {
    await customers.open();
    const period = await customers.period();
    await customers.setFilterIndex(PROJECTS, 1);
    await page.reload();
    await page.waitForLoadState('networkidle').catch(() => {});
    await customers.kpiText('Active customers');
    note('after reload', `URL ${page.url().replace(/^https?:\/\/[^/]+/, '')}`);
    expect.soft(await customers.period(), 'Default period').toBe(period);
    for (const all of customers.filters) expect.soft(await customers.filterSelect(all).inputValue(), `"${all}" after reload`).toBe('');
  });

  test(...cr('CR-036'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    await customers.setFilterIndex(PROJECTS, 1);
    const project = await customers.shownAll();
    const label = await customers.filterSelect(PROJECTS).locator('option:checked').innerText();
    await customers.setView('Mine');
    await customers.setView('All');
    expect.soft(await customers.filterSelect(PROJECTS).locator('option:checked').innerText(), 'Project still selected').toBe(label);
    expect(await customers.shownAll(), 'Figures follow the project').toEqual(project);
  });

  test(...cr('CR-037'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    let empty: string | undefined;
    for (const o of await options(customers, SALESPEOPLE)) {
      await customers.setFilterIndex(SALESPEOPLE, o.index);
      if ((await customers.kpi('Active customers')) === 0) { empty = o.label; break; }
    }
    test.skip(!empty, 'Every salesperson has customers');
    note('salesperson', `${empty}: no customers`);
    const shown = await customers.shownAll();
    for (const k of COUNT_KPIS) expect.soft(num(shown[k]), k).toBe(0);
    expect.soft(num(shown['SPA value']), 'SPA value').toBe(0);
    for (const k of ['Average value per buyer', 'Portal access']) expect.soft(shown[k], `${k} shows —`).toMatch(/^[—–-]$/);
    // with no data the tables are replaced by the empty message
    for (const { table } of customers.breakdowns) expect.soft((await table.root.count()) ? (await table.rows()).length : 0, `${table.heading}: no rows`).toBe(0);
    await expect.soft(customers.emptyMessage.first(), 'Empty message').toBeVisible();
    await customers.expectNoBrokenValues();
  });
});
