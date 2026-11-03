# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Playwright + TypeScript suite that checks the counts and metrics shown in the QA CRM app (`https://qa-crm.asquareab.com`, overridable with `BASE_URL`). It covers the Reports & Analytics hub, 10 report modules, the Executive Dashboard and the Leads page. It does not test application source code; everything runs against the live QA site, so data changes between runs.

## Commands

```bash
npm install && npx playwright install chromium
npm run login                      # opens codegen; log in, close the browser → writes auth.json (needed by every test)
npm test                           # all tests, headless, 4 workers
npx playwright test consistency    # one spec file (filename filter)
npx playwright test -g "X-05"      # a single test, matched by its case ID in the title
npm run test:scenarios             # workbook scenarios only (@scenario); npm run test:core for the rest
npm run test:headed                # headed, 1 worker
npm run report                     # open the Playwright HTML report
npx tsc                            # type-check only (tsconfig has noEmit); there is no linter

# Optional PostgreSQL comparison (needs .env copied from .env.example)
npm run db:check                   # connectivity check
npm run db:discover                # writes db-schema.md (gitignored)
npm run test:db                    # tests/db.spec.ts; skipped automatically if PG* env vars are missing
```

Locator discovery: `npx playwright codegen https://qa-crm.asquareab.com --load-storage=auth.json`.

## Architecture

**Layers.** Specs never write selectors inline:
- `tests/locators.ts` is the single source of truth for routes (`ROUTES`), XPath builders (`XP`), and lists of labels (`HUB_SNAPSHOT`, `HUB_MODULES`, `REPORT_PAGES`, `DASHBOARD_KPIS`, `LEADS_TABS`). XPaths match elements by visible label text because the app has no `data-testid` attributes. When the UI changes, fix the locator here and keep `LOCATORS.md` (a human/Selenium reference copy) in sync.
- `tests/helpers.ts` holds the reading primitives: `open` (goto + wait for data), `kpi`/`kpiText` (picks the right KPI pattern for any page through `kpiLocator`), `tabBadge`, `listCount`, `tableRows`, `tableColumn`, `act` (click, then wait for the XHR it triggers), plus API capture (`collectJson`/`numbersIn`/`matchesApi`) and `watchErrors`.
- `parseNum` turns display strings like `"2.18B USD"`, `"1.23M"` and `"52.8%"` into numbers. Because of that rounding, value comparisons use a tolerance (about 0.5%; see `matchesApi` and `sameValue` in `tests/db.ts`). Counts are compared exactly.

**Data-driven tests.** Many tests are generated from tables:
- `tests/consistency-cases.ts` `SAME[]`: each X-NN case lists sources (page + KPI label, or page + table heading, which counts table rows) that must all show the same value. To add a cross-page check, add an entry here.
- `tests/db-queries.ts` `DB_CHECKS[]`: maps a UI source to SQL. Table and column names are **first guesses** until they are mapped from `db-schema.md`.
- `consistency.spec.ts` M-NN tests check the math within a single page (sums, percentages).

**Test IDs drive the Excel report.** Every test title must start with a case ID (`RA-01`, `X-05`, `M-03`, `RA-MOD-01`, `DB-L-10`, …). `reporter/excel-reporter.ts` reads the ID from the title (regex `^[A-Z]+(-[A-Z]+)*-\d+`) and looks up module, severity, steps and expected result through `caseInfo()` in `tests/test-catalog.ts`. **When you add a test, add a matching catalog entry** so its defect row has real steps. The reporter names the file after the page when every test in the run belongs to one page (`reportPageOf()`: `reports/Leads_Page_Test_Report_<date>_<time>.xlsx`, `Lead_Reports_Test_Report_…`), otherwise `reports/CRM_Defect_Report_<date>_<time>.xlsx` (`REPORT_NAME` overrides the name, `EXCEL_REPORT_DIR` the folder). All Results lists every test's steps, expected and actual result, and embeds failure screenshots from `test-results/`. Values recorded with `test.info().annotations` appear in the report's "observed values" column.

**Conventions in specs:**
- Use `expect.soft` when a test checks several values, so one run reports all of them.
- Use `test.skip(cond, reason)` for data-dependent cases (for example, zero SPAs in the period).
- Report modules open on "Last 12 months", while the hub and dashboard always show "This month". Cross-page comparisons (`consistency.spec.ts`, scenarios) switch each module to "This month" before reading it.
- **Reports redesign (build v2.0 3110-10).** The hub `/reports-analytics` is now a report catalogue (its snapshot KPIs are gone) and each module shows one sub-report at a time, chosen by the pills "Reports in …: CUS-01 CUS-02 …" (`?report=<key>`; Lead Reports `?tab=<key>`). Modules now open on "This month". KPI tiles (`div.crm-report-tile`, `XP.reportTile`) are the same on every sub-report of a module and are read by `kpi()`. `SUBREPORTS` in `locators.ts` maps module route → sub-report → table headings; `showTable()` (used by `tableRows`, `tableColumn` and `ReportTable`) clicks the right pill when a table is not on screen, keeping the period and filters. `RENAMED_TABLES` / `RENAMED_COLUMNS` map old names to the new ones (e.g. "Broker Performance" → "Report #17 — Partner Broker Scorecard & Quota Achievement", column "SPAs" → "Units Sold (SPA)"). Executive figures now live on `/dashboards` (`ROUTES.dashboards`, tiles read with `ExecutiveReportsPage.tile()`) and Governance RPT-01; "active leads" is on My Smart Workspace (`/`). Only the tests behind the retested defects were rewritten (RA-006/007/018/058/059/064, CR / BR checks); other report tests may still expect the old single-page layout.
- To check a new release for UI changes, compare the frontend bundle name in the page source (`assets/index-<hash>.js`) with the last one you explored. If it changed, re-explore the screens and diff the labels against `REPORT_PAGES` / `LEAD_REPORT_TABS` in `locators.ts`.

**Page tests (`tests/pages/` + `tests/modules/`): the Page Object Model layer, one spec per hub card.** `BasePage` provides KPI reads, error watching and broken-value checks. `ReportModulePage` adds the period, custom dates, filters, views, reset, tabs and `table(heading)` → `ReportTable` (rows, column sums, export) shared by the 10 `/reports/*` modules. There is one subclass per card, declaring its route, `filters` (by first option), `mainKpi` and named tables. `ExecutiveReportsPage` (the dashboard at `/`) and `ReportsHubPage` extend `BasePage` directly. Page objects take locator strings from `locators.ts`, so don't write selectors in page classes or specs. `pages/fixtures.ts` injects page objects as fixtures (`async ({ hub, sales }) => …`) and provides `expected('…')` for the report's Expected Result. `modules/checks.ts` holds the 11 common module checks; each spec calls them under its own IDs (`SAL-01`…`SAL-11`) and adds page-specific tests from `-12`. Each spec's describe is tagged `@pages` plus `@<page>-reports`; npm scripts `test:<page>-reports` run one page. The reporter maps the ID prefixes (HUB, LDR, SAL, INV, CUS, BRK, MKT, RES, SPA, COL, EXE, EXC) to `Page · <name>` through `PAGE_TESTS` in `test-catalog.ts`. A new page needs four things: a page class, a fixture, a spec, and an entry in `PAGE_TESTS` and the npm scripts.

**Lead Reports workbook (`tests/lead-reports/`).** This automates every sheet of `Testcase/Lead_Reports_Test_Cases.xlsx`. `catalog.ts` reads the sheets at runtime. Declare tests with `test(...lr('LR-044'), …)`, which takes its title and expected result from the sheet. Use `lrSkipped()` for cases that need extra accounts, `lrMap(n)` for Clickable Map row n, `lrObs('OBS-nn')` for observations, and `lrDdv()` for the drill-down sweep. `coverage.spec.ts` fails when a sheet ID has no test, so add the test when you add a row. The page objects are `LeadReportsPage`, plus `LeadDrill` (the drill-down list: `openFrom`/`verify`, which compares clicked = header = rows = export and checks the bucket rules taken from the page's own definitions) and `LeadTable` (tables with Total and "Company average" rows). **Never hard-code figures.** Derive the expected value from the page: another KPI, a column sum, a drill-down, or a different period. Look rows up by the `Row` object (position), not by name, because two salespeople share a name. The reporter maps `LR-*` IDs to `Lead Reports · <Tab>`, using the sheet's steps and expected result.

**Customer Reports workbook (`tests/customer-reports/`).** This automates `Testcase/Customer_Reports_Test_Cases.xlsx` (Test Cases, Clickable Map, Observations) the same way as Lead Reports: `catalog.ts` reads the sheets, and tests are declared with `cr('CR-044')`, `crMap(n)`, `crObs('OBS-nn')` or `crSkipped()`. `coverage.spec.ts` fails when a sheet ID has no test. The page object is `CustomerReportsPage` (module tab bar, `breakdowns` = the 3 tables with their grouping column, `newCustomers`, `setFilterIndex` for options that share a label). Only "New in period" and the New Customers list follow the period; the other cards and table columns are all-time. Checks that compare tables with the list (`openWithFullList`) need a period where the list holds every customer, and skip otherwise. The Customer ID link opens the customer's Edit Customer form on `/customers`: close it, never save. The reporter maps `CR-*` IDs to `Customer Reports · <Area>`.

**Report-module workbooks (`tests/module-workbooks/` + `tests/{broker,marketing,reservation,spa,collection,exception,executive}-reports/`).** `Testcase/<Page>_Reports_Test_Cases.xlsx` have an extra "Automation key" column. `module-workbooks/catalog.ts` reads a workbook (`readWorkbook(file, prefix, tag)` → `tc(id)`, `key(key)`, `mapKey(key)`, `obs(id)`, `skipped()`). `common.ts` `declareCommon(WB, CFG)` declares a test for every row whose key is common (`general:…`, `tabs:…`, `views:…`, `period:…`, `custom:…`, `filter:<label>:options|narrows`, `filters:…`, `cards:…`, `table:<heading>:total|export|not-links`, `nf:…`), every generic Clickable Map row (`map:…`, `map:cells:<A>|<B>`, `map:export:<A>|<B>`) and every observation of kind "defect" whose related check is common; `declareCoverage()` fails when any row has no test. The page config (`ModuleConfig` in `workbook.ts`) lists the cards (kind, follows the period or not), filters (query parameter) and tables (Total sums, Total-row cells that equal cards, record links). Page-only rows use `page:…` keys and live in the page spec. To add a module: add its page to the workbook generator, write `workbook.ts` (config) and a spec with its `page:…` checks. Tests declared by `common.ts` show `module-workbooks/common.ts` as their location. Config flags: `sum` (an amount card that adds up, so it narrows like a count), `main` (the figure that shows whether there is data), `futurePeriods` (period based on due dates: This month / quarter include future dates), `capped` (list shows "Showing N of M"; the export has all M). Export files carry the app's UTC date (`todayInFileName()`). The Executive dashboard (`/`) opens on "Commercial / Sales Dashboard" since build 1710; `ExecutiveReportsPage.open()` switches to Executive Operations, `openView()` to any view; the snapshot views have no CSS classes, so `XP.dashboardLabel` / `dashboardHeading` match their text ignoring case. Never click Data Movement, AI Insights or Edit Targets.

**Workbook scenarios (`tests/scenarios/`).** The 133 scenarios in `Testcase/Reports_Analytics_Test_Scenarios.xlsx` are a separate layer from the core suite. `catalog.ts` reads the workbook at runtime, and test titles come from it through `sc(id)`. Declare each scenario with `scenario(id, expected, fn)` (tag `@scenario`, plus an `expected` annotation that the Excel reporter shows as the Expected Result) or with `manual(id, reason)` (Skipped, tag `@manual`). Every workbook ID must appear exactly once. The reporter maps `RA-###` IDs to the module `Scenario · <Test Area>`. Scenario tests set the report period explicitly with `openReport(page, path, period)`, because modules currently default to Last 12 months, not This month.

**Leads page suite (`tests/leads-page/`).** This automates use cases HLUC-01 (create Individual lead), HLUC-02 (create Corporate lead) and HLUC-03 (lead counts) from `Testcase/Leads_Page_Test_Cases.xlsx` (IDs `LP-001`…`LP-080`). Run it with `npm run test:leads-page`. Unlike the report suites, it **creates data**: new leads, and on its own leads it also assigns, qualifies, disqualifies and converts. Every value it types or expects comes from `TestData/Leads_Test_Data.xlsx` (or `TestData/csv/*.csv` with `TEST_DATA_FORMAT=csv`), read by `test-data.ts`:
- names and companies, with mobile/email patterns (`#` = random digit; `{first}` `{last}` `{unique}`);
- form-field labels → field names, plus the Mandatory flags;
- invalid values with their expected messages (each row becomes a sub-case `LP-005.n`);
- the app's messages;
- tab rules;
- the expected +1/-1/0 of every count per action.

**Don't hard-code values in specs; add them to the data file.** Both copies come from `scripts/build_leads_testdata.py` (the workbook from `scripts/build_leads_page_workbook.py`), so regenerate rather than editing one copy. Names must be letters only, because the app rejects digits.

Other conventions in this suite:
- Declare tests with `test(...lp('LP-011'), …)`, or `lpRow(id, n, …)` for data rows.
- `create-lead.ts` declares the create, validation and duplicate tests for both forms; the two spec files only pass their IDs.
- Page objects: `LeadsPage` (tabs, cards, search, rows, `snapshot()`), `LeadForm` (fields by label, `submit()` → pop-up and saved flag), `LeadDetail` (assign, qualify, disqualify, convert), `Notice` (pop-ups, date picker).
- Anything that saves a lead runs inside `withLeadsLock` (a lock directory under `.auth/`), so the count-update tests can compare before and after counts while other workers run.
- `coverage.spec.ts` fails when a sheet ID has no test.

**Lead Detail suite (`tests/lead-detail/`).** This automates the Lead Detail panel (opened from a Lead No.) from `Testcase/Lead_Detail_Test_Cases.xlsx` (IDs `LDP-001`…`LDP-112`): Copy link, summary, workflow, Change Status (disqualify / move back), Assign, Qualify (checklist, dropdown combinations, score), conversion to an opportunity, Status / Owner History, and Log call / Add task / Add meeting (validations, combinations, edit, Mark done / Reopen, Tasks & Calendar page, Tasks & Calls export). Run it with `npm run test:lead-detail`; a full run takes about 40 minutes and creates about 45 leads. Values come from `TestData/Lead_Detail_Test_Data.xlsx` (or `TestData/csv/Lead_Detail/` with `TEST_DATA_FORMAT=csv`), built by `scripts/build_lead_detail_testdata.py`; the workbook is built by `scripts/build_lead_detail_workbook.py`. The leads themselves come from the Leads page data. `"(me)"` in the data means the signed-in user.
- `dataBook(xlsx, csvDir)` (in `leads-page/test-data.ts`) and `makeCatalog(workbook, tag)` (in `leads-page/catalog.ts`) are the shared reader and catalog; use them for a new page suite.
- `freshLead()` creates a lead for a test that changes it; `workerLead()` reuses one lead per worker for tests that only read or add their own calls / tasks.
- Page objects: `LeadDetail` (summary, `statusChip`, `workflow`, `copyLink`, `changeStatus`, `scoreBreakdown`, `activities` / `waitActivity`), `ActivityDialog` (call / task / meeting form, fields by label, date fields by input name, `dayStates`), `TasksPage` and `OpportunitiesPage`.
- Since v2.0 (build 2410-02, bundle `index-BooLMKHo.js`) the panel shows an identity card ("<Lead No.> · Assigned to <owner>", pill "Status: X · Score N"; read them with `owner()` / `statusChip()`), "Next action" cards instead of Now / Next for an active lead, "Reassign lead" (Assign to + optional reason), a confirmation on Disqualify and a Reopen Lead form for disqualified leads. History entries span two lines; `historyEntries()` joins them with " · ". The workbooks' Change Log sheets list what changed and which cases were updated.
- App behaviour to know: dropdowns load after a form opens ("Loading…"), so read options by `textContent` after they load; the Tasks & Calls list refreshes a moment after a change (`waitActivity`); after qualifying, the Score field and Recalculate button disappear (read the score from Status History or the list); only the lead's owner can qualify it; saves can take more than 20 s on QA under load.

**Security suite (`tests/security/`).** This automates `Testcase/Security_Test_Cases.xlsx` (IDs `SEC-001`…`SEC-079`) for five areas:
- login and sessions;
- RBAC and permissions;
- password management and admin reset;
- PII masking;
- the login-activity audit.

Run it with `npm run test:security`.

**Test users and roles.** The suite **creates test users** (Users & Roles → New User) from the Test Users sheet of `TestData/Security_Test_Data.xlsx` (proper names; username, email and mobile unique per run). It retires them at the end of each test (login disabled, status Inactive). It edits only one role: the one named by the Test Role Code setting ("Lead Desk Viewer"). Never point these tests at the admin account or the existing QA users: lockout, reset, disable and sign-out tests act on the user they sign in.

**Fixtures and helpers.**
- `sec` fixture: the admin page plus `makeUser(dataId)`.
- `signIn(browser, baseURL, user)`: opens a separate signed-out browser and completes the first-time password change (an admin-set password forces one).
- `withUsersLock`: serialises user creation and user counts.
- Passwords come from the Password Pattern setting at run time and are never written to notes or reports.

**Manual cases.** OTP / reset-code entry and the 60-minute idle timeout are reported as Skipped. The generators are `scripts/build_security_testdata.py` and `scripts/build_security_workbook.py`. Page objects are in `tests/pages/SecurityPages.ts`: `LoginPage`, `ChangePasswordDialog`, `AccountMenu`, `UsersPage` / `UserEditor`, `RolesPage`, `AuditLogPage` and `PreferencesPage`.

**Inventory, Proposals and SPA / Sales Contracts suites (`tests/inventory-page/`, `tests/proposals-page/`, `tests/contracts-page/`).** Three separate modules, each with its own workbook, data file and report:

| Suite | Workbook | Data | IDs | Run |
|---|---|---|---|---|
| Inventory | `Testcase/Inventory_Page_Test_Cases.xlsx` | `TestData/Inventory_Test_Data.xlsx` (`csv/Inventory/`) | `IVP-` | `npm run test:inventory-page` |
| Proposals | `Testcase/Proposals_Page_Test_Cases.xlsx` | `TestData/Proposals_Test_Data.xlsx` (`csv/Proposals/`) | `PRO-` | `npm run test:proposals-page` |
| SPA / Sales Contracts | `Testcase/SPA_Contracts_Page_Test_Cases.xlsx` | `TestData/Contracts_Test_Data.xlsx` (`csv/Contracts/`) | `SPC-` | `npm run test:contracts-page` |
| Opportunities (List, Board, Hold a Unit, Mark Lost) | `Testcase/Opportunities_Page_Test_Cases.xlsx` | `TestData/Opportunities_Test_Data.xlsx` (`csv/Opportunities/`) | `OPP-` | `npm run test:opportunities-page` |
| Reservations (register & cards, cancellation, ERP sync) | `Testcase/Reservations_Page_Test_Cases.xlsx` | `TestData/Reservations_Test_Data.xlsx` (`csv/Reservations/`) | `RSV-` | `npm run test:reservations-page` |

- Generators: `scripts/build_<inventory|proposals|contracts|opportunities|reservations>_page.py` build both the workbook and the data file (shared helpers and the deal-chain sheets live in `scripts/sales_modules_common.py`). Regenerate rather than editing one copy.
- Each suite runs on **one worker, in file order**. Tests share records through module-level promises (`createdProject`, `reservedDeal`, `acceptedDeal`, the workflow proposal / main contract), and each workflow test first brings its record to the status it needs, so one failure does not block the rest.
- Shared code in `tests/sales-chain/`: `data.ts` (`moduleData()` reader; `fill()` placeholders `#`, `{seq}`, `{project}`, `{unique}`, `{list-N%}`), `inventory.ts` (`testProject()`, `createUnit()`, `findUnit()`, `withSalesLock()` around count checks) and `deal.ts` (`DealChain`: buyer lead → qualify → opportunity → site visit → Reservation Ready → reservation on a **new unit of the test project** → approval → proposal → accept → KYC). Page objects in `tests/pages/SalesPages.ts`: `ModulePage` (cards, tabs, register rows, pager, search, status filter, export), `ModalForm` (forms by field `name`), `RecordPanel` (detail panels: summary tiles, workflow, "Next action" states, `act()`), `UnitPicker`, `CustomerKyc`, `PipelineBoard` (Opportunities → Board: columns, cards, move menus, Owner / Project filters).
- Opportunities: the run's deal ends Lost; its new test unit is held first (Inventory → Holds, read with "Whose holds" = All, "Show" = Active) and must be released by Mark Lost. Reservations: the run's approved reservation is cancelled at the end. On the Reservations page the register is the last table (the "Pending My Approval" table sits above it).
- Data rules: real Palm Exotica units are never reserved (every deal gets a new unit in the "Coral Bay Residences" test project, created once if missing); buyers use the fictional UK mobile range +44 7700 900xxx and example.* emails because the app sends WhatsApp / email confirmations; the KYC sample is `TestData/files/Sample_Passport_Copy.pdf` (also used as the contract document / product and unit media upload; `Sample_Not_Allowed.txt` is the file that must be refused). Never click "⚡ Recalculate All" (was "Recalculate All Units Live") on the Pricing Matrix or "⚡ Recalculate Pricing Matrix" in a unit's Sales section. Since build 0111-11 Building View is the Stack Plan inside Availability Summary (`AvailabilitySummary` page object: summary line, Summary Table with the block name in a `th` and Grand Total in its own row group, Stack Plan chips and unit cells); the unit view is `UnitView` (sections Identification … Linked Modules) and Floor Plans & Media is `MediaPanel` (the saved virtual tour shows as an "Open virtual tour" link: read its href). Project Deactivate uses a native confirm (`ModulePage.rowAction` accepts it). Reservation approval, Move to Handoff and Send to ERP sync test records to the QA ERP (agreed).
- The reporter maps `IVP-` / `PRO-` / `SPC-` / `OPP-` / `RSV-` through `PAGE_SUITES` in `test-catalog.ts` (`Inventory Page · <Area>` …). Security testing is out of scope for these modules.

**Readable failures.** `reporter/excel-reporter.ts` `humanize()` turns every assertion into "<check> — Expected: … Actual: …" (timeouts and network errors in plain words), and the Defects sheet's Steps to Reproduce end with "Data used in this run" (annotations whose type mentions test data / created / user / record). Give every `expect` a message that names what is checked, and `note()` the data a test typed or created, so a failure can be repeated by hand.

**Login.** The access token lasts 15 minutes and the app rotates its refresh token on use, so browsers that share one saved session log each other out once the token expires. Specs therefore import `test` from `tests/auth.ts` (which re-exports everything else from `@playwright/test`). Its `storageState` fixture gives each worker its own login in `.auth/worker-N.json` (gitignored), and logs in again when less than 3 minutes of the token are left. `tests/global-setup.ts` still writes `auth.json`, which is used only when `CRM_USERNAME`/`CRM_PASSWORD` are missing. In a new spec, import `test` from `./auth` or `../auth`, never from `@playwright/test`. For an extra browser context, pass it the `storageState` fixture, not `auth.json`.

**Database safety.** Every DB connection (`tests/db.ts`, `scripts/pg.mjs`) runs `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`. Keep it that way. Target the QA database only.

## Gotchas

- `auth.json`, `.env`, `reports/`, `test-results/` and `db-schema.md` are gitignored. If `auth.json` is missing or expired, every test fails at login. Re-run `npm run login`.
- On the Leads page the pager ("Page 1 of 25 · 615 leads") is hidden when there are 25 results or fewer. `listCount` then counts rows that contain `a.crm-record-link`.
- KPIs briefly show `—` (or `0` after a reload) while loading. Always read them through the helpers, which wait for a real value.
