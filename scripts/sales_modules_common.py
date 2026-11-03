"""Shared pieces of the Inventory, Proposals and SPA / Sales Contracts generators:
writers for TestData/<Module>_Test_Data.xlsx (+ CSV copies) and Testcase/<Module>_Test_Cases.xlsx,
and the deal-chain sheets that the Proposals and Contracts data files both carry.
"""
import csv, os
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
thin = Side(style='thin', color='BFBFBF')
HDR = PatternFill('solid', fgColor='12465B')
EDIT = PatternFill('solid', fgColor='FFF2CC')


def st(*s):
    """Numbered test steps."""
    return '\n'.join(f'{i}. {x}' for i, x in enumerate(s, 1))


def write_testdata(xlsx, csv_dir, title, readme, sheets):
    out = os.path.join(ROOT, 'TestData')
    csv_path = os.path.join(out, 'csv', csv_dir)
    os.makedirs(csv_path, exist_ok=True)
    wb = Workbook()
    ws = wb.active
    ws.title = 'Read Me'
    ws['A1'] = title
    ws['A1'].font = Font(name='Arial', size=14, bold=True, color='12465B')
    for i, t in enumerate(readme, start=3):
        c = ws.cell(row=i, column=1, value=f'• {t}')
        c.font = Font(name='Arial', size=10)
        c.alignment = Alignment(wrap_text=True, vertical='top')
    ws.column_dimensions['A'].width = 130
    for name, (header, rows) in sheets.items():
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
                if not name.endswith('Settings') or c.column == 2:
                    c.fill = EDIT
        s.freeze_panes = 'A2'
        with open(os.path.join(csv_path, f'{name}.csv'), 'w', newline='', encoding='utf-8-sig') as fh:
            w = csv.writer(fh)
            w.writerow(header)
            w.writerows(rows)
    wb.save(os.path.join(out, xlsx))
    print(f'written TestData/{xlsx} and {len(sheets)} CSV files in TestData/csv/{csv_dir}')


HEAD = ['TC ID', 'Use Case', 'Area', 'Test Case', 'Preconditions', 'Test Steps', 'Test Data', 'Expected Result', 'Priority', 'Type', 'Automation', 'Why It Matters']


def _sheet(ws, head, rows, widths):
    ws.append(head)
    for r in rows:
        ws.append(r)
    for j, w in enumerate(widths, 1):
        ws.column_dimensions[ws.cell(row=1, column=j).column_letter].width = w
    for row in ws.iter_rows():
        for c in row:
            hdr = c.row == 1
            c.font = Font(name='Arial', size=10 if hdr else 9, bold=hdr, color='FFFFFF' if hdr else '000000')
            if hdr:
                c.fill = HDR
            c.alignment = Alignment(wrap_text=True, vertical='top')
            c.border = Border(top=thin, bottom=thin, left=thin, right=thin)
    ws.freeze_panes = 'B2'
    ws.auto_filter.ref = ws.dimensions


GENERATED = 'Generated'  # Source of the rows this script writes; any other Source is kept as it is


def write_cases(xlsx, title, overview, cases, findings, impact=None, area_impact=None):
    """cases: rows in HEAD order (without Why It Matters); findings: [ID, Type, Test Cases, Finding, What happens, Expected, Severity].
    impact: TC ID -> what a failure means for the business; area_impact: Area -> default text.
    A workbook that also holds rows of another source (Source column ≠ Generated, e.g. a merged branch) keeps
    those rows and their sheets; only the generated rows and the Overview / Traceability / Findings sheets are rewritten."""
    impact, area_impact = impact or {}, area_impact or {}
    cases = [c + [impact.get(c[0], area_impact.get(c[2], ''))] for c in cases]
    ids = [c[0] for c in cases]
    assert len(ids) == len(set(ids)), 'duplicate TC ID'
    out = os.path.join(ROOT, 'Testcase', xlsx)
    if os.path.exists(out) and _merge_cases(out, title, overview, cases, findings):
        return
    wb = Workbook()
    ov = wb.active
    ov.title = 'Overview'
    ov['A1'] = title
    ov['A1'].font = Font(name='Arial', size=14, bold=True, color='12465B')
    for i, (k, v) in enumerate(overview, start=3):
        ov.cell(row=i, column=1, value=k).font = Font(name='Arial', size=10, bold=True)
        c = ov.cell(row=i, column=2, value=v)
        c.font = Font(name='Arial', size=10)
        c.alignment = Alignment(wrap_text=True, vertical='top')
    ov.column_dimensions['A'].width = 16
    ov.column_dimensions['B'].width = 120
    _sheet(wb.create_sheet('Test Cases'), HEAD, cases, [9, 22, 18, 44, 30, 60, 34, 62, 9, 10, 14, 60])
    uc = {}
    for c in cases:
        uc.setdefault(c[1], []).append(c[0])
    _sheet(wb.create_sheet('Traceability'), ['Use Case / Requirement', 'Test Cases'], [[k, ', '.join(v)] for k, v in uc.items()], [50, 110])
    _sheet(wb.create_sheet('Findings'), ['ID', 'Type', 'Test Cases', 'Finding', 'What happens', 'Expected', 'Severity'], findings, [7, 18, 14, 40, 60, 45, 9])
    wb.save(out)
    print(f'written Testcase/{xlsx}: {len(cases)} cases, {len(findings)} findings')


def _merge_cases(out, title, overview, cases, findings):
    """Rewrites only the generated part of a merged workbook; False when the workbook has no rows of another source."""
    wb = load_workbook(out)
    ws = wb['Test Cases']
    head = [c.value for c in ws[1]]
    if 'Source' not in head:
        return False
    src = head.index('Source') + 1
    if all(ws.cell(row=r, column=src).value in (None, GENERATED) for r in range(2, ws.max_row + 1)):
        return False
    for r in range(ws.max_row, 1, -1):  # bottom up, so row numbers of the kept rows don't move
        if ws.cell(row=r, column=src).value == GENERATED:
            ws.delete_rows(r)
    for h in HEAD:  # a generated column the merged sheet lacks goes on the right
        if h not in head:
            head.append(h)
            c = ws.cell(row=1, column=len(head), value=h)
            c.font, c.fill = Font(name='Arial', size=10, bold=True, color='FFFFFF'), HDR
            c.alignment, c.border = Alignment(wrap_text=True, vertical='top'), Border(top=thin, bottom=thin, left=thin, right=thin)
            ws.column_dimensions[c.column_letter].width = 30
    col = {h: i + 1 for i, h in enumerate(head)}
    for row in cases:
        r = ws.max_row + 1
        for h, v in list(zip(HEAD, row)) + [('Source', GENERATED)]:
            c = ws.cell(row=r, column=col[h], value=v)
            c.font = Font(name='Arial', size=9)
            c.alignment, c.border = Alignment(wrap_text=True, vertical='top'), Border(top=thin, bottom=thin, left=thin, right=thin)
    ws.auto_filter.ref = ws.dimensions
    # generated sheets: Overview first, Traceability and Findings over every row (all sources)
    for name in ('Overview', 'Traceability', 'Findings'):
        if name in wb.sheetnames:
            del wb[name]
    ov = wb.create_sheet('Overview', 0)
    ov['A1'] = title
    ov['A1'].font = Font(name='Arial', size=14, bold=True, color='12465B')
    kept = [r for r in ws.iter_rows(min_row=2, values_only=True) if r[col['Source'] - 1] not in (None, GENERATED)]
    sources = sorted({r[col['Source'] - 1] for r in kept})
    rows = list(overview) + [('Merged', f'{len(kept)} test cases kept from {", ".join(sources)} (their own columns and sheets are unchanged); '
                                         f'{len(cases)} generated by this script (Source = {GENERATED}).')]
    for i, (k, v) in enumerate(rows, start=3):
        ov.cell(row=i, column=1, value=k).font = Font(name='Arial', size=10, bold=True)
        c = ov.cell(row=i, column=2, value=v)
        c.font = Font(name='Arial', size=10)
        c.alignment = Alignment(wrap_text=True, vertical='top')
    ov.column_dimensions['A'].width = 16
    ov.column_dimensions['B'].width = 120
    uc = {}
    for r in ws.iter_rows(min_row=2, values_only=True):
        if r[0]:
            key = r[col['Use Case'] - 1] if 'Use Case' in col and r[col['Use Case'] - 1] else r[col['Area'] - 1] if 'Area' in col else ''
            uc.setdefault(key or '—', []).append(r[0])
    at = wb.sheetnames.index('Test Cases') + 1
    _sheet(wb.create_sheet('Traceability', at), ['Use Case / Requirement', 'Test Cases'], [[k, ', '.join(v)] for k, v in uc.items()], [50, 110])
    _sheet(wb.create_sheet('Findings'), ['ID', 'Type', 'Test Cases', 'Finding', 'What happens', 'Expected', 'Severity'], findings, [7, 18, 14, 40, 60, 45, 9])
    wb.active = 0
    wb.save(out)
    print(f'written Testcase/{os.path.basename(out)}: {len(cases)} generated + {len(kept)} kept cases, {len(findings)} findings')
    return True


# ── Deal chain (Proposals and Contracts) ────────────────────────────────────
# A proposal needs an approved reservation; a reservation needs an opportunity at "Reservation Ready"
# and an available unit. The suites build that chain themselves, on a unit of the test project only.
DEAL_SETTINGS = [
    ['Opportunities Route', '/opportunities', 'Opportunities page'],
    ['Reservations Route', '/reservations', 'Reservations page'],
    ['Customers Route', '/customers', 'Customers & Brokers page (KYC documents)'],
    ['Inventory Route', '/inventory', 'Inventory page (the test project and its units)'],
    ['Test Project Name', 'Coral Bay Residences', 'Project that holds every unit the tests reserve; created once if missing (real projects are never used)'],
    ['Test Project Code Pattern', 'CBR######', 'Code for that project when it has to be created (# = random digit)'],
    ['Test Project Location', 'MALINDI', 'Location of the test project'],
    ['Test Project Currency', 'USD - United States Dollar', 'Currency of the test project'],
    ['Test Project Legal Entity', 'CORAL BAY DEVELOPERS', 'Legal entity of the test project'],
    ['Test Project Description', 'Beachfront residences used for CRM testing', 'Description of the test project'],
    ['Test Project Active Status', 'ACTIVE', 'Status of the test project in the Project Register (an inactive one is not used)'],
    ['Unit Search Placeholder', 'Search unit, project, status', 'Search box of the Unit Register'],
    ['Projects Tab', 'Projects', 'Inventory tab with the Project Register'],
    ['Units Tab', 'Units', 'Inventory tab with the Unit Register'],
    ['New Project Button', 'New Project', 'Opens the New Project form'],
    ['Create Project Button', 'Create Project', 'Saves a new project'],
    ['New Unit Button', 'New Unit', 'Opens the New Unit form'],
    ['Create Unit Button', 'Create Unit', 'Saves a new unit'],
    ['New Reservation Button', 'New Reservation', 'Opens the New Reservation form'],
    ['Choose Unit Button', 'Choose Unit', 'Opens the unit picker'],
    ['New Proposal Button', 'New Proposal', 'Opens the New Proposal form'],
    ['Create Proposal Button', 'Create Proposal', 'Saves the New Proposal form'],
    ['Deposit Percent', '10', 'Reservation deposit the app proposes: this % of the unit price'],
    ['Reservation Ready Stage', 'Reservation Ready', 'Opportunity stage needed before a reservation'],
    ['Reservation Approved Status', 'Approved', 'Reservation status after Approve Reservation'],
    ['Create New Projects', 'No', 'Yes = the tests may create projects (the test project when missing, Inventory project tests); No = never (requested 02 Nov 2026)'],
    ['Create New Units', 'No', 'Yes = every deal / unit test creates a new unit; No = reuse an Available unit of the test project that has no active hold and no other deal in this run'],
    ['Available Status', 'Available', 'Unit Register status of a unit that can be reserved'],
    ['Holds Tab', 'Holds', 'Inventory tab with the unit holds'],
    ['Holds Whose Label', 'Whose holds', 'Holds: first filter'],
    ['Holds Show Label', 'Show', 'Holds: second filter'],
    ['Holds Scope All', 'All', 'Holds: every user'],
    ['Holds Active', 'Active', 'Holds: active holds only'],
]

# Fictional UK mobile range (Ofcom drama numbers +44 7700 900000–900999) and example.* emails: the app sends
# WhatsApp / email confirmations to the buyer, so they must never reach a real person.
def buyers(rows):
    return (['Data ID', 'Title', 'First Name', 'Last Name', 'Mobile', 'Email', 'Lead Source'], rows)


DEAL_STEPS = (['Step', 'Submit Button', 'Field', 'Value'], [
    ['Site Visit', 'Schedule Visit & Continue', 'Visit Type', 'In-person'],
    ['Site Visit', 'Schedule Visit & Continue', 'Visit Date', '{today+1} 10:30'],
    ['Site Visit', 'Schedule Visit & Continue', 'Visit Remarks', 'First visit to the show apartment.'],
    ['Complete Visit', 'Complete Site Visit', 'Visit to complete', '#1'],
    ['Complete Visit', 'Complete Site Visit', 'Visit outcome notes', 'Buyer liked the sea-facing layout and asked for pricing.'],
    ['Reservation Ready', 'Continue to Reservation Ready', 'Negotiation Notes', 'Agreed list price; buyer prefers a sea-facing unit.'],
    ['Reservation', 'Create Reservation', 'Remarks', 'Deposit to be paid by bank transfer.'],
    ['Approve Reservation', 'Approve Reservation', 'Quick notes', 'Deposit proof checked.'],
])

DEAL_FORM_FIELDS = (['Form', 'Field Label', 'Field Name'], [
    ['Project', 'Project Code', 'projectCode'], ['Project', 'Project Name', 'name'], ['Project', 'Location', 'locationCode'],
    ['Project', 'Currency', 'currencyCode'], ['Project', 'Legal Entity', 'legalEntityCode'], ['Project', 'Description', 'description'],
    ['Unit', 'Project', 'projectId'], ['Unit', 'Unit Code', 'unitCode'], ['Unit', 'Unit Name', 'unitName'],
    ['Unit', 'Block', 'blockCode'], ['Unit', 'Floor', 'floorNo'], ['Unit', 'Unit Type', 'unitTypeRefId'], ['Unit', 'Bedrooms', 'bedroomCount'], ['Unit', 'Net Area', 'netArea'],
    ['Unit', 'Gross Area', 'grossArea'], ['Unit', 'Base Price', 'basePrice'], ['Unit', 'Currency', 'currencyCode'], ['Unit', 'Remarks', 'remarks'],
    ['Reservation', 'Opportunity', 'opportunityId'], ['Reservation', 'Deposit', 'reservationAmount'], ['Reservation', 'Remarks', 'remarks'],
    ['Proposal', 'Opportunity', 'opportunityId'], ['Proposal', 'Proposed Price', 'proposedPrice'],
])

DEAL_UNIT = (['Data ID', 'Unit Code', 'Unit Name', 'Block', 'Floor', 'Unit Type', 'Bedrooms', 'Net Area', 'Gross Area', 'Base Price', 'Currency', 'Remarks'], [
    ['DU-01', '{project}-D{seq}', 'Coral Bay Apartment D{seq}', 'Block A', 'Floor 03', 'Apartment', '2', '110', '125', '420000', 'USD - United States Dollar', 'Unit reserved by the deal-chain tests'],
])

DEAL_README = [
    'Deal chain: a proposal needs an approved reservation, which needs an opportunity at Reservation Ready and an available unit. '
    'The suite builds that chain itself: a lead (Buyers sheet + the Leads page data) → qualify (Lead Detail data) → opportunity → site visit → '
    'Reservation Ready → reservation on a NEW unit of the test project (Deal Unit sheet) → approval.',
    'Real Palm Exotica units are never reserved: every deal uses a unit created in the test project named on Deal Settings.',
    'Buyers use the fictional UK mobile range +44 7700 900xxx and example.* emails, because the app sends WhatsApp / email confirmations to the buyer.',
    'Placeholders: # = random digit, {unique} = a number unique to the run, {seq} = 3 random digits shared by a record\'s code and name, '
    '{project} = the test project code, {today+N} = N days from today, {reservation} / {contract} = record numbers.',
]
