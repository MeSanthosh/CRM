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
