/** Exception Reports workbook (Testcase/Exception_Reports_Test_Cases.xlsx) and what the common checks need to know about the page. */
import { readWorkbook } from '../module-workbooks/catalog';
import type { ModuleConfig } from '../module-workbooks/config';

export const WB = readWorkbook('Exception_Reports_Test_Cases.xlsx', 'EX', '@exception-workbook');

/** Detail lists: heading = the exception's name in the Summary; long lists show the first 100 ("Showing 100 of N"). */
export const LISTS: { heading: string; file: string; capped: boolean }[] = [
  { heading: 'Overdue instalments', file: 'overdueInstalments', capped: true },
  { heading: 'Reservations past expiry', file: 'reservationPastExpiry', capped: false },
  { heading: 'Reservation deposit not received after 7 days', file: 'depositPending', capped: false },
  { heading: 'SPAs not signed after 14 days', file: 'spaUnsigned', capped: false },
  { heading: 'Signed SPAs with KYC not approved', file: 'spaKycPending', capped: false },
  { heading: 'Signed SPAs not handed off to ERP after 3 days', file: 'erpHandoffPending', capped: false },
  { heading: 'Open opportunities past expected close date', file: 'opportunityPastClose', capped: false },
  { heading: 'Leads not contacted after 2 days', file: 'leadsNotContacted', capped: true },
];

export const CFG: ModuleConfig = {
  fixture: 'exceptions',
  name: 'Exception Reports',
  intro: 'Items that need action today',
  periodLabel: 'Period',
  api: '/reports/business/exceptions',
  exportPrefix: 'exceptions-report',
  main: 'Open exceptions',
  cards: [
    { label: 'Open exceptions', kind: 'count', period: false },
    { label: 'Overdue instalments', kind: 'count', period: false },
    { label: 'Reservations past expiry', kind: 'count', period: false },
    { label: 'Expiring in 7 days', kind: 'count', period: false },
    { label: 'SPAs unsigned > 14 days', kind: 'count', period: false },
    { label: 'Leads not contacted', kind: 'count', period: false },
  ],
  filters: [
    { label: 'Project', all: 'All projects', param: /projectCode=/ },
    { label: 'Salesperson', all: 'All salespeople', param: /ownerUserId=/ },
  ],
  tables: [
    { heading: 'Exception Summary', file: 'summary', total: true, sums: ['Open'], cards: { Open: 'Open exceptions' } },
    ...LISTS.map(l => ({ heading: l.heading, file: l.file, total: false, sums: [], links: true, capped: l.capped })),
  ],
};
