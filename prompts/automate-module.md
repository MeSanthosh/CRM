# Prompt: automate a CRM module page (same approach as the Leads page)

Copy everything below the line into Claude Code, opened in the `crm-report-tests` repository.
Fill in the four values in the box first.

---

```
MODULE NAME : <e.g. Opportunities>
PAGE ROUTE  : <e.g. /opportunities>
ID PREFIX   : <2–3 capital letters, not already used — e.g. OP>   (used: LP LR CR BR MR RR SR CL EX ER and others in tests/test-catalog.ts)
USE CASES   :
<paste your use cases here, e.g. "HLUC-04 Create Opportunity — mandatory fields …, validations …, duplicate check …, counts …">
```

I want to automate the **<MODULE NAME>** page of the QA CRM (https://qa-crm.asquareab.com<PAGE ROUTE>) from the use cases above, following exactly the same approach as the Leads page suite that already exists in this repo. Read these first and copy their patterns; do not invent a new structure:

- `CLAUDE.md` (project rules — especially "Leads page suite", "Login" and "Test IDs drive the Excel report")
- `tests/leads-page/` — `test-data.ts` (loader), `catalog.ts` (`lp()` / `lpRow()`), `shared.ts` (fixtures, `withLeadsLock`, `note`), `create-lead.ts`, `counts.spec.ts`, `count-updates.spec.ts`, `coverage.spec.ts`
- `tests/pages/LeadsPage.ts`, `LeadForm.ts`, `LeadDetail.ts`, `Notice.ts` (page objects; reuse `Notice` and `pickDate`)
- `TestData/Leads_Test_Data.xlsx` and `Testcase/Leads_Page_Test_Cases.xlsx` (layout to copy)
- `reporter/excel-reporter.ts` and `tests/test-catalog.ts` (how IDs map to the report)

## What to deliver

1. **Explore the page first** (temporary spec, delete it afterwards). Capture: tabs and their counts, KPI cards (and what clicking them does), filters, table columns, pager text, the create form(s): every field's label, `name`, type and which are required; the pop-up shown on an empty save; the message for each wrong format (check whether it appears when leaving the field or only on save); what a successful save shows; how duplicates are detected and the exact message; the actions on a record (assign, change status, convert…) and their confirmations. Report what you found before building, including anything that looks like a defect.

2. **Human-readable test cases** — `Testcase/<Module>_Page_Test_Cases.xlsx`, sheets *Overview*, *Test Cases* (TC ID, Use Case, Area, Test Case, Preconditions, Test Steps as a numbered list, Test Data, Expected Result, Priority, Type, Automation), *Traceability* (each use-case requirement → TC IDs) and *Findings*. IDs `<PREFIX>-001…`. Write steps a manual tester can follow, and expected results that are concrete (exact messages, which numbers must be equal).

3. **Test data folder** — `TestData/<Module>_Test_Data.xlsx` **and** `TestData/csv/<Module>/<sheet>.csv` with the same content (Excel is the default; `TEST_DATA_FORMAT=csv` switches to CSV). Include a *Read Me* sheet. Sheets as needed: records to create (realistic, proper names — never "Auto Test", "Test1" or similar), Form Fields (label → field name → type → mandatory), Invalid Values (Case ID, field, value, expected message, checked when), Messages, Tab Rules, Count Changes (expected +1 / −1 / 0 per count per action), Actions, Settings. **No value may be hard-coded in a spec** — every value typed or expected comes from the data file. Make emails/phones unique each run with placeholders (`{unique}`, `#` = random digit); emails on `example.*` domains only. Put the generator script for both files in `scripts/` so they can be rebuilt.

4. **Automation** — `tests/<module>-page/` with its own `test-data.ts`, `catalog.ts`, `shared.ts`, specs and `coverage.spec.ts` (fails when a sheet ID has no test); page objects in `tests/pages/`; all selectors in `tests/locators.ts` (and `LOCATORS.md` kept in sync). Import `test` from `../auth`. Tag the describe `@<module>-page`; add `npm run test:<module>-page` and exclude the tag from `test:core`. Each Invalid Values row runs as its own sub-case (`<PREFIX>-005.1`, `.2` …). Anything that saves or changes records must run under a lock like `withLeadsLock` so count tests can compare before/after while other workers run. Record the data used and values read with `note()` so they appear in the report.

5. **Report** — map the prefix in `tests/test-catalog.ts` (module `"<Module> Page · <Area>"`, steps and expected result from the workbook, sub-cases `.n` use their parent case). A run of only this suite must produce `reports/<Module>_Page_Test_Report_<date>_<time>.xlsx`.

6. **Run and triage** — run the suite (`npx tsc` first). For every failure decide: test mistake → fix it; real app defect → **leave it failing** and record it on the Findings sheet. Re-run until only real defects fail. Never weaken an expected result to make a test pass.

## Reuse and known app behaviour

- A second worked example: `tests/lead-detail/` (Lead Detail panel, calls / tasks / meetings). Use `dataBook()` from `tests/leads-page/test-data.ts` to read your TestData file and `makeCatalog()` from `tests/leads-page/catalog.ts` for your workbook; put the generators for both in `scripts/`.
- Dropdowns load after a form opens ("Loading…"): wait for them, and read option text with `textContent` (Chromium gives no `innerText` for options of a closed select).
- Lists refresh a moment after a save / status change: wait for the expected state instead of reading once.
- Saves can take more than 20 s on QA when several workers run: wait up to 60 s for the result pop-up.
- Cancel / Close on a form with data asks "Discard changes?": answer it.

## Rules

- Data may be created on QA for testing, but only change/convert/delete records the tests created themselves. Close forms opened from other records without saving.
- Never click data-movement, AI or target-editing actions on dashboards.
- Credentials only in `.env`; never print tokens.
- Don't run two Playwright runs at the same time (they clear each other's `test-results`).
- Don't commit or push unless I ask.

At the end, give me: the number of cases, pass/fail of the last run, the defects found (with case IDs), the report file path, and the command to run the suite.
