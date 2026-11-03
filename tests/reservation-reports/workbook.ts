/** Reservation Reports workbook (Testcase/Reservation_Reports_Test_Cases.xlsx) and what the common checks need to know about the page. */
import { readWorkbook } from '../module-workbooks/catalog';
import type { ModuleConfig, TableConfig } from '../module-workbooks/config';

export const WB = readWorkbook('Reservation_Reports_Test_Cases.xlsx', 'RR', '@reservation-workbook');

/** Month / Project / Salesperson tables share their columns; Active Now is "as of today", so it is not a sum of the rows. */
const breakdown = (heading: string, file: string): TableConfig => ({
  heading, file, total: true, sums: ['Made in Period', 'Amount (USD)', 'Converted to SPA', 'Cancelled / Expired'],
  cards: { 'Made in Period': 'Reservations in period', 'Amount (USD)': 'Reservation amount', 'Converted to SPA': 'Converted to SPA', 'Conversion %': 'Conversion rate', 'Active Now': 'Active now' },
});

export const BREAKDOWNS = ['Reservations by Month', 'Reservations by Project', 'Reservations by Salesperson'];

export const CFG: ModuleConfig = {
  fixture: 'reservations',
  name: 'Reservation Reports',
  intro: 'Reservations made, deposits, conversion to SPA, expiry and cancellations',
  periodLabel: 'Period (reservation date)',
  api: '/reports/business/reservations',
  exportPrefix: 'reservations-report',
  cards: [
    { label: 'Reservations in period', kind: 'count', period: true },
    { label: 'Reservation amount', kind: 'money', period: true },
    { label: 'Converted to SPA', kind: 'count', period: true, subtitle: 'Of the reservations made in the period' },
    { label: 'Conversion rate', kind: 'percent', period: true },
    { label: 'Active now', kind: 'count', period: false },
    { label: 'Expiring in 7 days', kind: 'count', period: false },
    { label: 'Past expiry, still active', kind: 'count', period: false },
    { label: 'Deposit not received', kind: 'count', period: false, subtitle: 'Active reservations' },
  ],
  filters: [
    { label: 'Project', all: 'All projects', param: /projectCode=/ },
    { label: 'Salesperson', all: 'All salespeople', param: /ownerUserId=/ },
    { label: 'Broker', all: 'All brokers', param: /brokerId=/ },
  ],
  tables: [
    breakdown('Reservations by Month', 'byMonth'),
    breakdown('Reservations by Project', 'byProject'),
    breakdown('Reservations by Salesperson', 'byOwner'),
    { heading: 'Active Reservations', file: 'activeList', total: false, sums: [], links: true },
  ],
};
