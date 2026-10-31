"""Builds the Lead Insights (Lead Source & Channel Insights Workspace) suite files:
  TestData/Lead_Insights_Test_Data.xlsx + TestData/csv/Lead_Insights/*.csv  (test data, same content)
  Testcase/Lead_Insights_Page_Test_Cases.xlsx                              (human-readable test cases)
Run from the repo root:  python scripts/build_lead_insights_page.py
"""
from sales_modules_common import st, write_testdata, write_cases, buyers

TD = 'TestData/Lead_Insights_Test_Data.xlsx'
S = {}
S['Settings'] = (['Setting', 'Value', 'What it means'], [
    ['Insights Route', '/leads/sources', 'Leads → Insights → Sources'],
    ['All Leads Route', '/leads', 'Leads → All Leads tab'],
    ['Page Description', 'Lead Sources · Active leads grouped by capture source, with qualification and conversion rates.', 'Line under the Leads title on the Sources view'],
    ['Sub-tabs', 'Sources | Aging | Follow-up', 'Sub-tabs of Insights'],
    ['Active Leads Card', 'Active Leads', 'Card with the number of active leads'],
    ['Sources Card', 'Sources', 'Card with the number of sources'],
    ['Table Heading', 'By source', 'Heading of the source table'],
    ['Table Columns', 'Source | Total | Qualified | Converted | Unassigned | Qual. % | Conv. %', 'Columns of the source table'],
    ['All Leads Tab', 'All Leads', 'Leads tab whose count equals Active Leads'],
    ['Unassigned Tab', 'Unassigned', 'Leads tab whose count equals the sum of the Unassigned column'],
    ['Percent Decimals', '1', 'Qual. % and Conv. % are shown with at most this many decimals'],
    ['Drill Hint', 'Click a source row to list its leads.', 'Text under the table before a row is clicked'],
    ['Drill Shown Text', 'Showing leads for the selected source. Click the row again to clear.', 'Text once a row is clicked'],
    ['Drill Count Word', 'matching', 'Heading "Leads N matching" of the list'],
    ['Drill Columns', '# | Lead | Contact | Source | Owner | Idle | Captured', 'Columns of the drill-down list'],
    ['Unassigned Owner', 'Unassigned', 'Owner shown for a lead nobody owns'],
    ['Refresh Button', 'Refresh', 'Button that reloads the table'],
    ['Source For New Lead', 'Public Relations', 'Lead Source of the lead the count-update tests create (must be a Lead Source option of the form)'],
])
S['Count Changes'] = (['Action', 'Active Leads', 'Total', 'Qualified', 'Converted', 'Unassigned'], [
    ['Create Lead', '1', '1', '0', '0', '0'],
    ['Qualify Lead', '0', '0', '1', '0', '0'],
    ['Convert Lead', '0', '0', '0', '1', '0'],
])
S['Buyers'] = buyers([
    ['BUY-01', 'Mr', 'Edward', 'Collins', '+44 7700 900###', '{first}.{last}.{unique}@example.co.uk', 'Public Relations'],
])
README = [
    'Test data for the Lead Insights suite (tests/lead-insights): Leads → Insights → Sources ("Lead Source & Channel Insights Workspace").',
    'Default source: this Excel file. Set TEST_DATA_FORMAT=csv to use TestData/csv/Lead_Insights/<sheet>.csv instead. Rebuild both with: python scripts/build_lead_insights_page.py',
    'Yellow cells can be edited. Keep the column headers as they are.',
    'The count-update tests create ONE lead per run (Buyers sheet + the Leads page data), qualify it (Lead Detail data) and convert it. '
    'It uses the fictional UK mobile range +44 7700 900xxx and an example.* email.',
    'Count Changes: expected change of the Active Leads card and of the new lead\'s source row after each action.',
    'Every other expected value is read from the page itself (other cards, tabs, column sums, the drill-down list) — no figures are written here.',
]
write_testdata('Lead_Insights_Test_Data.xlsx', 'Lead_Insights', 'Lead Insights — Test Data', README, S)

cases = []
def C(id, uc, area, title, pre, steps, data, exp, pri='High', kind='Positive', auto='Automated'):
    cases.append([id, uc, area, title, pre, steps, data, exp, pri, kind, auto])

OPEN = 'Open Leads → Insights (Sources)'
ADMIN = 'Signed in as CRM Administrator'
UC1, UC2, UC3 = 'LIUC-01 Source overview & figures', 'LIUC-02 Leads of a source (drill-down)', 'LIUC-03 Figures follow lead changes'

A = 'Sources View'
C('LSI-001', UC1, A, 'Sources view shows its cards, sub-tabs and table', ADMIN, st(OPEN, 'Read the description, cards, sub-tabs and table columns'), f'{TD} → Settings',
  'Description "Lead Sources · Active leads grouped by capture source…"; cards Active Leads and Sources; sub-tabs Sources, Aging, Follow-up; table "By source" with Source, Total, Qualified, Converted, Unassigned, Qual. %, Conv. %; hint "Click a source row to list its leads."', 'Medium')
C('LSI-002', UC1, A, 'Active Leads card = All Leads', ADMIN, st(OPEN, 'Read Active Leads', 'Read the All Leads tab count'), f'{TD} → Settings (All Leads Tab)',
  'Active Leads equals the All Leads count.')
C('LSI-003', UC1, A, 'Sources card = sources listed', ADMIN, st(OPEN, 'Read Sources', 'Count the rows of "By source"'), '—',
  'Sources equals the number of rows.')
C('LSI-004', UC1, A, 'Totals of all sources add up to Active Leads', ADMIN, st(OPEN, 'Add up the Total column'), '—',
  'Sum of Total = Active Leads (every active lead belongs to exactly one source).')
C('LSI-005', UC1, A, 'Qual. % and Conv. % are calculated correctly', ADMIN, st(OPEN, 'For every source compute Qualified ÷ Total and Converted ÷ Total'), f'{TD} → Settings (Percent Decimals)',
  'Qual. % = Qualified ÷ Total × 100 and Conv. % = Converted ÷ Total × 100, rounded to 1 decimal, for every row.')
C('LSI-006', UC1, A, 'Figures of each source are consistent', ADMIN, st(OPEN, 'For every source compare the columns'), '—',
  'Converted ≤ Qualified ≤ Total and Unassigned ≤ Total for every row (a converted lead was qualified first).')
C('LSI-007', UC1, A, 'Unassigned of all sources = Unassigned tab', ADMIN, st(OPEN, 'Add up the Unassigned column', 'Read the Unassigned tab count'), f'{TD} → Settings (Unassigned Tab)',
  'Sum of Unassigned = the Unassigned tab count.')
C('LSI-008', UC1, A, 'Sources are the Lead Source options of the lead form', ADMIN, st(OPEN, 'Read the source names', 'Open New Individual Lead and read the Lead Source options'), '—',
  'Every source on the table is an option of Lead Source (no old or duplicate names such as "Broker" next to "Broker Channels").', 'Medium', 'Consistency')
C('LSI-009', UC1, A, 'Refresh keeps the same figures', ADMIN, st(OPEN, 'Read the table', 'Click Refresh', 'Read it again'), f'{TD} → Settings (Refresh Button)',
  'Same sources and figures after Refresh (nothing changed in between).', 'Low')

A = 'Drill-down'
C('LSI-011', UC2, A, 'Clicking a source lists its leads', ADMIN, st(OPEN, 'Click each source row in turn'), f'{TD} → Settings (Drill Shown Text, Drill Columns)',
  'For each source: "Showing leads for the selected source…"; "Leads N matching" with N = the row\'s Total; the pager total = N; every lead listed has that Source.')
C('LSI-012', UC2, A, 'Unassigned leads of a source = its Unassigned figure', ADMIN, st(OPEN, 'Click each source row', 'Count leads whose Owner is "Unassigned" (all pages)'), f'{TD} → Settings (Unassigned Owner)',
  'For each source the number of unassigned leads listed = the Unassigned column.')
C('LSI-013', UC2, A, 'Clicking the row again clears the list', ADMIN, st(OPEN, 'Click a source row', 'Click the same row again'), f'{TD} → Settings (Drill Hint)',
  'The lead list disappears and the hint "Click a source row to list its leads." is shown again.', 'Low')

A = 'Count Updates'
C('LSI-021', UC3, A, 'A new lead is counted under its source', ADMIN, st(OPEN, 'Read Active Leads and the row of the data source', 'Create an Individual lead with that Lead Source', 'Open Insights again'), f'{TD} → Buyers, Settings (Source For New Lead), Count Changes (Create Lead)',
  'Active Leads and the source\'s Total grow by 1; Qualified, Converted and Unassigned as on Count Changes; the lead is listed when the source row is clicked.')
C('LSI-022', UC3, A, 'Qualifying a lead raises Qualified', 'The lead from LSI-021', st(OPEN, 'Read the source row', 'Qualify the lead (Lead Detail checklist)', 'Open Insights again'), f'{TD} → Count Changes (Qualify Lead)',
  'Qualified of the source grows by 1 and Qual. % is recalculated; other figures as on Count Changes.')
C('LSI-023', UC3, A, 'Converting a lead raises Converted', 'The lead from LSI-022', st(OPEN, 'Read the source row', 'Move the lead to Opportunity (Convert)', 'Open Insights again'), f'{TD} → Count Changes (Convert Lead)',
  'Converted of the source grows by 1 and Conv. % is recalculated; other figures as on Count Changes.')

IMPACT = {
    'LSI-002': 'The Insights page and the Leads list disagree on how many leads are active, so marketing decisions are based on a different number than sales sees.',
    'LSI-004': 'Some active leads are not counted under any source (or counted twice), so source performance is misreported.',
    'LSI-005': 'Qualification / conversion rates are wrong, so the best and worst lead sources are misjudged.',
    'LSI-006': 'A source shows more converted than qualified leads (or more than its total), which makes its conversion rate meaningless.',
    'LSI-007': 'Unassigned leads per source do not match the Unassigned queue, so some leads may never be picked up.',
    'LSI-008': 'Leads are captured under old or duplicate source names, so the same channel is split across several rows and looks weaker than it is.',
    'LSI-011': 'The leads listed for a source are not the ones counted, so follow-up from this page targets the wrong leads.',
    'LSI-012': 'The unassigned figure of a source does not match its leads, so managers cannot trust it to allocate work.',
    'LSI-021': 'New leads do not appear under their source, so the channel report lags behind reality.',
    'LSI-022': 'Qualified leads are not reflected in the source figures.',
    'LSI-023': 'Conversions are not reflected in the source figures, so channel ROI is understated.',
}
AREA_IMPACT = {'Sources View': 'The source figures cannot be trusted for marketing / channel decisions.', 'Drill-down': 'The lead list behind a source does not match its figures.', 'Count Updates': 'Source figures do not follow lead changes.'}
FINDINGS = [
    ['F-01', 'To confirm', 'LSI-008', 'Similar source names listed separately', 'The table lists "Broker" and "Broker Channels", "Referrals" and "Referral Partner", "Events & Exhibitions" and "Exhibition", and "Google Ads" next to "Digital Marketing" (27 Oct 2026).', 'One name per channel (old names mapped), or confirm they are different channels.', 'Low'],
    ['F-02', 'To confirm', '—', 'Aging buckets do not add up to the active leads', 'Insights → Aging shows 98 + 12 + 7 + 0 + 0 = 117 leads while Active Leads is 193 (27 Oct 2026).', 'Buckets cover every active lead, or the page says which leads are left out.', 'Low'],
]
OVERVIEW = [
    ('Scope', 'Leads → Insights → Sources (/leads/sources), "Lead Source & Channel Insights Workspace": cards, the By source table, the drill-down list of a source and how the figures follow lead changes.'),
    ('Use cases', 'LIUC-01 source overview & figures · LIUC-02 leads of a source · LIUC-03 figures follow lead changes'),
    ('Test data', f'{TD} (or TestData/csv/Lead_Insights/*.csv with TEST_DATA_FORMAT=csv). No figures are hard-coded: expected values come from other parts of the page.'),
    ('Automation', 'tests/lead-insights/*.spec.ts — run with: npm run test:lead-insights-page'),
    ('Report', 'reports/Lead_Insights_Page_Test_Report_<date>_<time>.xlsx'),
    ('Data created', 'One lead per run (fictional mobile, example.* email), qualified and converted to an opportunity.'),
    ('Security', 'Out of scope (covered by the Security suite).'),
]
write_cases('Lead_Insights_Page_Test_Cases.xlsx', 'Lead Insights (Lead Source & Channel Insights) — Test Cases', OVERVIEW, cases, FINDINGS, IMPACT, AREA_IMPACT)
