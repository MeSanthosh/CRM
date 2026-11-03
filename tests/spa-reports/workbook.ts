/** SPA Reports workbook (Testcase/SPA_Reports_Test_Cases.xlsx) and what the common checks need to know about the page. */
import { readWorkbook } from '../module-workbooks/catalog';
import type { ModuleConfig, TableConfig } from '../module-workbooks/config';

export const WB = readWorkbook('SPA_Reports_Test_Cases.xlsx', 'SR', '@spa-workbook');

/** Project / Salesperson tables: Signed and Value follow the period, the other columns are as of today. */
const breakdown = (heading: string, file: string): TableConfig => ({
  heading, file, total: true, sums: ['Signed in Period', 'Value (USD)', 'Awaiting Signature', 'ERP Handoff Pending', 'KYC Not Approved'],
  cards: { 'Signed in Period': 'SPAs signed in period', 'Value (USD)': 'Signed value', 'Awaiting Signature': 'Awaiting signature', 'KYC Not Approved': 'Signed, KYC not approved' },
});

export const BREAKDOWNS = ['SPAs Signed by Month', 'SPAs by Project', 'SPAs by Salesperson'];

export const CFG: ModuleConfig = {
  fixture: 'spa',
  name: 'SPA Reports',
  intro: 'Signed SPAs and contract value, time to sign, KYC and ERP handoff',
  periodLabel: 'Period (SPA signed)',
  api: '/reports/business/spa',
  exportPrefix: 'spa-report',
  cards: [
    { label: 'SPAs signed in period', kind: 'count', period: true },
    { label: 'Signed value', kind: 'money', period: true, sum: true },
    { label: 'Average SPA value', kind: 'money', period: true },
    { label: 'Awaiting signature', kind: 'count', period: false },
    { label: 'Average days reservation to SPA', kind: 'days', period: true },
    { label: 'Handed off to ERP', kind: 'percent', period: false, subtitle: 'Of all signed SPAs' },
    { label: 'Signed, KYC not approved', kind: 'count', period: false },
  ],
  filters: [
    { label: 'Project', all: 'All projects', param: /projectCode=/ },
    { label: 'Salesperson', all: 'All salespeople', param: /ownerUserId=/ },
    { label: 'Broker', all: 'All brokers', param: /brokerId=/ },
  ],
  tables: [
    { heading: 'SPAs Signed by Month', file: 'byMonth', total: true, sums: ['Signed', 'Value (USD)'], cards: { Signed: 'SPAs signed in period', 'Value (USD)': 'Signed value' } },
    breakdown('SPAs by Project', 'byProject'),
    breakdown('SPAs by Salesperson', 'byOwner'),
    { heading: 'SPAs Needing Action', file: 'attentionList', total: false, sums: [], links: true },
  ],
};
