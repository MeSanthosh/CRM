/** What a report-module workbook suite needs to know about its page (read by common.ts). */
import type { Pages } from '../pages/fixtures';
import type { ReportModulePage } from '../pages/ReportModulePage';

export type CardKind = 'count' | 'money' | 'percent' | 'number' | 'days';

export type CardConfig = {
  label: string;
  kind: CardKind;
  /** Follows the period dropdown (false = all-time or "as of today": the same for every period). */
  period: boolean;
  /** Text shown under the value. */
  subtitle?: string;
  /** An amount that adds up (a total): like a count, it can only go down when a filter or view narrows the report. */
  sum?: boolean;
};

export type FilterConfig = {
  /** Label above the dropdown, e.g. "Campaign". */
  label: string;
  /** First option, e.g. "All campaigns". */
  all: string;
  /** Query parameter the report sends for it, e.g. /campaignId=/. */
  param: RegExp;
};

export type TableConfig = {
  heading: string;
  /** File key in the export name: <exportPrefix>-<file>-<yyyy-mm-dd>.xlsx */
  file: string;
  /** Has a Total row (tfoot). */
  total: boolean;
  /** Columns whose Total = the sum of the rows (counts exactly, amounts within display rounding). */
  sums: string[];
  /** Total-row column → KPI card it equals. */
  cards?: Record<string, string>;
  /** Record list whose first column links to the record. */
  links?: boolean;
  /** Long list cut on screen ("Showing 200 of 209. Export for the full list."): the export has every row. */
  capped?: boolean;
};

export type ModuleConfig = {
  /** Fixture name of the page object. */
  fixture: keyof Pages;
  name: string;
  /** Intro text start under the heading. */
  intro: string;
  periodLabel: string;
  /** API path the report calls, e.g. "/reports/business/marketing". */
  api: string;
  /** Export file prefix, e.g. "marketing-report". */
  exportPrefix: string;
  /** The count that best shows "is there data" (defaults to the first period count card). */
  main?: string;
  /** The period is about due dates, so This month / This quarter include future dates (Collection Reports). */
  futurePeriods?: boolean;
  cards: CardConfig[];
  filters: FilterConfig[];
  tables: TableConfig[];
};

export const countCards = (cfg: ModuleConfig) => cfg.cards.filter(c => c.kind === 'count').map(c => c.label);
/** Cards that can only go down when the report is narrowed: counts and amounts that add up. */
export const additiveCards = (cfg: ModuleConfig) => cfg.cards.filter(c => c.kind === 'count' || c.sum).map(c => c.label);
export type Page = ReportModulePage;
