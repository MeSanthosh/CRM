"""Builds TestData/Leads_Test_Data.xlsx and TestData/csv/*.csv (same content) for the Leads page suite."""
import csv, os, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.comments import Comment

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'TestData')
os.makedirs(os.path.join(OUT, 'csv'), exist_ok=True)

SHEETS = {}

SHEETS['Settings'] = (['Setting', 'Value', 'What it means'], [
    ['Unique Token', '{unique}', 'Replaced at run time by a number unique to each test run (from the clock), so emails never repeat.'],
    ['Random Digit', '#', 'Every # in a Mobile pattern is replaced by a random digit.'],
    ['Name Slug', '{first} / {last} / {company}', 'Replaced by the row\'s First Name / Last Name / Company Name in lower case, spaces → dots.'],
    ['Relative Date', '{today} / {today+N} / {today-N}', 'Replaced by today\'s date, or N days after / before today.'],
    ['Lead No. Format', 'LD-YYYYMMDDhhmmss-XXXX', 'Expected Lead No. pattern: Y M D h m s = digits, X = letter or digit.'],
    ['New Lead Status', 'Assigned', 'Status a new lead gets when the creator becomes its owner.'],
    ['Individual Type Label', 'IND', 'Text in the Type column for an Individual lead.'],
    ['Corporate Type Label', 'CORP', 'Text in the Type column for a Corporate lead.'],
    ['Data Selection', 'random', '"random" = each run picks a different row; a Data ID (e.g. IND-03) = always use that row.'],
])

# ── People and companies (proper names; mobile/email built from patterns so they are unique every run) ──
SHEETS['Individual Leads'] = (
    ['Data ID', 'Title', 'First Name', 'Last Name', 'Mobile', 'Email', 'Lead Source', 'Gender',
     'Nationality / Citizenship Country', 'Current Residence', 'City', 'Buyer Type', 'Budget', 'Timeline', 'Qualification Notes'], [
    ['IND-01', 'Mr', 'Rahul', 'Menon', '+91 98### #####', '{first}.{last}.{unique}@example.com', 'Referrals', 'Male', 'India', 'India', 'Kochi', 'Investor', '350000', '0-3 Months', 'Looking for a 2 bedroom apartment as a rental investment.'],
    ['IND-02', 'Ms', 'Priya', 'Nair', '+91 97### #####', '{first}.{last}.{unique}@example.com', 'Property Portals', 'Female', 'India', 'India', 'Bengaluru', 'End User', '280000', '3-6 Months', 'Wants a sea-facing home for the family.'],
    ['IND-03', 'Mrs', 'Fatima', 'Hassan', '+254 7## ### ###', '{first}.{last}.{unique}@example.org', 'Events & Exhibitions', 'Female', 'Kenya', 'Kenya', 'Mombasa', 'Holiday Home Buyer', '420000', '0-3 Months', 'Met at the Nairobi property expo; asked for villa brochures.'],
    ['IND-04', 'Mr', 'Daniel', 'Kamau', '+254 7## ### ###', '{first}.{last}.{unique}@example.net', 'Direct Sales', 'Male', 'Kenya', 'Kenya', 'Nairobi', 'Investor', '600000', '6-12 Months', 'Interested in two units for rental income.'],
    ['IND-05', 'Dr', 'Amina', 'Otieno', '+254 7## ### ###', '{first}.{last}.{unique}@example.com', 'Digital Marketing', 'Female', 'Kenya', 'Kenya', 'Kisumu', 'End User', '310000', '3-6 Months', 'Responded to the online campaign; prefers a garden view.'],
    ['IND-06', 'Mr', 'James', 'Whitfield', '+44 7### ######', '{first}.{last}.{unique}@example.co.uk', 'Broker Channels', 'Male', 'United Kingdom', 'United Kingdom', 'London', 'Retirement Buyer', '750000', '12+ Months', 'Planning to retire on the coast in two years.'],
    ['IND-07', 'Ms', 'Sophie', 'Laurent', '+33 6 ## ## ## ##', '{first}.{last}.{unique}@example.fr', 'Hospitality Channels', 'Female', 'France', 'France', 'Lyon', 'Holiday Home Buyer', '520000', '6-12 Months', 'Stayed at the resort; wants a penthouse for holidays.'],
    ['IND-08', 'Mr', 'Omar', 'Al Mansoori', '+971 50 ### ####', '{first}.{last}.{unique}@example.ae', 'Strategic Partners', 'Male', 'United Arab Emirates', 'United Arab Emirates', 'Dubai', 'Investor', '900000', 'Immediate', 'Partner referral; ready to reserve this month.'],
    ['IND-09', 'Mrs', 'Anjali', 'Sharma', '+91 99### #####', '{first}.{last}.{unique}@example.in', 'Public Relations', 'Female', 'India', 'India', 'Mumbai', 'End User', '330000', '0-3 Months', 'Read the press feature; asked for a site visit.'],
    ['IND-10', 'Prof', 'Thomas', 'Becker', '+49 151 ########', '{first}.{last}.{unique}@example.de', 'Referrals', 'Male', 'Germany', 'Germany', 'Munich', 'Investor', '680000', '3-6 Months', 'Referred by an existing owner; compares two projects.'],
])

SHEETS['Corporate Leads'] = (
    ['Data ID', 'Entity Title', 'Legal Entity / Company Name', 'Customer / Entity Type', 'Industry / Sector',
     'Primary Contact Designation', 'Primary Contact First Name', 'Primary Contact Last Name', 'Mobile', 'Email',
     'Website', 'Lead Source', 'Investment Mandate'], [
    ['CORP-01', 'Ltd', 'Coastline Holdings', 'Company', 'Real Estate', 'Director', 'Grace', 'Wanjiru', '+254 7## ### ###', '{first}.{last}.{unique}@example.com', 'https://www.coastlineholdings.example.com', 'Direct Sales', 'Buy 4–6 apartments for corporate housing.'],
    ['CORP-02', 'LLC', 'Baobab Ventures', 'Family Office', 'Investment', 'Managing Partner', 'Peter', 'Mwangi', '+254 7## ### ###', '{first}.{last}.{unique}@example.org', 'https://www.baobabventures.example.org', 'Broker Channels', 'Long-term rental portfolio on the coast.'],
    ['CORP-03', 'PLC', 'Harbourview Capital', 'Investment Company', 'Banking', 'Chief Investment Officer', 'Oliver', 'Bennett', '+44 7### ######', '{first}.{last}.{unique}@example.co.uk', 'https://www.harbourviewcapital.example.co.uk', 'Strategic Partners', 'Yield-focused residential investments in East Africa.'],
    ['CORP-04', 'FZE', 'Desert Pearl Investments', 'Investment Company', 'Investment', 'Head of Acquisitions', 'Khalid', 'Al Farsi', '+971 50 ### ####', '{first}.{last}.{unique}@example.ae', 'https://www.desertpearl.example.ae', 'Events & Exhibitions', 'Acquire a block of villas for resale.'],
    ['CORP-05', 'Inc', 'Northstar Pension Trust', 'Pension Fund', 'Pension', 'Portfolio Manager', 'Sarah', 'Collins', '+1 415 ### ####', '{first}.{last}.{unique}@example.com', 'https://www.northstarpension.example.com', 'Referrals', 'Diversify into international residential property.'],
    ['CORP-06', 'Ltd', 'Savannah Hospitality Group', 'Company', 'Hospitality', 'Operations Director', 'Joseph', 'Njoroge', '+254 7## ### ###', '{first}.{last}.{unique}@example.net', 'https://www.savannahhospitality.example.net', 'Hospitality Channels', 'Serviced apartments for hotel guests.'],
    ['CORP-07', 'Corp', 'Lakeside Realty', 'REIT', 'Real Estate', 'Asset Manager', 'Michael', 'Chen', '+65 9### ####', '{first}.{last}.{unique}@example.sg', 'https://www.lakesiderealty.example.sg', 'Digital Marketing', 'Add a coastal resort asset to the fund.'],
])

# ── Form fields: label (as shown in the form) → field name in the page; Mandatory drives the required-field tests ──
F = lambda form, label, name, kind, mand: [form, label, name, kind, mand]
SHEETS['Form Fields'] = (['Form', 'Field Label', 'Field Name', 'Field Type', 'Mandatory'], [
    F('Individual', 'Title', 'titleRefId', 'Dropdown', 'Yes'),
    F('Individual', 'First Name', 'firstName', 'Text', 'Yes'),
    F('Individual', 'Last Name', 'lastName', 'Text', 'No'),
    F('Individual', 'Mobile', 'mobileNo', 'Text', 'Yes'),
    F('Individual', 'Email', 'email', 'Text', 'Yes'),
    F('Individual', 'WhatsApp', 'whatsappNo', 'Text', 'No'),
    F('Individual', 'Lead Source', 'leadSourceRefId', 'Dropdown', 'Yes'),
    F('Individual', 'Gender', 'genderRefId', 'Dropdown', 'No'),
    F('Individual', 'Nationality / Citizenship Country', 'nationalityCode', 'Dropdown', 'No'),
    F('Individual', 'Current Residence', 'currentResidenceCountryCode', 'Dropdown', 'No'),
    F('Individual', 'City', 'city', 'Text', 'No'),
    F('Individual', 'Buyer Type', 'buyerTypeRefId', 'Dropdown', 'No'),
    F('Individual', 'Budget', 'budgetMax', 'Text', 'No'),
    F('Individual', 'Timeline', 'purchaseTimelineRefId', 'Dropdown', 'No'),
    F('Individual', 'Qualification Notes', 'qualificationNotes', 'Text', 'No'),
    F('Individual', 'Marketing Budget', 'acquisitionCost', 'Text', 'No'),
    F('Individual', 'Units Interested', 'unitsInterestedCount', 'Text', 'No'),
    F('Individual', 'Interaction Count', 'interactionCount', 'Text', 'No'),
    F('Individual', 'Date of Birth', 'Date of Birth', 'Date picker', 'No'),
    F('Individual', 'Score', 'scoreTotal', 'Read-only', 'No'),
    F('Corporate', 'Entity Title', 'titleRefId', 'Dropdown', 'Yes'),
    F('Corporate', 'Legal Entity / Company Name', 'companyName', 'Text', 'Yes'),
    F('Corporate', 'Customer / Entity Type', 'entityTypeRefId', 'Dropdown', 'Yes'),
    F('Corporate', 'Industry / Sector', 'industryRefId', 'Dropdown', 'No'),
    F('Corporate', 'Website', 'website', 'Text', 'No'),
    F('Corporate', 'Primary Contact Designation', 'primaryContactDesignation', 'Text', 'Yes'),
    F('Corporate', 'Primary Contact First Name', 'firstName', 'Text', 'Yes'),
    F('Corporate', 'Primary Contact Last Name', 'lastName', 'Text', 'Yes'),
    F('Corporate', 'Mobile', 'mobileNo', 'Text', 'Yes'),
    F('Corporate', 'Email', 'email', 'Text', 'Yes'),
    F('Corporate', 'WhatsApp', 'whatsappNo', 'Text', 'No'),
    F('Corporate', 'Lead Source', 'leadSourceRefId', 'Dropdown', 'Yes'),
    F('Corporate', 'Investment Mandate', 'investmentMandate', 'Text', 'No'),
    F('Corporate', 'Date of Incorporation', 'dateOfIncorporation', 'Date', 'No'),
    F('Corporate', 'Marketing Budget', 'acquisitionCost', 'Text', 'No'),
    F('Corporate', 'Budget', 'budgetMax', 'Text', 'No'),
    F('Corporate', 'Units Interested', 'unitsInterestedCount', 'Text', 'No'),
    F('Corporate', 'Interaction Count', 'interactionCount', 'Text', 'No'),
    F('Corporate', 'Score', 'scoreTotal', 'Read-only', 'No'),
])

EMAIL_MSG = 'Enter a valid email address (e.g. name@example.com).'
PHONE_MSG = 'Enter the number with country code, for example +91 98765 43210 or +254 712 345 678.'
NAME_MSG = '{field} may contain letters, spaces, apostrophes, and hyphens only.'
NUM_MSG = '{field} must be a non-negative number.'
WHOLE_MSG = '{field} must be a whole number.'
URL_MSG = 'Website must be a valid URL (e.g. https://example.com).'
PAST_MSG = '{field} must be a past date.'
inv = []
def I(case, form, field, value, msg, when):
    inv.append([case, form, field, value, msg.replace('{field}', field), when])
for f, c in (('Individual', 'LP-005'), ('Corporate', 'LP-035')):
    for v in ['priya.nair@@example.com', 'priya.nair.example.com', 'priya nair@example.com', 'priya.nair@']:
        I(c, f, 'Email', v, EMAIL_MSG, 'On leaving the field')
for f, c in (('Individual', 'LP-006'), ('Corporate', 'LP-036')):
    for v in ['98abc', '9876543210', '+91 12']:
        I(c, f, 'Mobile', v, PHONE_MSG, 'On leaving the field')
    I(c, f, 'WhatsApp', '12345', PHONE_MSG, 'On leaving the field')
for f, c in (('Individual', 'LP-007'), ('Corporate', 'LP-038')):
    I(c, f, 'Marketing Budget', '12ab', NUM_MSG, 'On Create Lead')
    I(c, f, 'Marketing Budget', '-500', NUM_MSG, 'On Create Lead')
    I(c, f, 'Budget', 'ten thousand', NUM_MSG, 'On Create Lead')
    I(c, f, 'Units Interested', 'two', WHOLE_MSG, 'On Create Lead')
    I(c, f, 'Units Interested', '1.5', WHOLE_MSG, 'On Create Lead')
    I(c, f, 'Interaction Count', 'x5', WHOLE_MSG, 'On Create Lead')
I('LP-008', 'Individual', 'First Name', 'Priya2', NAME_MSG, 'On Create Lead')
I('LP-008', 'Individual', 'First Name', 'Priya@Home', NAME_MSG, 'On Create Lead')
I('LP-008', 'Individual', 'Last Name', 'Nair3', NAME_MSG, 'On Create Lead')
I('LP-039', 'Corporate', 'Primary Contact First Name', 'Grace1', NAME_MSG, 'On Create Lead')
I('LP-039', 'Corporate', 'Primary Contact Last Name', 'Wanjiru#', NAME_MSG, 'On Create Lead')
I('LP-009', 'Individual', 'Date of Birth', '{today+30}', 'Date of Birth cannot be a future date.', 'On leaving the field')
for v in ['not a website', 'www', 'coastlineholdings']:
    I('LP-037', 'Corporate', 'Website', v, URL_MSG, 'On Create Lead')
I('LP-040', 'Corporate', 'Date of Incorporation', '{today+30}', PAST_MSG, 'On Create Lead')
SHEETS['Invalid Values'] = (['Case ID', 'Form', 'Field Label', 'Invalid Value', 'Expected Message', 'Checked When'], inv)

SHEETS['Qualification'] = (['Field Label', 'Value'], [
    ['Rating', 'Hot'], ['Buyer Type', 'Investor'], ['Funding', 'Cash'], ['Purpose of Purchase', 'Investment'],
    ['Decision Maker Status', 'Primary Decision Maker'], ['Affordability Assessment', 'Strong'], ['Timeline', '0-3 Months'],
    ['Last Interaction', '{today} 10:30'], ['Interaction Type', 'Site Visit'], ['Interaction Outcome', 'Positive'],
    ['Bedrooms', '3 Bedrooms'], ['Budget', '450000'],
    ['Notes', 'Visited the show apartment, likes the ocean view and confirmed the budget. Ready to move to an opportunity.'],
])

SHEETS['Lead Actions'] = (['Action', 'Field Label', 'Value'], [
    ['Assign', 'Assign To User', 'QA Lead Assignee'],
    ['Disqualify', 'Disqualification Reason', 'Not interested'],
    ['Disqualify', 'Disqualification Remarks', 'Customer said they are no longer planning to buy this year.'],
    ['Convert', 'Confirm Button', 'Convert'],
    ['Close Form', 'Confirm Button', 'Discard'],
])

SHEETS['Messages'] = (['Message Key', 'Expected Text', 'Where it appears'], [
    ['Required Title', 'Required Fields Missing', 'Pop-up when Create Lead is pressed with mandatory fields empty'],
    ['Required Intro', 'Please complete the required fields:', 'Same pop-up, above the list of fields'],
    ['Invalid Title', 'Invalid Entry', 'Pop-up for a field in the wrong format'],
    ['Created Title', 'Lead Created', 'Pop-up after a successful save'],
    ['Created Body', '{name} was created successfully.', 'Same pop-up; {name} = the person (Individual) or the primary contact (Corporate)'],
    ['Duplicate Title', 'Duplicate Lead — Blocked', 'Pop-up when name + mobile + email match an existing lead'],
    ['Duplicate Body', 'Creation is blocked', 'Same pop-up'],
    ['Duplicate Use Case Text', 'This lead has already been created', 'Wording required by use cases HLUC-01 / HLUC-02'],
    ['Mobile Used', 'This mobile number is already used by lead', 'Pop-up when the mobile belongs to another lead'],
    ['Email Used', 'This email is already used by lead', 'Pop-up when the email belongs to another lead'],
    ['Lead Exists Title', 'Lead Already Exists', 'Title of the mobile / email pop-up'],
    ['Qualify Missing Title', 'Qualification Details Missing', 'Pop-up when Qualify Lead is pressed without the checklist'],
    ['Convert Confirm Title', 'Convert lead to opportunity?', 'Confirmation before converting'],
    ['Discard Title', 'Discard changes?', 'Pop-up when Close is pressed on a form with entered data'],
    ['Score Placeholder', 'Calculated on save', 'Placeholder of the read-only Score field'],
])

SHEETS['Tab Rules'] = (['Tab', 'Route', 'Owner Rule', 'Allowed Statuses', 'Page Description Starts With'], [
    ['All Leads', '/leads', 'Any owner', 'New, Assigned, Contacted, Qualified, Nurturing, Converted, Opportunity Created, Lost, Disqualified, Duplicate', 'All Leads'],
    ['My Leads', '/leads/my', 'Signed-in user', 'New, Assigned, Contacted, Qualified, Nurturing, Converted, Opportunity Created, Lost, Disqualified, Duplicate', 'My Leads'],
    ['Unassigned', '/leads/unassigned', 'No owner', 'New, Assigned, Contacted, Qualified, Nurturing, Converted, Opportunity Created, Lost, Disqualified, Duplicate', 'Unassigned'],
    ['To Qualify', '/leads/qualification', 'Signed-in user', 'New, Assigned, Contacted, Nurturing', 'To Qualify'],
    ['Ready to Convert', '/leads/conversion', 'Any owner', 'Qualified', 'Ready to Convert'],
])

# Expected change of each count after one action on a lead the signed-in user created (0 = unchanged).
# Since build 0111-11 the Assigned card = Total − Unassigned (leads with an owner): qualify / disqualify keep the owner.
SHEETS['Count Changes'] = (['Action', 'All Leads', 'My Leads', 'Unassigned', 'To Qualify', 'Ready to Convert',
                            'Total Leads card', 'Assigned card', 'Qualified card', 'Disqualified card'], [
    ['Create', 1, 1, 0, 1, 0, 1, 1, 0, 0],
    ['Assign', 0, -1, 0, -1, 0, 0, 0, 0, 0],
    ['Qualify', 0, 0, 0, -1, 1, 0, 0, 1, 0],
    ['Disqualify', 0, 0, 0, -1, 0, 0, 0, 0, 1],
    ['Convert', 0, 0, 0, 0, -1, 0, 0, -1, 0],
])

README = [
    'Leads page test data — read by tests/leads-page at run time. Nothing in the tests is hard-coded: change a value here and the next run uses it.',
    'Default source: this Excel file. To drive the tests from the CSV files instead, set TEST_DATA_FORMAT=csv (TestData/csv/<sheet name>.csv, same columns).',
    'Keep the Excel and CSV copies in step if you use both (each CSV = one sheet).',
    'Yellow cells are the values to edit. Column headers must not change.',
    'Individual Leads / Corporate Leads: one row per person or company. Each run picks a random row (Settings → Data Selection).',
    'Mobile: # = random digit. Email: {first}, {last}, {unique} are filled in at run time, so every run creates a new, unique lead.',
    'Names may contain letters, spaces, apostrophes and hyphens only (the app rejects digits).',
    'Invalid Values: each row becomes one test (Case ID + row number), e.g. LP-005.1. Add a row to add a test.',
    'Form Fields: Mandatory = Yes drives the "required field" tests.',
    'Count Changes: expected +1 / -1 / 0 for each count after an action; used by the HLUC-03 count-update tests.',
    'Messages: exact texts the app should show. "Duplicate Use Case Text" is the wording the use case asks for.',
    'Emails use example.* domains (reserved, never delivered). Mobiles are random; confirm the QA environment does not send real SMS/WhatsApp.',
]

thin = Side(style='thin', color='BFBFBF')
HDR = PatternFill('solid', fgColor='12465B')
EDIT = PatternFill('solid', fgColor='FFF2CC')
wb = Workbook()
ws = wb.active
ws.title = 'Read Me'
ws['A1'] = 'Leads Page — Test Data'
ws['A1'].font = Font(name='Arial', size=14, bold=True, color='12465B')
for i, t in enumerate(README, start=3):
    c = ws.cell(row=i, column=1, value=f'• {t}')
    c.font = Font(name='Arial', size=10)
    c.alignment = Alignment(wrap_text=True, vertical='top')
ws.column_dimensions['A'].width = 130

for name, (header, rows) in SHEETS.items():
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
    with open(os.path.join(OUT, 'csv', f'{name}.csv'), 'w', newline='', encoding='utf-8-sig') as fh:
        w = csv.writer(fh)
        w.writerow(header)
        w.writerows(rows)
wb['Individual Leads']['E1'].comment = Comment('# = random digit, so each run uses a new mobile number', 'Test data')
wb['Individual Leads']['F1'].comment = Comment('{first}, {last}, {unique} are filled in at run time', 'Test data')
wb.save(os.path.join(OUT, 'Leads_Test_Data.xlsx'))
print('written', OUT, len(inv), 'invalid rows')
