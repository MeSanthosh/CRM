/**
 * UI value  ⇄  SQL that should produce the same number.
 *
 * ⚠ The table and column names below are FIRST GUESSES (leads, opportunities, units, ...).
 *   Run `npm run db:discover`, send db-schema.md to Claude, and these will be replaced
 *   with your exact tables, columns and status values.
 *
 * ui.kind:
 *   card  – KPI card by label, e.g. "Active Leads"
 *   tab   – tab badge, e.g. "Unassigned 1"
 *   pager – the "Page 1 of 25 · 615 leads" count (optionally after a tab click)
 */
export type UiSource =
  | { kind: 'card'; label: string }
  | { kind: 'tab'; label: string }
  | { kind: 'pager'; tab?: string };

export interface DbCheck {
  id: string;
  title: string;
  page: 'reports' | 'leads';
  ui: UiSource;
  sql: string;
  skip?: string; // reason to skip (e.g. depends on the logged-in user)
}

// Common lead filter: exclude soft-deleted rows if your table has deleted_at.
const LIVE_LEADS = `FROM leads WHERE deleted_at IS NULL`;

export const DB_CHECKS: DbCheck[] = [
  // ── Executive snapshot (Reports & Analytics) ──────────────────────────────
  {
    id: 'DB-RA-01', title: 'Active Leads', page: 'reports',
    ui: { kind: 'card', label: 'Active Leads' },
    sql: `SELECT count(*) ${LIVE_LEADS} AND status NOT IN ('Converted','Lost','Disqualified','Duplicate')`, // per the app's note on the hub page
  },
  {
    id: 'DB-RA-02', title: 'Open Opportunities', page: 'reports',
    ui: { kind: 'card', label: 'Open Opportunities' },
    sql: `SELECT count(*) FROM opportunities WHERE deleted_at IS NULL AND status NOT IN ('Won','Lost','Closed')`,
  },
  {
    id: 'DB-RA-03', title: 'Units Reserved', page: 'reports',
    ui: { kind: 'card', label: 'Units Reserved' }, // app: active reservation OR SPA in progress
    sql: `SELECT count(*) FROM units WHERE status = 'Reserved'`,
  },
  {
    id: 'DB-RA-04', title: 'Units Available', page: 'reports',
    ui: { kind: 'card', label: 'Units Available' },
    sql: `SELECT count(*) FROM units WHERE status = 'Available'`,
  },
  {
    id: 'DB-RA-05', title: 'Pipeline Value (USD)', page: 'reports',
    ui: { kind: 'card', label: 'Pipeline Value' },
    sql: `SELECT coalesce(sum(amount_usd),0) FROM opportunities WHERE deleted_at IS NULL AND status NOT IN ('Won','Lost','Closed')`,
  },
  {
    id: 'DB-RA-06', title: 'SPA Value Signed (This Month)', page: 'reports',
    ui: { kind: 'card', label: 'SPA Value Signed (This Month)' },
    sql: `SELECT coalesce(sum(contract_value_usd),0) FROM spa_contracts
          WHERE signed_at >= date_trunc('month', now())`,
  },
  {
    id: 'DB-RA-07', title: 'Units Sold', page: 'reports',
    ui: { kind: 'card', label: 'Units Sold' }, // app: units with a signed SPA
    sql: `SELECT count(*) FROM units WHERE status = 'Sold'`,
  },
  {
    id: 'DB-RA-08', title: 'Weighted Pipeline (USD)', page: 'reports',
    ui: { kind: 'card', label: 'Weighted Pipeline' },
    sql: `SELECT coalesce(sum(amount_usd * probability / 100.0),0) FROM opportunities WHERE deleted_at IS NULL AND status NOT IN ('Won','Lost','Closed')`,
  },

  // ── Leads page ────────────────────────────────────────────────────────────
  { id: 'DB-L-01', title: 'Total Leads', page: 'leads', ui: { kind: 'card', label: 'Total Leads' }, sql: `SELECT count(*) ${LIVE_LEADS}` },
  { id: 'DB-L-02', title: 'Assigned', page: 'leads', ui: { kind: 'card', label: 'Assigned' }, sql: `SELECT count(*) ${LIVE_LEADS} AND assigned_to IS NOT NULL` },
  { id: 'DB-L-03', title: 'Unassigned tab', page: 'leads', ui: { kind: 'tab', label: 'Unassigned' }, sql: `SELECT count(*) ${LIVE_LEADS} AND assigned_to IS NULL` },
  { id: 'DB-L-04', title: 'Qualified', page: 'leads', ui: { kind: 'card', label: 'Qualified' }, sql: `SELECT count(*) ${LIVE_LEADS} AND status = 'Qualified'` },
  { id: 'DB-L-05', title: 'Disqualified', page: 'leads', ui: { kind: 'card', label: 'Disqualified' }, sql: `SELECT count(*) ${LIVE_LEADS} AND status = 'Disqualified'` },
  { id: 'DB-L-06', title: 'Avg Score', page: 'leads', ui: { kind: 'card', label: 'Avg Score' }, sql: `SELECT round(avg(score)) ${LIVE_LEADS}` },
  { id: 'DB-L-07', title: 'To Qualify tab', page: 'leads', ui: { kind: 'tab', label: 'To Qualify' }, sql: `SELECT count(*) ${LIVE_LEADS} AND status IN ('New','Assigned','Contacted','Nurturing')` },
  { id: 'DB-L-08', title: 'Ready to Convert tab', page: 'leads', ui: { kind: 'tab', label: 'Ready to Convert' }, sql: `SELECT count(*) ${LIVE_LEADS} AND status = 'Qualified' AND converted_at IS NULL` },
  {
    id: 'DB-L-09', title: 'My Leads tab', page: 'leads', ui: { kind: 'tab', label: 'My Leads' },
    sql: `SELECT count(*) ${LIVE_LEADS}`,
    skip: 'Depends on the logged-in user — set the user filter after db:discover',
  },
];

/** Per-status breakdown: compared with the Leads page status dropdown. Column must be the status label shown in the UI. */
export const STATUS_BREAKDOWN_SQL = `SELECT status::text AS status, count(*)::int AS n ${LIVE_LEADS} GROUP BY 1`;
