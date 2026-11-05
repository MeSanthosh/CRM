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
    ['Individual Type Label', 'Individual', 'Type column of an Individual lead (an icon since build CAITer8U; this is its tooltip).'],
    ['Corporate Type Label', 'Corporate', 'Type column of a Corporate lead (an icon since build CAITer8U; this is its tooltip).'],
    ['Data Selection', 'random', '"random" = each run picks a different row; a Data ID (e.g. IND-03) = always use that row.'],
    ['Name Selection', 'unique', '"unique" = every lead a test saves uses a name (row) no earlier save used, remembered in .auth/used-lead-names.json; '
                                 'add rows to Individual / Corporate Leads when the tests say all names are used. Forms that are not saved may reuse names.'],
    ['Page Size', '20', 'Leads shown per page of the list.'],
    ['Selection Bar Buttons', 'Assign, Change status, Disqualify, Export selected, Clear selection', 'Buttons of the bar shown while leads are ticked (never pressed except Clear selection).'],
    ['Leads Tabs', 'All Leads, My Leads, Unassigned, To Qualify, Ready to Convert, Duplicates & Merge, Insights', 'Tabs of the Leads page, in order.'],
    ['Duplicates Route', '/leads/duplicates', 'Page opened by the Duplicates & Merge tab.'],
    ['Insights Route', '/leads/sources', 'Page opened by the Insights tab.'],
])

# Address blocks of the create forms (build CAITer8U): first block, its copy button, second block (never saved)
SHEETS['Addresses'] = (['Form', 'First Block', 'Second Block', 'Copy Button', 'Address Line 1', 'Address Line 2', 'City', 'Country', 'Postal Code'], [
    ['Individual', 'Permanent Address', 'Communication Address', 'Use same as Permanent', '14 Palm Grove Road', 'Apartment 3B', 'Mombasa', 'Kenya', '80100'],
    ['Corporate', 'Business Address', 'Communication Address', 'Use same as Business', 'Plot 22 Harbour Business Park', 'Block C', 'Nairobi', 'Kenya', '00100'],
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
    # more people, so every lead a run saves gets a name no earlier run used (Settings → Name Selection)
    ['IND-11', 'Mr', 'Arjun', 'Krishnan', '+91 98### #####', '{first}.{last}.{unique}@example.in', 'Referrals', 'Male', 'India', 'India', 'Chennai', 'Investor', '400000', '3-6 Months', 'Friend of an owner; wants a unit to rent out.'],
    ['IND-12', 'Ms', 'Kavya', 'Raghavan', '+91 97### #####', '{first}.{last}.{unique}@example.in', 'Property Portals', 'Female', 'India', 'India', 'Hyderabad', 'End User', '290000', '0-3 Months', 'Found the listing online; asked for floor plans.'],
    ['IND-13', 'Mr', 'Vikram', 'Bhatia', '+91 99### #####', '{first}.{last}.{unique}@example.in', 'Direct Sales', 'Male', 'India', 'India', 'Delhi', 'Investor', '520000', '6-12 Months', 'Visited the sales office; compares payment plans.'],
    ['IND-14', 'Mrs', 'Meera', 'Pillai', '+91 98### #####', '{first}.{last}.{unique}@example.in', 'Digital Marketing', 'Female', 'India', 'India', 'Pune', 'Holiday Home Buyer', '360000', '3-6 Months', 'Clicked the beach villa advert.'],
    ['IND-15', 'Mr', 'Rohan', 'Desai', '+91 97### #####', '{first}.{last}.{unique}@example.in', 'Public Relations', 'Male', 'India', 'India', 'Ahmedabad', 'End User', '310000', '12+ Months', 'Read the magazine article; early research.'],
    ['IND-16', 'Ms', 'Lakshmi', 'Iyer', '+91 99### #####', '{first}.{last}.{unique}@example.in', 'Broker Channels', 'Female', 'India', 'India', 'Coimbatore', 'Retirement Buyer', '450000', '6-12 Months', 'Broker referral; wants a quiet ground-floor unit.'],
    ['IND-17', 'Mr', 'Brian', 'Odhiambo', '+254 7## ### ###', '{first}.{last}.{unique}@example.org', 'Events & Exhibitions', 'Male', 'Kenya', 'Kenya', 'Kisumu', 'Investor', '380000', '0-3 Months', 'Met at the expo; ready to view this month.'],
    ['IND-18', 'Ms', 'Wairimu', 'Gathoni', '+254 7## ### ###', '{first}.{last}.{unique}@example.org', 'Referrals', 'Female', 'Kenya', 'Kenya', 'Nakuru', 'End User', '270000', '3-6 Months', 'Referred by a colleague; first home.'],
    ['IND-19', 'Mr', 'Collins', 'Barasa', '+254 7## ### ###', '{first}.{last}.{unique}@example.net', 'Direct Sales', 'Male', 'Kenya', 'Kenya', 'Eldoret', 'Investor', '610000', 'Immediate', 'Walk-in; wants two units for rental income.'],
    ['IND-20', 'Mrs', 'Achieng', 'Owino', '+254 7## ### ###', '{first}.{last}.{unique}@example.com', 'Hospitality Channels', 'Female', 'Kenya', 'Kenya', 'Malindi', 'Holiday Home Buyer', '330000', '6-12 Months', 'Hotel guest; asked about holiday letting.'],
    ['IND-21', 'Mr', 'Kevin', 'Mutiso', '+254 7## ### ###', '{first}.{last}.{unique}@example.com', 'Digital Marketing', 'Male', 'Kenya', 'Kenya', 'Machakos', 'End User', '300000', '3-6 Months', 'Answered the social media campaign.'],
    ['IND-22', 'Dr', 'Halima', 'Abdi', '+254 7## ### ###', '{first}.{last}.{unique}@example.org', 'Strategic Partners', 'Female', 'Kenya', 'Kenya', 'Garissa', 'Investor', '700000', '0-3 Months', 'Partner bank client; cash buyer.'],
    ['IND-23', 'Mr', 'Edward', 'Ashworth', '+44 7### ######', '{first}.{last}.{unique}@example.co.uk', 'Broker Channels', 'Male', 'United Kingdom', 'United Kingdom', 'Manchester', 'Retirement Buyer', '820000', '12+ Months', 'Plans to move to the coast after retiring.'],
    ['IND-24', 'Ms', 'Charlotte', 'Pembroke', '+44 7### ######', '{first}.{last}.{unique}@example.co.uk', 'Property Portals', 'Female', 'United Kingdom', 'United Kingdom', 'Bristol', 'Holiday Home Buyer', '560000', '6-12 Months', 'Saved three listings on the portal.'],
    ['IND-25', 'Mr', 'Henry', 'Caldwell', '+44 7### ######', '{first}.{last}.{unique}@example.co.uk', 'Referrals', 'Male', 'United Kingdom', 'United Kingdom', 'Leeds', 'Investor', '640000', '3-6 Months', 'Referred by his accountant.'],
    ['IND-26', 'Mrs', 'Eleanor', 'Hartley', '+44 7### ######', '{first}.{last}.{unique}@example.co.uk', 'Public Relations', 'Female', 'United Kingdom', 'United Kingdom', 'Oxford', 'End User', '430000', '0-3 Months', 'Saw the TV feature; wants a call back.'],
    ['IND-27', 'Mr', 'Lucien', 'Moreau', '+33 6 ## ## ## ##', '{first}.{last}.{unique}@example.fr', 'Hospitality Channels', 'Male', 'France', 'France', 'Marseille', 'Holiday Home Buyer', '590000', '6-12 Months', 'Resort guest; likes the marina view.'],
    ['IND-28', 'Ms', 'Camille', 'Rousseau', '+33 6 ## ## ## ##', '{first}.{last}.{unique}@example.fr', 'Digital Marketing', 'Female', 'France', 'France', 'Bordeaux', 'End User', '340000', '3-6 Months', 'Downloaded the brochure.'],
    ['IND-29', 'Mr', 'Antoine', 'Lefebvre', '+33 6 ## ## ## ##', '{first}.{last}.{unique}@example.fr', 'Events & Exhibitions', 'Male', 'France', 'France', 'Nice', 'Investor', '780000', 'Immediate', 'Met at the Paris property fair.'],
    ['IND-30', 'Mrs', 'Margaux', 'Girard', '+33 6 ## ## ## ##', '{first}.{last}.{unique}@example.fr', 'Referrals', 'Female', 'France', 'France', 'Toulouse', 'Retirement Buyer', '510000', '12+ Months', 'Sister owns a villa in the project.'],
    ['IND-31', 'Mr', 'Yousef', 'Al Hashimi', '+971 50 ### ####', '{first}.{last}.{unique}@example.ae', 'Strategic Partners', 'Male', 'United Arab Emirates', 'United Arab Emirates', 'Abu Dhabi', 'Investor', '950000', '0-3 Months', 'Partner introduction; wants a penthouse.'],
    ['IND-32', 'Ms', 'Mariam', 'Al Suwaidi', '+971 50 ### ####', '{first}.{last}.{unique}@example.ae', 'Property Portals', 'Female', 'United Arab Emirates', 'United Arab Emirates', 'Sharjah', 'End User', '420000', '3-6 Months', 'Enquired through the portal chat.'],
    ['IND-33', 'Mr', 'Hamdan', 'Al Ketbi', '+971 50 ### ####', '{first}.{last}.{unique}@example.ae', 'Direct Sales', 'Male', 'United Arab Emirates', 'United Arab Emirates', 'Dubai', 'Investor', '880000', 'Immediate', 'Visited the Dubai roadshow stand.'],
    ['IND-34', 'Mrs', 'Noora', 'Al Falasi', '+971 50 ### ####', '{first}.{last}.{unique}@example.ae', 'Events & Exhibitions', 'Female', 'United Arab Emirates', 'United Arab Emirates', 'Ajman', 'Holiday Home Buyer', '470000', '6-12 Months', 'Collected a brochure at the exhibition.'],
    ['IND-35', 'Mr', 'Felix', 'Hoffmann', '+49 151 ########', '{first}.{last}.{unique}@example.de', 'Broker Channels', 'Male', 'Germany', 'Germany', 'Hamburg', 'Investor', '690000', '3-6 Months', 'Broker client; compares yields.'],
    ['IND-36', 'Ms', 'Lena', 'Schreiber', '+49 151 ########', '{first}.{last}.{unique}@example.de', 'Digital Marketing', 'Female', 'Germany', 'Germany', 'Berlin', 'End User', '350000', '0-3 Months', 'Signed up through the website form.'],
    ['IND-37', 'Mr', 'Jonas', 'Wagner', '+49 151 ########', '{first}.{last}.{unique}@example.de', 'Referrals', 'Male', 'Germany', 'Germany', 'Frankfurt', 'Retirement Buyer', '730000', '12+ Months', 'Referred by a neighbour who bought last year.'],
    ['IND-38', 'Mrs', 'Katrin', 'Neumann', '+49 151 ########', '{first}.{last}.{unique}@example.de', 'Hospitality Channels', 'Female', 'Germany', 'Germany', 'Cologne', 'Holiday Home Buyer', '480000', '6-12 Months', 'Stayed at the resort twice.'],
    ['IND-39', 'Dr', 'Rajesh', 'Venkatesan', '+91 98### #####', '{first}.{last}.{unique}@example.in', 'Strategic Partners', 'Male', 'India', 'India', 'Madurai', 'Investor', '560000', '3-6 Months', 'Introduced by the partner bank.'],
    ['IND-40', 'Ms', 'Njeri', 'Kariithi', '+254 7## ### ###', '{first}.{last}.{unique}@example.org', 'Public Relations', 'Female', 'Kenya', 'Kenya', 'Thika', 'End User', '260000', '0-3 Months', 'Heard the radio interview.'],
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
    ['CORP-08', 'Ltd', 'Tidewater Estates', 'Company', 'Real Estate', 'Director', 'Anne', 'Muthoni', '+254 7## ### ###', '{first}.{last}.{unique}@example.com', 'https://www.tidewaterestates.example.com', 'Direct Sales', 'Staff housing near the new office.'],
    ['CORP-09', 'LLC', 'Marigold Family Holdings', 'Family Office', 'Investment', 'Managing Partner', 'Ravi', 'Chandran', '+91 98### #####', '{first}.{last}.{unique}@example.in', 'https://www.marigoldholdings.example.in', 'Referrals', 'Holiday homes for the family trust.'],
    ['CORP-10', 'PLC', 'Kingsbridge Asset Partners', 'Investment Company', 'Banking', 'Chief Investment Officer', 'George', 'Fairfax', '+44 7### ######', '{first}.{last}.{unique}@example.co.uk', 'https://www.kingsbridgeasset.example.co.uk', 'Broker Channels', 'Income-producing residential blocks.'],
    ['CORP-11', 'FZE', 'Falcon Crest Investments', 'Investment Company', 'Investment', 'Head of Acquisitions', 'Saeed', 'Al Nuaimi', '+971 50 ### ####', '{first}.{last}.{unique}@example.ae', 'https://www.falconcrest.example.ae', 'Strategic Partners', 'Off-plan villas for resale.'],
    ['CORP-12', 'Inc', 'Evergreen Retirement Fund', 'Pension Fund', 'Pension', 'Portfolio Manager', 'Laura', 'Whitman', '+1 415 ### ####', '{first}.{last}.{unique}@example.com', 'https://www.evergreenretirement.example.com', 'Referrals', 'Long-hold coastal apartments.'],
    ['CORP-13', 'Ltd', 'Acacia Resort Collection', 'Company', 'Hospitality', 'Operations Director', 'Paul', 'Kiprotich', '+254 7## ### ###', '{first}.{last}.{unique}@example.net', 'https://www.acaciaresorts.example.net', 'Hospitality Channels', 'Branded residences next to the resort.'],
    ['CORP-14', 'Corp', 'Meridian Coast REIT', 'REIT', 'Real Estate', 'Asset Manager', 'Wei', 'Lin', '+65 9### ####', '{first}.{last}.{unique}@example.sg', 'https://www.meridiancoast.example.sg', 'Digital Marketing', 'Stabilised rental assets in East Africa.'],
    ['CORP-15', 'Ltd', 'Riverstone Developments', 'Company', 'Real Estate', 'Director', 'Hannah', 'Kiplagat', '+254 7## ### ###', '{first}.{last}.{unique}@example.org', 'https://www.riverstonedev.example.org', 'Events & Exhibitions', 'Joint purchase of a full floor.'],
    ['CORP-16', 'LLC', 'Seabreeze Family Office', 'Family Office', 'Investment', 'Managing Partner', 'Nikhil', 'Kapoor', '+91 97### #####', '{first}.{last}.{unique}@example.in', 'https://www.seabreezefo.example.in', 'Property Portals', 'Two penthouses for family use.'],
    ['CORP-17', 'PLC', 'Albion Property Trust', 'Investment Company', 'Banking', 'Chief Investment Officer', 'Fiona', 'Marsh', '+44 7### ######', '{first}.{last}.{unique}@example.co.uk', 'https://www.albiontrust.example.co.uk', 'Public Relations', 'Yield-led investment in serviced units.'],
    ['CORP-18', 'FZE', 'Oasis Gate Capital', 'Investment Company', 'Investment', 'Head of Acquisitions', 'Rashed', 'Al Mazrouei', '+971 50 ### ####', '{first}.{last}.{unique}@example.ae', 'https://www.oasisgate.example.ae', 'Direct Sales', 'Bulk purchase with a payment plan.'],
    ['CORP-19', 'Inc', 'Pinecrest Pension Partners', 'Pension Fund', 'Pension', 'Portfolio Manager', 'Mark', 'Ellison', '+1 415 ### ####', '{first}.{last}.{unique}@example.com', 'https://www.pinecrestpension.example.com', 'Broker Channels', 'Diversify the property allocation.'],
    ['CORP-20', 'Corp', 'Harbour Lights REIT', 'REIT', 'Real Estate', 'Asset Manager', 'Mei', 'Tan', '+65 9### ####', '{first}.{last}.{unique}@example.sg', 'https://www.harbourlights.example.sg', 'Hospitality Channels', 'Resort apartments with a rental pool.'],
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
# Address blocks (build CAITer8U): both blocks use the same labels on screen, so the sheet numbers them (block 1 / 2)
for _form in ('Individual', 'Corporate'):
    for _b in (1, 2):
        for _label, _name, _type in (('Address Line 1', 'addressLine1', 'Text'), ('Address Line 2', 'addressLine2', 'Text'), ('City', 'city', 'Text'),
                                     ('Country', 'countryCode', 'Dropdown'), ('Postal Code', 'postalCode', 'Text')):
            SHEETS['Form Fields'][1].append(F(_form, f'Address {_b} {_label}', f'addresses.{_b - 1}.{_name}', _type, 'No'))

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
    'Individual Leads / Corporate Leads: one row per person or company. A form that is saved uses a row (name) no earlier save used (Settings → Name Selection); forms that are only filled and closed pick a random row.',
    'Addresses: the two address blocks of each create form and the values typed to check the "Use same as …" button (never saved).',
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
