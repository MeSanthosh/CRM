/**
 * Rules for the RPT-18 Revenue Management Engine suite (revenue-management.spec.ts).
 * Each sub-category row is matched to its Inventory product (unit type, sub-type, bedrooms, sqm); the demand
 * thresholds are read from the report's methodology; expected absorption comes from SPA contracts and reservations
 * in the current quarter at run time. Nothing names a product or unit.
 */
import type { Contract, Product, Reservation, Unit } from '../pages/CrmData';
import { REP_TEXT } from '../locators';
import { EXECUTED } from './executive-dashboard.data';
import { words } from './data-dictionary.data';

const RM = REP_TEXT.revenueManagement;
export const K = RM.keys;
/** Target Achievement % is shown with one decimal; adjusted rates in whole currency units. */
export const PCT_DECIMALS = 1;

/** "3BR Apartment Type A (175 sqm)" → its product: same unit type, sub-type, bedrooms and net area. */
export function productOf(name: string, products: Product[]): Product | undefined {
  const sqm = Number(name.match(/\((\d[\d,]*)\s*sqm\)/i)?.[1]?.replace(/,/g, '') ?? NaN);
  const bedrooms = Number(name.match(/(\d+)\s*BR\b/i)?.[1] ?? NaN);
  const w = ` ${words(name).join(' ')} `;
  return products.find(p => p.netArea === sqm && p.bedrooms === bedrooms
    && w.includes(` ${p.unitType.toLowerCase()}`) && w.includes(` ${words(p.subType).join(' ')} `));
}

/** A status band read from the methodology: "(≥ 110%)", "(50%–110%)", "below 50%". */
export type Band = { status: string; min: number; max: number };

/** Demand bands from the methodology entries ("HIGH_DEMAND: Absorption exceeding target (≥ 110%) …"). */
export function bandsOf(items: string[], statuses: string[]): Band[] {
  const out: Band[] = [];
  for (const status of statuses) {
    const e = items.find(i => i.startsWith(`${status}:`));
    if (!e) continue;
    const range = e.match(/(\d+(?:\.\d+)?)\s*%?\s*[–-]\s*(\d+(?:\.\d+)?)\s*%/);
    const atLeast = e.match(/≥\s*(\d+(?:\.\d+)?)\s*%/);
    const below = e.match(/below\s+(\d+(?:\.\d+)?)\s*%/i);
    if (range) out.push({ status, min: Number(range[1]), max: Number(range[2]) });
    else if (atLeast) out.push({ status, min: Number(atLeast[1]), max: Infinity });
    else if (below) out.push({ status, min: -Infinity, max: Number(below[1]) });
  }
  return out;
}

/** The status an achievement falls in: open-ended bands (≥ / below) first, so a shared boundary goes to them. */
export function statusFor(achievement: number, bands: Band[]): string | undefined {
  const ordered = [...bands].sort((a, b) => Number(isFinite(a.min) && isFinite(a.max)) - Number(isFinite(b.min) && isFinite(b.max)));
  return ordered.find(b => (isFinite(b.max) && !isFinite(b.min) ? achievement < b.max : achievement >= b.min && achievement <= b.max))?.status;
}

/** The action the rule prescribes for a status and unit type. */
export function actionFor(status: string, unitType: string): string | undefined {
  const a = (RM.actions as Record<string, string | { premium: string; standard: string }>)[status];
  if (!a) return undefined;
  return typeof a === 'string' ? a : unitType === RM.premiumType ? a.premium : a.standard;
}

/** "Escalate Price (+3.0%)" → 3, "Apply Discount (-5.0%)" → -5, "Maintain Base Rate" → 0. */
export const adjustmentOf = (action: string) => Number(action.match(/\(([+-]?\d+(?:\.\d+)?)\s*%\)/)?.[1] ?? 0);

/** The calendar quarter holding a date, as yyyy-mm-dd bounds. */
export function quarterOf(d: Date): { from: string; to: string } {
  const q = Math.floor(d.getUTCMonth() / 3);
  const from = new Date(Date.UTC(d.getUTCFullYear(), q * 3, 1));
  const to = new Date(Date.UTC(d.getUTCFullYear(), q * 3 + 3, 0));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

/**
 * Units of a product absorbed in the quarter. The methodology counts "units contracted under executed SPAs or
 * confirmed reservations", so: must = units with an executed SPA signed in the quarter; may = those plus units with
 * a confirmed reservation dated in the quarter. `ownerUserId` limits both to one salesperson (Mine).
 */
export function absorbed(product: Product, src: { units: Unit[]; contracts: Contract[]; reservations: Reservation[] },
  q: { from: string; to: string }, ownerUserId?: string) {
  const codes = new Set(src.units.filter(u => u.productCode === product.productCode).map(u => u.unitCode));
  const inQ = (d: string) => d >= q.from && d <= q.to;
  const mine = (o: string | null) => !ownerUserId || o === ownerUserId;
  const spa = src.contracts.filter(k => k.status === EXECUTED && k.unitCode && codes.has(k.unitCode) && inQ(k.signedDay || k.contractDay) && mine(k.ownerUserId)).map(k => k.unitCode!);
  const rsv = src.reservations.filter(r => RM.confirmedReservations.includes(r.status) && r.unitCode && codes.has(r.unitCode) && inQ(r.day) && mine(r.ownerUserId)).map(r => r.unitCode!);
  return { must: new Set(spa).size, may: new Set([...spa, ...rsv]).size };
}
