"""Builds the Availability Summary suite files (Inventory → Availability Summary tab, IDs AVS-):
  TestData/Availability_Summary_Test_Data.xlsx + TestData/csv/Availability_Summary/*.csv  (test data, same content)
  Testcase/Availability_Summary_Test_Cases.xlsx                                         (human-readable test cases)
Run from the repo root:  python scripts/build_availability_summary.py
No unit, block or figure is fixed: the tests read the units and counts the page shows at run time.
"""
from sales_modules_common import st, write_testdata, write_cases

TD = 'TestData/Availability_Summary_Test_Data.xlsx'
S = {}
S['Settings'] = (['Setting', 'Value', 'What it means'], [
    ['Inventory Route', '/inventory', 'Inventory page'],
    ['Tab', 'Availability Summary', 'Inventory tab under test'],
    ['Pricing Tab', 'Pricing Matrix', 'Inventory tab the tiles and the unit window are compared with'],
    ['Pricing Full View', 'Full 2-Layer', 'Pricing Matrix view with every column'],
    ['Heading', 'Availability Summary', 'Heading of the tab'],
    ['As Of Word', 'As of', 'Line "As of 06 Nov 2026, 19:45" under the heading'],
    ['Refresh Button', 'Refresh', 'Reloads the figures'],
    ['Export Button', 'Export', 'Downloads the summary'],
    ['Export Total Word', 'total', 'Export file: block rows read "<block> total" (and "Grand total"); the other rows are floors ("Block D" | "Floor 43")'],
    ['Floor Tally Word', 'Floor Tally', 'Row "Floor Tally (43 floors)" closing a block when its floors are shown (same figures as the block row)'],
    ['Project Label', 'Project', 'Project filter'],
    ['Block Label', 'Block', 'Block filter ("All blocks (4)", "Block D (86)" …)'],
    ['All Blocks Option', 'All blocks', 'First option of the Block filter'],
    ['Category Label', 'Category:', 'Category chips "Available 128/133", "Apartment 86/90" …'],
    ['All Category Chip', 'Available', 'Chip with every category (available / total units)'],
    ['Summary Units Word', 'total units', 'Summary line "<project>: N total units across M blocks · A Available ($…) · R Reserved ($…) · S Sold ($…)"'],
    ['Category Word', 'Category:', 'Summary line with a category chosen: "<project> · Category: Apartment: N total units …"'],
    ['Grand Total Row', 'Grand Total', 'Last row of the Summary Table'],
    ['Expand All Button', 'Expand all floors', 'Shows the floors of every block'],
    ['Expand Block Label', 'Show floors of', 'aria-label of a block\'s ▸ button: "Show floors of Block D"'],
    ['Unit Mix Button', '⊞ Unit Mix', 'Row button that opens the Unit Mix window (block / Grand Total)'],
    ['Stack Plan Button', '🏢 Stack Plan', 'Row / view button that shows the Stack Plan'],
    ['Back Button', '← Back to Summary Table', 'Stack Plan: back to the table'],
    ['Stack Search Placeholder', 'Search unit code, product, view...', 'Stack Plan search box'],
    ['Stack All Chip', 'All', 'Stack Plan status chip with every unit'],
    ['Unit Mix Title', 'INVENTORY UNIT MIX & STACK PLAN', 'Heading of the Unit Mix window (capitals by CSS)'],
    ['Unit Mix Scope Label', 'Scope:', 'Scope selector of the Unit Mix window'],
    ['Unit Mix Total Card', 'TOTAL STOCK', 'Unit Mix status card with every unit'],
    ['Tallied Text', '✓ Tallied', 'Unit Mix: shown when the rows add up to the total'],
    ['View Units Button', 'View Units', 'Unit Mix row button "View Units (43)": closes the window and opens the drill-down unit selection'],
    ['Drill Heading', 'DRILL-DOWN UNIT SELECTION', 'Unit list under the table (capitals by CSS)'],
    ['Drill Matching Word', 'matching units', 'Its title "<scope> · <product> · N matching units"'],
    ['Drill Close Button', 'Close Selection', 'Hides the unit list'],
    ['Drill Quick View Button', 'Quick View', 'Drill-down row button: opens the unit window (same as a Stack Plan tile)'],
    ['Drill Hold Button', 'Hold', 'Drill-down row button of an Available unit: opens the Hold form (not shown for Reserved / Sold units)'],
    ['Drill Hold Duration', '4 hours', 'Duration of the hold AVS-031 places (released at the end of the test)'],
    ['Close Button', 'Close', 'Closes a window'],
    ['X Close Button', '✕ Close', 'Unit window: close button at the top'],
    ['Unit Register Button', 'Open in Unit Register', 'Unit window: opens the Units tab'],
    ['Units Tab', 'Units', 'Inventory tab Open in Unit Register shows'],
    ['Unit Search Placeholder', 'Search unit, project, status', 'Search box of the Unit Register'],
    ['Hold Button Prefix', 'Hold for', 'Unit window: "Hold for 48h"'],
    ['Start Reservation Button', 'Start Reservation', 'Unit window: goes to Reservations with the unit chosen'],
    ['Matrix Heading', 'Unit Pricing Matrix Structure', 'Unit window: pricing block (2-layer engine)'],
    ['Floor Limit Word', 'Floor Limit:', 'Unit window: "Floor Limit: 879,984 USD"'],
    ['Available Status', 'Available', 'Status of the units the hold / reservation tests use'],
    ['Held Status', 'Held', 'Status chip / summary column of held units'],
    ['Value Tolerance %', '0.5', 'Allowed difference between amounts shown rounded ($73.79M, $857k)'],
    ['Rounding Tolerance', '1', 'Allowed difference per whole-dollar amount'],
    ['Broken Values', 'NaN, undefined, null, Infinity, [object Object]', 'Texts that must never appear'],
    ['Save Wait Seconds', '60', 'Longest wait for a save on QA'],
])
S['Cards'] = (['Card', 'Sub-line', 'Rule'], [
    ['Units', 'N Avail + N Res + N Sold', 'Units = Avail + Res + Sold (+ held) of the sub-line = total units of the Availability Summary'],
    ['Available', 'P% of N units', 'Available = Available of the summary line; P = Available ÷ Units'],
    ['Value', 'Avail $ · Booked $', 'Value = Avail + Booked; Avail = Available value of the summary line; Booked = Reserved + Sold values'],
])
S['Statuses'] = (['Status', 'Letter', 'Summary Column', 'Card Word'], [
    ['Available', 'A', 'Available', 'Avail'],
    ['Held', 'H', 'Held', ''],
    ['Reserved', 'R', 'Reserved', 'Res'],
    ['Sold', 'S', 'Sold', 'Sold'],
])
S['Table Views'] = (['View', 'Shows', 'Default'], [
    ['Units & Value', 'count and value in each cell', 'Yes'],
    ['Units Only', 'count only', 'No'],
    ['Value ($)', 'value only ("–" when 0)', 'No'],
])
S['Page Views'] = (['View', 'Default'], [['⊞ Summary Table', 'Yes'], ['🏢 Stack Plan', 'No']])
S['Unit Mix Views'] = (['View', 'Rows', 'Scope'], [
    ['By Product', 'one row per product (code, name, category / beds)', 'any'],
    ['By Bedrooms', 'one row per bedroom group', 'any'],
    ['Floor × Product Matrix', 'one row per floor, one column per product', 'a block'],
    ['🏢 Stack Plan', 'one tile per unit of the scope', 'any'],
])
S['Unit Window Facts'] = (['Caption', 'Pricing Matrix Column', 'Compare'], [
    ['Product', 'Product', 'same'],
    ['Carpet Area', 'Carpet', 'same number'],
    ['View Type', 'View', 'name without %'],
    ['Orientation', 'Orient.', 'same'],
    ['Position', 'Pos.', 'same'],
])
S['Matrix Structure'] = (['Caption', 'Pricing Matrix Column', 'Kind'], [
    ['Base Rate ($/m²)', 'Base Rate', 'amount'],
    ['Standard Price', 'Std Price', 'amount'],
    ['Total Physical Prem %', 'Total %', 'percent'],
    ['Net Unit Adj ($)', 'Net Adj', 'amount'],
    ['Adjusted Standard', 'Adj Std', 'amount'],
    ['Operative Current Price', 'Current Price', 'amount'],
    ['Floor Limit:', 'Floor (', 'amount'],
])
S['Hold Durations'] = (['Case ID', 'Option', 'Hours', 'Placed By Test'], [
    ['AVS-028', '4 hours', '4', 'Yes'],
    ['AVS-028', '12 hours', '12', 'Only when a hold can be released'],
    ['AVS-028', '1 day (24h)', '24', 'Only when a hold can be released'],
    ['AVS-028', '2 days (48h)', '48', 'Only when a hold can be released'],
    ['AVS-028', '3 days (72h)', '72', 'Only when a hold can be released'],
    ['AVS-028', '4 days (96h)', '96', 'Only when a hold can be released'],
    ['AVS-028', '7 days (168h)', '168', 'Only when a hold can be released'],
])
S['Hold Form'] = (['Setting', 'Value', 'What it means'], [
    ['Title Prefix', 'Hold', 'Heading "Hold <unit code>"'],
    ['Opportunity Label', 'Opportunity', 'Required: open opportunity the unit is held for'],
    ['Opportunity Placeholder', 'Select an open opportunity', 'First option of the Opportunity list'],
    ['Duration Label', 'Hold for', 'Hold duration'],
    ['Default Duration', '2 days (48h)', 'Duration chosen when the form opens (the button reads "Hold for 48h")'],
    ['Reason Label', 'Reason (optional)', 'Optional reason'],
    ['Reason Text', 'Automated test hold - released by the test', 'Reason typed for the test holds'],
    ['Submit Button', 'Hold Unit', 'Places the hold'],
    ['Cancel Button', 'Cancel', 'Leaves without a hold'],
    ['Release Buttons', 'Release Hold, Release, Release hold, End Hold', 'Buttons that end a hold early (unit window or Holds tab); the first one found is used (build 0411-16: "Release" on the Holds tab row)'],
    ['Release Confirm Title', 'Release this unit?', 'Pop-up of Release: "Unit <code> will become free for other sales reps to hold or reserve."'],
    ['Release Confirm Button', 'Release', 'Confirms the release'],
    ['Holds Tab', 'Holds', 'Inventory tab with the holds'],
    ['Holds Scope All', 'All', 'Holds: first filter, every user'],
    ['Holds Show All', 'All (incl. history)', 'Holds: second filter, every hold'],
    ['Held Until Tolerance Minutes', '10', 'Allowed difference between "Held Until" and now + the duration'],
    ['Own Opportunity Names', 'TestData/Leads_Test_Data.xlsx', 'The hold is placed for an opportunity whose customer is a name of the Leads test data (our own test records); none → the test is skipped'],
])
S['Reservation'] = (['Setting', 'Value', 'What it means'], [
    ['Route', '/reservations', 'Page Start Reservation opens'],
    ['Notice Title', 'Unit Selected', 'Pop-up on the Reservations page'],
    ['Notice Text', 'Unit {unit} is selected.', 'Start of its text ({unit} = the unit code)'],
    ['Form Heading', 'Create Reservation', 'Form shown after OK'],
    ['Unit Label', 'Unit', 'Form field that must show the unit'],
    ['Price Label', 'Unit Price', 'Form field: the unit price'],
    ['Deposit Label', 'Reservation Deposit', 'Form field: deposit (its % is in the label)'],
    ['Create Button', 'Create Reservation', 'Never clicked by the tests'],
    ['Close Button', 'Close', 'Leaves the form without a reservation'],
])
README = [
    'Test data for the Availability Summary suite (tests/availability-summary). Nothing the tests type or expect is written in the code: it is all here.',
    'Default source: this Excel file. Set TEST_DATA_FORMAT=csv to use TestData/csv/Availability_Summary/<sheet>.csv instead. Rebuild both with: python scripts/build_availability_summary.py',
    'No unit, block, product or figure is fixed: the tests read what the page shows at run time and compare the views with each other and with the Pricing Matrix.',
    'Writes: only AVS-028 places holds (on an Available unit, for an opportunity of our own test leads) and releases them; Start Reservation is opened and closed without creating a reservation. No project, product or unit is created or changed.',
]
write_testdata('Availability_Summary_Test_Data.xlsx', 'Availability_Summary', 'Availability Summary — Test Data', README, S)

cases = []
def C(id, uc, area, title, pre, steps, data, exp, pri='High', kind='Positive', auto='Automated'):
    cases.append([id, uc, area, title, pre, steps, data, exp, pri, kind, auto])

ADMIN = 'Signed in as CRM Administrator'
OPEN = 'Open Inventory (main menu → Inventory)'
TAB = 'Click the Availability Summary tab'
RUN = 'whatever the page shows at run time (no unit or figure is fixed)'
UC1 = 'AUC-01 Availability Summary (Inventory)'

A = 'Cards & Summary'
C('AVS-001', UC1, A, 'Top cards add up and match the Availability Summary', ADMIN, st(OPEN, 'Read the Units, Available and Value cards with their sub-lines', TAB, 'Read the summary line'), f'{TD} → Cards',
  'Units = Avail + Res + Sold of its sub-line = total units of the summary line; Available = Available of the summary line and its % = Available ÷ Units; Value = Avail + Booked, Avail = the Available value of the summary line, Booked = Reserved + Sold values (within rounding).', kind='Consistency')
C('AVS-002', UC1, A, 'Availability Summary tab shows its heading, filters, chips and views', ADMIN, st(OPEN, TAB), f'{TD} → Settings, Page Views, Table Views',
  'Heading "Availability Summary" with "As of <date, time>"; Refresh and Export; Project and Block filters; the Category chips; the summary line; views ⊞ Summary Table (selected) / 🏢 Stack Plan and Units & Value (selected) / Units Only / Value ($).', 'Medium')
C('AVS-003', UC1, A, 'Summary line = Grand Total row', ADMIN, st(OPEN, TAB, 'Read the summary line and the Grand Total row'), RUN,
  'Total units, blocks, Available (count and $), Reserved and Sold of the summary line equal the Grand Total row and the number of block rows.', kind='Consistency')
C('AVS-004', UC1, A, 'Summary Table rows and floors add up', ADMIN, st(OPEN, TAB, 'Expand all floors', 'Read every block and floor row'), RUN,
  'Every row: Available + Held + Reserved + Sold = Total (counts and values); the floors of a block add up to the block; Grand Total = the sum of the blocks; the block row says its number of floors and products.', kind='Calculation')
C('AVS-005', UC1, A, 'Units Only and Value ($) show the same figures', ADMIN, st(OPEN, TAB, 'Read the table in Units & Value', 'Switch to Units Only, then Value ($)'), f'{TD} → Table Views',
  'Units Only shows only the counts of Units & Value; Value ($) shows only the values ("–" for none); the figures do not change.', 'Medium')
C('AVS-006', UC1, A, 'Refresh reloads the figures and the time', ADMIN, st(OPEN, TAB, 'Read the "As of" line and the table', 'Click Refresh'), RUN,
  'The "As of" time is the time of the refresh (not earlier than before); the table shows the same figures (nothing changed in between).', 'Low')

A = 'Filters & Categories'
C('AVS-007', UC1, A, 'Block filter shows one block with its counts', ADMIN, st(OPEN, TAB, 'Choose each Block option'), RUN,
  'The option "(N)" = the block\'s Total; only that block is listed; the summary line shows that block\'s units; "All blocks (N)" = number of blocks.', kind='Consistency')
C('AVS-008', UC1, A, 'Project filter lists every project with units', ADMIN, st(OPEN, TAB, 'Open the Project filter', 'Choose each project'), RUN,
  'Each project shows its own summary line and blocks; the totals of all projects = the Units card.', 'Medium', kind='Consistency')
C('AVS-009', UC1, A, 'Category chips count their units and filter the grid', ADMIN, st(OPEN, TAB, 'Read every chip "Category A/T"', 'Click each chip and read the summary line and the table'), RUN,
  'Chip A/T = Available / Total units of that category; after clicking it the summary line reads "Category: <name>: T total units … A Available" and the table lists only those units (its Grand Total = T, Available = A); the chips of all categories add up to the "Available" (all) chip.', kind='Consistency')
C('AVS-010', UC1, A, 'Category and Block together', ADMIN, st(OPEN, TAB, 'Choose a category chip and a block'), RUN,
  'Only the block\'s units of that category are counted; the figures equal the Stack Plan tiles of that block and category.', 'Medium', kind='Consistency')
C('AVS-011', UC1, A, 'Export downloads the summary shown', ADMIN, st(OPEN, TAB, 'Click Export', 'Open the file'), RUN,
  'A file is downloaded; it has a row per block (and the Grand Total) with the same Available, Held, Reserved, Sold and Total as the table.', 'Medium')

A = 'Stack Plan'
C('AVS-012', UC1, A, 'Stack Plan status chips and block headers add up', ADMIN, st(OPEN, TAB, 'Click 🏢 Stack Plan', 'Read the status chips and every block header'), f'{TD} → Statuses',
  'All (N) = Available + Held + Reserved + Sold = total units; each chip = the summary line; each block header "N Floors · M Units · Avail: A ($) · Reserved · Sold" = its tiles and its Summary Table row.', kind='Consistency')
C('AVS-013', UC1, A, 'Status chips show only units of that status', ADMIN, st(OPEN, TAB, '🏢 Stack Plan → click each status chip'), f'{TD} → Statuses',
  'The tiles of that status stay highlighted and every other tile is dimmed; the highlighted tiles have that status (letter A / H / R / S) and their number = the chip; All shows every tile again (none dimmed).', 'Medium')
C('AVS-014', UC1, A, 'Stack Plan search narrows the tiles', ADMIN, st(OPEN, TAB, '🏢 Stack Plan → type a unit code, then a product code (taken from a tile)'), f'{TD} → Settings (Stack Search Placeholder)',
  'Unit code: only that tile stays highlighted (the others are dimmed); product code: only the tiles of that product; clearing the search shows every tile (none dimmed).', 'Medium')
C('AVS-015', UC1, A, 'Every tile = its Pricing Matrix row', ADMIN, st(OPEN, TAB, '🏢 Stack Plan → read every tile (code, letter, product, area, price)', 'Pricing Matrix → read every row'), RUN,
  'Same units in both; each tile shows the unit\'s status, product, carpet area and current price (rounded) of the Pricing Matrix.', kind='Consistency')
C('AVS-016', UC1, A, 'Block row 🏢 Stack Plan opens that block only', ADMIN, st(OPEN, TAB, 'Click 🏢 Stack Plan on a block row', 'Click ← Back to Summary Table'), RUN,
  'Only that block is shown with its header (the Block filter is set to it); Back returns to the Summary Table of that block; All blocks shows every block again.', 'Low')

A = 'Unit Mix'
C('AVS-017', UC1, A, 'Unit Mix window of a block matches its row', ADMIN, st(OPEN, TAB, 'Click ⊞ Unit Mix on a block row'), f'{TD} → Settings (Unit Mix …)',
  'Title "Inventory Unit Mix & Stack Plan" with the block; cards Available / Held / Reserved / Sold / Total Stock (units and $) = the block row; Scope shows that block.', kind='Consistency')
C('AVS-018', UC1, A, 'By Product rows add up', ADMIN, st(OPEN, TAB, '⊞ Unit Mix (Grand Total and each block) → By Product'), RUN,
  'Each product row: Available + Held + Reserved + Sold = Total; Availability % = Available ÷ Total; the Total row = the sum of the rows = the cards, and shows "✓ Tallied".', kind='Calculation')
C('AVS-019', UC1, A, 'By Bedrooms groups add up', ADMIN, st(OPEN, TAB, '⊞ Unit Mix → By Bedrooms'), RUN,
  'Each bedroom group adds up as in By Product; the groups add up to the same total; each unit counted once.', 'Medium', kind='Calculation')
C('AVS-020', UC1, A, 'Floor × Product Matrix values', ADMIN, st(OPEN, TAB, '⊞ Unit Mix on a block → Floor × Product Matrix'), f'{TD} → Unit Mix Views',
  'One row per floor of the block, one column per product; every cell = the units of that product on that floor (from the Stack Plan tiles); row and column totals add up to the block total.', kind='Calculation')
C('AVS-021', UC1, A, 'Scope selector changes the Unit Mix', ADMIN, st(OPEN, TAB, '⊞ Unit Mix → choose the project, each block and a floor in Scope'), RUN,
  'The cards and rows follow the scope: project = Grand Total row, block = block row, floor = floor row "(N units)".', 'Medium', kind='Consistency')
C('AVS-022', UC1, A, 'Unit Mix Stack Plan and View Units', ADMIN, st(OPEN, TAB, '⊞ Unit Mix on a block → 🏢 Stack Plan', 'By Product → View Units (N) on a product'), RUN,
  'The Stack Plan view shows one tile per unit of the scope; View Units (N) closes the window and opens the drill-down unit selection "<scope> · <product> · N matching units" with the N units of that product and "Available: A / N"; Close Selection hides it.', 'Medium')

A = 'Unit Window'
C('AVS-023', UC1, A, 'Unit window shows the unit and its pricing matrix structure', ADMIN, st(OPEN, TAB, '🏢 Stack Plan → click an Available tile', 'Read the window', 'Pricing Matrix → read the same unit (Full 2-Layer)'), f'{TD} → Unit Window Facts, Matrix Structure',
  'Header "Block · Floor · Category", code and status of the tile; Product, Carpet Area, View, Orientation and Position = the Pricing Matrix row; "Unit Pricing Matrix Structure": base rate, standard price, total %, net adj, adjusted standard, the five tier prices, active tier, floor limit and operative current price = the row, and standard = carpet × rate, adjusted = standard + adj, tiers = adjusted × (1 + %), floor = current × (1 − discount).', kind='Calculation')
C('AVS-024', UC1, A, 'Open in Unit Register shows the unit', ADMIN, st(OPEN, TAB, 'Stack Plan → a tile → Open in Unit Register'), f'{TD} → Settings (Unit Register Button)',
  'The Units tab opens with that unit listed (the register searched or opened on it), with the same status.', 'Medium')
C('AVS-025', UC1, A, 'Close and ✕ Close close the unit window', ADMIN, st(OPEN, TAB, 'Stack Plan → a tile → Close', 'A tile → ✕ Close', 'A tile → Escape'), RUN,
  'Each way closes the window and the Stack Plan stays as it was (same scope and chips); nothing is saved.', 'Low')
C('AVS-026', UC1, A, 'Start Reservation opens the reservation form for the unit (not saved)', 'An Available unit', st(OPEN, TAB, 'Stack Plan → an Available tile → Start Reservation', 'Read the pop-up and the form', 'Close the form'), f'{TD} → Reservation',
  'The Reservations page opens with "Unit Selected — Unit <code> is selected."; after OK the Create Reservation form shows that unit, its price and the deposit; closing it creates nothing (Create Reservation is never clicked).')
C('AVS-027', UC1, A, 'Hold form: opportunity, durations and cancel', 'An Available unit', st(OPEN, TAB, 'Stack Plan → an Available tile → Hold for 48h', 'Read the form', 'Hold Unit without an opportunity', 'Cancel'), f'{TD} → Hold Form, Hold Durations',
  'Heading "Hold <code>"; Opportunity * lists open opportunities; Hold for offers every duration of the data with "2 days (48h)" chosen (as the button says); a reason is optional; Hold Unit without an opportunity places no hold; Cancel sends nothing.')
C('AVS-028', UC1, A, 'Hold a unit for each duration, then release it', 'An Available unit and an open opportunity of our own test leads', st(OPEN, TAB, 'Stack Plan → an Available tile → Hold for … → choose the opportunity and the duration of the data row → Hold Unit', 'Read the tile, the counts and the Holds tab', 'Release the hold'), f'{TD} → Hold Durations (AVS-028.1 …), Hold Form',
  'The hold is placed; the tile shows H (Held); Held +1 and Available −1 in the chips, the summary line, the block row and the cards; the Holds tab lists it with the opportunity, the duration and Held Until = now + the duration; releasing it brings every count back. Longer durations are only placed when the hold can be released.')
C('AVS-030', UC1, A, 'Drill-down list: Quick View opens the unit window', ADMIN, st(OPEN, TAB, '⊞ Unit Mix on a block → View Units (N) on a product', 'Click Quick View on an Available row and on a Reserved / Sold row', 'Close'), f'{TD} → Settings (Drill …)',
  'Quick View opens the unit window of that row: code, status, product, carpet area and operative price equal the row (Unit Code, Status, Product, Carpet, Operative Price); Close closes it and the list stays open. Only Available rows offer Hold.', 'Medium')
C('AVS-031', UC1, A, 'Drill-down list: Hold a unit, then release it', 'An Available unit in the list and an open opportunity of our own test leads', st(OPEN, TAB, '⊞ Unit Mix → View Units on a product', 'Click Hold on an Available row', 'Choose our opportunity and the duration of the data → Hold Unit', 'Read the row, the tile and the counts', 'Release the hold (Holds tab → Release)'), f'{TD} → Settings (Drill Hold …), Hold Form',
  'The Hold form is the one of the unit window ("Hold <code>"); after Hold Unit the row and the tile show Held, Held +1 and Available −1; the Holds tab lists the hold; releasing it brings the unit and every count back.')
C('AVS-029', UC1, A, 'No broken values on the tab and its windows', ADMIN, st(OPEN, TAB, 'Read the Summary Table, the Stack Plan, a Unit Mix window and a unit window'), f'{TD} → Settings (Broken Values)',
  'No NaN, undefined, null or Infinity anywhere.', 'Medium', 'Design')

OVERVIEW = [
    ('Scope', 'Inventory → Availability Summary: top cards, Summary Table (views, floors, Refresh, Export), Project / Block filters, Category chips, Stack Plan (status chips, search, tiles), Unit Mix window (By Product, By Bedrooms, Floor × Product Matrix, Stack Plan, scope, View Units), unit window (pricing matrix structure, Open in Unit Register, Hold, Start Reservation, Close).'),
    ('Use cases', 'AUC-01 Availability Summary'),
    ('Test data', f'{TD} (or TestData/csv/Availability_Summary/*.csv with TEST_DATA_FORMAT=csv). No values are hard-coded in the tests; no unit or figure is fixed.'),
    ('Automation', 'tests/availability-summary/*.spec.ts — run with: npm run test:availability-summary'),
    ('Report', 'reports/Availability_Summary_Test_Report_<date>_<time>.xlsx'),
    ('Data changed', 'Only AVS-028: holds on one Available unit for an opportunity of our own test leads, released by the test. Start Reservation is opened and closed without a reservation. No project, product or unit is created or edited.'),
]
AREA_IMPACT = {
    'Cards & Summary': 'The availability counts or values disagree, so sales and management plan with wrong stock figures.',
    'Filters & Categories': 'Filters and categories show the wrong units, so salespeople offer from a wrong list.',
    'Stack Plan': 'The Stack Plan shows units with the wrong status or price, so a held, reserved or sold unit can be offered.',
    'Unit Mix': 'The unit mix does not add up, so stock reports and launch planning are wrong.',
    'Unit Window': 'The unit window shows wrong prices, or Hold / Start Reservation do not work, so units cannot be held or reserved from the stock view.',
}
FINDINGS = [
    ['F-01', 'Defect', 'AVS-007', 'Summary line does not follow the Block filter', 'With a block chosen (Block D (86), Block R (27), Block V (14), Block P (6)) the table shows only that block, but the summary line still reads "Palm Exotica: 133 total units across 4 blocks · 128 Available …".', 'The summary line counts the chosen block only (as it does for a category chip).', 'Medium'],
    ['F-02', 'Defect', 'AVS-024', 'Open in Unit Register does not show the unit', 'Unit window → Open in Unit Register opens the Units tab on page 1 with an empty search; the unit (e.g. PEX-APT-1101) is not on the list.', 'The register opens searched (or the unit opened) on that unit.', 'Low'],
    ['F-03', 'Defect', 'AVS-028', 'Reminder cards cover the Release button of the Holds tab', 'On the Holds tab the reminder cards at the bottom right lie on top of the Release button of the hold rows (same cause as NEW-03 / NEW-04 / NEW-10); the tests press it with a DOM event.', 'Nothing lies on top of the row buttons.', 'Medium'],
    ['F-04', 'Note', 'AVS-013, AVS-014', 'Status chips and search dim tiles instead of hiding them; chips add up', 'Not a defect: the Stack Plan keeps every tile and dims (opacity 0.25) the ones that do not match; status chips can be combined (Available + Held …).', '—', 'Info'],
]
write_cases('Availability_Summary_Test_Cases.xlsx', 'Availability Summary — Test Cases', OVERVIEW, cases, FINDINGS, {}, AREA_IMPACT)
