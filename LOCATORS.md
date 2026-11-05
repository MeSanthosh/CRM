# Locator reference — qa-crm.asquareab.com

Captured from the live app (build v1.0 0510-44) on 2026-10-08; re-checked on 2026-10-09 (no UI changes; coverage extended). Every locator below was verified to match exactly one element (table-row locators match each row).

Use in Playwright: `page.locator("xpath=…")` · Selenium: `By.xpath("…")` · CSS: `By.cssSelector("…")` (CSS using `:text-is()` is Playwright-only; in Selenium use the XPath). In code, import them from `tests/locators.ts`.

## Reports & Analytics hub (`/reports-analytics`)

| Element | XPath | CSS |
|---|---|---|
| KPI: Active Leads | `//div[contains(@class,'crm-module-hub-kpi')][span[normalize-space()='Active Leads']]/strong` | `div.crm-module-hub-kpi:has(> span:text-is("Active Leads")) > strong` |
| KPI: Open Opportunities | `//div[contains(@class,'crm-module-hub-kpi')][span[normalize-space()='Open Opportunities']]/strong` | `div.crm-module-hub-kpi:has(> span:text-is("Open Opportunities")) > strong` |
| KPI: Units Available | `//div[contains(@class,'crm-module-hub-kpi')][span[normalize-space()='Units Available']]/strong` | `div.crm-module-hub-kpi:has(> span:text-is("Units Available")) > strong` |
| KPI: Units Reserved | `//div[contains(@class,'crm-module-hub-kpi')][span[normalize-space()='Units Reserved']]/strong` | `div.crm-module-hub-kpi:has(> span:text-is("Units Reserved")) > strong` |
| KPI: Units Sold | `//div[contains(@class,'crm-module-hub-kpi')][span[normalize-space()='Units Sold']]/strong` | `div.crm-module-hub-kpi:has(> span:text-is("Units Sold")) > strong` |
| KPI: Pipeline Value | `//div[contains(@class,'crm-module-hub-kpi')][span[normalize-space()='Pipeline Value']]/strong` | `div.crm-module-hub-kpi:has(> span:text-is("Pipeline Value")) > strong` |
| KPI: Weighted Pipeline | `//div[contains(@class,'crm-module-hub-kpi')][span[normalize-space()='Weighted Pipeline']]/strong` | `div.crm-module-hub-kpi:has(> span:text-is("Weighted Pipeline")) > strong` |
| KPI: SPA Value Signed (This Month) | `//div[contains(@class,'crm-module-hub-kpi')][span[normalize-space()='SPA Value Signed (This Month)']]/strong` | `div.crm-module-hub-kpi:has(> span:text-is("SPA Value Signed (This Month)")) > strong` |
| Module card: Lead Reports | `//a[contains(@class,'crm-module-hub-card')][@href='/reports/leads']` | `a.crm-module-hub-card[href="/reports/leads"]` |
| Module card: Sales Reports | `//a[contains(@class,'crm-module-hub-card')][@href='/reports/sales']` | `a.crm-module-hub-card[href="/reports/sales"]` |
| Module card: Inventory Reports | `//a[contains(@class,'crm-module-hub-card')][@href='/reports/inventory']` | `a.crm-module-hub-card[href="/reports/inventory"]` |
| Module card: Customer Reports | `//a[contains(@class,'crm-module-hub-card')][@href='/reports/customers']` | `a.crm-module-hub-card[href="/reports/customers"]` |
| Module card: Broker Reports | `//a[contains(@class,'crm-module-hub-card')][@href='/reports/brokers']` | `a.crm-module-hub-card[href="/reports/brokers"]` |
| Module card: Marketing Reports | `//a[contains(@class,'crm-module-hub-card')][@href='/reports/marketing']` | `a.crm-module-hub-card[href="/reports/marketing"]` |
| Module card: Reservation Reports | `//a[contains(@class,'crm-module-hub-card')][@href='/reports/reservations']` | `a.crm-module-hub-card[href="/reports/reservations"]` |
| Module card: SPA Reports | `//a[contains(@class,'crm-module-hub-card')][@href='/reports/spa']` | `a.crm-module-hub-card[href="/reports/spa"]` |
| Module card: Collection Reports | `//a[contains(@class,'crm-module-hub-card')][@href='/reports/collections']` | `a.crm-module-hub-card[href="/reports/collections"]` |
| Module card: Executive Reports | `//a[contains(@class,'crm-module-hub-card')][@href='/']` | `a.crm-module-hub-card[href="/"]` |
| Module card: Exception Reports | `//a[contains(@class,'crm-module-hub-card')][@href='/reports/exceptions']` | `a.crm-module-hub-card[href="/reports/exceptions"]` |
| Module status badge (e.g. Lead Reports) | `//a[contains(@class,'crm-module-hub-card')][@href='/reports/leads']//span[contains(@class,'crm-module-hub-status')]` | `a.crm-module-hub-card[href="/reports/leads"] span.crm-module-hub-status` |
| "11 live" summary | `//span[contains(@class,'crm-module-hub-status') and contains(@class,'is-live')][contains(normalize-space(),'live')]` | `span.crm-module-hub-status.is-live` |
| Open Dashboard button | `//a[contains(@class,'crm-secondary-button')][normalize-space()='Open Dashboard']` |  |
| Module card title (e.g. Sales) | `//a[contains(@class,'crm-module-hub-card')][@href='/reports/sales']//strong` | `a.crm-module-hub-card[href="/reports/sales"] strong` |
| Module card description | `//a[contains(@class,'crm-module-hub-card')][@href='/reports/sales']/p` | `a.crm-module-hub-card[href="/reports/sales"] > p` |
| Module card "Open module →" | `//a[contains(@class,'crm-module-hub-card')][@href='/reports/sales']/small` | `a.crm-module-hub-card[href="/reports/sales"] > small` |

## Leads (`/leads`)

| Element | XPath | CSS |
|---|---|---|
| KPI: Total Leads | `//div[contains(@class,'crm-exec-kpi-copy')][span[normalize-space()='Total Leads']]/strong` |  |
| KPI: Assigned | `//div[contains(@class,'crm-exec-kpi-copy')][span[normalize-space()='Assigned']]/strong` |  |
| KPI: Qualified | `//div[contains(@class,'crm-exec-kpi-copy')][span[normalize-space()='Qualified']]/strong` |  |
| KPI: Disqualified | `//div[contains(@class,'crm-exec-kpi-copy')][span[normalize-space()='Disqualified']]/strong` |  |
| KPI: Avg Score | `//div[contains(@class,'crm-exec-kpi-copy')][span[normalize-space()='Avg Score']]/strong` |  |
| Tab badge: All Leads | `//a[@role='tab'][contains(@class,'crm-leads-tab')][starts-with(normalize-space(),'All Leads')]/span[contains(@class,'crm-leads-tab-count')]` |  |
| Tab badge: My Leads | `//a[@role='tab'][contains(@class,'crm-leads-tab')][starts-with(normalize-space(),'My Leads')]/span[contains(@class,'crm-leads-tab-count')]` |  |
| Tab badge: Unassigned | `//a[@role='tab'][contains(@class,'crm-leads-tab')][starts-with(normalize-space(),'Unassigned')]/span[contains(@class,'crm-leads-tab-count')]` |  |
| Tab badge: To Qualify | `//a[@role='tab'][contains(@class,'crm-leads-tab')][starts-with(normalize-space(),'To Qualify')]/span[contains(@class,'crm-leads-tab-count')]` |  |
| Tab badge: Ready to Convert | `//a[@role='tab'][contains(@class,'crm-leads-tab')][starts-with(normalize-space(),'Ready to Convert')]/span[contains(@class,'crm-leads-tab-count')]` |  |
| Type chip: All | `//button[contains(@class,'crm-leads-type-chip')][normalize-space()='All']` |  |
| Type chip: Individual | `//button[contains(@class,'crm-leads-type-chip')][normalize-space()='Individual']` |  |
| Type chip: Corporate | `//button[contains(@class,'crm-leads-type-chip')][normalize-space()='Corporate']` |  |
| Status filter | `//select[@aria-label='Filter by status']` | `select[aria-label="Filter by status"]` |
| Campaign filter | `//select[@aria-label='Filter by campaign']` | `select[aria-label="Filter by campaign"]` |
| Search box | `//input[@placeholder='Search name, lead no, company, phone, email']` | `input[placeholder="Search name, lead no, company, phone, email"]` |
| Export button | `//button[contains(@class,'crm-export-button')]` | `button.crm-export-button` |
| Leads table | `//table[contains(@class,'crm-leads-inbox-table')]` | `table.crm-leads-inbox-table` |
| Table rows | `//table[contains(@class,'crm-leads-inbox-table')]/tbody/tr` | `table.crm-leads-inbox-table > tbody > tr` |
| Pager text ("Showing 1–20 of 616 leads · Page 1 of 31") | `//div[contains(@class,'crm-pagination')]/span` | `div.crm-pagination > span` |
| Next page | `//div[contains(@class,'crm-pagination')]//button[normalize-space()='Next']` |  |
| Select all leads on this page (build CAITer8U) | `//table[contains(@class,'crm-leads-inbox-table')]//thead//input[@aria-label='Select all leads on this page']` | `input[aria-label="Select all leads on this page"]` |
| Row box of one lead | `//table[contains(@class,'crm-leads-inbox-table')]//tbody//input[@aria-label='Select LD-2026-0038']` | `input[aria-label="Select LD-2026-0038"]` |
| Selection bar ("20 selected · Assign · Change status · Disqualify · Export selected · Clear selection") | `//main//*[contains(concat(' ',normalize-space(@class),' '),' crm-bulk-bar ')]` | `main .crm-bulk-bar` |
| Edit lead (pencil, Act. column) | `//table[contains(@class,'crm-leads-inbox-table')]//tbody//button[@aria-label='Edit LD-2026-0038']` | `button[aria-label="Edit LD-2026-0038"]` |
| Type column (icon; tooltip = Individual / Corporate) | `…/td/span[contains(@class,'crm-leads-prospect-pill')]/@title` | `span.crm-leads-prospect-pill[title]` |
| Leads tab link (Duplicates & Merge, Insights) | `//main//a[contains(@class,'crm-leads-tab')][starts-with(normalize-space(),'Insights')]` | `main a.crm-leads-tab` |
| Create form: Use same as Permanent / Business | `//section[contains(@class,'crm-lead-modal')]//button[normalize-space()='Use same as Permanent']` |  |
| Previous page | `//div[contains(@class,'crm-pagination')]//button[normalize-space()='Previous']` |  |
| KPI card button (v2.0; click filters the list) | `//button[contains(@class,'crm-metric-card-button')][h3[normalize-space()='Assigned']]` | `button.crm-metric-card-button` |
| KPI card value (v2.0) | `//button[contains(@class,'crm-metric-card-button')][h3[normalize-space()='Total Leads']]/div[contains(@class,'crm-kpi')]` | `button.crm-metric-card-button > div.crm-kpi` |
| Page description ("My Leads · Leads assigned to you.") | `//main//p[contains(@class,'crm-leads-exec-subtitle')]` | `p.crm-leads-exec-subtitle` |
| Sortable column header | `//table[contains(@class,'crm-leads-inbox-table')]//th//button[contains(@class,'crm-sortable-th-button')][starts-with(normalize-space(),'Assigned')]` | `button.crm-sortable-th-button` |
| Create Individual / Corporate | `//main//a[@href='/leads/individual/new']` · `//main//a[@href='/leads/corporate/new']` | `a[href="/leads/individual/new"]` |

### Create lead form (`/leads/individual/new`, `/leads/corporate/new`)

| Element | XPath | CSS |
|---|---|---|
| Form (modal) | `//section[contains(@class,'crm-lead-modal')][.//form]` | `section.crm-lead-modal` |
| Heading | `//section[contains(@class,'crm-lead-modal')]//h3[@id='lead-create-title']` |  |
| Section titles | `//section[contains(@class,'crm-lead-modal')]//h4[contains(@class,'crm-form-section-title')]` |  |
| Field by name (names: TestData → Form Fields) | `//section[contains(@class,'crm-lead-modal')]//*[self::input or self::select or self::textarea][@name='firstName']` | `section.crm-lead-modal [name="firstName"]` |
| Labels marked * | `//section[contains(@class,'crm-lead-modal')]//label[contains(@class,'crm-field')]/span[contains(@class,'crm-label-required')]` |  |
| Field by label | `//label[contains(@class,'crm-field')][span[contains(@class,'crm-label')][normalize-space()='Date of Birth']]` |  |
| Create Lead | `//section[contains(@class,'crm-lead-modal')]//button[@type='submit'][normalize-space()='Create Lead']` | `section.crm-lead-modal button[type="submit"]` |
| Close | `//section[contains(@class,'crm-lead-modal')]//button[normalize-space()='Close']` |  |
| Pop-up message | `//*[contains(@class,'crm-notice-dialog')]` (title `//h3`, buttons by text) | `.crm-notice-dialog` |
| Date picker: trigger / pop-over | `.//button[contains(@class,'crm-date-field-trigger')]` · `//*[@role='dialog'][contains(@class,'crm-date-field-popover')]` | `.crm-date-field-popover` |
| Date picker: year, month, day, time, Set | `…//select[@aria-label='Year']`, `…//select[@aria-label='Month']`, `…//button[contains(@class,'crm-calendar-day')][not(contains(@class,'is-outside'))][normalize-space()='20']`, `…//input[@type='time']`, `…//button[normalize-space()='Set']` |  |

### Lead Detail panel

| Element | XPath | CSS |
|---|---|---|
| Panel | `//section[contains(@class,'crm-lead-detail-modal')]` | `section.crm-lead-detail-modal` |
| Action button | `//section[contains(@class,'crm-lead-detail-modal')]//button[normalize-space()='Assign Lead']` (also Disqualify Lead, Move to Opportunity) |  |
| Qualify lead (submit, v2.0) | `//section[contains(@class,'crm-lead-detail-modal')]//button[@type='submit'][normalize-space()='Qualify lead']` |  |
| Identity line "LD-… · Assigned to <owner>" (v2.0) | `//section[contains(@class,'crm-lead-detail-modal')]//div[contains(@class,'crm-lead-identity-copy')]/span` |  |
| Status pill "Status: X · Score N" (v2.0) | `//section[contains(@class,'crm-lead-detail-modal')]//span[contains(@class,'crm-lead-status-pill')]` | `span.crm-lead-status-pill` |
| Summary tile value (v2.0) | `…//div[contains(@class,'crm-lead-summary-tile')][div[contains(@class,'crm-lead-summary-tile-label')][normalize-space()='Phone']]/div[contains(@class,'crm-lead-summary-tile-value')]` | `div.crm-lead-summary-tile` |
| Additional Captured Profile Details (v2.0) | `//section[contains(@class,'crm-lead-detail-modal')]//button[contains(@class,'crm-lead-extra-details-toggle')]` |  |
| Next action cards (v2.0) | `//section[contains(@class,'crm-lead-detail-modal')]//button[contains(normalize-space(),'Open Form')]` |  |
| Score breakdown box | `//section[contains(@class,'crm-lead-detail-modal')]//button[normalize-space()='Recalculate Score']/../..` |  |
| Tasks & Calls block | `(//section[contains(@class,'crm-lead-detail-modal')]//section[contains(@class,'crm-record-activities')][@aria-label='Tasks and calls'])[1]` | `section.crm-record-activities[aria-label="Tasks and calls"]` |
| Log call / Add task / Add meeting | `…//div[contains(@class,'crm-record-activities-buttons')]/button[normalize-space()='Add task']` |  |
| Activity item by subject | `…//li[contains(@class,'crm-record-activity')][.//button[contains(@class,'crm-activity-subject-button')][normalize-space()='Send price list']]` | `li.crm-record-activity` |

### Log call / Task / Meeting form

| Element | XPath | CSS |
|---|---|---|
| Form | `(//*[contains(@class,'crm-activity-dialog')])[last()]` | `.crm-activity-dialog` |
| Date field by input name (`occurredAt`, `dueAt`, `followUpDueAt`) | `(//*[contains(@class,'crm-activity-dialog')])[last()]//input[@name='dueAt']/..` |  |
| Field messages | `(//*[contains(@class,'crm-activity-dialog')])[last()]//*[contains(@class,'crm-field-error')]` | `.crm-field-error` |

### Tasks & Calendar (`/activities`)

| Element | XPath | CSS |
|---|---|---|
| Task filter | `//main//select[@aria-label='Task filter']` | `select[aria-label="Task filter"]` |
| Whose tasks | `//main//select[@aria-label='Whose tasks']` | `select[aria-label="Whose tasks"]` |
| Search | `//main//input[@placeholder='Search subject or notes']` |  |
| Table / Export | `//main//table` · `//main//button[normalize-space()='Export']` |  |
| Opportunities rows (`/opportunities`) | `//main//table/tbody/tr` |  |

## Executive Dashboard (`/`)

| Element | XPath | CSS |
|---|---|---|
| KPI: Active Leads | `//div[contains(@class,'crm-exec-kpi-copy')][span[normalize-space()='Active Leads']]/strong` |  |
| KPI: Converted Leads | `//div[contains(@class,'crm-exec-kpi-copy')][span[normalize-space()='Converted Leads']]/strong` |  |
| KPI: Open Opportunities | `//div[contains(@class,'crm-exec-kpi-copy')][span[normalize-space()='Open Opportunities']]/strong` |  |
| KPI: Reserved Units | `//div[contains(@class,'crm-exec-kpi-copy')][span[normalize-space()='Reserved Units']]/strong` |  |
| KPI: SPAs Executed | `//div[contains(@class,'crm-exec-kpi-copy')][span[normalize-space()='SPAs Executed']]/strong` |  |
| KPI: Units Available | `//div[contains(@class,'crm-exec-kpi-copy')][span[normalize-space()='Units Available']]/strong` |  |
| KPI: Sales Value (SPAs) | `//div[contains(@class,'crm-exec-kpi-copy')][span[normalize-space()='Sales Value (SPAs)']]/strong` |  |
| KPI: Collections Received | `//div[contains(@class,'crm-exec-kpi-copy')][span[normalize-space()='Collections Received']]/strong` |  |
| KPI: Outstanding Amount | `//div[contains(@class,'crm-exec-kpi-copy')][span[normalize-space()='Outstanding Amount']]/strong` |  |
| KPI: Won Opportunities | `//div[contains(@class,'crm-exec-kpi-copy')][span[normalize-space()='Won Opportunities']]/strong` |  |
| KPI card link (e.g. Active Leads) | `//a[contains(@class,'crm-exec-kpi-card')][.//div[contains(@class,'crm-exec-kpi-copy')]/span[normalize-space()='Active Leads']]` |  |
| Dashboard View (Executive Dashboard / Lead Dashboard) | `//main//select[option[@value='operations']]` |  |
| Period (This month, Last 30 days, This quarter, Year to date) | `//main//select[option[@value='last_30_days']]` |  |
| Panel by heading (e.g. Collections Summary) | `(//main//*[contains(concat(' ',normalize-space(@class),' '),' crm-panel ')][.//*[self::h2 or self::h3][normalize-space()='Collections Summary']])[last()]` |  |

## Report modules — common controls

| Element | XPath | CSS |
|---|---|---|
| Period filter (opens on Last 12 months; This month, Last month, …, Custom dates) | `//select[contains(@class,'crm-input')][option[@value='this_month']]` | `select.crm-input:has(option[value="this_month"])` |
| Reset filters (disabled until a filter changes) | `//button[normalize-space()='Reset filters']` |  |
| Custom dates: From / To | `//main//label[starts-with(normalize-space(),'From')]//input[@type='date']` (and `'To'`) |  |
| Filter dropdown by first option (e.g. All projects) | `//main//select[option[1][normalize-space()='All projects']]` |  |
| View: All | `//button[contains(@class,'crm-dashboard-view-segment-button')][normalize-space()='All']` |  |
| View: You and your team | `//button[contains(@class,'crm-dashboard-view-segment-button')][normalize-space()='You and your team']` |  |
| View: Mine | `//button[contains(@class,'crm-dashboard-view-segment-button')][normalize-space()='Mine']` |  |
| Report tab (e.g. Sales) | `//button[contains(@class,'crm-tab-button')][normalize-space()='Sales']` | `button.crm-tab-button` |
| KPI tile (build 3110-10), value | `//div[contains(@class,'crm-report-tile')][span[contains(@class,'crm-report-tile-label')][normalize-space()='Active customers']]/strong` | `div.crm-report-tile` → `strong.crm-report-tile-value` |
| Sub-report pill (build 3110-10), by query | `//*[contains(@class,'crm-single-report-sibling-pills')]//a[contains(@href,'report=byResidence')]` | `a.crm-single-report-pill` |
| Module tab bar (Sales … Exceptions are buttons, Leads is a link) | `//main//*[self::button or self::a][contains(@class,'crm-tab-button')][normalize-space()='Sales']` | `main .crm-tab-button` |
| Any KPI value (template) | `//article[contains(@class,'crm-card')][h3[normalize-space()='<Label>']]/div[contains(@class,'crm-kpi')]` | `article.crm-card:has(> h3) > div.crm-kpi` |
| Table by heading (template) | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='<Heading>']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |  |
| Table rows (template) | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='<Heading>']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]/tbody/tr` |  |
| Panel Export (template) | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='<Heading>']]//button[contains(@class,'crm-export-button')]` |  |
| Intro text under the heading | `//main//div[contains(@class,'crm-dashboard-title-row')]/following-sibling::p[contains(@class,'crm-muted-text')][1]` |  |
| Filter labels (Period (won / lost), Project, …) | `//main//label[contains(@class,'crm-field')][.//select]/span[contains(@class,'crm-label')]` | `main label.crm-field > span.crm-label` |
| Filter dropdown by its label (template) | `//main//label[contains(@class,'crm-field')][span[contains(@class,'crm-label')][normalize-space()='<Label>']]//select` |  |
| KPI titles (in order) | `//main//article[contains(@class,'crm-card')]/h3` | `main article.crm-card > h3` |
| KPI caption (template, e.g. "Value × probability") | `//main//article[contains(@class,'crm-card')][h3[normalize-space()='<Label>']]/p` |  |
| Panel headings (in order) | `//main//section[contains(@class,'crm-panel')]/div[contains(@class,'crm-panel-header')]/h3` |  |
| Panel note under the heading (template) | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='<Heading>']]/p[contains(@class,'crm-report-note')]` | `p.crm-report-note` |
| Table Total row (template; in `tfoot`, not `tbody`) | `…<table by heading>/tfoot/tr` | `tr.crm-report-total-row` |
| Empty table message (template) | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='<Heading>']]//*[normalize-space()='Nothing matches these filters.']` |  |

## Lead Reports (`/reports/leads`)

| Element | XPath |
|---|---|
| KPI: Leads Captured | `//article[contains(@class,'crm-card')][h3[normalize-space()='Leads Captured']]/div[contains(@class,'crm-kpi')]` |
| KPI: Contact Rate | `//article[contains(@class,'crm-card')][h3[normalize-space()='Contact Rate']]/div[contains(@class,'crm-kpi')]` |
| KPI: Qualification Rate | `//article[contains(@class,'crm-card')][h3[normalize-space()='Qualification Rate']]/div[contains(@class,'crm-kpi')]` |
| KPI: Opportunity Conversion | `//article[contains(@class,'crm-card')][h3[normalize-space()='Opportunity Conversion']]/div[contains(@class,'crm-kpi')]` |
| KPI: SPA Signed | `//article[contains(@class,'crm-card')][h3[normalize-space()='SPA Signed']]/div[contains(@class,'crm-kpi')]` |
| KPI: Won Value | `//article[contains(@class,'crm-card')][h3[normalize-space()='Won Value']]/div[contains(@class,'crm-kpi')]` |
| KPI: Avg Time to First Contact | `//article[contains(@class,'crm-card')][h3[normalize-space()='Avg Time to First Contact']]/div[contains(@class,'crm-kpi')]` |
| KPI: Open Leads Now | `//article[contains(@class,'crm-card')][h3[normalize-space()='Open Leads Now']]/div[contains(@class,'crm-kpi')]` |

**Lead Reports tabs** (`//button[contains(@class,'crm-tab-button')][normalize-space()='<Tab>']`, URL `?tab=…`). KPIs use the KPI template above; panels the panel template.

| Tab | URL | KPI cards | Panels |
|---|---|---|---|
| Overview & Funnel | (none) | the 8 KPIs above | Lead Funnel (`div.crm-report-funnel-step`), Data Completeness, 12-Month Trend (`div.crm-report-trend-month`) |
| Source & Channel | `?tab=source` | — | Performance by Lead Source |
| Aging & Follow-up | `?tab=aging` | Open Leads, Idle Over 30 Days, Never Contacted, Overdue Follow-ups | Idle Time, Lead Age, Open Leads by Salesperson, Open Leads by Status, Longest Idle Leads |
| Qualification & Conversion | `?tab=qualification` | Capture → First Contact, Capture → Qualified, Capture → Opportunity, Capture → SPA Signed | Conversion by Lead Rating, Conversion by Lead Score, Where the Leads Are Now, Lost Reasons |
| Salesperson Scorecard | `?tab=scorecard` | — | Salesperson Scorecard |

## Sales Reports (`/reports/sales`)

| Element | XPath |
|---|---|
| KPI: Open opportunities | `//article[contains(@class,'crm-card')][h3[normalize-space()='Open opportunities']]/div[contains(@class,'crm-kpi')]` |
| KPI: Pipeline value | `//article[contains(@class,'crm-card')][h3[normalize-space()='Pipeline value']]/div[contains(@class,'crm-kpi')]` |
| KPI: Weighted pipeline | `//article[contains(@class,'crm-card')][h3[normalize-space()='Weighted pipeline']]/div[contains(@class,'crm-kpi')]` |
| KPI: Won in period | `//article[contains(@class,'crm-card')][h3[normalize-space()='Won in period']]/div[contains(@class,'crm-kpi')]` |
| KPI: Won value | `//article[contains(@class,'crm-card')][h3[normalize-space()='Won value']]/div[contains(@class,'crm-kpi')]` |
| KPI: Win rate | `//article[contains(@class,'crm-card')][h3[normalize-space()='Win rate']]/div[contains(@class,'crm-kpi')]` |
| KPI: Average days to win | `//article[contains(@class,'crm-card')][h3[normalize-space()='Average days to win']]/div[contains(@class,'crm-kpi')]` |
| KPI: Past expected close | `//article[contains(@class,'crm-card')][h3[normalize-space()='Past expected close']]/div[contains(@class,'crm-kpi')]` |
| Table: Open Pipeline by Stage | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Open Pipeline by Stage']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Table: Salesperson Pipeline | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Salesperson Pipeline']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Table: Open Opportunities | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Open Opportunities']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Open Pipeline by Stage › Total row | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Open Pipeline by Stage']]//table[contains(@class,'crm-report-table')]/tfoot/tr` |
| Open Opportunities › reference links (open `/opportunities?selected=<id>`) | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Open Opportunities']]//table[contains(@class,'crm-report-table')]/tbody/tr/td[1]/a` |
| Opportunity Detail modal | `//*[contains(@class,'crm-opportunity-detail-modal')]` |
| Opportunity Detail › workflow steps | `//*[contains(@class,'crm-opportunity-detail-modal')]//button[contains(@class,'crm-workflow-step')]/strong` |

Filters send `projectCode`, `ownerUserId`, `brokerId`, `campaignId` and `view=team|self` to `GET /api/v1/reports/business/sales?period=…`.

## Inventory Reports (`/reports/inventory`)

| Element | XPath |
|---|---|
| KPI: Total units | `//article[contains(@class,'crm-card')][h3[normalize-space()='Total units']]/div[contains(@class,'crm-kpi')]` |
| KPI: Available | `//article[contains(@class,'crm-card')][h3[normalize-space()='Available']]/div[contains(@class,'crm-kpi')]` |
| KPI: Reserved | `//article[contains(@class,'crm-card')][h3[normalize-space()='Reserved']]/div[contains(@class,'crm-kpi')]` |
| KPI: Sold | `//article[contains(@class,'crm-card')][h3[normalize-space()='Sold']]/div[contains(@class,'crm-kpi')]` |
| KPI: Sold % | `//article[contains(@class,'crm-card')][h3[normalize-space()='Sold %']]/div[contains(@class,'crm-kpi')]` |
| KPI: Available value | `//article[contains(@class,'crm-card')][h3[normalize-space()='Available value']]/div[contains(@class,'crm-kpi')]` |
| KPI: Average available price | `//article[contains(@class,'crm-card')][h3[normalize-space()='Average available price']]/div[contains(@class,'crm-kpi')]` |
| KPI: Sold in period | `//article[contains(@class,'crm-card')][h3[normalize-space()='Sold in period']]/div[contains(@class,'crm-kpi')]` |
| Table: Availability Summary | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Availability Summary']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Table: Inventory by Project | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Inventory by Project']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Table: Inventory by Unit Type | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Inventory by Unit Type']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Table: Inventory by Bedrooms | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Inventory by Bedrooms']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Table: Available Units | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Available Units']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |

## Customer Reports (`/reports/customers`)

| Element | XPath |
|---|---|
| KPI: Active customers | `//article[contains(@class,'crm-card')][h3[normalize-space()='Active customers']]/div[contains(@class,'crm-kpi')]` |
| KPI: New in period | `//article[contains(@class,'crm-card')][h3[normalize-space()='New in period']]/div[contains(@class,'crm-kpi')]` |
| KPI: Customers with SPA | `//article[contains(@class,'crm-card')][h3[normalize-space()='Customers with SPA']]/div[contains(@class,'crm-kpi')]` |
| KPI: Repeat buyers | `//article[contains(@class,'crm-card')][h3[normalize-space()='Repeat buyers']]/div[contains(@class,'crm-kpi')]` |
| KPI: SPA value | `//article[contains(@class,'crm-card')][h3[normalize-space()='SPA value']]/div[contains(@class,'crm-kpi')]` |
| KPI: Average value per buyer | `//article[contains(@class,'crm-card')][h3[normalize-space()='Average value per buyer']]/div[contains(@class,'crm-kpi')]` |
| KPI: Portal access | `//article[contains(@class,'crm-card')][h3[normalize-space()='Portal access']]/div[contains(@class,'crm-kpi')]` |
| Table: Customers by Nationality | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Customers by Nationality']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Table: Customers by Country of Residence | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Customers by Country of Residence']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Table: Customers by Type | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Customers by Type']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Table: New Customers in Period | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='New Customers in Period']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Table Total row (template) | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Customers by Nationality']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]/tfoot/tr` |
| Customer ID links (New Customers in Period) | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='New Customers in Period']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]/tbody//a` |
| Empty list message | `//main//*[normalize-space()='Nothing matches these filters.']` |
| Custom dates error | `//main//*[starts-with(normalize-space(),'Choose both From and To dates')]` |
| Customers page: register rows | `//main//section[contains(@class,'crm-panel')][.//*[normalize-space()='Customer Register']]//table/tbody/tr` |
| Customers page: customer form opened from a Customer ID | `//form[contains(@class,'crm-management-modal')]` |

## Broker Reports (`/reports/brokers`)

| Element | XPath |
|---|---|
| KPI: Active brokers | `//article[contains(@class,'crm-card')][h3[normalize-space()='Active brokers']]/div[contains(@class,'crm-kpi')]` |
| KPI: Brokers with SPA | `//article[contains(@class,'crm-card')][h3[normalize-space()='Brokers with SPA']]/div[contains(@class,'crm-kpi')]` |
| KPI: Broker leads | `//article[contains(@class,'crm-card')][h3[normalize-space()='Broker leads']]/div[contains(@class,'crm-kpi')]` |
| KPI: Broker reservations | `//article[contains(@class,'crm-card')][h3[normalize-space()='Broker reservations']]/div[contains(@class,'crm-kpi')]` |
| KPI: Broker SPAs | `//article[contains(@class,'crm-card')][h3[normalize-space()='Broker SPAs']]/div[contains(@class,'crm-kpi')]` |
| KPI: Broker SPA value | `//article[contains(@class,'crm-card')][h3[normalize-space()='Broker SPA value']]/div[contains(@class,'crm-kpi')]` |
| KPI: Broker share of SPAs | `//article[contains(@class,'crm-card')][h3[normalize-space()='Broker share of SPAs']]/div[contains(@class,'crm-kpi')]` |
| Table: Broker Performance | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Broker Performance']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |

## Marketing Reports (`/reports/marketing`)

| Element | XPath |
|---|---|
| KPI: Running today | `//article[contains(@class,'crm-card')][h3[normalize-space()='Running today']]/div[contains(@class,'crm-kpi')]` |
| KPI: Campaign budget | `//article[contains(@class,'crm-card')][h3[normalize-space()='Campaign budget']]/div[contains(@class,'crm-kpi')]` |
| KPI: Campaign leads | `//article[contains(@class,'crm-card')][h3[normalize-space()='Campaign leads']]/div[contains(@class,'crm-kpi')]` |
| KPI: Leads to SPA | `//article[contains(@class,'crm-card')][h3[normalize-space()='Leads to SPA']]/div[contains(@class,'crm-kpi')]` |
| KPI: Revenue | `//article[contains(@class,'crm-card')][h3[normalize-space()='Revenue']]/div[contains(@class,'crm-kpi')]` |
| KPI: Cost per lead | `//article[contains(@class,'crm-card')][h3[normalize-space()='Cost per lead']]/div[contains(@class,'crm-kpi')]` |
| KPI: ROI | `//article[contains(@class,'crm-card')][h3[normalize-space()='ROI']]/div[contains(@class,'crm-kpi')]` |
| Table: Campaign Performance | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Campaign Performance']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Table: Performance by Channel | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Performance by Channel']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |

## Reservation Reports (`/reports/reservations`)

| Element | XPath |
|---|---|
| KPI: Reservations in period | `//article[contains(@class,'crm-card')][h3[normalize-space()='Reservations in period']]/div[contains(@class,'crm-kpi')]` |
| KPI: Reservation amount | `//article[contains(@class,'crm-card')][h3[normalize-space()='Reservation amount']]/div[contains(@class,'crm-kpi')]` |
| KPI: Converted to SPA | `//article[contains(@class,'crm-card')][h3[normalize-space()='Converted to SPA']]/div[contains(@class,'crm-kpi')]` |
| KPI: Conversion rate | `//article[contains(@class,'crm-card')][h3[normalize-space()='Conversion rate']]/div[contains(@class,'crm-kpi')]` |
| KPI: Active now | `//article[contains(@class,'crm-card')][h3[normalize-space()='Active now']]/div[contains(@class,'crm-kpi')]` |
| KPI: Expiring in 7 days | `//article[contains(@class,'crm-card')][h3[normalize-space()='Expiring in 7 days']]/div[contains(@class,'crm-kpi')]` |
| KPI: Past expiry, still active | `//article[contains(@class,'crm-card')][h3[normalize-space()='Past expiry, still active']]/div[contains(@class,'crm-kpi')]` |
| KPI: Deposit not received | `//article[contains(@class,'crm-card')][h3[normalize-space()='Deposit not received']]/div[contains(@class,'crm-kpi')]` |
| Table: Reservations by Month | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Reservations by Month']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Table: Reservations by Project | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Reservations by Project']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Table: Reservations by Salesperson | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Reservations by Salesperson']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Table: Active Reservations | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Active Reservations']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Active Reservations: reservation number link | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Active Reservations']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]/tbody//a` |
| Reservation Detail (opened from the link) | `//*[contains(@class,'crm-modal') or @role='dialog'][.//*[normalize-space()='Reservation Detail']]` |

## SPA Reports (`/reports/spa`)

| Element | XPath |
|---|---|
| KPI: SPAs signed in period | `//article[contains(@class,'crm-card')][h3[normalize-space()='SPAs signed in period']]/div[contains(@class,'crm-kpi')]` |
| KPI: Signed value | `//article[contains(@class,'crm-card')][h3[normalize-space()='Signed value']]/div[contains(@class,'crm-kpi')]` |
| KPI: Average SPA value | `//article[contains(@class,'crm-card')][h3[normalize-space()='Average SPA value']]/div[contains(@class,'crm-kpi')]` |
| KPI: Awaiting signature | `//article[contains(@class,'crm-card')][h3[normalize-space()='Awaiting signature']]/div[contains(@class,'crm-kpi')]` |
| KPI: Average days reservation to SPA | `//article[contains(@class,'crm-card')][h3[normalize-space()='Average days reservation to SPA']]/div[contains(@class,'crm-kpi')]` |
| KPI: Handed off to ERP | `//article[contains(@class,'crm-card')][h3[normalize-space()='Handed off to ERP']]/div[contains(@class,'crm-kpi')]` |
| KPI: Signed, KYC not approved | `//article[contains(@class,'crm-card')][h3[normalize-space()='Signed, KYC not approved']]/div[contains(@class,'crm-kpi')]` |
| Table: SPAs Signed by Month | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='SPAs Signed by Month']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Table: SPAs by Project | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='SPAs by Project']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Table: SPAs by Salesperson | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='SPAs by Salesperson']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Table: SPAs Needing Action | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='SPAs Needing Action']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |

## Collection Reports (`/reports/collections`)

| Element | XPath |
|---|---|
| KPI: Scheduled | `//article[contains(@class,'crm-card')][h3[normalize-space()='Scheduled']]/div[contains(@class,'crm-kpi')]` |
| KPI: Received | `//article[contains(@class,'crm-card')][h3[normalize-space()='Received']]/div[contains(@class,'crm-kpi')]` |
| KPI: Outstanding | `//article[contains(@class,'crm-card')][h3[normalize-space()='Outstanding']]/div[contains(@class,'crm-kpi')]` |
| KPI: Overdue | `//article[contains(@class,'crm-card')][h3[normalize-space()='Overdue']]/div[contains(@class,'crm-kpi')]` |
| KPI: Collection rate | `//article[contains(@class,'crm-card')][h3[normalize-space()='Collection rate']]/div[contains(@class,'crm-kpi')]` |
| KPI: Due in next 30 days | `//article[contains(@class,'crm-card')][h3[normalize-space()='Due in next 30 days']]/div[contains(@class,'crm-kpi')]` |
| KPI: Due in period | `//article[contains(@class,'crm-card')][h3[normalize-space()='Due in period']]/div[contains(@class,'crm-kpi')]` |
| KPI: Received of due in period | `//article[contains(@class,'crm-card')][h3[normalize-space()='Received of due in period']]/div[contains(@class,'crm-kpi')]` |
| Table: Outstanding by Age | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Outstanding by Age']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Table: Collections by Project | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Collections by Project']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Table: Overdue Instalments | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Overdue Instalments']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |

## Exception Reports (`/reports/exceptions`)

| Element | XPath |
|---|---|
| KPI: Open exceptions | `//article[contains(@class,'crm-card')][h3[normalize-space()='Open exceptions']]/div[contains(@class,'crm-kpi')]` |
| KPI: Overdue instalments | `//article[contains(@class,'crm-card')][h3[normalize-space()='Overdue instalments']]/div[contains(@class,'crm-kpi')]` |
| KPI: Reservations past expiry | `//article[contains(@class,'crm-card')][h3[normalize-space()='Reservations past expiry']]/div[contains(@class,'crm-kpi')]` |
| KPI: Expiring in 7 days | `//article[contains(@class,'crm-card')][h3[normalize-space()='Expiring in 7 days']]/div[contains(@class,'crm-kpi')]` |
| KPI: SPAs unsigned > 14 days | `//article[contains(@class,'crm-card')][h3[normalize-space()='SPAs unsigned > 14 days']]/div[contains(@class,'crm-kpi')]` |
| KPI: Leads not contacted | `//article[contains(@class,'crm-card')][h3[normalize-space()='Leads not contacted']]/div[contains(@class,'crm-kpi')]` |
| Table: Exception Summary | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Exception Summary']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Detail list: Overdue instalments | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Overdue instalments']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Detail list: Reservations past expiry | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Reservations past expiry']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Detail list: Reservation deposit not received after 7 days | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Reservation deposit not received after 7 days']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Detail list: SPAs not signed after 14 days | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='SPAs not signed after 14 days']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Detail list: Signed SPAs with KYC not approved | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Signed SPAs with KYC not approved']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Detail list: Signed SPAs not handed off to ERP after 3 days | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Signed SPAs not handed off to ERP after 3 days']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Detail list: Open opportunities past expected close date | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Open opportunities past expected close date']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |
| Detail list: Leads not contacted after 2 days | `//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Leads not contacted after 2 days']]//table[contains(@class,'crm-report-table') or contains(@class,'crm-availability-table')]` |

## Inventory, Proposals, SPA / Sales Contracts and the deal chain

| Element | XPath |
|---|---|
| Page tab (Inventory: Projects, Products, Units, …) | `//main//button[normalize-space()='Units']` |
| Register rows (data rows only; the last table of the page) | `(//main//table)[last()]/tbody/tr[td]` |
| Register headers | `(//main//table)[last()]/thead/tr[last()]/th` |
| Pager text "Showing 1–20 of 135 units · Page 1 of 7" | `//main//*[contains(@class,'crm-pagination')]//*[starts-with(normalize-space(),'Showing')]` |
| Pager Next | `//main//*[contains(@class,'crm-pagination')]//button[normalize-space()='Next']` |
| Register search (by placeholder) | `//main//input[@type='search'][@placeholder='Search unit, project, status']` |
| Unit Register status filter | `(//main//section[contains(@class,'crm-panel')]//select)[1]` |
| Top-most modal form (New Project / Product / Unit / Proposal / Contract, payment plan) | `(//*[contains(@class,'crm-modal')][not(contains(@class,'crm-unit-picker-dialog'))])[last()]` |
| Modal field by name | `(//*[contains(@class,'crm-modal')])[last()]//*[@name='proposedPrice']` |
| Modal button | `(//*[contains(@class,'crm-modal')])[last()]//button[normalize-space()='Create Proposal']` |
| Record detail panel (Opportunity / Reservation / Proposal / Contract Detail) | `(//section[contains(@class,'detail-modal')])[last()]` |
| Panel button | `(//section[contains(@class,'detail-modal')])[last()]//button[normalize-space()='Approve Proposal']` |
| Panel field by label | `(//section[contains(@class,'detail-modal')])[last()]//label[contains(@class,'crm-field')][span[contains(@class,'crm-label')][starts-with(normalize-space(),'Action remarks')]]` |
| Unit picker ("Choose Unit") | `//*[contains(@class,'crm-unit-picker-dialog')]` |
| Unit picker search / row | `//*[contains(@class,'crm-unit-picker-dialog')]//input[starts-with(@placeholder,'Search unit')]` · `…//tbody/tr[.//*[normalize-space()='CBR123456-D123']]` |
| Customer → Documents & KYC block | `//*[contains(@class,'crm-modal')]//h4[normalize-space()='Documents & KYC']/ancestor::*[.//button[normalize-space()='Upload']][1]` |
| KYC status pill | `//*[contains(@class,'crm-modal')]//span[contains(@class,'crm-kyc-status')]` |
| KYC inputs | `select[aria-label='KYC document type']`, `input[aria-label='Document number']`, `.crm-date-field` (expiry), `input[aria-label='KYC file']` |
| Rows of the table under a heading (Reservations → "Pending My Approval (23)") | `//main//*[self::h2 or self::h3 or self::h4][starts-with(normalize-space(),'Pending My Approval')]/following::table[1]/tbody/tr[td]` |
| Select by aria-label (Board: Owner / Project / Closed deals; Inventory → Holds: Whose holds / Show) | `//main//select[@aria-label='Owner']` |
| Opportunities Board column (one per stage) | `//main//section[contains(concat(' ',normalize-space(@class),' '),' crm-board-column ')]` |
| Board column count / value (inside a column) | `.//span[contains(@class,'crm-board-count')]` · `.//span[contains(@class,'crm-board-column-value')]` |
| Board card / its move menu (inside a column) | `.//select[starts-with(@aria-label,'Move ')]/ancestor::*[count(.//select[starts-with(@aria-label,'Move ')])=1][last()]` · `.//select[starts-with(@aria-label,'Move ')]` |
| Board summary "Open pipeline: N deals · V USD · weighted W USD" | `//main//span[contains(@class,'crm-board-summary')]` |
| Register column sort header (`aria-sort` = none / ascending / descending; click its button) | `(//main//table)[last()]/thead/tr[last()]/th[contains(@class,'crm-sortable-th')][.//span[normalize-space()='Value']]` |
| Pager Previous | `//main//*[contains(@class,'crm-pagination')]//button[normalize-space()='Previous']` |
| KPI card formula line (Contracts → Total "Draft/Issued (5) + Signed (5) + Canc. (13)") | `//main//article[contains(@class,'crm-card')][h3[normalize-space()='Total']]/p[contains(@class,'crm-card-formula')]` |
| Floor Plans & Media panel (Product Details / unit view) | `(//*[contains(@class,'crm-modal')]//section[contains(@class,'crm-media-panel')])[last()]` — inputs `input[aria-label='Virtual tour link']`, `select[aria-label='File type']`, `input[aria-label='Caption']`, `input[aria-label='File']` |
| Contract Detail → Documents inputs | `select` with option "Signed SPA", `input[placeholder='Description (optional)']`, `input[type=file]`, button Upload |
| Inventory unit view / its section buttons | `(//*[contains(@class,'crm-unit-detail-modal')])[last()]` · `…//button[starts-with(normalize-space(),'Linked Modules')]` |
| Availability Summary view buttons (⊞ Summary Table / 🏢 Stack Plan) | `(//main//button[contains(@class,'crm-dashboard-view-segment-button')][contains(normalize-space(),'Stack Plan')])[1]` |
## Opportunities (`/opportunities`)

Captured from build v1.0 1910-49 on 2026-10-20. The Opportunity Detail and Lead Detail modals share their
CSS classes, so both are matched by their `<h3>` title.

| Element | Locator |
| KPI: Total / Open / Pipeline Value / Avg Probability | `//article[contains(@class,'crm-card')][h3[normalize-space()='Total']]/div[contains(@class,'crm-kpi')]` |
| KPI formula (tooltip in `title`) | `//main//article[contains(@class,'crm-card')][h3[normalize-space()='Total']]/p[contains(@class,'crm-card-formula')]` |
| Search box | `main input.crm-search-input[placeholder^="Search opportunity"]` |
| Clear search | `main button.crm-search-clear` |
| List / Board toggle | `//main//div[contains(@class,'crm-view-toggle')]/button[normalize-space()='Board']` (`aria-pressed`) |
| Sortable column header (`aria-sort`) | `//main//table[contains(@class,'crm-table')]//th[.//span[normalize-space()='Budget']]` |
| Rows / record link | `main table.crm-table tbody tr` / `a.crm-record-link` (opens `/opportunities?selected=<id>`) |
| Empty state | `//main//table[contains(@class,'crm-table')]/tbody//td[normalize-space()='No opportunities found.']` |
| Pager | `main .crm-pagination > span` ("Showing 1–20 of 130 opportunities · Page 1 of 7") |
| Board filters | `main .crm-board-toolbar select[aria-label="Owner" \| "Project" \| "Closed deals"]` |
| Board summary | `main .crm-board-summary` ("Open pipeline: 47 deals · 2.18B USD · weighted 1.65B USD") |
| Board column / count / value | `main section.crm-board-column[aria-label="Qualified"]` › `.crm-board-count` / `.crm-board-column-value` |
| Board Won/Lost "Show" | `section.crm-board-column[aria-label="Won"]//header//button[normalize-space()='Show']` |
| Board card / move menu | `main article.crm-board-card[aria-label^="OPP-… "]` › `select.crm-board-move-select` |
| Opportunity Detail modal | `//section[@role='dialog'][.//h3[normalize-space()='Opportunity Detail']]` |
| Detail fact (Lead, Budget, Project, Unit, Probability, Expected Close) | `…//ul[contains(@class,'crm-detail-facts')]/li[span[contains(@class,'crm-detail-fact-label')][normalize-space()='Budget']]/span[contains(@class,'crm-detail-fact-value')]` |
| Detail status | `…//div[contains(@class,'crm-detail-title')]/span[contains(@class,'crm-status-pill')]` |
| Workflow steps | `…//button[contains(@class,'crm-workflow-step')]` (`is-completed` / `is-current` / `is-next`) |
| Visit form / type / date | `…//form[.//h4[contains(normalize-space(),'Schedule Visit')]]` › `select[name="visitType"]` / `button.crm-date-field-trigger` |
| Date picker | `button.crm-calendar-nav-button[aria-label="Next month"]`, `button.crm-calendar-day:not(.is-outside)`, `.crm-date-field-time input[type="time"]`, `button.crm-date-field-set-button` |
| Mark Lost form / reason | `…//form[contains(@class,'crm-opportunity-lost-card')]` › `select[name="lostReasonRefId"]`, `textarea[name="remarks"]` |
| Add Note form | `…//form[.//h4[normalize-space()='Add Note']]` › `textarea[name="noteText"]` |
| Notes / Site Visits sections | `…//section[contains(@class,'crm-activity-list')][h4[normalize-space()='Notes']]` |
| Notice / confirmation dialog | `section.crm-notice-dialog[role="alertdialog"]` (title `h3`, buttons e.g. OK, Go back, Convert, Confirm) |
| Lead Detail modal / status | `//section[@role='dialog'][.//h3[normalize-space()='Lead Detail']]` › `…//div[contains(@class,'crm-detail-title')]//span[contains(@class,'crm-status-pill')]` |
| Leads search | `main input.crm-search-input[placeholder^="Search name"]` |

API used by the tests: `GET /api/v1/opportunities?search=&limit=&offset=&sortBy=&sortDir=`, `GET /opportunities/board?closedWithinDays=&perStage=`,
`GET /opportunities/<id>`, `POST /leads/<id>/convert`, `POST /opportunities/<id>/site-visits`, `POST /opportunities/<id>/stage`,
`GET /reference-data/families/OPPORTUNITY/STAGE`.

## Unit Reservations (`/reservations`)

Captured from build v1.0 1910-49 on 2026-10-21. Modals are matched by their `<h3>` title.

| Element | Locator |
| New Reservation | `//main//section[contains(@class,'crm-module-header')]//button[normalize-space()='New Reservation']` |
| Status card (All Reservations / Active / Converted / Cancelled; filters the register, `aria-pressed`) | `//main//button[contains(@class,'crm-metric-card-button')][h3[normalize-space()='Active']]` › `.crm-kpi` |
| Amount card | `//main//article[contains(@class,'crm-card')][h3[normalize-space()='Amount']]/div[contains(@class,'crm-kpi')]` |
| Pending My Approval panel | `//main//section[contains(@class,'crm-panel')][.//h3[starts-with(normalize-space(),'Pending My Approval')]]` |
| Register / search | `//main//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Reservation Register']]` / `main input.crm-search-input[placeholder^="Search reservation"]` |
| Register rows / link | `…Reservation Register…//table/tbody/tr` / `a.crm-record-link` (opens `/reservations?selected=<id>`) |
| Reservation Detail modal | `//section[@role='dialog'][.//h3[normalize-space()='Reservation Detail']]` |
| Detail fact (Opportunity, Unit, Project, Amount, Date, Expiry, Deposit Received, ERP Sync) | `…//ul[contains(@class,'crm-detail-facts')]/li[span[contains(@class,'crm-detail-fact-label')][normalize-space()='Unit']]/span[contains(@class,'crm-detail-fact-value')]` |
| Quick notes / action buttons | `…//label[contains(@class,'crm-continue-panel-notes')]//textarea` / `…//div[contains(@class,'crm-continue-panel-actions')]//button` |
| Documents (type, description, file, Upload; list items with Delete) | `…//section[@aria-label='Documents']` › `select`, `input[placeholder="Description (optional)"]`, `input[type="file"]`, `li.crm-document-item` |
| History / entries | `…//section[@aria-label='Change history']` › `ol.crm-audit-timeline > li` |
| Create / Replace form | `//section[@role='dialog'][.//h3[normalize-space()='Create Reservation' \| 'Replace Reservation']]` |
| Form fields | `select[name="opportunityId"]`, `input[placeholder="Select an available unit"]` + Choose Unit, `input[name="reservationAmount"]`, `input[name="currencyCode"]`, `.crm-date-field input[type="hidden"]` (expiry), `textarea[name="remarks"]` |
| Unit picker | `section.crm-unit-picker-dialog` › `tbody tr` (unit in `td strong`, `.crm-unit-available-badge`, Select), `label.crm-unit-picker-filter input[type="checkbox"]` (Hide units on hold) |

API used by the tests: `GET /api/v1/reservations?search=&limit=&offset=&sortBy=&sortDir=` (with `summary` counts), `GET /reservations/<id>`,
`POST /reservations`, `POST /reservations/<id>/supersede`, `/approve`, `/cancel`, `POST /documents`, `DELETE /documents/<id>`,
`GET /audit/records/RESERVATION/<id>`.

## Customers & Brokers (`/customers`)

Captured from build v1.0 1910-49 on 2026-10-23.

| Element | Locator |
| Cards (Customers, Brokers, Active Customers, Active Brokers) | `//article[contains(@class,'crm-card')][h3[normalize-space()='Customers']]/div[contains(@class,'crm-kpi')]` |
| Tabs | `//main//section[contains(@class,'crm-tabs')]//button[normalize-space()='Brokers']` (class `is-active`) |
| Register | `//main//section[contains(@class,'crm-panel')][.//h3[normalize-space()='Customer Register']]` (or `'Broker Register'`) |
| Search | `main input.crm-search-input[placeholder="Search customer, phone, email"]` / `[placeholder="Search broker, phone, email"]` |
| New Customer (disabled) / New Broker | `//main//button[normalize-space()='New Customer']` / `'New Broker'` |
| Edit Customer window | `//*[@role='dialog'][.//h3[normalize-space()='Edit Customer']]` › fields by name (`displayName`, `firstName`, `lastName`, `mobileNo`, `email`, `remarks`, …), Update Customer |
| Customer sections | `…//section[.//h4[normalize-space()='All Units']]` (also Agreed Packs, Payments & statement, Communications, History) |
| KYC | `section[aria-label="Documents and KYC"]` › `select[aria-label="KYC document type"]`, `input[aria-label="Document number"]`, expiry date field, `input[type=file]`, Upload; status `span.crm-kyc-status` ("KYC: Not Started") |
| Broker form (create / edit) | `form[data-broker-form]` (h3 "Create Broker" / "Edit Broker") › fields by name (`name`, `mobileNo`, `email`, `commissionPlanCode`, `city`, `remarks`, …); errors `.crm-field-error` |
| Broker portal credentials | `//*[@role='dialog' or @role='alertdialog'][.//*[normalize-space()='Broker Portal Credentials']]` (Show, Copy Credentials, Done) |
| Discard prompt | `section.crm-notice-dialog[role="alertdialog"]` with "Discard changes?" (Keep editing / Discard) |

API used by the tests: `GET /api/v1/customers?…`, `GET|PATCH /customers/<id>`, `GET /customers/<id>/units`, `GET /brokers?…`, `POST /brokers`,
`GET|PATCH /brokers/<id>`, `GET /kyc/customers/<id>`, `POST /kyc/customers/<id>/documents`, `DELETE /kyc/documents/<id>`.

## Brokers & Channels (`/brokers-channels`)

Captured from build v1.0 1910-49 on 2026-10-23.

| Element | Locator |
| Status summary ("2 live", "5 partial", "3 planned") | `main .crm-module-hub-summary .crm-module-hub-status` |
| Signal card (Active Brokers, Total Brokers, Lead Sources (this month), Capture Channels (this month)) | `//main//div[contains(@class,'crm-module-hub-kpi')][span[normalize-space()='Total Brokers']]/strong` |
| Open Broker Register | `//main//a[normalize-space()='Open Broker Register']` (→ `/customers?tab=brokers`) |
| Top capture channels / Registered brokers rows | `//main//div[contains(@class,'crm-module-hub-mini-list')][strong[normalize-space()='Registered brokers']]/ul/li` (two `span`s per row) |
| Module card | `//main//*[contains(concat(' ',normalize-space(@class),' '),' crm-module-hub-card ')][.//strong[normalize-space()='Broker SPAs']]` (`a.is-link` when available, `article` when planned) |

API used by the page: `GET /api/v1/brokers?limit=5`, `GET /dashboard/summary?period=this_month&view=audience` (`audience.bySource`, `audience.byCaptureChannel`).

## Construction Updates (`/construction-updates`)

Captured from build v1.0 1910-49 on 2026-10-23. In `tests/locators.ts` as `CUP`.

| Element | Locator |
| Header buttons (Hide tips / Show tips, New Update) | `//main//section[contains(@class,'crm-module-header')]//button[normalize-space()='New Update']` |
| Help panel ("How to use Construction Updates", 4 steps, Tip) | `main section.crm-help-panel` (`ol > li`, `aside p`) |
| List count "Updates (4)" | `//main//section[contains(@class,'crm-panel')]//h3[starts-with(normalize-space(),'Updates (')]` |
| Search / clear | `main input[placeholder="Search title or project"]`, `main button[aria-label="Clear search"]` |
| Status filter / project filter | `//main//select[option[normalize-space()='All statuses']]`, `//main//select[option[normalize-space()='All projects']]` |
| Rows (data only) / empty row | `main section.crm-aftersales-split table.crm-table tbody tr:not(:has(td.crm-empty-cell))`, `td.crm-empty-cell` |
| Row by title (click to edit) | `//main//table[contains(@class,'crm-table')]/tbody/tr/td[1]/button[normalize-space()='Flooring In process']`; selected row `tr.is-selected` |
| Detail panel heading / subtitle | `main section.crm-detail-panel > .crm-panel-header h3` ("New draft" / "Edit update"), `… p.crm-muted-text` ("Palm Exotjca Limited · DRAFT") |
| Publish / Unpublish | `//main//section[contains(@class,'crm-detail-panel')]/div[contains(@class,'crm-panel-header')]//button[normalize-space()='Publish']` |
| Form fields | `select[name="projectId"]`, `input[placeholder="e.g. August 2026"]` (Period label, no name), `input[name="title"]`, `textarea[name="description"]`, `label.crm-checkbox-row input[type="checkbox"]`, `form button[type="submit"]` (Save Draft / Save Changes) |
| Field error | `//main//section[contains(@class,'crm-detail-panel')]//label[contains(@class,'crm-field')][span[normalize-space()='Title']]/small[contains(@class,'crm-field-error')]` |
| Photo gallery | caption `input[placeholder="Optional caption"]`, `label.crm-file-button input[type="file"]` (Add Photo), cards `figure.crm-photo-card` (`img`, `figcaption span`, Remove `button`) |
| Success / error message | `main .crm-success-banner`, `main [role="alert"]:not(.crm-field-error)` |

API used by the page: `GET /api/v1/construction-updates?limit=100[&status=…&projectId=…]`, `GET /construction-updates/projects`,
`GET|PATCH /construction-updates/<id>`, `POST /construction-updates`, `POST /construction-updates/<id>/publish` (`{publish: true|false}`),
`POST /construction-updates/<id>/photos` (multipart `file`, `visibility`, `caption`), `DELETE /construction-updates/<id>/photos/<photoId>`.

## Ask the developers for `data-testid`

The app has no test IDs. These attributes would make every locator above a one-liner that never breaks:

| Element | Suggested attribute |
|---|---|
| KPI value (all pages) | `data-testid="kpi-<slug>"` e.g. `kpi-active-leads` |
| Leads tab badge | `data-testid="leads-tab-count-<slug>"` |
| Report table | `data-testid="report-table-<slug>"` |
| Pager text | `data-testid="pager-summary"` |
| Period filter | `aria-label="Report period"` (other filters on report pages also lack labels) |
