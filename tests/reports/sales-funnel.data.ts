/**
 * Expected-stage rules for the RPT-16 Sales Funnel & Conversion Analysis suite (sales-funnel.spec.ts).
 * Each stage is counted from its own module for the selection the report says it applied, by the date the record
 * entered the stage: leads captured (Lead Intake), leads qualified (SQL), opportunities created, reservations made,
 * SPAs signed. Project, salesperson, broker and campaign are taken from the record or, when it has none, from its
 * opportunity and lead. Nothing names a record.
 */
import type { ReportData } from '../pages/SingleReportPage';
import type { Contract, Lead, Opportunity, Reservation } from '../pages/CrmData';
import { REP_TEXT } from '../locators';
import { EXECUTED } from './executive-dashboard.data';

const SF = REP_TEXT.salesFunnel;
export const K = SF.keys;
/** Conversion percentages are shown with one decimal. */
export const PCT_DECIMALS = 1;

export type Sources = { leads: Lead[]; opportunities: Opportunity[]; reservations: Reservation[]; contracts: Contract[] };
export type Criteria = { from: string; to: string; projectCode?: string; ownerUserId?: string; brokerId?: string; campaignId?: string };

/** The report request's selection → criteria (Mine = the logged-in user as salesperson). */
export function criteriaOf(data: ReportData, myUserId?: string): Criteria {
  const q = data.query;
  return {
    from: q.period === 'custom' ? q.from : data.meta.period.from,
    to: q.period === 'custom' ? q.to : data.meta.period.to,
    projectCode: q.projectCode,
    ownerUserId: q.view === 'self' ? myUserId : q.ownerUserId,
    brokerId: q.brokerId,
    campaignId: q.campaignId,
  };
}

type Tags = { project?: string; owner: string | null; broker: string | null; campaign: string | null };

/** A stage's expected count: at least `must`, at most `may` (where the stage rule is not exact), and the records. */
export type Stage = { must: number; may: number; records: string[]; value?: number };

export function stagesFor(src: Sources, c: Criteria): Stage[] {
  const leadById = new Map(src.leads.map(l => [l.id, l]));
  const oppById = new Map(src.opportunities.map(o => [o.id, o]));
  const inP = (d?: string) => !!d && d >= c.from && d <= c.to;
  const leadTags = (l?: Lead): Tags => ({ project: l?.projectCode, owner: l?.ownerUserId ?? null, broker: l?.brokerId ?? null, campaign: l?.campaignId ?? null });
  const oppTags = (o?: Opportunity): Tags => {
    const l = leadTags(o?.leadId ? leadById.get(o.leadId) : undefined);
    return { project: o?.projectCode ?? l.project, owner: o?.ownerUserId ?? l.owner, broker: o?.brokerId ?? l.broker, campaign: l.campaign };
  };
  const fits = (t: Tags) => (!c.projectCode || t.project === c.projectCode)
    && (!c.ownerUserId || (c.ownerUserId === 'unassigned' ? t.owner === null : t.owner === c.ownerUserId))
    && (!c.brokerId || t.broker === c.brokerId)
    && (!c.campaignId || t.campaign === c.campaignId);

  const leads = src.leads.filter(l => fits(leadTags(l)));
  const intake = leads.filter(l => inP(l.capturedDay));
  const intakeMay = leads.filter(l => inP(l.capturedDay) || inP(l.createdDay));
  const sql = leads.filter(l => inP(l.qualifiedDay));
  const sqlMay = leads.filter(l => inP(l.qualifiedDay) || (SF.qualifiedStatuses.includes(l.status) && inP(l.capturedDay)));
  const opps = src.opportunities.filter(o => inP(o.createdDay) && fits(oppTags(o)));
  const rsvTags = (r: Reservation): Tags => {
    const o = oppTags(r.opportunityId ? oppById.get(r.opportunityId) : undefined);
    return { project: r.projectCode ?? o.project, owner: r.ownerUserId ?? o.owner, broker: r.brokerId ?? o.broker, campaign: o.campaign };
  };
  const rsvAll = src.reservations.filter(r => inP(r.day) && fits(rsvTags(r)));
  const rsv = rsvAll.filter(r => r.status !== SF.cancelledReservation);
  const spa = src.contracts.filter(k => {
    if (k.status !== EXECUTED || !inP(k.signedDay || k.contractDay)) return false;
    const o = oppTags(k.opportunityId ? oppById.get(k.opportunityId) : undefined);
    return fits({ project: k.projectCode ?? o.project, owner: k.ownerUserId ?? o.owner, broker: k.brokerId ?? o.broker, campaign: o.campaign });
  });
  return [
    { must: intake.length, may: intakeMay.length, records: intakeMay.map(l => l.leadNo) },
    { must: sql.length, may: sqlMay.length, records: sqlMay.map(l => l.leadNo) },
    { must: opps.length, may: opps.length, records: opps.map(o => o.opportunityNo) },
    { must: rsv.length, may: rsvAll.length, records: rsvAll.map(r => r.reservationNo) },
    { must: spa.length, may: spa.length, records: spa.map(k => k.contractNo), value: spa.reduce((s, k) => s + k.value, 0) },
  ];
}

/** Count / base × 100 at one decimal (0 when the base is 0). */
export const pct = (n: number, base: number) => base ? Number((n / base * 100).toFixed(PCT_DECIMALS)) : 0;
