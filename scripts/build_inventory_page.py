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
# ── Pricing Matrix tab (IVP-061 …): every figure is read from the page at run time; these sheets only name what to look for ──
S['Pricing Settings'] = (['Setting', 'Value', 'What it means'], [
    ['Pricing Tab', 'Pricing Matrix', 'Inventory tab with the Unit Pricing Structure Matrix'],
    ['Pricing Title', 'Unit Pricing Structure Matrix', 'Heading of the tab'],
    ['Pricing Subtitle', '2-Layer Dynamic Calculation Engine (Layer 1 Physical Premiums + Layer 2 Commercial Tiers)', 'Line under the heading'],
    ['Never Click Buttons', '⚡ Recalculate All, ⚡ Recalculate All Units Live, ⚡ Recalculate Pricing Matrix, Save Draft, Publish', 'Buttons the tests check are there but never click (they re-price or publish for every real unit)'],
    ['Search Placeholder', 'Search unit, floor, view...', 'Search box of the Pricing Matrix'],
    ['Summary Start', 'Showing', 'Summary line "Showing N units (Total Carpet: … m² · Avg: … m²) · Standard Value: … · Net Uplift: … (…%) · Operative GDV: … · Total Price Floor: …"'],
    ['Summary Labels', 'Standard Value, Net Uplift, Operative GDV, Total Price Floor', 'Figures of the summary line'],
    ['Breakdown Button', '⊞ Breakdown', 'Row button that opens the 2-layer formula breakdown'],
    ['Row Edit Button', 'Edit', 'Row button that opens the unit window on its Sales section'],
    ['Breakdown Title', '2-LAYER UNIT PRICING FORMULA BREAKDOWN', 'Heading of the breakdown window'],
    ['Breakdown Steps', 'STEP 1: BASE SETUP, STEP 2: LAYER 1 PHYSICAL ATTRIBUTE PREMIUMS, STEP 3: LAYER 2 COMMERCIAL RELEASE TIERS', 'Step headings of the breakdown (start of each heading)'],
    ['Breakdown Edit Button', 'Edit Unit Sales Config', 'Breakdown button that opens the unit Sales section'],
    ['Breakdown Close Button', 'Close', 'Breakdown button that closes it'],
    ['Breakdown Sample', '6', 'Breakdowns opened per run: one unit of each status / tier / product first, up to this number'],
    ['Rules Button', '⚙ Pricing Rules', 'Opens Business Rules → Unit Pricing Matrix Rules'],
    ['Rules Route', '/configuration?engine=UNIT_PRICING_RULES', 'Page opened by the Rules button'],
    ['Rules Engine', 'Unit Pricing Matrix Rules', 'Engine selected on the Business Rules page'],
    ['Rules Version Word', 'Version', 'Line "Version 1 · Draft: PUBLISHED · Published …"'],
    ['Export Button', 'Export CSV', 'Downloads the rows shown'],
    ['All Option Prefix', 'All', 'First option of every filter ("All Projects", "All Blocks (4)" …)'],
    ['Available Status', 'Available', 'Status of the unit the Sales edit tests use (the first Available unit of the list)'],
    ['Active Tier Word', 'ACTIVE', 'Breakdown: marks the tier in use ("Standard (0%) · ACTIVE")'],
    ['Broken Values', 'NaN, undefined, null, Infinity, [object Object]', 'Texts that must never appear on the tab'],
    ['Layout Widths', '1280, 1440, 1920', 'Window widths for the layout check'],
    ['Rounding Tolerance', '1', 'Amounts are rounded to whole dollars (Rounding Rule "Nearest Integer"): allowed difference per amount'],
    ['Compact Tolerance %', '0.1', 'Compact view ($k / $M): allowed difference from the exact amount, % of the amount (rounded to 1 decimal of k / M)'],
    ['Save Wait Seconds', '60', 'Longest wait for a Sales save on QA'],
    ['Recalc All Button', '⚡ Recalculate All', 'Pricing Matrix: re-prices every unit of the project (pressed only by IVP-096, asked for on 5 Nov 2026)'],
    ['Recalc Confirm Title', 'Recalculate pricing?', 'Confirmation of ⚡ Recalculate All'],
    ['Recalc Confirm Button', 'Recalculate', 'Confirms the recalculation'],
    ['Recalc Cancel Button', 'Cancel', 'Leaves the confirmation without recalculating'],
    ['Unit Recalc Button', '⚡ Recalculate Pricing Matrix', 'Unit window → Sales: re-prices that unit (IVP-095)'],
    ['Rules Recalc Button', '⚡ Recalculate All Units Live', 'Pricing Rules: re-prices every unit (IVP-097)'],
    ['Save Draft Button', 'Save Draft', 'Pricing Rules: saves the rules as a draft (IVP-098)'],
    ['Publish Button', 'Publish', 'Pricing Rules: publishes the rules (IVP-099)'],
    ['Draft Status', 'DRAFT', 'Version line after Save Draft: "Version N · Draft: DRAFT · … · Unpublished changes"'],
    ['Published Status', 'PUBLISHED', 'Version line after Publish: "Version N · Draft: PUBLISHED · Published <date>"'],
    ['Unpublished Text', 'Unpublished changes', 'Version line while a draft differs from the published rules'],
    ['Rule Change', '+100', 'Change made to the base rate of one product for IVP-098 / IVP-099 (put back at the end)'],
    ['Empty Text', 'No units found matching the selected filters.', 'Line shown in the matrix when no unit matches the filters / search'],
    ['No Position Names', '-, Standard', 'Position shown for a unit without a position rule (0%): matrix "-", breakdown / tooltip "Standard"'],
    ['Floor Header Pattern', 'Floor (', 'Matrix column "Floor (-3%)" (the price floor; "Floor %" is the floor premium)'],
    ['Tier Title Word', 'Active Tier:', 'Tooltip of the Tier cell: "Active Tier: STANDARD"'],
    ['Block Title Word', 'Code:', 'Tooltip of the Blk/Flr cell: "Block D (Code: T) · Floor 01"'],
    ['Premium Title Parts', 'Floor, View, Orient, Pos', 'Tooltip of Total %: "Floor (01): -2% · View (…): +4% · Orient (…): 0% · Pos (…): 0%"'],
])
S['Pricing Views'] = (['Group', 'Button', 'Default'], [
    ['Amounts', 'Exact ($)', 'Yes'], ['Amounts', 'Compact ($k/$M)', 'No'],
    ['Layers', 'Standard View', 'Yes'], ['Layers', 'Full 2-Layer', 'No'],
])
S['Pricing Actions'] = (['Button', 'Clicked By Tests'], [
    ['⚙ Pricing Rules', 'Yes'], ['Export CSV', 'Yes'], ['⚡ Recalculate All', 'No (never)'],
])
S['Pricing Columns'] = (['View', 'Group', 'Columns'], [
    ['Standard View', 'Unit Identification', 'Unit Code, Product, Blk/Flr, Status'],
    ['Standard View', 'Base Setup (Carpet × Rate)', 'Carpet, Base Rate, Std Price'],
    ['Standard View', 'Layer 1: Physical Attribute Premiums', 'Total %, Net Adj, Adj Std'],
    ['Standard View', 'Governance & Operative Price', 'Tier, Current Price, Floor (-{discount}%), Details'],
    ['Full 2-Layer', 'Unit Identification', 'Unit Code, Product, Blk/Flr, Status'],
    ['Full 2-Layer', 'Base Setup (Carpet × Rate)', 'Carpet, Base Rate, Std Price'],
    ['Full 2-Layer', 'Layer 1: Physical Attribute Premiums', 'Floor %, View, Orient., Pos., Other %, Total %, Net Adj, Adj Std'],
    ['Full 2-Layer', 'Layer 2: Commercial Tiers', '{tiers}'],
    ['Full 2-Layer', 'Governance & Operative Price', 'Tier, Current Price, Floor (-{discount}%), Details'],
])
S['Pricing Filters'] = (['Filter', 'Label', 'All Option', 'Matrix Column', 'Option Text'], [
    ['Project', 'Project:', 'All Projects', 'Unit Code', 'CODE - Name (no count): rows whose unit code starts with the project prefix of the Unit window'],
    ['Block', 'Block:', 'All Blocks', 'Blk/Flr', 'Block X (N): rows whose Blk/Flr starts with "X/"'],
    ['Product', 'Product:', 'All Products', 'Product', 'CODE (N): rows of that product'],
    ['Status', 'Status:', 'All Statuses', 'Status', 'Status (N): rows with that status'],
    ['Tier', 'Tier:', 'All Tiers', 'Tier', 'Tier name (+N%): rows whose Tier is that tier (STD = Standard …)'],
])
S['Tier Codes'] = (['Tier Option', 'Tier Column Code', 'Matrix Tier Header', 'Sales Edit Option'], [
    ['Early Bird', 'EB', 'Early', 'Early Bird'],
    ['Standard', 'STD', 'Std', 'Standard'],
    ['Premium I', 'P1', 'Prem I', 'Premium Tier I'],
    ['Premium II', 'P2', 'Prem II', 'Premium Tier II'],
    ['Premium III', 'P3', 'Prem III', 'Premium Tier III'],
])
S['Filter Combinations'] = (['Case ID', 'Filters', 'What it checks'], [
    ['IVP-073', 'Block, Status', 'every block with every status'],
    ['IVP-073', 'Product, Status', 'every product with every status'],
    ['IVP-073', 'Block, Product', 'every block with every product'],
    ['IVP-073', 'Status, Tier', 'every status with every tier'],
    ['IVP-073', 'Project, Block, Status', 'project + block + status'],
    ['IVP-073', 'Block, Product, Status, Tier', 'four filters together (first option of each that has rows)'],
])
S['Search Terms'] = (['Case ID', 'Take From Column', 'How', 'Expected'], [
    ['IVP-074', 'Unit Code', 'whole code of a row', 'only that unit'],
    ['IVP-074', 'Blk/Flr', 'floor number of a row ("D/05" → "05")', 'every row shown has that floor or the text elsewhere in its row'],
    ['IVP-074', 'View', 'view name of a row without its % ("Partial Ocean View")', 'every row shown has that view'],
    ['IVP-074', 'Unit Code', 'a text no unit has: zzz{unique}', 'no rows; the summary shows 0 units'],
])
S['Rules Tabs'] = (['Tab', 'Table Columns', 'Matrix Column'], [
    ['1. Base Rates', 'Product Code, Product Name, Base Rate ($ / sqm)', 'Base Rate'],
    ['2. Floor Bands', 'Floor Band Label, Min Floor, Max Floor, Adjustment %', 'Floor %'],
    ['3. View %', 'Code, View Category, Adjustment %', 'View'],
    ['4. Orientation %', 'Code, Orientation, Adjustment %', 'Orient.'],
    ['5. Position %', 'Code, Position, Adjustment %', 'Pos.'],
    ['6. Commercial Tiers & Governance', '', 'Tier columns, Floor (-N%)'],
    ['🔍 Live Simulator', '', ''],
])
S['Governance Fields'] = (['Field Label', 'Compared With'], [
    ['Early Bird Adjustment %', 'Tier header "Early (-N%)" and Tier filter "Early Bird (-N%)"'],
    ['Standard Tier Adjustment %', 'Tier header "Std (N%)"'],
    ['Premium Tier 1 Adjustment %', 'Tier header "Prem I (+N%)"'],
    ['Premium Tier 2 Adjustment %', 'Tier header "Prem II (+N%)"'],
    ['Premium Tier 3 Adjustment %', 'Tier header "Prem III (+N%)"'],
    ['Default Commercial Tier', 'Tier of units without a tier of their own'],
    ['Maximum Discount Limit % (Price Floor)', 'Header "Floor (-N%)"'],
    ['Rounding Rule', 'Amounts shown (whole dollars for "Nearest Integer")'],
])
S['Simulator Cases'] = (['Case ID', 'Product', 'Carpet Area', 'Floor Number', 'View', 'Orientation', 'Position', 'Commercial Tier', 'What it covers'], [
    ['IVP-082', '1', '175', '1', '1', '1', '1', '2', 'first product, ground band, best view / orientation / position, Standard tier'],
    ['IVP-082', 'last', '420', '56', 'last', 'last', 'last', 'last', 'last product, top band, worst view / orientation / position, highest tier'],
    ['IVP-082', '2', '180.5', '4', '3', '2', '3', '1', 'decimal area, band edge (first floor of band 2), Early Bird'],
    ['IVP-082', '3', '205', '15', '4', '3', '4', '3', 'band edge (last floor of band 2), Premium I'],
    ['IVP-082', '4', '260', '16', '6', '7', '5', '4', 'band 3 edge, neutral view, negative position, Premium II'],
    ['IVP-082', '7', '300', '25', '7', '11', '6', '5', 'penthouse product, band 4, negative view, Premium III'],
    ['IVP-082', '8', '350', '50', '8', '12', '7', '2', 'band 5, every negative premium'],
    ['IVP-082', '11', '500', '99', '2', '1', '8', '1', 'largest band, signature position, Early Bird'],
])
S['Simulator Fields'] = (['Field Label', 'Kind'], [
    ['Product Type', 'option number (1 = first, last = last)'], ['Carpet Area (sqm)', 'number'], ['Floor Number', 'number'],
    ['View', 'option number'], ['Orientation', 'option number'], ['Position', 'option number'], ['Commercial Tier', 'option number'],
])
S['Sales Fields'] = (['Field Label', 'Field Name', 'Field Type', 'Saved Value Shown As'], [
    ['Carpet Area for Pricing (sqm)', 'carpetAreaPricing', 'Number', 'STANDARD BASE PRICE line "<carpet> m² × $<rate>/m²"'],
    ['Base Rate ($/sqm)', 'baseRatePerSqm', 'Number', 'same line'],
    ['Other Additive Adjustment %', 'otherAdjPct', 'Number', 'Other Adj'],
    ['Active Commercial Tier (Layer 2)', 'activeCommercialTier', 'Dropdown', 'Active Tier'],
    ['Discount Limit % (Price Floor)', 'discountLimitPct', 'Number', 'Discount Limit: N%'],
    ['Enable Manual Price Override', 'isPriceOverridden', 'Checkbox', 'Pricing Governance line'],
    ['Reservation Amount', 'reservationAmount', 'Number', 'RESERVATION AMOUNT'],
    ['Approved Selling Price', 'approvedSellingPrice', 'Number', 'OPERATIVE CURRENT PRICE when the override is on'],
    ['Current Market Value', 'currentMarketValue', 'Number', 'CURRENT MARKET VALUE'],
    ['Sales Status', 'salesStatusRefId', 'Dropdown', 'SALES STATUS'],
    ['Remarks', 'remarks', 'Text', 'REMARKS'],
])
S['Sales Settings'] = (['Setting', 'Value', 'What it means'], [
    ['Sales Section', 'Sales', 'Unit window section with the pricing'],
    ['Edit Mode Button', 'Edit', 'Switches a section to edit mode'],
    ['Save Button', 'Save Sales & Recalculate Pricing', 'Saves the Sales section (re-prices this unit only)'],
    ['New Button', 'New', 'Unit window button that opens Create Unit'],
    ['Create Unit Heading', 'Create Unit', 'Heading of the New form (never saved by the tests)'],
    ['Create Unit Button', 'Create Unit', 'Save button of the New form: never clicked'],
    ['Close Button', 'Close', 'Closes the unit window'],
    ['Discard Button', 'Discard', 'Answer to "Discard changes?"'],
    ['Governance Line', 'Pricing Governance:', 'Sales line "Pricing Governance: Matrix Governed (Dynamic)Active Tier: STANDARD"'],
    ['Override Word', 'Manual', 'The governance line names a manual price when the override is on'],
    ['New Unit Note', 'New units always start as Available.', 'Create Unit: Availability hint'],
    ['Default Currency Option', 'Default project currency', 'Create Unit: currency it starts with'],
])
S['Unit Window Captions'] = (['Section', 'Caption', 'Matrix Column', 'Compare'], [
    ['Identification', 'UNIT', 'Unit Code', 'same'],
    ['Identification', 'PRODUCT', 'Product', 'starts with'],
    ['Identification', 'BLOCK / FLOOR', 'Blk/Flr', 'block code / floor'],
    ['Identification', 'STATUS', 'Status', 'same'],
    ['Identification', 'PRICE', 'Current Price', 'amount'],
    ['Sales', 'OPERATIVE CURRENT PRICE', 'Current Price', 'amount'],
    ['Sales', 'PRICE FLOOR (MIN. PRICE)', 'Floor (', 'amount'],
    ['Sales', 'ADJUSTED STANDARD PRICE', 'Adj Std', 'amount'],
    ['Sales', 'STANDARD BASE PRICE', 'Std Price', 'amount'],
    ['Sales', 'Total Premium %', 'Total %', 'percent'],
    ['Sales', 'Net Unit Adj ($)', 'Net Adj', 'amount'],
    ['Sales', 'Other Adj', 'Other %', 'percent'],
])
S['Sales View Captions'] = (['Field Name', 'Caption', 'How'], [
    ['carpetAreaPricing', 'STANDARD BASE PRICE', 'carpet of the line under it "<carpet> m² × $<rate>/m²"'],
    ['baseRatePerSqm', 'STANDARD BASE PRICE', 'rate of the same line'],
    ['otherAdjPct', 'Other Adj', 'percent'],
    ['discountLimitPct', 'PRICE FLOOR (MIN. PRICE)', 'percent of the line "Discount Limit: N%"'],
    ['reservationAmount', 'RESERVATION AMOUNT', 'amount'],
    ['currentMarketValue', 'CURRENT MARKET VALUE', 'amount'],
    ['salesStatusRefId', 'SALES STATUS', 'same'],
    ['remarks', 'REMARKS', 'same'],
])
S['Simulator Results'] = (['Caption', 'Meaning'], [
    ['Carpet Area × Base Rate:', 'line "<carpet> sqm × $<rate> = $<standard>"'],
    ['Floor Adjustment:', 'floor %'], ['View Adjustment:', 'view %'], ['Orientation Adjustment:', 'orientation %'], ['Position Adjustment:', 'position %'],
    ['Total Unit Premium %:', 'total % and $ "+13% ($+109,200)"'],
    ['Adjusted Standard Price:', 'adjusted standard'],
    ['Commercial Tier Pricing:', 'start of the tier lines "<tier> (<%>): $<price>"'],
    ['Operative Current Price', 'current price (caption ends with the chosen tier)'],
    ['Price Floor', 'price floor (caption "Price Floor (-N%):")'],
])
S['Sales Invalid Values'] = (['Case ID', 'Field Label', 'Value', 'Expected Message Contains', 'Checked When'], [
    ['IVP-087', 'Carpet Area for Pricing (sqm)', 'abc', '', 'On save'],
    ['IVP-087', 'Carpet Area for Pricing (sqm)', '-10', '', 'On save'],
    ['IVP-087', 'Carpet Area for Pricing (sqm)', '0', '', 'On save'],
    ['IVP-087', 'Carpet Area for Pricing (sqm)', '', '', 'On save'],
    ['IVP-087', 'Base Rate ($/sqm)', 'abc', '', 'On save'],
    ['IVP-087', 'Base Rate ($/sqm)', '-1', '', 'On save'],
    ['IVP-087', 'Other Additive Adjustment %', 'abc', '', 'On save'],
    ['IVP-087', 'Other Additive Adjustment %', '150', '', 'On save'],
    ['IVP-087', 'Discount Limit % (Price Floor)', '-1', '', 'On save'],
    ['IVP-087', 'Discount Limit % (Price Floor)', '101', '', 'On save'],
    ['IVP-087', 'Reservation Amount', '-5', '', 'On save'],
    ['IVP-087', 'Current Market Value', 'abc', '', 'On save'],
])
S['Sales Edit Combinations'] = (['Case ID', 'Active Commercial Tier (Layer 2)', 'Other Additive Adjustment %', 'Discount Limit % (Price Floor)', 'Carpet Area for Pricing (sqm)', 'Base Rate ($/sqm)', 'What it covers'], [
    ['IVP-088', 'Early Bird', '0', '3', '', '', 'Early Bird tier'],
    ['IVP-088', 'Premium Tier I', '0', '3', '', '', 'Premium I tier'],
    ['IVP-088', 'Premium Tier II', '2.5', '3', '', '', 'Premium II with a decimal extra adjustment'],
    ['IVP-088', 'Premium Tier III', '-1.5', '5', '', '', 'Premium III with a negative extra adjustment and a larger discount limit'],
    ['IVP-088', 'Standard', '1', '0', '+5', '', 'no discount (floor = price), carpet +5 m²'],
    ['IVP-088', 'Standard', '0', '10', '', '+100', 'base rate +100 $/m², discount limit 10%'],
])
S['Override Cases'] = (['Case ID', 'Approved Selling Price', 'What it covers'], [
    ['IVP-089', '{current}+25000', 'manual price above the matrix price'],
])
S['Design Checks'] = (['Check', 'Rule'], [
    ['No broken values', 'No text from Settings → Broken Values on the tab, the breakdown or the unit window'],
    ['Buttons not covered', 'The centre of every row button (unit code, ⊞ Breakdown, Edit) and every filter is the button itself, not something on top of it (e.g. the reminder cards)'],
    ['No page side-scroll', 'At every Layout Width the page itself does not scroll sideways (the table may scroll inside its own box)'],
    ['Headers line up', 'Column groups span exactly the columns under them'],
    ['Amount format', 'Every amount in Exact view is "$" + digits with thousands commas; every % is "+N%", "-N%" or "0%"'],
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
    'Pricing Matrix (IVP-061 …): Pricing Settings, Pricing Views / Actions / Columns / Filters, Tier Codes, Filter Combinations, Search Terms, Rules Tabs, Governance Fields, Simulator Cases / Fields, Sales Fields / Settings, Sales Invalid Values, Sales Edit Combinations, Override Cases, Design Checks. No unit code or price is fixed: the tests read the units the matrix lists at run time and work out every expected figure from the page and the pricing rules.',
    'Sales edit tests use the first Available unit of the matrix, read its values first and put them back at the end. They never create projects, products or units.',
    'Recalculate & Publish (IVP-095 … IVP-099, asked for on 5 Nov 2026): the tests press ⚡ Recalculate Pricing Matrix, ⚡ Recalculate All, ⚡ Recalculate All Units Live, Save Draft and Publish on the existing units and products. Every rule value they change is put back, published and recalculated at the end, and the matrix is compared with its first state.',
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

# ── Pricing Matrix tab (build 0411-16) ──────────────────────────────────────
UC7 = 'IUC-07 Pricing Matrix (2-layer pricing engine)'
PM = 'Inventory → Pricing Matrix tab'
SAMPLE = 'whatever units the Pricing Matrix lists at run time (no unit code is fixed in the tests)'
A = 'Pricing Matrix'
C('IVP-061', UC7, A, 'Pricing Matrix tab shows its heading, views, actions and filters', ADMIN, st(OPEN, 'Click the Pricing Matrix tab', 'Read the heading, the line under it, the view buttons, the action buttons and the filters'), f'{TD} → Pricing Settings, Pricing Views, Pricing Actions, Pricing Filters',
  'Heading "Unit Pricing Structure Matrix" and its subtitle; view buttons Exact ($) / Compact ($k/$M) (Exact selected) and Standard View / Full 2-Layer (Standard selected); buttons ⚙ Pricing Rules, Export CSV and ⚡ Recalculate All (present, never clicked); filters Project, Block, Product, Status and Tier, each starting with its "All …" option; the search box.', 'Medium')
C('IVP-062', UC7, A, 'Standard View and Full 2-Layer show their column groups and columns', ADMIN, st(OPEN, PM, 'Read the two header rows', 'Click Full 2-Layer and read them again'), f'{TD} → Pricing Columns',
  'Each view shows the groups and columns of the Pricing Columns sheet in that order ({tiers} = one column per commercial tier, {discount} = the discount limit); each group spans exactly the columns under it.', 'Medium')
C('IVP-063', UC7, A, 'Standard price = carpet × base rate on every row', ADMIN, st(OPEN, PM, 'For every row read Carpet, Base Rate and Std Price'), SAMPLE,
  'Std Price = Carpet × Base Rate (whole dollars) on every row.', kind='Calculation')
C('IVP-064', UC7, A, 'Layer 1: premiums add up and give the adjusted standard price on every row', ADMIN, st(OPEN, PM, 'Click Full 2-Layer', 'For every row read Floor %, View, Orient., Pos., Other %, Total %, Net Adj and Adj Std'), SAMPLE,
  'Total % = Floor % + View % + Orientation % + Position % + Other %; Net Adj = Std Price × Total %; Adj Std = Std Price + Net Adj (whole dollars).', kind='Calculation')
C('IVP-065', UC7, A, 'Layer 2: tier prices, current price and price floor on every row', ADMIN, st(OPEN, PM, 'Click Full 2-Layer', 'For every row read the five tier columns, Tier, Current Price and Floor'), SAMPLE,
  'Each tier column = Adj Std × (1 + the tier % in its header); Current Price = the column of the row\'s tier; Floor = Current Price × (1 − the discount % in the "Floor (-N%)" header).', kind='Calculation')
C('IVP-066', UC7, A, 'Summary line adds up the rows shown', ADMIN, st(OPEN, PM, 'Read the summary line', 'Add up the rows', 'Choose a Status filter option and repeat'), f'{TD} → Pricing Settings (Summary Labels)',
  '"Showing N units" = rows; Total Carpet = Σ Carpet and Avg = Total ÷ N; Standard Value = Σ Std Price; Net Uplift = Σ Net Adj and its % = Net Uplift ÷ Standard Value; Operative GDV = Σ Current Price; Total Price Floor = Σ Floor — with and without a filter.', kind='Calculation')
C('IVP-067', UC7, A, 'Compact view shows the same amounts in $k / $M', ADMIN, st(OPEN, PM, 'Read every amount in Exact ($)', 'Click Compact ($k/$M) and read them again'), f'{TD} → Pricing Settings (Compact Tolerance %)',
  'Every amount and the summary line show the same value rounded to $k / $M; carpet, rates and % do not change; rows stay in the same order.', 'Medium')
C('IVP-068', UC7, A, 'Breakdown of a unit matches its row and its three steps add up', ADMIN, st(OPEN, PM, 'Click ⊞ Breakdown on units of different statuses, tiers and products', 'Read every step'), f'{TD} → Pricing Settings (Breakdown …), {SAMPLE}',
  'Title, unit code, product and status of the row; Step 1 carpet × rate = standard price; Step 2 floor / view / orientation / position % add up to Total Layer 1 Adj and give the adjusted standard; Step 3 the five tier prices, the ACTIVE tier = Current Price and the Price Floor equal the row (Full 2-Layer); the closing line repeats Current Price and Price Floor.', kind='Calculation')
C('IVP-069', UC7, A, 'Unit code opens the same breakdown; Close, ✕ and Escape close it', ADMIN, st(OPEN, PM, 'Click a unit code', 'Close with Close, open again and close with ✕, then with Escape'), SAMPLE,
  'The unit code opens the breakdown of that unit (same content as ⊞ Breakdown); each way of closing removes it and the matrix is unchanged.', 'Medium')
C('IVP-070', UC7, A, 'Breakdown "Edit Unit Sales Config" opens that unit\'s Sales section', ADMIN, st(OPEN, PM, '⊞ Breakdown on a unit', 'Click Edit Unit Sales Config'), SAMPLE,
  'The unit window of the same unit opens on Sales (view mode); its current price and floor equal the breakdown.', 'Medium')

A = 'Pricing Matrix Filters'
C('IVP-071', UC7, A, 'Filter options count the units they show', ADMIN, st(OPEN, PM, 'Open every filter and read its options with their (N)'), f'{TD} → Pricing Filters, {SAMPLE}',
  'The "(N)" of each Block / Product / Status option = rows of the unfiltered list with that value; "All Blocks (N)" / "All Products (N)" = number of options; the Project list has every project that has units; the Tier list has every tier of the matrix headers.', kind='Consistency')
C('IVP-072', UC7, A, 'Each filter on its own shows only matching units', ADMIN, st(OPEN, PM, 'For each filter choose each option in turn (other filters on All)', 'Read the rows and the summary line'), f'{TD} → Pricing Filters (one row per filter = IVP-072.1 …)',
  'Every row shown matches the option; the number of rows = the option\'s (N) = rows of the unfiltered list with that value; the summary line counts the rows shown; All brings back every unit.', kind='Consistency')
C('IVP-073', UC7, A, 'Filter combinations show the units that match all of them', ADMIN, st(OPEN, PM, 'Choose the options of the combination', 'Read the rows and the summary line', 'Set the filters back to All'), f'{TD} → Filter Combinations (one row per combination = IVP-073.1 …)',
  'For every combination of options the rows = the rows of the unfiltered list that match every chosen option (none when no unit matches, with "Showing 0 units"); the summary line follows; All on every filter shows every unit again.', kind='Consistency')
C('IVP-074', UC7, A, 'Search narrows the matrix by unit, floor and view', ADMIN, st(OPEN, PM, 'Type each search term (taken from a row of the list)', 'Read the rows', 'Clear the search'), f'{TD} → Search Terms (IVP-074.1 …)',
  'Unit code: only that unit; floor / view: every row shown contains the text and no row that contains it is missing; a text no unit has: no rows and "Showing 0 units"; clearing the search shows every unit.', 'Medium')
C('IVP-075', UC7, A, 'Filters stay while switching views', ADMIN, st(OPEN, PM, 'Choose a Status and a Block', 'Switch Full 2-Layer, Compact, Exact, Standard'), SAMPLE,
  'The same units are listed in every view and the filters keep their choice.', 'Medium')
C('IVP-076', UC7, A, 'Export CSV has the units shown with their prices', ADMIN, st(OPEN, PM, 'Choose a Status filter option', 'Click Export CSV', 'Open the file'), SAMPLE,
  'The file has one row per unit shown (same unit codes) and the same current price and floor per unit.', 'Medium')

A = 'Pricing Rules & Simulator'
C('IVP-077', UC7, A, '⚙ Pricing Rules opens the Unit Pricing Matrix Rules with its tabs', ADMIN, st(OPEN, PM, 'Click ⚙ Pricing Rules', 'Click each rule tab'), f'{TD} → Pricing Settings (Rules …), Rules Tabs',
  'Business Rules opens on "Unit Pricing Matrix Rules" with a Version line; tabs 1. Base Rates … 6. Commercial Tiers & Governance and 🔍 Live Simulator, each with its table columns; Save Draft, Publish and ⚡ Recalculate All Units Live are present and never clicked; browsing sends no change to the server.', 'Medium')
C('IVP-078', UC7, A, 'Base rate of every unit = the rule of its product', ADMIN, st('Pricing Rules → 1. Base Rates: read the rate of each product', PM + ': read Product and Base Rate of every row'), SAMPLE,
  'Every row\'s Base Rate equals the rate of its product on the Base Rates tab (a unit with its own rate is listed as a finding).', kind='Consistency')
C('IVP-079', UC7, A, 'Floor bands have no gaps and give every unit its Floor %', ADMIN, st('Pricing Rules → 2. Floor Bands: read every band', PM + ' → Full 2-Layer: read Blk/Flr and Floor % of every row'), SAMPLE,
  'The bands run on without gaps or overlaps (each Min = previous Max + 1, Min ≤ Max); each row\'s Floor % = the % of the band holding its floor.', kind='Consistency')
C('IVP-080', UC7, A, 'View, orientation and position % of every unit = the rules', ADMIN, st('Pricing Rules → 3. View %, 4. Orientation %, 5. Position %: read each code and %', PM + ' → Full 2-Layer: read View, Orient., Pos. of every row'), SAMPLE,
  'The % of each row\'s view / orientation / position equals the rule of that name ("-" = 0%); every name used by a unit exists in the rules.', kind='Consistency')
C('IVP-081', UC7, A, 'Commercial tiers and governance rules = the matrix', ADMIN, st('Pricing Rules → 6. Commercial Tiers & Governance: read the tier %, default tier, discount limit, rounding rule', PM + ' → Full 2-Layer: read the tier headers, the Floor header and the Tier filter'), f'{TD} → Governance Fields',
  'Tier headers and Tier filter options show the same % as the rules; Floor (-N%) = Maximum Discount Limit %; Standard is fixed at 0%; amounts follow the Rounding Rule.', kind='Consistency')
C('IVP-082', UC7, A, 'Live Simulator prices every combination by the rules', ADMIN, st('Pricing Rules → 🔍 Live Simulator', 'Enter the product, carpet area, floor, view, orientation, position and tier of the data row', 'Read the simulated breakdown'), f'{TD} → Simulator Cases (IVP-082.1 …), Simulator Fields',
  'Carpet × base rate of the product; floor % of the band of the floor; view / orientation / position % of the options; Total % and $; adjusted standard; the five tier prices; Operative Current Price = the chosen tier; Price Floor = current × (1 − discount limit). Nothing is saved.', kind='Calculation')

A = 'Unit Sales Window'
C('IVP-083', UC7, A, 'Row Edit opens the unit window with its nine left-side sections', ADMIN, st(OPEN, PM, 'Click Edit on a row', 'Read the left-side sections', 'Open each one', 'Close'), f'{TD} → Unit Sections, {SAMPLE}',
  'The window of that unit opens on Sales; the nine sections Identification, Configuration, Area Schedule, View & Location, Parking & Storage, Specification, Sales, Floor Plans & Media and Linked Modules are listed in this order and each opens with its own heading; Close returns to the matrix.')
C('IVP-084', UC7, A, 'Identification and Sales of the unit window agree with the matrix row', ADMIN, st(OPEN, PM, 'Read a row in Full 2-Layer', 'Edit → read Identification and Sales'), SAMPLE,
  'Identification: unit code, product, block / floor and status of the row, price = Current Price; Sales: operative current price, price floor, adjusted standard, standard base ("carpet × rate"), floor / view / orientation / position %, total %, net adj and the tier table (price and floor of each tier) equal the row; the tier marked Active Tier is the row\'s tier.', kind='Consistency')
C('IVP-085', UC7, A, 'Every section of the unit window shows values without broken text', ADMIN, st(OPEN, PM, 'Edit on a row', 'Open each of the nine sections'), f'{TD} → Unit Sections, Pricing Settings (Broken Values)',
  'Each section shows its captions with values; no NaN, undefined, null or Infinity anywhere.', 'Medium')
C('IVP-086', UC7, A, 'Sales Edit mode shows the saved values; leaving it changes nothing', ADMIN, st(OPEN, PM, 'Edit on an Available unit → Sales → Edit', 'Read every field', 'Change a value, then Close (answer Discard) and open the unit again'), f'{TD} → Sales Fields, Sales Settings',
  'The fields of the Sales Fields sheet are shown with the values of view mode (carpet, base rate, other %, tier, discount limit, reservation amount, market value, status, remarks); leaving without saving sends nothing and the values are unchanged.')
C('IVP-087', UC7, A, 'Sales edit refuses wrong values', 'An Available unit of the matrix', st(OPEN, PM, 'Edit → Sales → Edit', 'Type the value of the data row', 'Save Sales & Recalculate Pricing'), f'{TD} → Sales Invalid Values (IVP-087.1 …)',
  'Each row: the save is refused with a message about the field (or the field does not accept the value); the unit\'s prices and the matrix row are unchanged.', kind='Negative')
C('IVP-088', UC7, A, 'Sales edit: every combination re-prices the unit', 'An Available unit of the matrix (its values are put back at the end)', st(OPEN, PM, 'Edit → Sales → Edit', 'Set tier, other %, discount limit, carpet and base rate of the data row', 'Save Sales & Recalculate Pricing', 'Read Sales and the matrix row', 'Put the original values back and save'), f'{TD} → Sales Edit Combinations (IVP-088.1 …)',
  'After each save: standard = carpet × rate; total % = physical premiums + other %; adjusted = standard × (1 + total %); current price = the chosen tier\'s price; floor = current × (1 − discount limit); the Sales section, the breakdown, the matrix row and the summary line show the new figures. After the last row the unit shows its original values and prices again.')
C('IVP-089', UC7, A, 'Manual price override sets the current price', 'An Available unit of the matrix (its values are put back at the end)', st(OPEN, PM, 'Edit → Sales → Edit', 'Tick Enable Manual Price Override, enter the Approved Selling Price of the data row', 'Save', 'Untick it and save again'), f'{TD} → Override Cases',
  'With the override the operative current price = the approved price (matrix row and Sales) and the floor follows it; without it the matrix price comes back.')
C('IVP-090', UC7, A, 'New in the unit window opens Create Unit (not saved)', ADMIN, st(OPEN, PM, 'Edit on a row', 'Click New', 'Read the form', 'Close it (Discard)'), f'{TD} → Sales Settings (Create Unit …)',
  'Heading "Create Unit"; Identification is in edit mode with Project, Unit Product, Unit Code …; Availability says "New units always start as Available."; Currency starts with "Default project currency"; closing it creates nothing (Create Unit is never clicked).', 'Medium')

A = 'Recalculate & Publish'
BACK = 'Every rule value changed is put back, published and recalculated at the end, so every unit returns to its first price.'
C('IVP-095', UC7, A, 'Unit "⚡ Recalculate Pricing Matrix" re-prices the unit by the published rules', 'An Available unit of the matrix', st(OPEN, PM, 'Note the row of the unit', 'Edit → Sales → ⚡ Recalculate Pricing Matrix', 'Read Sales and the matrix row'), SAMPLE,
  'The recalculation is sent and succeeds; the unit\'s prices follow the published rules (standard, premiums, adjusted, tiers, current price, floor), so with unchanged rules the row is the same as before.', kind='Calculation')
C('IVP-096', UC7, A, 'Matrix "⚡ Recalculate All" asks first, then re-prices every unit', ADMIN, st(OPEN, PM, 'Note every row', 'Click ⚡ Recalculate All → Cancel', 'Click it again → Recalculate', 'Read every row'), f'{TD} → Pricing Settings (Recalc …)',
  'Pop-up "Recalculate pricing?" with Cancel and Recalculate; Cancel sends nothing; Recalculate sends the recalculation, it succeeds and a message says so; afterwards every row follows the published rules (with unchanged rules no price changes).', kind='Calculation')
C('IVP-097', UC7, A, 'Pricing Rules "⚡ Recalculate All Units Live" re-prices every unit', ADMIN, st('Pricing Matrix → ⚙ Pricing Rules', 'Click ⚡ Recalculate All Units Live', PM + ': read every row'), f'{TD} → Pricing Settings (Rules Recalc Button)',
  'The recalculation is sent and succeeds and a message says so; every row follows the published rules.', kind='Calculation')
C('IVP-098', UC7, A, 'Save Draft keeps the change out of the live prices', ADMIN, st('Pricing Rules → 1. Base Rates: change the rate of one product (Rule Change)', 'Save Draft', 'Read the version line', PM + ': read the units of that product', 'Put the rate back'), f'{TD} → Pricing Settings (Save Draft Button, Draft Status, Unpublished Text, Rule Change)',
  'The draft is saved (message); the version number goes up and the line reads "Draft: DRAFT … Unpublished changes"; the matrix keeps the published rate and prices. ' + BACK)
C('IVP-099', UC7, A, 'Publish puts the new rule live and the units are re-priced', ADMIN, st('Pricing Rules → change the base rate of one product (Rule Change)', 'Publish', 'Read the version line', '⚡ Recalculate All (when the matrix has not changed by itself)', PM + ': read every row', 'Put the rate back, Publish and recalculate'), f'{TD} → Pricing Settings (Publish Button, Published Status, Rule Change)',
  'The version goes up and reads "PUBLISHED · Published <today>"; the units of that product get the new base rate and their prices follow the formulas; the other units do not change. ' + BACK)

A = 'Pricing Matrix Design'
C('IVP-091', UC7, A, 'No broken values and amounts are formatted', ADMIN, st(OPEN, PM, 'Read every cell in Standard and Full 2-Layer, Exact view'), f'{TD} → Design Checks, Pricing Settings (Broken Values)',
  'No NaN / undefined / null / Infinity; every amount is "$" with thousands commas; every % reads +N%, -N% or 0%; every row has a status and a tier.', 'Medium', 'Design')
C('IVP-092', UC7, A, 'Row buttons and filters can be clicked (nothing covers them)', ADMIN, st(OPEN, PM, 'Scroll through the list', 'Check the unit code, ⊞ Breakdown and Edit of each row and every filter'), f'{TD} → Design Checks',
  'Nothing lies on top of any row button or filter (for example the reminder cards at the bottom right).', 'Medium', 'Design')
C('IVP-093', UC7, A, 'Layout fits the window and the headers line up', ADMIN, st(OPEN, PM, 'At each width of the data: check the page scroll, the toolbar and the header groups', 'In Standard and Full 2-Layer'), f'{TD} → Pricing Settings (Layout Widths), Design Checks',
  'The page does not scroll sideways (the table scrolls in its own box); the view / action buttons and filters stay visible; header groups span their columns.', 'Low', 'Design')
C('IVP-094', UC7, A, 'Matrix status = Unit Register status for every unit', ADMIN, st(OPEN, PM + ': read Status of every unit', 'Units tab (All Statuses): read the status of every unit'), SAMPLE,
  'Same units in both and the same status for each.', kind='Consistency')

FINDINGS = [
    ['F-01', 'Defect', 'IVP-034', 'New units default to KES', 'New Unit pre-selects "KES - Kenyan Shilling" in Currency instead of "Default project currency"; a unit saved without changing it is priced in KES in a USD project (shown as 3,474.9 USD / 0.45M KES).', 'Start with "Default project currency" (or the project currency).', 'High'],
    ['F-02', 'Defect', 'IVP-024', 'Duplicate product code gives "Something Went Wrong"', 'Saving a product with an existing code shows "Something went wrong on our side… Reference: …".', 'A clear message that the product code already exists.', 'Medium'],
    ['F-03', 'Defect', 'IVP-015, IVP-035', 'Duplicate project / unit code: message does not say why', '"Project could not be saved. Check code and required fields." / "Unit could not be saved. Check project, unit code, and status."', 'Say that the code already exists.', 'Low'],
    ['F-04', 'Defect', 'IVP-006', 'Available count differs between views', 'Available card is one more than the Availability Summary (134 vs 133 on 25 Oct 2026); the held unit PEX-APT-0301 is counted as available by the card only.', 'Same rule in every view (or the difference explained on screen).', 'Medium'],
    ['F-06', 'Defect', 'IVP-087.1, .3, .4, .5, .7, .12', 'Sales edit saves wrong values without any message', 'Carpet Area "abc" / "0" / empty, Base Rate "abc", Other % "abc" and Current Market Value "abc" are saved (PUT …/sales-information 200, "Catalogue Updated") with no validation message (PEX-APT-0102, 5 Nov 2026).', 'The save is refused with a message naming the field.', 'High'],
    ['F-07', 'Defect', 'IVP-087.8', 'Other Additive Adjustment % has no upper limit', 'Other % = 150 is saved: PEX-APT-0102 goes from $881,280 to $2,177,280 (Total % +152%).', 'A sensible limit (e.g. as for the other premiums) with a message.', 'High'],
    ['F-08', 'Defect', 'IVP-088', 'Carpet area, base rate and discount limit edits are saved but not used', 'Carpet +5 m², Base Rate +100 $/m² and Discount Limit 0 / 5 / 10% save with 200, but Standard price, current price and floor stay as before and Discount Limit stays 3%. Tier and Other % changes do re-price the unit.', 'Either the fields re-price the unit, or they are read-only (governed by Business Rules).', 'High'],
    ['F-09', 'Defect', 'IVP-089', 'Manual price override does not change the price', 'With "Enable Manual Price Override" and Approved Selling Price 906,280 the governance line says "Manual Override Active", but Operative Current Price stays 881,280 (Sales and matrix).', 'Current price = the approved price while the override is on.', 'High'],
    ['F-10', 'Defect', 'IVP-080', 'Units use views that are not in the pricing rules', 'Views "Garden View", "Ocean Front" and "Ocean View" are used by units but the View % rules list only V1 … V8 (Panoramic Ocean View …).', 'Every view of a unit has a rule, so its premium comes from the rules.', 'Medium'],
    ['F-11', 'Defect', 'IVP-092', 'Reminder cards cover the row buttons of the Pricing Matrix', 'The reminder cards at the bottom right lie on top of ⊞ Breakdown / Edit of 267 rows (same cause as the Leads page NEW-03 / NEW-04).', 'Nothing lies on top of the list buttons.', 'Medium'],
    ['F-12', 'Defect', 'IVP-083', 'Closing a unit opened from the Pricing Matrix lands on the Units tab', 'Pricing Matrix → Edit → Close shows the Units tab instead of the Pricing Matrix, so the user loses the matrix view and its filters.', 'Close returns to the Pricing Matrix.', 'Low'],
    ['F-05', 'To confirm', 'IVP-036', 'Unit status filter: "On hold" lists Available units and duplicates "Onhold"', 'Filter "On hold" lists PEX-APT-0301 whose status is Available (held); the status totals add up to one more than All Statuses; "Onhold" and "On hold" are both offered.', 'One option per status; every unit counted once.', 'Low'],
]
OVERVIEW = [
    ('Scope', 'Inventory page (/inventory): KPI cards, Projects, Products (unit product catalogue, Product Details, media), Units (unit view sections, price breakdown, Linked Modules, media), Pricing Matrix (2-layer formulas, views, breakdown, filters and combinations, search, export, pricing rules, Live Simulator, unit window sections, Sales edit, design), Availability Summary (Summary Table, Stack Plan) and Holds.'),
    ('Use cases', 'IUC-01 overview & counts · IUC-02 manage projects · IUC-03 manage unit products · IUC-04 manage units · IUC-05 pricing, availability & holds · IUC-06 product and unit details · IUC-07 Pricing Matrix (2-layer pricing engine)'),
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
    'Pricing Matrix': 'The Pricing Matrix shows wrong prices or formulas, so salespeople quote and approve wrong unit prices.',
    'Pricing Matrix Filters': 'Filters show the wrong units, so salespeople pick from a wrong list of units and prices.',
    'Pricing Rules & Simulator': 'Unit prices do not follow the published pricing rules, so every quote built on them is wrong.',
    'Unit Sales Window': 'The unit Sales section cannot be maintained or shows different prices from the matrix, so the price a buyer is quoted depends on the screen used.',
    'Recalculate & Publish': 'Recalculating or publishing the pricing rules does not re-price the units as the rules say, so the live prices of every unit can be wrong after a rule change.',
    'Pricing Matrix Design': 'Users cannot read or click parts of the Pricing Matrix, so they cannot check or open unit prices.',
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
