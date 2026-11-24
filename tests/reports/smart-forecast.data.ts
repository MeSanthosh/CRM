/**
 * Expected-value rules for the RPT-19 Smart Sales Forecast suite (smart-forecast.spec.ts).
 * Each forecast month is checked against its own arithmetic and the report's methodology; the pipeline volume and
 * probability against the Opportunities module, the selling price and absorption against Inventory. The stated
 * figures (probability, ranges, totals, horizon) are read from the methodology at run time; nothing names a value.
 */
import type { Opportunity, Unit } from '../pages/CrmData';
import { REP_TEXT } from '../locators';
import { entry, value } from './control-assumptions.data';

const SF = REP_TEXT.smartForecast;
export const K = SF.keys;
/** Probabilities are compared to half a percentage point. */
export const PROBABILITY_POINTS = 0.5;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ym = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

/** "M06 (Jun 2026)" → { code: "M06", n: 6, ym: "2026-06" } (undefined when the label has another form). */
export function monthOf(label: string): { code: string; n: number; ym: string } | undefined {
  const m = String(label).trim().match(/^(M(\d+))\s*\((\w{3})\s+(\d{4})\)$/);
  const month = m ? MONTHS.indexOf(m[3]) + 1 : 0;
  return m && month ? { code: m[1], n: Number(m[2]), ym: ym(Number(m[4]), month) } : undefined;
}

/** The month after "2026-06" → "2026-07". */
export const nextMonth = (s: string) => {
  const [y, m] = s.split('-').map(Number);
  return m === 12 ? ym(y + 1, 1) : ym(y, m + 1);
};

/** "$1.56M", "$108,600,001" → 1560000, 108600001 (every money amount in a text). */
export const moneyIn = (text: string) =>
  [...String(text).replace(/,/g, '').matchAll(/\$\s?(\d+(?:\.\d+)?)\s*([KMB])?\b/g)]
    .map(m => Number(m[1]) * ({ K: 1e3, M: 1e6, B: 1e9 }[m[2] as 'K' | 'M' | 'B'] ?? 1));

/** What the methodology states, read from its entries (undefined / NaN where it states nothing). */
export function statedFigures(items: string[]) {
  const all = items.join(' ');
  const horizon = (entry(items, SF.columns[0]) ?? '').match(/M(\d+)\s+(\w{3})\s+(\d{4})\s+(?:to|through)\s+M(\d+)\s+(\w{3})\s+(\d{4})/);
  const from = horizon ? monthOf(`M${horizon[1]} (${horizon[2]} ${horizon[3]})`) : undefined;
  const to = horizon ? monthOf(`M${horizon[4]} (${horizon[5]} ${horizon[6]})`) : undefined;
  const absorption = all.match(/(\d+)\s*(?:to|-|–)\s*(\d+)\s*units\s*\/\s*month/i);
  const totalText = items.find(i => /total forecast/i.test(i)) ?? '';
  return {
    from, to,
    months: value((entry(items, 'Total Records in Report') ?? '').match(/\(([^)]*)\)/)?.[1] ?? ''),
    probability: value((entry(items, SF.columns[2]) ?? '').match(/\(([^)]*%[^)]*)\)/)?.[1] ?? ''),
    price: moneyIn(entry(items, SF.columns[4]) ?? ''),
    absorption: absorption ? [Number(absorption[1]), Number(absorption[2])] : [],
    total: moneyIn(totalText)[0],
    units: Number(all.match(/(\d+)\s+absorption units/i)?.[1] ?? NaN),
    kpi06: items.find(i => /^KPI-06\b/.test(i))?.match(/:\s*(.+?)\s+—/)?.[1]?.trim() ?? '',
  };
}

/** The escalation factor of a "Base_Rate * 1.03" formula, as a percentage (3). */
export const escalationOf = (formula: string) => {
  const m = formula.match(/Base_Rate\s*\*\s*(\d+(?:\.\d+)?)/);
  return m ? Number(((Number(m[1]) - 1) * 100).toFixed(2)) : NaN;
};

/** Same formula, ignoring spaces. */
export const sameFormula = (a: string, b: string) => a.replace(/\s+/g, '') === b.replace(/\s+/g, '');

/**
 * Open opportunities that may close in a month: those with an expected close date in it surely do; those with no
 * close date may (the report does not say where it places them).
 */
export function pipelineFor(opps: Opportunity[], month: string) {
  const open = opps.filter(o => o.status === SF.openStatus);
  const dated = open.filter(o => o.closeDay.slice(0, 7) === month);
  const undated = open.filter(o => !o.closeDay);
  return { must: dated.length, may: dated.length + undated.length, records: dated.map(o => o.opportunityNo), undated: undated.length };
}

/** The pipeline's average and budget-weighted stage probability, and the historical closing yield (won ÷ won + lost). */
export function probabilities(opps: Opportunity[]) {
  const open = opps.filter(o => o.status === SF.openStatus);
  const won = opps.filter(o => o.status === SF.wonStatus).length;
  const lost = opps.filter(o => o.status === SF.lostStatus).length;
  const budget = open.reduce((s, o) => s + o.budget, 0);
  return {
    open: open.length, won, lost,
    mean: open.length ? open.reduce((s, o) => s + o.probability, 0) / open.length : NaN,
    weighted: budget ? open.reduce((s, o) => s + o.probability * o.budget, 0) / budget : NaN,
    yield: won + lost ? won / (won + lost) * 100 : NaN,
  };
}

/** Base prices of the units for sale (and of all units). */
export function prices(units: Unit[]) {
  const forSale = units.filter(u => u.availability === SF.available).map(u => u.basePrice);
  const all = units.map(u => u.basePrice);
  const avg = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN;
  return { available: forSale.length, availableAvg: avg(forSale), allAvg: avg(all), min: Math.min(...forSale), max: Math.max(...forSale) };
}
