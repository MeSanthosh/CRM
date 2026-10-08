import { ROUTES } from './locators';

export type Src = { page: string; label?: string; table?: string; note?: string };
export const R = ROUTES.reports;

export const where = (s: Src) => `${s.page} → ${s.label ?? `table "${s.table}" rows`}`;

/** Every source must show the same value. */
export const SAME: { id: string; metric: string; sources: Src[] }[] = [
  { id: 'X-01', metric: 'Active leads', sources: [
    { page: ROUTES.hub, label: 'Active Leads' }, { page: ROUTES.dashboard, label: 'Active Leads' }, { page: R.leads, label: 'Open Leads Now' } ] },
  { id: 'X-02', metric: 'Open opportunities', sources: [
    { page: ROUTES.hub, label: 'Open Opportunities' }, { page: ROUTES.dashboard, label: 'Open Opportunities' },
    { page: R.sales, label: 'Open opportunities' }, { page: R.sales, table: 'Open Opportunities' } ] },
  { id: 'X-03', metric: 'Pipeline value', sources: [
    { page: ROUTES.hub, label: 'Pipeline Value' }, { page: R.sales, label: 'Pipeline value' } ] },
  { id: 'X-04', metric: 'Weighted pipeline', sources: [
    { page: ROUTES.hub, label: 'Weighted Pipeline' }, { page: R.sales, label: 'Weighted pipeline' } ] },
  { id: 'X-05', metric: 'Units available', sources: [
    { page: ROUTES.hub, label: 'Units Available' }, { page: ROUTES.dashboard, label: 'Units Available' },
    { page: R.inventory, label: 'Available' }, { page: R.inventory, table: 'Available Units' } ] },
  { id: 'X-06', metric: 'Units reserved', sources: [
    { page: ROUTES.hub, label: 'Units Reserved' }, { page: ROUTES.dashboard, label: 'Reserved Units' }, { page: R.inventory, label: 'Reserved' } ] },
  { id: 'X-07', metric: 'Units sold', sources: [
    { page: ROUTES.hub, label: 'Units Sold' }, { page: R.inventory, label: 'Sold' } ] },
  { id: 'X-08', metric: 'SPA value signed this month', sources: [
    { page: ROUTES.hub, label: 'SPA Value Signed (This Month)' }, { page: ROUTES.dashboard, label: 'Sales Value (SPAs)' },
    { page: R.spa, label: 'Signed value' } ] },
  { id: 'X-09', metric: 'SPAs signed this month', sources: [
    { page: ROUTES.dashboard, label: 'SPAs Executed' }, { page: R.spa, label: 'SPAs signed in period' },
    { page: R.leads, label: 'SPA Signed' } ] },
  { id: 'X-10', metric: 'Won opportunities this month', sources: [
    { page: ROUTES.dashboard, label: 'Won Opportunities' }, { page: R.sales, label: 'Won in period' } ] },
  { id: 'X-11', metric: 'Collections received', sources: [
    { page: ROUTES.dashboard, label: 'Collections Received' }, { page: R.collections, label: 'Received' } ] },
  { id: 'X-12', metric: 'Outstanding amount', sources: [
    { page: ROUTES.dashboard, label: 'Outstanding Amount' }, { page: R.collections, label: 'Outstanding' } ] },
  { id: 'X-13', metric: 'Reservations past expiry', sources: [
    { page: R.reservations, label: 'Past expiry, still active' }, { page: R.exceptions, label: 'Reservations past expiry' } ] },
  { id: 'X-14', metric: 'Active reservations', sources: [
    { page: R.reservations, label: 'Active now' }, { page: R.reservations, table: 'Active Reservations' } ] },
  { id: 'X-15', metric: 'Reservations expiring in 7 days', sources: [
    { page: R.reservations, label: 'Expiring in 7 days' }, { page: R.exceptions, label: 'Expiring in 7 days' } ] },
  { id: 'X-16', metric: 'Won value', sources: [
    { page: R.leads, label: 'Won Value' }, { page: R.sales, label: 'Won value' } ] },
];

