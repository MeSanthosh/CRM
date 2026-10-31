"""Adds column N "Feature Known" to the Modules Matrix of the tracking workbook, for EVERY submodule row:
"Known" = the feature was found and used in the app (explored or automated in v2.0);
"Need to check" = not opened / not found yet.
Run from the repo root after update_testing_status.py:  python scripts/mark_known_features.py
"""
import os
from copy import copy
from openpyxl import load_workbook
from openpyxl.styles import Alignment, Font, PatternFill

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FILE = os.path.join(ROOT, 'Testing status', 'ASQUAREAB_CRM_Testing_Tracking_Matrix_v2.xlsx')
NEED = {
    # Executive dashboards
    'Monthly Sales & Marketing Analytics Report', 'Lead & Customer Insights Dashboard',
    # Tasks & activities
    'Recent Operational Activity Stream',              # not found in v2.0
    # Leads (Insights → Aging / Follow-up exist but are not tested yet)
    'Lead Aging & Stalled Lead Analytics', 'Lead Follow-up Tracking Workspace',
    # Proposals
    'Agreed Pack & Proposal Document Generation', 'Conversion to Reservation',
    # Reservations
    'Token Deposit Collection & Receipting', 'Reservation Expiry & Extension Engine',
    # Contracts
    'Contract Termination & Default Management',
    # Customers & brokers
    'Broker Portal Credentials Management', 'Broker Commission Plans & Deal Attribution',
    # Inventory
    'Buildings & Blocks Configuration', 'Unit Quick Info Modal',
    # Marketing (module not opened yet)
    'Project Launches Master Register', 'Expression of Interest (EOI) Management', 'Launch Day Priority Queue & Unit Allocation',
    'Marketing Campaign Performance Tracking', 'Channels & Target Markets Insights',
    # Construction updates, service requests, collections (modules not opened yet)
    'Construction Updates Master Register', 'Site Photo Gallery & Inspection Media', 'Customer Portal Publication Workflow',
    'Service Requests Ticketing Queue', 'Ticket Creation & Customer Linking', 'Ticket Lifecycle & Staff Assignment',
    'Attachment & Inspection Documentation', 'Service Request Timeline & Audit Trail',
    'Commercial Collections Dashboard', 'Amount Due & Instalment Schedules', 'Amount Received & Receipts Register',
    'Outstanding Balances & Overdue Aging', 'Payment Reminders & Automated Alerts',
    # Reports
    'Multi-Format Data Export Center',
    # Settings: currency, business rules, reference data, preferences (not opened yet)
    'Currency Master Register', 'Multi-Currency Policy & Revaluation Rules', 'Exchange Rates & FX Provider Integration',
    'Lead Duplicate Matching Engine Rules', 'Lead Scoring Engine Configuration', 'Lead Qualification & Rating Thresholds',
    'Customer Creation Business Policy', 'Unit Hold Policy & Expiry Timers', '2-Layer Pricing Matrix Rules Engine',
    'Discount Approval Hierarchy & Ceilings', 'Date of Birth & Age Compliance Policy', 'Communication Gateways Configuration',
    'PII Protection & Data Masking Policy',
    'Hierarchical Reference Category Taxonomy', 'Product Types & Architectural Series Reference', 'Unit Views, Positions & Orientations Reference',
    'Lead Sources & Marketing Channels Reference', 'Deal Loss & Reservation Cancellation Reasons', 'Payment Plan Archetypes & Milestones Reference',
    'Buyer Types, Document Types & Nationalities',
    'Application Defaults & Navigation Layout', 'Time, Date & Regional Locale Settings', 'Organization Branding & Company Profile',
    'Notification Delivery & Email SMTP Setup', 'Analytics Cache & Data Snapshots Operations',
}
wb = load_workbook(FILE)
ws = wb['Modules Matrix']
COL = 14
h = ws.cell(3, COL, 'Feature Known')
src = ws.cell(3, 12)
h.font, h.fill, h.alignment, h.border = copy(src.font), copy(src.fill), copy(src.alignment), copy(src.border)
ws.column_dimensions['N'].width = 15
known = need = 0
for r in range(4, ws.max_row + 1):
    sub = ws.cell(r, 4).value
    if not sub:
        continue
    val = 'Need to check' if sub in NEED else 'Known'
    c = ws.cell(r, COL, val)
    base = ws.cell(r, 12)
    c.border = copy(base.border)
    c.alignment = Alignment(horizontal='center', vertical='top')
    c.font = Font(name=base.font.name, size=base.font.sz, bold=val != 'Known', color='9C5700' if val != 'Known' else '006100')
    c.fill = PatternFill('solid', fgColor='FFEB9C' if val != 'Known' else 'C6EFCE')
    known += val == 'Known'
    need += val != 'Known'
missing = sorted(NEED - {ws.cell(r, 4).value for r in range(4, ws.max_row + 1)})
assert not missing, f'names not in the sheet: {missing}'
wb.save(FILE)
print(f'Known: {known}, Need to check: {need}')
