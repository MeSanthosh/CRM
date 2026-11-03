/** Inventory overview & counts (IVP-001 … IVP-008) and pricing / availability / holds (IVP-041 … IVP-046). */
import { test, expect, ivp, note, DATA, tabs, cardNames, sameAmount, stepOf, testProject } from './shared';
import { AvailabilitySummary } from '../pages/SalesPages';
import { parseNum, settle } from '../helpers';
import type { Page } from '@playwright/test';

const S = (k: string) => DATA.setting(k);
const tabOf = (shows: string) => tabs().find(t => t['Shows'].startsWith(shows))?.['Tab'] ?? shows;
const stack = () => DATA.sheet('Stack Status');
const letters = () => stack().map(s => s['Letter']);

/** Projects of the Availability Summary that have units (name + which of the same-named projects). */
async function projectsWithUnits(page: Page, av: AvailabilitySummary): Promise<{ name: string; nth: number }[]> {
  const names = (await page.locator('main select').first().locator('option').allTextContents()).map(o => o.trim());
  const out: { name: string; nth: number }[] = [];
  for (const [i, name] of names.entries()) {
    const nth = names.slice(0, i).filter(n => n === name).length;
    await av.project(name, nth);
    if (((await av.line(name, S('Summary Units Word'))).counts[S('Summary Units Word')] ?? 0) > 0) out.push({ name, nth });
  }
  return out;
}

/**
 * Figure shown with a label on the current tab: on the label's own line ("Showing 201 units (…)",
 * "Operative GDV: $238,962,480") or on the lines after it ("Total Units Displayed" / "133 units").
 */
async function figureAfter(page: Page, label: string): Promise<string> {
  const read = async () => {
    const text = (await page.locator('main').innerText()).split('\n').map(s => s.trim()).filter(Boolean);
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const l of text) {
      const m = l.match(new RegExp(`(?:^|\\W)${esc}:?\\s+(\\$?\\d[\\d,.]*\\s*[KMB]?)`));
      if (m) return m[1].trim();
    }
    const i = text.findIndex(l => l === label);
    return i >= 0 ? text.slice(i + 1, i + 4).find(l => /^\$?\d/.test(l)) ?? '' : '';
  };
  return settle(read, v => !v || /^\$?0(\.0+)?\b/.test(v), 20_000); // figures show 0 / $0 until the units load
}
/** Availability Summary line per project: "<project>: N units in M blocks · K available ($…)". */
async function summaryLines(page: Page): Promise<{ project: string; units: number; available: number }[]> {
  const main = page.locator('main');
  const select = main.locator('select').first();
  const projects = (await select.locator('option').allTextContents()).map(o => o.trim());
  const out: { project: string; units: number; available: number }[] = [];
  const re = new RegExp(`(\\d[\\d,]*) ${S('Summary Units Word')} .*?(\\d[\\d,]*) ${S('Summary Available Word')}`, 'i');
  // pick by position: several projects share a name (e.g. "Amani Gardens")
  for (const [i, p] of projects.entries()) {
    await select.selectOption({ index: i });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
    const line = (await main.innerText()).split('\n').find(l => l.startsWith(`${p}:`) && re.test(l)) ?? '';
    const m = line.match(re);
    out.push({ project: p, units: Number(m?.[1].replace(/,/g, '') ?? NaN), available: Number(m?.[2].replace(/,/g, '') ?? NaN) });
  }
  return out;
}

test.describe('Inventory · Page & counts', () => {
  test.describe.configure({ timeout: 300_000 });

  test(...ivp('IVP-001'), async ({ inv }) => {
    await inv.open();
    const title = await inv.title();
    note('title', title);
    expect.soft(title, 'Page title').toContain(S('Page Title'));
    for (const c of cardNames()) note(`card ${c}`, await inv.kpiText(c));
    const shown = await inv.tabNames(tabs().map(t => t['Tab']));
    expect(shown, 'Tabs').toEqual(tabs().map(t => t['Tab']));
  });

  test(...ivp('IVP-002'), async ({ inv }) => {
    await inv.open();
    const card = await inv.kpi('Projects');
    await inv.tab(tabOf('Project Register'));
    const total = await inv.pagerTotal();
    note('card / register', `${card} / ${total} (${await inv.pagerText()})`);
    expect(total, 'Projects in the register').toBe(card);
  });

  test(...ivp('IVP-003'), async ({ inv }) => {
    await inv.open();
    const card = await inv.kpi('Products');
    await inv.tab(tabOf('Unit Product Catalogue'));
    const total = await inv.pagerTotal();
    note('card / catalogue', `${card} / ${total}`);
    expect(total, 'Products in the catalogue').toBe(card);
  });

  test(...ivp('IVP-004'), async ({ inv }) => {
    await inv.open();
    const card = await inv.kpi('Units');
    await inv.tab(tabOf('Unit Register'));
    const total = await inv.pagerTotal();
    note('card / register', `${card} / ${total}`);
    expect(total, 'Units in the register (All Statuses)').toBe(card);
  });

  test(...ivp('IVP-005'), async ({ inv }) => {
    await inv.open();
    const card = await inv.kpi('Available');
    await inv.tab(tabOf('Unit Register'));
    await inv.filterStatus(S('New Unit Status'));
    const total = await inv.pagerTotal();
    note('card / register (Available)', `${card} / ${total}`);
    expect(total, 'Available units in the register').toBe(card);
  });

  test(...ivp('IVP-006'), async ({ inv, page }) => {
    await inv.open();
    const card = await inv.kpi('Available');
    await inv.tab(tabOf('Availability Summary'));
    const lines = await summaryLines(page);
    const sum = lines.reduce((a, l) => a + (l.available || 0), 0);
    note('card / Availability Summary', `${card} / ${sum} (${lines.map(l => `${l.project}: ${l.available}`).join(', ')})`);
    expect(sum, 'Available units in the Availability Summary').toBe(card);
  });

  test(...ivp('IVP-007'), async ({ inv, page }) => {
    await inv.open();
    const shown = await inv.kpiText('Value');
    const card = parseNum(shown);
    await inv.tab(tabOf('Unit Pricing Structure Matrix'));
    const pm = await figureAfter(page, S('Pricing Value Label'));
    note('Value card / Pricing Matrix', `${shown} / ${pm}`);
    expect(sameAmount(parseNum(pm), card, stepOf(shown)), `Pricing Matrix ${S('Pricing Value Label')} (${pm}) = Value card (${shown})`).toBeTruthy();
  });

  test(...ivp('IVP-008'), async ({ inv, page }) => {
    await inv.openTab(tabOf('Unit Product Catalogue'));
    const rows = await inv.allRows();
    const chips = (await page.locator('main button').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim()).filter(t => /^[A-Z][A-Za-z ]+ \d+$/.test(t));
    note('chips', chips.join(', '));
    expect(chips.length, 'Category chips shown').toBeGreaterThan(0);
    for (const chip of chips) {
      const [, type, n] = chip.match(/^(.+) (\d+)$/)!;
      const listed = rows.filter(r => (r.cells['Type'] ?? '') === type).length;
      expect.soft(listed, `Chip "${chip}": products of type ${type}`).toBe(Number(n));
      const all = (await page.locator('main button').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
      await page.locator('main button').nth(all.indexOf(chip)).click();
      await page.waitForTimeout(800);
      const shown = await inv.rows();
      expect.soft(shown.filter(r => r.cells['Type'] !== type).map(r => r.lines[0]), `Chip "${type}" lists only ${type}`).toEqual([]);
    }
  });
});

test.describe('Inventory · Pricing, availability & holds', () => {
  test.describe.configure({ timeout: 300_000 });

  test(...ivp('IVP-041'), async ({ inv, page }) => {
    await inv.open();
    const units = await inv.kpi('Units');
    await inv.tab(tabOf('Unit Pricing Structure Matrix'));
    const shown = await figureAfter(page, S('Pricing Total Label'));
    note('Units card / Total Units Displayed', `${units} / ${shown}`);
    expect.soft(parseNum(shown), 'Total Units Displayed = Units card').toBe(units);
    // filter by one project: only its units are shown
    const select = page.locator('main select').filter({ has: page.locator('option', { hasText: S('Test Project Name') }) }).first();
    const proj = (await select.locator('option').allTextContents()).map(o => o.trim()).find(o => o.includes(S('Test Project Name')))!;
    await select.selectOption({ label: proj });
    await page.waitForTimeout(1500);
    const code = proj.split(' - ')[0];
    const codes = (await page.locator('main table tbody tr').allInnerTexts()).map(t => t.split(/\s/)[0]).filter(Boolean);
    note(`filter ${proj}`, `${await figureAfter(page, S('Pricing Total Label'))} · ${codes.slice(0, 5).join(', ')}`);
    expect(codes.filter(c => !c.startsWith(code)), `Only units of ${proj}`).toEqual([]);
    expect(await page.locator('main').getByRole('button', { name: S('Never Click') }).count(), `"${S('Never Click')}" is present (and never clicked)`).toBeGreaterThan(0);
  });

  test(...ivp('IVP-042'), async ({ inv, page }) => {
    await inv.openTab(tabOf('Availability Summary'));
    const av = new AvailabilitySummary(page);
    const projects = await projectsWithUnits(page, av);
    expect(projects.length, 'Projects with units').toBeGreaterThan(0);
    for (const p of projects) {
      await av.project(p.name, p.nth);
      const line = await av.line(p.name, S('Summary Units Word'));
      await av.view(S('Stack Plan View'));
      const { chips } = await av.stackPlan(letters());
      const all = chips[S('Stack All Chip')];
      const sum = stack().reduce((a, s) => a + (chips[s['Chip']] ?? 0), 0);
      note(`${p.name} #${p.nth + 1}`, `${Object.entries(chips).map(([k, v]) => `${k} ${v}`).join(' · ')} | ${line.text}`);
      expect.soft(sum, `${p.name}: status chips add up to ${S('Stack All Chip')}`).toBe(all);
      expect.soft(all, `${p.name}: ${S('Stack All Chip')} = total units of the summary line`).toBe(line.counts[S('Summary Units Word')]);
      for (const s of stack()) expect.soft(chips[s['Chip']] ?? 0, `${p.name}: ${s['Chip']} chip = summary line`).toBe(line.counts[s['Chip']] ?? 0);
      await av.view(S('Summary Table View'));
    }
  });

  test(...ivp('IVP-045'), async ({ inv, page }) => {
    await inv.openTab(tabOf('Availability Summary'));
    const av = new AvailabilitySummary(page);
    const cols = [...stack().map(s => s['Summary Column']), S('Summary Total Column')];
    const projects = await projectsWithUnits(page, av);
    expect(projects.length, 'Projects with units').toBeGreaterThan(0);
    for (const p of projects) {
      await av.project(p.name, p.nth);
      await av.view(S('Summary Table View'));
      const line = await av.line(p.name, S('Summary Units Word'));
      const rows = await av.table();
      const grand = rows.find(r => r.block.startsWith(S('Grand Total Row')));
      const blocks = rows.filter(r => r !== grand);
      note(`${p.name} #${p.nth + 1}`, `${rows.map(r => `${r.block}: ${cols.map(c => `${c} ${r.counts[c] ?? 0}`).join(' ')}`).join(' | ')} || ${line.text}`);
      expect(grand, `${p.name}: ${S('Grand Total Row')} row`).toBeTruthy();
      for (const b of blocks) {
        const parts = stack().reduce((a, s) => a + (b.counts[s['Summary Column']] ?? 0), 0);
        expect.soft(parts, `${p.name} · ${b.block}: ${stack().map(s => s['Summary Column']).join(' + ')} = ${S('Summary Total Column')}`).toBe(b.counts[S('Summary Total Column')]);
      }
      for (const c of cols) expect.soft(grand!.counts[c] ?? 0, `${p.name}: ${S('Grand Total Row')} ${c} = sum of the blocks`).toBe(blocks.reduce((a, b) => a + (b.counts[c] ?? 0), 0));
      expect.soft(grand!.counts[S('Summary Total Column')], `${p.name}: ${S('Grand Total Row')} = total units of the summary line`).toBe(line.counts[S('Summary Units Word')]);
      for (const s of stack()) expect.soft(grand!.counts[s['Summary Column']] ?? 0, `${p.name}: ${S('Grand Total Row')} ${s['Summary Column']} = summary line`).toBe(line.counts[s['Chip']] ?? 0);
    }
  });

  test(...ivp('IVP-046'), async ({ inv, page }) => {
    const proj = await testProject(page, DATA);
    await inv.openTab(tabOf('Unit Register'));
    await inv.search(S('Unit Search Placeholder'), proj.code);
    const register = (await inv.allRows()).filter(r => r.lines[0].startsWith(`${proj.code}-`));
    await inv.openTab(tabOf('Availability Summary'));
    const av = new AvailabilitySummary(page);
    await av.project(proj.name);
    await av.view(S('Stack Plan View'));
    const { chips, units } = await av.stackPlan(letters());
    note('stack plan', `${units.length} cells · ${Object.entries(chips).map(([k, v]) => `${k} ${v}`).join(' · ')} · register ${register.length} units`);
    expect.soft(units.length, `One cell per unit (= ${S('Stack All Chip')} chip)`).toBe(chips[S('Stack All Chip')]);
    for (const s of stack()) expect.soft(units.filter(u => u.letter === s['Letter']).length, `Cells marked ${s['Letter']} = ${s['Chip']} chip`).toBe(chips[s['Chip']] ?? 0);
    const shown = new Map(units.map(u => [u.code, u.letter]));
    const missing = register.filter(r => !shown.has(r.lines[0])).map(r => r.lines[0]);
    const wrong = register.filter(r => shown.has(r.lines[0])).map(r => ({ code: r.lines[0], status: r.cells['Status'], letter: shown.get(r.lines[0])! }))
      .filter(x => stack().find(s => s['Letter'] === x.letter)?.['Unit Status'] !== x.status).map(x => `${x.code}: ${x.status} shown as ${x.letter}`);
    note('register units not in the stack plan / other letter', `${missing.join(', ') || 'none'} / ${wrong.join(', ') || 'none'}`);
    expect.soft(missing, 'Every unit of the project is in the stack plan').toEqual([]);
    expect(wrong, 'Each cell shows the letter of the unit status').toEqual([]);
  });

  test(...ivp('IVP-043'), async ({ inv, page }) => {
    await inv.open();
    const units = await inv.kpi('Units');
    await inv.tab(tabOf('Availability Summary'));
    const lines = await summaryLines(page);
    const sum = lines.reduce((a, l) => a + (l.units || 0), 0);
    note('Units card / Availability Summary', `${units} / ${sum} (${lines.map(l => `${l.project}: ${l.units}`).join(', ')})`);
    expect(sum, 'Units in the Availability Summary = Units card').toBe(units);
  });

  test(...ivp('IVP-044'), async ({ inv, page }) => {
    await inv.openTab(tabOf('Unit Holds'));
    const [scope, state] = [page.locator('main select').nth(0), page.locator('main select').nth(1)];
    await scope.selectOption({ label: S('Holds Scope All') });
    await state.selectOption({ label: S('Holds Active') });
    await page.waitForTimeout(1500);
    const active = await inv.rows();
    const activeTotal = await inv.pagerTotal();
    note('active holds', `${activeTotal}: ${active.map(r => `${r.lines[0]} ${r.cells['Status']} ${r.cells['Held Until']}`).join(' | ')}`);
    for (const r of active) {
      expect.soft(r.cells['Status'], `${r.lines[0]} status`).toBe(S('Holds Active'));
      expect.soft(r.cells['Held Until'], `${r.lines[0]} time left`).toContain(S('Hold Time Left Word'));
    }
    await state.selectOption({ label: S('Holds History') });
    await page.waitForTimeout(1500);
    const all = await inv.pagerTotal();
    note('all holds incl. history', String(all));
    expect(all, 'History lists at least the active holds').toBeGreaterThanOrEqual(activeTotal);
  });
});

