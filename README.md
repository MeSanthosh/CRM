# CRM Reports & Analytics – automated count checks

Playwright suite for qa-crm.asquareab.com: **82 tests** that validate every count on the
Reports & Analytics hub, the 10 report modules, the Executive Dashboard and the Leads page,
check that the same metric agrees across pages, and (optionally) compare the UI with PostgreSQL.

## One-time setup
```bash
npm install
npx playwright install chromium
npm run login        # a browser opens → log in → close it. Saves auth.json
```

## Run
```bash
npm test                          # everything, 4 in parallel, headless
npx playwright test consistency   # only the cross-page checks
npm run test:headed               # watch it run
npm run report                    # HTML pass/fail report (values shown as annotations)
```

## Page tests: one spec per hub card (Page Object Model)
The Reports & Analytics hub lists 11 cards. Each card's page has its own page object in `tests/pages/`
and its own spec in `tests/modules/`, so you can run one page at a time:

| Page | Run it | Test IDs | Page object |
|---|---|---|---|
| Reports & Analytics hub | `npm run test:hub` | HUB-01… | `ReportsHubPage` |
| Lead Reports | `npm run test:lead-reports` | LDR-01… | `LeadReportsPage` |
| Sales Reports | `npm run test:sales-reports` | SAL-01… | `SalesReportsPage` |
| Inventory Reports | `npm run test:inventory-reports` | INV-01… | `InventoryReportsPage` |
| Customer Reports | `npm run test:customer-reports` | CUS-01… | `CustomerReportsPage` |
| Broker Reports | `npm run test:broker-reports` | BRK-01… | `BrokerReportsPage` |
| Marketing Reports | `npm run test:marketing-reports` | MKT-01… | `MarketingReportsPage` |
| Reservation Reports | `npm run test:reservation-reports` | RES-01… | `ReservationReportsPage` |
| SPA Reports | `npm run test:spa-reports` | SPA-01… | `SpaReportsPage` |
| Collection Reports | `npm run test:collection-reports` | COL-01… | `CollectionReportsPage` |
| Executive Reports (dashboard) | `npm run test:executive-reports` | EXE-01… | `ExecutiveReportsPage` |
| Exception Reports | `npm run test:exception-reports` | EXC-01… | `ExceptionReportsPage` |

`npm run test:pages` runs all of them; `npx playwright test -g "SAL-12"` runs one test.

Every report module page gets the same 11 checks (-01 to -11): it opens from its hub card, KPIs are valid,
tables render without errors, every period reloads, it opens on This month, custom dates, filters narrow
the results, All ≥ Team ≥ Mine, Reset filters, panel exports match the tables, tab bar and breadcrumb.
From -12 on are that page's own checks (its tables add up to its KPIs, its formulas, its lists).
In the Excel report these tests appear under modules named `Page · <page name>`.

## Lead Reports test cases (Testcase/Lead_Reports_Test_Cases.xlsx)
Every sheet of the Lead Reports workbook is automated in `tests/lead-reports/`:

| Sheet | Tests | Spec |
|---|---|---|
| Test Cases | LR-001 … LR-166, one test each, titled from the sheet | `general-tabs`, `filters-views`, `filter-combinations`, `filter-counts`, `overview`, `drill-down`, `source-channel`, `aging`, `qualification`, `scorecard`, `cross-page` |
| Drill-down Verification | LR-DDV-01 … 13: every count link on the page, live | `drill-verification.spec.ts` |
| Clickable Map | LR-MAP-01 … 32: each element is (or is not) clickable and does what the sheet says | `clickable-map.spec.ts` |
| Observations | LR-OBS-01 … 13: defects fail until fixed; questions record the current behaviour | `observations.spec.ts` |
| (all) | LR-COV-01 fails if any test case in the sheet has no test | `coverage.spec.ts` |

```bash
npm run test:lead-workbook                       # everything above (the drill-down verification takes ~15 min)
npx playwright test tests/lead-reports -g "LR-044"
npx playwright test tests/lead-reports --grep-invert LR-DDV   # skip the long drill-down sweep
```

No report figure is hard-coded: every expected value is read from the page and checked against its
relationship (rates = part ÷ Leads Captured, rows add up to the Total row, every drill-down lists exactly
the number clicked, exports match the screen, "as of today" figures don't move with the period, …).
Test names, steps and expected results in the Excel report come from the workbook, so edit them there.
## Sales Reports test cases (Testcase/Sales_Reports_Test_Cases.xlsx)
The "Test Cases" sheet (SR-001 … SR-132) is automated in `tests/sales-reports/`, one test per case, titled from the sheet:

| Area | Tests | Spec |
|---|---|---|
| General, Views | SR-001 … SR-016 | `general-views.spec.ts` |
| Period filter, Dropdown filters, Reset filters | SR-017 … SR-053 | `filters.spec.ts` |
| KPI cards, the three tables, Export | SR-054 … SR-081 | `tables-export.spec.ts` |
| Number matching | SR-082 … SR-109 | `number-matching.spec.ts` |
| Data changes, Cross-page, Non-functional | SR-110 … SR-132 | `cross-page-nonfunctional.spec.ts` |
| (all) | SR-COV-01 fails if a test case in the sheet has no test | `coverage.spec.ts` |

```bash
npm run test:sales-workbook
npx playwright test tests/sales-reports -g "SR-092"
```

Skipped on purpose (they show as Skipped with the reason): SR-011 and SR-016 need extra accounts, SR-101 needs
won dates the page doesn't show, SR-110 … SR-117 change QA data. SR-129 waits 16 minutes for the token to expire:
run it with `SALES_LONG=1`. SR-126's time limits come from the workbook (3 s / 2 s): override them with `SALES_PAGE_MS` / `SALES_FILTER_MS`.
As with Lead Reports, expected figures come from the page itself. Amount checks allow each shown value's rounding (at least 0.5%).
Counts must match exactly.

## Opportunities test cases (Testcase/Opportunities_Test_Cases.xlsx)
The 12 use cases in `Testcase/Asquare_CRM_Opportunities_Use_Cases.xlsx` (UC-OPP-001 … 012) name their test IDs
(OPP-001 … OPP-059) without describing them. `Testcase/Opportunities_Test_Cases.xlsx` writes each one out — use case,
preconditions, steps, test data, expected result, type, priority, status — plus OPP-060 (UC-OPP-003's "record missing"
exception), with a Summary sheet and an Observations sheet. Every test case is automated in `tests/opportunities/`,
and test names, steps and expected results are read from that sheet, so edit the wording there.

| Use cases | Tests | Spec |
|---|---|---|
| View (001), View Details (003), Won record (008), read-only parts of Create/Edit/Delete | OPP-001…008, 018…020, 024, 039, 054, 060 | `view.spec.ts` |
| Search (005), Filter and Sort (006) | OPP-027 … OPP-037 | `search-sort.spec.ts` |
| Board view: toolbar, column and summary totals, cards vs List, days in stage, Reserved tag, search, export, Won/Lost Show/Hide, move menu, Mark as Lost dialog | OPP-061 … OPP-073 | `board.spec.ts` |
| Convert/Create (002, 010), Change Stage (007), Edit notes (004), Mark Lost (009), closed records (008/011/012); then the Board flow (new card, refused drag, Lost without reason, Mark as Lost from the Board) | the rest, incl. OPP-074 … OPP-078 | `lifecycle.spec.ts` |
| Role-Based Access (012) | OPP-057 … OPP-059 | `access.spec.ts` |
| (all) | OPP-COV-01 fails if a test case on the sheet has no test, or the two workbooks disagree | `coverage.spec.ts` |

```bash
npm run test:opportunities
npx playwright test tests/opportunities -g "OPP-038"
npx playwright test tests/opportunities --grep @uc-opp-007     # one use case
```

**`lifecycle.spec.ts` changes QA data on every run.** It converts two leads from the Leads › Ready to Convert tab (one for the main flow, one for the Board flow, which runs after it so their "+1" counts don't overlap). The first
into an opportunity, schedules a virtual site visit (next month, the 15th), adds a note, then marks it Lost with
reason "No Decision". Remarks start with "Automated test - Opportunities lifecycle". Its tests run in order in one
worker and pass the lead/opportunity along in `test-results/opportunity-lifecycle.json`; if the conversion fails,
the tests that need the opportunity are skipped.

The app has no "Add Opportunity" form, no edit form and no delete: opportunities are created from a qualified lead,
change through workflow actions, and close as Won (when a proposal is accepted) or Lost. So OPP-020 (edit fields) and
OPP-059 (other roles: needs more accounts) are Skipped with the reason, and the delete use case is checked as
"refused and the record kept".

## Unit Reservations test cases (Testcase/Reservations_Test_Cases.xlsx)
The "Test Cases" sheet (UR-001 … UR-069) is automated in `tests/reservations/`, one test per case, titled from the sheet
(the Summary and Observations sheets hold the counts and the findings):

| Area | Tests | Spec |
|---|---|---|
| List & cards, Detail | UR-001 … UR-008, UR-017 … UR-024 | `view.spec.ts` |
| Search & sort | UR-009 … UR-016 | `search-sort.spec.ts` |
| New Reservation form, unit picker, required-field checks (nothing saved) | UR-025 … UR-030, UR-064, UR-065 | `create-form.spec.ts` |
| Export (file name, columns, rows, search / card filter, empty list) | UR-059 … UR-063 | `export.spec.ts` |
| Create, documents, replace, approve, cancel, positive / negative saves of the required fields | UR-031 … UR-052, UR-056 … UR-058, UR-066 … UR-069 | `lifecycle.spec.ts` |
| Access | UR-053 … UR-055 | `access.spec.ts` |
| (all) | UR-COV-01 fails if a test case on the sheet has no test | `coverage.spec.ts` |

```bash
npm run test:reservations
npx playwright test tests/reservations -g "UR-034"
npx playwright test tests/reservations --grep-invert Lifecycle   # skip the tests that change QA data
```

**`lifecycle.spec.ts` changes QA data on every run and sends an ERP sync.** It converts one Ready to Convert lead,
takes it to Reservation Ready (visit → complete visit → negotiation notes), creates a reservation, uploads and deletes
documents, replaces it with another unit, **approves** the replacement (which sends the deposit sync to ERP) and then
cancels it, so no unit stays held. After that, UR-066 … UR-069 try saving with a negative amount, a non-numeric amount and no expiry
(each wrongly accepted reservation is cancelled at once), then create one with only the required fields and cancel it. UR-052 also cancels anything an earlier failed step left active. Remarks start with
"Automated test - Reservations lifecycle". Skipped on purpose: UR-055 (other roles), UR-056 (needs a signed contract),
UR-057 (Proposals module), UR-058 (on-demand ERP retry).

## Customers & Brokers test cases (Testcase/Customers_Brokers_Test_Cases.xlsx)
The "Test Cases" sheet (CB-001 … CB-045) is automated in `tests/customers-brokers/`, titled from the sheet
(IDs use `CB-` because `CUS-` / `BRK-` belong to the Customer / Broker Reports page tests):

| Area | Tests | Spec |
|---|---|---|
| Workspace cards and tabs | CB-001 … CB-005 | `workspace.spec.ts` |
| Customer Register, customer detail, edit validation (nothing saved) | CB-006 … CB-023 | `customers.spec.ts` |
| Broker Register, New Broker validation (nothing saved) | CB-030 … CB-038 | `brokers.spec.ts` |
| Customer edit, KYC upload / delete, test broker create-or-reuse and edit | CB-024 … CB-029, CB-039 … CB-041, CB-045 | `lifecycle.spec.ts` |
| Access | CB-042 … CB-044 | `access.spec.ts` |
| (all) | CB-COV-01 fails if a test case on the sheet has no test | `coverage.spec.ts` |

```bash
npm run test:customers-brokers
npx playwright test tests/customers-brokers --grep-invert Saves   # skip the tests that change QA data
```

**`lifecycle.spec.ts` changes QA data and puts it back.** It adds " [automated test edit]" to one customer's Remarks
and restores the original, uploads a Passport KYC PDF and deletes it, and edits the test broker's City / Remarks and
restores them (through the form, with an API fallback in `finally`). Creating a broker also creates a broker portal
login, so the suite creates **one** "Automated test broker …" and reuses it afterwards (CB-040, the credentials
dialog, only runs when that broker is created). Skipped on purpose: CB-044 (other roles), CB-045 (KYC Verify /
Reject would change a real customer's review status).

## Brokers & Channels test cases (Testcase/Brokers_Channels_Test_Cases.xlsx)
The "Test Cases" sheet (BC-001 … BC-018) is automated in `tests/brokers-channels/hub.spec.ts` (plus `coverage.spec.ts`).
The page only reads data, so the tests change nothing on QA. Its figures are checked against independent sources:
Total / Active Brokers against Customers & Brokers, Registered brokers against the newest rows of the Broker Register,
and Lead Sources / Top capture channels against the Leads export (leads created this month).

```bash
npm run test:brokers-channels
npx playwright test tests/brokers-channels -g "BC-009"
```

## Construction Updates test cases (Testcase/Construction_Updates_Test_Cases.xlsx)
The "Test Cases" sheet (CU-001 … CU-042) is automated in `tests/construction-updates/`:

| File | Test cases | Changes QA data? |
|---|---|---|
| `list.spec.ts` | CU-001…015: page, help panel, list, status / project filters, search | No |
| `form.spec.ts` | CU-016…025: detail panel, New draft / Edit forms, required-field validation | No (checks that no save request is sent) |
| `api.spec.ts` | CU-026…030: backend login, not-found and validation errors, filter endpoints | No (the two invalid creates must be refused) |
| `lifecycle.spec.ts` | CU-031…039: save, edit, portal visibility, photos, publish / unpublish; CU-040…042 manual (Skipped) | **Yes** |
| `coverage.spec.ts` | CU-COV-01: every workbook ID has exactly one test | No |

Updates cannot be deleted, so the lifecycle keeps one draft, "Automated test update - do not publish". It is created
on the first run and reused afterwards, with portal visibility left off so no customer sees it or is messaged.
Each step removes the photos it uploaded and unpublishes the draft again. The "Observations" sheet lists the defects
found (Publish returns HTTP 500; non-image files are accepted as photos; …).

```bash
npm run test:construction-updates                    # whole module
npx playwright test -g "CU-011"                      # one test case
npx playwright test --grep @cu-filters-search        # one area (@cu-page, @cu-list, @cu-detail-panel, @cu-validation, @cu-api, @cu-lifecycle, @cu-manual)
npx playwright test tests/construction-updates/list.spec.ts   # one file
```

## Workbook scenarios (RA-001 … RA-133)
The 133 scenarios in `Testcase/Reports_Analytics_Test_Scenarios.xlsx` are automated in `tests/scenarios/`,
separately from the core suite:

```bash
npm run test:scenarios                 # only the workbook scenarios (tag @scenario)
npm run test:core                      # only the original suite
npx playwright test -g "RA-013"        # one scenario
npx playwright test --grep @manual     # list the scenarios that stay manual
```

- Test titles use the workbook's ID and wording; edit the wording in the workbook, not in the tests.
- In the Excel report they appear under modules named `Scenario · <Test Area>`.
- Scenarios that need data changes, other user roles, a load-testing tool or an approved design
  are registered as **Skipped** with the reason ("Manual: …"), so every ID is accounted for.
- Load-time budgets: `PERF_BUDGET_MS` (default 5000) and `PERF_EXPORT_MS` (default 30000) in `.env`.

## Excel defect report (automatic)
Every `npm test` ends by writing **`reports/CRM_Defect_Report_<date>_<time>.xlsx`** (path printed at the end of the run):

| Sheet | Contents |
|---|---|
| Summary | Run date, environment, pass/fail/skip totals, pass rate, defects by severity and by module |
| Defects | One row per failed test case: Defect ID, Test Case ID, module, page URL, severity, priority, category, steps to reproduce, expected, actual, observed values, possible cause, screenshot (embedded), evidence links, error details, plus **Status / Assigned To / Dev Comments** for the dev team |
| All Results | Every test case with status, duration and a one-line failure summary |

Wording of steps, expected results, severity and hints lives in `tests/test-catalog.ts`.
Keep the `test-results` folder next to `reports` when sharing, so the screenshot links work
(or zip both folders). Set `EXCEL_REPORT_DIR` to write the report somewhere else.

## Test files
| File | What it checks |
|---|---|
| `tests/reports.spec.ts` | Hub: 8 snapshot cards valid, match the API, stable on reload, no errors; 11 module cards open the right page; every KPI and table on each module renders |
| `tests/leads.spec.ts` | Total = badge = pager; Assigned + Unassigned = Total; each tab badge = rows; Individual + Corporate = All; 10 statuses sum to Total; search; pagination; export rows; Active Leads formula |
| `tests/consistency.spec.ts` | Same metric on every page (X-01…X-16) and math inside pages (M-01…M-08: totals, %, sums of table columns) |
| `tests/db.spec.ts` | UI vs PostgreSQL (needs `.env`) |
| `tests/test-catalog.ts` | Module, severity, steps and expected result for every test case ID (used by the Excel report) |
| `reporter/excel-reporter.ts` | Builds the Excel defect report |
| `tests/locators.ts` | All locators (XPath + CSS), page routes, card labels |
| `LOCATORS.md` | The same locators as a reference table, for Selenium or manual use |

## Connect PostgreSQL (UI vs database)
```bash
cp .env.example .env     # QA host, db, read-only user, password
npm run db:check         # ✔ Connected
npm run db:discover      # writes db-schema.md (structure + status values, no personal data)
npm run test:db
```
Every DB session is forced read-only. SQL lives in `tests/db-queries.ts`; table names are
guesses until mapped from `db-schema.md`.

## When the UI changes
Fix the locator once in `tests/locators.ts`. To find a new one:
`npx playwright codegen https://qa-crm.asquareab.com --load-storage=auth.json`
