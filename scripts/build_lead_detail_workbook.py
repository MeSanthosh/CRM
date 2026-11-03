"""Builds Testcase/Lead_Detail_Test_Cases.xlsx — human-readable test cases for the Lead Detail page.
Run from the repo root:  python scripts/build_lead_detail_workbook.py
"""
import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
TD = 'TestData/Lead_Detail_Test_Data.xlsx'
LEADS_TD = 'TestData/Leads_Test_Data.xlsx → Individual Leads'
OPEN = 'Open the Leads page and click the Lead No. of the lead'
NEW = 'A new Individual lead created by the test (owner = signed-in user)'

def st(*s):
    return '\n'.join(f'{i}. {x}' for i, x in enumerate(s, 1))

cases = []
def C(id, area, title, pre, steps, data, exp, pri='High', kind='Positive'):
    cases.append([id, area, title, pre, steps, data, exp, pri, kind, 'Automated'])

# ── Lead details & Copy link
A = 'Lead Details & Copy Link'
C('LDP-001', A, 'Lead Detail opens from the Lead No. link', NEW, st('Open the Leads page', 'Search the lead by its email', 'Click its Lead No.'), LEADS_TD,
  'The "Lead Detail" panel opens; its header shows "<Lead No.> · <name>" of the clicked lead.')
C('LDP-002', A, 'Summary shows the details entered when the lead was created', NEW, st('Create an Individual lead with Title, First / Last Name, Mobile, Email and Lead Source', OPEN, 'Read the identity card at the top of the panel'), LEADS_TD,
  'Under the name: "<Lead No.> · Assigned to <signed-in user>"; status pill "Status: Assigned · Score N"; tiles PROSPECT TYPE = Individual (Person), TITLE, PHONE, EMAIL and SOURCE = the entered values, BUDGET = 0 USD.')
C('LDP-003', A, 'Summary shows budget and timeline of a lead created with its profile', 'Signed in', st('Create an Individual lead with all profile fields (budget, timeline…)', OPEN, 'Read the BUDGET tile', 'Read "Additional Captured Profile Details (… Timeline: …)"'), LEADS_TD,
  'BUDGET shows the entered budget (e.g. 420000 → 0.42M USD); the Additional Captured Profile Details line shows the chosen timeline.', 'Medium')
C('LDP-004', A, 'Lead Detail, Leads list and Leads export show the same data', NEW, st('Search the lead on the Leads page and read its row', 'Click Export and open the file', OPEN),
  f'{TD} → Export Columns', 'Name, Lead No., mobile, email, source, status, score and owner are identical in the panel, the list row and the export row.')
C('LDP-005', A, 'Copy link copies the address of the lead', NEW, st(OPEN, 'Click "Copy link"', 'Paste the clipboard'), f'{TD} → Settings (Copy Link Pattern)',
  'The clipboard holds <site>/leads?selected=<lead id>.')
C('LDP-006', A, 'The copied link opens the same lead', NEW, st(OPEN, 'Click "Copy link"', 'Open the copied address in the browser'), '—',
  'The Leads page opens with the Lead Detail of the same lead (same Lead No. and name).')
C('LDP-007', A, 'Close returns to the Leads list', NEW, st(OPEN, 'Click "Close"'), '—', 'The panel closes and the Leads list is shown.', 'Medium')
C('LDP-008', A, 'Additional Captured Profile Details open and show the profile', 'A lead created with its profile fields', st(OPEN, 'Click "▸ Additional Captured Profile Details"'), LEADS_TD,
  'The section opens; it shows Units Interested and the Timeline entered when the lead was created.', 'Medium')

# ── Workflow
A = 'Workflow Status'
C('LDP-011', A, 'Workflow of a new lead', NEW, st(OPEN, 'Read the four Workflow Status boxes'), f'{TD} → Workflow (After Create)',
  'Lead Captured = DONE, Assigned = IN PROGRESS, Qualified = UP NEXT, Moved to Opportunity = UP NEXT.')
C('LDP-012', A, 'Next action of a new lead', NEW, st(OPEN, 'Read the "Next action" cards under Workflow Status'), f'{TD} → Workflow (After Create)',
  'Next action offers Reassign Lead, Qualify Lead and Disqualify Lead (each "OPEN FORM ↓"); no Now / Next boxes are shown yet.')
C('LDP-013', A, 'Workflow after qualifying', NEW, st(OPEN, 'Fill the qualification checklist and click "Qualify lead"', 'Read the Workflow Status and the Now / Next boxes'), f'{TD} → Workflow (After Qualify), Qualification Checklist',
  'Assigned = DONE, Qualified = IN PROGRESS; "Lead complete": NOW = Qualified, NEXT = Move to Opportunity; no OPEN FORM cards.')
C('LDP-014', A, 'Status pill follows a status change', NEW, st(OPEN, 'In Move Back / Change Status choose Move Back To = Contacted with a reason and click Change Status', 'Without reopening, read the status pill under the name'), f'{TD} → Status Changes',
  'Pop-up "Status Changed — Lead moved to Contacted."; the pill shows "Status: Contacted" at once.', 'Medium')

# ── Change status: disqualify
A = 'Change Status · Disqualify'
C('LDP-021', A, 'Disqualify with nothing filled lists both required fields', NEW, st(OPEN, 'Click "Disqualify lead" with Reason and Remarks empty'), f'{TD} → Messages',
  'Pop-up "Required Fields Missing" lists Disqualification Reason and Disqualification Remarks; the status does not change.', kind='Negative')
C('LDP-022', A, 'Disqualify with only a reason asks for remarks', NEW, st(OPEN, 'Choose a Disqualification Reason, leave Remarks empty', 'Click "Disqualify lead"'), f'{TD} → Disqualify Reasons',
  'Pop-up lists only Disqualification Remarks; the status does not change.', kind='Negative')
C('LDP-023', A, 'Disqualify with only remarks asks for a reason', NEW, st(OPEN, 'Type Remarks, leave the Reason on "Select reason"', 'Click "Disqualify lead"'), f'{TD} → Disqualify Reasons',
  'Pop-up lists only Disqualification Reason; the status does not change.', kind='Negative')
C('LDP-024', A, 'Disqualification reasons offered', NEW, st(OPEN, 'Open the Disqualification Reason list'), f'{TD} → Dropdown Options',
  'The list offers exactly the reasons on the Dropdown Options sheet.', 'Medium')
C('LDP-025', A, 'Disqualify a lead with each reason', NEW + ' (one per reason)', st(OPEN, 'Choose the reason and type the remarks', 'Click "Disqualify lead"', 'Confirm with "Disqualify"', 'Read the pop-up, the status, Status History and the Leads list'), f'{TD} → Disqualify Reasons (one run per row)',
  'Confirmation "Disqualify Lead — The lead will be marked Disqualified…" (Cancel / Disqualify); then pop-up "Lead Disqualified"; status = Disqualified in the panel and the Leads list; Status History has "<previous> → Disqualified · <reason> · <remarks>".')
C('LDP-026', A, 'Cancel on the disqualify confirmation keeps the lead', NEW, st(OPEN, 'Choose a reason and type remarks', 'Click "Disqualify lead"', 'Click "Cancel" in the confirmation'), f'{TD} → Disqualify Reasons, Messages',
  'The confirmation offers Cancel and Disqualify; after Cancel the status is unchanged.', 'Medium', 'Negative')
C('LDP-027', A, 'Reopen a disqualified lead', 'A lead disqualified by the test', st(OPEN, 'Open "Reopen Lead"', 'Note the "Reopen As" options', 'Choose the Reopen Status, type the reason, click "Reopen Lead"'), f'{TD} → Settings (Reopen Status / Reason), Dropdown Options',
  'Reopen As offers Assigned, Contacted and Nurturing; the lead returns to the chosen status (panel and Leads list); Status History has "Disqualified → <status> · <reason>".')

# ── Change status: move back
A = 'Change Status · Move Back'
C('LDP-031', A, 'Change Status with nothing filled lists both required fields', NEW, st(OPEN, 'Click "Change Status" with Move Back To and Reason empty'), f'{TD} → Messages',
  'Pop-up "Required Fields Missing" lists Move Back To and Status Change Reason; the status does not change.', kind='Negative')
C('LDP-032', A, 'Change Status with only a status asks for a reason', NEW, st(OPEN, 'Choose Move Back To, leave the reason empty', 'Click "Change Status"'), '—',
  'Pop-up lists only Status Change Reason; the status does not change.', kind='Negative')
C('LDP-033', A, 'Move Back To never offers the current status', NEW, st(OPEN, 'Open Move Back To and note the options', 'Move the lead to each status of the Status Changes sheet in turn, noting the options before each move'), f'{TD} → Status Changes (Options Before)',
  'Before each move the list offers exactly the statuses in "Options Before" (never the current one).')
C('LDP-034', A, 'Move a lead through Contacted, Nurturing and back to Assigned', NEW, st(OPEN, 'For each row of Status Changes: choose Move Back To, type the reason, click Change Status', 'After each move read the pop-up, the panel status and the Leads list'), f'{TD} → Status Changes',
  'Each move shows "Status Changed — Lead moved to <status>." and the new status shows in the panel and the Leads list.')

# ── Assign
A = 'Assign Lead'
C('LDP-041', A, 'Reassign lead is disabled until a user is chosen', NEW, st(OPEN, 'Open "Reassign lead"', 'Look at the Reassign lead button with "Select a user" chosen'), '—', 'The Reassign lead button is disabled.', 'Medium')
C('LDP-042', A, 'Assign to lists the users', NEW, st(OPEN, 'Open the "Assign to" list of Reassign lead'), f'{TD} → Settings (Assign User)',
  'The list offers the signed-in user and the user from Settings, each once per person.', 'Medium')
C('LDP-043', A, 'Reassign the lead to another user', NEW, st(OPEN, 'Choose the Assign User in "Assign to", leave the reason empty, click "Reassign lead"', 'Read the pop-up', 'Reopen the lead; read "Assigned to" under the name and Owner History', 'Read the Assigned column on the Leads list'), f'{TD} → Settings, Messages',
  'Pop-up "Lead Assigned — Lead assigned to <user>."; "Assigned to <user>"; Owner History has "<previous owner> → <user> · Assigned from lead detail"; the list shows <user>.')
C('LDP-044', A, 'Identity card shows the new owner straight after reassigning', NEW, st(OPEN, 'Reassign the lead to another user', 'Without closing the panel, read "Assigned to" under the name'), f'{TD} → Settings',
  '"Assigned to" shows the new owner at once (no reload needed).', 'Medium')
C('LDP-045', A, 'Only the assigned user can qualify the lead', 'A lead re-assigned to another user', st(OPEN, 'Fill the qualification checklist', 'Click "Qualify lead"'), f'{TD} → Messages',
  'Pop-up "Assignee Required — Only the assigned user can complete qualification for this lead"; the lead is not qualified.', kind='Negative')
C('LDP-046', A, 'Reason for reassigning is saved in Owner History', NEW, st(OPEN, 'Choose the Assign User, type the Reassign Reason, click "Reassign lead"', 'Reopen the lead and read Owner History'), f'{TD} → Settings (Assign User, Reassign Reason)',
  'Owner History has "<previous owner> → <user> · <reason typed>".')
C('LDP-047', A, 'The current owner cannot be picked again', NEW, st(OPEN, 'Open the "Assign to" list'), f'{TD} → Messages (Current Owner Note)',
  "The current owner is shown but cannot be selected; the note \"The current owner can't be picked again.\" is shown.", 'Medium', 'Negative')

# ── Qualify
A = 'Qualify Lead'
C('LDP-051', A, 'Qualify with an empty checklist lists every missing item', NEW, st(OPEN, 'Click "Qualify lead" without filling anything'), f'{TD} → Qualification Checklist',
  'Pop-up "Qualification Details Missing" lists every item of the Qualification Checklist sheet; the lead stays Assigned.', kind='Negative')
C('LDP-052', A, 'Each checklist item is required', NEW, st(OPEN, 'Fill every checklist item except one', 'Click Qualify Lead', 'Repeat for each item'), f'{TD} → Qualification Checklist (one run per item)',
  'The pop-up names only the item left empty; the lead stays Assigned.', kind='Negative')
C('LDP-053', A, 'Qualification dropdowns offer the expected options', NEW, st(OPEN, 'Open each dropdown of the Qualify Lead section'), f'{TD} → Dropdown Options (Qualify Lead)',
  'Each dropdown offers exactly the options listed for it.', 'Medium')
C('LDP-054', A, 'Qualify with each combination of dropdown values', NEW + ' (one per combination)', st(OPEN, 'Fill the Qualify lead form (Buyer fit, Preferences and contact, Personal details) with one row of Qualification Combinations', 'Click "Qualify lead"', 'Read the pop-up, the status, BUDGET, TIMELINE and Status History'), f'{TD} → Qualification Combinations (one run per row)',
  'Pop-up "Lead Qualified — <name> was qualified successfully."; status = Qualified; BUDGET and TIMELINE show the values entered; Status History has "→ Qualified · Qualified with score <N>" and N = the Score column of the Leads list.')
C('LDP-055', A, 'Score equals the sum of its breakdown', NEW, st(OPEN, 'Click Recalculate Score', 'Read the pop-up, the Score field and the breakdown list ("Budget Match: x/25" …)'), f'{TD} → Messages (Score Body)',
  'Pop-up "Computed score N. Suggested rating: R."; Score field = N = sum of the breakdown points; each item ≤ its maximum.')
C('LDP-056', A, 'Score after qualifying is higher and the same everywhere', NEW, st(OPEN, 'Click Recalculate Score and note the score', 'Qualify the lead', 'Read the score in Status History ("Qualified with score N")', 'Read the Score column of the lead on the Leads list'), f'{TD} → Qualification Checklist',
  'The score in Status History equals the Score column of the Leads list and is higher than the score before qualifying.')
C('LDP-057', A, 'Apply Suggested Rating sets the suggested rating', NEW, st(OPEN, 'Click Recalculate Score and note the suggested rating', 'Click Apply Suggested Rating'), '—',
  'The Rating dropdown shows the suggested rating.', 'Medium')
C('LDP-058', A, 'Qualified lead is listed on Ready to Convert', NEW, st(OPEN, 'Qualify the lead', 'Open the Ready to Convert tab and search the lead'), f'{TD} → Settings',
  'The lead is listed with status Qualified.')
C('LDP-059', A, 'Move to Opportunity asks for confirmation; Go back cancels', 'A qualified lead created by the test', st(OPEN, 'Click Move to Opportunity', 'Click Go back'), f'{TD} → Messages',
  'Pop-up "Convert lead to opportunity?"; after Go back the lead is still Qualified.', 'Medium')
C('LDP-060', A, 'Converted lead becomes an opportunity', 'A qualified lead created by the test', st(OPEN, 'Click Move to Opportunity and confirm Convert', 'Open the Opportunities page', 'Search the lead on the Leads page and reopen it'), f'{TD} → Settings',
  'An opportunity linked to the Lead No. (and the lead name) is listed on Opportunities; the lead status is Converted and its panel no longer offers Qualify lead, Move to Opportunity, Disqualify lead, Reassign lead or Change Status.')

# ── History
A = 'Status & Owner History'
C('LDP-071', A, 'Every status change is recorded in Status History', NEW, st(OPEN, 'Move the lead to Contacted, then Nurturing, then Assigned (Status Changes sheet)', 'Qualify the lead', 'Read Status History'), f'{TD} → Status Changes, Qualification Checklist',
  'Status History lists, newest first: Qualified, each move "<from> → <to> · <reason>", and "Assigned · Lead created"; each entry shows today\'s date and the signed-in user.')
C('LDP-072', A, 'Owner History records creation and re-assignment', NEW, st(OPEN, 'Reassign the lead to another user (no reason)', 'Read Owner History'), f'{TD} → Settings, Messages',
  'Owner History has "<me> · Assigned during lead creation" and "<me> → <user> · Assigned from lead detail" with date and user.')

# ── Log call
A = 'Tasks & Calls · Log Call'
C('LDP-081', A, 'Log call opens with defaults and the lead link', NEW, st(OPEN, 'Click "Log call"'), f'{TD} → Form Defaults (Log call)',
  'Form "Log Call" shows "Linked to <Lead No.>", Subject = Phone call, call time = now, Direction = Outgoing, Outcome = Connected, Priority = Normal, Logged for = signed-in user, follow-up unticked.')
C('LDP-082', A, 'Subject is required', NEW, st(OPEN, 'Click "Log call"', 'Clear Subject', 'Click "Log call" in the form'), f'{TD} → Messages',
  'Message "Subject is required."; nothing is logged.', kind='Negative')
C('LDP-083', A, 'Call time cannot be in the future', NEW, st(OPEN, 'Click "Log call"', 'Pick a date 3 days ahead', 'Click "Log call" in the form'), f'{TD} → Messages',
  'Message "Call time cannot be in the future."; nothing is logged.', kind='Negative')
C('LDP-084', A, 'Duration accepts whole minutes only', NEW, st(OPEN, 'Click "Log call"', 'Type each value of Duration Inputs into Duration (minutes)'), f'{TD} → Duration Inputs (one run per row)',
  'The field keeps the Expected Value of each row (letters and signs removed; a decimal never becomes a different number).', 'Medium', 'Negative')
C('LDP-085', A, 'Follow-up checkbox adds a required follow-up date', NEW, st(OPEN, 'Click "Log call"', 'Tick "Schedule a follow-up task"', 'Click "Log call" without a follow-up date', 'Untick the box'), f'{TD} → Messages',
  '"Follow-up date and time" appears when ticked; without a date: "Choose when to follow up."; it disappears when unticked.', kind='Negative')
C('LDP-086', A, 'Log calls with every direction, outcome and priority', NEW, st(OPEN, 'Click "Log call"', 'Fill the form with one row of Call Log', 'Click "Log call"', 'Read "Call log & completed" and the Call log tab of Tasks & Calendar'), f'{TD} → Call Log (one run per row)',
  'The call shows in "Call log & completed" with subject, "<Direction> · <Outcome> · <N> min", time, user and notes, and on the Call log tab with Record = <Lead No.> · <name>.')
C('LDP-087', A, 'A call with follow-up creates the follow-up task', NEW, st(OPEN, 'Log a call of Call Log with Follow-up = Yes', 'Read Open tasks'), f'{TD} → Call Log (Follow-up = Yes), Messages',
  'Open tasks has "Follow up: <subject>" due at the chosen follow-up date and time with notes "Follow-up after call (<outcome>)."')
C('LDP-088', A, 'Cancel and Close discard the call', NEW, st(OPEN, 'Click "Log call", type a subject, click Cancel', 'Click "Log call", type a subject, click Close'), f'{TD} → Call Log',
  'The form closes both times and no call is logged.', 'Medium', 'Negative')
C('LDP-089', A, 'Edit a logged call', NEW, st(OPEN, 'Log a call', 'Click Edit on it', 'Change subject and notes, click "Save changes"'), f'{TD} → Call Log',
  'Form "Edit Call" shows the saved values; after Save changes the call shows the new subject and notes, other values unchanged.')

def task_cases(base, kind, btn):
    A = f'Tasks & Calls · {kind}'
    n = base
    def nid():
        nonlocal n
        n += 1
        return f'LDP-{n:03d}'
    sheet = f'{TD} → Tasks (Kind = {kind})'
    C(nid(), A, f'{kind} form opens with defaults and the lead link', NEW, st(OPEN, f'Click "{btn}"'), f'{TD} → Form Defaults ({kind})',
      f'Form "New {kind}" shows "Linked to <Lead No.>", empty Subject and due date, Reminder = 15 minutes before, Priority = Normal, Assigned to = signed-in user.', 'Medium')
    C(nid(), A, 'Subject and due date are required', NEW, st(OPEN, f'Click "{btn}"', 'Click Save with nothing filled'), f'{TD} → Messages',
      '"Subject is required." and "Due date and time is required."; nothing is saved.', kind='Negative')
    C(nid(), A, 'Past due dates cannot be chosen', NEW, st(OPEN, f'Click "{btn}"', 'Open the due date picker on the current month', 'Try to pick a day before today'), '—',
      'Days before today are disabled; today and later days can be picked.', 'Medium', 'Negative')
    C(nid(), A, f'Save {kind.lower()}s with every reminder, priority and owner', NEW, st(OPEN, f'Click "{btn}"', f'Fill the form with one row of the Tasks sheet ({kind})', 'Click Save', 'Read Open tasks'), f'{sheet} (one run per row)',
      f'The {kind.lower()} is listed under Open tasks with its subject, "Due <date>, <time>", "Assigned to <user>" and notes.')
    C(nid(), A, f'Edit a {kind.lower()}', NEW, st(OPEN, f'Save a {kind.lower()}', 'Click Edit on it', 'Change the subject to Edited Subject, click "Save changes"'), sheet,
      f'The edit form shows the saved values; the {kind.lower()} then shows the edited subject with the same due date and owner.')
    C(nid(), A, 'Mark done and Reopen', NEW, st(OPEN, f'Save a {kind.lower()}', 'Click "Mark done"', 'Click "Reopen"'), f'{sheet}, Messages',
      f'After Mark done the {kind.lower()} moves to "Call log & completed" with "Done <today> by <me>" and a Reopen button; after Reopen it is back in Open tasks.')
    C(nid(), A, f'{kind} shows on the Tasks & Calendar page', NEW, st(OPEN, f'Save a {kind.lower()}', 'Open Tasks & Calendar (Whose tasks = Everyone) and search the subject', 'Mark it done and filter Completed'), sheet,
      f'The {kind.lower()} is listed with Record = <Lead No.> · <name>, its due date, priority, owner and status Open; after Mark done it is listed under Completed.')
    C(nid(), A, 'Cancel and Close discard the form', NEW, st(OPEN, f'Click "{btn}", type a subject, click Cancel', f'Click "{btn}", type a subject, click Close'), sheet,
      'The form closes both times and nothing is saved.', 'Medium', 'Negative')
    C(nid(), A, f'{kind} is in the Tasks & Calls export', NEW, st(OPEN, f'Save a {kind.lower()}', 'Open Tasks & Calendar, search the subject, click Export'), f'{sheet}, Export Columns',
      f'The file holds the {kind.lower()} with Type, Subject, Priority, Status = OPEN, Related To = "LEAD <Lead No.>", Related Name = <name> and Assigned To.')

task_cases(90, 'Task', 'Add task')
task_cases(100, 'Meeting', 'Add meeting')

A = 'Export'
C('LDP-111', A, 'Leads export has the expected columns and one row per lead', 'Signed in', st('Open the Leads page', 'Note the number of leads in the pager', 'Click Export'), f'{TD} → Export Columns, Settings',
  'File leads-<date>.xlsx with the columns of Export Columns (Leads) and as many rows as leads listed.')
C('LDP-112', A, 'Export of a search holds only that lead with its details', NEW, st('Search the lead by its Lead No.', 'Click Export'), LEADS_TD,
  'The file holds one row: the lead, with name, mobile, email, source, status and owner as shown in the Lead Detail.')

HEAD = ['TC ID', 'Area', 'Test Case', 'Preconditions', 'Test Steps', 'Test Data', 'Expected Result', 'Priority', 'Type', 'Automation']
WIDTH = [10, 24, 42, 28, 60, 34, 62, 9, 10, 11]
FINDINGS = [
    ['F-01', 'Defect', 'LDP-084.4', 'Duration loses the decimal point', 'Typing "12.5" in Duration (minutes) leaves "125" in the field — a call of 12.5 minutes is saved as 125.', 'Decimals are rejected or kept as entered.', 'Medium'],
    ['F-02', 'Closed (v2.0)', 'LDP-014', 'Now box did not follow a status change', 'Build 1910-49: the Now box kept "Assigned" after Change Status. v2.0 replaced the Now box by the status pill, which updates at once.', 'Closed by the v2.0 redesign.', 'Low'],
    ['F-03', 'Observation', '—', 'Slow responses on QA under load', 'With 4 test workers, saving a lead sometimes took more than 20 s ("Saving…") and "Loading lead details…" more than 15 s.', 'Check API response times; the tests wait up to 60 s / 45 s.', 'Low'],
    ['F-04', 'Observation', 'LDP-045', 'Only the owner can qualify', 'An administrator who re-assigns a lead can no longer qualify it ("Assignee Required").', 'Confirm this is the intended permission.', 'Low'],
    ['F-05', 'Closed (v2.0)', 'LDP-042', 'Two users named "Mahalakshmi"', 'Build 1910-49 listed "Mahalakshmi" twice; the v2.0 user list has 7 distinct users.', 'Closed.', 'Low'],
    ['F-06', 'Observation', 'LDP-043', 'Reason for reassigning is optional', 'Reassign lead saves with an empty reason and records "Assigned from lead detail".', 'Confirm whether a reason should be required.', 'Low'],
]
CHANGES = [
    ['25 Oct 2026', 'v2.0 2410-02', 'Identity card replaces the summary header: "<Lead No.> · Assigned to <owner>", status pill "Status: X · Score N"; ASSIGNED / TIMELINE tiles removed (timeline under Additional Captured Profile Details)', 'LDP-002, LDP-003, LDP-008 (new), LDP-014, LDP-044'],
    ['25 Oct 2026', 'v2.0 2410-02', '"Next action" cards (Reassign Lead / Qualify Lead / Disqualify Lead, OPEN FORM ↓) replace the Now / Next / Data needed boxes of an active lead', 'LDP-012, LDP-013'],
    ['25 Oct 2026', 'v2.0 2410-02', 'Assign Lead renamed Reassign lead: "Assign to" + optional "Reason for reassigning"; the current owner cannot be picked', 'LDP-041 … LDP-045, LDP-046 (new), LDP-047 (new), LDP-072'],
    ['25 Oct 2026', 'v2.0 2410-02', "Qualify form regrouped (Buyer fit / Preferences and contact / Personal details); new Preferred Unit Type; Gender option \"Don't Know\"; Bedrooms now 3 / 4 / 5+; success pop-up \"Lead Qualified\"", 'LDP-051 … LDP-054 (data: Qualification Checklist, Combinations, Dropdown Options)'],
    ['25 Oct 2026', 'v2.0 2410-02', 'Disqualify lead asks for confirmation (Cancel / Disqualify); a disqualified lead offers Reopen Lead (Reopen As + reason)', 'LDP-021 … LDP-025, LDP-026 (new), LDP-027 (new)'],
    ['25 Oct 2026', 'v2.0 2410-02', 'Status / Owner History entries split over two lines (transition, then reason)', 'LDP-025, LDP-027, LDP-043, LDP-046, LDP-071, LDP-072'],
]

UC = [
    ['Copy link', 'LDP-005, LDP-006'],
    ['Lead details: create a lead and verify the details shown', 'LDP-001, LDP-002, LDP-003, LDP-004, LDP-007, LDP-008'],
    ['Workflow status', 'LDP-011, LDP-012, LDP-013, LDP-014'],
    ['Change status: disqualify with each reason, validations', 'LDP-021, LDP-022, LDP-023, LDP-024, LDP-025, LDP-026, LDP-027'],
    ['Change status: select status and validations', 'LDP-031, LDP-032, LDP-033, LDP-034'],
    ['Assign lead: validate the screen', 'LDP-041, LDP-042, LDP-043, LDP-044, LDP-045, LDP-046, LDP-047'],
    ['Qualify lead: all dropdown combinations', 'LDP-051, LDP-052, LDP-053, LDP-054'],
    ['Qualify lead: budget and score calculations', 'LDP-055, LDP-056, LDP-057, LDP-054'],
    ['Qualify lead: qualified lead moves to opportunity', 'LDP-058, LDP-059, LDP-060'],
    ['Status history: every status change recorded', 'LDP-071, LDP-072, LDP-025, LDP-034'],
    ['Log call: button, field combinations, date/time validation, all-field validation, follow-up check box, close', 'LDP-081, LDP-082, LDP-083, LDP-084, LDP-085, LDP-086, LDP-087, LDP-088, LDP-089'],
    ['Add task: same use cases + mark done, edit, data integrity, Tasks page', 'LDP-091 … LDP-099'],
    ['Add meeting: same use cases + mark done, edit, data integrity, Tasks page', 'LDP-101 … LDP-109'],
    ['Export button', 'LDP-111, LDP-112, LDP-004, LDP-099, LDP-109'],
]

thin = Side(style='thin', color='BFBFBF')
HDR = PatternFill('solid', fgColor='12465B')
def sheet(ws, head, rows, widths):
    ws.append(head)
    for r in rows:
        ws.append(r)
    for j, w in enumerate(widths, 1):
        ws.column_dimensions[ws.cell(row=1, column=j).column_letter].width = w
    for row in ws.iter_rows():
        for c in row:
            hdr = c.row == 1
            c.font = Font(name='Arial', size=10 if hdr else 9, bold=hdr, color='FFFFFF' if hdr else '000000')
            if hdr: c.fill = HDR
            c.alignment = Alignment(wrap_text=True, vertical='top')
            c.border = Border(top=thin, bottom=thin, left=thin, right=thin)
    ws.freeze_panes = 'B2'
    ws.auto_filter.ref = ws.dimensions

wb = Workbook()
ov = wb.active
ov.title = 'Overview'
ov['A1'] = 'Lead Detail Page — Test Cases'
ov['A1'].font = Font(name='Arial', size=14, bold=True, color='12465B')
for i, (k, v) in enumerate([
    ('Page', 'Lead Detail panel, opened by clicking a Lead No. on the Leads page (/leads?selected=<id>), plus the Tasks & Calendar page (/activities) and Opportunities for the follow-on checks.'),
    ('Test data', f'{TD} (or TestData/csv/Lead_Detail/*.csv with TEST_DATA_FORMAT=csv); leads from {LEADS_TD}. No values are hard-coded in the tests.'),
    ('Automation', 'tests/lead-detail/*.spec.ts — run with: npm run test:lead-detail'),
    ('Report', 'reports/Lead_Detail_Page_Test_Report_<date>_<time>.xlsx'),
    ('Test cases', f'{len(cases)} cases; data-driven cases run once per data row (e.g. LDP-025.3).'),
    ('Data created', 'Each test creates its own lead (realistic names, example.* emails) and only changes that lead and its own calls / tasks / meetings.'),
], start=3):
    ov.cell(row=i, column=1, value=k).font = Font(name='Arial', size=10, bold=True)
    c = ov.cell(row=i, column=2, value=v)
    c.font = Font(name='Arial', size=10)
    c.alignment = Alignment(wrap_text=True, vertical='top')
ov.column_dimensions['A'].width = 14
ov.column_dimensions['B'].width = 120
tc = wb.create_sheet('Test Cases')
sheet(tc, HEAD, cases, WIDTH)
dv = DataValidation(type='list', formula1='"Automated,Manual,Not Automated"', allow_blank=True)
tc.add_data_validation(dv)
dv.add(f'J2:J{len(cases) + 1}')
sheet(wb.create_sheet('Traceability'), ['Use case (as requested)', 'Test Cases'], UC, [80, 50])
sheet(wb.create_sheet('Change Log'), ['Date', 'Build', 'UI change', 'Test cases updated'], CHANGES, [12, 14, 90, 50])
sheet(wb.create_sheet('Findings'), ['ID', 'Type', 'Test Cases', 'Finding', 'What happens', 'Expected', 'Severity'], FINDINGS, [7, 18, 14, 38, 60, 45, 9])
ids = [c[0] for c in cases]
assert len(ids) == len(set(ids)), 'duplicate IDs'
out = os.path.join(ROOT, 'Testcase', 'Lead_Detail_Test_Cases.xlsx')
wb.save(out)
print(out, len(cases), 'cases:', ids[0], '…', ids[-1])
