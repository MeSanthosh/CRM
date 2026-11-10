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
  serviceRequests: '/service-requests',
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
  /** Report module / Leads card value: <article|button class=crm-card><h3>Label</h3><div.crm-kpi>39</div> (Leads cards are buttons since v2.0) */
  reportKpi: (label: string) => `//*[self::article or self::button][contains(@class,'crm-card')][h3[normalize-space()=${xl(label)}]]/div[contains(@class,'crm-kpi')]`,
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
  /** Total row of a report table (in <tfoot>) */
  reportTableTotal: (heading: string) => `${XP.reportTable(heading)}/tfoot/tr`,
  reportPanelExport: (heading: string) => `${XP.reportPanel(heading)}//button[contains(@class,'crm-export-button')]`,
  navLink: (href: string) => `//a[contains(@class,'crm-nav-link')][@href=${xl(href)}]`,
  /** Side-nav mode switch ("Frequent" / "All Modules"); Frequent lists only pinned modules. */
  navMode: (label: string) => `//button[contains(@class,'crm-sidebar-mode-btn')][contains(normalize-space(),${xl(label)})]`,

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

// ── Service Requests (/service-requests), taken from frontend bundle index-BDfmsX8C.js on 2026-10-22 ──
// Two panels side by side: the queue (left) and the detail panel (right), which shows "Select a request",
// the "New service request" form or the open ticket.
const srHeader = `//main//section[contains(@class,'crm-module-header')]`;
const srQueue = `//main//section[contains(@class,'crm-panel')][.//h3[starts-with(normalize-space(),'Queue (')]]`;
const srDetail = `//main//section[contains(@class,'crm-detail-panel')]`;
const srHistory = `${srDetail}//section[@aria-label='Change history']`;
const srAttachments = `${srDetail}//div[contains(@class,'crm-section')][div[contains(@class,'crm-panel-header')]/h3[normalize-space()='Attachments']]`;
const srRows = `${srQueue}//table/tbody/tr[not(td[contains(@class,'crm-empty-cell')])]`;

export const SR_XP = {
  eyebrow: `${srHeader}//p[contains(@class,'crm-eyebrow')]`,
  heading: `${srHeader}//h2`,
  subtitle: `${srHeader}//p[contains(@class,'crm-muted-text')]`,
  /** Reads "Hide tips" while the help panel is shown, "Show tips" while hidden. */
  tipsButton: `${srHeader}//button[normalize-space()='Hide tips' or normalize-space()='Show tips']`,
  newRequest: `${srHeader}//button[normalize-space()='New Request']`,
  helpPanel: `//main//section[contains(@class,'crm-help-panel')]`,
  helpTitle: `//main//section[contains(@class,'crm-help-panel')]//h3`,
  helpSteps: `//main//section[contains(@class,'crm-help-panel')]//ol/li`,
  helpNote: `//main//section[contains(@class,'crm-help-panel')]//aside`,
  // the inline banner; the same message also appears in a toast (role=status) further down the page
  successBanner: `(//main//div[contains(@class,'crm-success-banner')])[1]`,

  // queue
  queueHeading: `${srQueue}//h3[starts-with(normalize-space(),'Queue (')]`,
  search: `${srQueue}//input[@placeholder='Search request no, customer, subject']`,
  statusFilter: `${srQueue}//select[option[1][normalize-space()='All statuses']]`,
  queueColumns: `${srQueue}//table/thead//th`,
  /** Ticket rows only (not the "No service requests…" row). */
  queueRows: srRows,
  queueEmpty: `${srQueue}//table/tbody//td[contains(@class,'crm-empty-cell')]`,
  queueRow: (requestNo: string) => `${srRows}[.//button[normalize-space()=${xl(requestNo)}]]`,
  requestLink: (requestNo: string) => `${srRows}//button[contains(@class,'crm-link-button')][normalize-space()=${xl(requestNo)}]`,

  // detail panel: empty state and new-request form
  detailPanel: srDetail,
  emptyState: `${srDetail}//div[contains(@class,'crm-empty-state')]`,
  emptyNewRequest: `${srDetail}//div[contains(@class,'crm-empty-state')]//button[normalize-space()='New Request']`,
  /** h3 of the detail panel: "New service request" or "SR-… — subject". */
  detailTitle: `${srDetail}/div[contains(@class,'crm-panel-header')]//h3`,
  detailSubtitle: `${srDetail}/div[contains(@class,'crm-panel-header')]//p`,
  detailDescription: `${srDetail}/p[contains(@class,'crm-aftersales-body')]`,
  form: `${srDetail}//form`,
  cancel: `${srDetail}//button[normalize-space()='Cancel']`,
  createButton: `${srDetail}//form//button[@type='submit']`,
  /** A form/detail field by its label: Customer, Type, Priority, Subject, Description, Status, Assigned to. */
  fieldLabel: (label: string) => `${srDetail}//label[contains(@class,'crm-field')][span[normalize-space()=${xl(label)}]]`,
  field: (label: string) => `${srDetail}//label[contains(@class,'crm-field')][span[normalize-space()=${xl(label)}]]/*[self::select or self::input or self::textarea]`,

  // detail panel: open ticket
  timelineItems: `${srDetail}//div[contains(@class,'crm-section')][h3[normalize-space()='Progress timeline']]/ol/li`,
  timelineEmpty: `${srDetail}//div[contains(@class,'crm-section')][h3[normalize-space()='Progress timeline']]/p`,
  history: srHistory,
  historyRefresh: `${srHistory}//button[normalize-space()='Refresh' or normalize-space()='Refreshing...']`,
  historyEntries: `${srHistory}//li[contains(@class,'crm-audit-entry')]`,
  historyShowAll: `${srHistory}//button[starts-with(normalize-space(),'Show all')]`,
  conversation: `${srDetail}//div[contains(@class,'crm-section')][h3[normalize-space()='Conversation']]`,
  comments: `${srDetail}//div[contains(@class,'crm-aftersales-thread')]/div[contains(@class,'crm-aftersales-bubble')]`,
  replyBox: `${srDetail}//label[contains(@class,'crm-field')][span[normalize-space()='Reply to customer']]/textarea`,
  postReply: `${srDetail}//button[normalize-space()='Post Reply' or normalize-space()='Posting…']`,
  attachments: srAttachments,
  addFile: `${srAttachments}//label[contains(@class,'crm-file-button')]`,
  fileInput: `${srAttachments}//label[contains(@class,'crm-file-button')]/input[@type='file']`,
  attachmentLinks: `${srAttachments}//ul/li/a`,
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

/** Service Requests: texts as they appear on the page (index-BDfmsX8C.js). */
export const SR_TEXT = {
  eyebrow: 'After-Sales',
  heading: 'Service Requests',
  subtitle: 'Staff ticket queue — assign owners, update status, reply to customers, and attach files.',
  helpTitle: 'How to work Service Requests',
  helpNote: 'Not a chat inbox',
  emptyTitle: 'Select a request',
  emptyText: 'Open a ticket from the queue to assign an owner, change status, and reply to the customer.',
  formTitle: 'New service request',
  formSubtitle: 'Create a staff ticket on behalf of a customer.',
  queueEmpty: 'No service requests in this filter. Portal tickets will appear here when customers submit them.',
  columns: ['Request', 'Customer', 'Priority', 'Status', 'Opened'],
  formFields: ['Customer', 'Type', 'Priority', 'Subject', 'Description'],
  requiredFields: ['Customer', 'Subject', 'Description'],
  detailFields: ['Status', 'Priority', 'Type', 'Assigned to'],
  /** Success banners (message body). */
  created: (requestNo: string) => `Created ${requestNo}.`,
  updated: 'Request updated.',
  replyPosted: 'Reply sent to customer.', // was "Reply posted to customer." before build index-DGibO5LD
  attachmentUploaded: 'Attachment uploaded.',
  required: (label: string) => `${label} is required.`,
};

// ── Reports catalogue (/reports-analytics, build v2.0 0411) and single reports — tests/reports ──
const repCard = (code: string) => `//main//article[contains(@class,'crm-report-catalog-card')][.//span[contains(@class,'crm-report-code-badge')][normalize-space()=${xl(code)}]]`;
const repHeader = `//main//section[contains(@class,'crm-module-header')]`;
export const REP_XP = {
  /** Category tab: <button role=tab class=crm-report-tab-btn><span…label>Lead Reports</span><span…badge>7</span></button> */
  catalogTab: (label: string) => `//main//button[@role='tab'][.//span[contains(@class,'crm-report-tab-btn-label')][normalize-space()=${xl(label)}]]`,
  catalogTabBadge: (label: string) => `${REP_XP.catalogTab(label)}//span[contains(@class,'crm-report-tab-badge')]`,
  catalogCards: `//main//article[contains(@class,'crm-report-catalog-card')]`,
  /** Labels of every category tab, and the code badge of every card on the open tab */
  catalogTabLabels: `//main//button[@role='tab']//span[contains(@class,'crm-report-tab-btn-label')]`,
  catalogCardCodes: `//main//article[contains(@class,'crm-report-catalog-card')]//span[contains(@class,'crm-report-code-badge')]`,
  catalogCard: repCard,
  cardTitle: (code: string) => `${repCard(code)}//h4[contains(@class,'crm-report-catalog-card-title')]`,
  cardDescription: (code: string) => `${repCard(code)}//p[contains(@class,'crm-report-catalog-card-desc')]`,
  cardColumns: (code: string) => `${repCard(code)}//span[contains(@class,'crm-report-metric-tag')]`,
  cardCategory: (code: string) => `${repCard(code)}//span[contains(@class,'crm-report-catalog-card-cat')]`,
  cardOpen: (code: string) => `${repCard(code)}//a[contains(@class,'crm-report-open-btn')]`,
  /** Single report page */
  backLink: `//main//div[contains(@class,'crm-single-report-nav-bar')]/a`,
  siblingPill: (code: string) => `//main//a[contains(@class,'crm-single-report-pill')][normalize-space()=${xl(code)}]`,
  reportCode: `${repHeader}//span[contains(@class,'crm-report-code-badge')]`,
  reportTitle: `${repHeader}//h2`,
  reportDescription: `${repHeader}//p[contains(@class,'crm-muted-text')]`,
  /** Header metadata chip value: <div.crm-report-meta-chip>…<span…label>Total Records</span><strong…val>41</strong> (tiles before build index-DGibO5LD) */
  tile: (label: string) => `//main//div[contains(@class,'crm-report-meta-chip-content')][span[contains(@class,'crm-report-meta-chip-label')][normalize-space()=${xl(label)}]]/strong`,
  /** The report's table panel: <section class=crm-panel id="leadRegister05"> */
  panelTable: (panelId: string) => `//main//section[@id=${xl(panelId)}]//table[contains(@class,'crm-report-table')]`,
  panelExport: (panelId: string) => `//main//section[@id=${xl(panelId)}]//button[contains(@class,'crm-export-button')]`,
  definitionTerms: `//main//details[contains(@class,'crm-report-definitions')]//li/strong`,
  /** The whole "How these numbers are calculated" section (its text holds the stated targets) */
  definitions: `//main//details[contains(@class,'crm-report-definitions')]`,
  /** Every entry of that section, nested ones included ("Owner: … (CFO, Sales Director, …)") */
  definitionItems: `//main//details[contains(@class,'crm-report-definitions')]//li`,
  userName: `//button[contains(@class,'crm-user-menu-button')]//span[contains(@class,'crm-user-menu-text')]/strong`,
  /** Any element showing exactly this text (e.g. a Lead ID in the Leads module detail) */
  exactText: (text: string) => `//main//*[normalize-space()=${xl(text)}]`,
  /** Filter dropdown by its label: <label class=crm-field><span class=crm-label>Project</span><select> */
  // filters sit in the report toolbar since build index-DGibO5LD (section.crm-report-filters before)
  filter: (label: string) => `//main//section[contains(@class,'crm-report-toolbar')]//label[span[contains(@class,'crm-label')][normalize-space()=${xl(label)}]]/select`,
  /** Any visible message containing this text (inline error or toast) */
  message: (text: string) => `//*[not(self::script)][contains(normalize-space(),${xl(text)})][not(*[contains(normalize-space(),${xl(text)})])]`,
  /** Leads module "Lead Detail" dialog opened from a report's Lead ID link */
  leadDetail: `//section[@role='dialog'][contains(@class,'crm-lead-detail-modal')]`,
  /** "LD-2026-0037 · Sebastian Weber" under the dialog title */
  leadDetailSubtitle: `//section[@role='dialog'][contains(@class,'crm-lead-detail-modal')]/div[contains(@class,'crm-panel-header')]//p`,
  leadDetailTile: (label: string) => `//section[@role='dialog'][contains(@class,'crm-lead-detail-modal')]//div[contains(@class,'crm-lead-summary-tile')][.//div[contains(@class,'crm-lead-summary-tile-label')][normalize-space()=${xl(label)}]]/div[contains(@class,'crm-lead-summary-tile-value')]`,
};

/** Cells of a Leads module row (CSS, relative to the <tr>). */
export const LEADS_ROW = {
  name: 'div.crm-leads-lead-cell > strong',
  leadNo: 'div.crm-leads-lead-cell a.crm-record-link',
  source: 'td.crm-leads-source-cell',
  status: 'span.crm-leads-status-chip',
  assigned: 'td.crm-leads-assigned-cell',
};

/** Reports catalogue texts and the reports covered by tests/reports. */
export const REP_TEXT = {
  leadRegister: {
    code: 'RPT-05',
    category: 'Lead Reports',
    title: 'Report #05 — Lead Register',
    route: '/reports/governance',
    query: 'report=leadRegister05',
    panelId: 'leadRegister05',
    columns: ['Lead ID', 'Prospect Name', 'Channel Source', 'Assigned Broker / Rep', 'Qualification Status',
      'Target Unit Interest', 'Budget Range ($)', 'Current Stage', 'Next Follow-up Date'],
    backLabel: '← Back to Lead Reports',
    /** Filter label → query parameter the report request carries for it */
    filters: { Project: 'projectCode', Salesperson: 'ownerUserId' },
  },
  executiveDashboard: {
    code: 'RPT-01',
    category: 'Executive & Governance',
    title: 'Report #01 — Executive Dashboard (KPI vs Target)',
    route: '/reports/governance',
    query: 'report=executiveDashboard01',
    panelId: 'executiveDashboard01',
    columns: ['Metric Category', 'Baseline Target', 'Current Actual', 'Variance ($)', 'Variance (%)', 'Status Flag',
      'Primary Driver', 'Control Action'],
    backLabel: '← Back to Executive & Governance',
    filters: { Project: 'projectCode', Salesperson: 'ownerUserId' },
    /** Rows of the scorecard, in order (the methodology lists the same five) */
    metrics: { gross: 'Gross Portfolio Realization', spas: 'Executed SPAs', escrow: 'Escrow Collections',
      broker: 'Broker Commissions Accrued', roas: 'Marketing ROAS' },
    /** Other reports of the category, shown as pills next to RPT-01 */
    siblings: ['RPT-03', 'RPT-23'],
    exportSheet: 'Executive Dashboard',
    /** Status flags as the methodology defines them: performing well / within a cost budget */
    goodFlags: ['ON_TARGET', 'EXCEEDED', 'HEALTHY', 'OPTIMAL'],
    budgetFlag: 'ON_BUDGET',
    /** Section headings of the methodology ("Baseline Target: … targets …"), in page order */
    methodology: { baseline: 'Baseline Target', actual: 'Current Actual' },
  },
  /** RPT-03 Control & Assumptions Register: the commercial parameters RPT-01 and the CRM models use */
  controlAssumptions: {
    code: 'RPT-03',
    category: 'Executive & Governance',
    title: 'Report #03 — Control & Assumptions Register',
    route: '/reports/governance',
    query: 'report=controlAssumptions03',
    panelId: 'controlAssumptions03',
    columns: ['Parameter', 'Base Value', 'Optimistic', 'Conservative', 'Unit of Measure', 'Owner', 'Review', 'Control Logic'],
    backLabel: '← Back to Executive & Governance',
    filters: { Project: 'projectCode', Salesperson: 'ownerUserId' },
    exportSheet: 'Control & Assumptions',
    brokerRate: 'Standard Broker Commission Rate',
    tierBonus: 'Tier 1 Gold Broker Bonus Accelerator',
    /** Unit of Measure values: a percentage, and a rate per area (its parameter name ends in the unit types) */
    percentUnit: 'Percentage',
    perArea: '/ sqm',
  },
  /** RPT-23 Master Data Dictionary & Report Index: KPI definitions, formulas and source sheets */
  dataDictionary: {
    code: 'RPT-23',
    category: 'Executive & Governance',
    title: 'Report #23 — Master Data Dictionary & Report Index',
    route: '/reports/governance',
    query: 'report=dataDictionary23',
    panelId: 'dataDictionary23',
    columns: ['Term Code', 'KPI / Control Term', 'Technical Definition', 'Standard Formula / Calculation', 'Primary Data Source', 'Governance Control'],
    backLabel: '← Back to Executive & Governance',
    filters: { Project: 'projectCode', Salesperson: 'ownerUserId' },
    exportSheet: 'Data Dictionary & Controls',
    /** Words of the report description that promise more than KPI definitions */
    indexPromise: 'all business reports',
    cadencePromise: 'refresh cadence',
    /** Prefix of the numbered reports in the catalogue ("RPT-04" ↔ "Sheet 04") */
    reportPrefix: 'RPT-',
  },
  /** RPT-21 Summary by Property Type: inventory and sales totals per property category */
  propertySummary: {
    code: 'RPT-21',
    category: 'Inventory Reports',
    title: 'Report #21 — Summary by Property Type',
    route: '/reports/inventory',
    query: 'report=propertyTypeSummary21',
    panelId: 'propertyTypeSummary21',
    columns: ['Property Category', 'Total Keys', 'Total Carpet Area (sqm)', 'Base Gross Value ($)', 'SPA Sold Keys',
      'Contracted SPA Value ($)', 'Unsold Value ($)', 'Absorption %'],
    backLabel: '← Back to Inventory Reports',
    /** This report has no Salesperson filter */
    filters: { Project: 'projectCode' },
    filterLabels: ['Period', 'Project'],
    siblings: ['RPT-18', 'RPT-04'],
    exportSheet: 'Summary by Property Type',
    totalLabel: 'TOTAL PORTFOLIO SUMMARY',
    /** Data keys of the columns: inventory columns (no period) and sales columns (executed SPAs) */
    keys: { category: 'propertyCategory', keys: 'totalKeys', area: 'totalCarpetAreaSqm', base: 'baseGrossValue',
      sold: 'spaSoldKeys', contracted: 'contractedSpaValue', unsold: 'unsoldValue', absorption: 'absorptionPct' },
  },
  /** RPT-18 Revenue Management Engine: quarterly absorption and dynamic rate action per product (sub-category) */
  revenueManagement: {
    code: 'RPT-18',
    category: 'Inventory Reports',
    title: 'Report #18 — Revenue Management Engine',
    route: '/reports/inventory',
    query: 'report=revenueManagement18',
    panelId: 'revenueManagement18',
    columns: ['Property Sub-Category', 'Total Units', 'Target Qtr Absorption', 'Actual Qtr Absorption', 'Target Achievement %',
      'Demand Trigger Status', 'Automated Pricing Action', 'Rate Adjustment %', 'Base Avg Rate / sqm', 'Adjusted Rate / sqm'],
    backLabel: '← Back to Inventory Reports',
    filters: { Project: 'projectCode' },
    filterLabels: ['Period', 'Project'],
    siblings: ['RPT-21', 'RPT-04'],
    exportSheet: 'Revenue Management Engine',
    keys: { name: 'propertySubCategory', units: 'totalUnits', target: 'targetQtrAbsorption', actual: 'actualQtrAbsorption',
      achievement: 'targetAchievementPct', status: 'demandTriggerStatus', action: 'automatedPricingAction',
      adjustment: 'rateAdjustmentPct', base: 'baseAvgRateSqm', adjusted: 'adjustedRateSqm' },
    /**
     * The engine's pricing rule as its methodology states it: status → action ("Escalate Price (+3.0%) … for high-demand
     * apartments", "(+5.0%) … for high-demand penthouses", Maintain for on-target, Discount for slowdown).
     */
    actions: {
      HIGH_DEMAND: { premium: 'Escalate Price (+5.0%)', standard: 'Escalate Price (+3.0%)' },
      ON_TARGET: 'Maintain Base Rate',
      CRITICAL_SLOWDOWN: 'Apply Discount (-5.0%)',
    },
    /** Unit type priced at the premium escalation */
    premiumType: 'Penthouse',
    /** Reservation statuses that count as a confirmed reservation (cancelled ones do not) */
    confirmedReservations: ['APPROVED', 'CONVERTED_TO_CONTRACT'],
  },
  /** RPT-16 Sales Funnel & Conversion Analysis: five pipeline stages from lead intake to executed SPA */
  salesFunnel: {
    code: 'RPT-16',
    category: 'Sales Reports',
    title: 'Report #16 — Sales Funnel & Conversion Analysis',
    route: '/reports/sales',
    query: 'report=salesFunnel16',
    panelId: 'salesFunnel16',
    columns: ['Stage Code', 'Funnel Stage Name', 'Prospect Count', 'Aggregate Value ($)', 'Stage Conversion %',
      'Cumulative Conversion %', 'Avg Stage Velocity (Days)', 'Leakage Control Strategy'],
    backLabel: '← Back to Sales Reports',
    filters: { Project: 'projectCode', Salesperson: 'ownerUserId', Broker: 'brokerId', Campaign: 'campaignId' },
    filterLabels: ['Period', 'Project', 'Salesperson', 'Broker', 'Campaign'],
    siblings: ['RPT-19', 'RPT-20', 'RPT-07', 'SLS-04'],
    exportSheet: 'Sales Funnel & Conversion',
    keys: { code: 'stageCode', name: 'funnelStageName', count: 'prospectCount', value: 'aggregateValue',
      stage: 'stageConversionPct', cumulative: 'cumulativeConversionPct', velocity: 'avgStageVelocityDays', leakage: 'leakageControlStrategy' },
    /** The five stages in funnel order (the methodology lists the same names); each is counted from its own module */
    stages: ['Lead Intake', 'SQL (Qualified)', 'Opportunity / VR Presentation', 'Reservation (Hold)', 'SPA Executed & Active'],
    /** Lead statuses that have passed qualification, and the reservation status that left the funnel */
    qualifiedStatuses: ['QUALIFIED', 'CONVERTED'],
    cancelledReservation: 'CANCELLED',
  },
  /** RPT-19 Smart Sales Forecast: probability-weighted pipeline and unit absorption per forecast month */
  smartForecast: {
    code: 'RPT-19',
    category: 'Sales Reports',
    title: 'Report #19 — Smart Sales Forecast',
    route: '/reports/sales',
    query: 'report=smartForecast19',
    panelId: 'smartForecast19',
    columns: ['Forecast Period', 'Pipeline Opportunity Volume', 'Weighted Conversion Probability %', 'Expected Unit Sales Absorption',
      'Avg Selling Price / Unit ($)', 'Projected Monthly Contract Sales ($)', 'Cumulative Projected Sales ($)'],
    backLabel: '← Back to Sales Reports',
    /** No filters or All / Mine since build index-Dmirkzo4 (the toolbar is hidden on this report) */
    filters: {},
    siblings: ['RPT-16', 'RPT-20', 'RPT-07', 'SLS-04'],
    exportSheet: 'Smart Sales Forecast',
    totalLabel: 'TOTAL FORECAST',
    keys: { period: 'forecastPeriod', volume: 'pipelineOpportunityVolume', probability: 'weightedConversionProbabilityPct',
      absorption: 'expectedUnitSalesAbsorption', price: 'avgSellingPriceUnit', monthly: 'projectedMonthlyContractSales',
      cumulative: 'cumulativeProjectedSales' },
    /** Opportunity statuses: still in the pipeline, won and lost (the closing yield is won ÷ won + lost) */
    openStatus: 'OPEN',
    wonStatus: 'WON',
    lostStatus: 'LOST',
    /** Inventory availability of a unit that is for sale */
    available: 'AVAILABLE',
    /** RPT-20 Project Cash Flow, whose forecast months use the same "Mnn (Mon YYYY)" labels */
    cashFlow: { code: 'RPT-20', panelId: 'projectCashFlow20', period: 'forecastPeriod' },
  },
  /** RPT-20 Project Cash Flow Forecast: monthly buyer inflows, outflows, net cash and escrow runway */
  cashFlow: {
    code: 'RPT-20',
    category: 'Sales Reports',
    title: 'Report #20 — Project Cash Flow Forecast',
    route: '/reports/sales',
    query: 'report=projectCashFlow20',
    panelId: 'projectCashFlow20',
    columns: ['Forecast Period', 'Estimated Buyer Inflows ($)', 'Projected Dev Outflows ($)', 'Broker Comm Outflows ($)',
      'Mkt OpEx Outflows ($)', 'Net Monthly Cash ($)', 'Closing Escrow Fund Balance ($)'],
    backLabel: '← Back to Sales Reports',
    /** No filters or All / Mine since build index-Dmirkzo4 */
    filters: {},
    siblings: ['RPT-16', 'RPT-19', 'RPT-07', 'SLS-04'],
    exportSheet: 'Project Cash Flow Forecast',
    totalLabel: 'TOTAL CASH FLOW',
    keys: { period: 'forecastPeriod', inflows: 'estimatedBuyerInflows', dev: 'projectedDevOutflows', broker: 'brokerCommOutflows',
      mkt: 'mktOpexOutflows', net: 'netMonthlyCash', balance: 'closingEscrowFundBalance' },
    /** Methodology entries that state the escrow formula and the horizon totals */
    runwayTerm: 'Escrow Cash Reserve Runway',
    summaryTerm: 'Total Cash Flow Summary',
    /** Broker commission timing as the methodology states it: half at signing, half once this share is collected */
    brokerSplit: 0.5,
    /** RPT-10 Buyer Payment Ledger: receipts and their escrow status */
    ledger: { route: '/reports/collections', panelId: 'buyerPaymentLedger10', received: 'amountReceived', status: 'bankStatus', cleared: 'Cleared in Escrow' },
  },
  // chip labels since build index-DGibO5LD (were "Total Records in Report" / "Report Created Date & Time")
  tiles: { total: 'Total Records', created: 'Report Created', createdBy: 'Created By' },
  periods: ['This month', 'Last month', 'This quarter', 'Last quarter', 'Year to date', 'Last 12 months', 'Custom dates'],
  /** The app's own rule for custom dates (shown when an export is rejected) */
  rangeError: 'To date must be on or after From date',
  leadDetail: { source: 'Source' },
  myLeadsTab: 'My Leads',
  allLeadsTab: 'All Leads',
};
