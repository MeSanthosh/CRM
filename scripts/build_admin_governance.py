"""Builds the Admin & Governance suite files (IDs ADM-):
  TestData/Admin_Governance_Test_Data.xlsx + TestData/csv/Admin_Governance/*.csv  (test data, same content)
  Testcase/Admin_Governance_Test_Cases.xlsx                                     (human-readable test cases)
Run from the repo root:  python scripts/build_admin_governance.py
Figures and rule values are read from the page at run time; nothing about QA's current settings is fixed here.
"""
from sales_modules_common import st, write_testdata, write_cases

TD = 'TestData/Admin_Governance_Test_Data.xlsx'
S = {}
S['Settings'] = (['Setting', 'Value', 'What it means'], [
    ['Currencies Route', '/currencies', 'Currency Master'],
    ['Reference Route', '/reference-data', 'Reference Data Management'],
    ['Preferences Route', '/preferences', 'Organization preferences'],
    ['Rules Route', '/configuration', 'Business Rules Configuration'],
    ['Currency Search', 'Search code, name, symbol', 'Search box of the Currency Register'],
    ['Rate Search', 'Search pair (e.g. KES to USD, EUR)', 'Search box of the Exchange Rate Register'],
    ['Reference Search', 'Search category, group, code, name', 'Search box of the Reference Register'],
    ['Active Only', 'Active only', 'Register check box: active records only'],
    ['Active Rates Only', 'Active Rates only', 'Exchange Rate Register check box'],
    ['Currencies Tab', 'Currencies', 'Currency tab (shows its count)'],
    ['Policy Tab', 'Policy', 'Currency tab'],
    ['Rates Tab', 'Exchange Rates', 'Currency tab (shows its count)'],
    ['Edit Button', 'Edit', 'Row button'],
    ['Deactivate Button', 'Deactivate', 'Row button of the Reference Register'],
    ['Cancel Button', 'Cancel', 'Leaves a form without saving'],
    ['Create Currency Button', 'Create Currency', 'New Currency form: pressed only on the empty form'],
    ['Create Value Button', 'Create Reference Value', 'Reference forms: save button'],
    ['Update Value Button', 'Update Reference Value', 'Reference edit form: save button'],
    ['Inactive Status', 'INACTIVE', 'Status of a deactivated reference value'],
    ['Active Status', 'ACTIVE', 'Status of an active record'],
    ['Base Word', 'Base', 'Currency Register policy role of the base currency'],
    ['Payment Word', 'Payment', 'Currency Register policy role of an accepted payment currency'],
    ['Rate Formula', 'Formula: 1 [From Currency] = [Rate]', 'Line in Add Exchange Rate'],
    ['Never Click', 'Run Incremental ETL, Run Full ETL (Rebuild Snapshots), 🔄 Get Latest Exchange Rates, Save Policy Configuration, Save Security Policies, Save SMTP settings, Save Email Settings, Save WhatsApp Settings, Verify SMTP Handshake', 'Buttons the tests check are there but never press'],
    ['Version Word', 'Version', 'Rule line "Version N · Draft: PUBLISHED · Published <date>"'],
    ['Save Draft Button', 'Save Draft', 'Rule: saves a draft'],
    ['Publish Button', 'Publish', 'Rule: makes it live'],
    ['Draft Status', 'DRAFT', 'Version line after Save Draft'],
    ['Dashboard Route', '/dashboards', 'Page that compares sales with the Sales Velocity Targets'],
    ['Hold Project', 'Palm Exotica', 'Unit Hold tests: project chosen on the Stack Plan (holds are placed and released at once; the test project has only one unit)'],
    ['Dashboard Summary Api', '/dashboard/summary', 'Request the dashboard reads its targets from'],
    ['Implied Price Caption', 'Implied Avg Price / Unit', 'Sales Velocity Targets: revenue ÷ units of each panel'],
    ['Sales Target Units Step', '1', 'Units added to a units target by the tests (put back afterwards)'],
    ['Sales Target Revenue Step', '100000', 'USD added to a revenue target by the tests (put back afterwards)'],
    ['Published Status', 'PUBLISHED', 'Version line after Publish'],
    ['Unpublished Text', 'Unpublished changes', 'Version line while a draft is waiting'],
    ['Scoring Total', '100', 'Enabled Lead Scoring criteria must total this'],
    ['Band Range', '0-100', 'Lead Classification Bands must cover this without gaps'],
    ['Page Size Change', '50 rows', 'Rows per page used by ADM-037 (the original value is put back)'],
    ['Save Defaults Button', 'Save application defaults', 'Preferences: General → Application defaults'],
    ['Email Recipient Env', 'TEST_EMAIL_TO', '.env variable with the test email address (kept out of the repo)'],
    ['WhatsApp Recipient Env', 'TEST_WHATSAPP_TO', '.env variable with the test WhatsApp number, with + and country code'],
    ['Email Send Button', 'Send Test Email Now', 'Communication Channels: sends a real test email'],
    ['WhatsApp Send Button', 'Send Test WhatsApp Now', 'Communication Channels: sends a real WhatsApp'],
    ['Email Recipient Label', 'Recipient Email', 'Field of the test email'],
    ['WhatsApp Recipient Label', 'Recipient WhatsApp Number', 'Field of the test WhatsApp'],
    ['WhatsApp Preset', 'Meta Sandbox (hello_world · en_US)', 'Template preset of the test WhatsApp'],
    ['Setup Needed', 'Setup Needed', 'Badge of a channel whose provider is not connected'],
    ['Save Wait Seconds', '60', 'Longest wait for a save or a test send'],
    ['Inventory Route', '/inventory', 'Inventory page (Unit Hold Rules are compared with its Hold form)'],
    ['Availability Tab', 'Availability Summary', 'Inventory tab with the Stack Plan'],
    ['Stack Plan View', '🏢 Stack Plan', 'View with the unit tiles'],
    ['Hold Button Prefix', 'Hold for', 'Unit window button "Hold for 48h"'],
    ['Hold Submit Button', 'Hold Unit', 'Hold form: never pressed by this suite'],
    ['Broken Values', 'NaN, undefined, null, Infinity, [object Object]', 'Texts that must never appear'],
])
S['Currency Cards'] = (['Card', 'Equals'], [
    ['Currencies', 'Total of the Currency Register'],
    ['Active', 'Total of the Currency Register with Active only'],
    ['Payment', 'Currencies with the Payment role in the register'],
    ['Contract', 'Currency code of the Base role (text)'],
])
S['Reference Cards'] = (['Card', 'Equals'], [
    ['Values', 'Total of the Reference Register'],
    ['Categories', 'Options of the Category filter'],
    ['Families', 'Options of the Group filter'],
    ['Inactive', 'Total minus the total with Active only'],
])
S['Form Fields'] = (['Form', 'Field Label', 'Field Name', 'Field Type', 'Mandatory'], [
    ['Currency', 'Currency Code', 'currencyCode', 'Text', 'Yes'],
    ['Currency', 'Currency Name', 'currencyName', 'Text', 'Yes'],
    ['Currency', 'Symbol', 'symbol', 'Text', 'No'],
    ['Currency', 'Decimal Places', 'decimalPlaces', 'Number', 'No'],
    ['Currency', 'Rate Source', 'exchangeRateSource', 'Text', 'No'],
    ['Currency', 'Rate Frequency', 'exchangeRateFrequency', 'Text', 'No'],
    ['Currency', 'Sort Order', 'sortOrder', 'Number', 'No'],
    ['Currency', 'Status', 'status', 'Dropdown', 'No'],
    ['Currency', 'Active in System', 'isActive', 'Checkbox', 'No'],
    ['Currency', 'Remarks', 'remarks', 'Text', 'No'],
    ['Rate', 'From Currency', 'fromCurrencyCode', 'Dropdown', 'Yes'],
    ['Rate', 'To Currency', 'toCurrencyCode', 'Dropdown', 'Yes'],
    ['Rate', 'Exchange Rate', 'rate', 'Number', 'Yes'],
    ['Rate', 'Source', 'source', 'Text', 'No'],
    ['Rate', 'Source Reference', 'sourceReference', 'Text', 'No'],
    ['Rate', 'Remarks', 'remarks', 'Text', 'No'],
    ['Reference', 'Category', 'referenceCategory', 'Text or Dropdown', 'Yes'],
    ['Reference', 'Group Code', 'level1Code', 'Text or Dropdown', 'Yes'],
    ['Reference', 'Group Name', 'level1Name', 'Text', 'Yes'],
    ['Reference', 'Value Code', 'level2Code', 'Text', 'Yes'],
    ['Reference', 'Value Name', 'level2Name', 'Text', 'Yes'],
    ['Reference', 'Sort Order', 'sortOrder', 'Text', 'No'],
    ['Reference', 'Status', 'status', 'Dropdown', 'No'],
    ['Reference', 'Available for application use', 'isActive', 'Checkbox', 'No'],
    ['Reference', 'Description', 'description', 'Text', 'No'],
    ['Reference', 'Remarks', 'remarks', 'Text', 'No'],
])
S['Reference Forms'] = (['Case ID', 'Button', 'Category Control', 'Group Control'], [
    ['ADM-015', 'New Category', 'input', 'input'],
    ['ADM-015', 'New Group', 'select', 'input'],
    ['ADM-015', 'New Reference Value', 'select', 'select'],
])
S['Reference Records'] = (['Step', 'Button', 'Category', 'Group Code', 'Group Name', 'Value Code', 'Value Name', 'Edited Value Name', 'Description'], [
    ['Category', 'New Category', 'ZZ_AUTOMATED_TEST', 'ZZ_GROUP_ONE', 'Automated Test Group One', 'ZZ_VALUE_ONE', 'Automated Test Value One', 'Automated Test Value One Edited', 'Kept by the automated tests, always left inactive'],
    ['Group', 'New Group', 'ZZ_AUTOMATED_TEST', 'ZZ_GROUP_TWO', 'Automated Test Group Two', 'ZZ_VALUE_TWO', 'Automated Test Value Two', '', 'Kept by the automated tests, always left inactive'],
    ['Value', 'New Reference Value', 'ZZ_AUTOMATED_TEST', 'ZZ_GROUP_ONE', 'Automated Test Group One', 'ZZ_VALUE_THREE', 'Automated Test Value Three', '', 'Kept by the automated tests, always left inactive'],
])
S['Preference Sections'] = (['Tab', 'Section', 'Heading', 'Save Button'], [
    ['General', 'Application defaults', 'Application defaults', 'Save application defaults'],
    ['General', 'Time & locale', 'Time & locale', 'Save time & locale'],
    ['Notifications', 'Email (SMTP)', 'Email (SMTP)', 'Save SMTP settings'],
    ['Notifications', 'Notification channel', 'Notification Channels', 'Save Notification Channels'],
    ['Security', '', 'Security & Authentication Policies', 'Save Security Policies'],
    ['Operations & ETL', '', 'Analytical Data Movement (Operations & ETL)', ''],
])
S['Preference Options'] = (['Section', 'Position', 'Label', 'Options'], [
    ['Application defaults', '0', 'Default landing page', 'My Smart Workspace, Dashboard'],
    ['Application defaults', '1', 'Default theme', 'Light (Standard), Dark (Coming soon), System (Coming soon)'],
    ['Application defaults', '2', 'Rows per page', '10 rows, 20 rows, 25 rows (Standard), 50 rows, 100 rows'],
    ['Time & locale', '1', 'Date format', 'DD MMM YYYY (e.g. 17 Oct 2026), DD/MM/YYYY (e.g. 17/10/2026), MM/DD/YYYY (e.g. 10/17/2026), YYYY-MM-DD (e.g. 2026-10-17)'],
    ['Time & locale', '2', 'Timezone', 'Africa/Nairobi (EAT; UTC+3), Asia/Kolkata (IST; UTC+5:30), Asia/Dubai (GST; UTC+4), UTC'],
    ['Time & locale', '3', 'Number format', '1;234;567.89 (Standard), 1.234.567;89 (European)'],
])
S['Rule Engines'] = (['Code', 'Name', 'Saved By Tests'], [
    ['LEAD_DUPLICATE', 'Lead Duplicate Rules', 'Yes'],
    ['LEAD_SCORING', 'Lead Scoring Matrix', 'Yes'],
    ['LEAD_QUALIFICATION', 'Lead Qualification Threshold', 'Yes'],
    ['LEAD_CLASSIFICATION', 'Lead Classification Bands', 'Yes'],
    ['DATE_OF_BIRTH', 'Date of Birth Rules', 'Yes'],
    ['CUSTOMER_CREATION', 'When Lead Becomes Customer', 'No'],
    ['UNIT_HOLD', 'Unit Hold Rules', 'Yes'],
    ['DISCOUNT_APPROVAL', 'Discount Approval Tiers', 'Yes'],
    ['COMMUNICATION_CHANNELS', 'Communication Channels', 'No'],
    ['LOGIN_OTP', 'Login & OTP', 'No'],
    ['PII_PROTECTION', 'Personal Data Protection', 'No'],
    ['UNIT_PRICING_RULES', 'Unit Pricing Matrix Rules', 'No'],
    ['SALES_TARGETS', 'Sales Velocity Targets', 'Yes'],
])
S['Rule Saves'] = (['Case ID', 'Engine', 'Fields', 'Changes', 'What it changes'], [
    ['ADM-055', 'LEAD_DUPLICATE', 'label:Match Mode', 'to:Minimum matched fields', 'match mode'],
    ['ADM-055', 'LEAD_SCORING', 'number:0 | number:1', '-1 | +1', 'two scores, total stays 100'],
    ['ADM-055', 'LEAD_QUALIFICATION', 'label:Warning message', '&(automated test)', 'warning text'],
    ['ADM-055', 'LEAD_CLASSIFICATION', 'text:0', '& Test', 'a band label'],
    ['ADM-055', 'DATE_OF_BIRTH', 'label:Maximum age', '-1', 'maximum age'],
    ['ADM-055', 'UNIT_HOLD', 'label:Active holds per sales rep', '+1', 'holds per rep'],
    ['ADM-055', 'DISCOUNT_APPROVAL', 'label:Tier name', '& Test', 'a tier name'],
    ['ADM-055', 'SALES_TARGETS', 'label:Monthly Units Forecast', '+1', 'units forecast'],
])
S['Rule Invalid Values'] = (['Case ID', 'Engine', 'Field', 'Change', 'Expected Message Contains', 'What it checks'], [
    ['ADM-054', 'LEAD_SCORING', 'number:0', '+1', '', 'enabled scores total 101'],
    ['ADM-054', 'LEAD_CLASSIFICATION', 'number:0', '+1', '', 'a gap between two bands'],
    ['ADM-054', 'LEAD_QUALIFICATION', 'label:Auto-qualify minimum score', 'to:150', '', 'score above 100'],
    ['ADM-054', 'DATE_OF_BIRTH', 'label:Minimum age', 'to:130', '', 'minimum above maximum age'],
    ['ADM-054', 'DATE_OF_BIRTH', 'label:Minimum age', 'to:abc', '', 'letters in an age'],
    ['ADM-054', 'UNIT_HOLD', 'label:Default hold length', 'to:500', '', 'default above the maximum hold'],
    ['ADM-054', 'DISCOUNT_APPROVAL', 'label:Up to (%)', 'to:99', '', 'the first tier above the next tier'],
])

# ── Integration: a rule is published, the page that uses it is tested, the original is published again ─────────────
S['Settings'][1].extend([
    ['Qualify Warning Title', 'Score Below Threshold', 'Pop-up when a lead is qualified below the minimum score'],
    ['Qualify Anyway Button', 'Qualify Anyway', 'Button of that pop-up'],
    ['Qualify Cancel Button', 'Cancel', 'Button of that pop-up'],
    ['Warning Text', 'Automated integration warning text', 'Warning message published by the integration tests'],
    ['Band Label Text', 'Zeta Band', 'Band label published by the integration test'],
    ['Empty Rating', '—', 'Current rating of a lead with no rating yet'],
])
_MODES = [('All enabled fields must match', ''), ('Any enabled field may match', ''), ('Minimum matched fields', '1'), ('Minimum matched fields', '2')]
_SW = [('On', 'On'), ('Off', 'On'), ('On', 'Off'), ('Off', 'Off')]
_dup = [[m, n, a, b] for m, n in _MODES for a, b in _SW] + [['Minimum matched fields', '3', 'On', 'On'], ['Minimum matched fields', '4', 'On', 'On']]
S['Duplicate Rules'] = (['Match Mode', 'Minimum Fields', 'First Name Check', 'Last Name Check'], _dup)
S['Duplicate Variants'] = (['Variant', 'Same As Existing Lead'], [
    ['same first name only', 'First Name'],
    ['same last name only', 'Last Name'],
    ['same first and last name', 'First Name, Last Name'],
    ['same mobile only', 'Mobile'],
    ['same email only', 'Email'],
    ['nothing the same', ''],
])
S['Scoring Criteria'] = (['Criterion'], [[c] for c in ['Budget Match', 'Buyer Readiness', 'Site Visit Completed', 'Funding Confirmed', 'Communication Response', 'Investor Profile', 'Referral Source']])
S['Qualification Cases'] = (['Case', 'Minimum Score', 'Allow Manual', 'Expected'], [
    ['score far below the minimum, manual allowed', 'top', 'On', 'warn'],
    ['score far below the minimum, manual not allowed', 'top', 'Off', 'refuse'],
    ['no minimum, manual allowed', 'zero', 'On', 'qualify'],
    ['no minimum, manual not allowed', 'zero', 'Off', 'qualify'],
    ['score equal to the minimum, manual allowed', 'exact', 'On', 'qualify'],
    ['score equal to the minimum, manual not allowed', 'exact', 'Off', 'qualify'],
    ['score one below the minimum, manual allowed', 'above', 'On', 'warn'],
    ['score one below the minimum, manual not allowed', 'above', 'Off', 'refuse'],
])
S['Band Cases'] = (['Band', 'Suggested Rating', 'Auto Apply'], [[b, r, a] for b, r in [('HOT', 'Hot'), ('WARM', 'Warm'), ('COLD', 'Cold'), ('NURTURE', 'Nurture')] for a in ('Off', 'On')])
S['DOB Rules'] = (['Minimum Age', 'Maximum Age'], [['18', '120'], ['21', '100'], ['0', '120'], ['30', '60']])
S['DOB Values'] = (['Value', 'Date Kind', 'Accepted'], [
    ['exactly the minimum age', 'min', 'Yes'],
    ['one day under the minimum age', 'under', 'No'],
    ['exactly the maximum age', 'max', 'Yes'],
    ['one day over the maximum age', 'over', 'No'],
    ['tomorrow', 'future', 'No'],
])
S['Sales Target Fields'] = (['Field Label', 'Kind', 'Api Field'], [
    ['Monthly Units Budget', 'units', 'monthlyUnitsBudget'],
    ['Monthly Revenue Budget (USD)', 'revenue', 'monthlyRevenueBudgetUsd'],
    ['Monthly Units Forecast', 'units', 'monthlyUnitsForecast'],
    ['Monthly Revenue Forecast (USD)', 'revenue', 'monthlyRevenueForecastUsd'],
])
S['Sales Target Headings'] = (['Heading'], [['Monthly Budget (Target)'], ['Monthly Forecast (Stretch)']])
S['Sales Target Invalid Values'] = (['Field Label', 'Kind', 'Typed', 'Expected'], [
    ['Monthly Units Budget', 'units', '-5', 'A negative number of units is not kept.'],
    ['Monthly Units Budget', 'units', '2.5', 'Units stay a whole number.'],
    ['Monthly Units Forecast', 'units', 'abc', 'Letters are not kept.'],
    ['Monthly Revenue Budget (USD)', 'revenue', '-1000', 'A negative amount is not kept.'],
    ['Monthly Revenue Forecast (USD)', 'revenue', 'abc', 'Letters are not kept.'],
])
S['Sales Target Dashboard Lines'] = (['Text'], [[x] for x in []])
PROSPECT, CUSTOMER = 'Prospect (pre-customer)', 'Customer'
S['Customer Stage Triggers'] = (['Trigger', 'After Conversion', 'After Reservation Approved', 'After Proposal Accepted'], [
    ['Contract / SPA signed', PROSPECT, PROSPECT, ''],
    ['Reservation of Unit completed', PROSPECT, CUSTOMER, ''],
    ['Proposal accepted (recommended — SPA equivalent)', PROSPECT, PROSPECT, CUSTOMER],
])
S['Discount Cases'] = (['Free Limit', 'Tier 1 Name', 'Tier 1 Up To', 'Discount %', 'Expected Tier'], [
    ['2', 'Sales Manager', '5', '2', ''],
    ['2', 'Sales Manager', '5', '3', 'Sales Manager'],
    ['2', 'Sales Manager', '5', '5', 'Sales Manager'],
    ['2', 'Sales Manager', '5', '6', 'Sales Director'],
    ['2', 'Sales Manager', '5', '10', 'Sales Director'],
    ['2', 'Sales Manager', '5', '11', 'CEO'],
    ['4', 'Sales Manager', '5', '3', ''],
    ['4', 'Sales Manager', '5', '5', 'Sales Manager'],
    ['2', 'Sales Manager', '7', '6', 'Sales Manager'],
    ['2', 'Team Lead', '5', '3', 'Team Lead'],
])
S['Hold Defaults'] = (['Default Hours', 'Preselected Option'], [['4', '4 hours'], ['12', '12 hours'], ['24', '1 day (24h)'], ['72', '3 days (72h)'], ['96', '4 days (96h)']])
S['Hold Maximums'] = (['Maximum Hours', 'Default Hours', 'Longest Option Hours'], [['24', '24', '24'], ['36', '24', '24'], ['72', '48', '72'], ['96', '48', '96']])
S['Hold Limits'] = (['Limit'], [['1'], ['2']])
S['Hold Length'] = (['Default Hours', 'Tolerance Minutes'], [['12', '10']])
S['Hold Extend'] = (['Managers Can Extend', 'Extend Offered'], [['On', 'Yes'], ['Off', 'No']])
S['Customer Triggers'] = (['Trigger', 'Status After Conversion'], [
    ['Lead converted to opportunity (legacy)', 'Customer'],
    ['Reservation of Unit completed', 'Prospect (pre-customer)'],
    ['Proposal accepted (recommended — SPA equivalent)', 'Prospect (pre-customer)'],
    ['Contract / SPA signed', 'Prospect (pre-customer)'],
])
S['Pricing Base Rate'] = (['Product', 'Change', 'Simulator Caption'], [['APT-3BR-A', '+1', 'Carpet Area × Base Rate:']])
S['Pricing Changes'] = (['Tab', 'Rule', 'Field', 'Change', 'Caption', 'Check', 'Simulator Field', 'Simulator Option'], [
    ['2. Floor Bands', 'Ground-floor band', 'rownum:Ground:2', '+1', 'Floor Adjustment:', 'value', 'Floor Number', '1'],
    ['3. View %', 'View V1', 'rownum:V1:0', '+1', 'View Adjustment:', 'value', 'View', 'V1'],
    ['4. Orientation %', 'Orientation O1', 'rownum:O1:0', '+1', 'Orientation Adjustment:', 'value', 'Orientation', 'O1'],
    ['5. Position %', 'Position P1', 'rownum:P1:0', '+1', 'Position Adjustment:', 'value', 'Position', 'P1'],
    ['6. Commercial Tiers & Governance', 'Early Bird tier', 'number:0', '+1', 'Early Bird', 'tier', '', ''],
    ['6. Commercial Tiers & Governance', 'Premium Tier 1', 'number:2', '+1', 'Premium I', 'tier', '', ''],
    ['6. Commercial Tiers & Governance', 'Maximum Discount Limit', 'number:5', '+1', 'Price Floor', 'floor', '', ''],
    ['6. Commercial Tiers & Governance', 'Rounding Rule', 'label:Rounding Rule', 'to:Nearest Hundred ($100)', 'Early Bird', 'round', '', ''],
])
README = [
    'Test data for the Admin & Governance suite (tests/admin-governance). Nothing the tests type or expect is written in the code.',
    'Default source: this Excel file. Set TEST_DATA_FORMAT=csv to use TestData/csv/Admin_Governance/<sheet>.csv instead. Rebuild both with: python scripts/build_admin_governance.py',
    'Current figures and rule values are read from the page at run time.',
    'Changes on QA: Reference Records are created once, kept and left inactive; Rows per page and the rules marked "Saved By Tests" are changed and put back (original values published again). Each publish raises that rule\'s version number.',
    'Never pressed: Run ETL, Get Latest Exchange Rates, and any save of the currency policy, security policies, SMTP / email / WhatsApp settings, Login & OTP or the base currency.',
    'The test email and WhatsApp are real messages. Their recipients come from TEST_EMAIL_TO and TEST_WHATSAPP_TO in .env.',
    'In Preference Options a semicolon stands for a comma inside an option.',
]
write_testdata('Admin_Governance_Test_Data.xlsx', 'Admin_Governance', 'Admin & Governance — Test Data', README, S)

cases = []
def C(id, uc, area, title, pre, steps, data, exp, pri='High', kind='Positive', auto='Automated'):
    cases.append([id, uc, area, title, pre, steps, data, exp, pri, kind, auto])

ADMIN = 'Signed in as CRM Administrator'
CUR = 'Open Currency Master (Admin & Governance → Currencies)'
REF = 'Open Reference Data Management'
PREF = 'Open Preferences'
RULE = 'Open Business Rules Configuration'
UC1, UC2, UC3, UC4, UC5 = 'AGU-01 Currency Master', 'AGU-02 Reference Data', 'AGU-03 Preferences', 'AGU-04 Business Rules', 'AGU-05 Communication test sends'

A = 'Currencies'
C('ADM-001', UC1, A, 'Currency cards match the register', ADMIN, st(CUR, 'Read the cards', 'Read the register total, with and without Active only'), f'{TD} → Currency Cards',
  'Currencies = register total; Active = total with Active only; Payment = currencies with the Payment role; Contract = the Base currency code.', kind='Consistency')
C('ADM-002', UC1, A, 'Tabs show their counts', ADMIN, st(CUR, 'Read the tabs', 'Open each tab'), f'{TD} → Settings (… Tab)',
  'Tabs Currencies, Policy and Exchange Rates open; the Currencies count = register total and the Exchange Rates count = rate register total.', 'Medium', 'Consistency')
C('ADM-003', UC1, A, 'Currency register search and Active only', ADMIN, st(CUR, 'Search by a code, a name and a symbol from a row', 'Tick Active only'), f'{TD} → Settings (Currency Search, Active Only)',
  'Each search lists that currency; every row listed contains the text; Active only lists only ACTIVE currencies.', 'Medium')
C('ADM-004', UC1, A, 'New Currency form shows its fields', ADMIN, st(CUR, 'Click New Currency', 'Read the form', 'Cancel'), f'{TD} → Form Fields (Currency)',
  'Every field of the data is shown; Currency Code and Currency Name are marked *; Cancel saves nothing.', 'Medium')
C('ADM-005', UC1, A, 'Empty currency is not saved', ADMIN, st(CUR, 'Click New Currency', 'Click Create Currency without typing', 'Cancel'), f'{TD} → Settings (Create Currency Button)',
  'A message says what is required; no currency is created.', kind='Negative')
C('ADM-006', UC1, A, 'Edit Currency shows the saved values; Cancel changes nothing', ADMIN, st(CUR, 'Click Edit on a row', 'Read the form', 'Cancel'), 'whatever the register lists at run time',
  'Heading "Edit Currency — <code>"; code, name, decimals and status equal the row; Cancel sends nothing.', 'Medium')
C('ADM-007', UC1, A, 'Policy agrees with the cards and the register', ADMIN, st(CUR, 'Open Policy', 'Read Core Operating Currency, payment currencies, policy name and status'), 'whatever the page shows at run time',
  'Core Operating Currency = the Contract card and the Base role in the register; policy name and status are filled. Save Policy Configuration is present and never pressed.', kind='Consistency')
C('ADM-008', UC1, A, 'Exchange rate register, search and Active Rates only', ADMIN, st(CUR, 'Open Exchange Rates', 'Read every row', 'Search a pair from a row', 'Tick Active Rates only'), f'{TD} → Settings (Rate Search, Active Rates Only)',
  'Every row is "<code> to <code>" with a rate above 0; the search lists matching pairs only; Active Rates only lists no inactive rate. Get Latest Exchange Rates is present and never pressed.', 'Medium')
C('ADM-009', UC1, A, 'Add Exchange Rate and Rate Settings forms', ADMIN, st(CUR, 'Exchange Rates → Add Exchange Rate', 'Read it and Cancel', 'Rate Settings', 'Read it and Cancel'), f'{TD} → Form Fields (Rate), Settings (Rate Formula)',
  'Add Exchange Rate shows its fields, the formula line, and To Currency starts on the base currency; Rate Settings opens with the provider URL; Cancel sends nothing.', 'Medium')

A = 'Reference Data'
C('ADM-011', UC2, A, 'Reference cards match the register and filters', ADMIN, st(REF, 'Read the cards', 'Read the register total, with and without Active only', 'Count the Category and Group options'), f'{TD} → Reference Cards',
  'Values = register total; Categories = Category options; Families = Group options; Inactive = total − Active only total.', kind='Consistency')
C('ADM-012', UC2, A, 'Category and Group filters narrow the register', ADMIN, st(REF, 'Choose a Category', 'Choose a Group of it', 'Tick Active only'), 'whatever the filters list at run time',
  'Every row belongs to the chosen category and group; the Group list follows the category; Active only lists only ACTIVE values.', kind='Consistency')
C('ADM-013', UC2, A, 'Search the register', ADMIN, st(REF, 'Search a value code from a row', 'Search a text no value has'), f'{TD} → Settings (Reference Search)',
  'The row is found and every row listed contains the text; a text no value has lists nothing.', 'Medium')
C('ADM-014', UC2, A, 'New Category, New Group and New Reference Value forms', ADMIN, st(REF, 'Open each form', 'Read it', 'Cancel'), f'{TD} → Form Fields (Reference), Reference Forms',
  'Each form shows every field. New Category types the category and group; New Group chooses the category; New Reference Value chooses category and group, and its groups follow the category. Cancel saves nothing.', 'Medium')
C('ADM-015', UC2, A, 'Empty reference forms are not saved', ADMIN, st(REF, 'Open the form of the data row', 'Create Reference Value without typing', 'Cancel'), f'{TD} → Reference Forms (ADM-015.1 …)',
  'A message says what is required; nothing is created.', kind='Negative')
C('ADM-016', UC2, A, 'Create the test category (or reuse it)', ADMIN, st(REF, 'Read the cards', 'New Category → fill the Category row', 'Create Reference Value', 'Search the code'), f'{TD} → Reference Records (Category)',
  'The value is listed under the new category; Values +1 and Categories +1 on first creation. On later runs the record already exists and is made active again.')
C('ADM-017', UC2, A, 'New Group adds a group to the test category', 'The test category', st(REF, 'New Group → fill the Group row', 'Create Reference Value', 'Search the code'), f'{TD} → Reference Records (Group)',
  'The value is listed under the new group; the Group filter offers it.')
C('ADM-018', UC2, A, 'New Reference Value adds a value to the test group', 'The test group', st(REF, 'New Reference Value → category and group of the Value row', 'Create Reference Value', 'Search the code'), f'{TD} → Reference Records (Value)',
  'The value is listed under the group, and Group Name is filled from the chosen group.')
C('ADM-019', UC2, A, 'Duplicate value code is refused', 'The test value', st(REF, 'New Reference Value with the same category, group and code', 'Create Reference Value'), f'{TD} → Reference Records',
  'A message says the code already exists; the register still has one such value.', kind='Negative')
C('ADM-020', UC2, A, 'Edit a value', 'The test value', st(REF, 'Edit on the test value', 'Read the locked fields', 'Change Value Name', 'Update Reference Value', 'Search it'), f'{TD} → Reference Records (Edited Value Name)',
  'Category, group and code are read-only; the new name is listed; the name is put back afterwards.')
C('ADM-021', UC2, A, 'Deactivate the test values', 'The test values', st(REF, 'Read the Inactive card', 'Deactivate each test value and confirm', 'Search them'), f'{TD} → Settings (Inactive Status)',
  'Each value shows INACTIVE; the Inactive card rises by the number deactivated; Active only no longer lists them.')

A = 'Preferences'
C('ADM-031', UC3, A, 'Application defaults show their options', ADMIN, st(PREF, 'General → Application defaults'), f'{TD} → Preference Sections, Preference Options',
  'Heading and Save button are shown; each dropdown offers the options of the data and has a value chosen.', 'Medium')
C('ADM-032', UC3, A, 'Time & locale shows its options', ADMIN, st(PREF, 'General → Time & locale'), f'{TD} → Preference Options',
  'Default location, Date format, Timezone and Number format are shown with the options of the data.', 'Medium')
C('ADM-033', UC3, A, 'SMTP settings: fields and a blocked test email', ADMIN, st(PREF, 'Notifications → Email (SMTP)', 'Read the form'), f'{TD} → Preference Sections',
  'Mail server and sender fields are shown; the password is not shown in clear; while email sending is off, Send test email is disabled. Nothing is saved.', 'Medium')
C('ADM-034', UC3, A, 'Notification channels are listed', ADMIN, st(PREF, 'Notifications → Notification channel'), f'{TD} → Preference Sections',
  'Email, WhatsApp and In-App channels are listed with their switches. Nothing is saved.', 'Low')
C('ADM-035', UC3, A, 'Security policies show their values', ADMIN, st(PREF, 'Security'), f'{TD} → Preference Sections',
  'Session timeout, max failed logins and the lock interval are numbers above 0; MFA is disabled as "Planned in next release". Save Security Policies is never pressed.', 'Medium')
C('ADM-036', UC3, A, 'Operations & ETL shows the run log', ADMIN, st(PREF, 'Operations & ETL', 'Read the log'), f'{TD} → Settings (Never Click)',
  'Both ETL buttons are present and never pressed; "N total logged" = the log rows; every row has a type, a status and who ran it.', 'Medium')
C('ADM-037', UC3, A, 'Rows per page is saved and used', ADMIN, st(PREF, 'General → Application defaults', 'Choose the Page Size Change', 'Save application defaults', 'Reload', 'Open Reference Data and read the page size', 'Put the original value back'), f'{TD} → Settings (Page Size Change)',
  'The choice is still there after a reload; registers then list that many rows per page; the original value is put back.')

A = 'Business Rules'
C('ADM-041', UC4, A, 'Every rule engine opens with its version line', ADMIN, st(RULE, 'Open each engine'), f'{TD} → Rule Engines',
  'All engines of the data are listed; each opens at ?engine=<code>, with a heading, a Version line and Save Draft / Publish.', 'Medium')
C('ADM-042', UC4, A, 'Lead Duplicate Rules: mobile and email always unique', ADMIN, st(RULE, 'Lead Duplicate Rules'), 'whatever the page shows at run time',
  'Match Mode has a value; the field table lists First name, Last name, Mobile, Email, Passport number and National ID number; Mobile and Email read "Always unique".', 'Medium')
C('ADM-043', UC4, A, 'Lead Scoring: enabled criteria total 100', ADMIN, st(RULE, 'Lead Scoring Matrix', 'Add the Max Score of enabled criteria'), f'{TD} → Settings (Scoring Total)',
  'The sum of the enabled Max Scores = 100 = the line "Enabled criteria total: 100 / 100 ✓".', kind='Calculation')
C('ADM-044', UC4, A, 'Lead Qualification Threshold values', ADMIN, st(RULE, 'Lead Qualification Threshold'), 'whatever the page shows at run time',
  'Auto-qualify minimum score is 0–100 and the warning message is filled.', 'Medium')
C('ADM-045', UC4, A, 'Lead Classification Bands cover 0–100', ADMIN, st(RULE, 'Lead Classification Bands'), f'{TD} → Settings (Band Range)',
  'The four bands run from 0 to 100 without gaps or overlaps.', kind='Calculation')
C('ADM-046', UC4, A, 'Date of Birth Rules', ADMIN, st(RULE, 'Date of Birth Rules'), 'whatever the page shows at run time',
  'Minimum age is at most the maximum age and both are numbers.', 'Medium')
C('ADM-047', UC4, A, 'When Lead Becomes Customer', ADMIN, st(RULE, 'When Lead Becomes Customer'), 'whatever the page shows at run time',
  'One trigger is chosen and the policy note is filled. Never saved.', 'Low')
C('ADM-048', UC4, A, 'Unit Hold Rules match the Hold form', ADMIN, st(RULE, 'Unit Hold Rules', 'Availability Summary → Stack Plan → an Available tile → Hold', 'Compare', 'Cancel'), 'whatever the pages show at run time',
  'Default ≤ maximum; the Hold button names the default hours; the longest Hold for option = the maximum hold length.', kind='Consistency')
C('ADM-049', UC4, A, 'Discount Approval Tiers run upward', ADMIN, st(RULE, 'Discount Approval Tiers'), 'whatever the page shows at run time',
  'The free limit is below the first tier; "Up to (%)" rises tier by tier to 100; every tier has a name.', kind='Calculation')
C('ADM-050', UC4, A, 'Communication Channels show their state', ADMIN, st(RULE, 'Communication Channels'), f'{TD} → Settings (Never Click, Setup Needed)',
  'The Email and WhatsApp switches and both setup sections are shown; save and verify buttons are present and never pressed.', 'Medium')
C('ADM-051', UC4, A, 'Login & OTP values are inside their limits', ADMIN, st(RULE, 'Login & OTP'), 'whatever the page shows at run time',
  'The four delivery channels are listed; each numeric setting lies within the range its hint gives. Never saved.', 'Medium')
C('ADM-052', UC4, A, 'Personal Data Protection shows its options', ADMIN, st(RULE, 'Personal Data Protection'), 'whatever the page shows at run time',
  'Masking switch, the data types and the roles that see full data are listed. Never saved.', 'Medium')
C('ADM-053', UC4, A, 'Unit Pricing Matrix Rules show their tabs', ADMIN, st(RULE, 'Unit Pricing Matrix Rules'), 'whatever the page shows at run time',
  'The rule tabs and the Live Simulator are listed. Saving is left to the Pricing Matrix suite.', 'Low')
C('ADM-054', UC4, A, 'Wrong rule values are not published', ADMIN, st(RULE, 'Open the engine of the data row', 'Make the change', 'Publish', 'Reload'), f'{TD} → Rule Invalid Values (ADM-054.1 …)',
  'Each row: the field does not take the value, or Publish is disabled, or Publish is refused with a message; the published value is unchanged. A wrong value that is accepted is put back at once.', kind='Negative')
C('ADM-055', UC4, A, 'Save Draft and Publish keep the change, then put it back', ADMIN, st(RULE, 'Open the engine of the data row', 'Make the change', 'Save Draft', 'Reload and read', 'Publish', 'Reload and read', 'Put the original value back and Publish'), f'{TD} → Rule Saves (ADM-055.1 …)',
  'After Save Draft: version +1, "DRAFT … Unpublished changes", the change is kept. After Publish: "PUBLISHED", the change is kept. At the end the original value is published again.')
C('ADM-056', UC4, A, 'Save Draft and Publish tell the user the result', ADMIN, st(RULE, 'Change a value on a saved engine', 'Save Draft', 'Read the screen', 'Put it back and Publish', 'Read the screen'), f'{TD} → Rule Saves',
  'Each action shows a success message.', 'Medium')

A = 'Communication Test Sends'
C('ADM-061', UC5, A, 'Send a real test email', 'TEST_EMAIL_TO in .env', st(RULE, 'Communication Channels', 'Type the recipient under Send Test Email', 'Send Test Email Now', 'Read the result', 'Check the inbox'), f'{TD} → Settings (Email …)',
  'The app reports that the email was sent and it arrives. While the channel is "Setup Needed" the app must say clearly why it could not be sent.')
C('ADM-062', UC5, A, 'Send a real test WhatsApp', 'TEST_WHATSAPP_TO in .env', st(RULE, 'Communication Channels', 'Choose the Meta Sandbox preset', 'Type the recipient', 'Send Test WhatsApp Now', 'Read the result', 'Check the phone'), f'{TD} → Settings (WhatsApp …)',
  'The app reports that the message was sent and it arrives. While the channel is "Setup Needed" the app must say clearly why it could not be sent.')
C('ADM-063', UC4, A, 'No broken values on the admin pages', ADMIN, st('Open each admin page and tab'), f'{TD} → Settings (Broken Values)', 'No NaN, undefined, null or Infinity anywhere.', 'Medium', 'Design')

UC6 = 'AGU-06 Rule integration'
A = 'Rule Integration'
PUB = 'Publish the rule of the data row'
BACK = 'Publish the original rule again and verify it'
C('ADM-101', UC6, A, 'Lead Duplicate Rules are applied when a lead is created', ADMIN, st(PUB, 'Leads → create an Individual lead for each row of Duplicate Variants, against one existing lead', BACK), f'{TD} → Duplicate Rules, Duplicate Variants',
  'Same mobile or email is always blocked. Otherwise a lead is blocked exactly when the rule says so: All = every enabled field matches, Any = at least one, Minimum N = at least N (a name switched off does not count). A blocked lead names the existing lead; a lead that is not a duplicate is saved.')
C('ADM-102', UC6, A, 'Lead Scoring maximums are used in the lead score', ADMIN, st(PUB, 'Lead Detail → Recalculate Score', 'Read the breakdown', BACK), f'{TD} → Scoring Criteria (2 points moved to the next criterion)',
  'Every item of the breakdown shows the published maximum, points stay within it and the breakdown adds up to the computed score.')
C('ADM-103', UC6, A, 'A disabled scoring criterion is not counted', ADMIN, st(PUB, 'Lead Detail → Recalculate Score', 'Read the breakdown', BACK), f'{TD} → Scoring Criteria (criterion disabled, its points given to the next one so the total stays 100)',
  'The disabled criterion is not counted in the score; the next criterion shows its new maximum.')
C('ADM-104', UC6, A, 'Lead Qualification Threshold is applied when a lead is qualified', ADMIN, st(PUB, 'Lead Detail → fill the checklist → Qualify lead', 'Read the pop-up', BACK), f'{TD} → Qualification Cases',
  'At or above the minimum the lead is qualified with no warning. Below it, with manual allowed: the published warning text, Cancel keeps the lead, Qualify Anyway qualifies it. Below it, with manual not allowed: the lead is not qualified and a message says so.')
C('ADM-105', UC6, A, 'Lead Classification Bands decide the suggested rating', ADMIN, st('Read the lead\'s computed score', 'Publish bands that put that score in the band of the data row', 'Lead Detail → Recalculate Score', 'Read Suggested and Current rating', BACK), f'{TD} → Band Cases',
  'Suggested rating = the band that holds the score. With Auto-apply on, the Current rating and the Rating dropdown take it on recalculation; with it off the Current rating stays as it was.')
C('ADM-106', UC6, A, 'A changed band label is shown on the lead', ADMIN, st('Publish a new label on the band that holds the lead\'s score', 'Lead Detail → Recalculate Score', 'Read the suggested rating', BACK), f'{TD} → Settings (Band Label Text)',
  'The lead shows the published label.', 'Medium')
C('ADM-107', UC6, A, 'Date of Birth Rules are applied when a lead is created', ADMIN, st(PUB, 'Leads → create an Individual lead with each date of DOB Values', BACK), f'{TD} → DOB Rules, DOB Values (dates worked out from the published ages)',
  'Dates inside the published ages are saved, including exactly the minimum and exactly the maximum age. A date one day outside them, or in the future, is refused with a message.')
C('ADM-108', UC6, A, 'Date of Birth Rules are applied when a lead is edited', ADMIN, st('Create a lead with a valid date of birth', 'Publish a higher minimum age', 'Edit the lead and save a date under it', BACK), f'{TD} → DOB Rules',
  'The date is refused with a message and the lead keeps its date of birth.')
C('ADM-109', UC6, A, 'Date of Birth Rules are applied when a lead is qualified', ADMIN, st('Create a lead with a date of birth', 'Publish a minimum age above that person\'s age', 'Lead Detail → fill the checklist → Qualify lead', BACK), f'{TD} → DOB Rules',
  'The lead is not qualified and a message names the date of birth.')
ST = 'Business Rules → Sales Velocity Targets'
C('ADM-122', UC4, 'Business Rules', 'Sales Velocity Targets show the four targets and the implied price', ADMIN, st(ST, 'Read the two panels'), f'{TD} → Sales Target Fields, Sales Target Headings',
  'Panels Monthly Budget (Target) and Monthly Forecast (Stretch), each with units and revenue (USD) of 0 or more; Implied Avg Price / Unit = revenue ÷ units; no NaN / undefined.', 'Medium')
C('ADM-123', UC4, 'Business Rules', 'Sales Velocity Targets do not keep wrong input', ADMIN, st(ST, 'Type the value of the data row in the field', 'Click outside the field', 'Reload the page'), f'{TD} → Sales Target Invalid Values',
  'The field never holds a negative number, a decimal number of units or letters; nothing is saved and the published rule is unchanged.', 'Medium')
C('ADM-124', UC4, 'Business Rules', 'Zero targets do not break the dashboard', ADMIN, st(ST, 'Set all four targets to 0', 'Publish', 'Open the dashboard', BACK), '0 in every field',
  'Either Publish is refused with a message, or the dashboard still shows real figures (no NaN, Infinity or undefined).', 'High')
C('ADM-125', UC6, A, 'A draft of Sales Velocity Targets does not reach the dashboard', ADMIN, st(ST, 'Raise Monthly Units Budget', 'Save Draft', 'Open the dashboard', BACK), f'{TD} → Settings (Sales Target Units Step)',
  'The rule shows DRAFT with the new value, and the dashboard still uses the published targets.', 'High')
C('ADM-126', UC6, A, 'Published Sales Velocity Targets are used by the dashboard', ADMIN, st('Open the dashboard and read the targets', ST, 'Raise all four targets', 'Publish', 'Open the dashboard', BACK, 'Open the dashboard'), f'{TD} → Sales Target Fields, Settings (Sales Target Units Step, Sales Target Revenue Step), Sales Target Dashboard Lines',
  'After Publish the dashboard compares sales with the new budget and forecast (units and revenue) and shows them; after the rule is put back it uses the original targets again.', 'High')
HOLD = 'Publish the Unit Hold rule of the data row'
C('ADM-110', UC6, A, 'The default hold length is pre-selected when a unit is held', ADMIN, st(HOLD, 'Availability Summary → Stack Plan → open an Available unit', 'Read the Hold button, press it and read the Hold for list', BACK), f'{TD} → Hold Defaults',
  'The button reads "Hold for <default>h" and the Hold form opens with that length selected.')
C('ADM-111', UC6, A, 'The maximum hold length limits the lengths offered', ADMIN, st(HOLD, 'Availability Summary → open an Available unit → Hold', 'Read the Hold for list', BACK), f'{TD} → Hold Maximums',
  'No length longer than the published maximum is offered, and the longest length offered is the one in the data.')
C('ADM-112', UC6, A, 'The limit of active holds per sales rep is applied', ADMIN, st(HOLD, 'Hold as many units as the limit allows, each for its own new test opportunity', 'Try to hold one more unit', 'Release every hold', BACK), f'{TD} → Hold Limits',
  'Holds up to the limit are placed. The next one is refused with a message and that unit stays Available.', 'High')
C('ADM-113', UC6, A, 'A hold placed with the default length lasts that long', ADMIN, st(HOLD, 'Hold a unit without changing the length', 'Inventory → Holds: read the time left', 'Release the hold', BACK), f'{TD} → Hold Length',
  'The time left on the Holds tab equals the published default length, within the tolerance of the data.')
C('ADM-114', UC6, A, 'Managers can extend a hold only when the rule allows it', ADMIN, st('Hold a unit for a test opportunity', HOLD, 'Opportunities → open the opportunity → look for Extend by', 'When offered: extend the hold and read the time left', 'Release the hold', BACK), f'{TD} → Hold Extend',
  'Rule On: the Extend control is offered, no extension is longer than the published maximum, and extending adds time. Rule Off: no Extend control.')
C('ADM-115', UC6, A, 'When Lead Becomes Customer is applied when a lead is converted', ADMIN, st('Publish the trigger of the data row', 'Create a lead, qualify it and convert it to an opportunity', 'Customers & Brokers: read the person\'s Status', BACK), f'{TD} → Customer Triggers',
  'With the legacy trigger the person is a Customer straight after conversion; with every other trigger the person stays Prospect (pre-customer).', 'High')
C('ADM-116', UC6, A, 'A published Base Rate reaches the Live Simulator and does not move unit prices', ADMIN, st('Pricing Matrix: read every unit\'s figures', 'Publish a Base Rate 1 higher', 'Live Simulator: read Carpet Area × Base Rate', 'Pricing Matrix: read every unit\'s figures again', BACK, 'Pricing Matrix and Live Simulator: read them again'), f'{TD} → Pricing Base Rate',
  'The Live Simulator uses the published rate. No unit\'s price changes after the publish or after the rule is put back. ⚡ Recalculate All Units Live is never pressed. The other pricing tabs are tested only when this case passes.', 'High')
C('ADM-117', UC6, A, 'Published pricing rules reach the Live Simulator and do not move unit prices', ADMIN, st('Publish the pricing change of the data row', 'Live Simulator: read the matching line', 'Pricing Matrix: read every unit\'s figures', BACK), f'{TD} → Pricing Changes',
  'The Live Simulator shows the published value in its figure and in the tier name, and applies the rounding. No unit\'s price changes. ⚡ Recalculate All Units Live is never pressed.', 'High')
C('ADM-118', UC6, A, 'Login page follows the current Login & OTP rule (read only)', ADMIN, st('Business Rules → Login & OTP: read Where OTP login is offered and Forgot password, without saving', 'Open the login page signed out'), 'Current rule values, nothing saved',
  'OTP Login is offered when the CRM switch is on, and Forgot password? is shown when the rule allows it. No request changes anything.', 'Medium')
C('ADM-119', UC6, A, 'Customer data follows the current Personal Data Protection rule (read only)', ADMIN, st('Business Rules → Personal Data Protection: read Mask personal data and the roles that see full data, without saving', 'Customers & Brokers: read the Contact column'), 'Current rule values, nothing saved',
  'A CRM Administrator, a role that sees full data, sees phone numbers and emails unmasked. No request changes anything. Roles that must see masked data are covered by the Security suite.', 'Medium')
C('ADM-120', UC6, A, 'Discount Approval Tiers are applied on the New Proposal form', ADMIN, st('Publish the free limit and first tier of the data row', 'Proposals → New Proposal → choose an opportunity with an approved reservation', 'Type a proposed price that gives the discount of the data row', 'Read the note under Discount %', BACK), f'{TD} → Discount Cases (the proposal is not saved)',
  'Up to the free limit the note reads "No approval needed (discounts up to N%)". Above it the note names the published free limit and the tier that must approve, by the published name and upper limit of that tier (a discount equal to the limit of a tier belongs to that tier).', 'High')
C('ADM-121', UC6, A, 'When Lead Becomes Customer is applied at reservation and proposal', ADMIN, st('Publish the trigger of the data row', 'Create a buyer lead, qualify and convert it', 'Take the deal to an approved reservation on the test unit (and to an accepted proposal when the data row says so)', 'Customers & Brokers: read the Status of the buyer after each step', BACK, 'Cancel the reservation so the test unit is free'), f'{TD} → Customer Stage Triggers (test unit of Coral Bay Residences)',
  'The buyer stays Prospect (pre-customer) until the published event happens and becomes Customer when it does. Contract / SPA signed is checked up to the approved reservation only (signing a contract needs a second test unit).', 'High')

OVERVIEW = [
    ('Scope', 'Admin & Governance: Currency Master (currencies, policy, exchange rates), Reference Data, Preferences (application defaults, time & locale, SMTP, notification channels, security, ETL log) and Business Rules Configuration (13 engines), plus real test email / WhatsApp sends. Users & Roles and the audit log are covered by the Security suite.'),
    ('Use cases', 'AGU-01 Currency Master · AGU-02 Reference Data · AGU-03 Preferences · AGU-04 Business Rules · AGU-05 Communication test sends · AGU-06 Rule integration'),
    ('Test data', f'{TD} (or TestData/csv/Admin_Governance/*.csv with TEST_DATA_FORMAT=csv). Recipients of the test sends are in .env.'),
    ('Automation', 'tests/admin-governance/*.spec.ts — run with: npm run test:admin-governance'),
    ('Report', 'reports/Admin_Governance_Test_Report_<date>_<time>.xlsx'),
    ('Data changed', 'Reference Records (kept, left inactive); Rows per page and 7 rule engines (changed and put back; each publish raises the version number). Rule Integration (ADM-101…121) also publishes each rule for a moment, creates test leads and opportunities and holds Available units, always released. Never pressed: Run ETL, Get Latest Exchange Rates, or any save of the currency policy, security policies, SMTP / email / WhatsApp settings or Login & OTP.'),
]
AREA_IMPACT = {
    'Currencies': 'Currency settings or rates are wrong, so amounts across deals and reports are converted wrongly.',
    'Reference Data': 'Dropdown values used across the CRM are wrong or cannot be maintained.',
    'Preferences': 'Organization settings are wrong or are not applied, so every user gets the wrong behaviour.',
    'Business Rules': 'Lead, hold or discount rules are wrong or do not save correctly, so the CRM applies the wrong business policy.',
    'Communication Test Sends': 'Admins cannot confirm that customers will receive email or WhatsApp messages.',
    'Rule Integration': 'A published business rule is not followed by the page that should apply it, so the CRM enforces a different policy from the one the organization configured.',
}
FINDINGS = [
    ['F-01', 'Environment', 'ADM-061, ADM-062', 'Test email and WhatsApp cannot be delivered on QA', 'Send Test Email Now answers "✕ Email Test Failed": "Microsoft 365 email is not connected yet (set MS_GRAPH_TENANT_ID, MS_GRAPH_CLIENT_ID and MS_GRAPH_CLIENT_SECRET)". WhatsApp also shows Setup Needed. The app states the reason correctly; the provider has to be connected on the server.', 'Connect the mail and WhatsApp providers on QA, then run ADM-061 and ADM-062 again.', 'Medium'],
]
write_cases('Admin_Governance_Test_Cases.xlsx', 'Admin & Governance — Test Cases', OVERVIEW, cases, FINDINGS, {}, AREA_IMPACT)
