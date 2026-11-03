"""Builds the Proposals page suite files:
  TestData/Proposals_Test_Data.xlsx + TestData/csv/Proposals/*.csv  (test data, same content)
  Testcase/Proposals_Page_Test_Cases.xlsx                           (human-readable test cases)
Run from the repo root:  python scripts/build_proposals_page.py
"""
from sales_modules_common import st, write_testdata, write_cases, DEAL_SETTINGS, DEAL_STEPS, DEAL_UNIT, DEAL_FORM_FIELDS, DEAL_README, buyers

TD = 'TestData/Proposals_Test_Data.xlsx'
S = {}
S['Settings'] = (['Setting', 'Value', 'What it means'], [
    ['Proposals Route', '/proposals', 'Proposals page'],
    ['Page Title', 'Proposal Workspace', 'Title of the page'],
    ['Search Placeholder', 'Search proposal, opportunity, customer, unit', 'Search box of the Proposal Register'],
    ['Currency Note', 'All proposal amounts are captured in base currency (USD).', 'Line under the New Proposal title'],
    ['Base Currency', 'USD', 'Deal Currency shown in the form'],
    ['Validity Days', '14', 'Valid Until proposed by the form = today + this many days'],
    ['Remarks Template', 'Proposal from reservation {reservation}.', 'Remarks the form fills in from the reservation'],
    ['Proposal No. Format', 'PRO-YYYYMMDDhhmmss-XXXX', 'Proposal number: Y M D h m s = digits, X = letter or digit'],
    ['Discount Percent', '5', 'Discount used in the discount calculation test'],
    ['Customer Status After Accept', 'Customer', 'Status the buyer gets on Customers & Brokers once a proposal is accepted'],
    ['Customers Search Placeholder', 'Search', 'Start of the placeholder of the Customer Register search'],
    ['Pricing Audit Heading', 'Pricing Audit', 'Block of Proposal Detail with the price source'],
    ['List Price Source Label', 'List price source', 'Pricing Audit line with the list price'],
    ['Exchange Rate Text', '1 USD = 1.0000 USD', 'Pricing Audit: exchange rate of a USD deal'],
    ['Approval History Heading', 'Approval History', 'Block of Proposal Detail with Submitted / Approved entries'],
    ['No Approval Text', 'No approval action captured.', 'Approval History of a new proposal'],
    ['Draft Status', 'Draft', ''], ['Submitted Status', 'Submitted', ''], ['Approved Status', 'Approved', ''],
    ['Accepted Status', 'Accepted', ''], ['Superseded Status', 'Superseded', ''], ['Rejected Status', 'Rejected', 'Status the app gives a rejected proposal (the test expects Draft, as the form says)'],
])
S['Deal Settings'] = (['Setting', 'Value', 'What it means'], DEAL_SETTINGS)
S['Card Rules'] = (['Card', 'Statuses', 'Measure'], [
    ['Total', 'all', 'count'],
    ['Needs Approval', 'Submitted', 'count'],
    ['Approved', 'Approved, Accepted', 'count'],
    ['Proposal Value', 'Draft, Submitted, Approved, Accepted', 'sum of Proposed'],
])
S['Register Columns'] = (['Column'], [['Proposal'], ['Customer'], ['Unit'], ['Status'], ['Discount'], ['Proposed'], ['Created Date']])
S['Form Fields'] = (['Field Label', 'Field Name', 'Field Type', 'Mandatory'], [
    ['Opportunity', 'opportunityId', 'Dropdown', 'Yes'],
    ['Unit', 'unitId', 'Dropdown', 'Yes'],
    ['List Price (USD)', 'listPrice', 'Text', 'No'],
    ['Proposed Price (USD)', 'proposedPrice', 'Text', 'Yes'],
    ['Discount Amount (USD)', 'discountAmount', 'Read-only', 'No'],
    ['Discount %', 'discountPercent', 'Read-only', 'No'],
    ['Remarks', 'remarks', 'Text', 'No'],
])
S['Invalid Prices'] = (['Case ID', 'Proposed Price', 'Why it is wrong', 'Expected'], [
    ['PRO-016', '', 'Empty', 'Not saved; a message asks for the proposed price'],
    ['PRO-016', 'abc', 'Letters', 'Not saved; a message says the price must be a number'],
    ['PRO-016', '-25000', 'Negative', 'Not saved; a message says the price must be more than 0'],
    ['PRO-016', '0', 'Zero', 'Not saved; a message says the price must be more than 0'],
])
S['Proposal Actions'] = (['Action', 'Submit Button', 'Field', 'Value'], [
    ['Submit', 'Submit Proposal', 'Action remarks', 'Pricing confirmed with the buyer.'],
    ['Approve', 'Approve Proposal', 'Action remarks', 'Discount within the approval limit.'],
    ['Accept', 'Accept Proposal', 'Action remarks', 'Buyer confirmed by email.'],
    ['Reject', 'Reject Proposal', 'Rejection reason', 'Proposed price is below the floor price; please revise.'],
    ['Replace', 'Replace Proposal', 'Reason for replacing', 'Buyer asked for a lower price after the site visit.'],
    ['Replace', 'Replace Proposal', 'Proposed price (USD)', '{list-3%}'],
])
S['Workflow Stages'] = (['Stage'], [['Draft'], ['Submitted'], ['Approved'], ['Accepted'], ['Moved to Contract']])
S['Messages'] = (['Message Key', 'Expected Text', 'Where it appears'], [
    ['Opportunity Required Title', 'Opportunity Required', 'Pop-up when New Proposal is saved without an opportunity'],
    ['Opportunity Required Body', 'Select an opportunity.', 'Same pop-up'],
    ['Approve Confirm Title', 'Approve proposal?', 'Confirmation before approving'],
    ['Go Back', 'Go back', 'Button that cancels a confirmation'],
    ['After Submit', 'AFTER SUBMIT', 'State of Approve / Reject on a Draft proposal'],
    ['Already', 'ALREADY', 'State of an action already done (ALREADY SUBMITTED / ALREADY APPROVED)'],
    ['Move To Contract', 'Move to Contract', 'Offered on an accepted proposal'],
])
S['Count Changes'] = (['Action', 'Total', 'Needs Approval', 'Approved'], [
    ['Create Proposal', '1', '0', '0'],
    ['Submit', '0', '1', '0'],
    ['Reject', '0', '-1', '0'],
    ['Approve', '0', '-1', '1'],
    ['Accept', '0', '0', '0'],
    ['Replace Draft', '1', '0', '0'],
])
S['Buyers'] = buyers([
    ['BUY-01', 'Mr', 'Oliver', 'Bennett', '+44 7700 900###', '{first}.{last}.{unique}@example.co.uk', 'Referrals'],
    ['BUY-02', 'Ms', 'Charlotte', 'Hayes', '+44 7700 900###', '{first}.{last}.{unique}@example.co.uk', 'Referrals'],
    ['BUY-03', 'Mr', 'Daniel', 'Okafor', '+44 7700 900###', '{first}.{last}.{unique}@example.co.uk', 'Referrals'],
])
S['Deal Steps'] = DEAL_STEPS
S['Deal Unit'] = DEAL_UNIT
S['Deal Form Fields'] = DEAL_FORM_FIELDS
README = [
    'Test data for the Proposals page suite (tests/proposals-page). Nothing the tests type or expect is written in the code: it is all here.',
    'Default source: this Excel file. Set TEST_DATA_FORMAT=csv to use TestData/csv/Proposals/<sheet>.csv instead. Rebuild both with: python scripts/build_proposals_page.py',
    'Yellow cells can be edited. Keep the column headers as they are.',
    *DEAL_README,
    'Card Rules: which proposal statuses each KPI card counts (or sums). Count Changes: expected change of each card after an action.',
    'Invalid Prices: each row runs as its own sub-case PRO-016.n.',
    '{list-3%} = the list price less 3%.',
]
write_testdata('Proposals_Test_Data.xlsx', 'Proposals', 'Proposals — Test Data', README, S)

# ── Test cases ───────────────────────────────────────────────────────────────
cases = []
def C(id, uc, area, title, pre, steps, data, exp, pri='High', kind='Positive', auto='Automated'):
    cases.append([id, uc, area, title, pre, steps, data, exp, pri, kind, auto])

OPEN = 'Open Proposals (main menu → Proposals)'
ADMIN = 'Signed in as CRM Administrator'
DEAL = 'A deal built by the test: buyer → opportunity at Reservation Ready → approved reservation on a test unit'
UC1, UC2, UC3 = 'PUC-01 Proposal register & counts', 'PUC-02 Create a proposal', 'PUC-03 Proposal approval workflow'

A = 'Page & Counts'
C('PRO-001', UC1, A, 'Proposals page shows its cards and register', ADMIN, st(OPEN, 'Read the title, the cards and the register columns'), f'{TD} → Settings (Page Title), Card Rules, Register Columns',
  'Title "Proposal Workspace"; cards Total, Needs Approval, Approved and Proposal Value; register columns Proposal, Customer, Unit, Status, Discount, Proposed, Created Date; a New Proposal button.', 'Medium')
C('PRO-002', UC1, A, 'Total card = proposals in the register', ADMIN, st(OPEN, 'Read Total', 'Read "Showing … of N proposals"'), f'{TD} → Card Rules',
  'Total equals N.')
C('PRO-003', UC1, A, 'Needs Approval card = submitted proposals', ADMIN, st(OPEN, 'Read Needs Approval', 'Count the register rows with the statuses on Card Rules'), f'{TD} → Card Rules (Needs Approval)',
  'Needs Approval equals the number of proposals waiting for approval (status Submitted).')
C('PRO-004', UC1, A, 'Approved card = approved and accepted proposals', ADMIN, st(OPEN, 'Read Approved', 'Count the register rows with the statuses on Card Rules'), f'{TD} → Card Rules (Approved)',
  'Approved equals the number of Approved + Accepted proposals.')
C('PRO-005', UC1, A, 'Proposal Value card = total of live proposals', ADMIN, st(OPEN, 'Read Proposal Value', 'Add up Proposed of the rows with the statuses on Card Rules (superseded proposals left out)'), f'{TD} → Card Rules (Proposal Value)',
  'Proposal Value equals that total (within rounding).')
C('PRO-006', UC1, A, 'Search the register', DEAL + '; a proposal created by the test', st(OPEN, 'Search by the proposal number, then by the buyer, then by the unit code'), f'{TD} → Settings (Search Placeholder)',
  'Each search lists the proposal; every row listed contains the text searched.', 'Medium')
C('PRO-007', UC1, A, 'Register row matches the proposal detail', 'A proposal created by the test', st(OPEN, 'Read the proposal row', 'Click the proposal number'), '—',
  'Proposal Detail shows the same opportunity, unit, status, proposed price and discount as the row.', 'Medium')

A = 'Create Proposal'
C('PRO-011', UC2, A, 'New Proposal form shows its fields', ADMIN, st(OPEN, 'Click New Proposal'), f'{TD} → Form Fields, Settings (Currency Note, Base Currency)',
  'Form "Create Proposal" with the currency note, Opportunity, Unit, Deal Currency = USD (read-only), List Price, Proposed Price, Discount Amount and Discount % (read-only), Valid Until and Remarks.', 'Medium')
C('PRO-012', UC2, A, 'Only opportunities with an approved reservation are offered', DEAL + '; a second opportunity at Reservation Ready without a reservation', st(OPEN, 'New Proposal → open Opportunity'), '—',
  'The deal\'s opportunity is offered; the opportunity without a reservation is not.')
C('PRO-013', UC2, A, 'Proposal without opportunity is not saved', ADMIN, st(OPEN, 'New Proposal → Create Proposal without choosing anything'), f'{TD} → Messages (Opportunity Required)',
  'Pop-up "Opportunity Required" — "Select an opportunity."; nothing is created.', kind='Negative')
C('PRO-014', UC2, A, 'Choosing the opportunity fills the proposal from the reservation', DEAL, st(OPEN, 'New Proposal → choose the deal\'s opportunity', 'Read every field'), f'{TD} → Settings (Validity Days, Remarks Template)',
  'Unit = the reserved unit; List Price = the unit price; Proposed Price = List Price; Discount 0 / 0%; Valid Until = today + Validity Days; Remarks = "Proposal from reservation <RSV no.>."')
C('PRO-015', UC2, A, 'Discount is calculated from the proposed price', DEAL, st(OPEN, 'New Proposal → choose the deal\'s opportunity', 'Enter a proposed price Discount Percent below the list price'), f'{TD} → Settings (Discount Percent)',
  'Discount Amount = List − Proposed; Discount % = Discount Amount ÷ List Price (rounded as shown).')
C('PRO-016', UC2, A, 'Invalid proposed price is refused', DEAL, st(OPEN, 'New Proposal → choose the deal\'s opportunity', 'Enter the proposed price of the data row', 'Create Proposal'), f'{TD} → Invalid Prices',
  'Each row: the proposal is not saved; a message explains the price is required / must be a positive number.', kind='Negative')
C('PRO-017', UC2, A, 'Create a proposal', DEAL, st(OPEN, 'Read the cards', 'New Proposal → choose the deal\'s opportunity (fields as filled in)', 'Create Proposal'), f'{TD} → Count Changes (Create Proposal), Settings (Proposal No. Format)',
  'A proposal number PRO-… is listed first with the buyer, the unit, status Draft and the proposed price; Total +1 (other cards as on Count Changes).')

A = 'Workflow'
C('PRO-021', UC3, A, 'A new proposal is a Draft waiting to be submitted', 'A proposal created by the test', st(OPEN, 'Open the proposal'), f'{TD} → Workflow Stages, Messages (After Submit)',
  'Status Draft; workflow Draft IN PROGRESS, other stages UP NEXT; Approve and Reject show "AFTER SUBMIT"; Approval History has no entries.')
C('PRO-022', UC3, A, 'Accept is not offered before approval', 'A Draft proposal created by the test', st(OPEN, 'Open the proposal', 'Look at Accept Proposal'), '—',
  'Accept Proposal cannot be used while the proposal is a Draft or Submitted (only after approval).', kind='Negative')
C('PRO-023', UC3, A, 'Submit a proposal', 'A Draft proposal created by the test', st(OPEN, 'Read the cards', 'Open the proposal → Submit Proposal (Action remarks)', 'Re-open it'), f'{TD} → Proposal Actions (Submit), Count Changes (Submit)',
  'Status Submitted; Approval History lists "Submitted"; Approve / Reject become available; cards change as on Count Changes.')
C('PRO-024', UC3, A, 'Reject needs a reason', 'A Submitted proposal created by the test', st(OPEN, 'Open the proposal → Reject Proposal without a reason'), '—',
  'The reason is asked for (a message or "Please fill out this field." on the field); the proposal stays Submitted.', 'Medium', 'Negative')
C('PRO-025', UC3, A, 'Reject returns the proposal to Draft', 'A Submitted proposal created by the test', st(OPEN, 'Open the proposal → Reject Proposal with the reason', 'Re-open it'), f'{TD} → Proposal Actions (Reject), Count Changes (Reject)',
  'Status Draft; the reason is shown in Approval History; cards change as on Count Changes.')
C('PRO-026', UC3, A, 'Approve asks for confirmation; Go back keeps it Submitted', 'A Submitted proposal created by the test', st(OPEN, 'Open the proposal → Approve Proposal', 'Click Go back'), f'{TD} → Messages (Approve Confirm Title, Go Back)',
  'Confirmation "Approve proposal?" naming the proposal; after Go back the status is still Submitted.', 'Medium')
C('PRO-027', UC3, A, 'Approve a proposal', 'A Submitted proposal created by the test', st(OPEN, 'Read the cards', 'Open the proposal → Approve Proposal → Approve'), f'{TD} → Proposal Actions (Approve), Count Changes (Approve)',
  'Status Approved; Approval History lists "Approved"; Submit and Approve show ALREADY …; cards change as on Count Changes.')
C('PRO-028', UC3, A, 'Accept a proposal', 'An Approved proposal created by the test', st(OPEN, 'Open the proposal → Accept Proposal', 'Re-open it'), f'{TD} → Proposal Actions (Accept), Workflow Stages',
  'Status Accepted; every workflow stage DONE including Moved to Contract; "Move to Contract" offers the reservation and the accepted price.')
C('PRO-029', UC3, A, 'Accepting makes the buyer a customer', 'The proposal accepted in PRO-028', st('Open Customers & Brokers', 'Find the buyer'), f'{TD} → Settings (Customer Status After Accept)',
  'The buyer is listed with status Customer.', 'Medium')
C('PRO-030', UC3, A, 'Replace needs a reason', 'A Draft proposal created by the test', st(OPEN, 'Open the proposal → Replace Proposal without a reason'), '—',
  'The reason is asked for (a message or "Please fill out this field." on the field); no new proposal is created.', 'Medium', 'Negative')
C('PRO-031', UC3, A, 'Replace a proposal', 'A Draft proposal created by the test', st(OPEN, 'Read the cards', 'Open the proposal → Replace Proposal with a new price and the reason'), f'{TD} → Proposal Actions (Replace), Count Changes (Replace Draft)',
  'A new Draft proposal with the new price is listed; the old one is Superseded; cards change as on Count Changes.')
C('PRO-032', UC3, A, 'Pricing Audit shows where the price comes from', 'A proposal created by the test', st(OPEN, 'Open the proposal → Pricing Audit'), '—',
  'List price source = the unit price; the reservation number and amount are shown; equivalent currency USD with rate 1.0000.', 'Medium')
C('PRO-033', UC3, A, 'Copy link opens the same proposal', 'A proposal created by the test', st(OPEN, 'Open the proposal → Copy link', 'Open the copied link'), '—',
  'The link opens Proposal Detail of the same proposal.', 'Low')

FINDINGS = [
    ['F-01', 'Defect', 'PRO-016', 'Proposal saved with an empty, text or zero proposed price', 'Create Proposal with Proposed Price empty, "abc" or "0" saves a Draft proposal (empty: proposed taken from the opportunity budget, discount shown as 0).', 'The form refuses a proposed price that is not a positive number.', 'High'],
    ['F-02', 'Defect', 'PRO-025', 'Rejected proposal does not go back to Draft', 'The Reject form says "The proposal goes back to Draft for revision", but the status becomes "Rejected".', 'Status Draft (or the form text corrected).', 'Medium'],
    ['F-03', 'To confirm', 'PRO-003, PRO-017, PRO-023', 'Needs Approval counts Draft proposals', 'Creating a Draft raises Needs Approval by 1; submitting it does not change the card.', 'Only Submitted proposals need approval.', 'Medium'],
    ['F-04', 'To confirm', 'PRO-005', 'Proposal Value includes superseded proposals', 'Proposal Value is higher than the total of live proposals by the value of the Superseded ones.', 'Superseded proposals left out of the value.', 'Medium'],
]
OVERVIEW = [
    ('Scope', 'Proposals page (/proposals): KPI cards, Proposal Register, New Proposal, Proposal Detail (Submit, Approve, Reject, Accept, Replace, Pricing Audit, Approval History, Copy link).'),
    ('Use cases', 'PUC-01 register & counts · PUC-02 create a proposal · PUC-03 approval workflow'),
    ('Test data', f'{TD} (or TestData/csv/Proposals/*.csv with TEST_DATA_FORMAT=csv). No values are hard-coded in the tests.'),
    ('Automation', 'tests/proposals-page/*.spec.ts — run with: npm run test:proposals-page'),
    ('Report', 'reports/Proposals_Page_Test_Report_<date>_<time>.xlsx'),
    ('Data created', 'Per run: 2 buyers (leads → opportunities), 1 unit in the test project, 1 approved reservation and the proposals of the tests. Real units are never reserved. Buyers use fictional phone numbers.'),
    ('Security', 'Out of scope for this module (covered by the Security suite).'),
]
AREA_IMPACT = {
    'Page & Counts': 'The Proposals cards do not match the register, so management sees wrong numbers of proposals waiting for approval or a wrong pipeline value.',
    'Create Proposal': 'Proposals can be created with wrong prices or without the needed data, so customers may receive wrong commercial offers.',
    'Workflow': 'The approval workflow does not control proposals as intended (submit, approve, reject, accept), so unapproved prices could reach customers.',
}
IMPACT = {
    'PRO-016': 'A proposal is saved even when the proposed price is empty, text or zero: a commercial offer with a wrong price can be sent to the customer.',
    'PRO-022': 'A proposal can be marked accepted before anyone approved it, bypassing the commercial approval.',
    'PRO-025': 'A rejected proposal ends in "Rejected" although the form says it goes back to Draft for revision, so salespeople do not know how to correct and resubmit it.',
    'PRO-003': 'Needs Approval counts proposals that were never submitted, so approvers see work that is not waiting for them.',
    'PRO-005': 'Proposal Value includes proposals that were replaced, so the pipeline value is overstated.',
}
write_cases('Proposals_Page_Test_Cases.xlsx', 'Proposals Page — Test Cases', OVERVIEW, cases, FINDINGS, IMPACT, AREA_IMPACT)
