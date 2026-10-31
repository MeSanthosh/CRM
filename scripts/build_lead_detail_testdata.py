"""Builds TestData/Lead_Detail_Test_Data.xlsx and TestData/csv/Lead_Detail/*.csv (same content).
Run from the repo root:  python scripts/build_lead_detail_testdata.py
"""
import csv, os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

OUT = os.path.join(os.path.dirname(__file__), '..', 'TestData')
CSV = os.path.join(OUT, 'csv', 'Lead_Detail')
os.makedirs(CSV, exist_ok=True)
S = {}

S['Settings'] = (['Setting', 'Value', 'What it means'], [
    ['Copy Link Pattern', '{base}/leads?selected={id}', 'Link copied by "Copy link": {base} = site address, {id} = the lead\'s internal id'],
    ['Me Suffix', '(me)', 'Text after the signed-in user in the "Logged for" / "Assigned to" lists'],
    ['Assign User', 'QA Sales User', 'User a lead is re-assigned to in the Assign Lead tests'],
    ['Status After Qualify', 'Qualified', 'Lead status after Qualify Lead'],
    ['Status After Convert', 'Converted', 'Lead status after Move to Opportunity → Convert'],
    ['Status After Disqualify', 'Disqualified', 'Lead status after Disqualify Lead'],
    ['Tasks Route', '/activities', 'Tasks & Calendar page'],
    ['Opportunities Route', '/opportunities', 'Opportunities page'],
    ['Leads Export File', 'leads-{date}.xlsx', 'Name of the Leads export ({date} = yyyy-mm-dd)'],
    ['Tasks Export File', 'tasks-and-calls-{date}.xlsx', 'Name of the Tasks & Calls export'],
    ['Related To Pattern', 'LEAD {leadNo}', 'Related To column of the Tasks & Calls export'],
    ['Individual Prospect Type', 'Individual (Person)', 'PROSPECT TYPE shown for an Individual lead'],
    ['Empty Budget', '0 USD', 'BUDGET shown for a lead created without a budget'],
    ['Tasks Filter Open', 'All open', 'Task filter option for open tasks on Tasks & Calendar'],
    ['Tasks Filter Completed', 'Completed', 'Task filter option for completed tasks'],
    ['Tasks Whose All', 'Everyone', "Whose tasks option that shows every user's tasks"],
    ['Task Status Open', 'Open', 'Status column of an open task on Tasks & Calendar'],
    ['Export Open Status', 'OPEN', 'Status column of an open task in the Tasks & Calls export'],
    ['Reassign Reason', 'Customer prefers a consultant who speaks Swahili.', 'Typed in "Reason for reassigning" (Reassign lead)'],
    ['Reopen Status', 'Contacted', 'Status chosen in "Reopen As" for a disqualified lead'],
    ['Reopen Reason', 'Customer called back and wants to see the show apartment.', 'Status Change Reason typed when reopening'],
])

S['Messages'] = (['Message Key', 'Expected Text', 'Where it appears'], [
    ['Required Title', 'Required Fields Missing', 'Pop-up when Disqualify / Change Status is pressed with required fields empty'],
    ['Disqualify Confirm Title', 'Disqualify Lead', 'Confirmation after pressing "Disqualify lead"'],
    ['Disqualify Confirm Button', 'Disqualify', 'Button that confirms the disqualification'],
    ['Disqualify Cancel Button', 'Cancel', 'Button that cancels the disqualification'],
    ['Disqualified Title', 'Lead Disqualified', 'Pop-up after the disqualification is confirmed'],
    ['Disqualified Body', 'The lead is marked Disqualified.', 'Same pop-up'],
    ['Qualified Title', 'Lead Qualified', 'Pop-up after "Qualify lead"'],
    ['Qualified Body', '{name} was qualified successfully.', 'Same pop-up'],
    ['Current Owner Note', "The current owner can't be picked again.", 'Note under "Assign to"'],
    ['Status Changed Title', 'Status Changed', 'Pop-up after Change Status'],
    ['Status Changed Body', 'Lead moved to {status}.', 'Same pop-up'],
    ['Assigned Title', 'Lead Assigned', 'Pop-up after Assign Lead'],
    ['Assigned Body', 'Lead assigned to {user}.', 'Same pop-up'],
    ['Assignee Required Title', 'Assignee Required', 'Pop-up when a user who is not the owner presses Qualify Lead'],
    ['Assignee Required Body', 'Only the assigned user can complete qualification for this lead', 'Same pop-up'],
    ['Qualify Missing Title', 'Qualification Details Missing', 'Pop-up when Qualify Lead is pressed without the checklist'],
    ['Score Title', 'Score Recalculated', 'Pop-up after Recalculate Score'],
    ['Score Body', 'Computed score {score}. Suggested rating: {rating}.', 'Same pop-up'],
    ['Convert Confirm Title', 'Convert lead to opportunity?', 'Confirmation before converting'],
    ['Convert Go Back', 'Go back', 'Button that cancels the conversion'],
    ['Convert Button', 'Convert', 'Button that confirms the conversion'],
    ['Subject Required', 'Subject is required.', 'Call / task / meeting form'],
    ['Due Required', 'Due date and time is required.', 'Task / meeting form'],
    ['Call Future', 'Call time cannot be in the future.', 'Log call form'],
    ['Follow-up Required', 'Choose when to follow up.', 'Log call form with the follow-up box ticked'],
    ['Follow-up Subject', 'Follow up: {subject}', 'Task created by a call with a follow-up'],
    ['Follow-up Notes', 'Follow-up after call ({outcome}).', 'Notes of that task'],
    ['Linked To', 'Linked to {leadNo}', 'Under the title of the call / task / meeting form'],
    ['Done Line', 'Done {date} by {user}', 'Completed task line ({date} = dd Mon yyyy)'],
    ['History Created', 'Lead created', 'First Status History entry'],
    ['History Qualified', 'Qualified with score {score}', 'Status History entry after qualifying'],
    ['Owner Created', 'Assigned during lead creation', 'First Owner History entry'],
    ['Owner Reassigned', 'Assigned from lead detail', 'Owner History entry after Assign Lead'],
    ['Edit Save Button', 'Save changes', 'Save button of the Edit Call / Task / Meeting form'],
])

S['Workflow'] = (['Item', 'After Create', 'After Qualify'], [
    ['Lead Captured', 'DONE', 'DONE'],
    ['Assigned', 'IN PROGRESS', 'DONE'],
    ['Qualified', 'UP NEXT', 'IN PROGRESS'],
    ['Moved to Opportunity', 'UP NEXT', 'UP NEXT'],
    ['Now', '', 'Qualified'],
    ['Next', '', 'Move to Opportunity'],
    ['Next Actions', 'Reassign Lead | Qualify Lead | Disqualify Lead', ''],
])

S['Disqualify Reasons'] = (['Reason', 'Remarks'], [
    ['Unreachable after repeated attempts', 'Called five times over two weeks without an answer.'],
    ['Invalid contact details', 'Mobile number is not in service and the email bounced.'],
    ['Not interested', 'Customer said they are no longer planning to buy this year.'],
    ['Budget does not match', 'Budget is well below the starting price of the project.'],
    ['Bought elsewhere', 'Customer has bought an apartment in another development.'],
    ['Duplicate of another lead', 'Same customer already exists as an open lead.'],
    ['Spam / test enquiry', 'Enquiry form was filled with random text.'],
    ['Other', 'Customer moved abroad and stopped the search.'],
])

S['Status Changes'] = (['Step', 'Options Before', 'Move Back To', 'Reason'], [
    ['1', 'Contacted | Nurturing', 'Contacted', 'Spoke with the customer; waiting for budget confirmation.'],
    ['2', 'Assigned | Nurturing', 'Nurturing', 'Customer asked to be contacted again next quarter.'],
    ['3', 'Assigned | Contacted', 'Assigned', 'Customer is ready to talk again; back to the sales owner.'],
])

S['Qualification Checklist'] = (['Checklist Item', 'Field Label', 'Value'], [
    ['Buyer Type', 'Buyer Type', 'Investor'],
    ['Funding Source', 'Funding', 'Cash'],
    ['Purpose of Purchase', 'Purpose of Purchase', 'Investment'],
    ['Decision Maker Status', 'Decision Maker Status', 'Primary Decision Maker'],
    ['Affordability Status', 'Affordability Assessment', 'Strong'],
    ['Last Interaction Date & Time', 'Last Interaction', '{today-1} 11:00'],
    ['Interaction Type', 'Interaction Type', 'Site Visit'],
    ['Interaction Outcome', 'Interaction Outcome', 'Positive'],
    ['Purchase Timeline', 'Timeline', '0-3 Months'],
    ['Budget', 'Budget', '450000'],
    ['Qualification Notes', 'Notes', 'Visited the show apartment and confirmed the budget; ready to move to an opportunity.'],
    ['Unit Preference (type, bedroom, or view)', 'Bedrooms', '3 Bedrooms'],
])

OPTS = {
    'Rating': ['Nurture', 'Cold', 'Warm', 'Hot'],
    'Buyer Type': ['Investor', 'End User', 'Holiday Home Buyer', 'Retirement Buyer'],
    'Funding': ['Cash', 'Mortgage', 'Mixed Funding', 'Undecided'],
    'Purpose of Purchase': ['Self Use', 'Investment', 'Rental Income', 'Holiday Home', 'Other'],
    'Decision Maker Status': ['Primary Decision Maker', 'Joint Decision Maker', 'Influencer Only', 'Not Decision Maker'],
    'Affordability Assessment': ['Strong', 'Moderate', 'Weak', 'Insufficient Data'],
    'Timeline': ['Immediate', '0-3 Months', '3-6 Months', '6-12 Months', '12+ Months'],
    'Interaction Type': ['Call', 'WhatsApp', 'Email', 'Roadshow', 'Meeting', 'Site Visit', 'Virtual Visit'],
    'Interaction Outcome': ['Positive', 'Neutral', 'Negative', 'No Response', 'Callback Requested'],
    'Preferred Unit Type': ['Apartment', 'Residence', 'Penthouse'],
    'Bedrooms': ['3 Bedrooms', '4 Bedrooms', '5+ Bedrooms'],
    'Preferred View': ['V1 - Panoramic Ocean View', 'V2 - Direct Ocean View', 'V3 - Partial Ocean View', 'V4 - Garden / Landscape View',
                       'V5 - Pool / Amenity View', 'V6 - Mixed View', 'V7 - Inland / Building View', 'V8 - Restricted / Obstructed View'],
    'Income Range': ['Less than 50,000', '50,000 to 100,000', '100,000 to 250,000', '250,000 to 500,000', '500,000 to 1,000,000', 'Above 1,000,000'],
    'Gender': ['Male', 'Female', 'Transgender', "Don't Know", 'Not Preferred'],
}
OTHER_OPTS = {
    'Disqualification Reason': [r[0] for r in S['Disqualify Reasons'][1]],
    'Reopen As': ['Assigned', 'Contacted', 'Nurturing'],
    'Direction': ['Outgoing', 'Incoming'],
    'Outcome': ['Connected', 'No answer', 'Busy', 'Left a message', 'Call back later', 'Wrong number'],
    'Priority': ['Low', 'Normal', 'High'],
    'Reminder': ['No reminder', 'At due time', '15 minutes before', '1 hour before', '1 day before'],
}
S['Dropdown Options'] = (['Where', 'Field Label', 'Options'],
    [['Qualify Lead', k, ' | '.join(v)] for k, v in OPTS.items()] +
    [['Change Status' if k in ('Disqualification Reason', 'Reopen As') else 'Log call' if k in ('Direction', 'Outcome') else 'Task / Meeting' if k == 'Reminder' else 'Call / Task / Meeting', k, ' | '.join(v)] for k, v in OTHER_OPTS.items()])

# 8 combinations: together they use every option of every dropdown at least once
NOTES = ['Wants a sea-view apartment for rental income.', 'Looking for a family home near good schools.', 'Interested in a holiday home for winter stays.',
         'Plans to retire on the coast in two years.', 'Compares two projects; needs the payment plan.', 'Asked for a penthouse with a private pool.',
         'Prefers a garden view on a low floor.', 'Buying with a partner; both must sign.']
BUDGETS = ['450000', '280000', '520000', '750000', '330000', '1200000', '390000', '610000']
combo_rows = []
for i in range(8):
    row = [f'QC-{i + 1:02d}'] + [v[i % len(v)] for v in OPTS.values()] + [BUDGETS[i], NOTES[i], '{today-1} 11:00']
    combo_rows.append(row)
S['Qualification Combinations'] = (['Combination'] + list(OPTS.keys()) + ['Budget', 'Notes', 'Last Interaction'], combo_rows)

S['Call Log'] = (['Call ID', 'Subject', 'Minutes Ago', 'Direction', 'Outcome', 'Duration (minutes)', 'Priority', 'Logged For', 'Call Notes', 'Follow-up', 'Follow-up In Days', 'Follow-up Time', 'Edited Subject', 'Edited Notes'], [
    ['CALL-01', 'Introductory call', '60', 'Outgoing', 'Connected', '12', 'Normal', '(me)', 'Introduced the project and shared the brochure.', 'No', '', '', 'Introductory call with brochure', 'Introduced the project, shared the brochure and the price list.'],
    ['CALL-02', 'Payment plan discussion', '90', 'Incoming', 'Call back later', '20', 'High', '(me)', 'Customer asked for the payment plan; call back on Thursday.', 'Yes', '2', '10:00', 'Payment plan questions', 'Asked for a 40/60 plan; call back on Thursday.'],
    ['CALL-03', 'Second contact attempt', '30', 'Outgoing', 'No answer', '1', 'Low', '(me)', 'No answer; will try again tomorrow.', 'Yes', '1', '11:30', 'Second attempt, no answer', 'No answer; WhatsApp sent.'],
    ['CALL-04', 'Site visit reminder', '45', 'Outgoing', 'Busy', '1', 'Normal', 'QA Sales User', 'Line busy; message sent on WhatsApp instead.', 'No', '', '', 'Site visit reminder (busy)', 'Line busy twice; reminder sent on WhatsApp.'],
    ['CALL-05', 'Callback from customer', '120', 'Incoming', 'Left a message', '3', 'High', '(me)', 'Customer left a voicemail asking about parking.', 'No', '', '', 'Voicemail about parking', 'Customer asked how many parking bays come with a unit.'],
    ['CALL-06', 'Verify contact number', '15', 'Outgoing', 'Wrong number', '2', 'Low', '(me)', 'Number belongs to someone else; asked the customer by email.', 'No', '', '', 'Wrong number check', 'Asked the customer by email for the right number.'],
])

S['Duration Inputs'] = (['Typed', 'Expected Value', 'Why'], [
    ['abc', '', 'Letters are not accepted'],
    ['-5', '5', 'Minus sign is not accepted'],
    ['45', '45', 'Whole minutes are kept'],
    ['12.5', 'not 125', 'A decimal must not turn into a different number'],
])

S['Tasks'] = (['Task ID', 'Kind', 'Subject', 'Due In Days', 'Due Time', 'Reminder', 'Priority', 'Assigned To', 'Notes', 'Edited Subject'], [
    ['TASK-01', 'Task', 'Send price list', '2', '10:00', '15 minutes before', 'High', '(me)', 'Email the 2 bedroom price list and floor plans.', 'Send price list and floor plans'],
    ['TASK-02', 'Task', 'Prepare payment plan', '3', '11:30', '1 hour before', 'Normal', '(me)', 'Prepare a 40/60 payment plan for the customer.', 'Prepare 40/60 payment plan'],
    ['TASK-03', 'Task', 'Confirm site visit slot', '1', '16:00', 'No reminder', 'Low', 'QA Sales User', 'Check the show apartment calendar.', 'Confirm Saturday site visit slot'],
    ['TASK-04', 'Task', 'Share reservation form', '4', '09:15', 'At due time', 'Normal', '(me)', 'Send the reservation form with the KYC list.', 'Share reservation form and KYC list'],
    ['TASK-05', 'Task', 'Check mortgage options', '5', '14:45', '1 day before', 'High', '(me)', 'Ask the partner bank for a pre-approval.', 'Check mortgage pre-approval'],
    ['MEET-01', 'Meeting', 'Site visit at Palm Exotica', '5', '15:00', '1 day before', 'Normal', '(me)', 'Show the 2 bedroom sea-view apartment.', 'Site visit and show apartment tour'],
    ['MEET-02', 'Meeting', 'Online project presentation', '2', '18:00', '15 minutes before', 'High', '(me)', 'Video call with the customer and their partner.', 'Online presentation with both buyers'],
    ['MEET-03', 'Meeting', 'Payment plan meeting', '4', '11:00', 'At due time', 'Low', 'QA Sales User', 'Walk through the payment schedule.', 'Payment schedule walkthrough'],
    ['MEET-04', 'Meeting', 'Contract review', '6', '12:30', '1 hour before', 'Normal', '(me)', 'Review the draft SPA with the customer.', 'Draft SPA review'],
    ['MEET-05', 'Meeting', 'Handover of brochure pack', '3', '10:30', 'No reminder', 'High', '(me)', 'Hand over the printed brochure pack.', 'Brochure pack handover'],
])

S['Form Defaults'] = (['Form', 'Field Label', 'Default'], [
    ['Log call', 'Subject', 'Phone call'],
    ['Log call', 'Direction', 'Outgoing'],
    ['Log call', 'Outcome', 'Connected'],
    ['Log call', 'Priority', 'Normal'],
    ['Log call', 'Logged for', '(me)'],
    ['Task', 'Subject', ''],
    ['Task', 'Reminder', '15 minutes before'],
    ['Task', 'Priority', 'Normal'],
    ['Task', 'Assigned to', '(me)'],
    ['Meeting', 'Subject', ''],
    ['Meeting', 'Reminder', '15 minutes before'],
    ['Meeting', 'Priority', 'Normal'],
    ['Meeting', 'Assigned to', '(me)'],
])

S['Export Columns'] = (['Export', 'Column'], [['Leads', c] for c in [
    'Lead No', 'Name', 'Prospect Type', 'Status', 'Rating', 'Score', 'Source', 'Source Category', 'Campaign', 'Broker', 'Mobile', 'WhatsApp',
    'Email', 'Nationality', 'Country', 'City', 'Budget Min', 'Budget Max', 'Currency', 'Preferred Project', 'Preferred Unit Type',
    'Assigned To', 'Assigned At', 'Last Interaction', 'Qualified At', 'Converted At', 'Created At']] + [['Tasks & Calls', c] for c in [
    'Type', 'Subject', 'Status', 'Priority', 'Due', 'Reminder', 'Occurred', 'Call Direction', 'Call Outcome', 'Duration (min)',
    'Related To', 'Related Name', 'Assigned To', 'Completed At', 'Created By', 'Created At', 'Description']])

README = [
    'Lead Detail page test data — read by tests/lead-detail at run time. Nothing in the tests is hard-coded: change a value here and the next run uses it.',
    'The leads themselves (names, mobiles, emails) come from TestData/Leads_Test_Data.xlsx (Individual Leads sheet).',
    'Default source: this Excel file. Set TEST_DATA_FORMAT=csv to use TestData/csv/Lead_Detail/<sheet>.csv instead (same columns). Keep both copies in step.',
    'Rebuild both copies with:  python scripts/build_lead_detail_testdata.py',
    '"(me)" means the signed-in user. {today-1} = yesterday. Minutes Ago / Due In Days are counted from the moment the test runs.',
    'Disqualify Reasons, Qualification Combinations, Call Log and Tasks: each row runs as its own sub-case (e.g. LDP-025.3). Add a row to add a test.',
    'Duration Inputs: "not 125" means the field must NOT end up showing 125.',
    'Yellow cells are the values to edit. Do not rename the column headers.',
]

thin = Side(style='thin', color='BFBFBF')
HDR = PatternFill('solid', fgColor='12465B')
EDIT = PatternFill('solid', fgColor='FFF2CC')
wb = Workbook()
ws = wb.active
ws.title = 'Read Me'
ws['A1'] = 'Lead Detail Page — Test Data'
ws['A1'].font = Font(name='Arial', size=14, bold=True, color='12465B')
for i, t in enumerate(README, start=3):
    c = ws.cell(row=i, column=1, value=f'• {t}')
    c.font = Font(name='Arial', size=10)
    c.alignment = Alignment(wrap_text=True, vertical='top')
ws.column_dimensions['A'].width = 130
for name, (header, rows) in S.items():
    s = wb.create_sheet(name)
    s.append(header)
    for r in rows:
        s.append(r)
    for j, h in enumerate(header, start=1):
        c = s.cell(row=1, column=j)
        c.font = Font(name='Arial', size=10, bold=True, color='FFFFFF')
        c.fill = HDR
        c.alignment = Alignment(wrap_text=True, vertical='center')
        width = max([len(str(h))] + [len(str(r[j - 1])) for r in rows]) + 2
        s.column_dimensions[c.column_letter].width = min(max(width, 10), 60)
    for row in s.iter_rows(min_row=2):
        for c in row:
            c.font = Font(name='Arial', size=10)
            c.alignment = Alignment(wrap_text=True, vertical='top')
            c.border = Border(top=thin, bottom=thin, left=thin, right=thin)
            if name != 'Settings' or c.column == 2:
                c.fill = EDIT
    s.freeze_panes = 'A2'
    with open(os.path.join(CSV, f'{name}.csv'), 'w', newline='', encoding='utf-8-sig') as fh:
        w = csv.writer(fh)
        w.writerow(header)
        w.writerows(rows)
wb.save(os.path.join(OUT, 'Lead_Detail_Test_Data.xlsx'))
print('written TestData/Lead_Detail_Test_Data.xlsx and', len(S), 'CSV files')
