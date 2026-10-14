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
| Test Cases | LR-001 … LR-146, one test each, titled from the sheet | `general-tabs`, `filters-views`, `overview`, `drill-down`, `source-channel`, `aging`, `qualification`, `scorecard`, `cross-page` |
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
