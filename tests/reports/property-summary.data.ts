/**
 * Expected-value rules for the RPT-21 Summary by Property Type suite (property-summary.spec.ts).
 * Nothing here names a category or unit: each category row is matched to an Inventory unit type by name, and its
 * expected keys, carpet area, base value (net area × the product's rate per sqm), sold keys and contracted value
 * are worked out at run time from Inventory units, products and SPA contracts for the selection the report says
 * it applied.
 */
import type { ReportData } from '../pages/SingleReportPage';
import type { Contract, Product, Unit } from '../pages/CrmData';
import { REP_TEXT } from '../locators';
import { EXECUTED } from './executive-dashboard.data';
import { words } from './data-dictionary.data';

export const K = REP_TEXT.propertySummary.keys;

/** Absorption % is shown with one decimal. */
export const PCT_DECIMALS = 1;

/** A filter selection in source-module terms (sales columns follow the period and view; inventory ones do not). */
export type Criteria = { from: string; to: string; projectCode?: string; ownerUserId?: string };

export function criteriaOf(data: ReportData, myUserId?: string): Criteria {
  const q = data.query;
  return {
    from: q.period === 'custom' ? q.from : data.meta.period.from,
    to: q.period === 'custom' ? q.to : data.meta.period.to,
    projectCode: q.projectCode,
    ownerUserId: q.view === 'self' ? myUserId : undefined,
  };
}

/** The Inventory unit type a category names ("3 Bedrooms Apartments" → "Apartment"), if any. */
export function typeOf(category: string, unitTypes: string[]): string | undefined {
  const w = new Set(words(category).map(x => x.replace(/s$/, '')));
  return unitTypes.find(t => w.has(t.toLowerCase().replace(/s$/, '')));
}

export type Figures = { keys: number; area: number; base: number; sold: number; contracted: number };

/** Expected figures of one unit type (or all types) for a selection. */
export function figures(src: { units: Unit[]; products: Product[]; contracts: Contract[] }, c: Criteria, unitType?: string): Figures {
  const rate = new Map(src.products.map(p => [p.productCode, p.ratePerSqm]));
  const units = src.units.filter(u => (!unitType || u.unitType === unitType) && (!c.projectCode || u.projectCode === c.projectCode));
  const codes = new Set(units.map(u => u.unitCode));
  const sold = src.contracts.filter(k => k.status === EXECUTED && k.unitCode && codes.has(k.unitCode)
    && (k.signedDay || k.contractDay) >= c.from && (k.signedDay || k.contractDay) <= c.to
    && (!c.ownerUserId || k.ownerUserId === c.ownerUserId));
  return {
    keys: units.length,
    area: units.reduce((s, u) => s + u.netArea, 0),
    base: units.reduce((s, u) => s + u.netArea * (rate.get(u.productCode ?? '') ?? 0), 0),
    sold: new Set(sold.map(k => k.unitCode)).size,
    contracted: sold.reduce((s, k) => s + k.value, 0),
  };
}

/** A row's figures as the report gives them. */
export const reported = (r: Record<string, unknown>): Figures => ({
  keys: Number(r[K.keys]), area: Number(r[K.area]), base: Number(r[K.base]), sold: Number(r[K.sold]), contracted: Number(r[K.contracted]),
});

/** Absorption % from sold and total keys, rounded as the report shows it. */
export const absorption = (sold: number, keys: number) => keys ? Number((sold / keys * 100).toFixed(PCT_DECIMALS)) : 0;
