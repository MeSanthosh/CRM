/**
 * Rules for the RPT-23 Master Data Dictionary & Report Index suite (data-dictionary.spec.ts).
 * Nothing here names a KPI: code ranges, allowed formula functions and the definition count come from the report's
 * methodology; sheets, formulas, unit counts and rates are compared with the catalogue, RPT-01, Inventory and
 * RPT-03 at run time. Methodology parsing (entry, listed, stated, numbers, value) is shared with RPT-03.
 */
export { entry, listed, stated, numbers, value } from './control-assumptions.data';

/** "Sheet 04 (133 Unit Inventory Master)" → { sheet: 4, name: "133 Unit Inventory Master" }. */
export function sheetOf(source: string): { sheet: number; name: string } | undefined {
  const m = source.match(/Sheet\s+(\d+)\s*(?:\(([^)]*)\))?/i);
  return m ? { sheet: Number(m[1]), name: (m[2] ?? '').trim() } : undefined;
}

/** Lower-case words of a name, without punctuation ("Sales Funnel & Conversion" → sales, funnel, conversion). */
export const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);

/** A report title "names" a sheet when it contains every word of the sheet's name. */
export const names = (title: string, sheetName: string) => {
  const t = new Set(words(title));
  return words(sheetName).every(w => t.has(w));
};

/** Report number of a catalogue code ("RPT-04" → 4; other codes → undefined). */
export const reportNo = (code: string, prefix: string) =>
  code.startsWith(prefix) && /^\d+$/.test(code.slice(prefix.length)) ? Number(code.slice(prefix.length)) : undefined;

/** Spreadsheet functions a formula calls ("SUMIFS(Unit_Value, …)" → ["SUMIFS"]). */
export const functionsIn = (formula: string) => [...formula.matchAll(/\b([A-Z][A-Z0-9_.]*)\s*\(/g)].map(m => m[1]);

/** "(e.g. KPI-01 to KPI-06)" → the codes in that range: KPI-01 … KPI-06. */
export function codeRange(text: string): string[] {
  const m = text.match(/([A-Z]+)-(\d+)\s+to\s+\1-(\d+)/);
  if (!m) return [];
  const width = m[2].length;
  const out: string[] = [];
  for (let n = Number(m[2]); n <= Number(m[3]); n++) out.push(`${m[1]}-${String(n).padStart(width, '0')}`);
  return out;
}

/** The sentence of a methodology that cites a sheet: from the "Calculated …" before it up to the sheet. */
export function statementFor(text: string, sheet: number): string | undefined {
  const at = text.search(new RegExp(`Sheet\\s+0*${sheet}\\b`));
  if (at < 0) return undefined;
  const start = text.lastIndexOf('Calculated', at);
  return start < 0 ? undefined : text.slice(start, at);
}

/** "all 133 units" → 133 (the number right before "unit"/"units"). */
export const unitCountIn = (s: string) => {
  const m = s.match(/(\d[\d,]*)\s+units?\b/i);
  return m ? Number(m[1].replace(/,/g, '')) : undefined;
};

/** "standard 5% fee" → 5. */
export const feeRateIn = (s: string) => {
  const m = s.match(/(\d+(?:\.\d+)?)\s*%\s*fee/i);
  return m ? Number(m[1]) : undefined;
};
