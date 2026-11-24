/**
 * Test data and rules for the RPT-03 Control & Assumptions Register suite (control-assumptions.spec.ts).
 * Nothing here names a parameter value: the allowed owners, review cadences and units, the stated base values and
 * the parameter count are read from the report's own methodology section, and rates are compared with the
 * Inventory products and RPT-01's methodology at run time.
 */
import { REP_TEXT } from '../locators';

const CA = REP_TEXT.controlAssumptions;

/** A register row keyed by column label. */
export type Row = Record<string, string>;

/** "$4,800" → 4800, "30.0%" → 30, "$91,871,074" → 91871074 (NaN when there is no number). */
export const value = (s: string) => {
  const m = String(s).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
};

/** Every number in a text ("Volume bonus >10 units" → [10]). */
export const numbers = (s: string) => [...String(s).replace(/,/g, '').matchAll(/\d+(?:\.\d+)?/g)].map(m => Number(m[0]));

/** Currency symbol of a currency code (USD → "$"), as the browser formats it. */
export const symbolOf = (code: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).formatToParts(0).find(p => p.type === 'currency')?.value ?? code;

/** The methodology entry that explains a term ("Owner: … (CFO, …)"), by its leading "term:". */
export const entry = (items: string[], term: string) =>
  items.map(i => i.replace(/\s+/g, ' ').trim()).find(i => i.startsWith(`${term}:`));

/** Values listed in an entry's parentheses ("(CFO, Sales Director, …)" → ["CFO", "Sales Director", …]). */
export function listed(items: string[], term: string): string[] {
  const e = entry(items, term);
  const m = e?.match(/\(([^)]*)\)\s*\.?$/) ?? e?.match(/\(([^)]*)\)/);
  return m ? m[1].split(',').map(s => s.trim()).filter(Boolean) : [];
}

/** The value an entry states in its first parentheses holding a number ("($4,800/sqm)" → "$4,800/sqm"). */
export const stated = (items: string[], term: string) => entry(items, term)?.match(/\(([^)]*\d[^)]*)\)/)?.[1];

/** Expected value format for a unit of measure: a percentage, or an amount in the report currency. */
export function formatFor(unit: string, currency: string): RegExp | undefined {
  if (unit === CA.percentUnit) return /^-?\d+(\.\d+)?%$/;
  if (unit.startsWith(currency)) return new RegExp(`^${symbolOf(currency).replace(/[$]/g, '\\$')}[\\d,]+(\\.\\d+)?$`);
  return undefined;
}

/** Unit types a per-area rate covers, from its parameter name ("Base Price / sqm - Apartments & Residences" → apartment, residence). */
export function unitTypesOf(parameter: string): string[] {
  const tail = parameter.split(' - ').slice(1).join(' - ');
  return tail.split(/&|,|\band\b/).map(t => t.trim().toLowerCase().replace(/s$/, '')).filter(Boolean);
}

/** Rate stated in RPT-01's methodology just before a word ("5% external …" → 5 for "external"). */
export const rateBefore = (text: string, word: string) =>
  Number(text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*%\\s*${word}`, 'i'))?.[1] ?? NaN);
