"""Builds the role-based suite for the Sales Executive (IDs RSE-):
  TestData/Role_Sales_Executive_Test_Data.xlsx + TestData/csv/Role_Sales_Executive/*.csv  (test data, same content)
  Testcase/Role_Sales_Executive_Test_Cases.xlsx                                          (human-readable test cases)
Run from the repo root:  python scripts/build_role_sales_executive.py
What the role may do is NOT written here: the tests read the role's permission matrix (Users & Roles) as the admin at run
time and expect exactly that. The Modules sheet only says where each permission shows up in the app.
"""
from sales_modules_common import st, write_testdata, write_cases

TD = 'TestData/Role_Sales_Executive_Test_Data.xlsx'
S = {}
S['Settings'] = (['Setting', 'Value', 'What it means'], [
    ['Role Code', 'SALES_EXECUTIVE', 'Role under test (its permission matrix is read at run time)'],
    ['Role Name', 'Sales Executive', 'Name shown under the user in the header'],
    ['User Env', 'SALES_USERNAME', '.env variable with the login of the user (password in SALES_PASSWORD)'],
    ['Denied Title', 'Permission Denied', 'Page shown for a module the role may not view'],
    ['Users Denied Title', 'Access Denied', 'Users & Roles page shows this wording instead'],
    ['Refused Code', 'PERMISSION_REQUIRED', 'Error code of a request the role may not make'],
    ['Mask Character', '•', 'Character used to mask personal data'],
    ['Lead Detail Activity Buttons', 'Log call | Add task | Add meeting', 'Lead Detail buttons that need Tasks, Calls & Calendar'],
    ['Convert Button', 'Convert', 'Button of the confirmation "Convert lead to opportunity?"'],
    ['Data Scope Expected', 'Own and team records', 'Which records a Sales Executive should see (to be confirmed by the business)'],
])
# Permission → where it shows in the app. Create Button: text of the button that starts a new record (blank: none on the page)
S['Modules'] = (['Permission', 'Module', 'Menu Label', 'Route', 'List API', 'Create API', 'Create Button', 'Edit Button', 'Export Button'], [
    ['LEADS', 'Leads', 'Leads', '/leads', '/leads?limit=1&offset=0', '/leads', 'Individual', '', 'Export'],
    ['OPPORTUNITIES', 'Opportunities', 'Opportunities', '/opportunities', '/opportunities?limit=1&offset=0', '/opportunities', '', '', 'Export'],
    ['RESERVATIONS', 'Reservations', 'Reservations', '/reservations', '/reservations?limit=1&offset=0', '/reservations', 'New Reservation', '', 'Export'],
    ['PROPOSALS', 'Proposals', 'Proposals', '/proposals', '/proposals?limit=1&offset=0', '/proposals', 'New Proposal', '', ''],
    ['CONTRACTS', 'SPA / Sales Contracts', 'Sales Contracts', '/spa-contracts', '/contracts?limit=1&offset=0', '/contracts', 'New Contract', '', 'Export'],
    ['CUSTOMERS', 'Customers', 'Customers & Brokers', '/customers', '/customers?limit=1&offset=0', '/customers', 'New Customer', '', 'Export'],
    ['BROKERS', 'Brokers', '', '/brokers-channels', '/brokers?limit=1&offset=0', '/brokers', 'New Broker', '', ''],
    ['INVENTORY', 'Inventory', 'Inventory', '/inventory', '/inventory/units?limit=1&offset=0', '/inventory/projects', 'New Project', 'Edit', ''],
    ['ACTIVITIES', 'Tasks & Calendar', 'Tasks & Calendar', '/activities', '/activities?limit=1&offset=0', '/activities', 'New task', '', 'Export'],
    ['CONSTRUCTION_UPDATES', 'Construction Updates', 'Construction Updates', '/construction-updates', '/construction-updates?limit=1&offset=0', '/construction-updates', 'New Update', '', ''],
    ['LAUNCHES', 'Marketing Campaigns', 'Marketing Campaigns', '/marketing', '', '', '', '', ''],
    ['DMS', 'Documents & Media (DMS)', 'Documents & Media (DMS)', '/documents', '', '', 'Upload Document', '', ''],
    ['SERVICE_REQUESTS', 'Service Requests', 'Service Requests', '/service-requests', '/service-requests?limit=1&offset=0', '/service-requests', 'New Request', '', ''],
    ['REPORTS', 'Reports & Analytics', 'Reports', '/reports', '', '', '', '', ''],
    ['DASHBOARD', 'Executive Dashboards', '', '/dashboards', '/dashboard/summary?period=this_month&view=audience', '', '', '', ''],
    ['COMMUNICATIONS', 'Customer Communications', '', '/communications', '', '', '', '', ''],
    ['CURRENCIES', 'Currency Master', '', '/currencies', '/currencies', '/currencies', 'New Currency', 'Edit', ''],
    ['CONFIGURATION', 'Business Rules & Preferences', '', '/configuration', '/configuration/LEAD_DUPLICATE', '', '', '', ''],
    ['REFERENCE_DATA', 'Reference Data', '', '/reference-data', '', '', '', '', ''],
    ['USERS', 'Users & Roles', '', '/admin', '/admin/users?limit=1&offset=0', '/admin/users', '', '', ''],
    ['ROLES', 'Roles & Permissions', '', '', '/admin/roles?limit=1&offset=0', '/admin/roles', '', '', ''],
    ['AUDIT_LOG', 'Audit Log', '', '/admin/audit-log', '', '', '', '', ''],
])
README = [
    'Test data for tests/role-sales-executive: what a Sales Executive can and cannot do.',
    'Expected access is not written here: the tests read the permission matrix of the role (Settings → Role Code) as the admin and expect exactly what it grants.',
    'The user signs in with SALES_USERNAME / SALES_PASSWORD from .env. The password is never changed or printed.',
    'Data created: one test lead (created, edited, qualified and converted by the Sales Executive, so one opportunity too). Every other check only reads, or sends an empty request that the server refuses or rejects as incomplete.',
]
write_testdata('Role_Sales_Executive_Test_Data.xlsx', 'Role_Sales_Executive', 'Role-based testing: Sales Executive — Test Data', README, S)

cases = []
def C(id, uc, area, title, pre, steps, data, exp, pri='High', kind='Functional', auto='Automated'):
    cases.append([id, uc, area, title, pre, steps, data, exp, pri, kind, auto])
SE = 'User of the role under test exists and can sign in (.env SALES_USERNAME / SALES_PASSWORD)'
MATRIX = 'Permission matrix of the role, read as the admin at run time'
U1, U2, U3, U4 = 'RSE-UC1 Sign-in and navigation', 'RSE-UC2 Modules follow the permission matrix', 'RSE-UC3 Allowed work end to end', 'RSE-UC4 Data visibility'

A = 'Sign-in'
C('RSE-001', U1, A, 'Sales Executive signs in and sees the role in the header', SE, st('Sign in with the Sales Executive login', 'Read the header'), 'SALES_USERNAME / SALES_PASSWORD',
  'Signed in without a password change; the header shows the user\'s full name and "Sales Executive"; My Smart Workspace opens.', kind='Functional')
C('RSE-002', U1, A, 'Side menu shows exactly the modules the role can view', SE, st('Sign in', 'Read the side menu'), f'{MATRIX}; {TD} → Modules (Menu Label)',
  'Every module with View in the matrix is in the menu; no module without View is.', kind='Functional')
C('RSE-003', U1, A, 'The user record matches the role set up by the admin', SE, st('As admin open Users & Roles → the user', 'Read role, status, login and reports-to'), MATRIX,
  'Role Sales Executive (primary), ACTIVE, login enabled, a manager set; /auth/me of the user returns the same role and no forced password change.', 'Medium', 'Integration')
A = 'Permissions'
C('RSE-010', U2, A, 'Modules without View show "Permission Denied"', SE, st('Open the address of each module the role may not view'), f'{MATRIX}; {TD} → Modules (Route)',
  'The page says Permission Denied / Access Denied and names the module; no data of the module is shown.', kind='Functional')
C('RSE-011', U2, A, 'Modules with View open without errors', SE, st('Open the address of each module the role may view', 'Watch the requests the page sends'), f'{MATRIX}; {TD} → Modules (Route)',
  'The page shows its data; no request fails (a page must not call modules the role cannot see, or must handle the refusal quietly).', kind='Functional')
C('RSE-012', U2, A, 'The server refuses reading modules without View', SE, st('Request the list of each module the role may not view'), f'{MATRIX}; {TD} → Modules (List API)',
  'Each request is refused with 403 PERMISSION_REQUIRED naming <MODULE>.view.', kind='Integration')
C('RSE-013', U2, A, 'The server refuses creating in modules without Create', SE, st('Send an empty create request to each module the role may not create in'), f'{MATRIX}; {TD} → Modules (Create API)',
  'Each request is refused with 403 PERMISSION_REQUIRED naming <MODULE>.create (nothing is saved).', kind='Integration')
C('RSE-014', U2, A, 'The server lets the role create where it has Create', SE, st('Send an empty create request to each module the role may create in'), f'{MATRIX}; {TD} → Modules (Create API)',
  'The request is not refused for permission: it fails only because the body is empty (400), so nothing is saved.', kind='Integration')
C('RSE-015', U2, A, 'Create and Edit buttons are hidden where the role cannot create or update', SE, st('Open each module the role may only view', 'Look for its create / edit buttons'), f'{MATRIX}; {TD} → Modules (Create Button, Edit Button)',
  'No create or edit button is offered (or it is disabled with an explanation).', kind='UI/UX')
C('RSE-016', U2, A, 'Create buttons are offered where the role can create', SE, st('Open each module the role may create in', 'Look for its create button'), f'{MATRIX}; {TD} → Modules (Create Button)',
  'The create button is shown and enabled.', 'Medium', 'Functional')
C('RSE-017', U2, A, 'Export works where the role may export', SE, st('Open each module with Export', 'Click Export'), f'{MATRIX}; {TD} → Modules (Export Button)',
  'A file downloads and holds the records the user sees in the register.', 'Medium', 'Functional')
C('RSE-018', U2, A, 'My Smart Workspace works without Tasks, Calls & Calendar', SE, st('Open My Smart Workspace', 'Read the Today strip and the task badge'), MATRIX,
  'No request fails; the Today strip and task links are hidden or say the user has no access (not "0 overdue · 0 due today" as if there were no tasks).', 'Medium', 'UI/UX')
C('RSE-019', U2, A, 'Service Request form works for the role', SE, st('Service Requests → New Request', 'Read the owner list', 'Close without saving'), MATRIX,
  'The form opens and its lists load (no request fails); nothing is saved.', 'Medium', 'Functional')
C('RSE-020', U2, A, 'Personal data is masked for the role', SE, st('Open Customers and Leads', 'Read names, phones and emails'), f'{TD} → Settings (Mask Character)',
  'Phones and emails are masked (•••), as Personal Data Protection says for roles without full access.', 'Medium', 'Integration')
A = 'Lead lifecycle'
C('RSE-030', U3, A, 'Sales Executive creates a lead and owns it', SE, st('Leads → Individual → fill the required fields → Create Lead', 'Open My Leads'), 'Leads page test data (one lead, fictional mobile, example.* email)',
  'The lead is saved, appears in My Leads and its owner is the Sales Executive.', kind='Functional')
C('RSE-031', U3, A, 'Sales Executive edits his lead', 'The lead of RSE-030', st('Open the lead → Edit → change City / remarks → Save'), 'The lead of RSE-030',
  'The change is saved and shown on the lead.', 'Medium')
C('RSE-032', U3, A, 'Lead Detail without Tasks, Calls & Calendar', 'The lead of RSE-030', st('Open the lead', 'Look at Log call / Add task / Add meeting and the Tasks & Calls list', 'Watch the requests'), f'{TD} → Settings (Lead Detail Activity Buttons)',
  'Activity buttons are hidden (or explain the missing permission) and no request fails when the lead opens.', 'Medium', 'UI/UX')
C('RSE-033', U3, A, 'Sales Executive qualifies and converts his lead', 'The lead of RSE-030', st('Open the lead → fill the qualification checklist → Qualify lead', 'Move to Opportunity'), 'Lead Detail checklist data',
  'The lead is qualified and converted; the new opportunity is listed in Opportunities with the Sales Executive as owner.', kind='Functional')
A = 'Data visibility'
C('RSE-040', U4, A, 'Records the Sales Executive sees', SE, st('Read the totals of Leads, Opportunities, Reservations, Proposals, Customers as the user and as the admin', 'Read the owners of what the user sees'), f'{TD} → Settings (Data Scope Expected)',
  'The user sees the records his role should see (own and his team\'s), not every record of the organisation. (Business rule to be confirmed.)', kind='Integration')
C('RSE-041', U4, A, 'Executive Dashboards for the role', SE, st('Open Executive Dashboards'), MATRIX, 'The dashboards open without errors and the figures follow the same data scope as the modules.', 'Medium', 'Functional')

OVERVIEW = [
    ('Scope', 'Role-based testing of the Sales Executive role: sign-in, side menu, every module against the role\'s permission matrix (page, server, buttons, export), the lead lifecycle the role owns, and which records it sees.'),
    ('Expected access', 'Read from the role\'s permission matrix (Users & Roles) at run time, so the tests follow any change the admin makes.'),
    ('Test data', f'{TD}; the user\'s login is in .env (SALES_USERNAME / SALES_PASSWORD).'),
    ('Automation', 'tests/role-sales-executive/*.spec.ts — run with: npm run test:role-sales-executive'),
    ('Data created', 'One test lead (fictional mobile, example.* email), edited, qualified and converted to one opportunity by the Sales Executive. No other record is created or changed.'),
]
AREA_IMPACT = {'Sign-in': 'The user cannot work or sees the wrong modules.', 'Permissions': 'The role can see or do more (or less) than the business allows.',
               'Lead lifecycle': 'A Sales Executive cannot do his everyday lead work.', 'Data visibility': 'Sales staff see or can change other people\'s deals.'}
write_cases('Role_Sales_Executive_Test_Cases.xlsx', 'Role-based testing: Sales Executive — Test Cases', OVERVIEW, cases, [], {}, AREA_IMPACT)
