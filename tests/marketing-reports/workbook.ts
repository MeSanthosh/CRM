/** Marketing Reports workbook (Testcase/Marketing_Reports_Test_Cases.xlsx) and what the common checks need to know about the page. */
import { readWorkbook } from '../module-workbooks/catalog';
import type { ModuleConfig } from '../module-workbooks/config';

export const WB = readWorkbook('Marketing_Reports_Test_Cases.xlsx', 'MR', '@marketing-workbook');

export const CFG: ModuleConfig = {
  fixture: 'marketing',
  name: 'Marketing Reports',
  intro: 'Campaign and channel budget, leads, cost per lead, won revenue and return on spend',
  periodLabel: 'Period (lead captured)',
  api: '/reports/business/marketing',
  exportPrefix: 'marketing-report',
  cards: [
    { label: 'Running today', kind: 'count', period: false },
    { label: 'Campaign budget', kind: 'money', period: false, subtitle: 'Full budget of the campaigns shown' },
    { label: 'Campaign leads', kind: 'count', period: true },
    { label: 'Leads to SPA', kind: 'count', period: true },
    { label: 'Revenue', kind: 'money', period: true, subtitle: 'SPA value from campaign leads' },
    { label: 'Cost per lead', kind: 'money', period: true },
    { label: 'ROI', kind: 'percent', period: true, subtitle: '(Revenue − budget) ÷ budget' },
  ],
  filters: [
    { label: 'Project', all: 'All projects', param: /projectCode=/ },
    { label: 'Salesperson', all: 'All salespeople', param: /ownerUserId=/ },
    { label: 'Campaign', all: 'All campaigns', param: /campaignId=/ },
  ],
  tables: [
    { heading: 'Campaign Performance', file: 'byCampaign', total: true, sums: ['Budget (USD)', 'Leads', 'Qualified', 'Opportunities', 'SPA', 'Revenue (USD)'],
      cards: { 'Budget (USD)': 'Campaign budget', Leads: 'Campaign leads', SPA: 'Leads to SPA', 'Revenue (USD)': 'Revenue', 'Cost per Lead': 'Cost per lead', 'ROI %': 'ROI' } },
    { heading: 'Performance by Channel', file: 'byChannel', total: false, sums: [] },
  ],
};
