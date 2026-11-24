/**
 * Pricing Matrix ↔ Business Rules → Unit Pricing Matrix Rules (IVP-077 … IVP-082): the rule tabs, every unit's
 * premiums against the rules, the commercial tiers and the Live Simulator. Read only: Save Draft, Publish and
 * ⚡ Recalculate All Units Live are never clicked, and the tests check that nothing is sent to the server.
 * Run: npx playwright test tests/inventory-page/pricing-rules.spec.ts --workers=1
 */
import {
  test, expect, note, ivp, ivpRow, PS, list, sheet, sameMoney, money, pct, nameOf,
  discountOf, tierColumns, premiums, blockFloor, figures, neverClick, filters, engine,
} from './pricing-shared';
import { watchWrites, PricingMatrixPage, PricingRulesPage } from '../pages/PricingMatrixPage';
import { XP, at } from '../locators';

const FULL = () => sheet('Pricing Views').find(v => v['Group'] === 'Layers' && v['Default'] !== 'Yes')!['Button'];
const TABS = () => sheet('Rules Tabs').map(t => t['Tab']);
const tabNamed = (start: string) => TABS().find(t => t.startsWith(start))!;
const bad = (xs: string[], max = 8) => (xs.length ? `${xs.length}: ${xs.slice(0, max).join(' | ')}${xs.length > max ? ' …' : ''}` : '');

/** Opens the rules page from the matrix (⚙ Pricing Rules). */
async function openRules(pm: PricingMatrixPage, rules: PricingRulesPage) {
  await pm.open();
  await pm.press(pm.button(PS('Rules Button')), PS('Rules Button'));
  await expect(pm.page, 'Rules page opens').toHaveURL(new RegExp(PS('Rules Route').replace(/[?]/g, '\\?')));
  await expect(at(pm.page, XP.rulesEngine(PS('Rules Engine'))), `"${PS('Rules Engine')}" is the selected engine`).toHaveClass(/is-active/);
  await pm.page.waitForLoadState('networkidle').catch(() => {});
}
/** Rows of a rule tab: [code / label, name, …, %]. */
async function ruleRows(rules: PricingRulesPage, tab: string) {
  await rules.tab(tab);
  return (await rules.table()).rows;
}
/** Name → % of a View / Orientation / Position tab ("V3 - Partial Ocean View" is also kept as "Partial Ocean View"). */
async function percents(rules: PricingRulesPage, tab: string) {
  const out = new Map<string, number>();
  for (const r of await ruleRows(rules, tab)) {
    const p = Number(r[r.length - 1]);
    out.set(r[1], p);
    out.set(r[1].replace(/^[A-Z]\d+\s*-\s*/, ''), p);
  }
  return out;
}

test.describe('Inventory · Pricing rules & Live Simulator', () => {
  test.describe.configure({ timeout: 600_000 });

  test(...ivp('IVP-077'), async ({ pm, rules, page }) => {
    const writes = watchWrites(page);
    await openRules(pm, rules);
    const main = await page.locator('main').innerText();
    const version = main.split('\n').find(l => l.trim().startsWith(PS('Rules Version Word'))) ?? '';
    note('rules version', version);
    expect.soft(version, 'Version line').not.toBe('');
    expect.soft(await rules.tabNames(TABS()), 'Rule tabs').toEqual(TABS());
    for (const t of sheet('Rules Tabs')) {
      await rules.tab(t['Tab']);
      if (t['Table Columns']) expect.soft((await rules.table()).headers, `${t['Tab']}: table columns`).toEqual(list(t['Table Columns']));
    }
    for (const b of neverClick().filter(b => !/Recalculate (All|Pricing Matrix)$/.test(b))) await expect.soft(rules.button(b), `"${b}" is there (never clicked)`).toBeVisible();
    expect(writes.map(w => `${w.method} ${w.url}`), 'Browsing the rules sends no change').toEqual([]);
  });

  test(...ivp('IVP-078'), async ({ pm, rules }) => {
    await openRules(pm, rules);
    const rates = new Map((await ruleRows(rules, tabNamed('1.'))).map(r => [r[0], Number(r[r.length - 1])]));
    note('base rates', [...rates].map(([k, v]) => `${k} ${v}`).join(' · '));
    await pm.open();
    const rows = await pm.rows();
    const wrong = rows.filter(r => money(r.cells['Base Rate']) !== rates.get(r.cells['Product'])).map(r => `${r.code} ${r.cells['Product']}: ${r.cells['Base Rate']} vs rule ${rates.get(r.cells['Product'])}`);
    expect(bad(wrong), 'Every unit\'s Base Rate = the rule of its product').toBe('');
  });

  test(...ivp('IVP-079'), async ({ pm, rules }) => {
    await openRules(pm, rules);
    const bands = (await ruleRows(rules, tabNamed('2.'))).map(r => ({ label: r[0], min: Number(r[1]), max: Number(r[2]), pct: Number(r[3]) })).sort((a, b) => a.min - b.min);
    note('floor bands', bands.map(b => `${b.label} ${b.min}–${b.max} ${b.pct}%`).join(' · '));
    const gaps: string[] = [];
    bands.forEach((b, i) => {
      if (b.min > b.max) gaps.push(`${b.label}: min ${b.min} > max ${b.max}`);
      if (i && b.min !== bands[i - 1].max + 1) gaps.push(`${bands[i - 1].label} ends ${bands[i - 1].max}, ${b.label} starts ${b.min}`);
    });
    expect.soft(bad(gaps), 'Floor bands run on without gaps or overlaps').toBe('');
    await pm.open();
    await pm.view(FULL());
    const rows = await pm.rows();
    const wrong = rows.map(r => ({ r, fl: blockFloor(r).floor, b: bands.find(x => blockFloor(r).floor >= x.min && blockFloor(r).floor <= x.max) }))
      .filter(x => pct(x.r.cells['Floor %']) !== x.b?.pct).map(x => `${x.r.code} floor ${x.fl}: ${x.r.cells['Floor %']} vs ${x.b ? `${x.b.label} ${x.b.pct}%` : 'no band'}`);
    expect(bad(wrong), 'Every unit\'s Floor % = the band of its floor').toBe('');
  });

  test(...ivp('IVP-080'), async ({ pm, rules }) => {
    await openRules(pm, rules);
    const view = await percents(rules, tabNamed('3.'));
    const orient = await percents(rules, tabNamed('4.'));
    const pos = await percents(rules, tabNamed('5.'));
    const none = list(PS('No Position Names'));
    await pm.open();
    await pm.view(FULL());
    const rows = await pm.rows();
    const wrong: string[] = [], unknown = new Set<string>();
    for (const r of rows) {
      const p = premiums(r);
      const checks: [string, string, number, Map<string, number>][] = [
        ['View', nameOf(r.cells['View']), pct(r.cells['View']), view], ['Orientation', p['Orient'].name, p['Orient'].pct, orient], ['Position', p['Pos'].name, p['Pos'].pct, pos],
      ];
      for (const [what, name, shown, rule] of checks) {
        if (none.includes(name) || !name) { if (shown !== 0) wrong.push(`${r.code} ${what} "${name}" ${shown}% (no rule → 0%)`); continue; }
        if (!rule.has(name)) { unknown.add(`${what} "${name}"`); continue; }
        if (rule.get(name) !== shown) wrong.push(`${r.code} ${what} ${name}: ${shown}% vs rule ${rule.get(name)}%`);
      }
    }
    expect.soft([...unknown], 'Every view / orientation / position used by a unit exists in the rules').toEqual([]);
    expect(bad(wrong), 'Unit premiums = the rules').toBe('');
  });

  test(...ivp('IVP-081'), async ({ pm, rules }) => {
    await openRules(pm, rules);
    await rules.tab(tabNamed('6.'));
    const g = sheet('Governance Fields').map(x => x['Field Label']);
    const v: Record<string, string> = {};
    for (const label of g) v[label] = await rules.value(label);
    note('governance', JSON.stringify(v));
    const tierPct = g.filter(l => /Adjustment %$/.test(l)).map(l => Number(v[l]));
    const discount = Number(v[g.find(l => /Discount Limit/.test(l))!]);
    expect.soft(Number(v[g.find(l => /^Standard/.test(l))!]), 'Standard tier is 0%').toBe(0);
    await expect.soft(rules.field(g.find(l => /^Standard/.test(l))!), 'Standard tier cannot be changed').toBeDisabled();
    const tierOptions = await rules.options(g.find(l => /Default Commercial Tier/.test(l))!);
    expect.soft(tierOptions.map(o => pct(o, false)), 'Default tier options show the tier %').toEqual(tierPct);
    await pm.open();
    await pm.view(FULL());
    const header = await pm.header();
    expect.soft(tierColumns(header).map(t => t.pct), 'Matrix tier headers = the rules').toEqual(tierPct);
    expect.soft(discountOf(header), 'Floor (-N%) header = Maximum Discount Limit %').toBe(discount);
    const tierFilter = filters().find(f => f['Filter'] === 'Tier')!['Label'];
    expect.soft((await pm.filterOptions(tierFilter)).slice(1).map(o => pct(o, false)), 'Tier filter = the rules').toEqual(tierPct);
    const rounding = v[g.find(l => /Rounding/.test(l))!];
    if (/Integer/i.test(rounding)) {
      const rows = await pm.rows();
      const cols = ['Std Price', 'Net Adj', 'Adj Std', 'Current Price'];
      const dec = rows.flatMap(r => cols.filter(c => /\.\d/.test(r.cells[c])).map(c => `${r.code} ${c} ${r.cells[c]}`));
      expect(bad(dec), `Amounts follow the Rounding Rule "${rounding}" (whole dollars)`).toBe('');
    }
  });

  sheet('Simulator Cases').forEach((c, n) => {
    test(...ivpRow('IVP-082', n + 1, `Live Simulator: ${c['What it covers']}`, 'The simulated breakdown follows the rules: carpet × base rate, floor band %, view / orientation / position %, total, adjusted standard, every tier price, current price of the chosen tier and price floor; nothing is saved.', `Simulator Cases row ${n + 1}`), async ({ pm, rules, page }) => {
      await openRules(pm, rules);
      const bands = (await ruleRows(rules, tabNamed('2.'))).map(r => ({ min: Number(r[1]), max: Number(r[2]), pct: Number(r[3]) }));
      await rules.tab(tabNamed('6.'));
      const discount = Number(await rules.value(sheet('Governance Fields').find(x => /Discount Limit/.test(x['Field Label']))!['Field Label']));
      const writes = watchWrites(page);
      await rules.tab(tabNamed('🔍'));
      const f = sheet('Simulator Fields').map(x => x['Field Label']);
      const [product, carpet, floor, view, orient, position, tier] = f;
      const chosen: Record<string, string> = {};
      const input: Record<string, string> = { [product]: c['Product'], [carpet]: c['Carpet Area'], [floor]: c['Floor Number'], [view]: c['View'], [orient]: c['Orientation'], [position]: c['Position'], [tier]: c['Commercial Tier'] };
      for (const k of f) chosen[k] = await rules.simulate(k, input[k]);
      const tierOpts = await rules.options(tier);
      await page.waitForTimeout(600);
      note('simulator input', JSON.stringify(chosen));
      const rate = money((chosen[product].match(/\(\$([\d,.]+)/) ?? ['', ''])[1]);
      const fl = Number(chosen[floor]);
      const band = bands.find(b => fl >= b.min && fl <= b.max);
      const premium = (band?.pct ?? NaN) + pct(chosen[view], false) + pct(chosen[orient], false) + pct(chosen[position], false);
      const want = engine({ carpet: Number(chosen[carpet]), rate, premiumPct: premium, tierPct: pct(chosen[tier], false), discount, tiers: tierOpts.map(o => pct(o, false)) });
      const lines = await rules.lines();
      const cap = sheet('Simulator Results').map(x => x['Caption']);
      const after = (caption: string) => { const i = lines.findIndex(l => l.startsWith(caption)); return i >= 0 ? lines[i + 1] ?? '' : ''; };
      const base = after(cap[0]);
      note('simulator result', lines.slice(lines.findIndex(l => l.startsWith(cap[0]))).slice(0, 30).join(' | '));
      expect.soft(band, `Floor ${fl} has a band`).toBeTruthy();
      expect.soft(sameMoney(money(base.split('=')[1] ?? ''), want.std), `Standard ${base} = ${chosen[carpet]} × ${rate}`).toBeTruthy();
      expect.soft(pct(after(cap[1])), 'Floor adjustment = band %').toBe(band?.pct);
      expect.soft(pct(after(cap[2])), 'View adjustment').toBe(pct(chosen[view], false));
      expect.soft(pct(after(cap[3])), 'Orientation adjustment').toBe(pct(chosen[orient], false));
      expect.soft(pct(after(cap[4])), 'Position adjustment').toBe(pct(chosen[position], false));
      const total = after(cap[5]);
      expect.soft(pct(total), `Total premium % (${total})`).toBe(premium);
      expect.soft(sameMoney(money(total.split('(')[1] ?? ''), want.netAdj), `Total premium $ (${total}) = ${Math.round(want.netAdj)}`).toBeTruthy();
      expect.soft(sameMoney(money(after(cap[6])), want.adj), `Adjusted standard ${after(cap[6])} = ${Math.round(want.adj)}`).toBeTruthy();
      const t0 = lines.findIndex(l => l.startsWith(cap[7]));
      const tierLines = lines.slice(t0 + 1, t0 + 1 + tierOpts.length);
      tierOpts.forEach((o, i) => expect.soft(sameMoney(money(tierLines[i]?.split(':')[1] ?? ''), want.tiers[i]), `${o}: ${tierLines[i]} = ${Math.round(want.tiers[i])}`).toBeTruthy());
      expect.soft(sameMoney(money(after(cap[8])), want.current), `Operative current price ${after(cap[8])} = ${chosen[tier]} ${Math.round(want.current)}`).toBeTruthy();
      const floorCap = lines.find(l => l.startsWith(cap[9])) ?? '';
      expect.soft(pct(floorCap, false), 'Price floor discount = rules').toBe(-discount);
      expect.soft(sameMoney(money(after(floorCap)), want.floor), `Price floor ${after(floorCap)} = ${Math.round(want.floor)}`).toBeTruthy();
      expect(writes.map(w => `${w.method} ${w.url}`), 'Simulating sends nothing to the server').toEqual([]);
    });
  });
});
