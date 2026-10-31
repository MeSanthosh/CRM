"""Builds the Opportunities page suite files:
  TestData/Opportunities_Test_Data.xlsx + TestData/csv/Opportunities/*.csv  (test data, same content)
  Testcase/Opportunities_Page_Test_Cases.xlsx                              (human-readable test cases)
Run from the repo root:  python scripts/build_opportunities_page.py
"""
from sales_modules_common import st, write_testdata, write_cases, DEAL_SETTINGS, DEAL_STEPS, DEAL_UNIT, DEAL_FORM_FIELDS, DEAL_README, buyers

TD = 'TestData/Opportunities_Test_Data.xlsx'
S = {}
S['Settings'] = (['Setting', 'Value', 'What it means'], [
    ['Page Title', 'Opportunities', 'Title of the page'],
    ['Search Placeholder', 'Search opportunity, customer, lead, project', 'Search box of the list'],
    ['List View', 'List', 'View button: table register'],
    ['Board View', 'Board', 'View button: Kanban board'],
    ['Export Button', 'Export', 'Export of the list'],
    ['Open Stages', 'Qualified, Site Visit, Negotiation, Reservation Ready, Proposal', 'Stages counted as Open (active pipeline)'],
    ['Won Stage', 'Won', ''], ['Lost Stage', 'Lost', ''],
    ['Board Summary Start', 'Open pipeline:', 'Start of the board summary "Open pipeline: N deals · V USD · weighted W USD"'],
    ['Board Move Prompt', 'Move / mark Lost…', 'First option of the move menu of a board card'],
    ['Not From Board', '(not from board)', 'Suffix of a stage the board cannot move a deal to'],
    ['Owner Filter', 'Owner', 'Board filter (aria-label)'], ['Project Filter', 'Project', 'Board filter (aria-label)'],
    ['Value Tolerance %', '0.5', 'Allowed difference between amounts shown rounded'],
    ['Inventory Holds Tab', 'Holds', 'Inventory tab listing unit holds'],
    ['Holds Scope Filter', 'Whose holds', 'Holds: filter of whose holds are listed (aria-label)'], ['Holds Scope All', 'All', 'Every user'],
    ['Holds Status Filter', 'Show', 'Holds: filter of hold status (aria-label)'], ['Holds Active', 'Active', 'Active holds only'], ['Hold Active Status', 'Active', 'Status of a hold that is in force'],
    ['Closed Filter', 'Closed deals', 'Board filter of Won / Lost columns (aria-label)'],
])
S['Deal Settings'] = (['Setting', 'Value', 'What it means'], DEAL_SETTINGS)
S['Card Rules'] = (['Card', 'Equals'], [
    ['Total', 'Open + Won + Lost = opportunities listed'],
    ['Open', 'rows with an Open stage'],
    ['Pipeline Value', 'sum of Budget of the Open rows'],
    ['Avg Probability', 'sum of Probability of the Open rows ÷ Open'],
])
S['Register Columns'] = (['Column'], [['Opportunity'], ['Customer'], ['Stage'], ['Probability'], ['Budget'], ['Project'], ['Created Date']])
S['Opportunity Actions'] = (['Action', 'Submit Button', 'Field', 'Value'], [
    ['Hold Unit', 'Hold Unit', 'Hold for', '2 days (48h)'],
    ['Hold Unit', 'Hold Unit', 'Reason (optional)', 'Buyer wants to show the unit to family before reserving.'],
    ['Hold Without Unit', 'Hold Unit', 'Hold for', '2 days (48h)'],
    ['Mark Lost', 'Mark Lost', 'Lost Reason', 'Price'],
    ['Mark Lost', 'Mark Lost', 'Remarks', 'Buyer chose a lower-priced project.'],
    ['Lost Without Reason', 'Mark Lost', 'Remarks', 'Lost attempted without a reason.'],
])
S['Messages'] = (['Message Key', 'Expected Text', 'Where it appears'], [
    ['Held By', 'Held by', 'Unit picker / Inventory: a unit on hold for a deal'],
    ['Lost Stage', 'Lost', 'Status of an opportunity marked Lost'],
])
S['Count Changes'] = (['Action', 'Total', 'Open', 'Lost'], [
    ['Create Opportunity', '1', '1', '0'],
    ['Mark Lost', '0', '-1', '1'],
])
S['Buyers'] = buyers([
    ['BUY-01', 'Mr', 'Samuel', 'Whitaker', '+44 7700 900###', '{first}.{last}.{unique}@example.co.uk', 'Referrals'],
])
S['Deal Steps'] = DEAL_STEPS
S['Deal Unit'] = DEAL_UNIT
S['Deal Form Fields'] = DEAL_FORM_FIELDS
README = [
    'Test data for the Opportunities page suite (tests/opportunities-page). Nothing the tests type or expect is written in the code.',
    'Default source: this Excel file. Set TEST_DATA_FORMAT=csv to use TestData/csv/Opportunities/<sheet>.csv instead. Rebuild both with: python scripts/build_opportunities_page.py',
    *DEAL_README,
    'Per run the suite creates ONE buyer lead → opportunity, holds ONE new unit of the test project for it, then marks it Lost (which must release the hold).',
]
write_testdata('Opportunities_Test_Data.xlsx', 'Opportunities', 'Opportunities — Test Data', README, S)

cases = []
def C(id, uc, area, title, pre, steps, data, exp, pri='High', kind='Positive', auto='Automated'):
    cases.append([id, uc, area, title, pre, steps, data, exp, pri, kind, auto])
OPEN = 'Open Opportunities (main menu → Opportunities)'
ADMIN = 'Signed in as CRM Administrator'
DEAL = 'An opportunity created by the test (buyer lead → qualified → converted)'
UC1, UC2, UC3, UC4 = 'OUC-01 Opportunity register (List)', 'OUC-02 Kanban pipeline board', 'OUC-03 Hold a unit for a deal', 'OUC-04 Mark an opportunity Lost'

A = 'Table Register'
C('OPP-001', UC1, A, 'Opportunities page shows its cards, views and list', ADMIN, st(OPEN, 'Read the cards, the view buttons and the list columns'), f'{TD} → Settings, Card Rules, Register Columns',
  'Cards Total, Open, Pipeline Value and Avg Probability with their formulas; views List and Board; Export; columns Opportunity, Customer, Stage, Probability, Budget, Project, Created Date.', 'Medium')
C('OPP-002', UC1, A, 'Total card = Open + Won + Lost = opportunities listed', ADMIN, st(OPEN, 'Read Total', 'Read "Showing … of N opportunities"', 'Count Won and Lost rows'), f'{TD} → Card Rules',
  'Total = N = Open + Won + Lost.')
C('OPP-003', UC1, A, 'Open card = opportunities in an open stage', ADMIN, st(OPEN, 'Read Open', 'Count rows whose Stage is an open stage (all pages)'), f'{TD} → Settings (Open Stages)', 'Open equals that count.')
C('OPP-004', UC1, A, 'Pipeline Value = total budget of open opportunities', ADMIN, st(OPEN, 'Read Pipeline Value', 'Add up Budget of the open rows'), f'{TD} → Settings (Value Tolerance %)', 'Pipeline Value equals that total (within rounding).')
C('OPP-005', UC1, A, 'Avg Probability = average probability of open opportunities', ADMIN, st(OPEN, 'Read Avg Probability', 'Average the Probability of the open rows'), '—', 'Avg Probability equals that average (rounded).', 'Medium')
C('OPP-006', UC1, A, 'Search the list', DEAL, st(OPEN, 'Search the opportunity number, the buyer and the lead number'), f'{TD} → Settings (Search Placeholder)', 'Each search lists the opportunity; every row listed contains the text.', 'Medium')
C('OPP-007', UC1, A, 'Export matches the list', ADMIN, st(OPEN, 'Click Export'), '—', 'The file has one row per opportunity of the list and contains the opportunity numbers listed.', 'Medium')

A = 'Kanban Board'
C('OPP-011', UC2, A, 'Board columns add up to the open pipeline', ADMIN, st(OPEN, 'Click Board', 'Read each column (count, value) and the summary "Open pipeline: N deals · V USD"'), f'{TD} → Settings (Board Summary Start)',
  'Sum of the open-stage column counts = N = the Open card; sum of their values = V = Pipeline Value.')
C('OPP-012', UC2, A, 'Each column lists as many cards as its count', ADMIN, st(OPEN, 'Board → for each column count the cards'), '—', 'Cards in a column = the column count; the card budgets add up to the column value.', 'Medium')
C('OPP-013', UC2, A, 'Board owner filter shows only that owner\'s deals', ADMIN, st(OPEN, 'Board → Owner = each owner in turn'), f'{TD} → Settings (Owner Filter)', 'Every card shows the chosen owner.', 'Medium')
C('OPP-014', UC2, A, 'Board project filter shows only that project\'s deals', ADMIN, st(OPEN, 'Board → Project = each project in turn', 'Compare with the List filtered by search on the project'), f'{TD} → Settings (Project Filter)', 'Cards shown belong to the chosen project; the open count is not more than with All projects.', 'Medium')
C('OPP-015', UC2, A, 'Move menu offers only allowed moves', ADMIN, st(OPEN, 'Board → open "Move / mark Lost…" on cards of each stage'), f'{TD} → Settings (Board Move Prompt, Not From Board)',
  'Every menu offers Lost; stages the workflow does not allow from the board are marked "(not from board)" and cannot be chosen.', 'Medium')

A = 'Unit Hold'
C('OPP-021', UC3, A, 'Hold a unit for a deal', DEAL + '; a new unit of the test project', st('Open the opportunity → Hold a Unit', 'Choose the unit, Hold for 2 days, reason', 'Hold Unit', 'Open Inventory → Holds (All, Active)'), f'{TD} → Opportunity Actions (Hold Unit), Deal Unit',
  'The hold is listed in Inventory → Holds with the unit, the opportunity, status Active and a time left; the opportunity stage does not change.')
C('OPP-022', UC3, A, 'Hold needs a unit', DEAL, st('Open the opportunity → Hold a Unit without choosing a unit → Hold Unit'), f'{TD} → Opportunity Actions (Hold Without Unit)', 'The hold is refused with a message (or the button stays disabled); no hold is created.', 'Medium', 'Negative')
C('OPP-023', UC3, A, 'A held unit cannot be reserved by another deal', DEAL + ' with a held unit', st('Open New Reservation → Choose Unit', 'Search the held unit'), f'{TD} → Messages (Held By)',
  'The unit is shown as "Held by …" and cannot be selected for another opportunity.', 'Medium')

A = 'Mark Lost'
C('OPP-031', UC4, A, 'Mark Lost needs a reason', DEAL, st('Open the opportunity → Mark Lost without a Lost Reason → Mark Lost'), f'{TD} → Opportunity Actions (Lost Without Reason)', 'A message asks for the reason; the opportunity stays open.', 'Medium', 'Negative')
C('OPP-032', UC4, A, 'Mark an opportunity Lost', DEAL + ' with a held unit', st(OPEN, 'Read the cards', 'Open the opportunity → Mark Lost (Lost Reason, Remarks)', 'Read the cards and Inventory → Holds'), f'{TD} → Opportunity Actions (Mark Lost), Count Changes (Mark Lost)',
  'Stage Lost; Open −1 and Total unchanged (Count Changes); the unit hold of the deal is released (no longer Active in Holds).')

IMPACT = {
    'OPP-002': 'The Total card does not match the list, so the pipeline size reported to management is wrong.',
    'OPP-004': 'The pipeline value is wrong, so forecasts based on it are wrong.',
    'OPP-011': 'The board and the cards show a different pipeline, so sales managers cannot trust either.',
    'OPP-015': 'The board would let users skip workflow steps (or block allowed ones).',
    'OPP-021': 'Units cannot be held for a buyer, or the hold is not visible to others, so the same unit could be promised twice.',
    'OPP-023': 'A unit held for one buyer can be reserved for another.',
    'OPP-032': 'A lost deal keeps its unit on hold (or keeps counting as open), so units stay blocked and the pipeline is overstated.',
}
AREA_IMPACT = {'Table Register': 'Opportunity figures cannot be trusted.', 'Kanban Board': 'The board does not reflect the pipeline.', 'Unit Hold': 'Unit holds do not protect units for buyers.', 'Mark Lost': 'Losing a deal does not update the pipeline or release its unit.'}
OVERVIEW = [
    ('Scope', 'Opportunities page (/opportunities): cards, List (table register), Board (Kanban), Hold a Unit and Mark Lost on the opportunity panel.'),
    ('Use cases', 'OUC-01 register · OUC-02 Kanban board · OUC-03 hold a unit · OUC-04 mark Lost'),
    ('Test data', f'{TD} (or TestData/csv/Opportunities/*.csv with TEST_DATA_FORMAT=csv). No figures are hard-coded.'),
    ('Automation', 'tests/opportunities-page/*.spec.ts — run with: npm run test:opportunities-page'),
    ('Report', 'reports/Opportunities_Page_Test_Report_<date>_<time>.xlsx'),
    ('Data created', 'Per run: 1 buyer lead → opportunity (fictional mobile), 1 unit in the test project held for it; the opportunity ends as Lost.'),
]
write_cases('Opportunities_Page_Test_Cases.xlsx', 'Opportunities Page — Test Cases', OVERVIEW, cases, [], IMPACT, AREA_IMPACT)
