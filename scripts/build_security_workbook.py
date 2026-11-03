"""Builds Testcase/Security_Test_Cases.xlsx — human-readable test cases for login, sessions, RBAC,
passwords, PII masking and the security audit. Run from the repo root:  python scripts/build_security_workbook.py
"""
import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from security_impacts import IMPACT

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
TD = 'TestData/Security_Test_Data.xlsx'
LOGIN = 'Open the sign-in page in a new (signed-out) browser'
ADMIN = 'Signed in as CRM Administrator in another browser'
NEWUSER = 'A test user created by the test from Test Users (role from the sheet)'

def st(*s):
    return '\n'.join(f'{i}. {x}' for i, x in enumerate(s, 1))

cases = []
def C(id, area, title, pre, steps, data, exp, pri='High', kind='Positive', auto='Automated'):
    cases.append([id, area, title, pre, steps, data, exp, pri, kind, auto, IMPACT.get(id, '')])

A = 'User Login & Session Management'
C('SEC-001', A, 'Signed-out visitor is asked to sign in', 'Not signed in', st('Open each protected page of Settings → Protected Routes in a new browser'), f'{TD} → Settings (Protected Routes)',
  'Every page sends the visitor to the sign-in page; no data is shown.')
C('SEC-002', A, 'Sign-in page offers password and OTP login', 'Not signed in', st(LOGIN), f'{TD} → Messages (Lockout Hint)',
  'The page shows "Password Login" and "OTP Login", the Username / Email / Mobile and Password fields, "Forgot password?" and the lockout hint.', 'Medium')
C('SEC-003', A, 'Empty sign-in is refused', 'Not signed in', st(LOGIN, 'Click Login with both fields empty'), f'{TD} → Messages (Login Empty)',
  'Message "Enter your username, email, or mobile number with country code."; the visitor stays on the sign-in page.', 'Medium', 'Negative')
C('SEC-004', A, 'Password is hidden until "Show" is clicked', 'Not signed in', st(LOGIN, 'Type a password', 'Click Show', 'Click Hide'), f'{TD} → Settings (Password Pattern)',
  'The password field is masked; Show reveals it as text; clicking again hides it.', 'Medium')
C('SEC-005', A, 'Unknown login ID gets the generic message', 'Not signed in', st(LOGIN, 'Sign in with a login ID that does not exist'), f'{TD} → Settings (Unknown User Pattern), Messages (Invalid Login)',
  '"Invalid login ID or password" — the same text as for a wrong password, so it does not reveal whether the user exists.', kind='Negative')
C('SEC-006', A, 'Wrong password gets the same generic message', NEWUSER, st(LOGIN, 'Sign in with the user\'s login ID and a wrong password'), f'{TD} → Settings (Wrong Password Pattern), Messages',
  '"Invalid login ID or password"; the user stays on the sign-in page.', kind='Negative')
C('SEC-007', A, 'Valid sign-in opens the CRM with the user\'s name and role', NEWUSER, st(LOGIN, 'Sign in with the username and password (complete the first-time password change)', 'Read the user menu'), f'{TD} → Test Users',
  'The CRM opens; the user menu shows the user\'s full name and primary role.')
C('SEC-008', A, 'Sign in with the email address', NEWUSER, st(LOGIN, 'Sign in with the user\'s email and password'), f'{TD} → Test Users',
  'The CRM opens for the same user.', 'Medium')
C('SEC-009', A, 'Sign in with the mobile number', NEWUSER, st(LOGIN, 'Sign in with the user\'s mobile number (with country code) and password'), f'{TD} → Test Users',
  'The CRM opens for the same user.', 'Medium')
C('SEC-010', A, 'Log Out ends the session', NEWUSER + ', signed in', st('Open the user menu and click Log Out', 'Open a protected page'), '—',
  'After Log Out the sign-in page is shown; opening a protected page asks to sign in again.')
C('SEC-011', A, 'My Profile lists the signed-in devices', NEWUSER + ', signed in on two browsers', st('In browser B open the user menu → My Profile', 'Read "Signed-in devices"'), '—',
  'Both sessions are listed (browser, app, sign-in time); the current one is marked "This device".', 'Medium')
C('SEC-012', A, 'Sign out other devices', NEWUSER + ', signed in on two browsers', st('In browser B: My Profile → Sign out other devices → confirm', 'Use browser A', 'Use browser B'), f'{TD} → Messages (Sign Out Others)',
  'A confirmation "Sign out other devices?" appears; afterwards browser A is sent to the sign-in page and browser B stays signed in.')
C('SEC-013', A, 'Admin signs a user out of all devices', NEWUSER + ', signed in; ' + ADMIN, st('Admin: Users & Roles → open the user → Sign out all devices', 'Use the user\'s browser'), '—',
  'The user\'s browser is sent to the sign-in page at the next action.')
C('SEC-014', A, 'Security policy is set as agreed', ADMIN, st('Open Preferences → Security', 'Read the policy values'), f'{TD} → Security Policy',
  'Session Timeout = 60 minutes, Max Failed Login Attempts = 5, lock interval = 15 minutes; MFA / OTP enforcement is shown as planned and cannot be switched on yet.', 'Medium')
C('SEC-015', A, 'OTP login asks for a code first', 'Not signed in', st(LOGIN, 'Choose OTP Login', 'Enter an email and click "Login with OTP" without a code'), f'{TD} → Messages (OTP Send First)',
  'The form has Email / Mobile, Code (6 digits) and "Send code"; without a code it says "Tap Send code first, then enter the code you receive."', 'Medium', 'Negative')
C('SEC-016', A, 'OTP login with a received code', 'A test user with a reachable email or mobile', st(LOGIN, 'OTP Login → enter the email → Send code', 'Enter the code received', 'Click Login with OTP'), '—',
  'The CRM opens; the Login activity shows "OTP login · Success".', 'Medium', auto='Manual (needs the code from email / SMS)')
C('SEC-017', A, 'Wrong passwords lock the account', NEWUSER, st(LOGIN, 'Enter a wrong password as many times as Max Failed Login Attempts', 'Then sign in with the right password'), f'{TD} → Security Policy, Messages (Locked)',
  'Up to the limit: "Invalid login ID or password"; at the limit: "Too many wrong passwords. Try again after <time>, or sign in with OTP…"; the right password is refused while locked; <time> is the lock interval after the lock.', kind='Negative')
C('SEC-018', A, 'Inactive session expires after the timeout', NEWUSER + ', signed in', st('Leave the browser idle for longer than Session Timeout', 'Click any page'), f'{TD} → Security Policy',
  'The user is asked to sign in again.', 'Medium', auto='Manual (60-minute wait)')

A = 'Role-Based Access Control & Permissions'
C('SEC-021', A, 'Users & Roles cards match the register', ADMIN, st('Open Users & Roles', 'Read the cards Users, Active Users, Roles, Login Disabled', 'Filter the register by Status and read the totals; open Roles & Permissions'), '—',
  'Users = users listed (All), Active Users = users with status Active, Login Disabled = users with login Disabled, Roles = roles listed.')
C('SEC-022', A, 'Every role has the full permission matrix', ADMIN, st('Open Roles & Permissions', 'Open each role'), f'{TD} → Module Routes',
  'Each role shows a matrix of permissions × View / Create / Update / Delete / Approve / Export containing every permission of Module Routes.', 'Medium')
C('SEC-023', A, 'A username can be used only once', ADMIN, st('Create a test user', 'Create another user with the same username'), f'{TD} → Test Users, Messages (Duplicate User)',
  'The second user is refused with a duplicate username/email message; only one user exists.', kind='Negative')
C('SEC-024', A, 'New user\'s initial password follows the password policy', ADMIN, st('New User: fill the test user, Initial Password = a 3-character password', 'Click Create User'), f'{TD} → Messages (Rule Error)',
  'The user is not created; the password rule (8+ characters, a letter and a number) is shown.', kind='Negative')
C('SEC-025', A, 'New user signs in with the assigned role', ADMIN, st('Create the test user and assign the primary role', 'Sign in as the user (first-time change)', 'Read the user menu'), f'{TD} → Test Users',
  'The user menu shows the user\'s name and the assigned role.')
C('SEC-026', A, 'Sales executive cannot open the Audit Log', NEWUSER + ' (Sales Executive)', st('Sign in as the user', 'Open the Audit Log address'), f'{TD} → Messages (Audit No Access)',
  '"You do not have access to the audit log." and no audit rows.', kind='Negative')
C('SEC-027', A, 'Sales executive cannot manage users and roles', NEWUSER + ' (Sales Executive)', st('Sign in as the user', 'Open the Users & Roles address'), f'{TD} → Messages (No Access Pattern)',
  'Access is refused (no-access message); the New User / New Role buttons are not offered.', kind='Negative')
C('SEC-028', A, 'Sales executive cannot open organisation preferences', NEWUSER + ' (Sales Executive)', st('Sign in as the user', 'Open the Preferences address'), f'{TD} → Messages (No Access Pattern)',
  'Access is refused; the Security policy and SMTP settings are not shown.', kind='Negative')
C('SEC-029', A, 'Custom role: the menu shows only permitted modules', 'Test role with the "Base" permissions; a user with that role', st('Admin: set the test role\'s matrix to the Base rows', 'Sign in as the role\'s user', 'Read the main menu'), f'{TD} → Test Role Permissions (Base), Module Routes',
  'The menu lists exactly the modules that have View permission.')
C('SEC-030', A, 'Custom role: pages without View permission are refused', 'Same as SEC-029', st('Open the address of each module without View permission'), f'{TD} → Module Routes',
  'Each such page is refused (no-access message or redirect); permitted pages open.', kind='Negative')
C('SEC-031', A, 'Custom role without Create cannot create leads', 'Same as SEC-029', st('Open Leads'), f'{TD} → Test Role Permissions (Base)',
  'The Individual / Corporate create buttons are not offered.', kind='Negative')
C('SEC-032', A, 'Granting a permission takes effect at the next sign-in', 'Same as SEC-029', st('Admin: tick the Grant rows in the test role\'s matrix and save', 'Sign in again as the role\'s user', 'Read the menu and the Leads create buttons'), f'{TD} → Test Role Permissions (Grant)',
  'The menu now includes the granted modules and the Leads create buttons are offered.')
C('SEC-033', A, 'Disable Login blocks sign-in; Enable restores it', NEWUSER + '; ' + ADMIN, st('Admin: open the user → Disable Login', 'Try to sign in as the user', 'Admin: Enable Login', 'Sign in again'), '—',
  'While disabled the sign-in is refused; after enabling it works. The Login Disabled card counts the user while disabled.')
C('SEC-034', A, 'Inactive users cannot sign in', NEWUSER + '; ' + ADMIN, st('Admin: set the user\'s Status to Inactive and update', 'Try to sign in', 'Admin: set Status back to Active', 'Sign in again'), '—',
  'Sign-in is refused while Inactive and works again when Active.', kind='Negative')

A = 'Password Management & Admin Reset'
C('SEC-041', A, 'Change Password form shows the rule', NEWUSER + ', signed in', st('User menu → Change Password'), f'{TD} → Messages (Password Rule)',
  'The form shows "At least 8 characters, with at least one letter and one number.", Current / New / Confirm New Password (hidden) and "Show passwords" reveals them.', 'Medium')
C('SEC-042', A, 'New password must follow the rules', NEWUSER + ', signed in', st('User menu → Change Password', 'Enter the row\'s current / new / confirm values', 'Click Change Password'), f'{TD} → Password Rules (one run per row)',
  'The row\'s message is shown under the field and the password is not changed.', kind='Negative')
C('SEC-043', A, 'Change password: new password works, old one does not', NEWUSER + ', signed in', st('User menu → Change Password with a valid new password', 'Sign out', 'Sign in with the old password', 'Sign in with the new password'), f'{TD} → Settings (Password Pattern)',
  'The old password is refused; the new one signs in.')
C('SEC-044', A, 'Admin reset offers a generated temporary password', NEWUSER + '; ' + ADMIN, st('Admin: open the user → Reset Password', 'Read the generated password', 'Click Regenerate'), f'{TD} → Messages (Reset Forced Note)',
  '"Auto-generate Temporary Password" is selected and a password is shown; Regenerate shows a different one; the note says the user must change it at next login. (Cancel — nothing is reset.)', 'Medium')
C('SEC-045', A, 'Admin reset with a custom password forces a change at next sign-in', NEWUSER + '; ' + ADMIN, st('Admin: Reset Password → Set Custom Password → Confirm', 'Sign in as the user with that password'), f'{TD} → Messages (Forced Change Note)',
  'A Change Password dialog appears with "Your password was set by an administrator…"; it offers only Change Password and Log Out; after changing, the CRM opens and the reset password no longer works.')
C('SEC-046', A, 'Admin reset unlocks a locked account', 'A test user locked by wrong passwords; ' + ADMIN, st('Lock the user with wrong passwords', 'Admin: Reset Password (custom)', 'Sign in with the new password'), '—',
  'The user can sign in straight away (with the forced change) without waiting for the lock to end.')
C('SEC-047', A, 'Forgot password shows the reset form', 'Not signed in', st(LOGIN, 'Click "Forgot password?"'), '—',
  'The form asks for Email / Mobile, Send code, Code, New password and Confirm new password, with "Back to sign in".', 'Medium')
C('SEC-048', A, 'Reset a forgotten password with the code', 'A test user with a reachable email or mobile', st('Forgot password → enter email → Send code', 'Enter the code and a new password'), '—',
  'The password is changed; Login activity shows "Reset code requested", "Reset code checked" and "Password reset".', 'Medium', auto='Manual (needs the code from email / SMS)')

A = 'PII Data Protection & Field Masking'
C('SEC-061', A, 'Leads list masks personal data by role', NEWUSER + ' (one per role of Role Masking)', st('Sign in as the role\'s user', 'Open Leads', 'Read the name, phone and email of the first leads'), f'{TD} → Role Masking (one run per role), Masking Checks',
  'Roles marked "Yes" see names, phones and emails partly hidden with •; roles marked "No" see them in full.')
C('SEC-062', A, 'Customers list masks personal data by role', NEWUSER + ' (one per role of Role Masking)', st('Sign in as the role\'s user', 'Open Customers & Brokers', 'Read customer, phone and email'), f'{TD} → Role Masking (one run per role), Masking Checks',
  'Same rule as SEC-061 for the customer register.')
C('SEC-063', A, 'Masked values belong to the same records the administrator sees', NEWUSER + ' (Sales Executive); ' + ADMIN, st('Read the first lead as the user and as the admin'), '—',
  'Same Lead No.; the masked name / phone / email keep the first characters of the admin\'s full values.')
C('SEC-064', A, 'Lead Detail masks personal data for masked roles', NEWUSER + ' (Sales Executive)', st('Sign in as the user', 'Open the first lead'), '—',
  'Name, phone and email in the Lead Detail are masked.', 'Medium')
C('SEC-065', A, 'Login activity masks login IDs', ADMIN, st('Open Audit Log → Login activity', 'Read the Login ID column'), f'{TD} → Settings (Login ID Visible Characters)',
  'Each Login ID shows only its first characters followed by •.', 'Medium')

A = 'Login Activity & Security Audit'
C('SEC-071', A, 'Successful sign-in is recorded', NEWUSER + ' signs in; ' + ADMIN, st('Admin: Audit Log → Login activity, search the user'), f'{TD} → Audit Events (Login Success), Settings (App Channel)',
  'A row "Password login · Success" for the user, today, with the masked login ID and app "CRM · WEB".')
C('SEC-072', A, 'Failed sign-in is recorded with the reason', NEWUSER + ' enters a wrong password; ' + ADMIN, st('Admin: Login activity, search the user'), f'{TD} → Audit Events (Login Failed)',
  'A row "Password login · Failed · INVALID_CREDENTIALS" for the user.')
C('SEC-073', A, 'Sign-in with an unknown login ID is recorded', ADMIN, st('Sign in with a login ID that does not exist', 'Admin: Login activity'), f'{TD} → Settings (Unknown User Label), Audit Events',
  'A failed "Password login" row with User = "Unknown" and the masked login ID.', 'Medium')
C('SEC-074', A, 'Account lock is recorded', 'SEC-017 done; ' + ADMIN, st('Admin: Login activity, search the locked user'), f'{TD} → Audit Events (Login Locked)',
  'Rows "Password login · Failed · ACCOUNT_LOCKED" for the attempts made while locked.')
C('SEC-075', A, 'Password changes are recorded', NEWUSER + ' changes the password (once with a wrong current password); ' + ADMIN, st('Admin: Login activity, search the user'), f'{TD} → Audit Events (Password Changed, Password Change Failed)',
  '"Password changed · Success" and "Password changed · Failed · CURRENT_PASSWORD_INVALID" rows.')
C('SEC-076', A, 'Admin password reset is recorded', 'SEC-045 done; ' + ADMIN, st('Admin: Login activity, search the user'), f'{TD} → Audit Events (Password Reset)',
  'A "Password reset" row for the user.', 'Medium')
C('SEC-077', A, 'Login activity filters narrow the rows', ADMIN, st('Login activity: choose each Event, each Result and the CRM app', 'Search a user\'s name'), '—',
  'Every row shown matches the chosen event / result / app / name.', 'Medium')
C('SEC-078', A, 'Record changes filters narrow the rows', ADMIN, st('Record changes: choose each record type and action'), '—',
  'Every row shown has the chosen record type and action.', 'Medium')
C('SEC-079', A, 'Session sign-outs are shown with a readable event name', 'SEC-012 done; ' + ADMIN, st('Admin: Login activity, search the user'), '—',
  'The sign-out of other devices is listed with a readable event name (not an internal code such as "SESSION_REVOKED").', 'Low')

FINDINGS = [
    ['F-01', 'Defect', 'SEC-024', 'New user accepts a password that breaks the policy', 'Users & Roles → New User created a user with the 3-character password "abc"; the user can sign in with it (a forced change follows).', 'Initial password must follow the policy (8+ characters, a letter and a number).', 'High'],
    ['F-02', 'Defect (to confirm)', 'SEC-027', 'Sales executive can open Users & Roles', 'The page opens with the cards, filters and the New User button (the list is empty).', 'Access refused like the Audit Log.', 'High'],
    ['F-03', 'Defect (to confirm)', 'SEC-028', 'Sales executive can read organisation preferences', 'Preferences opens with Security policy and SMTP settings for a Sales Executive.', 'Access refused for roles without Configuration permission.', 'High'],
    ['F-04', 'Observation', 'SEC-045', 'Dashboard data visible behind the forced password change', 'After an admin reset, the first sign-in shows the dashboard figures behind the Change Password dialog.', 'Do not load data until the password is changed.', 'Medium'],
    ['F-05', 'Observation', 'SEC-079', 'Raw event code in Login activity', 'Sign out other devices is listed as "SESSION_REVOKED".', 'Readable label, e.g. "Signed out of other devices".', 'Low'],
    ['F-06', 'Observation', 'SEC-024', 'New User saves without any message', 'Create User with empty fields or with a short password closes / stays without a message.', 'Show which fields are missing or invalid.', 'Medium'],
    ['F-07', 'Observation', 'SEC-017', 'Sign-in rate limit applies to the whole network', 'After many sign-in attempts from one machine, QA answers "Too many authentication attempts. Please wait and try again." to every account, including the administrator.', 'Confirm the limit is per IP by design; a few wrong passwords on one account should not lock other users (incl. admins) out.', 'Medium'],
    ['F-08', 'Defect (to confirm)', 'SEC-076', 'Admin password reset is not identifiable in Login activity', 'An administrator\'s Reset Password is logged only as "Password changed" under the user\'s own name; no "Password reset" event and nothing shows who reset it.', 'Log the reset as "Password reset" with the administrator who did it.', 'Medium'],
    ['F-09', 'Defect', 'SEC-029, SEC-030, SEC-031', 'Custom role permissions are not enforced in the UI', 'A user with a role whose saved matrix holds only DASHBOARD View and LEADS View sees all 15 main menus, opens every module page (no message) and gets the New Individual / New Corporate lead buttons. Pages without View permission open empty (e.g. Customers register with 0 rows), so the data is withheld but the screens are not.', 'Menu items, pages and action buttons follow the role\'s permission matrix; pages without View show a no-access message.', 'High'],
]
UC = [
    ['User Login & Session Management', ', '.join(c[0] for c in cases if c[1].startswith('User Login'))],
    ['Role-Based Access Control (RBAC) & Permissions', ', '.join(c[0] for c in cases if c[1].startswith('Role-Based'))],
    ['Password Management & Admin Reset', ', '.join(c[0] for c in cases if c[1].startswith('Password'))],
    ['PII Data Protection & Field Masking', ', '.join(c[0] for c in cases if c[1].startswith('PII'))],
    ['Login Activity & Security Audit', ', '.join(c[0] for c in cases if c[1].startswith('Login Activity'))],
]

HEAD = ['TC ID', 'Area', 'Test Case', 'Preconditions', 'Test Steps', 'Test Data', 'Expected Result', 'Priority', 'Type', 'Automation', 'Why It Matters']
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
ov['A1'] = 'Security — Test Cases'
ov['A1'].font = Font(name='Arial', size=14, bold=True, color='12465B')
for i, (k, v) in enumerate([
    ('Scope', 'User Login & Session Management · Role-Based Access Control & Permissions · Password Management & Admin Reset · PII Data Protection & Field Masking · Login Activity & Security Audit'),
    ('Pages', 'Sign-in page (/login), user menu (My Profile, Change Password, Log Out), Users & Roles (/admin), Preferences → Security, Audit Log (/admin/audit-log), Leads and Customers for masking.'),
    ('Test data', f'{TD} (or TestData/csv/Security/*.csv with TEST_DATA_FORMAT=csv). No values are hard-coded in the tests.'),
    ('Automation', 'tests/security/*.spec.ts — run with: npm run test:security'),
    ('Report', 'reports/Security_Test_Report_<date>_<time>.xlsx'),
    ('Data created', 'Each test creates its own user (proper names) and retires it at the end; only the role "Lead Desk Viewer" is created / edited. The admin account and existing QA users are never changed.'),
    ('Manual', 'Cases needing an OTP / reset code from email or SMS, and the 60-minute idle timeout, are marked Manual and reported as Skipped.'),
], start=3):
    ov.cell(row=i, column=1, value=k).font = Font(name='Arial', size=10, bold=True)
    c = ov.cell(row=i, column=2, value=v)
    c.font = Font(name='Arial', size=10)
    c.alignment = Alignment(wrap_text=True, vertical='top')
ov.column_dimensions['A'].width = 14
ov.column_dimensions['B'].width = 120
tc = wb.create_sheet('Test Cases')
sheet(tc, HEAD, cases, [9, 26, 44, 30, 60, 36, 62, 9, 10, 18, 60])
dv = DataValidation(type='list', formula1='"Automated,Manual,Not Automated"', allow_blank=True)
tc.add_data_validation(dv)
sheet(wb.create_sheet('Traceability'), ['Flow', 'Test Cases'], UC, [50, 100])
sheet(wb.create_sheet('Findings'), ['ID', 'Type', 'Test Cases', 'Finding', 'What happens', 'Expected', 'Severity'], FINDINGS, [7, 18, 12, 40, 60, 45, 9])
ids = [c[0] for c in cases]
assert len(ids) == len(set(ids))
out = os.path.join(ROOT, 'Testcase', 'Security_Test_Cases.xlsx')
wb.save(out)
print(out, len(cases), 'cases')
