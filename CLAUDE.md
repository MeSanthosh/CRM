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
- Report modules default to "This month", the same period the hub and dashboard use. Cross-page comparisons depend on that.

**Database safety.** Every DB connection (`tests/db.ts`, `scripts/pg.mjs`) runs `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`. Keep it that way. Target the QA database only.

## Gotchas

- `auth.json`, `.env`, `reports/`, `test-results/` and `db-schema.md` are gitignored. If `auth.json` is missing or expired, every test fails at login. Re-run `npm run login`.
- On the Leads page the pager ("Page 1 of 25 · 615 leads") is hidden when there are 25 results or fewer. `listCount` then counts rows that contain `a.crm-record-link`.
- KPIs briefly show `—` (or `0` after a reload) while loading. Always read them through the helpers, which wait for a real value.
