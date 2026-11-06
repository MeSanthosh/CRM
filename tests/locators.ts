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
  customers: '/customers',
  opportunities: '/opportunities',
  reservations: '/reservations',
  brokersChannels: '/brokers-channels',
  constructionUpdates: '/construction-updates',
  currencyMaster: '/currencies',
  dashboard: '/', // "Executive Reports" card also opens this
  /** Executive dashboards since build 3110-10 (Commercial / Sales, Monthly Sales & Marketing, Executive Operations, Lead) */
  dashboards: '/dashboards',
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
    governance: '/reports/governance',
  },
} as const;

// ── XPath builders (one per UI pattern) ─────────────────────────────────────
export const XP = {
  /** Reports & Analytics → Executive snapshot card value: <div.crm-module-hub-kpi><span>Label</span><strong>361</strong> */
  hubKpi: (label: string) => `//div[contains(@class,'crm-module-hub-kpi')][span[normalize-space()=${xl(label)}]]/strong`,
  /** Leads page + Executive Dashboard card value: <div.crm-exec-kpi-copy><span>Label</span><strong>615</strong> */
  execKpi: (label: string) => `//div[contains(@class,'crm-exec-kpi-copy')][span[normalize-space()=${xl(label)}]]/strong`,
  /** Leads page card value since v2.0: <button.crm-metric-card-button><h3>Label</h3><div.crm-kpi>39</div> */
  metricKpi: (label: string) => `//button[contains(@class,'crm-metric-card-button')][h3[normalize-space()=${xl(label)}]]/div[contains(@class,'crm-kpi')]`,
  /** Report module card value: <article.crm-card><h3>Label</h3><div.crm-kpi>39</div> */
  reportKpi: (label: string) => `//article[contains(@class,'crm-card')][h3[normalize-space()=${xl(label)}]]/div[contains(@class,'crm-kpi')]`,
  /** Report KPI tile (build 3110-10): div.crm-report-tile > span.crm-report-tile-label + strong.crm-report-tile-value */
  reportTile: (label: string) => `//div[contains(@class,'crm-report-tile')][span[contains(@class,'crm-report-tile-label')][normalize-space()=${xl(label)}]]/strong`,
  /** Sub-report pill "Reports in …: CUS-01 CUS-02 …", by the query it opens (e.g. "report=byResidence") */
  subReportPill: (query: string) => `//*[contains(@class,'crm-single-report-sibling-pills')]//a[contains(@href,${xl(query)})]`,
  /** Leads tab badge: <a.crm-leads-tab>All Leads<span.crm-leads-tab-count>615</span></a> */
  leadsTab: (label: string) => `//a[@role='tab'][contains(@class,'crm-leads-tab')][starts-with(normalize-space(),${xl(label)})]`,
  leadsTabCount: (label: string) => `${XP.leadsTab(label)}/span[contains(@class,'crm-leads-tab-count')]`,
  leadsTypeChip: (name: 'All' | 'Individual' | 'Corporate') => `//button[contains(@class,'crm-leads-type-chip')][normalize-space()=${xl(name)}]`,
  moduleCard: (href: string) => `//a[contains(@class,'crm-module-hub-card')][@href=${xl(href)}]`,
  moduleCardStatus: (href: string) => `${XP.moduleCard(href)}//span[contains(@class,'crm-module-hub-status')]`,
  reportTab: (name: string) => `//button[contains(@class,'crm-tab-button')][normalize-space()=${xl(name)}]`,
  viewSegment: (name: 'All' | 'You and your team' | 'Mine') => `//button[contains(@class,'crm-dashboard-view-segment-button')][normalize-space()=${xl(name)}]`,
  reportPanel: (heading: string) => `//section[contains(@class,'crm-panel')][.//h3[normalize-space()=${xl(tableHeading(heading))}]]`,
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
  /** Monthly snapshot views (Commercial / Sales, Monthly Sales & Marketing): "REPORT PERIOD" dropdown */
  dashboardReportPeriod: `//main//select[option[@value='current']]`,
  /** Snapshot views have no classes: find a tile label or panel heading by its text, ignoring case (shown in upper case) */
  dashboardLabel: (label: string) => `//main//*[not(*)][translate(normalize-space(),'abcdefghijklmnopqrstuvwxyz','ABCDEFGHIJKLMNOPQRSTUVWXYZ')=${xl(label.toUpperCase())}]`,
  dashboardHeading: (heading: string) => `//main//*[self::h2 or self::h3 or self::h4][translate(normalize-space(),'abcdefghijklmnopqrstuvwxyz','ABCDEFGHIJKLMNOPQRSTUVWXYZ')=${xl(heading.toUpperCase())}]`,
  dashboardTableAfter: (heading: string) => `(${XP.dashboardHeading(heading)}/following::table)[1]`,
  /** A table found by one of its column headers (snapshot views have no panel classes) */
  tableWithHeader: (header: string) => `//main//table[.//th[normalize-space()=${xl(header)}]]`,
  /** Header action buttons (Data Movement, AI Insights, Edit Targets) */
  dashboardAction: (name: string) => `//main//button[contains(normalize-space(),${xl(name)})]`,
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
  /** Module tab bar on the report modules (Sales … Exceptions are buttons, Leads is a link) */
  moduleTab: (name: string) => `//main//*[self::button or self::a][contains(@class,'crm-tab-button')][normalize-space()=${xl(name)}]`,
  moduleTabs: `//main//*[self::button or self::a][contains(@class,'crm-tab-button')]`,
  /** Report table parts: Total row (tfoot) and record links in the body */
  reportTableTotal: (heading: string) => `${XP.reportTable(heading)}/tfoot/tr`,
  reportTableLinks: (heading: string) => `${XP.reportTable(heading)}/tbody//a`,
  /** Empty-list message on report tables */
  reportEmpty: `//main//*[normalize-space()='Nothing matches these filters.']`,
  /** Custom-dates validation message */
  reportDateError: `//main//*[starts-with(normalize-space(),'Choose both From and To dates')]`,
  /** Customers page (/customers): register rows (first cell = name + Customer ID) and the customer form opened from a report link */
  customerRegisterRows: `//main//section[contains(@class,'crm-panel')][.//*[normalize-space()='Customer Register']]//table/tbody/tr`,
  customerRecordForm: `//form[contains(@class,'crm-management-modal')]`,
  /** Any record panel or form opened from a report link (detail modal, dialog or edit form) */
  recordPanel: `//*[contains(@class,'crm-modal') or @role='dialog' or contains(@class,'crm-management-modal')]`,
  /** Record detail panel opened from a report link, e.g. "Reservation Detail" */
  recordDetail: (title: string) => `//*[contains(@class,'crm-modal') or @role='dialog'][.//*[normalize-space()=${xl(title)}]]`,

  /** Leads page: create buttons (links), KPI card buttons, page description, sortable column headers */
  leadsCreate: (kind: 'individual' | 'corporate') => `//main//a[@href='/leads/${kind}/new']`,
  leadsKpiCard: (label: string) => `//button[contains(@class,'crm-metric-card-button')][h3[normalize-space()=${xl(label)}]]`,
  leadsPageDescription: `//main//p[contains(@class,'crm-leads-exec-subtitle')]`,
  leadsSortHeader: (column: string) => `//table[contains(@class,'crm-leads-inbox-table')]//th//button[contains(@class,'crm-sortable-th-button')][starts-with(normalize-space(),${xl(column)})]`,
  /** Create Individual / Corporate lead form (a modal section with a form) */
  leadForm: `//section[contains(@class,'crm-lead-modal')][.//form]`,
  leadFormHeading: `//section[contains(@class,'crm-lead-modal')]//h3[@id='lead-create-title']`,
  leadFormSections: `//section[contains(@class,'crm-lead-modal')]//h4[contains(@class,'crm-form-section-title')]`,
  leadFormField: (name: string) => `//section[contains(@class,'crm-lead-modal')]//*[self::input or self::select or self::textarea][@name=${xl(name)}]`,
  /** Labels marked required (*) that belong to an editable field */
  leadFormRequiredLabels: `//section[contains(@class,'crm-lead-modal')]//label[contains(@class,'crm-field')]/span[contains(@class,'crm-label-required')]`,
  leadFormSubmit: `//section[contains(@class,'crm-lead-modal')]//button[@type='submit'][normalize-space()='Create Lead']`,
  leadFormClose: `//section[contains(@class,'crm-lead-modal')]//button[normalize-space()='Close']`,
  /** Field wrapper by its visible label (forms and the Lead Detail panel): <label.crm-field><span.crm-label>Label</span>… */
  fieldByLabel: (label: string) => `//label[contains(@class,'crm-field')][span[contains(@class,'crm-label')][normalize-space()=${xl(label)}]]`,
  /** Pop-up messages ("Required Fields Missing", "Invalid Entry", "Lead Created", confirmations) */
  notice: `//*[contains(@class,'crm-notice-dialog')]`,
  noticeTitle: `//*[contains(@class,'crm-notice-dialog')]//h3`,
  noticeButton: (name: string) => `//*[contains(@class,'crm-notice-dialog')]//button[normalize-space()=${xl(name)}]`,
  /** Custom date / date-time picker */
  dateTrigger: `.//button[contains(@class,'crm-date-field-trigger')]`,
  datePopover: `//*[@role='dialog'][contains(@class,'crm-date-field-popover')]`,
  datePopoverYear: `//*[contains(@class,'crm-date-field-popover')]//select[@aria-label='Year']`,
  datePopoverMonth: `//*[contains(@class,'crm-date-field-popover')]//select[@aria-label='Month']`,
  datePopoverDay: (day: number) => `//*[contains(@class,'crm-date-field-popover')]//button[contains(@class,'crm-calendar-day')][not(contains(@class,'is-outside'))][normalize-space()='${day}']`,
  datePopoverTime: `//*[contains(@class,'crm-date-field-popover')]//input[@type='time']`,
  datePopoverSet: `//*[contains(@class,'crm-date-field-popover')]//button[normalize-space()='Set']`,
  /** Lead Detail panel (opened from a Lead No. link or after a save) */
  leadDetailPanel: `//section[contains(@class,'crm-lead-detail-modal')]`,
  leadDetailButton: (name: string) => `//section[contains(@class,'crm-lead-detail-modal')]//button[normalize-space()=${xl(name)}]`,
  leadDetailSubmit: (name: string) => `//section[contains(@class,'crm-lead-detail-modal')]//button[@type='submit'][normalize-space()=${xl(name)}]`,
  /** Score breakdown box ("Computed: 5 · Suggested rating: Nurture" + "Budget Match: 0/25" …) around Recalculate Score */
  leadScoreBox: `//section[contains(@class,'crm-lead-detail-modal')]//button[normalize-space()='Recalculate Score']/../..`,
  /** Lead Detail identity card (v2.0): name, "LD-… · Assigned to <owner>", status pill "Status: X · Score N", summary tiles */
  leadIdentityLine: `//section[contains(@class,'crm-lead-detail-modal')]//div[contains(@class,'crm-lead-identity-copy')]/span`,
  leadStatusPill: `//section[contains(@class,'crm-lead-detail-modal')]//span[contains(@class,'crm-lead-status-pill')]`,
  leadSummaryTile: (label: string) => `//section[contains(@class,'crm-lead-detail-modal')]//div[contains(@class,'crm-lead-summary-tile')][div[contains(@class,'crm-lead-summary-tile-label')][normalize-space()=${xl(label)}]]/div[contains(@class,'crm-lead-summary-tile-value')]`,
  leadExtraDetails: `//section[contains(@class,'crm-lead-detail-modal')]//button[contains(@class,'crm-lead-extra-details-toggle')]`,
  /** "Next action" cards of a new lead: Reassign Lead / Qualify Lead / Disqualify Lead (OPEN FORM ↓) */
  leadNextActions: `//section[contains(@class,'crm-lead-detail-modal')]//button[contains(normalize-space(),'Open Form')]`,
  /** Tasks & Calls block of a record: action buttons, lists (Open tasks / Call log & completed) and their items */
  activities: `(//section[contains(@class,'crm-lead-detail-modal')]//section[contains(@class,'crm-record-activities')][@aria-label='Tasks and calls'])[1]`,
  activityButton: (name: 'Log call' | 'Add task' | 'Add meeting') => `(//section[contains(@class,'crm-lead-detail-modal')]//section[contains(@class,'crm-record-activities')][@aria-label='Tasks and calls'])[1]//div[contains(@class,'crm-record-activities-buttons')]/button[normalize-space()=${xl(name)}]`,
  activityItems: `(//section[contains(@class,'crm-lead-detail-modal')]//section[contains(@class,'crm-record-activities')][@aria-label='Tasks and calls'])[1]//li[contains(@class,'crm-record-activity')]`,
  activityItem: (subject: string) => `(//section[contains(@class,'crm-lead-detail-modal')]//section[contains(@class,'crm-record-activities')][@aria-label='Tasks and calls'])[1]//li[contains(@class,'crm-record-activity')][.//button[contains(@class,'crm-activity-subject-button')][normalize-space()=${xl(subject)}]]`,
  /** Log Call / New Task / New Meeting / Edit … form */
  activityDialog: `(//*[contains(@class,'crm-activity-dialog')])[last()]`,
  activityDateField: (name: string) => `(//*[contains(@class,'crm-activity-dialog')])[last()]//input[@name=${xl(name)}]/..`,
  activityFieldErrors: `(//*[contains(@class,'crm-activity-dialog')])[last()]//*[contains(@class,'crm-field-error')]`,
  /** Tasks & Calendar page (/activities) */
  tasksFilter: `//main//select[@aria-label='Task filter']`,
  tasksWhose: `//main//select[@aria-label='Whose tasks']`,
  tasksSearch: `//main//input[@placeholder='Search subject or notes']`,
  tasksTable: `//main//table`,
  tasksExport: `//main//button[normalize-space()='Export']`,
  tasksView: (name: 'Tasks' | 'Call log') => `//main//button[normalize-space()=${xl(name)}][not(contains(@class,'crm-primary-button'))]`,
  /** Opportunities list (/opportunities) */
  opportunityRows: `//main//table/tbody/tr`,

  /** Sign-in page (/login): mode buttons, fields (username / password / otp), Show, submit */
  loginForm: `//form[contains(@class,'crm-login-form')]`,
  loginMode: (name: 'Password Login' | 'OTP Login') => `//button[normalize-space()=${xl(name)}]`,
  loginField: (name: string) => `//form[contains(@class,'crm-login-form')]//input[@name=${xl(name)}]`,
  loginShow: `//form[contains(@class,'crm-login-form')]//button[normalize-space()='Show' or normalize-space()='Hide']`,
  loginSubmit: `//form[contains(@class,'crm-login-form')]//button[@type='submit']`,
  loginLink: (name: string) => `//button[normalize-space()=${xl(name)}]`,
  /** User menu items (My Profile, Change Password, Log Out) and dialogs by title */
  userMenuItem: (name: string) => `(//*[self::button or self::a or @role='menuitem'][normalize-space()=${xl(name)}])[last()]`,
  dialogTitled: (title: string) => `(//*[@role='dialog'][.//*[self::h2 or self::h3][normalize-space()=${xl(title)}]])[last()]`,
  /** Users & Roles (/admin) */
  adminButton: (name: string) => `//main//button[normalize-space()=${xl(name)}]`,
  usersSearch: `//main//input[@placeholder='Search user, email, mobile']`,
  adminRows: `//main//table/tbody/tr[td]`,
  /** Audit Log (/admin/audit-log): filters by aria-label, search, the visible table */
  auditSelect: (label: string) => `//main//select[@aria-label=${xl(label)}]`,
  auditSearch: (placeholder: string) => `//main//input[@placeholder=${xl(placeholder)}]`,
  auditTable: `//main//table[contains(@class,'crm-audit-table')]`,
  /** Preferences: a number / checkbox setting found by its caption */
  prefInput: (caption: string) => `(//main//*[normalize-space()=${xl(caption)}]/following::input[1])[1]`,
  /** Main menu entries (not the Settings flyout) */
  mainMenuLinks: `//aside//a[contains(@class,'crm-nav-link')] | //nav//a[contains(@class,'crm-nav-link')]`,

  // ── Inventory, Proposals, SPA / Sales Contracts (and the deal chain behind them) ──
  /** Page title under the eyebrow, e.g. "Projects and Units", "Proposal Workspace" */
  moduleTitle: `//main//*[contains(@class,'crm-module-header')]//h1 | //main//*[contains(@class,'crm-dashboard-title-row')]//h1 | //main//*[contains(@class,'crm-dashboard-title-row')]//h2`,
  /** Tab buttons of a module page (Inventory: Projects, Products, Units, …) */
  pageTab: (name: string) => `//main//button[normalize-space()=${xl(name)}]`,
  /** A panel of the page by its heading ("Project Register", "Unit Product Catalogue", …) */
  panelTitled: (heading: string) => `(//main//section[contains(@class,'crm-panel')][.//*[self::h2 or self::h3][normalize-space()=${xl(heading)}]])[last()]`,
  /** Rows of the register table shown on the page (data rows only) */
  // the register is the last table of the page (Reservations shows "Pending My Approval" above it)
  registerRows: `(//main//table)[last()]/tbody/tr[td]`,
  registerHeaders: `(//main//table)[last()]/thead/tr[last()]/th`,
  /** Pager text "Showing 1–20 of 135 units · Page 1 of 7" */
  pagerText: `//main//*[contains(@class,'crm-pagination')]//*[starts-with(normalize-space(),'Showing')] | //main//*[contains(@class,'crm-pagination')][starts-with(normalize-space(),'Showing')]`,
  pagerNext: `//main//*[contains(@class,'crm-pagination')]//button[normalize-space()='Next']`,
  searchBox: (placeholder: string) => `//main//input[@type='search'][@placeholder=${xl(placeholder)}]`,
  /** Unit Register status filter (first select of the register) */
  statusFilter: `(//main//section[contains(@class,'crm-panel')]//select)[1]`,
  /** The top-most modal form (New Project / Product / Unit / Proposal / Contract, payment plan) */
  topModal: `(//*[contains(concat(' ',normalize-space(@class),' '),' crm-modal ')][not(contains(@class,'crm-unit-picker-dialog'))][not(contains(@class,'crm-notice-dialog'))])[last()]`,
  modalField: (name: string) => `(//*[contains(concat(' ',normalize-space(@class),' '),' crm-modal ')][not(contains(@class,'crm-unit-picker-dialog'))][not(contains(@class,'crm-notice-dialog'))])[last()]//*[@name=${xl(name)}]`,
  modalButton: (name: string) => `(//*[contains(concat(' ',normalize-space(@class),' '),' crm-modal ')][not(contains(@class,'crm-unit-picker-dialog'))][not(contains(@class,'crm-notice-dialog'))])[last()]//button[normalize-space()=${xl(name)}]`,
  /** Leads → Insights: sub-tabs (Sources / Aging / Follow-up), the By source table, the drill-down list and its heading */
  leadsSubTab: (name: string) => `//main//a[contains(@class,'crm-leads-subtab')][normalize-space()=${xl(name)}]`,
  insightsSourceRows: `(//main//table)[1]/tbody/tr[td]`,
  insightsSourceHeaders: `(//main//table)[1]/thead/tr[last()]/th`,
  insightsDrillRows: `(//main//table)[2]/tbody/tr[td]`,
  insightsDrillHeaders: `(//main//table)[2]/thead/tr[last()]/th`,
  insightsDrillCount: (word: string) => `//main//*[self::h2 or self::h3 or self::h4 or self::span or self::strong][contains(normalize-space(),${xl(word)})]`,
  /** Toast message (Inventory forms): <div.crm-app-toast crm-error-banner role=alert><div.crm-app-toast-body><strong>Title</strong>… */
  toast: `//*[contains(concat(' ',normalize-space(@class),' '),' crm-app-toast ')]`,
  /** Record detail panels: Opportunity / Reservation / Proposal / Contract Detail */
  detailPanel: `(//section[contains(@class,'detail-modal')])[last()]`,
  recordPanelButton: (name: string) => `(//section[contains(@class,'detail-modal')])[last()]//button[normalize-space()=${xl(name)}]`,
  /** A form field of the record panel by its label (label.crm-field > span.crm-label) */
  recordField: (label: string) => `(//section[contains(@class,'detail-modal')])[last()]//label[contains(@class,'crm-field')][span[contains(@class,'crm-label')][starts-with(normalize-space(),${xl(label)})]]`,
  /** Unit picker opened by "Choose Unit" */
  unitPicker: `//*[contains(@class,'crm-unit-picker-dialog')]`,
  unitPickerSearch: `//*[contains(@class,'crm-unit-picker-dialog')]//input[starts-with(@placeholder,'Search unit')]`,
  unitPickerRow: (code: string) => `//*[contains(@class,'crm-unit-picker-dialog')]//tbody/tr[.//*[normalize-space()=${xl(code)}]]`,
  /** Customer → Edit Customer → Documents & KYC block */
  kycBlock: `//*[contains(concat(' ',normalize-space(@class),' '),' crm-modal ')]//h4[normalize-space()='Documents & KYC']/ancestor::*[.//button[normalize-space()='Upload']][1]`,
  kycStatus: `//*[contains(concat(' ',normalize-space(@class),' '),' crm-modal ')]//span[contains(@class,'crm-kyc-status')]`,
  /** Rows of the first table after a heading, e.g. Reservations → "Pending My Approval (23)" */
  tableRowsAfter: (heading: string) => `//main//*[self::h2 or self::h3 or self::h4][starts-with(normalize-space(),${xl(heading)})]/following::table[1]/tbody/tr[td]`,
  /** A select of the page by its aria-label (Board: Owner / Project / Closed deals; Inventory Holds: Whose holds / Show) */
  selectByLabel: (label: string) => `//main//select[@aria-label=${xl(label)}]`,
  /** Opportunities → Board: one column per stage (header: name, count, value, weighted); one "Move <OPP> to" select per card */
  boardColumns: `//main//section[contains(concat(' ',normalize-space(@class),' '),' crm-board-column ')]`,
  boardColumnCount: `.//span[contains(@class,'crm-board-count')]`,
  boardColumnValue: `.//span[contains(@class,'crm-board-column-value')]`,
  boardCards: `.//select[starts-with(@aria-label,'Move ')]/ancestor::*[count(.//select[starts-with(@aria-label,'Move ')])=1][last()]`,
  boardMoveSelect: `.//select[starts-with(@aria-label,'Move ')]`,
  boardSummary: `//main//span[contains(@class,'crm-board-summary')]`,
  /** Sort button of a register column header (th.crm-sortable-th[aria-sort] > button.crm-sortable-th-button) */
  sortHeader: (column: string) => `(//main//table)[last()]/thead/tr[last()]/th[contains(@class,'crm-sortable-th')][.//span[normalize-space()=${xl(column)}]]`,
  pagerPrevious: `//main//*[contains(@class,'crm-pagination')]//button[normalize-space()='Previous']`,
  /** Formula line under a KPI card, e.g. Total → "Draft/Issued (5) + Signed (5) + Canc. (13)" */
  cardFormula: (card: string) => `//main//article[contains(@class,'crm-card')][h3[normalize-space()=${xl(card)}]]/p[contains(@class,'crm-card-formula')]`,
  /** Floor Plans & Media panel of Product Details / unit view (virtual tour link, file upload, files list) */
  mediaPanel: `(//*[contains(concat(' ',normalize-space(@class),' '),' crm-modal ')]//section[contains(@class,'crm-media-panel')])[last()]`,
  /** Inventory → Unit view: section buttons "Identification VIEW", "Linked Modules OPEN" … */
  unitSection: (name: string) => `(//*[contains(@class,'crm-unit-detail-modal')])[last()]//button[starts-with(normalize-space(),${xl(name)})]`,
  unitView: `(//*[contains(@class,'crm-unit-detail-modal')])[last()]`,
  /** Inventory → Availability Summary: view buttons (⊞ Summary Table / 🏢 Stack Plan) of the page, not of a block row */
  availabilityView: (name: string) => `(//main//button[contains(@class,'crm-dashboard-view-segment-button')][contains(normalize-space(),${xl(name)})])[1]`,
  /** Report module page parts (checked on Sales Reports, build v1.0 1610-47) */
  reportIntro: `//main//div[contains(@class,'crm-dashboard-title-row')]/following-sibling::p[contains(@class,'crm-muted-text')][1]`,
  /** Filter bar: <label.crm-field><span.crm-label>Project</span><select>…</select></label> */
  reportFilterLabels: `//main//label[contains(@class,'crm-field')][.//select]/span[contains(@class,'crm-label')]`,
  reportFilterByLabel: (label: string) => `//main//label[contains(@class,'crm-field')][span[contains(@class,'crm-label')][normalize-space()=${xl(label)}]]//select`,
  reportKpiTitles: `//main//article[contains(@class,'crm-card')]/h3`,
  /** KPI caption under the value: <article.crm-card><h3/><div.crm-kpi/><p>Value × probability</p> */
  reportKpiCaption: (label: string) => `//main//article[contains(@class,'crm-card')][h3[normalize-space()=${xl(label)}]]/p`,
  reportPanelHeadings: `//main//section[contains(@class,'crm-panel')]/div[contains(@class,'crm-panel-header')]/h3`,
  reportPanelNote: (heading: string) => `${XP.reportPanel(heading)}/p[contains(@class,'crm-report-note')]`,
  /** Bold Total row: <tfoot><tr.crm-report-total-row> (not part of tbody, so column sums exclude it) */
  reportTotalRow: (heading: string) => `${XP.reportTable(heading)}/tfoot/tr`,
  /** Empty-list message inside one report panel (Sales Reports suite) */
  reportPanelEmpty: (heading: string) => `${XP.reportPanel(heading)}//*[normalize-space()='Nothing matches these filters.']`,
  /** Record links in the first column of a report table (Sales Reports suite) */
  reportFirstColumnLinks: (heading: string) => `${XP.reportTableRows(heading)}/td[1]/a`,
  /** Opportunity Detail modal opened from an OPP reference link (/opportunities?selected=<id>) */
  opportunityDetail: `//section[@role='dialog'][.//h3[normalize-space()='Opportunity Detail']]`,
  opportunityWorkflowSteps: `//section[@role='dialog'][.//h3[normalize-space()='Opportunity Detail']]//button[contains(@class,'crm-workflow-step')]/strong`,
};

// ── CSS equivalents (for tools that prefer CSS) ─────────────────────────────
export const CSS = {
  hubKpi: 'div.crm-module-hub-kpi', // + filter by span text, value = strong
  execKpi: 'div.crm-exec-kpi-copy', // + filter by span text, value = strong
  leadsKpiCard: 'button.crm-metric-card-button', // + h3 label, value = div.crm-kpi
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
  moduleTab: 'main .crm-tab-button', // button (modules) or a (Leads)
  reportTableTotal: 'table.crm-report-table > tfoot > tr',
  customerRecordForm: 'form.crm-management-modal',
  leadForm: 'section.crm-lead-modal',
  leadFormField: 'section.crm-lead-modal [name="<field name>"]',
  leadFormSubmit: 'section.crm-lead-modal button[type="submit"]',
  notice: '.crm-notice-dialog', // + .crm-notice-dialog-success / -error
  datePopover: '.crm-date-field-popover',
  leadDetailPanel: 'section.crm-lead-detail-modal',
  userMenu: 'button.crm-user-menu-button',
};

// ── Playwright helpers ──────────────────────────────────────────────────────
export const at = (page: Page, xpath: string): Locator => page.locator(`xpath=${xpath}`);

/** Value element of ANY KPI card on any page (hub snapshot, exec/leads cards, report modules, report tiles). */
export const kpiLocator = (page: Page, label: string): Locator =>
  page.locator(`xpath=${XP.hubKpi(label)} | ${XP.execKpi(label)} | ${XP.metricKpi(label)} | ${XP.reportKpi(label)} | ${XP.reportTile(label)}`).first();

/**
 * Report sub-reports (build 3110-10): each module shows one sub-report at a time, chosen by the pills
 * "Reports in …: CUS-01 CUS-02 …" (`?report=<key>`, Lead Reports `?tab=<key>`). Module route → sub-report
 * query → the table headings it shows. The KPI tiles are the same on every sub-report of a module.
 */
export const SUBREPORTS: Record<string, Record<string, string[]>> = {
  '/reports/governance': {
    'report=executiveDashboard01': ['Report #01 — Executive Dashboard (Master KPI vs Target & Variance)'],
    'report=controlAssumptions03': ['Report #03 — Control & Assumptions (Portfolio Baseline Parameters)'],
    'report=leadBantRegister05_06': ['Report #05 & #06 — Lead Intake & BANT Qualification (SQL) Register'],
    'report=dataDictionary23': ['Report #23 — Data Dictionary, Formula Definitions & Internal Controls'],
  },
  '/reports/leads': {
    'tab=overview': ['Lead Funnel'],
    'tab=source': ['Performance by Lead Source'],
    'tab=aging': ['Open Leads by Salesperson', 'Open Leads by Status', 'Longest Idle Leads'],
    'tab=qualification': ['Conversion by Lead Rating', 'Conversion by Lead Score'],
    'tab=scorecard': ['Salesperson Scorecard'],
  },
  '/reports/sales': {
    'report=salesFunnel16': ['Report #16 — Sales Funnel & Stage Conversion Velocity'],
    'report=smartForecast19': ['Report #19 — Smart Sales Forecast (Monthly Pipeline Absorption)'],
    'report=openList': ['Report #07 — Opportunities & Pipeline Register'],
    'report=byOwner': ['Salesperson Pipeline'],
  },
  '/reports/inventory': {
    'report=propertyTypeSummary21': ['Report #21 — Summary by Property Type (Portfolio Absorption)'],
    'report=revenueManagement18': ['Report #18 — Revenue Management & Dynamic Pricing Engine'],
    'report=unitInventoryMaster04': ['Report #04 — 133 Unit Inventory Master & Pricing Matrix'],
  },
  '/reports/customers': {
    'report=byType': ['Customers by Type'],
    'report=byNationality': ['Customers by Nationality'],
    'report=byResidence': ['Customers by Country of Residence'],
    'report=newList': ['New Customers in Period'],
  },
  '/reports/brokers': {
    'report=commissionLedger14': ['Report #14 — Broker Commission Ledger (Formula Mode)'],
    'report=byBroker': ['Report #17 — Partner Broker Scorecard & Quota Achievement'],
    'report=dealsList': ['Broker SPAs in Period'],
  },
  '/reports/marketing': {
    'report=byCampaign': ['Report #15 — Marketing Channel & Campaign ROAS'],
    'report=channelAndBrokerSummary22': ['Report #22 — Summary by Channel & Broker (Unified Acquisition Matrix)'],
  },
  '/reports/reservations': {
    'report=activeList': ['Report #08 — Reservations & Token Deposits Register'],
    'report=byMonth': ['Reservations by Month'],
    'report=byOwner': ['Reservations by Salesperson'],
  },
  '/reports/spa': {
    'report=spaRegister09': ['Report #09 — Executed SPA & Contract Register'],
    'report=attentionList': ['SPAs Needing Action'],
    'report=byMonth': ['SPAs Signed by Month'],
    'report=byOwner': ['SPAs by Salesperson'],
  },
  '/reports/collections': {
    'report=buyerPaymentLedger10': ['Report #10 — Buyer Payment & Instalment Ledger'],
    'report=aging': ['Outstanding by Age'],
  },
  '/reports/exceptions': {
    'report=portfolioGovernanceTriggers02': ['Report #02 — Exception Summary & Portfolio Governance Triggers'],
    'report=summary': ['Operational Exception Checklist', 'Overdue instalments', 'Signed SPAs not handed off to ERP after 3 days', 'Leads not contacted after 2 days'],
  },
};

/** Table headings of the old single-page modules → the heading of the same table in build 3110-10. */
export const RENAMED_TABLES: Record<string, string> = {
  'Broker Performance': 'Report #17 — Partner Broker Scorecard & Quota Achievement',
  'Open Opportunities': 'Report #07 — Opportunities & Pipeline Register',
  'Exception Summary': 'Operational Exception Checklist',
};
export const tableHeading = (heading: string) => RENAMED_TABLES[heading] ?? heading;
/** Columns renamed in build 3110-10, per (new) table heading: old column name → new column name. */
export const RENAMED_COLUMNS: Record<string, Record<string, string>> = {
  'Report #17 — Partner Broker Scorecard & Quota Achievement': { SPAs: 'Units Sold (SPA)' },
  'Report #07 — Opportunities & Pipeline Register': { 'Value (USD)': 'Deal Value (USD)', 'Probability %': 'Probability %' },
};
export const columnName = (heading: string, column: string) => RENAMED_COLUMNS[tableHeading(heading)]?.[column] ?? column;

/** Sub-report query (e.g. "report=byResidence") that shows a table on a module route, if any. */
export function subReportOf(path: string, heading: string): string | undefined {
  return Object.entries(SUBREPORTS[path] ?? {}).find(([, tables]) => tables.includes(tableHeading(heading)))?.[0];
}

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

// ── Opportunities (/opportunities) and lead conversion — captured from build v1.0 1910-49 on 2026-10-20 ──
/** KPI cards at the top of /opportunities (article.crm-card > h3 + div.crm-kpi + p.crm-card-formula). */
export const OPPORTUNITY_KPIS = ['Total', 'Open', 'Pipeline Value', 'Avg Probability'];
/** List view columns, in order. */
export const OPPORTUNITY_COLUMNS = ['Opportunity', 'Customer', 'Stage', 'Probability', 'Budget', 'Project', 'Created Date'];
/** Board columns, in order: the open stages, then the closed ones. */
export const OPPORTUNITY_OPEN_STAGES = ['Qualified', 'Site Visit', 'Negotiation', 'Reservation Ready', 'Proposal'];
export const OPPORTUNITY_BOARD_COLUMNS = [...OPPORTUNITY_OPEN_STAGES, 'Won', 'Lost'];

/** Lead Detail uses the same modal classes as Opportunity Detail, so the modals are told apart by their <h3> title. */
const OPP_DETAIL = `//section[@role='dialog'][.//h3[normalize-space()='Opportunity Detail']]`;
const LEAD_DETAIL = `//section[@role='dialog'][.//h3[normalize-space()='Lead Detail']]`;

/** CSS / XPath for the Opportunities page, the Opportunity Detail modal and the lead "Move to Opportunity" flow. */
export const OPP = {
  // list
  kpiFormula: (label: string) => `//main//article[contains(@class,'crm-card')][h3[normalize-space()=${xl(label)}]]/p[contains(@class,'crm-card-formula')]`,
  search: 'main input.crm-search-input[placeholder^="Search opportunity"]',
  searchClear: 'main button.crm-search-clear',
  exportButton: 'main button.crm-export-button',
  viewToggle: (name: 'List' | 'Board') => `//main//div[contains(@class,'crm-view-toggle')]/button[normalize-space()=${xl(name)}]`,
  table: 'main table.crm-table',
  headerCells: 'main table.crm-table thead th',
  sortHeader: (column: string) => `//main//table[contains(@class,'crm-table')]//th[.//span[normalize-space()=${xl(column)}]]`,
  rows: 'main table.crm-table tbody tr',
  rowLink: 'a.crm-record-link',
  /** <tbody><tr><td class="crm-empty…">No opportunities found.</td></tr> */
  empty: `//main//table[contains(@class,'crm-table')]/tbody//td[normalize-space()='No opportunities found.']`,
  pager: 'main .crm-pagination > span',
  pagerButton: (name: 'Previous' | 'Next') => `//main//div[contains(@class,'crm-pagination')]//button[normalize-space()=${xl(name)}]`,
  // board
  boardFilter: (aria: 'Owner' | 'Project' | 'Closed deals') => `main .crm-board-toolbar select[aria-label="${aria}"]`,
  boardSummary: 'main .crm-board-summary',
  boardColumns: 'main section.crm-board-column',
  boardColumn: (stage: string) => `main section.crm-board-column[aria-label="${stage}"]`,
  boardColumnCount: '.crm-board-count',
  boardColumnValue: '.crm-board-column-value',
  /** Won / Lost columns start collapsed: <header>…Closed last 30 days <button>Show</button></header> */
  boardColumnShow: `xpath=.//header//button[normalize-space()='Show']`,
  /** "Weighted 0.47M USD" on open stages, "Closed last 30 days" on Won / Lost */
  boardColumnWeighted: '.crm-board-column-weighted',
  /** Won / Lost header button: "Show" when the column is collapsed (section.is-collapsed), "Hide" when open */
  boardColumnToggle: 'header.crm-board-column-header button',
  boardHint: 'main p.crm-board-hint',
  /** Tags: "35%", "2d in stage" (span.is-stale when old), "Reserved" (span.is-reserved) */
  boardTag: '.crm-board-tag',
  /** "Mark as Lost" dialog (from the card menu or by dropping a card on Lost): Lost Reason, Remarks, Cancel / Continue */
  boardLostDialog: `//*[@role='dialog'][.//*[normalize-space()='Mark as Lost']][.//select]`,
  /** "Can't move to Negotiation — <what to do first>" [Close] [Open opportunity] */
  boardCantMoveDialog: `//*[@role='alertdialog' or @role='dialog'][.//*[starts-with(normalize-space(),"Can't move to")]]`,
  boardCard: 'article.crm-board-card',
  boardCardFor: (oppNo: string) => `main article.crm-board-card[aria-label^="${oppNo} "]`,
  boardMoveSelect: 'select.crm-board-move-select',
  // detail modal
  detail: OPP_DETAIL,
  detailSubtitle: `${OPP_DETAIL}//div[contains(@class,'crm-panel-header')]//p`,
  detailClose: `${OPP_DETAIL}//button[normalize-space()='Close']`,
  detailCopyLink: `${OPP_DETAIL}//button[normalize-space()='Copy link']`,
  detailLoading: `${OPP_DETAIL}//*[normalize-space()='Loading opportunity details...']`,
  detailTitle: `${OPP_DETAIL}//div[contains(@class,'crm-detail-title')]/div/strong`,
  /** Header facts: <li><span.crm-detail-fact-label>Budget</span><span.crm-detail-fact-value>0.45M USD</span></li> (labels upper-cased by CSS) */
  detailFact: (label: string) => `${OPP_DETAIL}//ul[contains(@class,'crm-detail-facts')]/li[span[contains(@class,'crm-detail-fact-label')][normalize-space()=${xl(label)}]]/span[contains(@class,'crm-detail-fact-value')]`,
  detailStatus: `${OPP_DETAIL}//div[contains(@class,'crm-detail-title')]/span[contains(@class,'crm-status-pill')]`,
  /** <button.crm-workflow-step.is-completed|is-current|is-next><strong>Qualified</strong><span>Done</span></button> */
  workflowStep: `${OPP_DETAIL}//button[contains(@class,'crm-workflow-step')]`,
  /** Activity sections at the bottom: Notes, Site Visits, Agreed Pack */
  detailSection: (heading: string) => `${OPP_DETAIL}//section[contains(@class,'crm-activity-list')][h4[normalize-space()=${xl(heading)}]]`,
  formHeadings: `${OPP_DETAIL}//form//h4`,
  visitForm: `${OPP_DETAIL}//form[.//h4[contains(normalize-space(),'Schedule Visit') or contains(normalize-space(),'Schedule Another Visit')]]`,
  visitType: 'select[name="visitType"]',
  visitDateTrigger: 'button.crm-date-field-trigger',
  remarks: 'textarea[name="remarks"]',
  fieldError: '.crm-field-error',
  lostForm: `${OPP_DETAIL}//form[contains(@class,'crm-opportunity-lost-card')]`,
  lostReason: 'select[name="lostReasonRefId"]',
  noteForm: `${OPP_DETAIL}//form[.//h4[normalize-space()='Add Note']]`,
  /** Site Visit stage: <form><h4>1. Complete Site Visit</h4><select name="visitId"/><textarea name="outcomeNotes"/></form> */
  completeVisitForm: `${OPP_DETAIL}//form[.//h4[normalize-space()='1. Complete Site Visit']]`,
  /** Negotiation stage: notes box (placeholder "Negotiation notes…") + "Continue to Reservation Ready" */
  negotiationNotes: `${OPP_DETAIL}//textarea[@placeholder='Negotiation notes…']`,
  noteText: 'textarea[name="noteText"]',
  // date picker (opens from the Visit Date button)
  calendarNext: 'button.crm-calendar-nav-button[aria-label="Next month"]',
  calendarDay: 'button.crm-calendar-day:not(.is-outside)',
  calendarTime: '.crm-date-field-time input[type="time"]',
  calendarSet: 'button.crm-date-field-set-button',
  /** Notices: <section role="alertdialog" class="crm-notice-dialog"><h3 id="crm-notice-title"/><div.crm-notice-body/><div.crm-notice-actions><button/>… */
  notice: 'section.crm-notice-dialog[role="alertdialog"]',
  // leads side
  leadsSearch: 'main input.crm-search-input[placeholder^="Search name"]',
  leadsStatusChip: 'span.crm-leads-status-chip',
  leadsPager: 'main .crm-pagination > span',
  leadDetail: LEAD_DETAIL,
  leadDetailStatus: `${LEAD_DETAIL}//div[contains(@class,'crm-detail-title')]//span[contains(@class,'crm-status-pill')]`,
  leadDetailFact: (label: string) => `${LEAD_DETAIL}//ul[contains(@class,'crm-detail-facts')]/li[span[contains(@class,'crm-detail-fact-label')][normalize-space()=${xl(label)}]]/span[contains(@class,'crm-detail-fact-value')]`,
} as const;

// ── Unit Reservations (/reservations) — captured from build v1.0 1910-49 on 2026-10-21 ──
/** Status cards at the top (buttons that filter the register) and the Amount card (article). */
export const RESERVATION_CARDS = ['All Reservations', 'Active', 'Converted', 'Cancelled'];
export const RESERVATION_COLUMNS = ['Reservation', 'Customer', 'Unit', 'Status', 'Date', 'Amount', 'Created Date'];

/** Modals are told apart by their <h3> title (they share CSS classes with the opportunity / lead modals). */
const RSV_DETAIL = `//section[@role='dialog'][.//h3[normalize-space()='Reservation Detail']]`;
const RSV_CREATE = `//section[@role='dialog'][.//h3[normalize-space()='Create Reservation']]`;
const RSV_REPLACE = `//section[@role='dialog'][.//h3[normalize-space()='Replace Reservation']]`;

export const RSV = {
  newButton: `//main//section[contains(@class,'crm-module-header')]//button[normalize-space()='New Reservation']`,
  /** <button.crm-card.crm-metric-card-button aria-pressed><h3>Active</h3><div.crm-kpi>29</div><p>note</p></button> */
  card: (label: string) => `//main//button[contains(@class,'crm-metric-card-button')][h3[normalize-space()=${xl(label)}]]`,
  amountCard: `//main//article[contains(@class,'crm-card')][h3[normalize-space()='Amount']]/div[contains(@class,'crm-kpi')]`,
  /** "Pending My Approval (1)" panel (only when something waits for this user) */
  pendingPanel: `//main//section[contains(@class,'crm-panel')][.//h3[starts-with(normalize-space(),'Pending My Approval')]]`,
  register: `//main//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Reservation Register']]`,
  search: 'main input.crm-search-input[placeholder^="Search reservation"]',
  searchClear: 'main button.crm-search-clear',
  exportButton: 'main button.crm-export-button',
  table: `//main//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Reservation Register']]//table`,
  sortHeader: (column: string) => `//main//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Reservation Register']]//th[.//span[normalize-space()=${xl(column)}]]`,
  pager: `//main//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Reservation Register']]//div[contains(@class,'crm-pagination')]/span`,
  pagerButton: (name: 'Previous' | 'Next') => `//main//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Reservation Register']]//div[contains(@class,'crm-pagination')]//button[normalize-space()=${xl(name)}]`,
  // detail
  detail: RSV_DETAIL,
  detailLoaded: `${RSV_DETAIL}//ol[contains(@class,'crm-audit-timeline')]`,
  detailTitle: `${RSV_DETAIL}//div[contains(@class,'crm-detail-title')]/div/strong`,
  detailCustomer: `${RSV_DETAIL}//div[contains(@class,'crm-detail-title')]/div/span`,
  detailFact: (label: string) => `${RSV_DETAIL}//ul[contains(@class,'crm-detail-facts')]/li[span[contains(@class,'crm-detail-fact-label')][normalize-space()=${xl(label)}]]/span[contains(@class,'crm-detail-fact-value')]`,
  detailStatus: `${RSV_DETAIL}//div[contains(@class,'crm-detail-title')]//span[contains(@class,'crm-status-pill')]`,
  workflowStep: `${RSV_DETAIL}//button[contains(@class,'crm-workflow-step')]`,
  quickNotes: `${RSV_DETAIL}//label[contains(@class,'crm-continue-panel-notes')]//textarea`,
  actions: `${RSV_DETAIL}//div[contains(@class,'crm-continue-panel-actions')]//button`,
  remarks: `${RSV_DETAIL}//section[contains(@class,'crm-activity-list')][h4[normalize-space()='Remarks']]`,
  documents: `${RSV_DETAIL}//section[@aria-label='Documents']`,
  history: `${RSV_DETAIL}//section[@aria-label='Change history']`,
  historyEntries: `${RSV_DETAIL}//ol[contains(@class,'crm-audit-timeline')]/li`,
  // create / replace forms (same fields)
  createForm: RSV_CREATE,
  replaceForm: RSV_REPLACE,
  formOpportunity: 'select[name="opportunityId"]',
  formUnitId: 'input[type="hidden"][name="unitId"]',
  formUnitText: 'input[placeholder="Select an available unit"]',
  formChooseUnit: `xpath=.//button[normalize-space()='Choose Unit']`,
  formAmount: 'input[name="reservationAmount"]',
  formCurrency: 'input[name="currencyCode"]',
  /** Expiry is a date-field button; its yyyy-mm-dd value sits in the hidden input before it */
  formExpiry: '.crm-date-field input[type="hidden"]',
  formExpiryShown: '.crm-date-field button.crm-date-field-trigger',
  formRemarks: 'textarea[name="remarks"]',
  formSubmit: 'button[type="submit"]',
  // unit picker
  unitPicker: 'section.crm-unit-picker-dialog',
  unitPickerRows: 'section.crm-unit-picker-dialog tbody tr',
  unitPickerAvailable: '.crm-unit-available-badge',
  unitPickerHideOnHold: 'section.crm-unit-picker-dialog label.crm-unit-picker-filter input[type="checkbox"]',
  unitPickerProject: `//section[contains(@class,'crm-unit-picker-dialog')]//label[span[normalize-space()='Project']]//select`,
} as const;

// ── Customers & Brokers (/customers) — captured from build v1.0 1910-49 on 2026-10-23 ──
export const CB_CARDS = ['Customers', 'Brokers', 'Active Customers', 'Active Brokers'];
export const CUSTOMER_COLUMNS = ['Customer', 'Contact', 'Buyer Type', 'Project', 'Status', 'Created Date'];
export const BROKER_COLUMNS = ['Broker', 'Contact', 'City', 'Plan', 'Status', 'Created Date'];
const CUST_EDIT = `//*[@role='dialog'][.//h3[normalize-space()='Edit Customer']]`;

export const CB = {
  /** <section.crm-tabs aria-label="Customer workspace tabs"><button.crm-tab-button.is-active>Customers</button>… */
  tab: (name: 'Customers' | 'Brokers') => `//main//section[contains(@class,'crm-tabs')]//button[normalize-space()=${xl(name)}]`,
  /** The register shown: <section.crm-panel><h3>Customer Register | Broker Register</h3>… */
  register: (title: 'Customer Register' | 'Broker Register') => `//main//section[contains(@class,'crm-panel')][.//h3[normalize-space()=${xl(title)}]]`,
  customerSearch: 'main input.crm-search-input[placeholder="Search customer, phone, email"]',
  brokerSearch: 'main input.crm-search-input[placeholder="Search broker, phone, email"]',
  searchClear: 'main button.crm-search-clear',
  exportButton: 'main button.crm-export-button',
  newCustomer: `//main//button[normalize-space()='New Customer']`,
  newBroker: `//main//button[normalize-space()='New Broker']`,
  // customer detail ("Edit Customer" modal)
  customerDialog: CUST_EDIT,
  customerField: (name: string) => `${CUST_EDIT}//*[@name=${xl(name)}]`,
  customerUpdate: `${CUST_EDIT}//button[normalize-space()='Update Customer']`,
  customerClose: `${CUST_EDIT}//button[normalize-space()='Close']`,
  customerSection: (heading: string) => `${CUST_EDIT}//section[.//*[self::h3 or self::h4][normalize-space()=${xl(heading)}]][not(.//section[.//*[self::h3 or self::h4][normalize-space()=${xl(heading)}]])]`,
  kycBadge: `${CUST_EDIT}//*[starts-with(normalize-space(),'KYC:')]`,
  // broker form (create and edit share it): <form data-broker-form role="dialog"><h3>Create Broker | Edit Broker</h3>
  brokerForm: 'form[data-broker-form]',
  brokerField: (name: string) => `form[data-broker-form] [name="${name}"]`,
  /** Shown after a broker is created: "Broker Portal Credentials" with username, masked password, Show, Copy Credentials, Done */
  credentialsDialog: `//*[@role='dialog' or @role='alertdialog'][.//*[normalize-space()='Broker Portal Credentials']]`,
} as const;

// ── Brokers & Channels (/brokers-channels, "Channel Management" hub) — captured from build v1.0 1910-49 on 2026-10-23 ──
export const BC_SIGNALS = ['Active Brokers', 'Total Brokers', 'Lead Sources (this month)', 'Capture Channels (this month)'];
/** Module menu: name, status and description as shown, and where the card links (null = planned, not a link). */
export const BC_MODULES: { name: string; status: 'Live' | 'Partial' | 'Planned'; description: string; href: string | null }[] = [
  { name: 'Broker Register', status: 'Live', description: 'Master broker database and commission plans.', href: '/customers?tab=brokers' },
  { name: 'Broker Portal', status: 'Planned', description: 'External broker self-service access.', href: null },
  { name: 'Broker Leads', status: 'Partial', description: 'Leads attributed to broker channels.', href: '/leads' },
  { name: 'Broker Attribution', status: 'Partial', description: 'Source attribution and conflict resolution.', href: '/leads' },
  { name: 'Broker Performance', status: 'Planned', description: 'Sales performance by broker.', href: null },
  { name: 'Broker Reservations', status: 'Partial', description: 'Reservations linked to brokers.', href: '/reservations' },
  { name: 'Broker SPAs', status: 'Partial', description: 'Contracted sales by broker.', href: '/spa-contracts' },
  { name: 'Broker Commission Status', status: 'Partial', description: 'Commission plan and payout tracking.', href: '/customers?tab=brokers' },
  { name: 'Channel Performance', status: 'Live', description: 'Lead source and capture channel comparison.', href: '/' },
  { name: 'Broker Documents', status: 'Planned', description: 'Agreements, licences, and compliance files.', href: null },
];

export const BCH = {
  /** "2 live · 5 partial · 3 planned": <div.crm-module-hub-summary><span.crm-module-hub-status.is-live>2 live</span>… */
  summary: 'main .crm-module-hub-summary .crm-module-hub-status',
  intro: 'main .crm-module-header p.crm-muted-text',
  signalsPanel: `//main//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Live broker & channel signals']]`,
  openBrokerRegister: `//main//a[normalize-space()='Open Broker Register']`,
  /** <div.crm-module-hub-kpi><span>Active Brokers</span><strong>16</strong></div> (also matched by kpiLocator) */
  signal: (label: string) => `//main//div[contains(@class,'crm-module-hub-kpi')][span[normalize-space()=${xl(label)}]]/strong`,
  /** <div.crm-module-hub-mini-list><strong>Top capture channels</strong><ul><li><span>Not specified</span><span>310 leads</span></li> */
  miniList: (title: string) => `//main//div[contains(@class,'crm-module-hub-mini-list')][strong[normalize-space()=${xl(title)}]]/ul/li`,
  /** Module card: <a.crm-module-hub-card.is-link href> (available) or <article.crm-module-hub-card> (planned) */
  moduleCards: 'main .crm-module-hub-grid .crm-module-hub-card',
  /** the card itself (exact class token, so its inner "crm-module-hub-card-head" does not match) */
  moduleCard: (name: string) => `//main//*[contains(concat(' ',normalize-space(@class),' '),' crm-module-hub-card ')][.//strong[normalize-space()=${xl(name)}]]`,
} as const;

// ── Construction Updates (/construction-updates), build v1.0 1910-49 ─────────
// Left: the Updates list (search, status and project filters, table). Right: the detail panel, which is an
// empty state, the "New draft" form, or the "Edit update" form with its Photo gallery.
export const CUP = {
  eyebrow: 'main .crm-module-header .crm-eyebrow',
  intro: 'main .crm-module-header p.crm-muted-text',
  /** "Hide tips" / "Show tips" and "New Update" in the page header */
  headerButton: (name: string) => `//main//section[contains(@class,'crm-module-header')]//button[normalize-space()=${xl(name)}]`,
  help: 'main section.crm-help-panel',
  helpSteps: 'main section.crm-help-panel ol > li',
  helpTip: 'main section.crm-help-panel aside p',
  /** "Updates (4)" — the heading of the list panel */
  listCount: `//main//section[contains(@class,'crm-panel')]//h3[starts-with(normalize-space(),'Updates (')]`,
  search: 'main input[placeholder="Search title or project"]',
  clearSearch: 'main button[aria-label="Clear search"]',
  statusFilter: `//main//select[option[normalize-space()='All statuses']]`,
  projectFilter: `//main//select[option[normalize-space()='All projects']]`,
  tableHeaders: 'main section.crm-aftersales-split table.crm-table thead th',
  /** data rows only (an empty list is one row holding td.crm-empty-cell) */
  rows: 'main section.crm-aftersales-split table.crm-table tbody tr:not(:has(td.crm-empty-cell))',
  selectedRow: 'main section.crm-aftersales-split table.crm-table tbody tr.is-selected',
  emptyRow: 'main section.crm-aftersales-split table.crm-table td.crm-empty-cell',
  /** row by its title button: <tr><td><button.crm-link-button>Flooring In process</button></td>… */
  rowTitle: (title: string) => `//main//table[contains(@class,'crm-table')]/tbody/tr/td[1]/button[normalize-space()=${xl(title)}]`,

  detailHeading: 'main section.crm-detail-panel > .crm-panel-header h3',
  detailSubtitle: 'main section.crm-detail-panel > .crm-panel-header p.crm-muted-text',
  emptyStateHeading: 'main section.crm-detail-panel .crm-empty-state h3',
  emptyStateText: 'main section.crm-detail-panel .crm-empty-state p',
  emptyStateNew: 'main section.crm-detail-panel .crm-empty-state button',
  /** Publish / Unpublish sit in the detail panel header */
  publishButton: (name: 'Publish' | 'Unpublish') => `//main//section[contains(@class,'crm-detail-panel')]/div[contains(@class,'crm-panel-header')]//button[normalize-space()=${xl(name)}]`,
  headerActions: 'main section.crm-detail-panel > .crm-panel-header button',
  project: 'main section.crm-detail-panel select[name="projectId"]',
  /** Period label has no name attribute */
  period: 'main section.crm-detail-panel input[placeholder="e.g. August 2026"]',
  title: 'main section.crm-detail-panel input[name="title"]',
  description: 'main section.crm-detail-panel textarea[name="description"]',
  portalVisible: 'main section.crm-detail-panel label.crm-checkbox-row input[type="checkbox"]',
  /** Save Draft (new) / Save Changes (edit) */
  submit: 'main section.crm-detail-panel form button[type="submit"]',
  /** <label.crm-field><span.crm-label>Title</span><input/><small.crm-field-error role=alert>Title is required.</small> */
  fieldError: (label: string) => `//main//section[contains(@class,'crm-detail-panel')]//label[contains(@class,'crm-field')][span[normalize-space()=${xl(label)}]]/small[contains(@class,'crm-field-error')]`,
  fieldErrors: 'main section.crm-detail-panel .crm-field-error',

  gallery: `//main//section[contains(@class,'crm-detail-panel')]//div[contains(@class,'crm-section')][.//h3[normalize-space()='Photo gallery']]`,
  galleryText: `//main//section[contains(@class,'crm-detail-panel')]//div[contains(@class,'crm-section')]//h3[normalize-space()='Photo gallery']/following-sibling::p`,
  caption: 'main section.crm-detail-panel input[placeholder="Optional caption"]',
  addPhoto: 'main section.crm-detail-panel label.crm-file-button',
  fileInput: 'main section.crm-detail-panel label.crm-file-button input[type="file"]',
  photoCards: 'main section.crm-detail-panel figure.crm-photo-card',
  /** photo card by its caption (or its file name when it has no caption) */
  photoCard: (text: string) => `//main//section[contains(@class,'crm-detail-panel')]//figure[contains(@class,'crm-photo-card')][figcaption/span[normalize-space()=${xl(text)}]]`,
  noPhotos: `//main//section[contains(@class,'crm-detail-panel')]//div[contains(@class,'crm-section')]/p[normalize-space()='No photos yet.']`,

  /** success message above the workspace ("Draft saved. …", "Changes saved.", "Photo uploaded.") */
  success: 'main .crm-success-banner',
  /** error message ("Something Went Wrong …", "Publish Failed …"); field errors excluded */
  error: 'main [role="alert"]:not(.crm-field-error)',
} as const;
