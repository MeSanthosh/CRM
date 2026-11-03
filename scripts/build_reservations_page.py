"""Builds the Reservations page suite files:
  TestData/Reservations_Test_Data.xlsx + TestData/csv/Reservations/*.csv  (test data, same content)
  Testcase/Reservations_Page_Test_Cases.xlsx                             (human-readable test cases)
Run from the repo root:  python scripts/build_reservations_page.py
"""
from sales_modules_common import st, write_testdata, write_cases, DEAL_SETTINGS, DEAL_STEPS, DEAL_UNIT, DEAL_FORM_FIELDS, DEAL_README, buyers

TD = 'TestData/Reservations_Test_Data.xlsx'
S = {}
S['Settings'] = (['Setting', 'Value', 'What it means'], [
    ['Page Title', 'Unit Reservations', 'Title of the page'],
    ['Search Placeholder', 'Search reservation, customer, unit', 'Search box of the Reservation Register'],
    ['Export Button', 'Export', 'Export of the register'],
    ['Pending Heading', 'Pending My Approval', 'Table of reservations waiting for the signed-in approver'],
    ['Not Sent Pattern', 'Not sent', 'ERP SYNC text of a reservation that has not reached ERP'],
    ['Requested Status', 'Requested', ''], ['Approved Status', 'Approved', ''],
    ['Converted Status', 'Converted to Contract', ''], ['Cancelled Status', 'Cancelled', ''],
    ['Value Tolerance %', '0.5', 'Allowed difference between amounts shown rounded'],
    ['Erp Sync Caption', 'ERP SYNC', 'Summary tile of the reservation panel with the ERP sync state'],
    ['Erp Retry Button', 'Retry ERP Sync', 'Button that sends an approved reservation to ERP again (offered when a sync has not gone through)'],
    ['Unit Status After Cancel', 'Available', 'Inventory status of the unit once its reservation is cancelled'],
])
S['Deal Settings'] = (['Setting', 'Value', 'What it means'], DEAL_SETTINGS)
S['Card Rules'] = (['Card', 'Statuses', 'Measure'], [
    ['All Reservations', 'all', 'count'],
    ['Active', 'Approved', 'count'],  # card formula: Open Holds
    ['Converted', 'Converted to Contract', 'count'],
    ['Cancelled', 'Cancelled, Expired', 'count'],
])
S['Register Columns'] = (['Column'], [['Reservation'], ['Customer'], ['Unit'], ['Status'], ['Date'], ['Amount'], ['Created Date']])
S['Reservation Actions'] = (['Action', 'Submit Button', 'Field', 'Value'], [
    ['Cancel Reservation', 'Cancel Reservation', 'Cancellation reason', 'Buyer Withdrew'],
    ['Cancel Reservation', 'Cancel Reservation', 'Remarks', 'Buyer postponed the purchase to next year.'],
    ['Cancel Without Reason', 'Cancel Reservation', 'Remarks', 'Cancel attempted without a reason.'],
])
S['Messages'] = (['Message Key', 'Expected Text', 'Where it appears'], [
    ['Cancel Note', 'The unit is released.', 'Cancel Reservation form text'],
])
S['Count Changes'] = (['Action', 'All Reservations', 'Active', 'Cancelled'], [
    ['Create Reservation', '1', '1', '0'],
    ['Cancel Reservation', '0', '-1', '1'],
])
S['Buyers'] = buyers([
    ['BUY-01', 'Ms', 'Amelia', 'Hartley', '+44 7700 900###', '{first}.{last}.{unique}@example.co.uk', 'Referrals'],
])
S['Deal Steps'] = DEAL_STEPS
S['Deal Unit'] = DEAL_UNIT
S['Deal Form Fields'] = DEAL_FORM_FIELDS
README = [
    'Test data for the Reservations page suite (tests/reservations-page). Nothing the tests type or expect is written in the code.',
    'Default source: this Excel file. Set TEST_DATA_FORMAT=csv to use TestData/csv/Reservations/<sheet>.csv instead. Rebuild both with: python scripts/build_reservations_page.py',
    *DEAL_README,
    'Per run the suite creates ONE deal with an approved reservation on a new test unit (ERP sync is checked on it), then cancels that reservation.',
]
write_testdata('Reservations_Test_Data.xlsx', 'Reservations', 'Reservations — Test Data', README, S)

cases = []
def C(id, uc, area, title, pre, steps, data, exp, pri='High', kind='Positive', auto='Automated'):
    cases.append([id, uc, area, title, pre, steps, data, exp, pri, kind, auto])
OPEN = 'Open Reservations (main menu → Reservations)'
ADMIN = 'Signed in as CRM Administrator'
DEAL = 'A deal built by the test: buyer → opportunity at Reservation Ready → reservation on a new test unit'
UC1, UC2, UC3 = 'RUC-01 Reservation register & cards', 'RUC-02 Cancellation', 'RUC-03 ERP synchronisation'

A = 'Register & Cards'
C('RSV-001', UC1, A, 'Reservations page shows its cards, approvals and register', ADMIN, st(OPEN, 'Read the cards, the Pending My Approval table and the register columns'), f'{TD} → Settings, Card Rules, Register Columns',
  'Cards All Reservations, Active, Converted, Cancelled and Amount; "Pending My Approval"; register columns Reservation, Customer, Unit, Status, Date, Amount, Created Date; New Reservation and Export.', 'Medium')
C('RSV-002', UC1, A, 'All Reservations card = reservations in the register', ADMIN, st(OPEN, 'Read All Reservations', 'Read "Showing … of N reservations"'), f'{TD} → Card Rules', 'All Reservations = N.')
C('RSV-003', UC1, A, 'All Reservations = Active + Converted + Cancelled', ADMIN, st(OPEN, 'Read the four cards and the formula under All Reservations'), '—',
  'All Reservations equals Active + Converted + Cancelled, as its formula line says.', kind='Consistency')
C('RSV-004', UC1, A, 'Active / Converted / Cancelled cards = register by status', ADMIN, st(OPEN, 'Count register rows per status (all pages)'), f'{TD} → Card Rules', 'Each card equals the rows with its statuses.')
C('RSV-005', UC1, A, 'Pending My Approval lists the requested reservations', ADMIN, st(OPEN, 'Read Pending My Approval', 'Count register rows with status Requested'), f'{TD} → Settings (Pending Heading, Requested Status)',
  'Every pending row is a Requested reservation of the register; the number of rows equals the Requested count.', 'Medium')
C('RSV-006', UC1, A, 'Search the register', DEAL, st(OPEN, 'Search the reservation number, the buyer and the unit'), f'{TD} → Settings (Search Placeholder)', 'Each search lists the reservation; every row contains the text.', 'Medium')
C('RSV-007', UC1, A, 'Export matches the register', ADMIN, st(OPEN, 'Click Export'), '—', 'One row per reservation of the register, including the reservation numbers listed.', 'Medium')

A = 'Cancellation'
C('RSV-011', UC2, A, 'Cancel needs a reason', DEAL, st('Open the reservation → Cancel Reservation without a reason → Cancel Reservation'), f'{TD} → Reservation Actions (Cancel Without Reason)', 'A message asks for the reason (or the button stays disabled); the reservation is not cancelled.', 'Medium', 'Negative')
C('RSV-012', UC2, A, 'Cancel a reservation', DEAL, st(OPEN, 'Read the cards', 'Open the reservation → Cancel Reservation (reason, remarks)', 'Read the cards; open Inventory → Units and search the unit'), f'{TD} → Reservation Actions (Cancel Reservation), Count Changes (Cancel Reservation), Settings (Unit Status After Cancel)',
  'Status Cancelled with the reason in History; cards change as on Count Changes; the unit is Available again.')

A = 'ERP Sync'
C('RSV-021', UC3, A, 'Approved reservation shows its ERP sync state', DEAL + ', approved', st('Open the reservation', 'Read ERP SYNC and History'), f'{TD} → Settings (Erp Sync Caption)',
  'ERP SYNC no longer says "Not sent": approving sends the reservation to ERP (the tile itself says "sent on approval").')
C('RSV-022', UC3, A, 'Retry ERP Sync', DEAL + ', approved, ERP sync not yet sent', st('Open the reservation → Retry ERP Sync'), f'{TD} → Settings (Erp Retry Button)',
  'A message confirms the retry; ERP SYNC changes (or History records a new sync attempt).', 'Medium')

IMPACT = {
    'RSV-002': 'The card does not match the register, so management sees a wrong number of reservations.',
    'RSV-003': 'The card value and its own formula disagree, so users cannot tell what is counted.',
    'RSV-004': 'Active / converted / cancelled reservations are misreported.',
    'RSV-012': 'A cancelled reservation keeps its unit blocked (or is not recorded), so the unit cannot be sold again.',
    'RSV-021': 'Finance cannot see whether a reservation deposit reached ERP.',
    'RSV-022': 'A failed ERP sync cannot be repeated, so ERP misses the reservation.',
}
AREA_IMPACT = {'Register & Cards': 'Reservation figures cannot be trusted.', 'Cancellation': 'Cancelling does not free the unit or is not recorded.', 'ERP Sync': 'Reservations do not reach ERP reliably.'}
OVERVIEW = [
    ('Scope', 'Reservations page (/reservations): cards, Pending My Approval, Reservation Register (search, export), Cancel Reservation and ERP sync on the reservation panel.'),
    ('Use cases', 'RUC-01 register & cards · RUC-02 cancellation · RUC-03 ERP synchronisation'),
    ('Test data', f'{TD} (or TestData/csv/Reservations/*.csv with TEST_DATA_FORMAT=csv). No figures are hard-coded.'),
    ('Automation', 'tests/reservations-page/*.spec.ts — run with: npm run test:reservations-page'),
    ('Report', 'reports/Reservations_Page_Test_Report_<date>_<time>.xlsx'),
    ('Data created', 'Per run: 1 buyer, 1 unit in the test project, 1 reservation (approved, synced to the QA ERP, then cancelled).'),
]
write_cases('Reservations_Page_Test_Cases.xlsx', 'Reservations Page — Test Cases', OVERVIEW, cases, [], IMPACT, AREA_IMPACT)
