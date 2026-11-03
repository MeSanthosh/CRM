"""Updates Testing status/ASQUAREAB_CRM_Testing_Tracking_Matrix_v1.xlsx → ..._v2.xlsx (sheet "Modules Matrix"):
  - Tester Name (column L) per module, as agreed by the team lead
  - Execution Status (column H) from the latest automated runs (reports/*.xlsx)
  - a new column "No. of Bugs" (M) = confirmed application defects found for that submodule
  - QA Notes (column K): which suite / report and which defect IDs
Run from the repo root:  python scripts/update_testing_status.py
"""
import os, datetime
from openpyxl import load_workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from copy import copy

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'Testing status', 'ASQUAREAB_CRM_Testing_Tracking_Matrix_v1.xlsx')
OUT = os.path.join(ROOT, 'Testing status', 'ASQUAREAB_CRM_Testing_Tracking_Matrix_v2.xlsx')

# Lookup values exactly as on the Lookup sheet (some carry a trailing space)
PASSED, FAILED, NOT_STARTED, IN_PROGRESS, BLOCKED = 'Passed ', 'Failed', 'Not Started', 'In Progress ', 'Blocked'

# Module (column C) → tester, as given by the team lead (modules not listed keep their current names)
TESTERS = {
    'Lead Management & Acquisition Funnel': 'Santhosh',
    'Opportunity & Pipeline Management': 'Maha',
    'Commercial Quotations & Proposals': 'Santhosh',
    'Reservations & Token Deposits Management': 'Maha',
    'SPA / Sales Contracts (Legal & Commercial)': 'Santhosh',
    'Inventory & 2-Layer Pricing Structure Matrix': 'Santhosh',
    'Marketing Launches, Campaigns & EOIs': 'Santhosh',
    'Tasks, Activities & Interactive Calendar': 'Santhosh',        # "Activities"
    'Omnichannel Communications & Engagement': 'Santhosh',          # menu "Activities & Comm."
    'Construction Updates & Milestone Tracking': 'Maha',
    'Customer Service & After-Sales Requests': 'Sharmila',
    'Business Reports & Analytics Center': 'Sharmila',
}
# Submodule (column D) → tester, where the module holds several owners
SUB_TESTERS = {
    'Broker Register & Master Database': 'Maha',                    # Broker channels
    'Broker Portal Credentials Management': 'Maha',                 # Broker portal
    'Broker Commission Plans & Deal Attribution': 'Maha',
}

LEADS = 'Leads page suite (reports/Leads_Page_Test_Report_2026-10-25_0916.xlsx)'
LDP = 'Lead Detail suite (reports/Lead_Detail_Page_Test_Report_2026-10-25_0928.xlsx)'
SEC = 'Security suite (reports/Security_Test_Report_2026-10-25_1232_readable.xlsx + re-run 1338)'
INV = 'Inventory suite (reports/Inventory_Page_Test_Report_2026-10-25_1557.xlsx)'
PRO = 'Proposals suite (reports/Proposals_Page_Test_Report_2026-10-25_1945_readable.xlsx)'
SPC = 'SPA Contracts suite (reports/SPA_Contracts_Page_Test_Report_2026-10-27_0649_readable.xlsx)'
CHAIN = 'exercised by the deal chain of the Proposals / Contracts suites (no error, stage reached)'
OLD = 'Last automated run 19 Oct 2026 on the build before v2.0; re-run needed on v2.0 2410-03'

# Submodule → (status, bugs, note). Bugs = confirmed application defects only.
RESULTS = {
    # Security & Governance
    'User Login & Session Management': (PASSED, 0, f'{SEC}: SEC-001…017 passed; SEC-016 (OTP code) and SEC-018 (60-min idle) are manual'),
    'Two-Factor Authentication / Login OTP': (NOT_STARTED, 0, 'OTP entry needs the code from email / SMS: manual (SEC-016, SEC-048)'),
    'Role-Based Access Control (RBAC) & Permissions': (FAILED, 5, f'{SEC}: SEC-027 Sales Executive opens Users & Roles (New User offered); SEC-028 opens Preferences; SEC-029 custom role sees all menus; SEC-030 pages without View open; SEC-031 create buttons without Create permission'),
    'Password Management & Admin Reset': (PASSED, 0, f'{SEC}: SEC-041…047 passed (043–046 failed only on a network drop, passed on re-run); SEC-048 manual'),
    'PII Data Protection & Field Masking': (PASSED, 0, f'{SEC}: SEC-061…065 passed. Masking for Sales Manager / custom role assumed — confirm with product owner'),
    'Login Activity & Security Audit': (FAILED, 2, f'{SEC}: SEC-076 admin password reset logged only as "Password changed"; SEC-079 raw event codes SESSION_REVOKED / LOGOUT'),
    # Executive dashboards
    'Commercial / Sales Executive Dashboard': (NOT_STARTED, 0, OLD), 'Monthly Sales & Marketing Analytics Report': (NOT_STARTED, 0, OLD),
    'Executive Operations Dashboard': (NOT_STARTED, 0, OLD), 'Lead & Customer Insights Dashboard': (NOT_STARTED, 0, OLD),
    'Commercial Sales Targets Manager': (NOT_STARTED, 0, 'Not automated (Edit Targets is never clicked by the tests)'),
    'AI Executive Assistant': (NOT_STARTED, 0, 'Not automated (AI Insights is never clicked by the tests)'),
    # Tasks & activities
    'Task Management Register': (PASSED, 0, f'{LDP}: Add task, edit, Mark done / Reopen, Tasks & Calendar list passed'),
    'Interactive Activity Calendar': (PASSED, 0, f'{LDP}: Add meeting (dates, combinations) passed'),
    'Call Logging & Call Outcomes': (FAILED, 2, f'{LDP}: LDP-084.4 duration "12.5" saved as "125"; LDP-086.6 logged call not listed on Tasks & Calendar'),
    'Recent Operational Activity Stream': (BLOCKED, 0, 'Feature not found in v2.0 (Tasks & Calendar, Dashboard and Communications checked on 27 Oct 2026) - confirm with Babu R / product owner what it refers to'),
    # Leads
    'All Leads Master Register': (PASSED, 0, f'{LEADS}: cards, tab counts, list and search passed'),
    'Quick Individual Lead Capture': (PASSED, 0, f'{LEADS}: create Individual (mandatory fields, validations) passed'),
    'Comprehensive Individual Lead Profile': (PASSED, 0, f'{LEADS} + {LDP}: all fields, Lead Detail summary / workflow passed'),
    'Quick Corporate Lead Capture': (PASSED, 0, f'{LEADS}: create Corporate passed'),
    'Comprehensive Corporate / Institutional Lead': (PASSED, 0, f'{LEADS}: Corporate with all fields passed'),
    'My Leads Workspace': (PASSED, 0, f'{LEADS}: My Leads tab count and contents passed'),
    'Unassigned Leads Allocation Queue': (FAILED, 1, f'{LDP}: LDP-047 the current owner can be picked again in Reassign lead'),
    'Lead Qualification Workspace': (FAILED, 3, f'{LEADS}: LP-068 "To Qualify" lists statuses outside its rule; LP-079 To Qualify count not reduced after qualifying. {LDP}: LDP-052.10 qualification checklist items'),
    'Ready to Convert (Lead-to-Opportunity / Customer)': (PASSED, 0, f'{LDP}: Move to Opportunity / convert passed'),
    'Duplicate Lead Detection & Merge / Consolidation': (FAILED, 2, f'{LEADS}: LP-017 / LP-047 duplicate pop-up text differs from the agreed message (Individual / Corporate); merge not automated'),
    'Lead Source & Channel Insights Workspace': (FAILED, 0, 'Lead Insights suite (reports/Lead_Insights_Page_Test_Report_2026-10-27_0453.xlsx): 15 of 16 passed — cards, totals, Qual./Conv. %, drill-down per source, unassigned, refresh, and counts after create / qualify / convert. To confirm with product owner: LSI-008 sources "Broker", "Exhibition", "Google Ads", "Referral Partner" are not Lead Source options (old / duplicate names)'),
    'Lead Aging & Stalled Lead Analytics': (NOT_STARTED, 0, 'Not automated yet'),
    'Lead Follow-up Tracking Workspace': (NOT_STARTED, 0, 'Not automated yet'),
    # Opportunities
    'Opportunity Kanban Pipeline Board': (NOT_STARTED, 0, 'Not automated yet'),
    'Opportunity Table Register': (NOT_STARTED, 0, 'Not automated yet'),
    'Opportunity 360 Detail View': (PASSED, 0, CHAIN),
    'Site Visit Scheduling & Outcomes': (PASSED, 0, f'Schedule / complete site visit {CHAIN}'),
    'Negotiation Notes & Commercial History': (PASSED, 0, f'Negotiation notes → Reservation Ready {CHAIN}'),
    'Direct Unit Hold from Opportunity': (NOT_STARTED, 0, 'Not automated yet'),
    'Mark Opportunity as Lost (Impact Analysis)': (NOT_STARTED, 0, 'Not automated yet'),
    # Proposals
    'Commercial Proposal Register': (FAILED, 0, f'{PRO}: register, search, row = detail. To confirm with product owner: Needs Approval counts Draft proposals (PRO-003/017/023); Proposal Value includes superseded ones (PRO-005)'),
    'Proposal Creation & Dynamic Pricing': (FAILED, 1, f'{PRO}: PRO-016 proposal saved with an empty, "abc" or 0 proposed price'),
    'Discount Management & Approval Matrix': (PASSED, 0, f'{PRO}: PRO-015 discount amount / % calculated correctly; approval limits not automated'),
    'Proposal Approval Workflow': (FAILED, 3, f'{PRO}: PRO-022 Accept offered on a Draft (before approval); PRO-025 Reject sets status "Rejected" though the form says it returns to Draft; PRO-024 / PRO-030 Reject / Replace without a reason give no message'),
    'Agreed Pack & Proposal Document Generation': (NOT_STARTED, 0, 'Document generation not automated (Agreed Pack read in the Contracts suite)'),
    'Conversion to Reservation': (NOT_STARTED, 0, 'Not applicable in v2.0 flow (reservation comes before proposal); not automated'),
    # Reservations
    'Reservation Register': (NOT_STARTED, 0, 'Not automated yet (used as part of the deal chain)'),
    'Reservation Creation & Booking': (PASSED, 0, f'New Reservation on a test unit {CHAIN}'),
    'Commercial Reservation Approval Workflow': (PASSED, 0, f'Approve Reservation (confirmation + approved) {CHAIN}'),
    'Token Deposit Collection & Receipting': (NOT_STARTED, 0, 'Not automated yet'),
    'Reservation Expiry & Extension Engine': (NOT_STARTED, 0, 'Not automated yet'),
    'Cancellation & Refund / Forfeiture Handling': (NOT_STARTED, 0, 'Not automated yet'),
    'ERP Synchronization (Reservation & Deposit)': (NOT_STARTED, 0, 'Approval shows "ERP sync: Waiting to send"; ERP result not verified yet'),
    'Conversion to SPA Contract': (FAILED, 1, f'{SPC}: contract created from an approved reservation; SPC-012 reservations that already have a (signed) contract are offered again'),
    # Contracts
    'SPA Contracts Master Register': (FAILED, 0, f'{SPC}: cards = register, search, export passed. To confirm with product owner: SPC-005 Value card higher than the signed contracts; SPC-016 cards / reservation status not updated 2 min after creating a contract'),
    'Contract Drafting & Commercial Terms': (FAILED, 2, f'{SPC}: SPC-014 value not pre-filled from the accepted proposal and currency defaults to KES; SPC-015 contract created with an empty, "abc" or 0 value (saved as the deposit amount)'),
    'Dynamic Payment Plan Builder & Validator': (PASSED, 0, f'{SPC}: SPC-023…026 deposit, taxes, due-date and 100% rules, save passed'),
    'Buyer KYC Verification Checklist': (PASSED, 0, f'{SPC}: SPC-027 signing needs KYC; passport upload + Verify sets KYC Approved'),
    'Contract Signing & Execution Workflow': (FAILED, 1, f'{SPC}: SPC-028 Sign refused with "Payment Plan Required" although the plan is saved (intermittent: signing worked and the unit became Sold in the 27 Oct 06:25 run)'),
    'ERP Contract Integration & Financial Handoff': (BLOCKED, 0, f'{SPC}: not tested in the final run (needs a signed contract, see Contract Signing). 27 Oct 06:25: after signing ERP became READY by itself; Send to ERP was disabled'),
    'Contract Termination & Default Management': (NOT_STARTED, 0, 'Not automated yet (cancel draft is covered by SPC-034)'),
    # Customers & brokers
    'Customer 360 Profile & KYC Details': (PASSED, 0, f'KYC upload + verify on the customer worked in the {SPC}'),
    # Inventory
    'Project Master Register & Lifecycle Control': (FAILED, 1, f'{INV}: create / search / edit / deactivate passed; IVP-015 duplicate project code message does not say the code exists'),
    'Buildings & Blocks Configuration': (NOT_STARTED, 0, 'Not automated yet'),
    'Product Catalog & Reference Alignment': (FAILED, 1, f'{INV}: create / search / edit passed; IVP-024 duplicate product code gives "Something Went Wrong"'),
    'Unit Register & Multi-Tab Detail View': (FAILED, 2, f'{INV}: create / search / edit / export passed; IVP-034 new unit currency defaults to KES; IVP-035 duplicate unit code message does not say why'),
    'Unit Status & Availability Tracking': (FAILED, 2, f'{INV}: IVP-006 Available card counts a held unit (one more than Availability Summary); IVP-036 "On hold" filter lists an Available unit and duplicates "Onhold"'),
    '2-Layer Unit Pricing Structure Matrix': (PASSED, 0, f'{INV}: IVP-007 / IVP-041 totals match the cards (Recalculate is never clicked)'),
    'Architectural Building View (Elevation Grid)': (PASSED, 0, f'{INV}: IVP-042 status chips add up for every block'),
    'Unit Quick Info Modal': (NOT_STARTED, 0, 'Not automated yet'),
    'Availability Summary & Portfolio GDV Valuation': (PASSED, 0, f'{INV}: IVP-043 totals match the Units card (available count: see Unit Status row)'),
    'Unit Holds & Auto-Release Management': (PASSED, 0, f'{INV}: IVP-044 Active / history filters; auto-release not automated'),
    'Inventory Media & Floor Plans Gallery': (NOT_STARTED, 0, 'Not automated yet'),
    # Reports (older build)
    **{s: (NOT_STARTED, 0, OLD) for s in [
        'Lead Reports & Conversion Analytics', 'Sales Reports & Pipeline Forecasting', 'Inventory Reports & Unsold Stock Valuation',
        'Customer Reports & Demographic Mix', 'Broker Performance Reports', 'Marketing Reports & Campaign ROI', 'Reservation Reports & Deposit Conversion',
        'SPA Contract Reports & ERP Handoff Status', 'Collection & Receivable Aging Reports', 'Operational Exception Reports', 'Multi-Format Data Export Center']},
    # User administration & preferences (Security suite)
    'User Master Register & Staff Management': (FAILED, 1, f'{SEC}: SEC-021 cards = register, SEC-023 duplicate username refused; SEC-024 user created with a 3-character initial password'),
    'Roles & Granular Permissions Matrix': (PASSED, 0, f'{SEC}: SEC-022 every role shows the full matrix; matrix saves. Enforcement defects are counted on the RBAC row'),
    'Password Security & Temporary Credentials': (PASSED, 0, f'{SEC}: SEC-044 / SEC-045 temporary password + forced change passed'),
    'User Login History & Device Telemetry': (FAILED, 0, f'{SEC}: same defects as "Login Activity & Security Audit" (SEC-076, SEC-079), counted there'),
    'Entity Change Audit Trail (Comprehensive)': (PASSED, 0, f'{SEC}: SEC-078 Record changes filters passed'),
    'Security Policies & Session Timeout Rules': (PASSED, 0, f'{SEC}: SEC-014 policy values as agreed (60 min, 5 attempts, 15 min)'),
}


def main():
    wb = load_workbook(SRC)
    ws = wb['Modules Matrix']
    head_row = 3
    # new column M "No. of Bugs", styled like the header / cells of column L
    M = 13
    hdr = ws.cell(head_row, M, 'No. of Bugs')
    src_hdr = ws.cell(head_row, 12)
    hdr.font, hdr.fill, hdr.alignment, hdr.border = copy(src_hdr.font), copy(src_hdr.fill), copy(src_hdr.alignment), copy(src_hdr.border)
    ws.column_dimensions['M'].width = 12
    ws.column_dimensions['K'].width = max(ws.column_dimensions['K'].width or 0, 70)
    filled = {}
    for r in range(head_row + 1, ws.max_row + 1):
        module, sub = ws.cell(r, 3).value, ws.cell(r, 4).value
        if not sub:
            continue
        tester = SUB_TESTERS.get(sub) or TESTERS.get(module)
        if tester:
            ws.cell(r, 12).value = tester
        status, bugs, note = RESULTS.get(sub, (NOT_STARTED, 0, 'Not automated yet'))
        ws.cell(r, 8).value = status
        k = ws.cell(r, 11)
        k.value = note
        k.alignment = Alignment(wrap_text=True, vertical='top')
        c = ws.cell(r, M, bugs)
        base = ws.cell(r, 12)
        c.font, c.border = copy(base.font), copy(base.border)
        c.alignment = Alignment(horizontal='center', vertical='top')
        if bugs:
            c.font = Font(name=base.font.name, size=base.font.sz, bold=True, color='9C0006')
        filled[status] = filled.get(status, 0) + 1
    # total of bugs under the table
    last = ws.max_row
    ws.cell(last + 2, 12, 'Total bugs').font = Font(bold=True)
    ws.cell(last + 2, M, f'=SUM(M{head_row + 1}:M{last})').font = Font(bold=True)
    # Execution Status dropdown (openpyxl cannot keep the original extension list): same list, same cells
    dv = DataValidation(type='list', formula1='Lookup!$B$2:$B$6', allow_blank=True, showErrorMessage=True)
    dv.add(f'H4:H{last}')
    dv.add(f'I4:J{last}')
    ws.add_data_validation(dv)
    # version history line
    vh = wb['Version History']
    n = vh.max_row + 1
    for col, val in enumerate([0.2, 'v2.0 2410-03', 'Execution status, tester names and No. of Bugs updated from the automated runs (Leads, Lead Detail, Security, Inventory, Proposals, SPA Contracts)', 'Santhosh', datetime.datetime(2026, 10, 25)], start=1):
        cell = vh.cell(n, col, val)
        src = vh.cell(n - 1, col)
        cell.font, cell.border, cell.alignment, cell.number_format = copy(src.font), copy(src.border), copy(src.alignment), src.number_format
    wb.save(OUT)
    print('written', OUT)
    print('status counts:', filled)
    print('total bugs:', sum(v[1] for k, v in RESULTS.items()))


if __name__ == '__main__':
    main()
