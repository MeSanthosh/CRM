/**
 * Locators for qa-crm.asquareab.com (build v1.0 0510-44), captured from the live app on 2026-10-08
 * and verified to match exactly ONE element (lists: the expected rows).
 *
 * Each entry gives an XPath (usable in Playwright as `page.locator('xpath=…')`, in Selenium as
 * By.xpath) and a CSS selector. Labels are matched by text, not position, so layout changes
 * don't break them. The app has no data-testid attributes yet — see LOCATORS.md for the
 * attributes worth asking the developers to add.
 */
import { Page, Locator } from '@playwright/test';

/** XPath string literal that is safe for labels containing quotes. */
export const xl = (s: string) =>
  s.includes("'") ? `concat('${s.split("'").join(`',"'",'`)}')` : `'${s}'`;

export const ROUTES = {
  hub: '/reports-analytics',
  leads: '/leads',
  dashboard: '/', // "Executive Reports" card also opens this
  reports: {
    leads: '/reports/leads',
    sales: '/reports/sales',
    inventory: '/reports/inventory',
    customers: '/reports/customers',
    brokers: '/reports/brokers',
    marketing: '/reports/marketing',
    reservations: '/reports/reservations',
    spa: '/reports/spa',
    collections: '/reports/collections',
    exceptions: '/reports/exceptions',
  },
} as const;

// ── XPath builders (one per UI pattern) ─────────────────────────────────────
export const XP = {
  /** Reports & Analytics → Executive snapshot card value: <div.crm-module-hub-kpi><span>Label</span><strong>361</strong> */
  hubKpi: (label: string) => `//div[contains(@class,'crm-module-hub-kpi')][span[normalize-space()=${xl(label)}]]/strong`,
  /** Leads page + Executive Dashboard card value: <div.crm-exec-kpi-copy><span>Label</span><strong>615</strong> */
  execKpi: (label: string) => `//div[contains(@class,'crm-exec-kpi-copy')][span[normalize-space()=${xl(label)}]]/strong`,
  /** Report module card value: <article.crm-card><h3>Label</h3><div.crm-kpi>39</div> */
  reportKpi: (label: string) => `//article[contains(@class,'crm-card')][h3[normalize-space()=${xl(label)}]]/div[contains(@class,'crm-kpi')]`,
  /** Leads tab badge: <a.crm-leads-tab>All Leads<span.crm-leads-tab-count>615</span></a> */
  leadsTab: (label: string) => `//a[@role='tab'][contains(@class,'crm-leads-tab')][starts-with(normalize-space(),${xl(label)})]`,
  leadsTabCount: (label: string) => `${XP.leadsTab(label)}/span[contains(@class,'crm-leads-tab-count')]`,
  leadsTypeChip: (name: 'All' | 'Individual' | 'Corporate') => `//button[contains(@class,'crm-leads-type-chip')][normalize-space()=${xl(name)}]`,
  moduleCard: (href: string) => `//a[contains(@class,'crm-module-hub-card')][@href=${xl(href)}]`,
  moduleCardStatus: (href: string) => `${XP.moduleCard(href)}//span[contains(@class,'crm-module-hub-status')]`,
  reportTab: (name: string) => `//button[contains(@class,'crm-tab-button')][normalize-space()=${xl(name)}]`,
  viewSegment: (name: 'All' | 'You and your team' | 'Mine') => `//button[contains(@class,'crm-dashboard-view-segment-button')][normalize-space()=${xl(name)}]`,
  reportPanel: (heading: string) => `//section[contains(@class,'crm-panel')][.//h3[normalize-space()=${xl(heading)}]]`,
  reportTable: (heading: string) => `${XP.reportPanel(heading)}//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]`,
  reportTableRows: (heading: string) => `${XP.reportTable(heading)}/tbody/tr`,
  reportPanelExport: (heading: string) => `${XP.reportPanel(heading)}//button[contains(@class,'crm-export-button')]`,
  navLink: (href: string) => `//a[contains(@class,'crm-nav-link')][@href=${xl(href)}]`,

  // single elements
  leadsStatusFilter: `//select[@aria-label='Filter by status']`,
  leadsCampaignFilter: `//select[@aria-label='Filter by campaign']`,
  leadsSearch: `//input[@placeholder='Search name, lead no, company, phone, email']`,
  leadsExport: `//button[contains(@class,'crm-export-button')]`,
  leadsTable: `//table[contains(@class,'crm-leads-inbox-table')]`,
  leadsTableRows: `//table[contains(@class,'crm-leads-inbox-table')]/tbody/tr`,
  leadsPager: `//div[contains(@class,'crm-pagination')]/span`,
  leadsNext: `//div[contains(@class,'crm-pagination')]//button[normalize-space()='Next']`,
  leadsPrev: `//div[contains(@class,'crm-pagination')]//button[normalize-space()='Previous']`,
  reportPeriod: `//select[contains(@class,'crm-input')][option[@value='this_month']]`,
  reportResetFilters: `//button[normalize-space()='Reset filters']`,
  /** Shown when the period is "Custom dates": <label>From<input type=date></label> */
  reportFrom: `//main//label[starts-with(normalize-space(),'From')]//input[@type='date']`,
  reportTo: `//main//label[starts-with(normalize-space(),'To')]//input[@type='date']`,
  /** Report filter dropdown by its first option, e.g. "All projects", "All salespeople", "All campaigns". */
  reportFilter: (allOption: string) => `//main//select[option[1][normalize-space()=${xl(allOption)}]]`,
  /** Breadcrumb back to the hub on every report module */
  reportHubLink: `//main//a[@href='/reports-analytics']`,
  reportFunnelStep: `//div[contains(@class,'crm-report-funnel-step')]`,
  reportTrendMonth: `//div[contains(@class,'crm-report-trend-month')]`,
  /** Hub module card parts: <a.crm-module-hub-card><strong>Title</strong><span.status>Live</span><p>description</p><small>Open module →</small> */
  moduleCardTitle: (href: string) => `${XP.moduleCard(href)}//strong`,
  moduleCardDescription: (href: string) => `${XP.moduleCard(href)}/p`,
  moduleCardOpen: (href: string) => `${XP.moduleCard(href)}/small`,
  /** Executive dashboard (/): view and period dropdowns, KPI cards (links), panels */
  dashboardView: `//main//select[option[@value='operations']]`,
  dashboardPeriod: `//main//select[option[@value='last_30_days']]`,
  execKpiCard: (label: string) => `//a[contains(@class,'crm-exec-kpi-card')][.//div[contains(@class,'crm-exec-kpi-copy')]/span[normalize-space()=${xl(label)}]]`,
  /** Exact class "crm-panel" (not crm-panel-header); panels may sit inside a wrapper panel, so take the last match. */
  dashboardPanel: (heading: string) => `//main//*[contains(concat(' ',normalize-space(@class),' '),' crm-panel ')][.//*[self::h2 or self::h3][normalize-space()=${xl(heading)}]]`,
  /** Lead Reports: KPI card, panel by heading start, grouping sub-tabs, count links, drill-down list, help */
  kpiCard: (label: string) => `//main//article[contains(@class,'crm-card')][h3[normalize-space()=${xl(label)}]]`,
  leadPanel: (headingStart: string) => `//main//section[contains(@class,'crm-panel') and not(contains(@class,'crm-report-drill'))][.//h3[starts-with(normalize-space(),${xl(headingStart)})]]`,
  leadSubTab: (name: string) => `//main//section[contains(@class,'crm-panel')][.//h3[starts-with(normalize-space(),'Performance by')]]//button[contains(@class,'crm-tab-button')][normalize-space()=${xl(name)}]`,
  leadCountLinks: `//main//section[contains(@class,'crm-panel') and not(contains(@class,'crm-report-drill'))]//button[contains(@class,'crm-report-link')] | //main//article[contains(@class,'crm-card')]//button[contains(@class,'crm-report-link')]`,
  leadDrill: `//main//section[contains(@class,'crm-report-drill')]`,
  leadHelp: `//main//*[self::summary or self::button][contains(normalize-space(),'How these numbers are calculated')]`,
  leadDetail: `//*[contains(@class,'crm-modal')][.//*[contains(normalize-space(),'Lead Detail')]]`,
  userMenu: `//button[contains(@class,'crm-user-menu-button')]`,
  logout: `//*[self::button or self::a][normalize-space()='Log Out']`,
  hubLiveCount: `//span[contains(@class,'crm-module-hub-status') and contains(@class,'is-live')][contains(normalize-space(),'live')]`,
  hubOpenDashboard: `//a[contains(@class,'crm-secondary-button')][normalize-space()='Open Dashboard']`,
  globalSearch: `//input[contains(@class,'crm-search-input')][starts-with(@placeholder,'Search Customer')]`,
  pageTitle: `//main//h1 | //main//h2[1]`,
};

// ── CSS equivalents (for tools that prefer CSS) ─────────────────────────────
export const CSS = {
  hubKpi: 'div.crm-module-hub-kpi', // + filter by span text, value = strong
  execKpi: 'div.crm-exec-kpi-copy', // + filter by span text, value = strong
  leadsKpiCard: 'button.crm-exec-kpi-card',
  reportKpi: 'article.crm-card', // + filter by h3 text, value = div.crm-kpi
  leadsTab: 'a[role="tab"].crm-leads-tab',
  leadsTabCount: 'span.crm-leads-tab-count',
  leadsTypeChip: 'button.crm-leads-type-chip',
  leadsStatusFilter: 'select[aria-label="Filter by status"]',
  leadsCampaignFilter: 'select[aria-label="Filter by campaign"]',
  leadsSearch: 'input[placeholder="Search name, lead no, company, phone, email"]',
  leadsExport: 'button.crm-export-button',
  leadsTable: 'table.crm-leads-inbox-table',
  leadsTableRows: 'table.crm-leads-inbox-table > tbody > tr',
  leadsPager: 'div.crm-pagination > span',
  moduleCard: 'a.crm-module-hub-card', // + [href="/reports/leads"]
  moduleStatus: 'span.crm-module-hub-status', // .is-live / .is-partial / .is-planned
  reportTab: 'button.crm-tab-button',
  viewSegment: 'button.crm-dashboard-view-segment-button',
  reportPanel: 'section.crm-panel',
  reportTable: 'table.crm-report-table',
  reportPeriod: 'select.crm-input:has(option[value="this_month"])',
  navLink: 'a.crm-nav-link',
};

// ── Playwright helpers ──────────────────────────────────────────────────────
export const at = (page: Page, xpath: string): Locator => page.locator(`xpath=${xpath}`);

/** Value element of ANY KPI card on any page (hub snapshot, exec/leads cards, report modules). */
export const kpiLocator = (page: Page, label: string): Locator =>
  page.locator(`xpath=${XP.hubKpi(label)} | ${XP.execKpi(label)} | ${XP.reportKpi(label)}`).first();

// ── What lives where (labels exactly as they appear in the DOM) ──────────────
export const HUB_SNAPSHOT = [
  'Active Leads', 'Open Opportunities', 'Units Available', 'Units Reserved', 'Units Sold',
  'Pipeline Value', 'Weighted Pipeline', 'SPA Value Signed (This Month)',
];

export const HUB_MODULES: { name: string; href: string }[] = [
  { name: 'Lead Reports', href: ROUTES.reports.leads },
  { name: 'Sales Reports', href: ROUTES.reports.sales },
  { name: 'Inventory Reports', href: ROUTES.reports.inventory },
  { name: 'Customer Reports', href: ROUTES.reports.customers },
  { name: 'Broker Reports', href: ROUTES.reports.brokers },
  { name: 'Marketing Reports', href: ROUTES.reports.marketing },
  { name: 'Reservation Reports', href: ROUTES.reports.reservations },
  { name: 'SPA Reports', href: ROUTES.reports.spa },
  { name: 'Collection Reports', href: ROUTES.reports.collections },
  { name: 'Executive Reports', href: ROUTES.dashboard },
  { name: 'Exception Reports', href: ROUTES.reports.exceptions },
];

export const LEADS_KPIS = ['Total Leads', 'Assigned', 'Qualified', 'Disqualified', 'Avg Score'];
export const LEADS_TABS = ['All Leads', 'My Leads', 'Unassigned', 'To Qualify', 'Ready to Convert'];
export const LEAD_STATUSES = [
  'New', 'Assigned', 'Contacted', 'Qualified', 'Nurturing', 'Converted',
  'Opportunity Created', 'Lost', 'Disqualified', 'Duplicate',
];
/** From the app's own note: "Active leads exclude converted, lost, disqualified, and duplicate leads." */
export const INACTIVE_LEAD_STATUSES = ['Converted', 'Lost', 'Disqualified', 'Duplicate'];

export const DASHBOARD_KPIS = [
  'Active Leads', 'Converted Leads', 'Open Opportunities', 'Reserved Units', 'SPAs Executed',
  'Units Available', 'Sales Value (SPAs)', 'Collections Received', 'Outstanding Amount', 'Won Opportunities',
];

/** KPI cards and report tables on each module page (modules open on "Last 12 months"). */
export const REPORT_PAGES: Record<string, { path: string; kpis: string[]; tables: string[] }> = {
  'Lead Reports': {
    path: ROUTES.reports.leads,
    kpis: ['Leads Captured', 'Contact Rate', 'Qualification Rate', 'Opportunity Conversion', 'SPA Signed', 'Won Value', 'Avg Time to First Contact', 'Open Leads Now'],
    tables: [],
  },
  'Sales Reports': {
    path: ROUTES.reports.sales,
    kpis: ['Open opportunities', 'Pipeline value', 'Weighted pipeline', 'Won in period', 'Won value', 'Win rate', 'Average days to win', 'Past expected close'],
    tables: ['Open Pipeline by Stage', 'Salesperson Pipeline', 'Open Opportunities'],
  },
  'Inventory Reports': {
    path: ROUTES.reports.inventory,
    kpis: ['Total units', 'Available', 'Reserved', 'Sold', 'Sold %', 'Available value', 'Average available price', 'Sold in period'],
    tables: ['Availability Summary', 'Inventory by Project', 'Inventory by Unit Type', 'Inventory by Bedrooms', 'Available Units'],
  },
  'Customer Reports': {
    path: ROUTES.reports.customers,
    kpis: ['Active customers', 'New in period', 'Customers with SPA', 'Repeat buyers', 'SPA value', 'Average value per buyer', 'Portal access'],
    tables: ['Customers by Nationality', 'Customers by Country of Residence', 'Customers by Type', 'New Customers in Period'],
  },
  'Broker Reports': {
    path: ROUTES.reports.brokers,
    kpis: ['Active brokers', 'Brokers with SPA', 'Broker leads', 'Broker reservations', 'Broker SPAs', 'Broker SPA value', 'Broker share of SPAs'],
    tables: ['Broker Performance'],
  },
  'Marketing Reports': {
    path: ROUTES.reports.marketing,
    kpis: ['Running today', 'Campaign budget', 'Campaign leads', 'Leads to SPA', 'Revenue', 'Cost per lead', 'ROI'],
    tables: ['Campaign Performance', 'Performance by Channel'],
  },
  'Reservation Reports': {
    path: ROUTES.reports.reservations,
    kpis: ['Reservations in period', 'Reservation amount', 'Converted to SPA', 'Conversion rate', 'Active now', 'Expiring in 7 days', 'Past expiry, still active', 'Deposit not received'],
    tables: ['Reservations by Month', 'Reservations by Project', 'Reservations by Salesperson', 'Active Reservations'],
  },
  'SPA Reports': {
    path: ROUTES.reports.spa,
    kpis: ['SPAs signed in period', 'Signed value', 'Average SPA value', 'Awaiting signature', 'Average days reservation to SPA', 'Handed off to ERP', 'Signed, KYC not approved'],
    tables: ['SPAs Signed by Month', 'SPAs by Project', 'SPAs by Salesperson', 'SPAs Needing Action'],
  },
  'Collection Reports': {
    path: ROUTES.reports.collections,
    kpis: ['Scheduled', 'Received', 'Outstanding', 'Overdue', 'Collection rate', 'Due in next 30 days', 'Due in period', 'Received of due in period'],
    tables: ['Outstanding by Age', 'Collections by Project', 'Overdue Instalments'],
  },
  'Exception Reports': {
    path: ROUTES.reports.exceptions,
    kpis: ['Open exceptions', 'Overdue instalments', 'Reservations past expiry', 'Expiring in 7 days', 'SPAs unsigned > 14 days', 'Leads not contacted'],
    tables: [
      'Exception Summary', 'Overdue instalments', 'Reservations past expiry', 'Reservation deposit not received after 7 days',
      'SPAs not signed after 14 days', 'Signed SPAs with KYC not approved', 'Signed SPAs not handed off to ERP after 3 days',
      'Open opportunities past expected close date', 'Leads not contacted after 2 days',
    ],
  },
};

/** Lead Reports tabs (?tab=…): their KPI cards and panel headings. */
export const LEAD_REPORT_TABS: { name: string; param: string; kpis: string[]; panels: string[] }[] = [
  { name: 'Overview & Funnel', param: '', kpis: REPORT_PAGES['Lead Reports'].kpis, panels: ['Lead Funnel', 'Data Completeness', '12-Month Trend'] },
  { name: 'Source & Channel', param: 'source', kpis: [], panels: ['Performance by Lead Source'] },
  { name: 'Aging & Follow-up', param: 'aging', kpis: ['Open Leads', 'Idle Over 30 Days', 'Never Contacted', 'Overdue Follow-ups'],
    panels: ['Idle Time', 'Lead Age', 'Open Leads by Salesperson', 'Open Leads by Status', 'Longest Idle Leads'] },
  { name: 'Qualification & Conversion', param: 'qualification',
    kpis: ['Capture → First Contact', 'Capture → Qualified', 'Capture → Opportunity', 'Capture → SPA Signed'],
    panels: ['Conversion by Lead Rating', 'Conversion by Lead Score', 'Where the Leads Are Now', 'Lost Reasons'] },
  { name: 'Salesperson Scorecard', param: 'scorecard', kpis: [], panels: ['Salesperson Scorecard'] },
];
