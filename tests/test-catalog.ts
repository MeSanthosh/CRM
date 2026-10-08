/**
 * Test case catalog used by the Excel defect report.
 * For every test ID: module, page, severity, category, steps to reproduce, expected result,
 * and an optional hint for the developers. Edit the wording here — the tests don't change.
 */
import { SAME, where } from './consistency-cases';
import { HUB_MODULES, REPORT_PAGES, LEADS_TABS, DASHBOARD_KPIS, ROUTES } from './locators';

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
export interface CaseInfo {
  module: string;
  page: string;
  severity: Severity;
  category: string;
  steps: string[];
  expected: string;
  hint?: string;
}

const BASE = process.env.BASE_URL ?? 'https://qa-crm.asquareab.com';
const url = (p: string) => `${BASE}${p}`;
const priorityOf = (s: Severity) => ({ Critical: 'P1', High: 'P2', Medium: 'P3', Low: 'P4' })[s];
export { priorityOf };

const C: Record<string, CaseInfo> = {};
const add = (id: string, info: CaseInfo) => (C[id] = info);

// ── Reports & Analytics hub ──────────────────────────────────────────────────
const hub = url(ROUTES.hub);
add('RA-01', { module: 'Reports Hub', page: hub, severity: 'High', category: 'Invalid value',
  steps: [`Open ${hub}`, 'Look at the 8 cards under "Executive snapshot"'],
  expected: 'Every card shows a number (no blank, "—", NaN or negative value)' });
add('RA-02', { module: 'Reports Hub', page: hub, severity: 'High', category: 'UI vs API mismatch',
  steps: [`Open ${hub} with DevTools → Network (Fetch/XHR)`, 'Compare each snapshot card with the API response values'],
  expected: 'Each card value is present in the API response',
  hint: 'If the API value is right the bug is in the UI formatting; if not, in the backend query' });
add('RA-03', { module: 'Reports Hub', page: hub, severity: 'Medium', category: 'Data stability',
  steps: [`Open ${hub} and note the 8 snapshot values`, 'Reload the page (F5)', 'Wait for data to load and compare'],
  expected: 'Values are identical after reload' });
add('RA-04', { module: 'Reports Hub', page: hub, severity: 'Medium', category: 'Errors',
  steps: [`Open ${hub} with DevTools → Console and Network open`],
  expected: 'No JavaScript errors and no API call returning HTTP 4xx/5xx' });
add('RA-05', { module: 'Reports Hub', page: hub, severity: 'Low', category: 'UI',
  steps: [`Open ${hub}`, 'Compare the "N live" summary with the number of module cards marked LIVE'],
  expected: 'Summary count equals the number of LIVE cards; 11 module cards shown' });
HUB_MODULES.forEach((m, i) => add(`RA-MOD-${String(i + 1).padStart(2, '0')}`, {
  module: 'Reports Hub', page: hub, severity: 'Medium', category: 'Navigation',
  steps: [`Open ${hub}`, `Click the "${m.name}" card`],
  expected: `The ${m.name} page opens at ${url(m.href)}` }));

// ── Report modules ────────────────────────────────────────────────────────────
Object.entries(REPORT_PAGES).forEach(([name, d], i) => add(`RM-${String(i + 1).padStart(2, '0')}`, {
  module: name, page: url(d.path), severity: 'Medium', category: 'Invalid value / Errors',
  steps: [`Open ${url(d.path)} (period: This month)`, `Check KPI cards: ${d.kpis.join(', ')}`, d.tables.length ? `Check tables: ${d.tables.join(', ')}` : 'No tables on this page'],
  expected: 'Every KPI shows a valid number, every table renders, no NaN/undefined text, no JS or API errors' }));
add('RM-11', { module: 'Executive Dashboard', page: url(ROUTES.dashboard), severity: 'Medium', category: 'Invalid value',
  steps: [`Open ${url(ROUTES.dashboard)}`, `Check KPI cards: ${DASHBOARD_KPIS.join(', ')}`],
  expected: 'Every KPI shows a valid value' });

// ── Leads ─────────────────────────────────────────────────────────────────────
const leads = url(ROUTES.leads);
add('L-01', { module: 'Leads', page: leads, severity: 'High', category: 'Count mismatch',
  steps: [`Open ${leads}`, 'Compare the "Total Leads" card, the "All Leads" tab badge and the pager text "… N leads"'],
  expected: 'All three numbers are equal' });
add('L-02', { module: 'Leads', page: leads, severity: 'High', category: 'Count mismatch',
  steps: [`Open ${leads}`, 'Add the "Assigned" card and the "Unassigned" tab badge'],
  expected: 'Assigned + Unassigned = Total Leads' });
add('L-03', { module: 'Leads', page: leads, severity: 'Medium', category: 'Invalid value',
  steps: [`Open ${leads}`, 'Check the Qualified, Disqualified, Total and Avg Score cards'],
  expected: 'Qualified + Disqualified ≤ Total; Avg Score between 0 and 100' });
LEADS_TABS.slice(1).forEach((t, i) => add(`L-04.${i + 1}`, {
  module: 'Leads', page: leads, severity: 'High', category: 'Count mismatch',
  steps: [`Open ${leads}`, `Note the badge number on the "${t}" tab`, `Click the "${t}" tab and count the leads listed (pager or rows)`],
  expected: `Number of leads listed = "${t}" badge` }));
add('L-05', { module: 'Leads', page: leads, severity: 'High', category: 'Count mismatch',
  steps: [`Open ${leads}`, 'Click "Individual" and note the count', 'Click "Corporate" and note the count'],
  expected: 'Individual + Corporate = All leads' });
add('L-06', { module: 'Leads', page: leads, severity: 'High', category: 'Count mismatch',
  steps: [`Open ${leads}`, 'Select each status in "All statuses" and note the count', 'Add the 10 counts; compare Disqualified and Qualified (+Converted) with their cards'],
  expected: 'Sum of all statuses = Total; Disqualified card = Disqualified filter; Qualified card = Qualified + Converted filters' });
add('L-07', { module: 'Leads', page: leads, severity: 'Medium', category: 'Functional',
  steps: [`Open ${leads}`, 'Search "zzz-no-such-lead-xyz"', 'Clear the search box'],
  expected: 'No-match search shows 0 leads ("No leads found."); clearing restores the full total' });
add('L-08', { module: 'Leads', page: leads, severity: 'Low', category: 'Pagination',
  steps: [`Open ${leads}`, 'Read "Page 1 of N · T leads" and count rows on page 1'],
  expected: 'Page 1 shows min(25, T) rows; N = ceil(T / 25)' });
add('L-09', { module: 'Leads', page: leads, severity: 'High', category: 'Export mismatch',
  steps: [`Open ${leads}`, 'Click "Export"', 'Open the downloaded file and count the data rows'],
  expected: 'Exported rows = Total Leads' });
add('L-10', { module: 'Leads / Reports Hub', page: hub, severity: 'High', category: 'Calculation error',
  steps: [`Open ${hub} and note "Active Leads"`, `Open ${leads} and note the count of each status`, 'Compute Total − Converted − Lost − Disqualified − Duplicate'],
  expected: 'Active Leads equals the computed value (definition from the note on the hub page)',
  hint: 'Hub and Lead Reports agree with each other but not with the status breakdown; check which extra leads the Active Leads query excludes' });

// ── Cross-page consistency ───────────────────────────────────────────────────
const HINTS: Record<string, string> = {
  'X-02': 'Hub/Dashboard and Sales Reports use different "open opportunity" filters (stage list or deleted/closed flags)',
  'X-03': 'Likely the same root cause as X-02 (different set of open opportunities)',
  'X-06': 'Hub counts "active reservation or SPA in progress"; Inventory uses unit status. Agree one definition',
  'X-07': 'Hub counts units with a signed SPA; Inventory uses unit status. Agree one definition',
  'X-08': 'Dashboard/Hub and SPA Reports likely use different date fields or SPA statuses for "this month"',
  'X-09': 'Same root cause as X-08 (Dashboard "SPAs Executed" vs SPA Reports "signed in period")',
  'X-10': 'Dashboard "Won Opportunities" vs Sales "Won in period": different date field or won definition',
};
for (const c of SAME) add(c.id, {
  module: 'Cross-page', page: url(c.sources[0].page), severity: 'High', category: 'Data inconsistency between pages',
  steps: c.sources.map(s => `Open ${url(s.page)} and read ${s.label ? `"${s.label}"` : `the number of rows in table "${s.table}"`}`),
  expected: `"${c.metric}" shows the same value on every page: ${c.sources.map(where).join('; ')}`,
  hint: HINTS[c.id] });

// ── Math inside a page ────────────────────────────────────────────────────────
const R = ROUTES.reports;
const math: [string, string, string, string][] = [
  ['M-01', R.inventory, 'Hub Units Available + Units Reserved + Units Sold', 'Equals Inventory Reports "Total units"'],
  ['M-02', R.inventory, 'Inventory: Available + Reserved + Sold; Sold %; sum of "Units" in "Inventory by Project"', 'Sum ≤ Total units; Sold % = Sold / Total; project units sum = Total units'],
  ['M-03', R.collections, 'Collections: Scheduled, Received, Outstanding, Overdue, rates', 'Scheduled − Received = Outstanding; Overdue ≤ Outstanding; Collection rate = Received / Scheduled; Received of due = Received / Due in period'],
  ['M-04', R.reservations, 'Reservations: Converted to SPA ÷ Reservations in period', 'Equals "Conversion rate"'],
  ['M-05', R.spa, 'SPA: Signed value ÷ SPAs signed in period', 'Equals "Average SPA value" (±1%)'],
  ['M-06', R.marketing, 'Marketing: Campaign budget ÷ Campaign leads', 'Equals "Cost per lead" (±1%)'],
  ['M-07', R.exceptions, 'Exceptions: sum of the "Open" column in "Exception Summary"', 'Equals "Open exceptions"'],
  ['M-08', R.sales, 'Sales: sum of "Opportunities" and "Value (USD)" in "Open Pipeline by Stage"', 'Equal "Open opportunities" and "Pipeline value"'],
];
for (const [id, p, what, exp] of math) add(id, {
  module: 'Calculations', page: url(p), severity: 'High', category: 'Calculation error',
  steps: [`Open ${url(p)} (period: This month)`, `Calculate: ${what}`], expected: exp });

/** Info for a test ID, with a generic fallback (e.g. DB-* tests). */
export function caseInfo(id: string, title: string): CaseInfo {
  if (C[id]) return C[id];
  if (id.startsWith('DB-')) return {
    module: 'UI vs Database', page: url(id.startsWith('DB-RA') ? ROUTES.hub : ROUTES.leads), severity: 'High', category: 'UI vs database mismatch',
    steps: ['Open the page and read the value', 'Run the SQL shown in the error against the QA database'],
    expected: 'UI value equals the database result' };
  return { module: 'Other', page: BASE, severity: 'Medium', category: 'Functional', steps: [title], expected: 'Test passes' };
}
