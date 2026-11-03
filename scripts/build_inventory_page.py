"""Builds the Inventory page suite files:
  TestData/Inventory_Test_Data.xlsx + TestData/csv/Inventory/*.csv  (test data, same content)
  Testcase/Inventory_Page_Test_Cases.xlsx                           (human-readable test cases)
Run from the repo root:  python scripts/build_inventory_page.py
"""
from sales_modules_common import st, write_testdata, write_cases, DEAL_SETTINGS

TD = 'TestData/Inventory_Test_Data.xlsx'
S = {}
S['Settings'] = (['Setting', 'Value', 'What it means'], [
    ['Inventory Route', '/inventory', 'Inventory page'],
    ['Page Title', 'Projects and Units', 'Title of the page'],
    *[r for r in DEAL_SETTINGS if r[0].startswith(('Test Project', 'Create New', 'Holds Whose', 'Holds Show', 'Available Status')) or r[0].endswith(('Tab', 'Button'))],
    ['Active Status', 'ACTIVE', 'Status of a project in use'],
    ['Inactive Status', 'INACTIVE', 'Status after Deactivate'],
    ['New Unit Status', 'Available', 'Status every new unit starts with'],
    ['New Unit Status Note', 'New units always start as Available.', 'Hint under Availability in the New Unit form'],
    ['Default Unit Currency Option', 'Default project currency', 'Currency option a new unit should start with'],
    ['All Statuses Option', 'All Statuses', 'Unit Register status filter: no filter'],
    ['Project Search Placeholder', 'Search project, location', 'Search box of the Project Register'],
    ['Product Search Placeholder', 'Search product code or name', 'Search box of the Unit Product Catalogue'],
    *[r for r in DEAL_SETTINGS if r[0] == 'Unit Search Placeholder'],
    ['Value Tolerance %', '0.5', 'Allowed difference between amounts shown rounded (e.g. 210.48M vs $210M)'],
    ['Never Click', 'Recalculate All', 'Pricing Matrix button "⚡ Recalculate All" (was "Recalculate All Units Live") that re-prices every real unit: the tests never click it'],
    ['Base Rate Note', 'Governed by Business Rules', 'Text of the read-only Matrix Base Rate field in New Product'],
    ['Pricing Total Label', 'Showing', 'Pricing Matrix figure: number of units shown ("Showing 201 units (Total Carpet …)", build 0111-11)'],
    ['Pricing Value Label', 'Operative GDV', 'Pricing Matrix figure: value of the units shown ("Operative GDV: $238,962,480", build 0111-11)'],
    ['Summary Units Word', 'total units', 'Availability Summary line "<project>: N total units across M blocks · K Available ($…)" (build 3110-10)'],
    ['Summary Available Word', 'Available', 'Same line: the number before this word is the available units (compared ignoring case)'],
    ['Building All Chip', 'All', 'Building View status chip with every unit of the block'],
    ['Holds Scope All', 'All', 'Holds: first filter, every user'],
    ['Holds Active', 'Active', 'Holds: second filter, active holds only (also the Status of an active hold)'],
    ['Holds History', 'All (incl. history)', 'Holds: second filter, every hold'],
    ['Hold Time Left Word', 'left', 'Held Until of an active hold ends with "<time> left"'],
    ['Edit Button', 'Edit', 'Row button that opens a project / product for editing'],
    ['Project Update Button', 'Update Project', 'Save button of the Edit Project form'],
    ['Deactivate Button', 'Deactivate', 'Row button that deactivates a project'],
    ['View Button', 'View', 'Row button that opens Product Details'],
    ['Open Button', 'Open', 'Row button that opens a unit'],
    ['Export Button', 'Export', 'Unit Register export'],
    ['Unit Edit Button', 'Edit', 'Unit view: button that switches Identification to edit mode'],
    ['Unit Update Button', 'Update Identification', 'Unit view: save button of Identification'],
    ['Summary Table View', 'Summary Table', 'Availability Summary view button "⊞ Summary Table" (build 0111-11)'],
    ['Stack Plan View', 'Stack Plan', 'Availability Summary view button "🏢 Stack Plan" (replaces the Building View tab)'],
    ['Stack All Chip', 'All', 'Stack Plan status chip with every unit of the project'],
    ['Grand Total Row', 'Grand Total', 'Last row of the Summary Table'],
    ['Summary Total Column', 'Total', 'Summary Table column with every unit of a block'],
    ['Units Available Column', 'Units / Available', 'Product catalogue column "43 / 39" = units of the product / available ones'],
    ['Product Column', 'Product', 'Unit Register column with the product code'],
    ['No Product', '-', 'Product column of a unit without a product'],
    ['Product Files Heading', 'Files for this product', 'Product Details → Floor Plans & Media: list of the product files'],
    ['Unit Files Heading', "This unit's files", 'Unit view → Floor Plans & Media: list of the unit files'],
    ['No Files Text', 'No files yet.', 'Files list before any upload'],
    ['No Tour Text', 'No virtual tour link.', 'Virtual tour before a link is saved'],
    ['Save Link Button', 'Save Link', 'Saves the virtual tour link'],
    ['Upload Button', 'Upload', 'Uploads a media file'],
    ['Media Rule Text', 'JPG, PNG, WEBP, GIF or PDF, up to 20 MB.', 'Hint under the media upload'],
    ['Linked Reservation Label', 'Reservation', 'Unit view → Linked Modules: reservation line'],
    ['No Reservation Text', 'No active reservation', 'Linked Modules of a unit without a reservation'],
    ['Reserved Status', 'Reserved', 'Unit status of a reserved unit'],
    ['Price Floor Label', 'PRICE FLOOR (MIN. PRICE)', 'Unit view → Sales'],
    ['Current Price Label', 'OPERATIVE CURRENT PRICE', 'Unit view → Sales'],
    ['Adjusted Price Label', 'ADJUSTED STANDARD PRICE', 'Unit view → Sales'],
    ['Base Price Label', 'STANDARD BASE PRICE', 'Unit view → Sales: line under it "<carpet> m² × $<rate>/m²"'],
    ['Premium Label', 'Total Premium %', 'Unit view → Sales: Layer 1 total'],
    ['Discount Limit Word', 'Discount Limit', 'Unit view → Sales: "Discount Limit: 3%" under the price floor'],
    ['Active Tier Word', 'Active Tier', 'Unit view → Sales: marks the tier in use'],
])
S['Stack Status'] = (['Chip', 'Letter', 'Summary Column', 'Unit Status'], [
    ['Available', 'A', 'Available', 'Available'],
    ['Held', 'H', 'Held', 'Onhold'],
    ['Reserved', 'R', 'Reserved', 'Reserved'],
    ['Sold', 'S', 'Sold', 'Sold'],
])
S['Product Sections'] = (['Section'], [['Floor Plans & Media'], ['Commercial Profile & Pricing Setup'], ['Standard Room Layout'], ['Specification Defaults'], ['Location Defaults']])
S['Product Detail Fields'] = (['Catalogue Column', 'Detail Caption'], [
    ['Type', 'Type'], ['Beds', 'Bedrooms'], ['Unit size (net)', 'Carpet Area (Net Size)'], ['Base Rate ($/m²)', 'Matrix Base Rate'],
])
S['Unit Sections'] = (['Section'], [['Identification'], ['Configuration'], ['Area Schedule'], ['View & Location'], ['Parking & Storage'], ['Specification'], ['Sales'], ['Floor Plans & Media'], ['Linked Modules']])
S['Unit Identification Fields'] = (['Caption', 'Register Column', 'Compare'], [
    ['Project', 'Project', 'starts with the project code'],
    ['Unit', 'Unit', 'same code'],
    ['Unit Name', 'Unit', 'same name'],
    ['Area', 'Area', 'starts with the net area'],
    ['Price', 'Price', 'same amount'],
    ['Status', 'Status', 'same status'],
])
S['Media Uploads'] = (['Case ID', 'Record', 'File Type', 'Caption', 'File', 'Virtual Tour Link'], [
    ['IVP-049', 'Product', 'Floor plan', 'Floor plan uploaded by the CRM test suite', 'TestData/files/Sample_Passport_Copy.pdf', 'https://example.com/tours/product-{unique}'],
    ['IVP-053', 'Unit', 'Brochure', 'Brochure uploaded by the CRM test suite', 'TestData/files/Sample_Passport_Copy.pdf', 'https://example.com/tours/unit-{unique}'],
])
S['KPI Cards'] = (['Card', 'Equals'], [
    ['Projects', 'Total of the Project Register (pager)'],
    ['Products', 'Total of the Unit Product Catalogue (pager)'],
    ['Units', 'Total of the Unit Register with All Statuses'],
    ['Available', 'Total of the Unit Register filtered to Available'],
    ['Value', 'Pricing Matrix → Operative Portfolio Value'],
])
S['Tabs'] = (['Tab', 'Shows', 'New Button', 'Save Button'], [
    ['Projects', 'Project Register', 'New Project', 'Create Project'],
    ['Products', 'Unit Product Catalogue', 'New Product', 'Save Product'],
    ['Units', 'Unit Register', 'New Unit', 'Create Unit'],
    ['Pricing Matrix', 'Unit Pricing Structure Matrix', '', ''],
    ['Availability Summary', 'Availability Summary & Inventory Valuation (Summary Table, Stack Plan)', '', ''],
    ['Holds', 'Unit Holds', '', ''],
])
S['Projects'] = (['Data ID', 'Project Name', 'Project Code', 'Location', 'Currency', 'Legal Entity', 'Status', 'Description', 'Remarks', 'Edited Location', 'Edited Description'], [
    ['PRJ-01', 'Amani Gardens', 'AMG######', 'KILIFI', 'USD - United States Dollar', 'AMANI GARDENS LTD', 'ACTIVE', 'Garden villas near Kilifi creek', 'Created by the CRM test suite', 'VIPINGO', 'Garden villas and townhouses near Vipingo ridge'],
    ['PRJ-02', 'Baobab Heights', 'BBH######', 'MOMBASA', 'USD - United States Dollar', 'BAOBAB HEIGHTS LTD', 'ACTIVE', 'Apartments with harbour views', 'Created by the CRM test suite', 'NYALI', 'Apartments with harbour and ocean views'],
    ['PRJ-03', 'Mnarani Bay Villas', 'MNB######', 'KILIFI', 'USD - United States Dollar', 'MNARANI BAY LTD', 'ACTIVE', 'Waterfront villas on Mnarani bay', 'Created by the CRM test suite', 'TAKAUNGU', 'Waterfront villas with private jetties'],
])
S['Products'] = (['Data ID', 'Product Code', 'Product Name', 'Unit Type', 'Unit Sub-Type', 'Bedrooms', 'Carpet Area', 'Target Buyer', 'Typical Floor', 'Typical View', 'Buyer Profile', 'Rate Band', 'Remarks', 'Edited Target Buyer'], [
    ['PRD-01', 'CB2A-###', '2 Bedrooms Coral Bay Apartment', 'Apartment', 'Type A', '2', '120', 'Young families', 'Lower floors', 'Garden view', 'End user', 'Base Rate', 'Created by the CRM test suite', 'Young families and first-time buyers'],
    ['PRD-02', 'CB3R-###', '3 Bedrooms Coral Bay Residence', 'Residence', 'Type B', '3', '210', 'Holiday home owners', 'Upper floors', 'Ocean view', 'Investor', 'Premium', 'Created by the CRM test suite', 'Holiday home owners and investors'],
])
S['Units'] = (['Data ID', 'Unit Code', 'Unit Name', 'Block', 'Floor', 'Unit Type', 'Bedrooms', 'Net Area', 'Gross Area', 'Base Price', 'Currency', 'Remarks', 'Edited Remarks'], [
    ['UNT-01', '{project}-A{seq}', 'Coral Bay Apartment A{seq}', 'Block A', 'Floor 01', 'Apartment', '2', '118', '135', '410000', 'USD - United States Dollar', 'Created by the CRM test suite', 'Sea-facing balcony confirmed on site'],
    ['UNT-02', '{project}-B{seq}', 'Coral Bay Residence B{seq}', 'Block B', 'Floor 02', 'Residence', '3', '205', '240', '690000', 'USD - United States Dollar', 'Created by the CRM test suite', 'Corner unit with two balconies'],
])
S['Form Fields'] = (['Form', 'Field Label', 'Field Name', 'Field Type', 'Mandatory'], [
    ['Project', 'Project Code', 'projectCode', 'Text', 'Yes'],
    ['Project', 'Project Name', 'name', 'Text', 'Yes'],
    ['Project', 'Location', 'locationCode', 'Text', 'No'],
    ['Project', 'Currency', 'currencyCode', 'Dropdown', 'No'],
    ['Project', 'Legal Entity', 'legalEntityCode', 'Text', 'No'],
    ['Project', 'Status', 'status', 'Dropdown', 'No'],
    ['Project', 'Description', 'description', 'Text', 'No'],
    ['Project', 'Remarks', 'remarks', 'Text', 'No'],
    ['Product', 'Product Code', 'productCode', 'Text', 'Yes'],
    ['Product', 'Product Name', 'productName', 'Text', 'Yes'],
    ['Product', 'Unit Type', 'unitTypeRefId', 'Dropdown', 'No'],
    ['Product', 'Unit Sub-Type', 'unitSubTypeRefId', 'Dropdown', 'No'],
    ['Product', 'Bedrooms', 'bedroomCount', 'Number', 'No'],
    ['Product', 'Carpet Area', 'carpetArea', 'Number', 'No'],
    ['Product', 'Target Buyer', 'targetBuyer', 'Text', 'No'],
    ['Product', 'Typical Floor', 'typicalFloorLocation', 'Text', 'No'],
    ['Product', 'Typical View', 'typicalView', 'Text', 'No'],
    ['Product', 'Buyer Profile', 'typicalBuyerProfile', 'Text', 'No'],
    ['Product', 'Rate Band', 'targetRateBand', 'Text', 'No'],
    ['Product', 'Remarks', 'remarks', 'Text', 'No'],
    ['Unit', 'Project', 'projectId', 'Dropdown', 'Yes'],
    ['Unit', 'Unit Code', 'unitCode', 'Text', 'Yes'],
    ['Unit', 'Unit Name', 'unitName', 'Text', 'No'],
    ['Unit', 'Block', 'blockCode', 'Dropdown', 'No'],
    ['Unit', 'Floor', 'floorNo', 'Dropdown', 'No'],
    ['Unit', 'Unit Type', 'unitTypeRefId', 'Dropdown', 'No'],
    ['Unit', 'Bedrooms', 'bedroomCount', 'Text', 'No'],
    ['Unit', 'Net Area', 'netArea', 'Text', 'No'],
    ['Unit', 'Gross Area', 'grossArea', 'Text', 'No'],
    ['Unit', 'Base Price', 'basePrice', 'Text', 'No'],
    ['Unit', 'Currency', 'currencyCode', 'Dropdown', 'No'],
    ['Unit', 'Remarks', 'remarks', 'Text', 'No'],
])
S['Invalid Values'] = (['Case ID', 'Form', 'Field Left Empty', 'Expected Message Contains', 'Checked When'], [
    ['IVP-013', 'Project', 'Project Code', 'Project code and name are required.', 'On save'],
    ['IVP-013', 'Project', 'Project Name', 'Project code and name are required.', 'On save'],
    ['IVP-022', 'Product', 'Product Code', 'Product code and product name are required.', 'On save'],
    ['IVP-022', 'Product', 'Product Name', 'Product code and product name are required.', 'On save'],
    ['IVP-032', 'Unit', 'Project', 'Project and unit code are required.', 'On save'],
    ['IVP-032', 'Unit', 'Unit Code', 'Project and unit code are required.', 'On save'],
])
S['Messages'] = (['Message Key', 'Expected Text', 'Where it appears'], [
    ['Project Required Title', 'Required Fields Missing', 'Pop-up when New Project is saved without code or name'],
    ['Project Required Body', 'Project code and name are required.', 'Same pop-up'],
    ['Project Duplicate Title', 'Project Not Saved', 'Pop-up when the project code already exists'],
    ['Duplicate Code', 'already exists', 'Words expected in the message when a product / unit code already exists'],
])
S['Count Changes'] = (['Action', 'Projects', 'Products', 'Units', 'Available', 'Value'], [
    ['Create Project', '1', '0', '0', '0', '0'],
    ['Create Product', '0', '1', '0', '0', '0'],
    ['Create Unit', '0', '0', '1', '1', 'Base Price'],
    ['Deactivate Project', '0', '0', '0', '0', '0'],
])
README = [
    'Test data for the Inventory page suite (tests/inventory-page). Nothing the tests type or expect is written in the code: it is all here.',
    'Default source: this Excel file. Set TEST_DATA_FORMAT=csv to use TestData/csv/Inventory/<sheet>.csv instead. Rebuild both with: python scripts/build_inventory_page.py',
    'Yellow cells can be edited. Keep the column headers as they are.',
    'Projects / Products / Units: records the tests create. # = random digit; {seq} = 3 random digits shared by a record\'s code and name; {project} = the test project code.',
    'Units are created only in the test project (Settings → Test Project Name). Projects created by the tests are deactivated at the end of their test. Products cannot be deleted in the app, so a run creates one product per product test.',
    'Count Changes: expected change of each KPI card after an action ("Base Price" = the unit\'s base price is added to Value).',
    'The tests never click "Recalculate All Units Live" and never edit or deactivate real projects / units.',
    'Stack Status: Stack Plan chips, the letter on each unit cell, the Summary Table column and the Unit Register status of each.',
    'Product Detail Fields / Unit Identification Fields: which Product Details / unit view value must equal which catalogue / register column.',
    'Media Uploads: virtual tour link ({unique} = a unique number per run) and file added to the test product / test unit only.',
]
write_testdata('Inventory_Test_Data.xlsx', 'Inventory', 'Inventory — Test Data', README, S)

# ── Test cases ───────────────────────────────────────────────────────────────
cases = []
def C(id, uc, area, title, pre, steps, data, exp, pri='High', kind='Positive', auto='Automated'):
    cases.append([id, uc, area, title, pre, steps, data, exp, pri, kind, auto])

OPEN = 'Open Inventory (main menu → Inventory)'
ADMIN = 'Signed in as CRM Administrator'
UC1, UC2, UC3, UC4, UC5 = 'IUC-01 Inventory overview & counts', 'IUC-02 Manage projects', 'IUC-03 Manage unit products', 'IUC-04 Manage units', 'IUC-05 Pricing, availability & holds'

A = 'Page & Counts'
C('IVP-001', UC1, A, 'Inventory page shows its cards and tabs', ADMIN, st(OPEN, 'Read the title, the KPI cards and the tabs'), f'{TD} → KPI Cards, Tabs, Settings (Page Title)',
  'Title "Projects and Units"; cards Projects, Products, Units, Available and Value; tabs Projects, Products, Units, Pricing Matrix, Availability Summary and Holds (Building View is now the Stack Plan of Availability Summary).', 'Medium')
C('IVP-002', UC1, A, 'Projects card = projects in the Project Register', ADMIN, st(OPEN, 'Read the Projects card', 'On the Projects tab read "Showing … of N projects"'), f'{TD} → KPI Cards',
  'The Projects card equals N.')
C('IVP-003', UC1, A, 'Products card = products in the catalogue', ADMIN, st(OPEN, 'Read the Products card', 'Open the Products tab, read "Showing … of N products"'), f'{TD} → KPI Cards',
  'The Products card equals N.')
C('IVP-004', UC1, A, 'Units card = units in the Unit Register', ADMIN, st(OPEN, 'Read the Units card', 'Open the Units tab with All Statuses, read "Showing … of N units"'), f'{TD} → KPI Cards',
  'The Units card equals N.')
C('IVP-005', UC1, A, 'Available card = units with status Available', ADMIN, st(OPEN, 'Read the Available card', 'Units tab → status filter Available, read the total'), f'{TD} → KPI Cards',
  'The Available card equals the number of Available units in the register.')
C('IVP-006', UC1, A, 'Available units agree across Inventory views', ADMIN, st(OPEN, 'Read the Available card', 'Open Availability Summary and read "… N available"'), '—',
  'The Availability Summary shows the same number of available units as the Available card.', kind='Consistency')
C('IVP-007', UC1, A, 'Value card = portfolio value of the Pricing Matrix and the Availability Summary', ADMIN, st(OPEN, 'Read the Value card', 'Pricing Matrix → read Operative GDV', 'Availability Summary → read Total Portfolio GDV'), f'{TD} → Settings (Value Tolerance %)',
  'Both values equal the Value card (within the rounding tolerance).', kind='Consistency')
C('IVP-008', UC1, A, 'Product category chips count the products of each type', ADMIN, st(OPEN, 'Open Products', 'Read the chips (Apartment N, Residence N, Penthouse N)', 'Count the catalogue rows of each type'), '—',
  'Each chip shows the number of products of that type; clicking it lists only that type.', 'Medium')

A = 'Projects'
C('IVP-011', UC2, A, 'New Project form shows its fields', ADMIN, st(OPEN, 'Click New Project'), f'{TD} → Form Fields (Project)',
  'The form "Create Project" shows Project Code, Project Name, Location, Currency, Legal Entity, Status, Description and Remarks; Status offers ACTIVE, INACTIVE, COMPLETED, ON_HOLD.', 'Medium')
C('IVP-012', UC2, A, 'Empty project is not saved', ADMIN, st(OPEN, 'New Project → Create Project without typing anything'), f'{TD} → Messages (Project Required)',
  'Pop-up "Required Fields Missing" — "Project code and name are required."; the project is not created.', kind='Negative')
C('IVP-013', UC2, A, 'Project without code or without name is not saved', ADMIN, st(OPEN, 'New Project → fill every field except the one in the data row', 'Create Project'), f'{TD} → Invalid Values (IVP-013)',
  'Each row: the pop-up from the data row; the form stays open; nothing is created.', kind='Negative')
C('IVP-014', UC2, A, 'Create a project', ADMIN, st(OPEN, 'Read the cards', 'New Project → fill every field from a Projects row', 'Create Project', 'Search the register for the code'), f'{TD} → Projects, Count Changes (Create Project)',
  'The form closes; the register lists the code, name, location, currency and status ACTIVE; cards change as on Count Changes (Projects +1).')
C('IVP-015', UC2, A, 'Duplicate project code is refused', 'A project created by the test', st(OPEN, 'New Project with the same Project Code', 'Create Project'), f'{TD} → Messages (Project Duplicate Title, Duplicate Code)',
  'Pop-up "Project Not Saved" that says the code already exists; the register still has one project with that code.', kind='Negative')
C('IVP-016', UC2, A, 'Search projects by code and by location', 'A project created by the test', st(OPEN, 'Type the project code in "Search project, location"', 'Then type its location'), f'{TD} → Projects',
  'Each search lists the project; every row listed matches the text.', 'Medium')
C('IVP-017', UC2, A, 'Edit a project', 'A project created by the test', st(OPEN, 'Click Edit on the project', 'Change Location and Description (Edited … columns)', 'Update Project', 'Edit again'), f'{TD} → Projects (Edited Location, Edited Description)',
  'The register shows the new location; the Edit form shows the new values.')
C('IVP-018', UC2, A, 'Deactivate a project', 'A project created by the test', st(OPEN, 'Click Deactivate on the project and confirm'), f'{TD} → Settings (Inactive Status), Count Changes (Deactivate Project)',
  'The app asks for confirmation; the project shows status INACTIVE; cards change as on Count Changes.')

A = 'Products'
C('IVP-021', UC3, A, 'New Product form shows its fields', ADMIN, st(OPEN, 'Products → New Product'), f'{TD} → Form Fields (Product)',
  'Product Code * and Product Name * are marked required; Matrix Base Rate is read-only ("Governed by Business Rules"); the other fields are listed.', 'Medium')
C('IVP-022', UC3, A, 'Product without code or name is not saved', ADMIN, st(OPEN, 'Products → New Product', 'Fill the form except the field in the data row', 'Save Product'), f'{TD} → Invalid Values (IVP-022)',
  'Each row: pop-up "Required Fields Missing" — "Product code and product name are required."; the product is not created.', kind='Negative')
C('IVP-023', UC3, A, 'Create a product', ADMIN, st(OPEN, 'Read the cards and the type chips', 'Products → New Product → fill a Products row', 'Save Product', 'Search the catalogue'), f'{TD} → Products, Count Changes (Create Product)',
  'The catalogue lists the code, name and type; Products card +1; the chip of its type +1.')
C('IVP-024', UC3, A, 'Duplicate product code is refused with a clear message', 'A product created by the test', st(OPEN, 'Products → New Product with the same code', 'Save Product'), f'{TD} → Messages (Duplicate Code)',
  'A message says the product code already exists; the catalogue still has one product with that code.', kind='Negative')
C('IVP-025', UC3, A, 'Search the product catalogue', 'A product created by the test', st(OPEN, 'Products → type the code in "Search product code or name"'), f'{TD} → Products',
  'Only matching products are listed, including the new one.', 'Medium')
C('IVP-026', UC3, A, 'Edit a product and view it', 'A product created by the test', st(OPEN, 'Products → Edit on the product', 'Change Target Buyer', 'Save', 'Click View'), f'{TD} → Products (Edited Target Buyer)',
  'Product Details shows the new Target Buyer, the type, bedrooms and carpet area entered.', 'Medium')

A = 'Units'
C('IVP-031', UC4, A, 'New Unit form starts as Available', ADMIN, st(OPEN, 'Units → New Unit'), f'{TD} → Form Fields (Unit), Settings (New Unit Status, New Unit Status Note)',
  'Sections Identification … Linked Modules are listed; Availability shows "Available" (read-only) with "New units always start as Available."', 'Medium')
C('IVP-032', UC4, A, 'Unit without project or code is not saved', ADMIN, st(OPEN, 'Units → New Unit', 'Fill the form except the field in the data row', 'Create Unit'), f'{TD} → Invalid Values (IVP-032)',
  'Each row: pop-up "Required Fields Missing" — "Project and unit code are required."; no unit is created.', kind='Negative')
C('IVP-033', UC4, A, 'Create a unit in the test project', 'The test project exists', st(OPEN, 'Read the cards', 'Units → New Unit → fill a Units row (project = test project)', 'Create Unit', 'Search the Unit Register'), f'{TD} → Units, Count Changes (Create Unit)',
  'The unit is listed with its code, project, type, area, price and status Available; Units +1, Available +1, Value + base price.')
C('IVP-034', UC4, A, 'New unit currency defaults to the project currency', ADMIN, st(OPEN, 'Units → New Unit', 'Read the Currency field before choosing anything'), f'{TD} → Settings (Default Unit Currency Option)',
  'Currency shows "Default project currency" (no other currency is pre-selected).', 'Medium', 'Negative')
C('IVP-035', UC4, A, 'Duplicate unit code is refused with a clear message', 'A unit created by the test', st(OPEN, 'Units → New Unit with the same project and Unit Code', 'Create Unit'), f'{TD} → Messages (Duplicate Code)',
  'A message says the unit code already exists; the register still has one unit with that code.', kind='Negative')
C('IVP-036', UC4, A, 'Unit status filter lists only that status', ADMIN, st(OPEN, 'Units → choose each status of the filter'), '—',
  'Every row listed has the chosen status; the totals of all statuses add up to All Statuses.', 'Medium')
C('IVP-037', UC4, A, 'Search units', 'A unit created by the test', st(OPEN, 'Units → type the unit code in "Search unit, project, status"'), f'{TD} → Units',
  'The unit is listed; every row matches the text.', 'Medium')
C('IVP-038', UC4, A, 'Open a unit and edit it', 'A unit created by the test', st(OPEN, 'Units → Open on the unit', 'Check Identification', 'Edit → change Remarks → Update Identification', 'Open it again'), f'{TD} → Units (Edited Remarks)',
  'The unit view shows the project, code and name entered; after the update the new remarks are shown.', 'Medium')
C('IVP-039', UC4, A, 'Unit Register export matches the register', ADMIN, st(OPEN, 'Units → Export'), '—',
  'The file has one row per unit of the register (same total) and includes the units listed on the first page.', 'Medium')

A = 'Pricing, Availability & Holds'
C('IVP-041', UC5, A, 'Pricing Matrix covers every unit', ADMIN, st(OPEN, 'Pricing Matrix → read "Showing N units"', 'Filter by the test project'), f'{TD} → Settings (Never Click)',
  '"Showing N units" equals the Units card; filtering by a project shows only that project\'s units. "Recalculate All Units Live" is not clicked.', 'Medium', kind='Consistency')
C('IVP-042', UC5, A, 'Stack Plan status chips add up', ADMIN, st(OPEN, 'Availability Summary → for each project with units click Stack Plan', 'Read All (N) and the status chips', 'Read the summary line'), f'{TD} → Stack Status, Settings (Stack Plan View, Stack All Chip)',
  'All (N) = Available + Held + Reserved + Sold; All equals the total units of the summary line and each chip its count there.', 'Medium', kind='Consistency')
C('IVP-043', UC5, A, 'Availability Summary totals match the cards', ADMIN, st(OPEN, 'Availability Summary → read "… N total units"'), '—',
  'Total units equals the Units card.', 'Medium', kind='Consistency')
C('IVP-044', UC5, A, 'Holds list follows its filters', ADMIN, st(OPEN, 'Holds → All → Active', 'Then All (incl. history)'), '—',
  'With "Active" every row has status Active and a time left; the history view lists at least as many holds.', 'Low')
C('IVP-045', UC5, A, 'Summary Table rows add up', ADMIN, st(OPEN, 'Availability Summary → each project with units → Summary Table'), f'{TD} → Stack Status, Settings (Grand Total Row, Summary Total Column)',
  'For every block Available + Held + Reserved + Sold = Total; Grand Total = the sum of the blocks; Grand Total equals the summary line (total units, Available, Reserved, Sold).', 'Medium', kind='Consistency')
C('IVP-046', UC5, A, 'Stack Plan shows every unit of the test project with its status', 'The test project has units', st(OPEN, 'Availability Summary → test project → Stack Plan', 'Read every unit cell (code + status letter)', 'Units → search the project code'), f'{TD} → Stack Status, Settings (Test Project Name)',
  'One cell per unit of the project (count = All chip); each letter count = its chip; every unit of the Unit Register is shown with the letter of its status.', kind='Consistency')

A = 'Product & Unit Details'
UC6 = 'IUC-06 Product and unit details'
C('IVP-047', UC6, A, 'Product Details shows its sections and the catalogue values', ADMIN, st(OPEN, 'Products → View on the first product', 'Read the sections and Commercial Profile & Pricing Setup'), f'{TD} → Product Sections, Product Detail Fields',
  'Sections Floor Plans & Media, Commercial Profile & Pricing Setup, Standard Room Layout, Specification Defaults and Location Defaults; Type, Bedrooms, Carpet Area and Matrix Base Rate equal the catalogue row.', 'Medium')
C('IVP-048', UC6, A, 'Product "Units / Available" = units of the product in the Unit Register', ADMIN, st(OPEN, 'Products → read "Units / Available" of every product', 'Units → count the units of each product and the Available ones'), f'{TD} → Settings (Units Available Column, Product Column)',
  'For every product both numbers equal the Unit Register.', 'Medium', kind='Consistency')
C('IVP-049', UC6, A, 'Add a virtual tour link and a floor plan to a product', 'A product created by the test', st(OPEN, 'Products → View on the product → Floor Plans & Media', 'Save the virtual tour link', 'Upload the floor plan (type, caption, file)', 'Close and View again'), f'{TD} → Media Uploads (IVP-049)',
  'The link is shown instead of "No virtual tour link."; the file is listed under "Files for this product" with its caption; both are still there after re-opening.', 'Medium')
C('IVP-050', UC6, A, 'Unit view lists its sections and Identification matches the register', 'A unit created by the test', st(OPEN, 'Units → Open on the unit', 'Open each section', 'Read Identification'), f'{TD} → Unit Sections, Unit Identification Fields',
  'Sections Identification … Linked Modules are listed and each opens; Project, Unit, Unit Name, Area, Price and Status equal the Unit Register row.', 'Medium')
C('IVP-051', UC6, A, 'Unit price breakdown adds up (Sales section)', 'A unit linked to a product (read only)', st(OPEN, 'Units → Open on the first unit with a product → Sales'), f'{TD} → Settings (… Price Label, Premium Label, Discount Limit Word)',
  'Standard base = carpet × base rate; adjusted = base × (1 + total premium %); price floor = current price × (1 − discount limit); every tier price = adjusted × (1 + tier %) and its floor = tier price × (1 − discount limit). "Recalculate Pricing Matrix" is not clicked.', kind='Consistency')
C('IVP-052', UC6, A, 'Linked Modules shows the unit reservation', 'A reserved unit and an available unit of the test project', st(OPEN, 'Units → Open the reserved unit → Linked Modules', 'Then the available unit'), f'{TD} → Settings (Linked Reservation Label, No Reservation Text)',
  'The reserved unit shows its reservation (not "No active reservation"); the available unit shows "No active reservation".', 'Medium')
C('IVP-053', UC6, A, 'Add a virtual tour link and a file to a unit', 'A unit created by the test', st(OPEN, 'Units → Open the unit → Floor Plans & Media', 'Save the virtual tour link', 'Upload the file (type, caption, file)', 'Close and open again'), f'{TD} → Media Uploads (IVP-053)',
  'The link is shown; the file is listed under "This unit\'s files"; both are still there after re-opening.', 'Medium')

FINDINGS = [
    ['F-01', 'Defect', 'IVP-034', 'New units default to KES', 'New Unit pre-selects "KES - Kenyan Shilling" in Currency instead of "Default project currency"; a unit saved without changing it is priced in KES in a USD project (shown as 3,474.9 USD / 0.45M KES).', 'Start with "Default project currency" (or the project currency).', 'High'],
    ['F-02', 'Defect', 'IVP-024', 'Duplicate product code gives "Something Went Wrong"', 'Saving a product with an existing code shows "Something went wrong on our side… Reference: …".', 'A clear message that the product code already exists.', 'Medium'],
    ['F-03', 'Defect', 'IVP-015, IVP-035', 'Duplicate project / unit code: message does not say why', '"Project could not be saved. Check code and required fields." / "Unit could not be saved. Check project, unit code, and status."', 'Say that the code already exists.', 'Low'],
    ['F-04', 'Defect', 'IVP-006', 'Available count differs between views', 'Available card is one more than the Availability Summary (134 vs 133 on 25 Oct 2026); the held unit PEX-APT-0301 is counted as available by the card only.', 'Same rule in every view (or the difference explained on screen).', 'Medium'],
    ['F-05', 'To confirm', 'IVP-036', 'Unit status filter: "On hold" lists Available units and duplicates "Onhold"', 'Filter "On hold" lists PEX-APT-0301 whose status is Available (held); the status totals add up to one more than All Statuses; "Onhold" and "On hold" are both offered.', 'One option per status; every unit counted once.', 'Low'],
]
OVERVIEW = [
    ('Scope', 'Inventory page (/inventory): KPI cards, Projects, Products (unit product catalogue, Product Details, media), Units (unit view sections, price breakdown, Linked Modules, media), Pricing Matrix, Availability Summary (Summary Table, Stack Plan) and Holds.'),
    ('Use cases', 'IUC-01 overview & counts · IUC-02 manage projects · IUC-03 manage unit products · IUC-04 manage units · IUC-05 pricing, availability & holds · IUC-06 product and unit details'),
    ('Test data', f'{TD} (or TestData/csv/Inventory/*.csv with TEST_DATA_FORMAT=csv). No values are hard-coded in the tests.'),
    ('Automation', 'tests/inventory-page/*.spec.ts — run with: npm run test:inventory-page'),
    ('Report', 'reports/Inventory_Page_Test_Report_<date>_<time>.xlsx'),
    ('Data created', 'Projects (deactivated at the end of their test), products (cannot be deleted in the app) and units in the test project only; a virtual tour link and one sample PDF on the test product and the test unit. Real projects and units are never changed; "Recalculate All Units Live" and "Recalculate Pricing Matrix" are never clicked.'),
    ('Security', 'Out of scope for this module (covered by the Security suite).'),
]
AREA_IMPACT = {
    'Page & Counts': 'The Inventory cards or views show different numbers for the same units, so sales and management work from wrong availability or value figures.',
    'Projects': 'Projects cannot be set up or maintained correctly, so units cannot be added to the right project.',
    'Products': 'The product catalogue (unit types, sizes, base rates) is wrong or cannot be maintained, so new units get wrong defaults.',
    'Units': 'Units cannot be created or maintained correctly, so they cannot be offered, reserved or priced.',
    'Pricing, Availability & Holds': 'Pricing / availability views disagree with the unit register, so salespeople may offer units that are not available or quote wrong values.',
    'Product & Unit Details': 'Product and unit details (sizes, rates, price breakdown, linked reservation, floor plans) are wrong or cannot be kept, so salespeople quote wrong prices or cannot show the buyer the unit.',
}
IMPACT = {
    'IVP-006': 'Two screens give different numbers of available units (a unit on hold is counted as available on the card only), so salespeople may offer a unit that is already held for another buyer.',
    'IVP-015': 'When a project code is already used the message does not say so, so users do not know how to fix the form.',
    'IVP-024': 'A duplicate product code ends in "Something went wrong": users think the system is broken and cannot tell the code is already used.',
    'IVP-034': 'New units start in KES instead of the project currency; a unit saved without noticing is priced in the wrong currency (a 450,000 price became 3,474.9 USD).',
    'IVP-035': 'When a unit code is already used the message does not say so, so users do not know how to fix the form.',
    'IVP-036': 'The status filter lists a unit under "On hold" whose status is Available and offers two "on hold" options, so unit counts by status are wrong.',
}
write_cases('Inventory_Page_Test_Cases.xlsx', 'Inventory Page — Test Cases', OVERVIEW, cases, FINDINGS, IMPACT, AREA_IMPACT)
