/**
 * Test data and expected-record rules for the RPT-05 Lead Register suite (lead-register.spec.ts).
 * Nothing here names a lead, project or person: the expected records are worked out at run time from the
 * Leads module (GET /leads items read while paging "All Leads") and the dates the report says it used.
 */
import type { ReportData } from '../pages/SingleReportPage';
import type { LeadApiItem } from '../pages/LeadsListPage';
import { PERIODS } from '../pages/ReportModulePage';

/** Lead records checked one by one against Lead Detail (REP-021). */
export const SAMPLE_SIZE = 5;
/** "Report Created Date & Time" must be this close to now. */
export const CREATED_WITHIN_MS = 15 * 60_000;
/** The table rounds amounts ("1.35M USD"); the export holds them in full. */
export const MONEY_TOLERANCE = 0.01;
/** Preset periods in dropdown order (Custom dates is tested on its own). */
export const PRESET_PERIODS = PERIODS.filter(p => p !== 'custom');

/** A filter selection in Leads-module terms. */
export type Criteria = { from?: string; to?: string; projectCode?: string; ownerUserId?: string; mine?: Set<string> };

const day = (iso?: string | null) => (iso ?? '').slice(0, 10);

/** The report request's selection → criteria; the period dates are the ones the report says it applied. */
export function criteriaOf(data: ReportData, mine?: Set<string>): Criteria {
  const q = data.query;
  return {
    from: q.period === 'custom' ? q.from : data.meta.period.from,
    to: q.period === 'custom' ? q.to : data.meta.period.to,
    projectCode: q.projectCode,
    ownerUserId: q.ownerUserId,
    mine: q.view === 'self' ? mine : undefined,
  };
}

/**
 * Leads a selection should list. The report does not say which lead date its period uses, so:
 *   must = leads whose captured AND created dates are in the period (missing one of these is a defect),
 *   may  = leads whose captured OR created date is in the period (showing anything else is a defect),
 *   byCaptured = the count by captured date, the date the Leads module shows and sorts by.
 */
export function expected(leads: LeadApiItem[], c: Criteria): { must: Set<string>; may: Set<string>; byCaptured: number } {
  const inPeriod = (d: string) => c.from === undefined || (!!d && d >= c.from && d <= (c.to ?? '9999-12-31'));
  const other = (l: LeadApiItem) =>
    (!c.projectCode || l.preferredProjectCode === c.projectCode) &&
    (!c.ownerUserId || (c.ownerUserId === 'unassigned' ? !l.assignedToUser?.id : l.assignedToUser?.id === c.ownerUserId)) &&
    (!c.mine || c.mine.has(l.leadNo));
  const match = leads.filter(other);
  const cap = (l: LeadApiItem) => inPeriod(day(l.capturedAt));
  const cre = (l: LeadApiItem) => inPeriod(day(l.createdAt));
  return {
    must: new Set(match.filter(l => cap(l) && cre(l)).map(l => l.leadNo)),
    may: new Set(match.filter(l => cap(l) || cre(l)).map(l => l.leadNo)),
    byCaptured: match.filter(cap).length,
  };
}

/** True when the period [from, to] holds both dates of every lead. */
export const coversAll = (leads: LeadApiItem[], from: string, to: string) =>
  leads.every(l => [day(l.capturedAt), day(l.createdAt)].every(d => d >= from && d <= to));

/** Distinct captured dates, oldest first (to build a custom range that holds some but not all leads). */
export const capturedDays = (leads: LeadApiItem[]) => [...new Set(leads.map(l => day(l.capturedAt)).filter(Boolean))].sort();

/** n distinct random items (the picks are logged by the test, so a failure can be repeated by hand). */
export function sample<T>(items: T[], n: number): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, n);
}
