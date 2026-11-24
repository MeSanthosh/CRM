/**
 * Shared pieces of the Pricing Matrix tests (IVP-061 …): the `pm` / `rules` fixtures, settings of the
 * Pricing / Sales Settings sheets and the formulas of the 2-layer engine. No unit code or price is fixed:
 * every expected figure is worked out from what the page shows at run time.
 */
import { test as base, expect, note, DATA, ivp, ivpRow } from './shared';
import { PricingMatrixPage, PricingRulesPage, PMRow, PMHeader, money, pct, nameOf } from '../pages/PricingMatrixPage';
import type { Row } from '../leads-page/test-data';

export { expect, note, DATA, ivp, ivpRow, money, pct, nameOf };
export type { PMRow, PMHeader };

const settingOf = (sheet: string) => (k: string): string => {
  const r = DATA.sheet(sheet).find(x => x['Setting'] === k);
  if (!r) throw new Error(`Setting "${k}" missing on the ${sheet} sheet of ${DATA.source}`);
  return r['Value'];
};
export const PS = settingOf('Pricing Settings');
export const SS = settingOf('Sales Settings');
export const list = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);
export const sheet = (name: string): Row[] => DATA.sheet(name);
export const tol = () => Number(PS('Rounding Tolerance'));
/** Same amount within the rounding of whole dollars (`n` amounts added up → n × the tolerance). */
export const sameMoney = (a: number, b: number, n = 1) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol() * n + 1e-6;
export const r2 = (x: number) => Math.round(x * 100) / 100;
/** Rounding step of a shown amount: "5.76M USD" → 10,000; "856,800 USD" → 1. */
export function stepOf(shown: string): number {
  const m = (shown ?? '').replace(/,/g, '').match(/\d+(?:\.(\d+))?\s*([kKmMbB])?(?![a-z])/);
  if (!m) return 0;
  return 10 ** -(m[1]?.length ?? 0) * ({ k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? '').toLowerCase() as 'k' | 'm' | 'b'] ?? 1);
}
/** A shown amount (exact, or rounded like "5.76M USD" in the unit window) equals an exact amount. */
export const sameShown = (shown: string, exact: number, n = 1) => Number.isFinite(exact) && Math.abs(money(shown) - exact) <= stepOf(shown) / 2 + tol() * n + 1e-6;

export const test = base.extend<{ pm: PricingMatrixPage; rules: PricingRulesPage }>({
  pm: async ({ page }, use) => {
    page.setDefaultTimeout(30_000);
    await use(new PricingMatrixPage(page, DATA.setting('Inventory Route'), PS('Pricing Tab')));
  },
  rules: async ({ page }, use) => { await use(new PricingRulesPage(page)); },
});

// ── Matrix columns ──────────────────────────────────────────────────────────
/** Column of the price floor ("Floor (-3%)"), not the floor premium ("Floor %"). */
export const floorColumn = (h: PMHeader) => h.columns.find(c => c.startsWith(PS('Floor Header Pattern')) && /%\)$/.test(c)) ?? '';
/** Discount limit from the price-floor header "Floor (-3%)" → 3. */
export const discountOf = (h: PMHeader) => Math.abs(pct(floorColumn(h), false));
/** Tier columns of the Full 2-Layer view: header "Prem I (+3%)" → { header, pct }. */
export const tierColumns = (h: PMHeader) => {
  const g = h.groups.findIndex(x => /Layer 2/i.test(x.name));
  if (g < 0) return [];
  const start = h.groups.slice(0, g).reduce((a, x) => a + x.span, 0);
  return h.columns.slice(start, start + h.groups[g].span).map(c => ({ header: c, pct: pct(c, false) }));
};
/** "Premium Tier II" / "PREMIUM_2" / "PREMIUM_II" / "Prem II" → "PREM2": one key per tier, whatever the spelling. */
const tierKey = (s: string) => s.toUpperCase().replace(/TIER/g, ' ').replace(/[^A-Z0-9]+/g, ' ').trim()
  .replace(/\bIII\b/, '3').replace(/\bII\b/, '2').replace(/\bI\b/, '1').replace(/\s+/g, '').replace(/^PREMIUM/, 'PREM');
/** Tier option of a row ("Active Tier: STANDARD" → the Tier Codes row whose option is "Standard"). */
export function tierOf(r: PMRow): Row | undefined {
  const word = tierKey((r.titles['Tier'] ?? '').replace(PS('Tier Title Word'), ''));
  const code = r.cells['Tier'];
  return sheet('Tier Codes').find(t => [t['Tier Option'], t['Sales Edit Option'], t['Matrix Tier Header']].some(x => tierKey(x) === word) || t['Tier Column Code'] === code);
}
/** Tier column of a Tier Codes row in the Full 2-Layer header ("Prem I" → "Prem I (+3%)"). */
export const tierColumnOf = (h: PMHeader, t: Row | undefined) => t ? tierColumns(h).find(c => c.header.startsWith(`${t['Matrix Tier Header']} (`)) : undefined;

/** Premiums of a row from the Total % tooltip "Floor (01): -2% · View (Partial Ocean View): +4% · Orient (East Facing): 0% · Pos (Standard): 0%". */
export function premiums(r: PMRow): Record<string, { name: string; pct: number }> {
  const out: Record<string, { name: string; pct: number }> = {};
  for (const part of list(PS('Premium Title Parts'))) {
    const m = r.titles['Total %'].match(new RegExp(`${part}\\s*\\(([^)]*)\\):\\s*([+-]?\\d+(?:\\.\\d+)?)%`));
    out[part] = m ? { name: m[1].trim(), pct: Number(m[2]) } : { name: '', pct: NaN };
  }
  return out;
}
/** "Block D (Code: T) · Floor 01" → { block: "Block D", code: "T", floor: 1 } */
export function blockFloor(r: PMRow) {
  const t = r.titles['Blk/Flr'];
  const code = (t.match(new RegExp(`${PS('Block Title Word')}\\s*([^)]+)\\)`)) ?? ['', ''])[1].trim();
  const fl = t.match(/Floor\s+(\S+)/)?.[1] ?? '';
  return { block: t.split(' (')[0].trim(), code, floorText: fl, floor: /^\d+$/.test(fl) ? Number(fl) : 0 };
}

/** The numbers of a row (Full 2-Layer view). */
export function figures(r: PMRow, h: PMHeader) {
  const c = r.cells;
  return {
    carpet: Number(c['Carpet']), rate: money(c['Base Rate']), std: money(c['Std Price']),
    floorPct: pct(c['Floor %']), viewPct: pct(c['View']), otherPct: pct(c['Other %']), totalPct: pct(c['Total %']),
    netAdj: money(c['Net Adj']), adj: money(c['Adj Std']), current: money(c['Current Price']), floor: money(c[floorColumn(h)]),
    tiers: tierColumns(h).map(t => ({ ...t, price: money(c[t.header]) })),
  };
}

/** Summary line → its numbers. */
export function parseSummary(text: string) {
  const [std, uplift, gdv, floor] = list(PS('Summary Labels'));
  const after = (label: string) => money((text.split(`${label}:`)[1] ?? '').split('·')[0]);
  return {
    units: Number((text.match(new RegExp(`${PS('Summary Start')}\\s+(\\d[\\d,]*)`)) ?? ['', 'NaN'])[1].replace(/,/g, '')),
    carpet: Number((text.match(/Total Carpet:\s*([\d,.]+)/) ?? ['', 'NaN'])[1].replace(/,/g, '')),
    avg: Number((text.match(/Avg:\s*([\d,.]+)/) ?? ['', 'NaN'])[1].replace(/,/g, '')),
    std: after(std), uplift: after(uplift), upliftPct: pct((text.split(`${uplift}:`)[1] ?? '').split('·')[0], false), gdv: after(gdv), floor: after(floor),
  };
}

/** Never-click buttons of the data: they must be there, and no test presses them. */
export const neverClick = () => list(PS('Never Click Buttons'));
/** Broken texts that must not appear anywhere. */
export const broken = (text: string) => list(PS('Broken Values')).filter(b => new RegExp(`(^|\\W)${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\W|$)`).test(text));

/** Filter rows of the Pricing Filters sheet. */
export const filters = () => sheet('Pricing Filters');
export const filterLabels = () => filters().map(f => f['Label']);
/** "Block D (86)" → { name: "Block D", count: 86 } (count NaN when the option has none). */
export const optionOf = (o: string) => ({ name: o.replace(/\s*\((\d+|[+-]?\d+(?:\.\d+)?%)\)\s*$/, '').trim(), count: Number((o.match(/\((\d+)\)\s*$/) ?? ['', 'NaN'])[1]) });

/** Does a row match a filter option? (Project is matched through `projectOf`, learnt by filtering.) */
export function matches(r: PMRow, filter: string, option: string, projectOf?: Map<string, string>): boolean {
  const name = optionOf(option).name;
  switch (filter) {
    case 'Project': return projectOf?.get(r.code) === option;
    case 'Block': return blockFloor(r).block === name;
    case 'Product': return r.cells['Product'] === name;
    case 'Status': return r.cells['Status'].toLowerCase() === name.toLowerCase();
    case 'Tier': return tierOf(r)?.['Tier Option'] === name;
    default: throw new Error(`Unknown filter ${filter}`);
  }
}

/**
 * Rows (Full 2-Layer) whose figures do not follow the 2-layer formulas — standard, net adj, adjusted, tiers,
 * current price, floor — and, when `rates` is given, whose base rate is not the rule of its product.
 */
export function formulaErrors(h: PMHeader, rows: PMRow[], rates?: Map<string, number>): string[] {
  const disc = discountOf(h);
  const out: string[] = [];
  for (const r of rows) {
    const f = figures(r, h);
    const col = tierColumnOf(h, tierOf(r));
    const bad = [
      rates && rates.get(r.cells['Product']) !== f.rate ? `rate ${f.rate} ≠ rule ${rates.get(r.cells['Product'])}` : '',
      !sameMoney(f.std, f.carpet * f.rate) ? `std ${f.std} ≠ ${f.carpet} × ${f.rate}` : '',
      !sameMoney(f.netAdj, f.std * f.totalPct / 100) ? `net adj ${f.netAdj}` : '',
      !sameMoney(f.adj, f.std + f.netAdj) ? `adj ${f.adj}` : '',
      ...f.tiers.filter(t => !sameMoney(t.price, f.adj * (1 + t.pct / 100))).map(t => `${t.header} ${t.price}`),
      !col || !sameMoney(f.current, money(r.cells[col.header])) ? `current ${f.current} ≠ tier ${r.cells['Tier']}` : '',
      !sameMoney(f.floor, f.current * (1 - disc / 100)) ? `floor ${f.floor}` : '',
    ].filter(Boolean);
    if (bad.length) out.push(`${r.code}: ${bad.join(', ')}`);
  }
  return out;
}

/** Expected 2-layer figures from inputs (rules or a saved Sales form). */
export function engine(i: { carpet: number; rate: number; premiumPct: number; tierPct: number; discount: number; tiers?: number[] }) {
  const std = i.carpet * i.rate;
  const netAdj = std * i.premiumPct / 100;
  const adj = std + netAdj;
  const current = adj * (1 + i.tierPct / 100);
  return { std, netAdj, adj, current, floor: current * (1 - i.discount / 100), tiers: (i.tiers ?? []).map(t => adj * (1 + t / 100)) };
}
