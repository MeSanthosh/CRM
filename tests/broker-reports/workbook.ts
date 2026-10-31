/** Broker Reports workbook (Testcase/Broker_Reports_Test_Cases.xlsx) and what the common checks need to know about the page. */
import { readWorkbook } from '../module-workbooks/catalog';
import type { ModuleConfig } from '../module-workbooks/config';

export const WB = readWorkbook('Broker_Reports_Test_Cases.xlsx', 'BR', '@broker-workbook');

export const CFG: ModuleConfig = {
  fixture: 'brokers',
  name: 'Broker Reports',
  intro: 'Leads, opportunities, reservations and SPAs brought by each broker',
  periodLabel: 'Period (lead captured / deal signed)',
  api: '/reports/business/brokers',
  exportPrefix: 'brokers-report',
  main: 'Broker leads',
  cards: [
    { label: 'Active brokers', kind: 'count', period: false },
    { label: 'Brokers with SPA', kind: 'count', period: true, subtitle: 'In the period' },
    { label: 'Broker leads', kind: 'count', period: true },
    { label: 'Broker reservations', kind: 'count', period: true },
    { label: 'Broker SPAs', kind: 'count', period: true },
    { label: 'Broker SPA value', kind: 'money', period: true },
    { label: 'Broker share of SPAs', kind: 'percent', period: true, subtitle: 'Broker SPAs ÷ all SPAs in the period' },
  ],
  filters: [
    { label: 'Project', all: 'All projects', param: /projectCode=/ },
    { label: 'Salesperson', all: 'All salespeople', param: /ownerUserId=/ },
    { label: 'Broker', all: 'All brokers', param: /brokerId=/ },
  ],
  tables: [
    { heading: 'Broker Performance', file: 'byBroker', total: true, sums: ['Leads', 'Opportunities', 'Reservations', 'SPAs', 'SPA Value (USD)'],
      cards: { Leads: 'Broker leads', Reservations: 'Broker reservations', SPAs: 'Broker SPAs', 'SPA Value (USD)': 'Broker SPA value' }, links: true },
    { heading: 'Broker SPAs in Period', file: 'spaList', total: false, sums: [] },
  ],
};
