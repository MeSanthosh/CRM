/**
 * Expected-value rules for the RPT-20 Project Cash Flow Forecast suite (cash-flow.spec.ts).
 * Buyer inflows come from the signed SPAs' payment-plan lines by due month; broker commission from the RPT-03 rate
 * and the timing the methodology states; the opening escrow balance from the receipts cleared in escrow (RPT-10).
 * Stated horizons, counts and totals are read from the methodology at run time; nothing names a value.
 */
import type { Contract, PaymentLine } from '../pages/CrmData';
import { REP_TEXT } from '../locators';
import { entry, numbers, value } from './control-assumptions.data';
import { EXECUTED } from './executive-dashboard.data';
import { monthOf, moneyIn } from './smart-forecast.data';

const CF = REP_TEXT.cashFlow;
export const K = CF.keys;
export { monthOf, moneyIn, nextMonth } from './smart-forecast.data';

/** The label a period should have at its place in the horizon (0 → "M01"). */
export const codeAt = (i: number) => `M${String(i + 1).padStart(2, '0')}`;

/** What the methodology states (undefined / NaN where it states nothing). */
export function statedFigures(items: string[]) {
  const horizon = [...(entry(items, CF.columns[0]) ?? '').matchAll(/M\d+\s*\(\w{3}\s+\d{4}\)/g)].map(m => monthOf(m[0])?.ym);
  return {
    from: horizon[0], to: horizon[1],
    periods: value((entry(items, 'Total Records in Report') ?? '').match(/\(([^)]*)\)/)?.[1] ?? ''),
    escrow: moneyIn(entry(items, CF.columns[6]) ?? ''),
    /** [total inflows, total disbursements, net cash] */
    summary: moneyIn(entry(items, CF.summaryTerm) ?? ''),
    /** "50% on SPA signing and 50% on 20% collections" → [50, 50, 20] */
    broker: numbers(entry(items, CF.columns[3]) ?? ''),
  };
}

/** Payment-plan amounts of signed SPAs by due month ("2026-11" → amount). */
export function inflowsByMonth(lines: PaymentLine[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const l of lines) if (l.contractStatus === EXECUTED && l.dueDay) out.set(l.dueDay.slice(0, 7), (out.get(l.dueDay.slice(0, 7)) ?? 0) + l.amount);
  return out;
}

/**
 * Broker commission by month as the methodology describes it: per signed SPA, `rate` % of its value, the first share
 * in the signing month and the rest in the month its payment-plan lines reach `threshold` % of the value.
 */
export function brokerByMonth(contracts: Contract[], lines: PaymentLine[], rate: number, first: number, threshold: number) {
  const out = new Map<string, number>();
  const add = (m: string, v: number) => out.set(m, (out.get(m) ?? 0) + v);
  for (const c of contracts.filter(k => k.status === EXECUTED)) {
    const commission = c.value * rate / 100;
    add((c.signedDay || c.contractDay).slice(0, 7), commission * first / 100);
    let due = 0, reached = '';
    for (const l of lines.filter(x => x.contractNo === c.contractNo).sort((a, b) => a.dueDay.localeCompare(b.dueDay))) {
      due += l.amount;
      if (due >= c.value * threshold / 100) { reached = l.dueDay.slice(0, 7); break; }
    }
    if (reached) add(reached, commission * (100 - first) / 100);
  }
  return out;
}

/** Sum of the receipts a ledger shows as cleared in escrow (each receipt once). */
export function clearedInEscrow(rows: Record<string, unknown>[]) {
  const seen = new Set<unknown>();
  return rows.filter(r => r[CF.ledger.status] === CF.ledger.cleared && !seen.has(r.id) && seen.add(r.id))
    .reduce((s, r) => s + (Number(r[CF.ledger.received]) || 0), 0);
}
