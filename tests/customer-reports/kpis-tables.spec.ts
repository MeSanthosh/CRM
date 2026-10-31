/** Customer Reports workbook — KPI cards (CR-038…046) and breakdown tables (CR-047…055). Expected values come from the page. */
import { test, expect, note } from '../pages/fixtures';
import { num, sum } from '../helpers';
import { XP, at } from '../locators';
import { CustomerReportsPage, BREAKDOWN_COLUMNS } from '../pages/CustomerReportsPage';
import type { ReportTable } from '../pages/ReportTable';
import { cr } from './catalog';
import { openWithFullList, NO_FULL_LIST, groupList, shownTolerance, expectNothingHappens, Row } from './shared';

const COUNTS = ['Customers', 'New in Period', 'With SPA', 'SPAs'];
const VALUE = 'SPA Value (USD)';

/** Total row = the sum of the rows, exactly for counts and within display rounding for SPA Value. */
async function expectTotalIsSum(table: ReportTable, group: string) {
  expect.soft(await table.headers(), `${table.heading}: columns`).toEqual([group, ...BREAKDOWN_COLUMNS]);
  const rows = await table.rows();
  const total = (await table.total())!;
  expect(total, `${table.heading}: Total row`).toBeTruthy();
  expect.soft(total[group], 'Total row label').toBe('Total');
  for (const c of COUNTS) expect.soft(num(total[c]), `${table.heading}: Total ${c} = sum of rows`).toBe(sum(rows.map(r => num(r[c]))));
  const tol = sum(rows.map(r => shownTolerance(r[VALUE]))) + shownTolerance(total[VALUE]);
  expect.soft(Math.abs(num(total[VALUE]) - sum(rows.map(r => num(r[VALUE])))), `${table.heading}: Total SPA Value = sum of rows (±${tol})`).toBeLessThanOrEqual(tol + 0.01);
  note(table.heading, `${rows.length} rows | Total ${COUNTS.map(c => `${c} ${total[c]}`).join(', ')}, ${total[VALUE]}`);
}

/** Row-level rules of a breakdown table. */
async function expectRowsConsistent(table: ReportTable, group: string, ignoreCase = false) {
  const rows = await table.rows();
  const bad: string[] = [];
  for (const r of rows) {
    const [cust, nw, withSpa, spas, value] = [num(r['Customers']), num(r['New in Period']), num(r['With SPA']), num(r['SPAs']), num(r[VALUE])];
    if (nw > cust) bad.push(`${r[group]}: New in Period ${nw} > Customers ${cust}`);
    if (withSpa > cust) bad.push(`${r[group]}: With SPA ${withSpa} > Customers ${cust}`);
    if (spas < withSpa) bad.push(`${r[group]}: SPAs ${spas} < With SPA ${withSpa}`);
    if ((spas === 0) !== (value === 0)) bad.push(`${r[group]}: SPAs ${spas} but SPA Value ${r[VALUE]}`);
    if (cust <= 0) bad.push(`${r[group]}: no customers`);
  }
  expect.soft(bad, `${table.heading}: inconsistent rows`).toEqual([]);
  const counts = rows.map(r => num(r['Customers']));
  expect.soft(counts, `${table.heading}: sorted by Customers, highest first`).toEqual([...counts].sort((a, b) => b - a));
  const labels = rows.map(r => (ignoreCase ? r[group].toLowerCase() : r[group]));
  expect.soft(rows.filter((r, i) => labels.indexOf(labels[i]) !== i).map(r => r[group]), `${table.heading}: listed more than once${ignoreCase ? ' (ignoring case)' : ''}`).toEqual([]);
}

/** Each table row = the New Customers list grouped by the same column (the list must hold every customer). */
async function expectRowsMatchList(c: CustomerReportsPage, table: ReportTable, group: string, listColumn: string) {
  test.skip(!(await openWithFullList(c)), NO_FULL_LIST);
  const byList = groupList(await c.newCustomers.rows(), listColumn);
  const rows = await table.rows();
  const diffs: string[] = [];
  for (const r of rows) {
    const g = byList[r[group]] ?? { customers: 0, withSpa: 0, spas: 0, value: 0 };
    if (num(r['Customers']) !== g.customers) diffs.push(`${r[group]}: Customers ${r['Customers']} vs list ${g.customers}`);
    if (num(r['With SPA']) !== g.withSpa) diffs.push(`${r[group]}: With SPA ${r['With SPA']} vs list ${g.withSpa}`);
    if (num(r['SPAs']) !== g.spas) diffs.push(`${r[group]}: SPAs ${r['SPAs']} vs list ${g.spas}`);
    if (Math.abs(num(r[VALUE]) - g.value) > shownTolerance(r[VALUE]) * (g.customers + 1) + 0.01) diffs.push(`${r[group]}: SPA Value ${r[VALUE]} vs list ${g.value}`);
  }
  const missing = Object.keys(byList).filter(k => !rows.some(r => r[group] === k));
  expect.soft(diffs.slice(0, 15), `${table.heading} rows vs the list grouped by ${listColumn}`).toEqual([]);
  expect.soft(missing, `${listColumn} values in the list with no row in ${table.heading}`).toEqual([]);
}

test.describe('Customer Reports · KPI cards', () => {
  test(...cr('CR-038'), async ({ customers, page }) => {
    await customers.openWith('last_12_months');
    const shown = await customers.shownAll();
    note('cards', JSON.stringify(shown));
    expect(Object.keys(shown)).toEqual(customers.kpiLabels);
    for (const k of ['Active customers', 'New in period', 'Customers with SPA', 'Repeat buyers']) expect.soft(shown[k], `${k} is a whole number`).toMatch(/^\d[\d,]*$/);
    for (const k of ['SPA value', 'Average value per buyer']) expect.soft(shown[k], `${k} is an amount in USD`).toMatch(/^(\d[\d,]*(\.\d+)?\s?[KMB]?\s?USD|—)$/);
    expect.soft(shown['Portal access'], 'Portal access is a %').toMatch(/^(\d+(\.\d+)?%|—)$/);
    await expect.soft(at(page, XP.kpiCard('Repeat buyers')), 'Repeat buyers subtitle').toContainText('Two or more signed SPAs');
    await expect.soft(at(page, XP.kpiCard('Portal access')), 'Portal access subtitle').toContainText('Customers who can sign in to the portal');
  });

  test(...cr('CR-039'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    const k = await customers.kpi('Active customers');
    for (const { table } of customers.breakdowns) expect.soft(num((await table.total())?.['Customers'] ?? '0'), `${table.heading} Total Customers`).toBe(k);
  });

  test(...cr('CR-040'), async ({ customers }) => {
    for (const p of ['this_month', 'last_12_months'] as const) {
      await customers.openWith(p);
      const k = await customers.kpi('New in period');
      for (const { table } of customers.breakdowns) expect.soft(num((await table.total())?.['New in Period'] ?? '0'), `${p}: ${table.heading} Total New in Period`).toBe(k);
      expect.soft((await customers.newCustomers.rows()).length, `${p}: New Customers rows`).toBe(k);
    }
  });

  test(...cr('CR-041'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    const k = await customers.kpi('Customers with SPA');
    for (const { table } of customers.breakdowns) expect.soft(num((await table.total())?.['With SPA'] ?? '0'), `${table.heading} Total With SPA`).toBe(k);
    if (await openWithFullList(customers)) {
      const withSpa = (await customers.newCustomers.rows()).filter(r => num(r['SPAs']) > 0).length;
      expect.soft(withSpa, 'List rows with SPAs > 0').toBe(await customers.kpi('Customers with SPA'));
    } else note('list', NO_FULL_LIST);
  });

  test(...cr('CR-042'), async ({ customers, page }) => {
    await customers.openWith('last_12_months');
    await expect.soft(at(page, XP.kpiCard('Repeat buyers')), 'Subtitle').toContainText('Two or more signed SPAs');
    const repeat = await customers.kpi('Repeat buyers');
    const withSpa = await customers.kpi('Customers with SPA');
    const t = (await customers.byNationality.total())!;
    const extraSpas = num(t['SPAs']) - num(t['With SPA']);
    note('values', `Repeat buyers ${repeat} | Customers with SPA ${withSpa} | SPAs ${t['SPAs']} − With SPA ${t['With SPA']} = ${extraSpas}`);
    expect.soft(repeat, 'Repeat buyers ≤ Customers with SPA').toBeLessThanOrEqual(withSpa);
    expect.soft(extraSpas, 'Extra SPAs ≥ Repeat buyers (each repeat buyer has at least one more SPA)').toBeGreaterThanOrEqual(repeat);
    if (repeat === 0) expect.soft(extraSpas, 'No repeat buyers ⇒ SPAs = With SPA').toBe(0);
    if (await openWithFullList(customers)) {
      const rows = await customers.newCustomers.rows();
      expect.soft(rows.filter(r => num(r['SPAs']) >= 2).length, 'List rows with 2+ SPAs').toBe(await customers.kpi('Repeat buyers'));
    }
  });

  test(...cr('CR-043'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    const shown = await customers.shown('SPA value');
    for (const { table } of customers.breakdowns) {
      const total = (await table.total())![VALUE];
      expect.soft(Math.abs(num(total) - num(shown)), `${table.heading} Total SPA Value ${total} vs card ${shown}`).toBeLessThanOrEqual(shownTolerance(total) + shownTolerance(shown));
    }
    if (await openWithFullList(customers)) {
      const rows = await customers.newCustomers.rows();
      const listSum = sum(rows.map(r => num(r[VALUE])));
      const tol = sum(rows.map(r => shownTolerance(r[VALUE]))) + shownTolerance(shown);
      note('list', `sum of ${rows.length} SPA values ${listSum} vs card ${shown} (±${tol})`);
      expect.soft(Math.abs(listSum - num(shown)), 'Sum of the list = SPA value').toBeLessThanOrEqual(tol);
    }
  });

  test(...cr('CR-044'), async ({ customers }) => {
    for (const p of ['last_12_months'] as const) {
      await customers.openWith(p);
      for (const view of ['All', 'Mine'] as const) {
        await customers.setView(view);
        const buyers = await customers.kpi('Customers with SPA');
        const avg = await customers.shown('Average value per buyer');
        if (!buyers) { expect.soft(avg, `${view}: no buyer ⇒ —`).toMatch(/^[—–-]$/); continue; }
        const value = await customers.kpi('SPA value');
        // the shown SPA value is rounded too, so allow its rounding spread over the buyers
        const tol = shownTolerance(avg) + shownTolerance(await customers.shown('SPA value')) / buyers;
        note(view, `${value} ÷ ${buyers} = ${value / buyers} vs ${avg}`);
        expect.soft(Math.abs(num(avg) - value / buyers), `${view}: Average value per buyer = SPA value ÷ Customers with SPA`).toBeLessThanOrEqual(tol + 0.01);
      }
    }
  });

  test(...cr('CR-045'), async ({ customers, page }) => {
    await customers.openWith('last_12_months');
    await expect.soft(at(page, XP.kpiCard('Portal access')), 'Subtitle').toContainText('Customers who can sign in to the portal');
    for (const view of ['All', 'Mine'] as const) {
      await customers.setView(view);
      const n = await customers.kpi('Active customers');
      const shown = await customers.shown('Portal access');
      if (!n) { expect.soft(shown, `${view}: no customers ⇒ —`).toMatch(/^[—–-]$/); continue; }
      const pct = num(shown);
      expect.soft(pct, `${view}: between 0 and 100`).toBeGreaterThanOrEqual(0);
      expect.soft(pct, `${view}: between 0 and 100`).toBeLessThanOrEqual(100);
      const k = Array.from({ length: n + 1 }, (_, i) => i).find(i => Math.abs((i / n) * 100 - pct) <= 0.05 + 1e-9);
      note(view, `${shown} of ${n} customers ≈ ${k ?? '?'} customers`);
      expect.soft(k, `${view}: ${shown} is a whole number of the ${n} customers`).not.toBeUndefined();
    }
  });

  test(...cr('CR-046'), async ({ customers, page }) => {
    await customers.open();
    for (const k of customers.kpiLabels) {
      await expect.soft(at(page, XP.kpiCard(k)).locator('a, button'), `${k}: no link inside`).toHaveCount(0);
      await expectNothingHappens(customers, at(page, XP.kpiCard(k)), k);
    }
  });
});

test.describe('Customer Reports · Breakdown tables', () => {
  for (const [id, i] of [['CR-047', 0], ['CR-048', 1], ['CR-049', 2]] as const) {
    test(...cr(id), async ({ customers }) => {
      await customers.openWith('last_12_months');
      const { table, group } = customers.breakdowns[i];
      await expectTotalIsSum(table, group);
    });
  }

  for (const [id, i] of [['CR-050', 0], ['CR-051', 1], ['CR-052', 2]] as const) {
    test(...cr(id), async ({ customers }) => {
      await customers.openWith('last_12_months');
      const { table, group } = customers.breakdowns[i];
      await expectRowsConsistent(table, group, i === 1);
    });
  }

  test(...cr('CR-053'), async ({ customers }) => {
    const { table, group, listColumn } = customers.breakdowns[0];
    await expectRowsMatchList(customers, table, group, listColumn);
  });

  test(...cr('CR-054'), async ({ customers }) => {
    const { table, group, listColumn } = customers.breakdowns[1];
    await expectRowsMatchList(customers, table, group, listColumn);
  });

  test(...cr('CR-055'), async ({ customers }) => {
    await customers.openWith('last_12_months');
    for (const { table } of customers.breakdowns) {
      await expect.soft(table.root.locator('a, button'), `${table.heading}: no links or buttons in the table`).toHaveCount(0);
      const order = (await table.rows()).map((r: Row) => Object.values(r)[0]);
      await expectNothingHappens(customers, table.root.locator('tbody tr').first().locator('td').nth(1), `${table.heading} count cell`);
      await expectNothingHappens(customers, table.root.locator('thead th').nth(1), `${table.heading} header`);
      await expectNothingHappens(customers, at(customers.page, XP.reportTableTotal(table.heading)).locator('td, th').nth(1), `${table.heading} Total row`);
      expect.soft((await table.rows()).map((r: Row) => Object.values(r)[0]), `${table.heading}: order unchanged`).toEqual(order);
    }
  });
});
