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

**Test IDs drive the Excel report.** Every test title must start with a case ID (`RA-01`, `X-05`, `M-03`, `RA-MOD-01`, `DB-L-10`, …). `reporter/excel-reporter.ts` reads the ID from the title (regex `^[A-Z]+(-[A-Z]+)*-\d+`) and looks up module, severity, steps and expected result through `caseInfo()` in `tests/test-catalog.ts`. **When you add a test, add a matching catalog entry** so its defect row has real steps. The reporter writes `reports/CRM_Defect_Report_<date>_<time>.xlsx` (or to `EXCEL_REPORT_DIR`) and embeds failure screenshots from `test-results/`. Values recorded with `test.info().annotations` appear in the report's "observed values" column.

**Conventions in specs:**
- Use `expect.soft` when a test checks several values, so one run reports all of them.
- Use `test.skip(cond, reason)` for data-dependent cases (for example, zero SPAs in the period).
- Report modules open on "Last 12 months", while the hub and dashboard always show "This month". Cross-page comparisons (`consistency.spec.ts`, scenarios) switch each module to "This month" before reading it.
- To check a new release for UI changes, compare the frontend bundle name in the page source (`assets/index-<hash>.js`) with the last one you explored. If it changed, re-explore the screens and diff the labels against `REPORT_PAGES` / `LEAD_REPORT_TABS` in `locators.ts`.

**Page tests (`tests/pages/` + `tests/modules/`): the Page Object Model layer, one spec per hub card.** `BasePage` provides KPI reads, error watching and broken-value checks. `ReportModulePage` adds the period, custom dates, filters, views, reset, tabs and `table(heading)` → `ReportTable` (rows, column sums, export) shared by the 10 `/reports/*` modules. There is one subclass per card, declaring its route, `filters` (by first option), `mainKpi` and named tables. `ExecutiveReportsPage` (the dashboard at `/`) and `ReportsHubPage` extend `BasePage` directly. Page objects take locator strings from `locators.ts`, so don't write selectors in page classes or specs. `pages/fixtures.ts` injects page objects as fixtures (`async ({ hub, sales }) => …`) and provides `expected('…')` for the report's Expected Result. `modules/checks.ts` holds the 11 common module checks; each spec calls them under its own IDs (`SAL-01`…`SAL-11`) and adds page-specific tests from `-12`. Each spec's describe is tagged `@pages` plus `@<page>-reports`; npm scripts `test:<page>-reports` run one page. The reporter maps the ID prefixes (HUB, LDR, SAL, INV, CUS, BRK, MKT, RES, SPA, COL, EXE, EXC) to `Page · <name>` through `PAGE_TESTS` in `test-catalog.ts`. A new page needs four things: a page class, a fixture, a spec, and an entry in `PAGE_TESTS` and the npm scripts.

**Lead Reports workbook (`tests/lead-reports/`).** This automates every sheet of `Testcase/Lead_Reports_Test_Cases.xlsx`. `catalog.ts` reads the sheets at runtime. Declare tests with `test(...lr('LR-044'), …)`, which takes its title and expected result from the sheet. Use `lrSkipped()` for cases that need extra accounts, `lrMap(n)` for Clickable Map row n, `lrObs('OBS-nn')` for observations, and `lrDdv()` for the drill-down sweep. `coverage.spec.ts` fails when a sheet ID has no test, so add the test when you add a row. The page objects are `LeadReportsPage`, plus `LeadDrill` (the drill-down list: `openFrom`/`verify`, which compares clicked = header = rows = export and checks the bucket rules taken from the page's own definitions) and `LeadTable` (tables with Total and "Company average" rows). **Never hard-code figures.** Derive the expected value from the page: another KPI, a column sum, a drill-down, or a different period. Look rows up by the `Row` object (position), not by name, because two salespeople share a name. The reporter maps `LR-*` IDs to `Lead Reports · <Tab>`, using the sheet's steps and expected result.

**Workbook scenarios (`tests/scenarios/`).** The 133 scenarios in `Testcase/Reports_Analytics_Test_Scenarios.xlsx` are a separate layer from the core suite. `catalog.ts` reads the workbook at runtime, and test titles come from it through `sc(id)`. Declare each scenario with `scenario(id, expected, fn)` (tag `@scenario`, plus an `expected` annotation that the Excel reporter shows as the Expected Result) or with `manual(id, reason)` (Skipped, tag `@manual`). Every workbook ID must appear exactly once. The reporter maps `RA-###` IDs to the module `Scenario · <Test Area>`. Scenario tests set the report period explicitly with `openReport(page, path, period)`, because modules currently default to Last 12 months, not This month.

**Login.** The access token lasts 15 minutes and the app rotates its refresh token on use, so browsers that share one saved session log each other out once the token expires. Specs therefore import `test` from `tests/auth.ts` (which re-exports everything else from `@playwright/test`). Its `storageState` fixture gives each worker its own login in `.auth/worker-N.json` (gitignored), and logs in again when less than 3 minutes of the token are left. `tests/global-setup.ts` still writes `auth.json`, which is used only when `CRM_USERNAME`/`CRM_PASSWORD` are missing. In a new spec, import `test` from `./auth` or `../auth`, never from `@playwright/test`. For an extra browser context, pass it the `storageState` fixture, not `auth.json`.

**Database safety.** Every DB connection (`tests/db.ts`, `scripts/pg.mjs`) runs `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`. Keep it that way. Target the QA database only.

## Gotchas

- `auth.json`, `.env`, `reports/`, `test-results/` and `db-schema.md` are gitignored. If `auth.json` is missing or expired, every test fails at login. Re-run `npm run login`.
- On the Leads page the pager ("Page 1 of 25 · 615 leads") is hidden when there are 25 results or fewer. `listCount` then counts rows that contain `a.crm-record-link`.
- KPIs briefly show `—` (or `0` after a reload) while loading. Always read them through the helpers, which wait for a real value.
