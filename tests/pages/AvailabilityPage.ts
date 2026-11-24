/**
 * Inventory → Availability Summary (build 0411-16): summary line, Summary Table (block / floor / Grand Total rows),
 * filters, category chips, Stack Plan (status chips, tiles), the Unit Mix window, the unit window opened from a tile
 * and its Hold form. Locators come from locators.ts.
 */
import { Page, Locator, expect } from '@playwright/test';
import { XP, at } from '../locators';
import { coverOf } from './PricingMatrixPage';

const clean = (s: string) => (s ?? '').replace(/\s+/g, ' ').trim();
/** "856,800 USD" / "$73.79M" / "1.82M USD" → number (NaN when none) */
export function amount(s: string): number {
  const m = (s ?? '').replace(/,/g, '').match(/(-?\d+(?:\.\d+)?)\s*([kKmMbB])?(?![a-z])/);
  if (!m) return NaN;
  return Number(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? '').toLowerCase() as 'k' | 'm' | 'b'] ?? 1);
}
/** Rounding step of a shown amount: "73.79M" → 10,000; "$857k" → 1,000; "856,800" → 1 */
export function step(s: string): number {
  const m = (s ?? '').replace(/,/g, '').match(/\d+(?:\.(\d+))?\s*([kKmMbB])?(?![a-z])/);
  return m ? 10 ** -(m[1]?.length ?? 0) * ({ k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? '').toLowerCase() as 'k' | 'm' | 'b'] ?? 1) : 0;
}

/** One count cell: count, exact-ish value (from its tooltip) and the value as shown. */
export type Cell = { n: number; value: number; shown: string; title: string };
export type SumRow = { kind: 'block' | 'floor' | 'total' | 'row'; label: string; extra: string; cells: Record<string, Cell>; text: string };

/** Reads a table whose count cells are td.crm-availability-count (Summary Table, Unit Mix tables). */
async function readCountTable(table: Locator): Promise<SumRow[]> {
  return table.evaluate(t => {
    const heads = [...t.querySelectorAll('thead th')].map(h => (h as HTMLElement).innerText.replace(/\s+/g, ' ').trim());
    return [...t.querySelectorAll('tbody tr, tfoot tr')].map(r => {
      const tds = [...r.children] as HTMLElement[];
      const cells: Record<string, { n: number; value: number; shown: string; title: string }> = {};
      let col = 0; // header column of each cell (the Total row's first cell spans two columns)
      tds.forEach(c => {
        const i = col;
        col += (c as HTMLTableCellElement).colSpan || 1;
        if (!c.classList.contains('crm-availability-count')) return;
        const d = c.querySelector('div');
        const n = Number((c.querySelector('span')?.textContent ?? '').replace(/,/g, ''));
        const shown = c.querySelector('small')?.textContent?.trim() ?? (c.innerText.trim() === '–' ? '–' : '');
        const title = d?.getAttribute('title') ?? '';
        const parse = (s: string) => {
          const m = s.replace(/,/g, '').match(/(-?\d+(?:\.\d+)?)\s*([kKmMbB])?(?![a-z])/);
          return m ? Number(m[1]) * (({ k: 1e3, m: 1e6, b: 1e9 } as Record<string, number>)[(m[2] ?? '').toLowerCase()] ?? 1) : NaN;
        };
        cells[heads[i]] = { n: Number.isFinite(n) ? n : NaN, value: title ? parse(title) : shown && shown !== '–' ? parse(shown) : 0, shown, title };
      });
      const first = tds[0];
      const kind = r.classList.contains('crm-availability-block-row') ? 'block' : r.classList.contains('crm-availability-total-row') ? 'total' : first?.classList.contains('crm-availability-floor') ? 'floor' : 'row';
      const label = (first?.querySelector('button.crm-link-button, strong') as HTMLElement | null)?.innerText.trim() ?? first?.innerText.split('\n')[0].trim() ?? '';
      return { kind, label: kind === 'total' ? (first?.childNodes[0]?.textContent ?? '').trim() : label, extra: first?.innerText.replace(/\s+/g, ' ').trim() ?? '', cells, text: (r as HTMLElement).innerText.replace(/\s+/g, ' ').trim() };
    });
  }) as Promise<SumRow[]>;
}

/** dimmed: a status chip or the search does not hide tiles, it dims the ones that do not match (class is-dimmed). */
export type Tile = { code: string; status: string; letter: string; product: string; area: number; price: string; operative: number; operativeShown: string; floor: string; dimmed: boolean };

export class AvailabilityPage {
  readonly covered: Record<string, string> = {};
  constructor(readonly page: Page, readonly route: string, readonly tab: string) {}
  get main() { return this.page.locator('main'); }
  get table() { return at(this.page, XP.avsTable); }

  async open() {
    await this.page.goto(this.route);
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.press(at(this.page, XP.pageTab(this.tab)).first(), 'tab');
    await expect(this.table, 'Summary Table loads').toBeVisible({ timeout: 30_000 });
    await this.stable();
  }
  /** Waits until the main text stops changing. */
  async stable(ms = 600) {
    let last = '';
    for (let i = 0; i < 30; i++) {
      const now = await this.main.innerText().catch(() => '');
      if (now && now === last && !/Loading/i.test(now.slice(0, 4000))) return;
      last = now;
      await this.page.waitForTimeout(ms);
    }
  }
  /** Clicks; when something lies on top (reminder cards), records it and clicks with a DOM event. */
  async press(loc: Locator, what: string) {
    const c = await coverOf(loc).catch(() => '');
    if (c) { this.covered[what] = c; await loc.dispatchEvent('click'); } else await loc.click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(400);
  }
  button(name: string) { return this.main.getByRole('button', { name, exact: true }).first(); }

  async lines(): Promise<string[]> { return (await this.main.innerText()).split('\n').map(s => s.trim()).filter(Boolean); }
  async asOf(word: string): Promise<string> {
    return clean(await at(this.page, XP.avsHeader(this.tab)).locator('span', { hasText: word }).first().innerText());
  }

  /** Summary line "<project>: 133 total units across 4 blocks · 128 Available ($205.79M) · 1 Reserved ($857k) · 4 Sold ($3.83M)". */
  async summary(unitsWord: string) {
    const text = clean((await this.lines()).find(l => l.includes(` ${unitsWord} `)) ?? '');
    const total = Number((text.match(new RegExp(`(\\d[\\d,]*) ${unitsWord}`)) ?? ['', 'NaN'])[1].replace(/,/g, ''));
    const blocks = Number((text.match(/across (\d+) block/) ?? ['', 'NaN'])[1]);
    const parts: Record<string, { n: number; value: number; shown: string }> = {};
    for (const m of text.matchAll(/(\d[\d,]*)\s+([A-Za-z]+)(?:\s*\(([^)]*)\))?/g)) {
      if (/units|block/i.test(m[2])) continue;
      parts[m[2]] = { n: Number(m[1].replace(/,/g, '')), value: m[3] ? amount(m[3]) : 0, shown: m[3] ?? '' };
    }
    return { text, total, blocks, parts };
  }

  async rows(): Promise<SumRow[]> { return readCountTable(this.table); }
  async expandAll(button: string) { await this.press(this.button(button), button); await this.stable(); }
  async view(name: string) {
    const b = at(this.page, XP.pmView(name)).first();
    if ((await b.getAttribute('aria-pressed')) !== 'true') await this.press(b, `view ${name}`);
    await this.stable();
  }

  filter(label: string) { return at(this.page, XP.avsFilter(label)).first(); }
  async options(label: string) { return (await this.filter(label).locator('option').allTextContents()).map(clean); }
  async choose(label: string, option: string | number) {
    await this.filter(label).selectOption(typeof option === 'number' ? { index: option } : { label: option });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.stable();
  }

  /** Category chips: "Apartment 86/90" → { name, avail, total, active }. */
  async categories() {
    return at(this.page, XP.avsCategoryChips).evaluateAll(bs => bs.map(b => {
      const t = (b as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
      const m = t.match(/^(.*?)\s+(\d+)\s*\/\s*(\d+)$/);
      return { name: m?.[1] ?? t, avail: Number(m?.[2]), total: Number(m?.[3]), active: b.getAttribute('aria-pressed') === 'true' || b.classList.contains('is-active') };
    }));
  }
  async category(name: string) { await this.press(at(this.page, XP.avsCategoryChip(name)).first(), `category ${name}`); await this.stable(); }

  // ── Stack Plan ──
  /** Status chips: "All (133)", "Available (128)" … → name → count. */
  async statusChips(): Promise<Record<string, number>> {
    return this.main.locator('button.crm-building-chip').evaluateAll(bs => Object.fromEntries(bs.map(b => (b as HTMLElement).innerText.replace(/\s+/g, ' ').trim())
      .map(t => t.replace(/^[AHRS]\s*(?=[A-Z])/, '').match(/^(.*?)\s*\((\d+)\)$/)).filter(Boolean).map(m => [m![1], Number(m![2])])));
  }
  async statusChip(name: string) { await this.press(at(this.page, XP.avsStatusChip(name)).first(), `status ${name}`); await this.stable(); }
  async tiles(root: Locator = this.main): Promise<Tile[]> {
    return root.locator('button.crm-building-tile').evaluateAll(bs => bs.map(b => {
      const [code, status] = (b.getAttribute('aria-label') ?? '').split(',').map(s => s.trim());
      const spans = [...b.querySelectorAll(':scope > div:nth-of-type(2) span')].map(s => (s as HTMLElement).innerText.trim());
      const title = b.getAttribute('title') ?? '';
      // "Operative: 898,800 USD" or, from 1M, "Operative: 1.25M USD"
      const op = (title.match(/Operative:\s*([\d,.]+\s*[KMB]?)/) ?? ['', ''])[1].replace(/,/g, '').trim();
      const opN = op ? Number(op.replace(/[KMB]$/, '')) * ({ K: 1e3, M: 1e6, B: 1e9 } as Record<string, number>)[op.slice(-1)] || Number(op) : NaN;
      return {
        code, status, letter: (b.querySelector('.crm-status-pill') as HTMLElement | null)?.innerText.trim() ?? '', product: spans[0] ?? '',
        area: Number((spans[1] ?? '').replace(/[^\d.]/g, '')), price: (b.querySelector(':scope > div:last-of-type strong') as HTMLElement | null)?.innerText.trim() ?? '',
        operative: opN, operativeShown: op, floor: (title.match(/Floor:\s*([^|\n]+)/) ?? ['', ''])[1].trim(), dimmed: b.classList.contains('is-dimmed'),
      };
    }));
  }
  /** Block headers of the Stack Plan: "Block D" / "43 Floors · 86 Units" / "Avail: 82 ($73.79M)" / "Reserved: 1" / "Sold: 3". */
  async blockHeaders() {
    const l = await this.lines();
    const out: { block: string; floors: number; units: number; parts: Record<string, number> }[] = [];
    l.forEach((x, i) => {
      const m = x.match(/^(\d+) Floors? · (\d+) Units?$/);
      if (!m) return;
      const parts: Record<string, number> = {};
      for (const y of l.slice(i + 1, i + 6)) { const p = y.match(/^([A-Za-z]+):\s*(\d+)/); if (p) parts[p[1]] = Number(p[2]); }
      out.push({ block: l[i - 1], floors: Number(m[1]), units: Number(m[2]), parts });
    });
    return out;
  }
  async search(text: string, placeholder: string) {
    await at(this.page, XP.searchBox(placeholder)).fill(text);
    await this.page.waitForTimeout(500);
    await this.stable();
  }
  tile(code: string) { return at(this.page, XP.avsTile(code)).first(); }

  // ── Windows ──
  get unitWindow() { return at(this.page, XP.avsUnitWindow); }
  get unitMix() { return at(this.page, XP.avsUnitMix); }
  /** Opens a tile's window and reads it: header, facts (caption → value) and the pricing matrix structure. */
  async openTile(code: string) {
    await this.press(this.tile(code), `tile ${code}`);
    await expect(this.unitWindow, `Unit window of ${code}`).toBeVisible({ timeout: 15_000 });
    return this.readUnitWindow();
  }
  async readUnitWindow() {
    return this.unitWindow.evaluate(w => {
      const pairs: Record<string, string> = {};
      for (const d of w.querySelectorAll('div')) {
        const s = d.querySelector(':scope > span'), st = d.querySelector(':scope > strong');
        if (s && st) pairs[(s as HTMLElement).innerText.trim()] = (st as HTMLElement).innerText.trim();
      }
      const text = (w as HTMLElement).innerText;
      return {
        header: text.split('\n')[0].trim(), code: (w.querySelector('h2') as HTMLElement | null)?.innerText.trim() ?? '',
        status: (w.querySelector('h2 + .crm-status-pill, h2 ~ span') as HTMLElement | null)?.innerText.trim() ?? '',
        pairs, text, buttons: [...w.querySelectorAll('button')].map(b => (b as HTMLElement).innerText.trim()),
      };
    });
  }
  unitButton(name: string) { return this.unitWindow.getByRole('button', { name, exact: true }).first(); }
  unitButtonStarting(prefix: string) { return this.unitWindow.locator('button').filter({ hasText: new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).first(); }

  /** Opens the Unit Mix window of a Summary Table row (block label, floor label or "Grand Total"). */
  async openUnitMix(row: string, button: string) {
    await this.press(at(this.page, XP.avsRowButton(row, button)).first(), `${button} of ${row}`);
    await expect(this.unitMix, `Unit Mix of ${row}`).toBeVisible({ timeout: 15_000 });
    await this.page.waitForTimeout(500);
  }
  async mixTitle() { return clean(await this.unitMix.locator('h3').first().innerText()); }
  /** Status cards of the Unit Mix window: "Available" → { n, value }. */
  async mixCards(): Promise<Record<string, { n: number; value: number; shown: string }>> {
    return this.unitMix.evaluate(w => {
      const out: Record<string, { n: number; value: number; shown: string }> = {};
      for (const d of w.querySelectorAll('div')) {
        const k = [...d.children] as HTMLElement[];
        if (k.length !== 3 || !/^\d+ units?$/.test(k[1].innerText.trim())) continue;
        const s = k[2].innerText.trim().replace(/,/g, '');
        const m = s.match(/(\d+(?:\.\d+)?)\s*([kKmMbB])?/);
        out[k[0].innerText.trim().toUpperCase()] = { n: Number(k[1].innerText.trim().split(' ')[0]), value: m ? Number(m[1]) * (({ k: 1e3, m: 1e6, b: 1e9 } as Record<string, number>)[(m[2] ?? '').toLowerCase()] ?? 1) : 0, shown: k[2].innerText.trim() };
      }
      return out;
    });
  }
  async mixView(name: string) {
    await this.unitMix.locator('button.crm-dashboard-view-segment-button').filter({ hasText: name }).first().click();
    await this.page.waitForTimeout(800);
  }
  async mixViews(): Promise<string[]> { return (await this.unitMix.locator('button.crm-dashboard-view-segment-button').allInnerTexts()).map(clean); }
  async mixRows(): Promise<SumRow[]> { return readCountTable(this.unitMix.locator('table').first()); }
  async mixHeaders(): Promise<string[]> { return (await this.unitMix.locator('table').first().locator('thead th').allInnerTexts()).map(clean); }
  /** Floor × Product Matrix: rows of [floor, cells "1/1 Avail" per product…]. */
  async mixMatrix(): Promise<{ products: string[]; rows: { floor: string; cells: { avail: number; total: number; shown: string }[]; total: number }[] }> {
    return this.unitMix.locator('table').first().evaluate(t => {
      const heads = [...t.querySelectorAll('thead th')];
      const products = heads.slice(1).map(h => (h.querySelector('div') as HTMLElement | null)?.innerText.trim() ?? '').filter(Boolean);
      const rows = [...t.querySelectorAll('tbody tr, tfoot tr')].map(r => {
        const c = [...r.children] as HTMLElement[];
        const cells = c.slice(1, 1 + products.length).map(td => {
          // "1/1 Avail" (available / units) or, when none is available, "1 Reserved" / "1 Sold" / "1 Held"
          const t2 = td.innerText.replace(/\s+/g, ' ').trim();
          const m = t2.match(/(\d+)\s*\/\s*(\d+)/);
          const other = t2.match(/^(\d+)\s+(Reserved|Sold|Held)/);
          return { avail: m ? Number(m[1]) : 0, total: m ? Number(m[2]) : other ? Number(other[1]) : 0, shown: t2 };
        });
        const tot = c.find(td => td.classList.contains('is-total'))?.querySelector('span')?.textContent ?? 'NaN';
        return { floor: c[0].innerText.trim(), cells, total: Number(tot) };
      });
      return { products, rows };
    });
  }
  scope() { return this.unitMix.locator('select').first(); }

  /** Drill-down unit selection under the table (opened by View Units / a block or floor link). */
  get drill() { return at(this.page, XP.avsDrill); }
  async drillInfo(heading: string) {
    const lines = (await this.lines());
    const i = lines.findIndex(l => l.toUpperCase() === heading.toUpperCase());
    const rows = await this.drill.evaluate(t => {
      const heads = [...t.querySelectorAll('thead th')].map(h => (h as HTMLElement).innerText.trim());
      return [...t.querySelectorAll('tbody tr')].map(r => Object.fromEntries([...r.children].map((c, k) => [heads[k], (c as HTMLElement).innerText.replace(/\s+/g, ' ').trim()])));
    });
    return { title: lines[i + 1] ?? '', line: lines.slice(i + 2, i + 8).join(' '), rows };
  }
  async closeWindow(w: Locator, name: string) {
    await w.getByRole('button', { name, exact: true }).last().click();
    await expect(w, `${name} closes the window`).toBeHidden({ timeout: 10_000 });
  }
}
