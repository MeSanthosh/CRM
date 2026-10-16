/**
 * Helpers for the Lead Reports filter tests (filter-combinations, filter-counts): pick filter values from the page,
 * apply them, and check listed leads against them. Nothing is hard-coded: values come from Performance by <field>.
 */
import { num } from '../helpers';
import { LeadReportsPage, GROUPINGS } from '../pages/LeadReportsPage';
import type { Row } from '../pages/LeadTable';
import { labelOf } from './shared';

export type Grouping = typeof GROUPINGS[number];
/** A filter set by a test: the label picked, the option's value (e.g. a project code) and the counts. */
export type Applied = { g: Grouping; value: string; code: string; leads: number; captured: number };

export const field = (name: string) => GROUPINGS.find(g => g.name === name)!;
export const SOURCE = field('Lead Source');
export const PROJECT = field('Project');
export const BAD = /\bNaN\b|undefined|Infinity|\bnull\b/;
export const EMPTY_RATE = /^\s*(—|–|-|0(\.0+)?\s*%)\s*$/;
/** Lead-list export column that holds each field (the other fields are not in the export). */
export const EXPORT_COLUMN: Record<string, string> = { source: 'Source', channel: 'Channel', owner: 'Salesperson', project: 'Project' };
/** Lead-list column shown on screen for each field (the drill-down shows fewer columns than its export). */
export const SCREEN_COLUMN: Record<string, string> = { source: 'Source', owner: 'Salesperson' };
/** Key of each field's list in the /reports/leads/options response. */
export const API_KEY: Record<string, string> = { source: 'sources', channel: 'channels', campaign: 'campaigns', broker: 'brokers', owner: 'owners',
  project: 'projects', nationality: 'nationalities', prospectType: 'prospectTypes' };

/** Leads Captured, read on the Overview tab (the only tab with the period KPI cards). */
export async function captured(lead: LeadReportsPage) {
  await lead.openTab('Overview & Funnel');
  return lead.kpi('Leads Captured');
}

/** Label of the option currently selected in a filter dropdown. */
export async function selected(lead: LeadReportsPage, g: Grouping) {
  return (await lead.filterSelect(g.filter).locator('option:checked').innerText()).trim();
}

/** Value of the option currently selected (the export shows a project by this code, not by its name). */
export async function selectedCode(lead: LeadReportsPage, g: Grouping) {
  return (await lead.filterSelect(g.filter).locator('option:checked').getAttribute('value')) ?? '';
}

/** Labels of a filter's options that appear only once (a repeated label cannot be told apart). */
export async function uniqueOptions(lead: LeadReportsPage, g: Grouping) {
  const options = await lead.filterOptions(g.filter);
  return options.filter(o => options.indexOf(o) === options.lastIndexOf(o));
}

/** Rows of Performance by <field> under the filters already applied that can be selected and have leads, busiest first. */
export async function selectable(lead: LeadReportsPage, g: Grouping): Promise<Row[]> {
  await lead.openTab('Source & Channel');
  await lead.groupBy(g.name);
  const options = await uniqueOptions(lead, g);
  return (await lead.breakdown.rows())
    .filter(r => options.includes(labelOf(r)) && num(r['Leads']) > 0)
    .sort((a, b) => num(b['Leads']) - num(a['Leads']));
}

/** Applies the fields one after another, each time with the busiest value still left under the filters already set. */
export async function narrow(lead: LeadReportsPage, fields: Grouping[]): Promise<Applied[]> {
  const applied: Applied[] = [];
  for (const g of fields) {
    const row = (await selectable(lead, g))[0];
    if (!row) continue;
    await lead.setFilter(g.filter, labelOf(row));
    applied.push({ g, value: labelOf(row), code: await selectedCode(lead, g), leads: num(row['Leads']), captured: await captured(lead) });
  }
  return applied;
}

/** Listed leads whose field (by `columns`) is not the applied value, as "LD-…: Column = value". */
export function outsideRows(rows: Record<string, unknown>[], applied: Applied[], columns: Record<string, string>, leadNo = 'Lead No') {
  const outside: string[] = [];
  const checked: string[] = [];
  for (const a of applied) {
    const col = columns[a.g.dimension];
    if (!col) continue;
    checked.push(col);
    for (const r of rows) {
      const v = String(r[col] ?? '').trim();
      if (![a.value, a.code].includes(v)) outside.push(`${r[leadNo]}: ${col} = ${v || '(blank)'}`);
    }
  }
  return { checked, outside };
}

/** Opens the Leads Captured list (with its export) and returns the exported leads that break one of the applied filters. */
export async function recordsOutside(lead: LeadReportsPage, applied: Applied[]) {
  await lead.openTab('Overview & Funnel');
  const { drill, exported } = await lead.drill.verify(lead.cardLinks('Leads Captured').first());
  const rows = exported?.rows ?? [];
  return { listed: drill.count, exported: rows.length, ...outsideRows(rows, applied, EXPORT_COLUMN) };
}

export const describeApplied = (applied: Applied[]) => applied.map(a => `${a.g.name} = ${a.value}: ${a.captured}`).join(' | ');
