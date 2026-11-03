/** Collection Reports workbook (Testcase/Collection_Reports_Test_Cases.xlsx) and what the common checks need to know about the page. */
import { readWorkbook } from '../module-workbooks/catalog';
import type { ModuleConfig } from '../module-workbooks/config';

export const WB = readWorkbook('Collection_Reports_Test_Cases.xlsx', 'CL', '@collection-workbook');

export const CFG: ModuleConfig = {
  fixture: 'collections',
  name: 'Collection Reports',
  intro: 'Scheduled, received, outstanding and overdue instalments on active SPA payment plans',
  periodLabel: 'Period (instalment due)',
  api: '/reports/business/collections',
  exportPrefix: 'collections-report',
  main: 'Scheduled',
  futurePeriods: true,
  cards: [
    { label: 'Scheduled', kind: 'money', period: false, sum: true, subtitle: 'All instalments on active SPA payment plans' },
    { label: 'Received', kind: 'money', period: false, sum: true },
    { label: 'Outstanding', kind: 'money', period: false, sum: true },
    { label: 'Overdue', kind: 'money', period: false, sum: true },
    { label: 'Collection rate', kind: 'percent', period: false, subtitle: 'Received ÷ amount due to date' },
    { label: 'Due in next 30 days', kind: 'money', period: false, sum: true },
    { label: 'Due in period', kind: 'money', period: true, sum: true },
    { label: 'Received of due in period', kind: 'percent', period: true },
  ],
  filters: [
    { label: 'Project', all: 'All projects', param: /projectCode=/ },
    { label: 'Salesperson', all: 'All salespeople', param: /ownerUserId=/ },
  ],
  tables: [
    { heading: 'Outstanding by Age', file: 'aging', total: true, sums: ['Instalments', 'Amount (USD)', 'Share %'], cards: { 'Amount (USD)': 'Outstanding' } },
    { heading: 'Collections by Project', file: 'byProject', total: true, sums: ['SPAs', 'Scheduled (USD)', 'Received (USD)', 'Outstanding (USD)', 'Overdue (USD)', 'Overdue Instalments'],
      cards: { 'Scheduled (USD)': 'Scheduled', 'Received (USD)': 'Received', 'Outstanding (USD)': 'Outstanding', 'Overdue (USD)': 'Overdue' } },
    { heading: 'Overdue Instalments', file: 'overdueList', total: false, sums: [], links: true, capped: true },
  ],
};
