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
    ['Aging Route', '/leads/aging', 'Leads → Insights → Aging'],
    ['Follow-up Route', '/leads/follow-up', 'Leads → Insights → Follow-up'],
    ['Open Leads Card', 'Open Leads', 'Aging card with the number of open leads'],
    ['Aging Basis', 'Idle days use last interaction, else capture date.', 'Aging: how idle days are counted'],
    ['Aging Hint', 'Select an aging bucket to list leads.', 'Aging: text before a bucket is chosen'],
    ['Aging Buckets', '0–7 days | 8–14 days | 15–30 days | 31–60 days | 61+ days', 'Aging buckets, in order'],
    ['Follow-up Card', 'Due for follow-up', 'Follow-up card with the number of leads due'],
    ['Follow-up Rule', 'Open active leads with no conversion and 7+ idle days.', 'Follow-up: which leads are listed'],
    ['Follow-up Idle Days', '7', 'A lead is due for follow-up from this many idle days'],
    ['Follow-up Columns', '# | Lead | Contact | Source | Owner | Idle | Captured', 'Columns of the Follow-up list'],
    ['Page Size', '20', 'Rows per page of the lists'],
    ['Closed Statuses', 'CONVERTED | DISQUALIFIED', 'Lead statuses that are not open'],
    ['Idle Tolerance Days', '1', 'Allowed difference for idle days (time of day / time zone)'],
    ['Dashboards Active Leads', '/dashboard/summary?period=this_month&view=audience', 'API of the Executive Dashboards with metrics.activeLeads'],
    ['Lead Detail Heading', 'Lead Detail', 'Heading of the panel that opens a lead'],
    ['Viewports', 'Desktop 1366x768 | Tablet 1024x768 | Phone 390x844', 'Widths checked for sideways scrolling'],
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
UC4, UC5, UC6 = 'LIUC-04 Source figures against the lead records', 'LIUC-05 Lead aging', 'LIUC-06 Lead follow-up tracking'
AGE, FUP = 'Open Leads → Insights → Aging', 'Open Leads → Insights → Follow-up'
LEADS_API = 'every lead of the Leads module (GET /leads), read at run time'

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

A = 'Source Figures'
C('LSI-014', UC4, A, 'Active Leads card counts only open leads', ADMIN, st(OPEN, 'Read Active Leads', 'Open Aging and read Open Leads', 'Open Executive Dashboards → Lead & Customer Insights → Active Leads'), f'{TD} → Settings (Open Leads Card, Dashboards Active Leads)',
  'The card called "Active Leads" equals the open leads (Aging Open Leads = dashboards Active Leads), or it is labelled as all leads.', 'Medium', 'Integration')
C('LSI-015', UC4, A, 'Each source row equals its lead records', ADMIN, st(OPEN, 'Read every source row', 'Group the Leads module records by Lead Source'), LEADS_API,
  'Per source: Total = its leads; Converted = leads with status Converted; Qualified = leads ever qualified; Unassigned = leads without an owner.', 'High', 'Integration')
C('LSI-016', UC4, A, 'Every lead source of the records is listed', ADMIN, st(OPEN, 'Read the source names', 'List the Lead Sources used by the lead records'), LEADS_API,
  'Every Lead Source that has leads appears in the table; none is missing.', 'Medium', 'Integration')

A = 'Aging'
C('LSI-031', UC5, A, 'Aging view shows Open Leads, the basis and the buckets', ADMIN, st(AGE, 'Read the card, the basis note and the buckets'), f'{TD} → Settings (Aging Route, Open Leads Card, Aging Basis, Aging Buckets, Aging Hint)',
  'URL /leads/aging with Aging marked active; card Open Leads; "Idle days use last interaction, else capture date."; buckets 0–7, 8–14, 15–30, 31–60, 61+ days in that order; hint "Select an aging bucket to list leads."', 'Medium')
C('LSI-032', UC5, A, 'Aging buckets add up to Open Leads', ADMIN, st(AGE, 'Add up the buckets'), '—', 'The buckets add up to Open Leads.', 'High')
C('LSI-033', UC5, A, 'Open Leads equals the open leads of the Leads module', ADMIN, st(AGE, 'Read Open Leads', 'Count leads that are not Converted or Disqualified', 'Read Active Leads on Executive Dashboards'), f'{LEADS_API}; {TD} → Settings (Closed Statuses)',
  'Open Leads = open leads of the Leads module = dashboards Active Leads.', 'High', 'Integration')
C('LSI-034', UC5, A, 'Each bucket equals the open leads idle that long', ADMIN, st(AGE, 'Read each bucket', 'For every open lead count days since its last interaction (else capture date)'), f'{LEADS_API}; {TD} → Settings (Idle Tolerance Days)',
  'Each bucket = open leads whose idle days fall in its range (one day of tolerance at the edges).', 'High', 'Integration')
C('LSI-035', UC5, A, 'Clicking a bucket lists its leads', ADMIN, st(AGE, 'Click each bucket in turn', 'Read the list on every page'), f'{TD} → Settings (Page Size)',
  "The list count and the pager total equal the bucket; every lead listed is open and its Idle falls in the bucket's range.", 'High')
C('LSI-036', UC5, A, 'Clicking the bucket again clears the list', ADMIN, st(AGE, 'Click a bucket', 'Click it again'), f'{TD} → Settings (Aging Hint)',
  'The list goes away and the hint shows again.', 'Low')
C('LSI-037', UC5, A, 'A lead of the aging list can be opened', ADMIN, st(AGE, 'Click a bucket', 'Click the first lead'), f'{TD} → Settings (Lead Detail Heading)',
  'The lead opens (Lead Detail with its Lead No.).', 'Medium')

A = 'Follow-up'
C('LSI-041', UC6, A, 'Follow-up view shows the count, the rule and the list', ADMIN, st(FUP, 'Read the card, the rule and the list columns'), f'{TD} → Settings (Follow-up Route, Follow-up Card, Follow-up Rule, Follow-up Columns)',
  'URL /leads/follow-up with Follow-up marked active; card "Due for follow-up"; rule "Open active leads with no conversion and 7+ idle days."; columns #, Lead, Contact, Source, Owner, Idle, Captured.', 'Medium')
C('LSI-042', UC6, A, 'Due for follow-up = leads listed', ADMIN, st(FUP, 'Read Due for follow-up, "Leads N matching" and the pager', 'Count the rows on every page'), '—',
  'The card, "N matching", the pager total and the rows listed are the same number.', 'High')
C('LSI-043', UC6, A, 'Due for follow-up equals the open leads idle 7+ days', ADMIN, st(FUP, 'Read Due for follow-up', 'Count open leads whose idle days are 7 or more', 'Compare with the Aging buckets'), f'{LEADS_API}; {TD} → Settings (Follow-up Idle Days)',
  'Due for follow-up = open leads idle 7+ days (Leads module); it is not less than the Aging buckets 8–14 + 15–30 + 31–60 + 61+.', 'High', 'Integration')
C('LSI-044', UC6, A, 'Every listed lead is open and idle 7+ days', ADMIN, st(FUP, 'Read every row on every page', 'Look each lead up in the Leads module'), LEADS_API,
  'Each lead exists, is not Converted / Disqualified, its Idle is 7 days or more and equals the days since its last interaction (else capture date).', 'High', 'Integration')
C('LSI-045', UC6, A, 'Owner, source and contact of each row equal the lead', ADMIN, st(FUP, 'Read Contact, Source, Owner and Captured of every row'), LEADS_API,
  "Contact = the lead's name, Source = its Lead Source, Owner = its owner (\"Unassigned\" when none), Captured = its capture date.", 'Medium', 'Integration')
C('LSI-046', UC6, A, 'Pages of the list', ADMIN, st(FUP, 'Click Next until the last page', 'Click Previous back to the first'), f'{TD} → Settings (Page Size)',
  '20 rows a page; # runs on without gaps or repeats; "Showing a–b of N · Page x of y" follows; Previous is disabled on page 1 and Next on the last page.', 'Medium')
C('LSI-047', UC6, A, 'The list shows the leads that need attention first', ADMIN, st(FUP, 'Read the Idle column of every page'), '—',
  'Rows are ordered by idle days, most idle first.', 'Low')
C('LSI-048', UC6, A, 'A lead of the follow-up list can be opened', ADMIN, st(FUP, 'Click the first Lead No. (or its row)'), f'{TD} → Settings (Lead Detail Heading)',
  'The lead opens (Lead Detail), so the user can follow it up from the list.', 'Medium')
C('LSI-049', UC6, A, 'Idle and Captured are formatted consistently', ADMIN, st(FUP, 'Read Idle and Captured of every row'), '—',
  'Idle reads "<n>d" with a whole number; Captured reads "dd Mon yyyy"; no NaN, undefined or empty cells.', 'Low', 'Number Format')

A = 'UI/UX'
C('LSI-051', UC6, A, 'Sub-tabs open their views and can be opened by address', ADMIN, st('Open /leads/sources, /leads/aging and /leads/follow-up directly', 'Click Sources, Aging and Follow-up'), f'{TD} → Settings (Insights Route, Aging Route, Follow-up Route)',
  'Each address opens its view with the right sub-tab marked active; the Insights tab stays active.', 'Low', 'UI/UX')
C('LSI-052', UC6, A, 'Insights views fit desktop, tablet and phone widths', ADMIN, st('Open Sources, Aging and Follow-up at 1366, 1024 and 390 px'), f'{TD} → Settings (Viewports)',
  'No sideways scrolling of the page; tables scroll inside their box.', 'Low', 'UI/UX')
C('LSI-053', UC6, A, 'Insights views load without errors', ADMIN, st('Open Sources, Aging and Follow-up', 'Watch the requests'), '—',
  'Every request succeeds; no script error; no NaN or undefined.', 'Medium')

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
AREA_IMPACT = {'Sources View': 'The source figures cannot be trusted for marketing / channel decisions.', 'Source Figures': 'The source report disagrees with the lead records, so channel decisions use wrong numbers.',
  'Aging': 'Old leads sit in the wrong bucket, so neglected leads are not noticed.', 'Follow-up': 'Leads that need a follow-up are missed or listed wrongly, so sales lose prospects.', 'UI/UX': 'The Insights views are hard to reach or read.', 'Drill-down': 'The lead list behind a source does not match its figures.', 'Count Updates': 'Source figures do not follow lead changes.'}
FINDINGS = [
    ['F-01', 'To confirm', 'LSI-008', 'Similar source names listed separately', 'The table lists "Broker" and "Broker Channels", "Referrals" and "Referral Partner", "Events & Exhibitions" and "Exhibition", and "Google Ads" next to "Digital Marketing" (27 Oct 2026).', 'One name per channel (old names mapped), or confirm they are different channels.', 'Low'],
    ['F-02', 'To confirm', '—', 'Aging buckets do not add up to the active leads', 'Insights → Aging shows 98 + 12 + 7 + 0 + 0 = 117 leads while Active Leads is 193 (27 Oct 2026).', 'Buckets cover every active lead, or the page says which leads are left out.', 'Low'],
]
OVERVIEW = [
    ('Scope', 'Leads → Insights: Sources (/leads/sources, "Lead Source & Channel Insights Workspace": cards, By source table, drill-down, figures following lead changes and against the lead records), Aging (/leads/aging) and Follow-up (/leads/follow-up, "Lead Follow-up Tracking Workspace").'),
    ('Test types', 'Functional, Integration (every lead record of the Leads module, Executive Dashboards), Number Format, UI/UX.'),
    ('Use cases', 'LIUC-01 source overview & figures · LIUC-02 leads of a source · LIUC-03 figures follow lead changes · LIUC-04 source figures against the records · LIUC-05 lead aging · LIUC-06 lead follow-up tracking'),
    ('Test data', f'{TD} (or TestData/csv/Lead_Insights/*.csv with TEST_DATA_FORMAT=csv). No figures are hard-coded: expected values come from other parts of the page.'),
    ('Automation', 'tests/lead-insights/*.spec.ts — run with: npm run test:lead-insights-page'),
    ('Report', 'reports/Lead_Insights_Page_Test_Report_<date>_<time>.xlsx'),
    ('Data created', 'One lead per run (fictional mobile, example.* email), qualified and converted to an opportunity.'),
    ('Security', 'Out of scope (covered by the Security suite).'),
]
write_cases('Lead_Insights_Page_Test_Cases.xlsx', 'Lead Insights (Lead Source & Channel Insights) — Test Cases', OVERVIEW, cases, FINDINGS, IMPACT, AREA_IMPACT)
