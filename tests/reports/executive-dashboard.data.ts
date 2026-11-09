/**
 * Test data and expected-value rules for the RPT-01 Executive Dashboard suite (executive-dashboard.spec.ts).
 * Nothing here names a unit, contract or person: expected actuals are worked out at run time from the Inventory,
 * SPA Contracts and Marketing modules (CrmData) for the selection the report says it applied, and the rates come
 * from RPT-03 Control & Assumptions.
 */
import type { ReportData } from '../pages/SingleReportPage';
import type { Contract, Unit, Campaign } from '../pages/CrmData';
import { REP_TEXT } from '../locators';

const ED = REP_TEXT.executiveDashboard;
export const M = ED.metrics;

/** Amounts are compared within 0.5% (the table shows "210.48M USD"), other numbers within 0.05. */
export const DISPLAY_TOLERANCE = 0.005;
export const ABS_TOLERANCE = 0.05;
/** Variance (%) is shown with one decimal. */
export const PCT_DECIMALS = 1;
/**
 * Status tolerance: a "performing" flag (ON_TARGET, EXCEEDED, HEALTHY, OPTIMAL) is accepted down to this far below
 * target. The report does not state its "baseline underwriting tolerance", so the suite uses 10% and logs it.
 */
export const STATUS_TOLERANCE_PCT = 10;
/** Commission on a direct (no broker) sale, as the report's methodology states ("5% external / 2% direct split"). */
export const DIRECT_RATE = 0.02;
/** Contract status counted as executed (cancelled and draft contracts are not). */
export const EXECUTED = 'SIGNED';

/** A filter selection in source-module terms. */
export type Criteria = { from: string; to: string; projectCode?: string; ownerUserId?: string };

/** The report request's selection → criteria; the period dates are the ones the report says it applied. */
export function criteriaOf(data: ReportData, myUserId?: string): Criteria {
  const q = data.query;
  return {
    from: q.period === 'custom' ? q.from : data.meta.period.from,
    to: q.period === 'custom' ? q.to : data.meta.period.to,
    projectCode: q.projectCode,
    ownerUserId: q.view === 'self' ? myUserId : q.ownerUserId,
  };
}

/** Contracts a selection covers: executed, signed within the dates, of the project and salesperson. */
export function executedIn(contracts: Contract[], c: Criteria): Contract[] {
  return contracts.filter(k => k.status === EXECUTED
    && (k.signedDay || k.contractDay) >= c.from && (k.signedDay || k.contractDay) <= c.to
    && (!c.projectCode || k.projectCode === c.projectCode)
    && (!c.ownerUserId || (c.ownerUserId === 'unassigned' ? k.ownerUserId === null : k.ownerUserId === c.ownerUserId)));
}

/** "5.0%" → 0.05; "Volume bonus >10 units" → 10. */
export const rate = (s: string) => Number(String(s).replace(/[^\d.]/g, '')) / 100;
export const threshold = (s: string) => Number(String(s).match(/(\d+)/)?.[1] ?? Infinity);

export type Rates = { broker: number; tierBonus: number; tierAbove: number };

/** Broker rates from RPT-03 Control & Assumptions. */
export function ratesOf(assumptions: Record<string, string>[]): Rates {
  const row = (name: string) => assumptions.find(r => r.parameter === name);
  const std = row(REP_TEXT.controlAssumptions.brokerRate), tier = row(REP_TEXT.controlAssumptions.tierBonus);
  return { broker: std ? rate(std.baseValue) : NaN, tierBonus: tier ? rate(tier.baseValue) : 0, tierAbove: tier ? threshold(tier.controlLogic) : Infinity };
}

/**
 * Commission accrued on the given contracts: broker sales at the standard rate (+ the Tier 1 bonus for a broker
 * with more executed sales than the bonus threshold), direct sales at the direct rate.
 */
export function commission(selected: Contract[], allExecuted: Contract[], r: Rates): number {
  const salesPerBroker = new Map<string, number>();
  for (const k of allExecuted) if (k.brokerId) salesPerBroker.set(k.brokerId, (salesPerBroker.get(k.brokerId) ?? 0) + 1);
  return selected.reduce((s, k) => {
    if (!k.brokerId) return s + k.value * DIRECT_RATE;
    const bonus = (salesPerBroker.get(k.brokerId) ?? 0) > r.tierAbove ? r.tierBonus : 0;
    return s + k.value * (r.broker + bonus);
  }, 0);
}

export type Expected = { gross: number; spas: number; broker: number; contracts: Contract[]; units: number };

/** Current Actuals a selection should show, from the source modules. */
export function expectedActuals(src: { units: Unit[]; contracts: Contract[]; rates: Rates }, c: Criteria): Expected {
  const units = src.units.filter(u => !c.projectCode || u.projectCode === c.projectCode);
  const contracts = executedIn(src.contracts, c);
  return {
    gross: units.reduce((s, u) => s + u.basePrice, 0),
    spas: contracts.reduce((s, k) => s + k.value, 0),
    broker: commission(contracts, src.contracts.filter(k => k.status === EXECUTED), src.rates),
    contracts,
    units: units.length,
  };
}

export const totalBudget = (campaigns: Campaign[]) => campaigns.reduce((s, c) => s + c.budget, 0);

/** Same value within the display tolerance (amounts) or the absolute tolerance (small numbers). */
export const close = (a: number, b: number) =>
  Math.abs(a - b) <= Math.max(ABS_TOLERANCE, Math.abs(b) * DISPLAY_TOLERANCE);

/** A metric's row in the report data, by its Metric Category. */
export function metric(data: ReportData, name: string): Record<string, unknown> | undefined {
  return data.rows.find(r => r.metricCategory === name);
}

/** Distinct signed days of executed contracts, oldest first (to build a custom range holding some but not all). */
export const signedDays = (contracts: Contract[]) =>
  [...new Set(contracts.filter(k => k.status === EXECUTED).map(k => k.signedDay || k.contractDay).filter(Boolean))].sort();
