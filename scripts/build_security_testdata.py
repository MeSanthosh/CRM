"""Builds TestData/Security_Test_Data.xlsx and TestData/csv/Security/*.csv (same content).
Run from the repo root:  python scripts/build_security_testdata.py
"""
import csv, os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'TestData')
CSV = os.path.join(OUT, 'csv', 'Security')
os.makedirs(CSV, exist_ok=True)
S = {}

S['Settings'] = (['Setting', 'Value', 'What it means'], [
    ['Login Route', '/login', 'Sign-in page'],
    ['Users Route', '/admin', 'Users & Roles'],
    ['Audit Route', '/admin/audit-log', 'Audit Log (Record changes / Login activity)'],
    ['Preferences Route', '/preferences', 'Organisation preferences (Security tab holds the login policy)'],
    ['Password Pattern', 'Coral######Bay', 'Passwords the tests set: every # becomes a random digit (meets the policy: 8+ chars, letters and digits)'],
    ['Wrong Password Pattern', 'Wrong######Pass', 'Passwords used for failed-login tests'],
    ['Unknown User Pattern', 'no.such.user.{unique}', 'Login ID that does not exist'],
    ['Mask Character', '•', 'Character the app uses to hide personal data'],
    ['Login ID Visible Characters', '2', 'Characters of the Login ID shown before the mask in Login activity'],
    ['App Channel', 'CRM · WEB', 'App / channel column of Login activity for the web CRM'],
    ['Unknown User Label', 'Unknown', 'User column of Login activity for a login ID that does not exist'],
    ['Test Role Code', 'LEAD_DESK_VIEWER', 'Role created and maintained by the RBAC tests (no other role is changed)'],
    ['Test Role Name', 'Lead Desk Viewer', 'Name of that role'],
    ['Test Role Description', 'Read-only access to leads for the front desk', 'Description of that role'],
    ['Retire Test Users', 'yes', 'yes = at the end of a test its user is set Inactive with login disabled'],
    ['Protected Routes', '/ | /leads | /customers | /admin | /reports-analytics', 'Pages that must ask a signed-out visitor to sign in'],
    ['Rate Limit Wait Seconds', '60', 'When QA answers "Too many authentication attempts", wait this long before trying again'],
    ['Rate Limit Retries', '8', 'How many times to wait and retry a sign-in that hit the rate limit'],
])

S['Security Policy'] = (['Policy', 'Expected Value', 'Where'], [
    ['Session Timeout (Minutes)', '60', 'Preferences → Security'],
    ['Max Failed Login Attempts', '5', 'Preferences → Security'],
    ['Interval Time For Next Login After Max Failed Attempts (Minutes)', '15', 'Preferences → Security'],
])

S['Messages'] = (['Message Key', 'Expected Text', 'Where it appears'], [
    ['Login Empty', 'Enter your username, email, or mobile number with country code.', 'Login with both fields empty'],
    ['Invalid Login', 'Invalid login ID or password', 'Wrong password or unknown login ID (same text for both)'],
    ['Locked', 'Too many wrong passwords. Try again after', 'Login while the account is locked'],
    ['Locked OTP Hint', 'or sign in with OTP using your mobile number or email.', 'Same message'],
    ['Lockout Hint', 'Too many wrong passwords lock the account for a short time; OTP still works while it is locked.', 'Under the login form'],
    ['Password Rule', 'At least 8 characters, with at least one letter and one number.', 'Change Password form'],
    ['Rule Error', 'The new password must be at least 8 characters and contain at least one letter and one number.', 'New password breaks the rule'],
    ['Mismatch Error', 'The confirmation does not match the new password.', 'Confirm differs from new password'],
    ['Wrong Current Error', 'The current password is not correct.', 'Current password wrong'],
    ['Forced Change Note', 'Your password was set by an administrator. Choose a new password to continue.', 'First login after an admin set the password'],
    ['Reset Forced Note', 'User will be required to change password on their next login.', 'Admin Reset Password form'],
    ['Duplicate User', 'duplicate username/email', 'New User with a username already used'],
    ['Audit No Access', 'You do not have access to the audit log.', 'Audit Log for a user without access'],
    ['No Access Pattern', 'do not have access|not authori[sz]ed|access denied|forbidden|no permission', 'Text that means a page is refused (regular expression)'],
    ['Sign Out Others Title', 'Sign out other devices?', 'Confirmation in My Profile'],
    ['Sign Out Others Button', 'Sign out others', 'Button that confirms it'],
    ['Rate Limited', 'Too many authentication attempts', 'Sign-in refused for every account after many attempts from one network'],
    ['OTP Send First', 'Tap Send code first, then enter the code you receive.', 'OTP login without requesting a code'],
])

S['Audit Events'] = (['Event Key', 'Event', 'Result', 'Detail'], [
    ['Login Success', 'Password login', 'Success', ''],
    ['Login Failed', 'Password login', 'Failed', 'INVALID_CREDENTIALS'],
    ['Login Locked', 'Password login', 'Failed', 'ACCOUNT_LOCKED'],
    ['Password Changed', 'Password changed', 'Success', ''],
    ['Password Change Failed', 'Password changed', 'Failed', 'CURRENT_PASSWORD_INVALID'],
    ['Password Reset', 'Password reset', 'Success', ''],
])

S['Test Users'] = (['Data ID', 'Full Name', 'Username', 'Email', 'Mobile', 'Primary Role', 'Used For'], [
    ['U-SE', 'Kavya Raman', '{first}.{last}{unique}', '{first}.{last}.{unique}@example.com', '+2547########', 'Sales Executive', 'RBAC and PII checks for a sales executive'],
    ['U-SM', 'Arjun Pillai', '{first}.{last}{unique}', '{first}.{last}.{unique}@example.com', '+2547########', 'Sales Manager', 'PII check for a sales manager'],
    ['U-ADM', 'Meera Iyer', '{first}.{last}{unique}', '{first}.{last}.{unique}@example.com', '+2547########', 'CRM Administrator', 'PII check for an administrator'],
    ['U-LOCK', 'Rohan Desai', '{first}.{last}{unique}', '{first}.{last}.{unique}@example.com', '+2547########', 'Sales Executive', 'Wrong-password lockout'],
    ['U-PWD', 'Nisha Kapoor', '{first}.{last}{unique}', '{first}.{last}.{unique}@example.com', '+2547########', 'Sales Executive', 'Change password, admin reset, disable login'],
    ['U-ROLE', 'Vikram Rao', '{first}.{last}{unique}', '{first}.{last}.{unique}@example.com', '+2547########', 'Lead Desk Viewer', 'Custom role permissions'],
    ['U-SESS', 'Ananya Menon', '{first}.{last}{unique}', '{first}.{last}.{unique}@example.com', '+2547########', 'Sales Executive', 'Sessions and devices'],
])

S['Role Masking'] = (['Role', 'Expect PII Masked', 'Note'], [
    ['CRM Administrator', 'No', 'Administrators see full names, phones and emails'],
    ['Sales Executive', 'Yes', 'Observed on 25 Oct 2026'],
    ['Sales Manager', 'Yes', 'Assumption: confirm with the product owner'],
    ['Lead Desk Viewer', 'Yes', 'Assumption: confirm with the product owner'],
])

S['Masking Checks'] = (['Page', 'Route', 'Column', 'Kind'], [
    ['Leads', '/leads', 'Lead', 'name'],
    ['Leads', '/leads', 'Phone / Email', 'phone'],
    ['Leads', '/leads', 'Phone / Email', 'email'],
    ['Customers', '/customers', 'Customer', 'name'],
    ['Customers', '/customers', 'Contact', 'phone'],
    ['Customers', '/customers', 'Contact', 'email'],
])

S['Module Routes'] = (['Permission', 'Menu Label', 'Route'], [
    ['DASHBOARD', 'Home / Dashboard', '/'],
    ['ACTIVITIES', 'Tasks & Calendar', '/activities'],
    ['LEADS', 'Leads', '/leads'],
    ['OPPORTUNITIES', 'Opportunities', '/opportunities'],
    ['RESERVATIONS', 'Reservations', '/reservations'],
    ['PROPOSALS', 'Proposals', '/proposals'],
    ['CONTRACTS', 'SPA / Sales Contracts', '/spa-contracts'],
    ['CUSTOMERS', 'Customers & Brokers', '/customers'],
    ['INVENTORY', 'Inventory', '/inventory'],
    ['BROKERS', 'Brokers & Channels', '/brokers-channels'],
    ['CAMPAIGNS', 'Marketing', '/marketing'],
    ['COMMUNICATIONS', 'Activities & Comm.', '/activities-communication'],
    ['CONSTRUCTION_UPDATES', 'Construction Updates', '/construction-updates'],
    ['SERVICE_REQUESTS', 'Service Requests', '/service-requests'],
    ['REPORTS', 'Reports & Analytics', '/reports-analytics'],
    ['USERS', 'Users & Roles', '/admin'],
    ['AUDIT_LOG', 'Audit Log', '/admin/audit-log'],
    ['CONFIGURATION', 'Preferences', '/preferences'],
])

# Permission matrix of the test role: Y = ticked. Step "Base" is set first; step "Grant" adds rights for the change test.
S['Test Role Permissions'] = (['Step', 'Permission', 'View', 'Create', 'Update', 'Delete', 'Approve', 'Export'], [
    ['Base', 'DASHBOARD', 'Y', '', '', '', '', ''],
    ['Base', 'LEADS', 'Y', '', '', '', '', ''],
    ['Grant', 'LEADS', 'Y', 'Y', '', '', '', ''],
    ['Grant', 'CUSTOMERS', 'Y', '', '', '', '', ''],
])

S['Password Rules'] = (['Case', 'Current', 'New', 'Confirm', 'Expected Message Key'], [
    ['Too short', '{current}', 'Sea12', '{new}', 'Rule Error'],
    ['Letters only', '{current}', 'OnlyLetters', '{new}', 'Rule Error'],
    ['Digits only', '{current}', '12345678', '{new}', 'Rule Error'],
    ['Confirmation differs', '{current}', '{valid}', '{valid2}', 'Mismatch Error'],
    ['Wrong current password', '{wrong}', '{valid}', '{new}', 'Wrong Current Error'],
])

README = [
    'Security test data — read by tests/security at run time. Nothing in the tests is hard-coded: change a value here and the next run uses it.',
    'Default source: this Excel file. Set TEST_DATA_FORMAT=csv to use TestData/csv/Security/<sheet>.csv instead. Rebuild both with: python scripts/build_security_testdata.py',
    'Test Users: each test creates its own user from a row ({first}, {last}, {unique} filled in; # = random digit) and retires it at the end (Inactive, login disabled).',
    'The tests never change the admin account or the existing QA users. Only the role named in Settings (Test Role Code) is created / edited.',
    'Passwords are generated at run time from Password Pattern and are never written to reports or logs.',
    'Password Rules: {current} = the user\'s current password, {new} = same as the New column, {valid}/{valid2} = two valid generated passwords, {wrong} = a wrong password.',
    'Role Masking: whether each role should see personal data masked. Rows marked "Assumption" need confirmation.',
]

thin = Side(style='thin', color='BFBFBF')
HDR = PatternFill('solid', fgColor='12465B')
EDIT = PatternFill('solid', fgColor='FFF2CC')
wb = Workbook()
ws = wb.active
ws.title = 'Read Me'
ws['A1'] = 'Security — Test Data'
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
        s.column_dimensions[c.column_letter].width = min(max(width, 10), 70)
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
wb.save(os.path.join(OUT, 'Security_Test_Data.xlsx'))
print('written TestData/Security_Test_Data.xlsx and', len(S), 'CSV files')
