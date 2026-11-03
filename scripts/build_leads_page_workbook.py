"""Builds Testcase/Leads_Page_Test_Cases.xlsx — human-readable test cases for the Leads page (HLUC-01..03)."""
import os, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
TD = 'TestData/Leads_Test_Data.xlsx'
LEADS = 'Open the Leads page (menu Leads → All Leads)'

def steps(*s):
    return '\n'.join(f'{i}. {x}' for i, x in enumerate(s, 1))

cases = []
def C(id, uc, area, title, pre, st, data, exp, pri, kind='Positive'):
    cases.append([id, uc, area, title, pre, st, data, exp, pri, kind, 'Automated'])

def create_cases(uc, form, base, mand_list, extra_formats):
    kind = form.lower()
    btn = f'"{form}"'
    heading = 'Create Individual Lead' if form == 'Individual' else 'Create Corporate / Institutional Lead'
    sheet = f'{form} Leads'
    pre = 'Signed in as a CRM user who can create leads'
    n = base
    def nid():
        nonlocal n
        n += 1
        return f'LP-{n:03d}'
    C(nid(), uc, f'Create {form} Lead', f'{form} lead form opens from the Leads page', pre,
      steps(LEADS, f'Click the {btn} button next to the tabs'),
      '—', f'The "{heading}" form opens (address /leads/{kind}/new) with the sections Prospect Information, Identity Documents, Addresses, Source & Campaign, Profile & Preferences and Unit Interests, and the buttons Close and Create Lead.', 'High')
    C(nid(), uc, f'Create {form} Lead', 'Mandatory fields are marked with *', pre,
      steps(LEADS, f'Click {btn}', 'Look at the field labels'),
      f'{TD} → Form Fields (Form = {form}, Mandatory = Yes)', f'These fields are marked as required (*): {mand_list}.', 'High')
    C(nid(), uc, f'Create {form} Lead', 'Saving an empty form lists every mandatory field', pre,
      steps(LEADS, f'Click {btn}', 'Leave every field empty', 'Click Create Lead'),
      f'{TD} → Form Fields, Messages', f'Pop-up "Required Fields Missing" lists exactly: {mand_list}. No lead is saved and the form stays open.', 'High', 'Negative')
    C(nid(), uc, f'Create {form} Lead', 'Each mandatory field is required on its own', pre,
      steps(LEADS, f'Click {btn}', f'Fill every mandatory field with valid data from the {sheet} sheet', 'Clear ONE mandatory field', 'Click Create Lead', 'Repeat for every mandatory field'),
      f'{TD} → {sheet}, Form Fields', 'Each time the "Required Fields Missing" pop-up names only the cleared field, and no lead is saved.', 'High', 'Negative')
    for case_title, what in extra_formats:
        C(nid(), uc, f'Create {form} Lead', case_title, pre,
          steps(LEADS, f'Click {btn}', f'Fill every mandatory field with valid data from the {sheet} sheet', f'Enter the invalid value in {what}', 'Move to the next field, then click Create Lead'),
          f'{TD} → Invalid Values (Case ID = this case; one run per row)',
          'The pop-up "Invalid Entry" shows the message from the Invalid Values sheet, and no lead is saved.', 'High', 'Negative')
    C(nid(), uc, f'Create {form} Lead', 'Score is read-only and calculated by the system', pre,
      steps(LEADS, f'Click {btn}', 'Try to type in the Score field'),
      f'{TD} → Messages (Score Placeholder)', 'Score cannot be edited and shows "Calculated on save".', 'Medium')
    C(nid(), uc, f'Create {form} Lead', f'Create {"an" if form == "Individual" else "a"} {form} lead with the mandatory fields', pre,
      steps(LEADS, f'Click {btn}', f'Fill the mandatory fields with a row from the {sheet} sheet (mobile and email are made unique for the run)', 'Click Create Lead'),
      f'{TD} → {sheet} (random row)', f'Pop-up "Lead Created — <name> was created successfully." The Lead Detail opens with a Lead No. (LD-…) and shows the entered name, mobile, email and lead source.', 'High')
    C(nid(), uc, f'Create {form} Lead', 'New lead gets a Lead No. and a Score', 'A lead created by the previous case',
      steps(LEADS, 'Search for the new lead by its email', 'Read the Lead No. and Score columns'),
      f'{TD} → {sheet}', 'Lead No. has the format LD-<yyyymmddhhmmss>-<4 characters>; Score is a number from 0 to 100.', 'High')
    C(nid(), uc, f'Create {form} Lead', 'Lead owner is the signed-in user', 'A lead created in this run',
      steps(LEADS, 'Search for the new lead by its email', 'Read the Assigned column', 'Open the lead and read "Assigned to" under the name and Owner History'),
      f'{TD} → {sheet}', 'Assigned = the signed-in user (name shown in the top-right menu); Owner History says "Assigned during lead creation".', 'High')
    C(nid(), uc, f'Create {form} Lead', 'New lead shows in All Leads and My Leads', 'A lead created in this run',
      steps(LEADS, 'Search for the new lead by its email on the All Leads tab', 'Open the My Leads tab and search again', f'Click the {form} type chip'),
      f'{TD} → {sheet}', f'The lead is listed once on All Leads and once on My Leads, with type {"IND" if form == "Individual" else "CORP"}, status Assigned and Captured = today. It is listed under the {form} chip.', 'High')
    if form == 'Individual':
        C(nid(), uc, 'Create Individual Lead', 'Create an Individual lead with the profile fields filled', pre,
          steps(LEADS, 'Click "Individual"', 'Fill the mandatory fields plus Gender, Nationality, City, Buyer Type, Budget, Timeline and Qualification Notes from the Individual Leads sheet', 'Click Create Lead'),
          f'{TD} → Individual Leads (random row)', 'The lead is created; the Lead Detail shows the budget and timeline that were entered.', 'Medium')
    C(nid(), uc, f'Duplicate Check ({form})', 'Exact duplicate is blocked', 'A lead created in this run',
      steps(LEADS, f'Click {btn}', 'Enter the same first name, last name, mobile and email as the existing lead', 'Click Create Lead'),
      f'{TD} → {sheet}, Messages', 'Pop-up "Duplicate Lead — Blocked" names the existing Lead No.; no second lead is saved (All Leads count and search result unchanged).', 'High', 'Negative')
    C(nid(), uc, f'Duplicate Check ({form})', 'Duplicate message uses the wording from the use case', 'A lead created in this run',
      steps(LEADS, f'Click {btn}', 'Enter the same details as the existing lead', 'Click Create Lead', 'Read the message'),
      f'{TD} → Messages (Duplicate Use Case Text)', 'The message says "This lead has already been created" (wording required by the use case).', 'Low', 'Negative')
    if form == 'Individual':
        C(nid(), uc, 'Duplicate Check (Individual)', 'Duplicate check ignores letter case and phone spacing', 'A lead created in this run',
          steps(LEADS, 'Click "Individual"', 'Enter the existing lead\'s name and email in CAPITAL letters and its mobile without spaces', 'Click Create Lead'),
          f'{TD} → Individual Leads', 'The lead is recognised as a duplicate and blocked; nothing is saved.', 'Medium', 'Negative')
    C(nid(), uc, f'Duplicate Check ({form})', 'Mobile number already used by another lead is blocked', 'A lead created in this run',
      steps(LEADS, f'Click {btn}', 'Enter a different name and email but the existing lead\'s mobile', 'Click Create Lead'),
      f'{TD} → {sheet}, Messages', 'Pop-up "Lead Already Exists — This mobile number is already used by lead <Lead No.>"; nothing is saved.', 'High', 'Negative')
    C(nid(), uc, f'Duplicate Check ({form})', 'Email already used by another lead is blocked', 'A lead created in this run',
      steps(LEADS, f'Click {btn}', 'Enter a different name and mobile but the existing lead\'s email', 'Click Create Lead'),
      f'{TD} → {sheet}, Messages', 'Pop-up "Lead Already Exists — This email is already used by lead <Lead No.>"; nothing is saved.', 'High', 'Negative')
    if form == 'Individual':
        C(nid(), uc, 'Duplicate Check (Individual)', 'Same name with a different mobile and email is allowed', 'A lead created in this run',
          steps(LEADS, 'Click "Individual"', 'Enter the existing lead\'s first and last name with a new mobile and a new email', 'Click Create Lead'),
          f'{TD} → Individual Leads', 'The lead is created (two people can share a name); "Lead Created" pop-up is shown.', 'Medium')
    C(nid(), uc, f'Create {form} Lead', 'Close discards the form without saving', pre,
      steps(LEADS, f'Click {btn}', f'Fill the mandatory fields from the {sheet} sheet', 'Click Close'),
      f'{TD} → {sheet}', 'The form closes, the Leads list is shown again and no lead is saved (search by the email finds nothing).', 'Medium', 'Negative')

create_cases('HLUC-01', 'Individual', 0, 'Title, First Name, Mobile, Email, Lead Source', [
    ('Email must be a valid email address', 'Email'),
    ('Mobile and WhatsApp must include the country code', 'Mobile / WhatsApp'),
    ('Number fields accept numbers only', 'Marketing Budget / Budget / Units Interested / Interaction Count'),
    ('Name fields accept letters only', 'First Name / Last Name'),
    ('Date of Birth cannot be in the future', 'Date of Birth'),
])
create_cases('HLUC-02', 'Corporate', 30, 'Entity Title, Legal Entity / Company Name, Customer / Entity Type, Primary Contact Designation, Primary Contact First Name, Primary Contact Last Name, Mobile, Email, Lead Source', [
    ('Email must be a valid email address', 'Email'),
    ('Mobile and WhatsApp must include the country code', 'Mobile / WhatsApp'),
    ('Website must be a valid URL', 'Website'),
    ('Number fields accept numbers only', 'Marketing Budget / Budget / Units Interested / Interaction Count'),
    ('Contact name fields accept letters only', 'Primary Contact First Name / Last Name'),
    ('Date of Incorporation cannot be in the future', 'Date of Incorporation'),
])

uc = 'HLUC-03'
pre = 'Signed in; leads exist'
TR = f'{TD} → Tab Rules'
n = 60
def nid():
    global n
    n += 1
    return f'LP-{n:03d}'
for tab in ['All Leads', 'My Leads', 'Unassigned', 'To Qualify', 'Ready to Convert']:
    C(nid(), uc, 'Tab Counts', f'{tab}: tab count = Total Leads card = leads listed', pre,
      steps(LEADS, f'Click the "{tab}" tab', 'Note the number on the tab', 'Note the TOTAL LEADS card', 'Note the total in the pager ("Showing 1–20 of N leads")'),
      TR, 'All three numbers are the same.', 'High')
C(nid(), uc, 'Tab Contents', 'My Leads shows only leads owned by the signed-in user', pre,
  steps(LEADS, 'Click "My Leads"', 'Sort the Assigned column A→Z and read the first row', 'Sort Z→A and read the first row'),
  TR, 'Every lead on My Leads is assigned to the signed-in user (first and last owner after sorting are both the signed-in user).', 'High')
C(nid(), uc, 'Tab Contents', 'Unassigned shows only leads without an owner', pre,
  steps(LEADS, 'Click "Unassigned"', 'Read the Assigned column of every row'),
  TR, 'No lead on the Unassigned tab has an owner.', 'High')
C(nid(), uc, 'Tab Contents', 'To Qualify shows only leads that still need qualifying', pre,
  steps(LEADS, 'Click "To Qualify"', 'Select each status in "Filter by status" and note the number of leads'),
  TR, 'Only the statuses New, Assigned, Contacted and Nurturing have leads; the counts add up to the tab count.', 'High')
C(nid(), uc, 'Tab Contents', 'Ready to Convert shows only qualified leads', pre,
  steps(LEADS, 'Click "Ready to Convert"', 'Select each status in "Filter by status" and note the number of leads'),
  TR, 'Only status Qualified has leads, and its count equals the tab count.', 'High')
C(nid(), uc, 'Card Counts', 'ASSIGNED card matches its formula and its click', pre,
  steps(LEADS, 'Note the TOTAL LEADS card, its formula line and the Unassigned tab count', 'Note the ASSIGNED card and its formula line "Total (N) − Unassigned (M)"', 'Click the ASSIGNED card and note the pager total'),
  '—', 'ASSIGNED = TOTAL LEADS − Unassigned, as its formula line says (leads with an owner); the numbers in the formula equal the TOTAL LEADS card and the Unassigned tab; the TOTAL LEADS formula adds up to TOTAL LEADS; clicking ASSIGNED lists that many leads.', 'High')
for card, status in [('Qualified', 'Qualified'), ('Disqualified', 'Disqualified')]:
    C(nid(), uc, 'Card Counts', f'{card.upper()} card matches the list and its click', pre,
      steps(LEADS, f'Note the {card.upper()} card', f'Select "{status}" in "Filter by status" and note the pager total', 'Reset the filter', f'Click the {card.upper()} card and note the pager total and the Status column'),
      '—', f'Card number = number of {status} leads in the list = number shown after clicking the card, and every row shown has status {status}.', 'High')
C(nid(), uc, 'Card Counts', 'TOTAL LEADS card click shows every lead', pre,
  steps(LEADS, 'Click the ASSIGNED card', 'Click the TOTAL LEADS card'), '—', 'The pager total returns to the TOTAL LEADS number.', 'Medium')
C(nid(), uc, 'Card Counts', 'Status and type counts add up to the total', pre,
  steps(LEADS, 'Select each status in "Filter by status" and add the pager totals', 'Click the Individual and Corporate chips and add their totals'),
  '—', 'Both sums equal the TOTAL LEADS card.', 'High')
C(nid(), uc, 'Card Counts', 'Search narrows the cards and the list together', pre,
  steps(LEADS, 'Search for the email of a lead created in this run'), f'{TD} → Individual Leads',
  'TOTAL LEADS card = 1 = leads listed; the lead\'s status card shows 1.', 'Medium')
import csv as _csv
def changes_text(action):
    """Expected count changes of an action, in words, from TestData/csv/Count Changes.csv."""
    with open(os.path.join(ROOT, 'TestData', 'csv', 'Count Changes.csv'), encoding='utf-8-sig') as f:
        row = next(r for r in _csv.DictReader(f) if r['Action'] == action)
    moved = [f"{k.replace(' card', ' card').upper() if k.endswith('card') else k} {int(v):+d}" for k, v in row.items() if k != 'Action' and int(v) != 0]
    same = [k.upper() if k.endswith('card') else k for k, v in row.items() if k != 'Action' and int(v) == 0]
    return f"Changes: {', '.join(moved) or 'none'}; unchanged: {', '.join(same) or 'none'}"

for action, what in [('Create', 'Create a new Individual lead'), ('Assign', 'Open a lead created in this run and assign it to the user from Lead Actions'),
                     ('Qualify', 'Open a lead created in this run, fill the Qualification checklist and click Qualify Lead'),
                     ('Disqualify', 'Open a lead created in this run, choose the Disqualification Reason and Remarks and click Disqualify Lead'),
                     ('Convert', 'Open a qualified lead created in this run, click Move to Opportunity and confirm Convert')]:
    C(nid(), uc, 'Count Updates', f'Counts update after {action.lower()}', 'Signed in; no other user is changing leads during the test',
      steps(LEADS, 'Note every tab count and the TOTAL, ASSIGNED, QUALIFIED and DISQUALIFIED cards on All Leads', what, 'Reload the Leads page and note the same numbers again'),
      f'{TD} → Count Changes (row {action}), Qualification, Lead Actions',
      f'{changes_text(action)} (Count Changes sheet, row "{action}").', 'High')

HEAD = ['TC ID', 'Use Case', 'Area', 'Test Case', 'Preconditions', 'Test Steps', 'Test Data', 'Expected Result', 'Priority', 'Type', 'Automation', 'Why It Matters']
WIDTH = [9, 10, 22, 42, 26, 60, 34, 60, 9, 10, 11, 50]
AREA_IMPACT = {
    'Create Individual Lead': 'Sales cannot capture an individual buyer correctly (missing or wrong fields), so the lead is lost or contacted with wrong details.',
    'Duplicate Check (Individual)': 'The same buyer can be entered twice, so two salespeople may chase one person and the counts are inflated.',
    'Create Corporate Lead': 'Sales cannot capture a company lead correctly, so the corporate enquiry is lost or has wrong details.',
    'Duplicate Check (Corporate)': 'The same company can be entered twice, so two salespeople may chase one company and the counts are inflated.',
    'Tab Counts': 'The tab numbers do not match their lists, so salespeople and managers work from wrong workload figures.',
    'Tab Contents': 'A tab lists leads that do not belong there (or misses some), so leads are worked in the wrong queue or forgotten.',
    'Card Counts': 'The cards at the top of the Leads page show numbers that do not match the list or their own formula, so management reads wrong lead totals.',
    'Count Updates': 'After a lead action the counts move the wrong way, so the dashboard figures drift away from the real number of leads.',
}
CASE_IMPACT = {
    'LP-070': 'The ASSIGNED card does not equal the formula printed under it (Total − Unassigned): the Disqualified leads are left out without saying so, and the TOTAL LEADS formula does not add up either. Anyone checking the numbers by hand gets a different answer from the screen.',
    'LP-079': 'Disqualifying a lead takes it out of ASSIGNED although the lead keeps its owner, so ASSIGNED no longer equals Total − Unassigned as its formula says.',
}
for c in cases:
    c.append(CASE_IMPACT.get(c[0], AREA_IMPACT.get(c[2], '')))
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
ov['A1'] = 'Leads Page — Test Cases'
ov['A1'].font = Font(name='Arial', size=14, bold=True, color='12465B')
lines = [
    ('Page', 'Leads (/leads): All Leads, My Leads, Unassigned, To Qualify, Ready to Convert; Create Individual and Create Corporate lead forms; Lead Detail actions.'),
    ('Use cases', 'HLUC-01 Create Individual Lead · HLUC-02 Create Corporate Lead · HLUC-03 Validate Lead Counts'),
    ('Test data', f'{TD} (or TestData/csv/*.csv with TEST_DATA_FORMAT=csv). No values are hard-coded in the tests.'),
    ('Automation', 'tests/leads-page/*.spec.ts — run with: npm run test:leads-page'),
    ('Report', 'reports/Leads_Page_Test_Report_<date>_<time>.xlsx (Summary, Defects with steps + screenshot, All Results with steps and expected result)'),
    ('Test cases', f'{len(cases)} cases; Invalid Values rows run as sub-cases (e.g. LP-005.1, LP-005.2).'),
    ('Data created', 'The tests create new leads with realistic names and unique example.* emails, and qualify / disqualify / convert / re-assign only leads they created.'),
]
for i, (k, v) in enumerate(lines, start=3):
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
dv.add(f'K2:K{len(cases) + 1}')

UC = [
    ['HLUC-01', 'Create Individual Lead', 'Mandatory fields: Title, First Name, Mobile, Email, Lead Source', 'LP-002, LP-003, LP-004'],
    ['HLUC-01', 'Create Individual Lead', 'Email and Mobile must be valid; dates valid; number fields numeric only', 'LP-005, LP-006, LP-007, LP-008, LP-009, LP-010'],
    ['HLUC-01', 'Create Individual Lead', 'Duplicate check on first name, last name, mobile and email → "This lead has already been created"; lead not saved', 'LP-016, LP-017, LP-018, LP-019, LP-020, LP-021'],
    ['HLUC-01', 'Create Individual Lead', 'Saved with Lead No. and Score; owner = logged-in user; shows in All Leads and My Leads', 'LP-001, LP-011, LP-012, LP-013, LP-014, LP-015, LP-022'],
    ['HLUC-02', 'Create Corporate Lead', 'Mandatory fields: Entity Title, Company Name, Entity Type, Contact Designation, Contact First/Last Name, Mobile, Email, Lead Source', 'LP-032, LP-033, LP-034'],
    ['HLUC-02', 'Create Corporate Lead', 'Email, Mobile and Website valid; dates valid; numbers numeric', 'LP-035, LP-036, LP-037, LP-038, LP-039, LP-040, LP-041'],
    ['HLUC-02', 'Create Corporate Lead', 'Duplicate check as HLUC-01', 'LP-046, LP-047, LP-048, LP-049'],
    ['HLUC-02', 'Create Corporate Lead', 'Saved with Lead No. and Score; owner = logged-in user; shows in All Leads and My Leads', 'LP-031, LP-042, LP-043, LP-044, LP-045, LP-050'],
    ['HLUC-03', 'Validate Lead Counts', 'Each tab shows only its own leads', 'LP-066, LP-067, LP-068, LP-069'],
    ['HLUC-03', 'Validate Lead Counts', 'Tab count = Total Leads card = leads listed', 'LP-061, LP-062, LP-063, LP-064, LP-065'],
    ['HLUC-03', 'Validate Lead Counts', 'Assigned / Qualified / Disqualified cards match the list; clicking a card shows exactly that number', 'LP-070, LP-071, LP-072, LP-073, LP-074, LP-075'],
    ['HLUC-03', 'Validate Lead Counts', 'Counts update after create, assign, qualify, disqualify, convert', 'LP-076, LP-077, LP-078, LP-079, LP-080'],
]
tr = wb.create_sheet('Traceability')
sheet(tr, ['Use Case', 'Name', 'Requirement', 'Test Cases'], UC, [10, 24, 80, 50])

FINDINGS = [
    ['F-01', 'Defect', 'LP-068', 'To Qualify tab lists Lost leads', 'Filter "To Qualify" by status: Lost has leads (127 on 20 Oct 2026) next to Assigned and Contacted.', 'To Qualify holds only leads that still need qualifying (New, Assigned, Contacted, Nurturing).', 'High'],
    ['F-02', 'Defect', 'LP-079', 'Disqualified lead stays in To Qualify', 'Disqualify a lead from To Qualify: DISQUALIFIED +1 and ASSIGNED -1, but the To Qualify count does not change.', 'To Qualify count drops by 1 after a disqualify.', 'High'],
    ['F-03', 'Defect', 'LP-017, LP-047', 'Duplicate message wording differs from the use case', 'App shows "Duplicate Lead — Blocked … Creation is blocked" (with the existing Lead No.).', 'Use case HLUC-01/02: "This lead has already been created". Either the app or the use case text needs to change.', 'Low'],
    ['F-04', 'Observation', 'LP-064, LP-065', 'Tabs use different scopes', "To Qualify = the signed-in user's leads only (\"Your assigned leads…\"); Ready to Convert = every user's qualified leads.", 'Confirm the intended scope of each tab with the product owner.', 'Medium'],
    ['F-05', 'Observation', 'LP-014', 'Captured date shown in UTC', "Leads created between 00:00 and 05:30 IST show yesterday's date in the Captured column, while Status History shows the local time.", "Captured uses the user's local date.", 'Low'],
    ['F-06', 'Observation', 'LP-007, LP-038', 'Number fields accept letters while typing', 'Marketing Budget, Budget, Units Interested and Interaction Count take letters; the error appears only on Create Lead.', 'Optional: block non-numeric input as it is typed.', 'Low'],
]

ids = [c[0] for c in cases]
assert len(ids) == len(set(ids)), 'duplicate IDs'
for row in UC:
    for t in row[3].split(', '):
        assert t in ids, f'{t} not defined'
CHANGES = [
    ['25 Oct 2026', 'v2.0 2410-02', 'KPI cards rebuilt (button.crm-metric-card-button: h3 label + value); same labels, click still filters the list', 'LP-061 … LP-075 (locator only, no wording change)'],
    ['25 Oct 2026', 'v2.0 2410-02', 'Lead Detail: owner shown as "Assigned to <owner>" under the name (ASSIGNED tile removed); Assign Lead → Reassign lead', 'LP-013, LP-044, LP-077 (steps reworded)'],
    ['25 Oct 2026', 'v2.0 2410-02', 'Qualify form: Bedrooms now 3 / 4 / 5+ (no 2 Bedrooms); success pop-up "Lead Qualified"; Disqualify asks for confirmation', 'LP-078 … LP-080 (data: Qualification sheet Bedrooms = 3 Bedrooms)'],
    ['03 Nov 2026', 'v2.0 0111-11', 'ASSIGNED card now counts leads with an owner: formula line "Total (N) − Unassigned (M)"; clicking it lists Assigned, Qualified … leads', 'LP-070 (expected result rewritten); Count Changes data: Qualify and Disqualify leave ASSIGNED unchanged (the lead keeps its owner)'],
    ['25 Oct 2026', 'v2.0 2410-02', 'Create forms unchanged (fields, mandatory list, messages); option lists changed: Gender + Don’t Know, new campaigns, 7 lead owners, new product types', 'No change needed'],
]
sheet(wb.create_sheet('Change Log'), ['Date', 'Build', 'UI change', 'Test cases updated'], CHANGES, [12, 14, 90, 50])
fd = wb.create_sheet('Findings')
sheet(fd, ['ID', 'Type', 'Test Cases', 'Finding', 'What happens', 'Expected', 'Severity'], FINDINGS, [7, 12, 14, 38, 60, 50, 9])
out = os.path.join(ROOT, 'Testcase', 'Leads_Page_Test_Cases.xlsx')
wb.save(out)
print(out, len(cases), 'cases:', ids[0], '…', ids[-1])
