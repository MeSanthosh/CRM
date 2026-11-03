"""Builds the SPA / Sales Contracts page suite files:
  TestData/Contracts_Test_Data.xlsx + TestData/csv/Contracts/*.csv  (test data, same content)
  Testcase/SPA_Contracts_Page_Test_Cases.xlsx                       (human-readable test cases)
Run from the repo root:  python scripts/build_contracts_page.py
"""
from sales_modules_common import st, write_testdata, write_cases, DEAL_SETTINGS, DEAL_STEPS, DEAL_UNIT, DEAL_FORM_FIELDS, DEAL_README, buyers

TD = 'TestData/Contracts_Test_Data.xlsx'
S = {}
S['Settings'] = (['Setting', 'Value', 'What it means'], [
    ['Contracts Route', '/spa-contracts', 'SPA / Sales Contracts page'],
    ['Proposals Route', '/proposals', 'Proposals page (the deal needs an accepted proposal)'],
    ['Page Title', 'SPA / Sales Contracts', 'Title of the page'],
    ['Search Placeholder', 'Search contract, reservation, customer, unit', 'Search box of the Contract Register'],
    ['Form Note', 'Create a draft contract from an approved reservation.', 'Line under the New Contract title'],
    ['Expected Default Currency', 'USD - United States Dollar', 'Currency the New Contract form should start with (the deal currency)'],
    ['Contract No. Format', 'CON-YYYYMMDDhhmmss-XXXX', 'Contract number: Y M D h m s = digits, X = letter or digit'],
    ['Draft Status', 'Draft', ''], ['Issued Status', 'Issued', ''], ['Signed Status', 'Signed', ''],
    ['Superseded Status', 'Superseded', ''], ['Cancelled Status', 'Cancelled', ''],
    ['ERP Not Ready', 'NOT_READY', 'ERP column / ERP HANDOFF before the handoff'],
    ['ERP Ready', 'READY', 'After Move to Handoff'],
    ['ERP Handed Off', 'HANDED_OFF', 'After Send to ERP'],
    ['Reservation Status After Contract', 'Converted to Contract', 'Reservation status once a contract is created from it'],
    ['Unit Status After Signing', 'Sold', 'Inventory status of the unit once the contract is signed'],
    ['KYC Approved Status', 'Approved', 'Buyer KYC needed before signing'],
    ['Accepted Proposal Status', 'Accepted', 'Proposal status needed before a contract'],
    ['Value Tolerance %', '0.5', 'Allowed difference between amounts shown rounded'],
    ['New Contract Button', 'New Contract', 'Opens the New Contract form'],
    ['Create Contract Button', 'Create Contract', 'Saves the New Contract form'],
    ['Export Button', 'Export', 'Contract Register export'],
    ['Due Date Label', 'Due Date', 'Label of each stage due date in the payment plan'],
    ['Deposit Label', 'STAGE 1 · RESERVATION DEPOSIT', 'Payment plan summary: the reservation deposit'],
    ['Balance Label', 'BALANCE TO SCHEDULE', 'Payment plan summary: SPA − deposit'],
    ['Plan Total Line', 'Deposit', 'Start of the line "Deposit x% + Stages y% = z%"'],
    ['Refresh Wait Seconds', '120', 'After a change the cards may update with a delay: wait up to this long (the delay is recorded in the report)'],
    ['Plan Wait Seconds', '180', 'After "Payment Plan Saved" the contract may show the plan with a delay: wait up to this long'],
    ['Agreed Pack Complete', '4/4 complete', 'Agreed Pack once reservation, proposal, plan and agreement are done'],
    ['Page Size', '20', 'Contracts per register page ("Showing 1–20 of N")'],
    ['Total Card', 'Total', 'Card whose formula line splits the total by status (SPC-037)'],
    ['Documents Heading', 'Documents', 'Contract Detail block for contract documents'],
    ['No Documents Text', 'No documents uploaded yet.', 'Documents block before any upload'],
    ['Document Rule Text', 'PDF, JPG or PNG, up to 10 MB.', 'Hint under the Documents upload'],
    ['Upload Button', 'Upload', 'Documents block: upload button'],
    ['History Heading', 'History', 'Contract Detail block listing every change'],
    ['History Changed Words', 'changed to', 'History line between the old and the new value'],
    ['History Created Word', 'Created', 'History entry of the creation'],
    ['History Status Field', 'Contract status', 'History field that records status changes'],
    ['History User', 'CRM Administrator', 'User shown on the changes made by the tests (the signed-in user)'],
])
S['Sort Columns'] = (['Column', 'Kind'], [
    ['Contract', 'text'], ['Customer', 'text'], ['Unit', 'text'], ['Status', 'text'], ['Value', 'number'], ['ERP', 'text'], ['Created Date', 'date'],
])
S['Total Breakdown'] = (['Part', 'Statuses', 'Card'], [
    ['Draft/Issued', 'Draft, Issued', 'Draft / Issued'],
    ['Signed', 'Signed', 'Signed'],
    ['Canc.', 'Cancelled, Superseded', ''],
])
S['Contract Documents'] = (['Case ID', 'Document Type', 'Description', 'File', 'Expected'], [
    ['SPC-039', 'Signed SPA', 'Signed SPA uploaded by the CRM test suite', 'TestData/files/Sample_Passport_Copy.pdf', 'Accepted'],
    ['SPC-040', 'Other', 'Wrong file type (text file)', 'TestData/files/Sample_Not_Allowed.txt', 'Refused'],
])
S['Deal Settings'] = (['Setting', 'Value', 'What it means'], DEAL_SETTINGS)
S['Card Rules'] = (['Card', 'Statuses', 'Measure'], [
    ['Total', 'all', 'count'],
    ['Draft / Issued', 'Draft, Issued', 'count'],
    ['Signed', 'Signed', 'count'],
    ['Value', 'Signed', 'sum of Value'],
])
S['Register Columns'] = (['Column'], [['Contract'], ['Customer'], ['Unit'], ['Status'], ['Value'], ['ERP'], ['Created Date']])
S['Form Fields'] = (['Field Label', 'Field Name', 'Field Type', 'Mandatory'], [
    ['Approved Reservation', 'reservationId', 'Dropdown', 'Yes'],
    ['Contract Value', 'contractValue', 'Text', 'Yes'],
    ['Currency', 'currencyCode', 'Dropdown', 'Yes'],
    ['Remarks', 'remarks', 'Text', 'No'],
])
S['Invalid Values'] = (['Case ID', 'Contract Value', 'Why it is wrong', 'Expected'], [
    ['SPC-015', '', 'Empty', 'Not saved; a message asks for the contract value'],
    ['SPC-015', 'abc', 'Letters', 'Not saved; a message says the value must be a number'],
    ['SPC-015', '-1000', 'Negative', 'Not saved; a message says the value must be more than 0'],
    ['SPC-015', '0', 'Zero', 'Not saved; a message says the value must be more than 0'],
])
S['Proposal Steps'] = (['Action', 'Submit Button', 'Field', 'Value'], [
    ['Submit', 'Submit Proposal', 'Action remarks', 'Pricing confirmed with the buyer.'],
    ['Approve', 'Approve Proposal', 'Action remarks', 'Discount within the approval limit.'],
    ['Accept', 'Accept Proposal', 'Action remarks', 'Buyer confirmed by email.'],
])
S['Contract Actions'] = (['Action', 'Submit Button', 'Field', 'Value'], [
    ['Issue', '1. Issue Contract', 'Issue remarks', 'Issued for buyer signature.'],
    ['Replace', 'Replace Contract', 'Reason for replacing', 'Contract value corrected to the accepted proposal price.'],
    ['Replace', 'Replace Contract', 'Contract Value', '{list-2%}'],
    ['Replace', 'Replace Contract', 'Currency', 'USD - United States Dollar'],
    ['Cancel', 'Cancel Contract', 'Cancellation remarks', 'Buyer withdrew before signing.'],
    ['Open Plan', '2. Open / Save Payment Plan', '', ''],
    ['Plan Notes', 'Save Payment Plan', 'remarks', 'Standard plan agreed with the buyer.'],
    ['Sign', '3. Sign Contract', '', ''],
    ['Handoff', 'Move to Handoff', '', ''],
    ['Send to ERP', 'Send to ERP', '', ''],
])
S['Payment Plan'] = (['Stage No', 'Due In Days', 'Wrong Percentage', 'Percentage Field Name'], [
    ['2', '7', '', 'stages.0.percentage'], ['3', '90', '', 'stages.1.percentage'], ['4', '180', '', 'stages.2.percentage'], ['5', '365', '10', 'stages.3.percentage'],
])
S['Taxes'] = (['Tax', 'Percent of SPA'], [['VAT on Unit', '16'], ['Stamp Duty', '4']])
S['KYC Document'] = (['Field', 'Value'], [
    ['Type', 'Passport'], ['Number', 'P#######'], ['Expiry', '{today+1825}'], ['File', 'TestData/files/Sample_Passport_Copy.pdf'],
])
S['Workflow Stages'] = (['Stage'], [['Draft'], ['Issued'], ['Payment Plan'], ['Signed'], ['ERP Ready'], ['Moved to ERP']])
S['Messages'] = (['Message Key', 'Expected Text', 'Where it appears'], [
    ['Reservation Required Title', 'Reservation Required', 'Pop-up when New Contract is saved without a reservation'],
    ['Reservation Required Body', 'Select an approved reservation before creating the contract.', 'Same pop-up'],
    ['Created Title', 'Contract Created', 'Pop-up after Create Contract'],
    ['Created Body', 'Contract {contract} draft is ready.', 'Same pop-up'],
    ['Issued Title', 'Contract Issued', 'Pop-up after 1. Issue Contract'],
    ['Due Date Title', 'Due Date Required', 'Payment plan saved without due dates'],
    ['Due Date Body', 'Select a due date for every installment stage.', 'Same pop-up'],
    ['Percentages Title', 'Percentages Incomplete', 'Payment plan stages not adding up to 100% of SPA'],
    ['Plan Saved Title', 'Payment Plan Saved', 'Pop-up after Save Payment Plan'],
    ['Sign Confirm Title', 'Sign contract?', 'Confirmation before signing'],
    ['Signed Title', 'Contract Signed', 'Pop-up after signing'],
    ['Handoff Ready Title', 'ERP Handoff Ready', 'Pop-up after Move to Handoff'],
    ['Replaced Title', 'Contract Replaced', 'Pop-up after Replace Contract'],
    ['Go Back', 'Go back', 'Button that cancels a confirmation'],
    ['After Issue', 'AFTER ISSUE', 'State of Sign Contract before the contract is issued'],
    ['Unavailable', 'UNAVAILABLE', 'State of an action that can no longer be used'],
    ['Sign Requirements', 'Requires Issued status, a saved Payment Plan (100% scheduled), and Buyer KYC Approved.', 'Text of step 3'],
])
S['Count Changes'] = (['Action', 'Total', 'Draft / Issued', 'Signed'], [
    ['Create Contract', '1', '1', '0'],
    ['Issue', '0', '0', '0'],
    ['Sign', '0', '-1', '1'],
    ['Replace Draft', '1', '0', '0'],
    ['Cancel Draft', '0', '-1', '0'],
])
S['Buyers'] = buyers([
    ['BUY-01', 'Mr', 'Henry', 'Lawson', '+44 7700 900###', '{first}.{last}.{unique}@example.co.uk', 'Referrals'],
    ['BUY-02', 'Ms', 'Grace', 'Wanjiru', '+44 7700 900###', '{first}.{last}.{unique}@example.co.uk', 'Referrals'],
])
S['Deal Steps'] = DEAL_STEPS
S['Deal Unit'] = DEAL_UNIT
S['Deal Form Fields'] = DEAL_FORM_FIELDS
README = [
    'Test data for the SPA / Sales Contracts page suite (tests/contracts-page). Nothing the tests type or expect is written in the code: it is all here.',
    'Default source: this Excel file. Set TEST_DATA_FORMAT=csv to use TestData/csv/Contracts/<sheet>.csv instead. Rebuild both with: python scripts/build_contracts_page.py',
    'Yellow cells can be edited. Keep the column headers as they are.',
    *DEAL_README,
    'A contract needs an accepted proposal too: the suite submits, approves and accepts one (Proposal Steps), and approves the buyer\'s KYC with the sample document of KYC Document before signing.',
    'ERP: approving the reservation, Move to Handoff and Send to ERP send the test records to the QA ERP (agreed for QA).',
    'Payment Plan: due date of each stage = today + Due In Days; "Wrong Percentage" is used once to check the 100% rule.',
    'Invalid Values: each row runs as its own sub-case SPC-015.n.',
    '{list-2%} = the accepted proposal price less 2% (value of the replacing contract).',
    'Sort Columns: Kind says how the column is compared when checking the sort order (text, number = amounts, date).',
    'Total Breakdown: parts of the Total card formula "Draft/Issued (a) + Signed (b) + Canc. (c)", the statuses each part counts and the card it must equal.',
    'Contract Documents: files uploaded to the test contract (Accepted) or that must be refused (Refused). Uploads go to the test contract only.',
]
write_testdata('Contracts_Test_Data.xlsx', 'Contracts', 'SPA / Sales Contracts — Test Data', README, S)

# ── Test cases ───────────────────────────────────────────────────────────────
cases = []
def C(id, uc, area, title, pre, steps, data, exp, pri='High', kind='Positive', auto='Automated'):
    cases.append([id, uc, area, title, pre, steps, data, exp, pri, kind, auto])

OPEN = 'Open SPA / Sales Contracts (main menu)'
ADMIN = 'Signed in as CRM Administrator'
DEAL = 'A deal built by the test: buyer → approved reservation on a test unit → accepted proposal'
UC1, UC2, UC3, UC4 = 'CUC-01 Contract register & counts', 'CUC-02 Create a contract', 'CUC-03 Issue, payment plan and signing', 'CUC-04 ERP handoff, replace and cancel'

A = 'Page & Counts'
C('SPC-001', UC1, A, 'Contracts page shows its cards and register', ADMIN, st(OPEN, 'Read the title, the cards and the register columns'), f'{TD} → Settings (Page Title), Card Rules, Register Columns',
  'Title "SPA / Sales Contracts"; cards Total, Draft / Issued, Signed and Value; register columns Contract, Customer, Unit, Status, Value, ERP, Created Date; New Contract and Export buttons.', 'Medium')
C('SPC-002', UC1, A, 'Total card = contracts in the register', ADMIN, st(OPEN, 'Read Total', 'Read "Showing … of N contracts"'), f'{TD} → Card Rules', 'Total equals N.')
C('SPC-003', UC1, A, 'Draft / Issued card = draft and issued contracts', ADMIN, st(OPEN, 'Read Draft / Issued', 'Count rows with status Draft or Issued'), f'{TD} → Card Rules', 'The card equals that count.')
C('SPC-004', UC1, A, 'Signed card = signed contracts', ADMIN, st(OPEN, 'Read Signed', 'Count rows with status Signed'), f'{TD} → Card Rules', 'The card equals that count.')
C('SPC-005', UC1, A, 'Value card = total value of signed contracts', ADMIN, st(OPEN, 'Read Value', 'Add up Value of the Signed rows'), f'{TD} → Card Rules, Settings (Value Tolerance %)', 'Value equals that total (within rounding).')
C('SPC-006', UC1, A, 'Search the register', 'A contract created by the test', st(OPEN, 'Search by the contract number, the buyer and the unit code'), f'{TD} → Settings (Search Placeholder)',
  'Each search lists the contract; every row listed contains the text searched.', 'Medium')
C('SPC-007', UC1, A, 'Export matches the register', ADMIN, st(OPEN, 'Click Export'), '—',
  'The file has one row per contract of the register (same total) and the contract numbers listed.', 'Medium')

A = 'Create Contract'
C('SPC-011', UC2, A, 'New Contract form shows its fields', ADMIN, st(OPEN, 'Click New Contract'), f'{TD} → Form Fields, Settings (Form Note)',
  'Form "Create Contract" with the note, Approved Reservation *, Contract Value, Currency and Remarks.', 'Medium')
C('SPC-012', UC2, A, 'Only approved reservations without a contract are offered', DEAL, st(OPEN, 'New Contract → open Approved Reservation'), f'{TD} → Settings (Reservation Status After Contract)',
  'The deal\'s reservation is offered; reservations already "Converted to Contract" are not.', kind='Negative')
C('SPC-013', UC2, A, 'Contract without reservation is not saved', ADMIN, st(OPEN, 'New Contract → Create Contract without choosing anything'), f'{TD} → Messages (Reservation Required)',
  'Pop-up "Reservation Required" — "Select an approved reservation before creating the contract."; nothing is created.', kind='Negative')
C('SPC-014', UC2, A, 'Choosing the reservation fills value and currency from the accepted proposal', DEAL, st(OPEN, 'New Contract → choose the deal\'s reservation', 'Read Contract Value and Currency'), f'{TD} → Settings (Expected Default Currency)',
  'Contract Value = the accepted proposal price; Currency = USD (the deal currency).')
C('SPC-015', UC2, A, 'Invalid contract value is refused', DEAL, st(OPEN, 'New Contract → choose the deal\'s reservation and USD', 'Enter the value of the data row', 'Create Contract'), f'{TD} → Invalid Values',
  'Each row: no contract is created; a message explains the value is required / must be a positive number.', kind='Negative')
C('SPC-016', UC2, A, 'Create a draft contract', DEAL, st(OPEN, 'Read the cards', 'New Contract → the deal\'s reservation, value = accepted price, USD', 'Create Contract'), f'{TD} → Messages (Created), Count Changes (Create Contract)',
  'Pop-up "Contract Created" with the CON-… number; listed as Draft with value and ERP NOT_READY; the reservation becomes "Converted to Contract"; cards change as on Count Changes.')

A = 'Issue, Plan & Sign'
C('SPC-021', UC3, A, 'Contract detail matches the deal', 'A contract created by the test', st(OPEN, 'Open the contract'), f'{TD} → Workflow Stages',
  'Reservation, opportunity, project, unit and value are those of the deal; workflow Draft IN PROGRESS; Sign shows "AFTER ISSUE"; ERP HANDOFF NOT_READY.')
C('SPC-022', UC3, A, 'Issue a contract', 'A Draft contract created by the test', st(OPEN, 'Open the contract → 1. Issue Contract (remarks)'), f'{TD} → Contract Actions (Issue), Messages (Issued Title)',
  'Pop-up "Contract Issued"; status Issued; Issue shows DONE.')
C('SPC-023', UC3, A, 'Payment plan starts from the reservation deposit', 'An Issued contract created by the test', st(OPEN, 'Open the contract → 2. Open / Save Payment Plan', 'Read the summary'), f'{TD} → Taxes',
  'Stage 1 = the reservation deposit with its % of SPA; balance = SPA − deposit; VAT and Stamp Duty = their % of SPA; the default stages add up to 100%.')
C('SPC-024', UC3, A, 'Payment plan needs a due date for every stage', 'An Issued contract created by the test', st('Payment plan → Save Payment Plan without due dates'), f'{TD} → Messages (Due Date)',
  'Pop-up "Due Date Required" — "Select a due date for every installment stage."; nothing saved.', 'Medium', 'Negative')
C('SPC-025', UC3, A, 'Payment plan must add up to 100% of SPA', 'An Issued contract created by the test', st('Payment plan → set due dates', 'Change one stage % (Wrong Percentage)', 'Save Payment Plan'), f'{TD} → Payment Plan, Messages (Percentages Title)',
  'Pop-up "Percentages Incomplete" with the current stage total; the summary line shows the wrong total; nothing saved.', 'Medium', 'Negative')
C('SPC-026', UC3, A, 'Save the payment plan', 'An Issued contract created by the test', st('Payment plan → due dates from the data, default %', 'Save Payment Plan'), f'{TD} → Payment Plan, Contract Actions (Plan Notes)',
  'Pop-up "Payment Plan Saved"; step 2 shows SAVED; Agreed Pack lists every stage with its due date, % and amount = % × SPA.')
C('SPC-027', UC3, A, 'Signing needs buyer KYC', 'An Issued contract with a saved plan; buyer KYC Not Started', st(OPEN, 'Open the contract → read step 3', 'Try 3. Sign Contract'), f'{TD} → Messages (Sign Requirements)',
  'Step 3 lists the requirements; BUYER KYC is not Approved and the contract is not signed.', kind='Negative')
C('SPC-028', UC3, A, 'Sign asks for confirmation; Go back keeps it Issued', 'Buyer KYC approved (sample passport uploaded and verified on the customer)', st(OPEN, 'Open the contract → 3. Sign Contract', 'Click Go back'), f'{TD} → KYC Document, Messages (Sign Confirm Title, Go Back)',
  'Confirmation "Sign contract?" naming the contract; after Go back the status is still Issued.', 'Medium')
C('SPC-029', UC3, A, 'Sign a contract', 'As SPC-028', st(OPEN, 'Read the cards', 'Open the contract → 3. Sign Contract → Sign Contract'), f'{TD} → Messages (Signed Title), Count Changes (Sign)',
  'Pop-up "Contract Signed"; status Signed; Replace shows UNAVAILABLE; Agreed Pack 4/4 complete; cards change as on Count Changes.')
C('SPC-030', UC3, A, 'Signed contract marks the unit as sold', 'The contract signed in SPC-029', st('Open Inventory → Units', 'Search the unit'), f'{TD} → Settings (Unit Status After Signing)',
  'The unit shows status Sold.', 'Medium')

A = 'ERP, Replace & Cancel'
C('SPC-031', UC4, A, 'Prepare the ERP handoff', 'A signed contract created by the test', st(OPEN, 'Open the contract → 4. ERP Handoff → Move to Handoff'), f'{TD} → Messages (Handoff Ready Title), Settings (ERP Ready)',
  'Pop-up "ERP Handoff Ready"; ERP column / ERP HANDOFF = READY; "Send to ERP" is offered.')
C('SPC-032', UC4, A, 'Send the contract to ERP', 'As SPC-031', st('Click Send to ERP'), f'{TD} → Settings (ERP Handed Off)',
  'ERP = HANDED_OFF; workflow Moved to ERP DONE; Cancel Contract is no longer possible.')
C('SPC-033', UC4, A, 'Replace a draft contract', 'A second deal; a Draft contract created by the test', st(OPEN, 'Read the cards', 'Open the contract → Replace Contract (value, USD, reason)'), f'{TD} → Contract Actions (Replace), Messages (Replaced Title), Count Changes (Replace Draft)',
  'Pop-up "Contract Replaced" with the new number; the new contract is Draft with the new value; the old one is Superseded; cards change as on Count Changes.')
C('SPC-034', UC4, A, 'Cancel a draft contract', 'The Draft contract from SPC-033', st(OPEN, 'Read the cards', 'Open the contract → Cancel Contract (remarks)'), f'{TD} → Contract Actions (Cancel), Count Changes (Cancel Draft)',
  'The contract shows status Cancelled; cards change as on Count Changes.')

UC5 = 'CUC-05 Register tools & contract records'
A = 'Register & Records'
C('SPC-035', UC5, A, 'Sort the register by each column', ADMIN, st(OPEN, 'Click each column header (Contract, Customer, Unit, Status, Value, ERP, Created Date) for ascending, then descending', 'Read the rows of the first page'), f'{TD} → Sort Columns',
  'The header shows the direction (aria-sort / arrow); the rows are in that order by the column (amounts by value, dates by date).', 'Medium')
C('SPC-036', UC5, A, 'Move between register pages', ADMIN, st(OPEN, 'Read "Showing 1–20 of N · Page 1 of P"', 'Click Next until the last page', 'Click Previous'), f'{TD} → Settings (Page Size)',
  'Previous is disabled on page 1 and Next on the last page; each page shows the next contracts with no repeats; the pages together hold N contracts; Previous returns to the first page.', 'Medium')
C('SPC-037', UC5, A, 'Total card formula splits the total by status', ADMIN, st(OPEN, 'Read the line under Total "Draft/Issued (a) + Signed (b) + Canc. (c)"', 'Count the register rows per status'), f'{TD} → Total Breakdown, Settings (Total Card)',
  'a + b + c = Total; a = Draft / Issued card, b = Signed card; each part equals the register rows with its statuses (Canc. = Cancelled and Superseded, as the tooltip says).', 'Medium', 'Consistency')
C('SPC-038', UC5, A, 'Copy link opens the same contract', 'A contract created by the test', st(OPEN, 'Open the contract → Copy link', 'Open the copied link'), '—',
  'The link opens Contract Detail of the same contract number.', 'Medium')
C('SPC-039', UC5, A, 'Upload a contract document', 'A contract created by the test', st(OPEN, 'Open the contract → Documents', 'Choose the type, type the description, choose the file', 'Upload'), f'{TD} → Contract Documents (SPC-039), Settings (Document Rule Text)',
  'The document is listed under Documents with its file name and type; "No documents uploaded yet." is gone.')
C('SPC-040', UC5, A, 'A file of a type not allowed is refused', 'A contract created by the test', st(OPEN, 'Open the contract → Documents', 'Choose the text file of the data', 'Upload'), f'{TD} → Contract Documents (SPC-040), Settings (Document Rule Text)',
  'A message says only PDF, JPG or PNG up to 10 MB are accepted; the file is not listed.', 'Medium', 'Negative')
C('SPC-041', UC5, A, 'History records every change of the contract', 'The contract taken through issue and signing by the test', st(OPEN, 'Open the contract → History', 'Read the entries'), f'{TD} → Settings (History …)',
  'One entry for the creation and one per change with user and time; the status changes Draft → Issued → Signed are listed with "changed to"; the latest status equals the register.', 'Medium')

FINDINGS = [
    ['F-01', 'Defect', 'SPC-015', 'Contract saved with letters as the value', 'Create Contract with Contract Value "abc" saved a Draft contract valued 324.32 USD.', 'Only a positive number is accepted.', 'High'],
    ['F-02', 'Defect', 'SPC-014', 'Contract value not pre-filled and currency defaults to KES', 'Choosing the reservation leaves Contract Value empty and Currency KES, although the accepted proposal is 0.45M USD.', 'Value = accepted proposal price; currency = deal currency.', 'High'],
    ['F-03', 'Defect', 'SPC-012', 'Converted reservations offered for a new contract', 'Reservations already "Converted to Contract" are listed under Approved Reservation.', 'Only approved reservations without a live contract.', 'Medium'],
    ['F-04', 'Observation', 'SPC-016', 'No warning when the contract value differs from the accepted proposal', 'Agreed Pack showed proposal 0.45M USD vs contract 324.32 USD with no warning.', 'A warning or a block when they differ.', 'Medium'],
]
OVERVIEW = [
    ('Scope', 'SPA / Sales Contracts page (/spa-contracts): KPI cards, Contract Register, Export, New Contract, Contract Detail (Issue, Payment Plan, Sign, ERP Handoff, Replace, Cancel, Agreed Pack).'),
    ('Use cases', 'CUC-01 register & counts · CUC-02 create a contract · CUC-03 issue, payment plan and signing · CUC-04 ERP handoff, replace and cancel · CUC-05 register tools & contract records (sort, pages, Total formula, Copy link, Documents, History)'),
    ('Test data', f'{TD} (or TestData/csv/Contracts/*.csv with TEST_DATA_FORMAT=csv). No values are hard-coded in the tests.'),
    ('Automation', 'tests/contracts-page/*.spec.ts — run with: npm run test:contracts-page'),
    ('Report', 'reports/SPA_Contracts_Page_Test_Report_<date>_<time>.xlsx'),
    ('Data created', 'Per run: 2 buyers, 2 units in the test project, 2 reservations, 2 accepted proposals, the contracts of the tests, one KYC document (sample PDF) verified on a test buyer, one Signed SPA document (sample PDF) on the test contract. ERP handoff of the test contract on QA. Real units are never reserved.'),
    ('Security', 'Out of scope for this module (covered by the Security suite).'),
]
AREA_IMPACT = {
    'Page & Counts': 'The Contracts cards do not match the register, so management sees wrong numbers of signed contracts or a wrong signed value.',
    'Create Contract': 'Contracts can be created with a wrong value, currency or reservation, so the legal agreement and the ERP receive wrong figures.',
    'Issue, Plan & Sign': 'The contract can move forward without the required steps (issue, payment plan, KYC), or the schedule amounts are wrong, so the buyer is billed incorrectly.',
    'ERP, Replace & Cancel': 'Signed contracts do not reach ERP correctly, or contracts can be replaced / cancelled when they should not, so finance and sales records diverge.',
    'Register & Records': 'Contracts cannot be found, sorted or shared reliably, or their documents and change history are missing, so legal and sales cannot rely on the contract record.',
}
IMPACT = {
    'SPC-012': 'Reservations that already have a contract are offered again, so a second contract could be created for the same unit.',
    'SPC-014': 'The contract value is not taken from the accepted proposal and the currency defaults to KES, so the contract can be issued with a value different from the price the buyer accepted.',
    'SPC-015': 'A contract is saved with letters, zero or a negative value: the SPA and ERP would carry a wrong amount.',
    'SPC-027': 'A contract could be signed before the identity documents of the buyer (KYC) are approved, a compliance risk.',
}
write_cases('SPA_Contracts_Page_Test_Cases.xlsx', 'SPA / Sales Contracts Page — Test Cases', OVERVIEW, cases, FINDINGS, IMPACT, AREA_IMPACT)
