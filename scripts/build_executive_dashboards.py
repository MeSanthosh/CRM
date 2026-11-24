"""Builds the Executive Dashboards & My Smart Workspace suite files (IDs EXD- and MSW-):
  TestData/Executive_Dashboards_Test_Data.xlsx + TestData/csv/Executive_Dashboards/*.csv  (test data, same content)
  Testcase/Executive_Dashboards_Test_Cases.xlsx                                         (human-readable test cases)
Run from the repo root:  python scripts/build_executive_dashboards.py
No figure is fixed here: every expected number is read at run time from the dashboard, its API or another module.
"""
from sales_modules_common import st, write_testdata, write_cases

TD = 'TestData/Executive_Dashboards_Test_Data.xlsx'
S = {}
S['Settings'] = (['Setting', 'Value', 'What it means'], [
    ['Workspace Route', '/', 'My Smart Workspace (home page)'],
    ['Dashboards Route', '/dashboards', 'Executive Dashboards'],
    ['Tasks Route', '/activities?tab=tasks&scope=mine', 'Tasks & Calendar, my tasks'],
    ['Leads Route', '/leads', 'Leads module'],
    ['Opportunities Route', '/opportunities', 'Opportunities module'],
    ['Inventory Route', '/inventory', 'Inventory module'],
    ['Reservations Route', '/reservations', 'Reservations module'],
    ['Contracts Route', '/contracts', 'SPA / Sales Contracts module'],
    ['Side Menu Workspace', 'My Smart Workspace', 'Side-menu link to the home page'],
    ['Workspace Eyebrow', 'MY SMART WORKSPACE', 'Eyebrow above the welcome line'],
    ['Workspace Welcome', 'Welcome,', 'Start of the welcome line, followed by the user name'],
    ['Executive Button', 'Executive Dashboards', 'Workspace button that opens the dashboards'],
    ['Customize Button', 'Customize Deck', 'Workspace button that opens Customize'],
    ['Customize Note', 'Changes are saved immediately per user.', 'Text of the Customize window'],
    ['Done Button', 'Done', 'Closes the Customize window'],
    ['Pinned Text', '★ Pinned', 'Button of a pinned item in Customize'],
    ['Pin Text', '☆ Pin', 'Button of an item that is not pinned'],
    ['Deck Limit', '5', 'Most items a deck can hold ("Customize (n/5)")'],
    ['AI Hide Button', 'Hide AI Lead Magnet', 'Workspace button while the AI panel is shown'],
    ['AI Show Button', 'Show AI Lead Magnet', 'Workspace button while the AI panel is hidden'],
    ['Mine Scope', 'Mine', 'Today strip scope button'],
    ['Team Scope', 'Team', 'Today strip scope button'],
    ['Overdue Tag', 'OVERDUE', 'Tag of an overdue task card'],
    ['Pitch Brand', 'Palm Exotica', 'Project name as it must be spelled in the WhatsApp pitch'],
    ['Dashboard Heading', 'Executive Intelligence & Performance', 'Dashboards heading'],
    ['Dashboard Welcome', 'Welcome back,', 'Dashboards welcome line, followed by the user name'],
    ['Currency Text', 'Amounts in USD', 'Currency line of the dashboards'],
    ['Loading Text', 'Loading', 'Text shown while a tab loads'],
    ['AI Insights Button', 'AI Insights', 'Never clicked'],
    ['As Of Label', 'AS OF DATE (LAST EXPORT)', 'Badge with the date of the figures'],
    ['Default Tab', 'Commercial / Sales', 'Tab shown when the page opens'],
    ['Default Period', 'This month', 'Period selected when the page opens'],
    ['Load Wait Ms', '30000', 'Longest wait for a tab to finish loading'],
    ['Load Budget Ms', '5000', 'A page or tab should be ready within this time'],
    ['Min Font Px', '10', 'Smallest readable font size for a figure label'],
    ['Desktop Width', '1366', 'Desktop viewport width'],
    ['Mobile Width', '390', 'Phone viewport width'],
    ['Percent Tolerance', '0.6', 'Allowed difference for a percentage shown rounded (points)'],
    ['Never Clicked', 'AI Insights; Ask AI; Edit Targets; a task tick (✓); reminder Open / Mark done / Dismiss', 'These change data or call the AI service'],
])
S['Tabs'] = (['Tab', 'Unique Text', 'Data Source'], [
    ['Commercial / Sales', 'SALES FUNNEL (THIS MONTH)', 'GET /analytics/snapshots/<period>'],
    ['Monthly Sales & Marketing', '1. SALES SUMMARY', 'GET /analytics/snapshots/<period>'],
    ['Lead & Customer Insights', 'LEADS CAPTURED', 'GET /dashboard/summary?view=audience&period=<period>'],
])
S['Periods'] = (['Key', 'Label', 'From', 'Notes'], [
    ['today', 'Today', 'today', 'From = To = today'],
    ['this_month', 'This month', 'month', 'First day of the month to today'],
    ['this_year', 'This year', 'year', '1 January to today'],
    ['upto_date', 'Upto Date', 'all', 'Everything up to today'],
    ['custom', 'Custom', 'custom', 'From date and To date fields'],
])
# Source: kpi:<metricCode> / meta:<path> of the snapshot, sum:<path> of /dashboard/summary, coll:<path> of /contracts/collections-summary
S['Tiles'] = (['Tab', 'Label', 'Source', 'Kind', 'Scope'], [
    ['Commercial / Sales', 'TOTAL LEADS', 'kpi:TOTAL_LEADS', 'count', 'period'],
    ['Commercial / Sales', 'QUALIFIED LEADS', 'kpi:QUALIFIED_LEADS', 'count', 'period'],
    ['Commercial / Sales', 'SITE VISITS', 'kpi:SITE_VISITS', 'count', 'period'],
    ['Commercial / Sales', 'RESERVATIONS', 'kpi:RESERVATIONS', 'count', 'as of'],
    ['Commercial / Sales', 'UNITS SOLD', 'kpi:UNITS_SOLD', 'count', 'period'],
    ['Commercial / Sales', 'SALES VALUE', 'kpi:SALES_VALUE', 'money', 'period'],
    ['Commercial / Sales', 'COLLECTIONS', 'kpi:COLLECTIONS', 'money', 'period'],
    ['Commercial / Sales', 'CONVERSION RATE', 'calc:conversion', 'percent', 'period'],
    ['Monthly Sales & Marketing', 'TOTAL INVENTORY', 'kpi:PORTFOLIO_UNITS', 'count', 'as of'],
    ['Monthly Sales & Marketing', 'UNITS AVAILABLE', 'kpi:AVAILABLE_UNITS', 'count', 'as of'],
    ['Monthly Sales & Marketing', 'UNITS RESERVED', 'kpi:RESERVED_UNITS', 'count', 'as of'],
    ['Monthly Sales & Marketing', 'UNITS SOLD (PERIOD)', 'kpi:MONTH_UNITS_SOLD', 'count', 'period'],
    ['Monthly Sales & Marketing', 'UNITS SOLD (YTD)', 'meta:ytdSoldUnits', 'count', 'ytd'],
    ['Monthly Sales & Marketing', 'GROSS SALES (PERIOD)', 'kpi:MONTH_SALES_VALUE', 'money', 'period'],
    ['Monthly Sales & Marketing', 'COLLECTIONS (PERIOD)', 'kpi:MONTH_COLLECTIONS', 'money', 'period'],
    ['Monthly Sales & Marketing', 'GROSS SALES (YTD)', 'meta:ytdSalesValue', 'money', 'ytd'],
    ['Monthly Sales & Marketing', 'COLLECTIONS (YTD)', 'meta:ytdCollectionsValue', 'money', 'ytd'],
    ['Monthly Sales & Marketing', 'CANCELLATIONS (PERIOD)', 'kpi:CANCELLATIONS_COUNT', 'count', 'period'],
    ['Lead & Customer Insights', 'Total Leads', 'sum:metrics.totalLeads', 'count', 'as of'],
    ['Lead & Customer Insights', 'Active Leads', 'sum:metrics.activeLeads', 'count', 'as of'],
    ['Lead & Customer Insights', 'Open Opportunities', 'sum:metrics.openOpportunities', 'count', 'as of'],
    ['Lead & Customer Insights', 'Won / SPAs Executed', 'sum:metrics.wonOpportunities', 'count', 'period'],
    ['Lead & Customer Insights', 'Disqualified Leads', 'sum:metrics.disqualifiedLeads', 'count', 'as of'],
    ['Lead & Customer Insights', 'Units Available', 'sum:metrics.availableUnits', 'count', 'as of'],
    ['Lead & Customer Insights', 'Reserved Units', 'sum:metrics.reservedUnits', 'count', 'as of'],
    ['Lead & Customer Insights', 'Sales Value (SPAs)', 'sum:metrics.totalContractValue', 'money', 'as of'],
    ['Lead & Customer Insights', 'Collections Received', 'coll:totals.amountReceived', 'money', 'as of'],
    ['Lead & Customer Insights', 'Outstanding Amount', 'coll:totals.outstanding', 'money', 'as of'],
    ['Lead & Customer Insights', 'Leads Captured', 'sum:audience.leadsCaptured', 'count', 'period'],
    ['Lead & Customer Insights', 'Converted', 'sum:audience.leadsConverted', 'count', 'period'],
    ['Lead & Customer Insights', 'Period Conversion', 'sum:audience.conversionRate', 'percent', 'period'],
    ['Lead & Customer Insights', 'Overall Conversion', 'sum:audience.overallConversionRate', 'percent', 'as of'],
])
S['Sections'] = (['Tab', 'Heading'], [
    *[['Commercial / Sales', h] for h in ['SALES FUNNEL', 'SALES VALUE TREND', 'SALES BY PRODUCT TYPE', 'SALES BY MARKET', 'SALES PERFORMANCE', 'MONTHLY SALES COMPARISON',
                                          'COLLECTIONS VS SALES', 'RECEIVABLES AGING', 'TOP SALES CHANNELS', 'MARKETING ROI', 'TOP PROJECTS BY SALES VALUE', 'SALES PIPELINE',
                                          'KEY INSIGHTS', 'TOP COMMERCIAL RISKS', 'MANAGEMENT ACTIONS', 'SALES TARGET', 'QUICK ACTIONS']],
    *[['Monthly Sales & Marketing', h] for h in ['1. SALES SUMMARY', '2. SALES PERFORMANCE', '3. SALES TREND', '4. SALES BY DEVELOPMENT', '5. SALES BY UNIT TYPE',
                                                 '6. UNIT INVENTORY STATUS', '7. COLLECTIONS SUMMARY', '8. LEAD SOURCE PERFORMANCE', '9. TOP PERFORMING AGENTS',
                                                 '10. RESERVATIONS BY MARKET', '11. CANCELLATION ANALYSIS', '12. MARKETING CAMPAIGNS PERFORMANCE', 'KEY HIGHLIGHTS',
                                                 'CHALLENGES / RISKS', 'NEXT FOCUS ACTIONS', 'NOTES', 'QUICK ACTIONS']],
    *[['Lead & Customer Insights', h] for h in ['Lead Source Mix', 'Conversion by Source', 'Geography', 'Capture Channel', 'LEADS PIPELINE · STATUS', 'UNIT INVENTORY · STATUS', 'QUICK ACTIONS']],
])
# the same figure for This month, read from two or more places ("Tab › tile label" or "Tab › table heading › row › column")
S['Same Figures'] = (['Figure', 'Sources'], [
    ['Leads captured', 'Commercial / Sales › TOTAL LEADS | Monthly Sales & Marketing › 1. SALES SUMMARY › New Leads › This Month | Lead & Customer Insights › Leads Captured'],
    ['Qualified leads', 'Commercial / Sales › QUALIFIED LEADS | Monthly Sales & Marketing › 1. SALES SUMMARY › Qualified Leads › This Month'],
    ['Site visits', 'Commercial / Sales › SITE VISITS | Monthly Sales & Marketing › 1. SALES SUMMARY › Site Visits › This Month'],
    ['Units sold', 'Commercial / Sales › UNITS SOLD | Monthly Sales & Marketing › UNITS SOLD (PERIOD) | Monthly Sales & Marketing › 1. SALES SUMMARY › Units Sold › This Month'],
    ['Sales value', 'Commercial / Sales › SALES VALUE | Monthly Sales & Marketing › GROSS SALES (PERIOD)'],
    ['Collections', 'Commercial / Sales › COLLECTIONS | Monthly Sales & Marketing › COLLECTIONS (PERIOD)'],
    ['Reserved units', 'Commercial / Sales › RESERVATIONS | Monthly Sales & Marketing › UNITS RESERVED | Lead & Customer Insights › Reserved Units'],
    ['Conversion rate', 'Commercial / Sales › CONVERSION RATE | Monthly Sales & Marketing › 1. SALES SUMMARY › Conversion Rate › This Month | Lead & Customer Insights › Period Conversion'],
    ['Converted leads', 'Commercial / Sales › SALES FUNNEL › Converted Leads | Lead & Customer Insights › Converted'],
    ['Units available', 'Monthly Sales & Marketing › UNITS AVAILABLE | Lead & Customer Insights › Units Available'],
    ['Units sold to date', 'Monthly Sales & Marketing › UNITS SOLD (YTD) | Lead & Customer Insights › Won / SPAs Executed'],
    ['Avg selling price achievement', 'Commercial / Sales › SALES PERFORMANCE › Avg. Selling Price (USD) › Achievement | Monthly Sales & Marketing › 2. SALES PERFORMANCE › Avg. Selling Price'],
])
# sentences of the insight panels; {LABEL} = the value shown on the tile with that label (same tab)
S['Narratives'] = (['Tab', 'Sentence Contains'], [
    ['Commercial / Sales', '{UNITS SOLD} unit(s) sold ({SALES VALUE})'],
    ['Commercial / Sales', 'Collections realized: {COLLECTIONS}'],
    ['Commercial / Sales', '{TOTAL LEADS} lead(s) and {QUALIFIED LEADS} qualified lead(s) captured'],
    ['Commercial / Sales', 'conversion rate is {CONVERSION RATE}'],
    ['Commercial / Sales', '{RESERVATIONS} active reservation(s) pending contract signing'],
    ['Commercial / Sales', 'Fast-track SPA execution on {RESERVATIONS} reserved unit(s)'],
    ['Commercial / Sales', 'Engage {QUALIFIED LEADS} qualified lead(s)'],
    ['Monthly Sales & Marketing', '{UNITS SOLD (PERIOD)} unit(s) sold during'],
    ['Monthly Sales & Marketing', '(YTD: {UNITS SOLD (YTD)} units)'],
    ['Monthly Sales & Marketing', 'Available inventory stands at {UNITS AVAILABLE} of {TOTAL INVENTORY} portfolio units'],
    ['Monthly Sales & Marketing', '{UNITS RESERVED} active unit reservation(s)'],
    ['Monthly Sales & Marketing', '{CANCELLATIONS (PERIOD)} cancellation(s) recorded'],
    ['Monthly Sales & Marketing', 'Expedite contract signing on {UNITS RESERVED} reserved unit(s)'],
    ['Monthly Sales & Marketing', 'Promote remaining {UNITS AVAILABLE} available unit(s)'],
])
S['Quick Actions'] = (['Label', 'Route'], [
    ['Quick Individual', '/leads/individual/quick'], ['Quick Corporate', '/leads/corporate/quick'], ['Quick Customer', '/customers/quick'],
    ['Opportunities', '/opportunities'], ['Reservations', '/reservations'], ['Follow-up', '/activities-communication'],
    ['Search Unit', '/inventory'], ['Search Customer', '/customers'],
])
S['KPI Links'] = (['Card', 'Route'], [
    ['Total Leads', '/leads'], ['Active Leads', '/leads?status=ACTIVE'], ['Open Opportunities', '/opportunities'], ['Won / SPAs Executed', '/contracts'],
    ['Disqualified Leads', '/leads?status=DISQUALIFIED'], ['Units Available', '/inventory?commitment=AVAILABLE'], ['Reserved Units', '/reservations'],
    ['Sales Value (SPAs)', '/contracts'], ['Collections Received', '/contracts'], ['Outstanding Amount', '/contracts'],
])
S['Deck Modules'] = (['Key', 'Card Title', 'Route'], [
    ['leads', 'Leads', '/leads'], ['opportunities', 'Opportunities', '/opportunities'], ['reservations', 'Reservations', '/reservations'],
    ['proposals', 'Proposals', '/proposals'], ['contracts', 'Sales Contracts', '/contracts'], ['customers', 'Customers & Brokers', '/customers'],
    ['inventory', 'Inventory', '/inventory'], ['activities', 'Tasks & Calendar', '/activities'], ['reports', 'Reports', '/reports'],
])
S['Viewports'] = (['Name', 'Width', 'Height'], [['Desktop', '1366', '768'], ['Tablet', '1024', '768'], ['Phone', '390', '844']])

README = [
    'Test data for tests/executive-dashboards (Executive Dashboards at /dashboards and My Smart Workspace at /).',
    'No figure is written here. Every expected number is read at run time from the page, from the API the page uses, or from another module (Leads, Opportunities, Inventory, Reservations, SPA / Sales Contracts, Tasks & Calendar, Currencies).',
    'Tiles: Source tells which API value a tile shows (kpi: = snapshot KPI, meta: = snapshot metadata, sum: = /dashboard/summary, coll: = /contracts/collections-summary, calc:conversion = converted ÷ leads).',
    'Same Figures: each row is one figure read from several places, written "Tab › tile" or "Tab › table › row › column". All must show the same value for This month.',
    'Never clicked: AI Insights, Ask AI, Edit Targets, a task tick, reminder Open / Mark done / Dismiss. The Customize window and the AI Lead Magnet button save the signed-in user\'s preferences: the tests put them back.',
]
write_testdata('Executive_Dashboards_Test_Data.xlsx', 'Executive_Dashboards', 'Executive Dashboards & My Smart Workspace — Test Data', README, S)

cases = []
def C(id, uc, area, title, pre, steps, data, exp, pri='High', kind='Functional', auto='Automated'):
    cases.append([id, uc, area, title, pre, steps, data, exp, pri, kind, auto])

ADMIN = 'Signed in as CRM Administrator'
WS = 'Open My Smart Workspace (home page /)'
DB = 'Open Executive Dashboards (/dashboards)'
COM, MON, LCI = 'Open the Commercial / Sales tab, period This month', 'Open the Monthly Sales & Marketing tab, period This month', 'Open the Lead & Customer Insights tab, period This month'
U1, U2, U3, U4, U5, U6 = 'EDU-01 My Smart Workspace', 'EDU-02 Dashboards: page, tabs and periods', 'EDU-03 Commercial / Sales', 'EDU-04 Monthly Sales & Marketing', 'EDU-05 Lead & Customer Insights', 'EDU-06 Cross-check and UI'
RUN = 'whatever QA shows at run time'

# ── My Smart Workspace ──
A = 'Workspace'
C('MSW-001', U1, A, 'My Smart Workspace opens from the side menu', ADMIN, st('Open any page', 'Click "My Smart Workspace" in the side menu'), f'{TD} → Settings (Side Menu Workspace, Workspace Eyebrow, Workspace Welcome)',
  'The home page (/) opens with the eyebrow "MY SMART WORKSPACE" and "Welcome, <signed-in user>".', kind='Functional')
C('MSW-002', U1, A, 'Workspace loads without errors', ADMIN, st(WS, 'Wait until the page is ready', 'Watch the requests the page sends'), RUN,
  'Every request the page sends succeeds (no 4xx / 5xx); no script error; no NaN, undefined or empty figure.', kind='Functional')
C('MSW-003', U1, A, 'Welcome line shows the user, location, weather and exchange rate', ADMIN, st(WS, 'Read the welcome line', 'Compare the FX rate with Currency Master (1 USD in KES)'), 'GET /dashboard/ai/lead-magnet; GET /currencies/display-context',
  'The name is the signed-in user; location and temperature are those of the AI service; "FX: 1 USD = N KES" uses the rate of the Currency module.', 'Medium', 'Integration')
C('MSW-004', U1, A, 'Today counts equal Tasks & Calendar', ADMIN, st(WS, 'Read "N overdue · M due today" (Mine)', 'Open Tasks & Calendar and read My overdue and Due today'), 'GET /activities/summary?scope=mine',
  'Overdue and due today on the workspace = the API = the Tasks & Calendar cards.', kind='Integration')
C('MSW-005', U1, A, 'Header task badge = overdue + due today', ADMIN, st(WS, 'Read the task badge of the header and its label'), RUN,
  'The label reads "Tasks (N due or overdue)" with N = overdue + due today; the badge shows N, or "99+" when N is above 99.', 'Medium', 'Number Format')
C('MSW-006', U1, A, 'Team scope shows the team\'s tasks', ADMIN, st(WS, 'Click Team in the Today strip', 'Read the counts and the cards', 'Click Mine'), 'GET /activities/summary?scope=team',
  'Team loads without a server error; the counts are the team\'s (from the API with scope=team); Mine shows the user\'s counts again.', kind='Functional')
C('MSW-007', U1, A, 'Today task cards are the user\'s first open tasks', ADMIN, st(WS, 'Read the task cards (tag, subject, owner, due)', 'Read the user\'s open tasks, earliest due first'), 'GET /activities?status=OPEN&scope=mine',
  'Each card is an open task of the user, in due order; a task due before now is tagged OVERDUE; the ✓ button is labelled "Mark … complete" (not clicked).', 'Medium', 'Integration')
C('MSW-008', U1, A, '"Open all N tasks" equals the open tasks and opens Tasks & Calendar', ADMIN, st(WS, 'Read "Open all N tasks →"', 'Click it'), 'GET /activities/summary (totalOpen)',
  'N = the user\'s open tasks; the link opens Tasks & Calendar on the user\'s tasks.', 'Medium', 'Integration')
C('MSW-009', U1, A, 'Frequent Modules deck shows the pinned modules in order', ADMIN, st(WS, 'Read "Showing a–b of N pinned" and the cards', 'Read the user\'s saved pins'), 'GET /preferences/my-workspace (pinnedModules)',
  'N = number of pinned modules; the cards follow the saved order; "Customize (N/5)" shows the same N. A pinned item is never left out silently.', kind='Functional')
C('MSW-010', U1, A, 'Reports deck shows the pinned reports in order', ADMIN, st(WS, 'Read the Reports deck', 'Read the user\'s saved report pins'), 'GET /preferences/my-workspace (pinnedReports)',
  'N = number of pinned reports; the cards follow the saved order with their report code; "Customize (N/5)" shows the same N.', kind='Functional')
C('MSW-011', U1, A, 'Leads card equals the Leads module', ADMIN, st(WS, 'Read the Leads card (active leads, converted, follow-ups today)', 'Open Leads and the Lead & Customer Insights tab'), 'GET /leads (summary); GET /dashboard/summary',
  'Active leads = Leads total − converted − disqualified = Lead & Customer Insights Active Leads; follow-ups today = due today of the Today strip; converted = the dashboard\'s converted leads.', kind='Integration')
C('MSW-012', U1, A, 'Opportunities card equals the Opportunities module', ADMIN, st(WS, 'Read the Opportunities card', 'Open Opportunities and read Open, Won and Avg Probability'), 'GET /opportunities (summary)',
  'Open deals and average probability = the Opportunities cards; won = deals won in the month on the dashboards.', kind='Integration')
C('MSW-013', U1, A, 'Inventory card equals the Inventory module', ADMIN, st(WS, 'Read the Inventory card', 'Open Inventory and read the Units card'), 'GET /inventory/units (summary)',
  'Total, available and reserved units = the Inventory Units card.', kind='Integration')
C('MSW-014', U1, A, 'Deck slider moves through the pinned cards', ADMIN, st(WS, 'Read the Frequent Modules deck', 'Click Next until it is disabled', 'Click Prev until it is disabled'), RUN,
  '"Showing a–b of N" moves by one card; Prev is disabled on the first card and Next on the last; the active dot follows.', 'Medium', 'Functional')
C('MSW-015', U1, A, 'Deck card links open their module or report', ADMIN, st(WS, 'Click the link of each card of both decks'), f'{TD} → Deck Modules',
  'Each link opens its page (for example Deal board → Opportunities, Open report → the report) and the page loads.', 'Medium', 'Functional')
C('MSW-016', U1, A, 'Customize window lists modules and reports with their pins', ADMIN, st(WS, 'Click Customize Deck', 'Read both lists', 'Click Done'), f'{TD} → Settings (Customize Note, Pinned Text, Pin Text)',
  'The window says changes are saved immediately; the pinned items match the decks; counts read n/5 on both tabs; Done closes it and nothing changes.', 'Medium', 'Functional')
C('MSW-017', U1, A, 'Pin and unpin a module updates the deck (put back)', ADMIN, st(WS, 'Customize Deck → pin a module that is not pinned (when fewer than 5 are pinned)', 'Done → read the deck', 'Customize Deck → unpin it → Done'), 'The user\'s own pins; put back after the test',
  'After pinning, the deck shows the module and the count goes up by one; after unpinning both are back; the saved pins equal the original list.', 'Medium', 'Functional')
C('MSW-018', U1, A, 'Hide and show the AI Lead Magnet (put back)', ADMIN, st(WS, 'Click Hide AI Lead Magnet', 'Reload the page', 'Click Show AI Lead Magnet'), 'The user\'s own preference; put back after the test',
  'Hide removes the AI panel and the button reads "Show AI Lead Magnet"; the choice stays after a reload; Show brings it back.', 'Low', 'Functional')
C('MSW-019', U1, A, 'AI Pulse panel shows the AI service\'s scenario', ADMIN, st(WS, 'Read the AI Pulse panel', 'Click each scenario button'), 'GET /dashboard/ai/lead-magnet',
  'Fit %, matching leads, focus title and signals equal the scenario of the API; each scenario button switches to that scenario. Ask AI is not clicked.', 'Medium', 'Integration')
C('MSW-020', U1, A, '"Show matching leads" lists the scenario\'s leads', ADMIN, st(WS, 'Note the matching leads count', 'Click Show matching leads'), 'GET /dashboard/ai/lead-magnet (filterQuery, leadCount)',
  'The Leads page opens filtered by the scenario and lists as many leads as the panel says.', 'Medium', 'Integration')
C('MSW-021', U1, A, 'WhatsApp pitch is copied and spelled correctly', ADMIN, st(WS, 'Click Copy WhatsApp pitch', 'Read the clipboard'), f'{TD} → Settings (Pitch Brand)',
  'The clipboard holds the scenario\'s pitch; the project name is spelled "Palm Exotica".', 'Medium', 'UI/UX')
C('MSW-022', U1, A, 'Executive Dashboards button opens the dashboards', ADMIN, st(WS, 'Click 📊 Executive Dashboards'), RUN, 'The dashboards (/dashboards) open on Commercial / Sales.', 'Medium', 'Functional')
C('MSW-023', U1, A, 'Reminder cards do not cover the page', ADMIN, st(WS, 'Let the "REMINDER · TASK" cards appear', 'Check what lies under them', 'Look for a way to close them'), 'Reminders shown (the other tests hide them)',
  'The reminders do not cover the header (user menu, task and calendar icons) or the page, and each can be closed without changing the task.', 'Medium', 'UI/UX')
C('MSW-024', U1, A, 'Workspace fits desktop, tablet and phone widths', ADMIN, st(WS, 'Open at 1366, 1024 and 390 px wide'), f'{TD} → Viewports',
  'No sideways scrolling; deck titles and figures are not cut off.', 'Low', 'UI/UX')
C('MSW-025', U1, A, 'Workspace figures are well formatted and the page is quick', ADMIN, st(WS, 'Time the page until the figures show', 'Read every figure'), f'{TD} → Settings (Load Budget Ms)',
  'Ready within the budget; counts are whole numbers with thousands separators; percentages end with %; nothing reads NaN or undefined.', 'Low', 'Number Format')

# ── Dashboards: page, tabs, periods ──
A = 'Page'
C('EXD-001', U2, A, 'Executive Dashboards open from My Smart Workspace', ADMIN, st(WS, 'Click 📊 Executive Dashboards'), f'{TD} → Settings (Dashboard Heading, Dashboard Welcome, Currency Text)',
  'URL /dashboards; heading "Executive Intelligence & Performance"; "Welcome back, <user>!"; "Amounts in USD".', kind='Functional')
C('EXD-002', U2, A, 'Dashboards load without errors', ADMIN, st(DB, 'Open each tab'), RUN,
  'Every request succeeds; no script error; no NaN, undefined, Infinity or empty figure on any tab.', kind='Functional')
C('EXD-003', U2, A, 'Three tabs; Commercial / Sales is shown first', ADMIN, st(DB, 'Read the tabs', 'Click each tab'), f'{TD} → Tabs',
  'Tabs Commercial / Sales, Monthly Sales & Marketing and Lead & Customer Insights; the first is active on opening; each tab shows its own content and is marked active.', kind='Functional')
C('EXD-004', U2, A, 'Report Period offers Today, This month, This year, Upto Date and Custom', ADMIN, st(DB, 'Open Report Period'), f'{TD} → Periods',
  'The five periods are offered; This month is selected on opening.', 'Medium', 'Functional')
C('EXD-005', U2, A, 'Every tab loads for every period', ADMIN, st(DB, 'Choose the tab and the period of the data row', 'Wait up to 30 s'), f'{TD} → Tabs × Periods',
  'The "Loading …" message goes away and the tab shows figures for that period (dates on the tiles follow the period).', kind='Functional')
C('EXD-006', U2, A, 'Custom period uses the From and To dates', ADMIN, st(DB, 'Choose Custom', 'Read From date and To date', 'Set From after To'), 'From = first day of the month, To = today; then From > To',
  'From and To appear, set to the first of the month and today; the request carries them; a From date after To is refused or corrected.', 'Medium', 'Functional')
C('EXD-007', U2, A, 'Tile dates follow the selected period', ADMIN, st(DB, 'Choose This month, then This year', 'Read the date range under the tiles'), RUN,
  'This month: first day of the month → today; This year: 1 January → today.', 'Medium', 'Functional')
C('EXD-008', U2, A, '"As of date" shows when the figures were taken', ADMIN, st(DB, 'Read AS OF DATE (LAST EXPORT)'), 'GET /analytics/snapshots (asOfDate, refreshedAt)',
  'The date is today and matches the date of the figures in the API.', 'Low', 'Functional')
C('EXD-009', U2, A, 'Quick actions open their pages', ADMIN, st(DB, 'Click each quick action'), f'{TD} → Quick Actions',
  'Each quick action opens its page and the page loads.', 'Medium', 'Functional')
C('EXD-010', U2, A, 'Tiles explain how each figure is counted', ADMIN, st(DB, 'Hover each tile of Commercial / Sales and Monthly Sales & Marketing'), RUN,
  'Every tile has a tooltip saying what it counts and over which dates; the dates are those of the period.', 'Low', 'UI/UX')

# ── Commercial / Sales ──
A = 'Commercial / Sales'
C('EXD-011', U3, A, 'Commercial tiles show the API figures', ADMIN, st(DB, COM, 'Read each tile', 'Read the same figure in the API'), f'{TD} → Tiles (Commercial / Sales)',
  'Each tile equals its API value, rounded only as displayed ($2.12M ↔ 2,117,376; 7% ↔ 6.96).', kind='Number Format')
C('EXD-012', U3, A, 'Total Leads and Qualified Leads equal the Leads module', ADMIN, st(DB, COM, 'Read Total Leads and Qualified Leads', 'List the leads captured in the period (and those Qualified)'), 'GET /leads (capturedAt, leadStatus)',
  'Total Leads = leads captured in the period; Qualified Leads = those of them whose status is Qualified.', kind='Integration')
C('EXD-013', U3, A, 'Site Visits equal the site visits logged on opportunities', ADMIN, st(DB, COM, 'Read Site Visits', 'Count the site visits of all opportunities dated in the period'), 'GET /opportunities/:id (siteVisits)',
  'Site Visits = number of site visits held in the period.', kind='Integration')
C('EXD-014', U3, A, 'Reservations equal the Reservations and Inventory modules', ADMIN, st(DB, COM, 'Read Reservations', 'Open Reservations (Active) and Inventory (reserved units)'), 'GET /reservations, GET /inventory/units (summary)',
  'Reservations = active reservations = reserved units in Inventory.', kind='Integration')
C('EXD-015', U3, A, 'Units Sold and Sales Value equal SPA / Sales Contracts', ADMIN, st(DB, COM, 'Read Units Sold and Sales Value', 'List signed contracts dated in the period'), 'GET /contracts (contractDate, contractValue)',
  'Units Sold = signed contracts in the period; Sales Value = the sum of their contract values.', kind='Integration')
C('EXD-016', U3, A, 'Conversion Rate = converted ÷ total leads', ADMIN, st(DB, COM, 'Read Conversion Rate and its tooltip'), RUN,
  'The rate = converted leads ÷ Total Leads × 100, rounded as shown; the tooltip quotes the same two numbers.', 'Medium', 'Functional')
C('EXD-017', U3, A, 'Sales Funnel counts and percentages', ADMIN, st(DB, COM, 'Read the Sales Funnel'), RUN,
  'Stages equal the tiles (Leads, Qualified, Reservations, Units Sold); each "(x%)" = stage ÷ leads; each conversion % = stage ÷ previous stage.', kind='Functional')
C('EXD-018', U3, A, 'Sales Value Trend equals contracts signed per month', ADMIN, st(DB, COM, 'Read the Sales Value Trend chart', 'Add up signed contracts per month'), 'GET /contracts',
  'Each month = value of contracts signed that month (USD M); the last month = Sales Value.', kind='Integration')
C('EXD-019', U3, A, 'Sales by Product Type adds up', ADMIN, st(DB, COM, 'Read Sales by Product Type', 'Group the period\'s signed contracts by unit type'), 'GET /contracts, GET /inventory/units',
  'Parts add up to TOTAL SALES = Sales Value; each % = part ÷ total; each part = contracts of that unit type.', kind='Integration')
C('EXD-020', U3, A, 'Sales by Market shares and chart scale', ADMIN, st(DB, COM, 'Read Sales by Market and its axis'), RUN,
  'Shares add up to 100 %; the axis reaches at least the largest bar.', 'Low', 'UI/UX')
C('EXD-021', U3, A, 'Sales Performance table arithmetic', ADMIN, st(DB, COM, 'Read Sales Performance (Actual, Budget, Variance, Achievement)'), RUN,
  'Actual = the tiles; Variance = Actual − Budget; Achievement = Actual ÷ Budget; Avg. Selling Price = Sales Value ÷ Units Sold.', kind='Functional')
C('EXD-022', U3, A, 'Sales budgets equal the published Sales Velocity Targets', ADMIN, st(DB, COM, 'Read the Budget column', 'Business Rules Configuration → Sales Velocity Targets'), 'GET /dashboard/summary (salesVelocity.targets)',
  'Units and Sales Value budgets = the published monthly units and revenue budgets.', 'Medium', 'Integration')
C('EXD-023', U3, A, 'Monthly Sales Comparison actuals equal the Sales Value Trend', ADMIN, st(DB, COM, 'Read Monthly Sales Comparison'), RUN,
  'The Actual of each month = the Sales Value Trend of that month.', 'Medium', 'Functional')
C('EXD-024', U3, A, 'Collections vs Sales per month', ADMIN, st(DB, COM, 'Read Collections vs Sales', MON.replace('Open', 'Then open'), 'Read Collections (Period), Collections (YTD) and Prior Month'), RUN,
  'Sales per month = the trend; this month\'s collections = Collections; last month\'s = Prior Month collections; all months add up to Collections (YTD).', kind='Functional')
C('EXD-025', U3, A, 'Receivables Aging equals SPA / Sales Contracts collections', ADMIN, st(DB, COM, 'Read Receivables Aging', 'Read outstanding and overdue in the collections summary of SPA / Sales Contracts'), 'GET /contracts/collections-summary',
  'Buckets add up to OUTSTANDING = the contracts\' outstanding amount; the 31–60, 61–90 and >90 buckets = amounts overdue that long.', kind='Integration')
C('EXD-026', U3, A, 'Top Sales Channels add up to Sales Value', ADMIN, st(DB, COM, 'Read Top Sales Channels'), RUN, 'Channel values add up to Sales Value; each % = value ÷ Sales Value.', 'Medium', 'Functional')
C('EXD-027', U3, A, 'Marketing ROI with no spend', ADMIN, st(DB, COM, 'Read Marketing ROI'), RUN,
  'Revenue Generated = Sales Value; ROI = (Revenue − Spend) ÷ Spend, and shows "—" / N/A when there is no spend (never 0 % against revenue).', 'Low', 'Number Format')
C('EXD-028', U3, A, 'Top Projects add up and list the Inventory projects', ADMIN, st(DB, COM, 'Read Top Projects by Sales Value', 'Open Inventory → Projects'), 'GET /inventory/projects',
  'Sales Value and Units Sold add up to the tiles; % of Total = value ÷ Sales Value; every project is an Inventory project.', 'Medium', 'Integration')
C('EXD-029', U3, A, 'Sales Pipeline equals Opportunities and Reservations', ADMIN, st(DB, COM, 'Read Sales Pipeline', 'Open Opportunities and Reservations'), 'GET /opportunities, GET /reservations',
  'Expected = Reservations in Hand + Open Opportunities; Open Opportunities = Opportunities Pipeline Value; Weighted = Σ budget × probability of open deals; Reservations in Hand = the Reservations module\'s active amount.', kind='Integration')
C('EXD-030', U3, A, 'Key Insights, Risks and Actions quote the tiles', ADMIN, st(DB, COM, 'Read Key Insights, Top Commercial Risks and Management Actions'), RUN,
  'Every number in the sentences equals the tile it talks about (units sold, sales value, collections, leads, qualified, conversion, reserved).', 'Medium', 'Functional')
C('EXD-031', U3, A, 'Sales Target gauge = Sales Value achievement', ADMIN, st(DB, COM, 'Read SALES TARGET'), RUN, 'The gauge % = Sales Value Achievement of Sales Performance.', 'Medium', 'Functional')

# ── Monthly Sales & Marketing ──
A = 'Monthly Sales & Marketing'
C('EXD-032', U4, A, 'Monthly tiles show the API figures', ADMIN, st(DB, MON, 'Read each tile', 'Read the same figure in the API'), f'{TD} → Tiles (Monthly Sales & Marketing)',
  'Each tile equals its API value, rounded only as displayed.', kind='Number Format')
C('EXD-033', U4, A, 'Inventory tiles equal the Inventory module', ADMIN, st(DB, MON, 'Read Total Inventory, Units Available, Units Reserved', 'Open Inventory → Units card'), 'GET /inventory/units (summary)',
  'Total, available and reserved = the Inventory module; Total = Available + Reserved + Sold.', kind='Integration')
C('EXD-034', U4, A, 'YTD sales and collections equal SPA / Sales Contracts', ADMIN, st(DB, MON, 'Read Units Sold (YTD), Gross Sales (YTD), Collections (YTD)', 'Open SPA / Sales Contracts'), 'GET /contracts, GET /contracts/collections-summary',
  'Units Sold (YTD) = contracts signed this year; Gross Sales (YTD) = their value; Collections (YTD) = collections received.', kind='Integration')
C('EXD-035', U4, A, 'Sales Summary: this month, prior month and change', ADMIN, st(DB, MON, 'Read 1. Sales Summary', 'Count contracts signed last month'), 'GET /contracts',
  'This Month = the tiles; Prior Month units and gross sales = contracts signed last month; Var % = (this − prior) ÷ prior; rates change in points (pp).', kind='Functional')
C('EXD-036', U4, A, 'Sales Performance cards: % of target', ADMIN, st(DB, MON, 'Read 2. Sales Performance'), RUN,
  'Each % = actual ÷ target; Collection Rate = Collections ÷ Gross Sales; the same % as on Commercial / Sales.', 'Medium', 'Functional')
C('EXD-037', U4, A, 'Sales by Development adds up', ADMIN, st(DB, MON, 'Read 4. Sales by Development', 'Read Top Projects on Commercial / Sales'), RUN,
  'The Total row = the sum of the rows = Units Sold and Gross Sales; % Share = units ÷ total; the rows = Top Projects of Commercial / Sales.', 'Medium', 'Functional')
C('EXD-038', U4, A, 'Sales by Unit Type equals Inventory', ADMIN, st(DB, MON, 'Read 5. Sales by Unit Type', 'Count units per type and status in Inventory'), 'GET /inventory/units',
  'Inv and Avail per type = Inventory; totals = Total Inventory / Units Available / Units Sold / Gross Sales; Sold % = Sold ÷ Inv.', kind='Integration')
C('EXD-039', U4, A, 'Unit Inventory Status equals Inventory', ADMIN, st(DB, MON, 'Read 6. Unit Inventory Status', 'Open Inventory'), 'GET /inventory/units (summary.byStatus)',
  'Counts add up to TOTAL UNITS; each % = count ÷ total; values = Inventory\'s value per status.', kind='Integration')
C('EXD-040', U4, A, 'Collections Summary arithmetic and overdue', ADMIN, st(DB, MON, 'Read 7. Collections Summary', 'Read overdue in SPA / Sales Contracts collections'), 'GET /contracts/collections-summary',
  'Gross Sales and Collections = the tiles; Achiev. = actual ÷ target; Collection Rate = Collections ÷ Gross Sales; Overdue > 30 / > 60 days = the contracts\' overdue amounts.', kind='Integration')
C('EXD-041', U4, A, 'Lead Source Performance adds up', ADMIN, st(DB, MON, 'Read 8. Lead Source Performance'), RUN,
  'TOTAL Leads = Total Leads; TOTAL Conv. = converted leads; each Conv % = Conv ÷ Leads; TOTAL = sum of the rows.', kind='Functional')
C('EXD-042', U4, A, 'Top Performing Agents add up', ADMIN, st(DB, MON, 'Read 9. Top Performing Agents'), RUN, 'The TOTAL row = sum of the agents = Units Sold, Gross Sales and Collections of the period.', 'Medium', 'Functional')
C('EXD-043', U4, A, 'Reservations by Market adds up', ADMIN, st(DB, MON, 'Read 10. Reservations by Market'), RUN, 'TOTAL units = Units Reserved; % Share adds up to 100 %.', 'Medium', 'Functional')
C('EXD-044', U4, A, 'Cancellations equal reservations cancelled in the period', ADMIN, st(DB, MON, 'Read Cancellations (Period) and 11. Cancellation Analysis', 'Open Reservations → Cancelled'), 'GET /reservations (status CANCELLED, updatedAt)',
  'Cancellations = reservations cancelled in the period; the analysis lists them by reason.', kind='Integration')
C('EXD-045', U4, A, 'Marketing Campaigns Performance covers every lead', ADMIN, st(DB, MON, 'Read 12. Marketing Campaigns Performance'), RUN,
  'The TOTAL row = sum of the rows and = Total Leads of the period (or the table says it lists only the top channels).', 'Low', 'Functional')
C('EXD-046', U4, A, 'Highlights, Risks and Actions quote the tiles', ADMIN, st(DB, MON, 'Read Key Highlights, Challenges / Risks and Next Focus Actions'), RUN,
  'Every number in the sentences equals the tile it talks about.', 'Medium', 'Functional')
C('EXD-047', U4, A, 'Exchange rate and period window in Notes', ADMIN, st(DB, MON, 'Read Notes and USD / KES', 'Read 1 USD in KES in Currency Master'), 'GET /currencies/display-context',
  'USD / KES = the Currency module rate; the period window = the dates of the tiles.', 'Medium', 'Integration')

# ── Lead & Customer Insights ──
A = 'Lead & Customer Insights'
C('EXD-048', U5, A, 'Lead & Customer Insights cards show the API figures', ADMIN, st(DB, LCI, 'Read each card', 'Read the same figure in the API'), f'{TD} → Tiles (Lead & Customer Insights)',
  'Each card equals its API value, rounded only as displayed.', kind='Number Format')
C('EXD-049', U5, A, 'Total Leads equals the Leads module', ADMIN, st(DB, LCI, 'Read Total Leads and its "Active · Converted · Disqualified" line', 'Open Leads'), 'GET /leads (summary)',
  'Total = Leads total; Active + Converted + Disqualified = Total; each part = the Leads module.', kind='Integration')
C('EXD-050', U5, A, 'Active Leads breakdown adds up', ADMIN, st(DB, LCI, 'Read Active Leads and "New · Assigned · Qual. · Other"'), 'GET /leads (status of open leads)',
  'New + Assigned + Qual. + Other = Active Leads; each part = open leads of that status.', kind='Functional')
C('EXD-051', U5, A, 'Open Opportunities equal the Opportunities module', ADMIN, st(DB, LCI, 'Read Open Opportunities', 'Open Opportunities'), 'GET /opportunities (summary.open)', 'Open Opportunities = the Open card of Opportunities.', kind='Integration')
C('EXD-052', U5, A, 'Won / SPAs Executed "to date" equals SPA / Sales Contracts', ADMIN, st(DB, LCI, 'Read Won / SPAs Executed and its line', 'Open SPA / Sales Contracts → Signed'), 'GET /contracts (summary.signed)',
  'The card says "executed SPAs to date": its number = signed contracts to date.', kind='Integration')
C('EXD-053', U5, A, 'Disqualified Leads equal the Leads module', ADMIN, st(DB, LCI, 'Read Disqualified Leads', 'Open Leads'), 'GET /leads (summary.disqualified)', 'Disqualified Leads = the Leads Disqualified card.', 'Medium', 'Integration')
C('EXD-054', U5, A, 'Units Available and Reserved Units equal Inventory', ADMIN, st(DB, LCI, 'Read Units Available and Reserved Units', 'Open Inventory'), 'GET /inventory/units (summary)',
  'Units Available and "of N sellable units" = Inventory; Reserved Units = Inventory reserved.', 'Medium', 'Integration')
C('EXD-055', U5, A, 'Sales Value (SPAs) and its count equal SPA / Sales Contracts', ADMIN, st(DB, LCI, 'Read Sales Value (SPAs) and "N signed SPAs to date"', 'Open SPA / Sales Contracts'), 'GET /contracts (summary)',
  'Value = the contracts Value card; N = signed contracts.', kind='Integration')
C('EXD-056', U5, A, 'Collections Received and Outstanding equal SPA / Sales Contracts', ADMIN, st(DB, LCI, 'Read Collections Received and Outstanding Amount'), 'GET /contracts/collections-summary',
  'Collections Received = amount received; Outstanding = outstanding of the contracts\' collections.', kind='Integration')
C('EXD-057', U5, A, 'Leads captured, converted and conversion', ADMIN, st(DB, LCI, 'Read Leads Captured, Converted, Period and Overall Conversion'), RUN,
  'Leads Captured and Converted = Commercial / Sales for the same period; Period Conversion = Converted ÷ Captured; Overall Conversion = converted ÷ total leads.', 'Medium', 'Functional')
C('EXD-058', U5, A, 'Lead Source Mix and Conversion by Source equal Monthly', ADMIN, st(DB, LCI, 'Read Lead Source Mix and Conversion by Source', MON.replace('Open', 'Then open'), 'Read 8. Lead Source Performance'), RUN,
  'Leads per source = Monthly Leads; conversion per source = Monthly Conv %.', 'Medium', 'Functional')
C('EXD-059', U5, A, 'Geography counts add up to the leads captured', ADMIN, st(DB, LCI, 'Read Geography'), 'GET /dashboard/summary (audience.byInterestCountry)',
  'The countries shown = the API; together they do not exceed Leads Captured.', 'Low', 'Functional')
C('EXD-060', U5, A, 'Capture Channel equals Monthly Marketing Campaigns', ADMIN, st(DB, LCI, 'Read Capture Channel', MON.replace('Open', 'Then open'), 'Read 12. Marketing Campaigns Performance (Leads)'), RUN,
  'Leads per channel are the same on both tabs.', 'Low', 'Functional')
C('EXD-061', U5, A, 'Leads by Status chart adds up', ADMIN, st(DB, LCI, 'Read LEADS PIPELINE · STATUS', 'Click View details'), RUN,
  'The parts add up to the total in the centre and in the note; each % = part ÷ total; View details opens Leads.', kind='Functional')
C('EXD-062', U5, A, 'Inventory by Status chart adds up', ADMIN, st(DB, LCI, 'Read UNIT INVENTORY · STATUS', 'Click View details'), RUN,
  'Available + Reserved + Sold = the total units; each % = part ÷ total; View details opens Inventory.', kind='Functional')
C('EXD-063', U5, A, 'Card amounts use one number format', ADMIN, st(DB, LCI, 'Read the money cards'), RUN,
  'All amounts use the same style (e.g. "4.67M USD"); none shows a long figure with cents next to rounded ones.', 'Low', 'Number Format')
C('EXD-064', U5, A, 'Changing the period updates the cards', ADMIN, st(DB, 'Open Lead & Customer Insights', 'Choose the period of the data row', 'Read Leads Captured, Converted, Period Conversion and Won'), f'{TD} → Periods (Today, This year, Upto Date)',
  'The cards show the API figures of the chosen period (not those of the previous period).', kind='Functional')
C('EXD-065', U5, A, 'Card links open their module', ADMIN, st(DB, LCI, 'Click each card'), f'{TD} → KPI Links', 'Each card opens its module page and the page loads.', 'Medium', 'Functional')

# ── Cross-check and UI ──
A = 'Cross-check'
C('EXD-066', U6, A, 'The same figure shows the same value on every tab', ADMIN, st(DB, 'Read the figure of the data row on each tab, period This month'), f'{TD} → Same Figures',
  'All places show the same value (rounded as displayed).', kind='Integration')
C('EXD-067', U6, A, 'Workspace deck figures equal the dashboards', ADMIN, st(WS, 'Read the Leads, Opportunities and Inventory cards', DB, 'Read the same figures'), RUN,
  'Active leads, open deals and units (total, available, reserved) are the same in both places.', kind='Integration')
A = 'UI/UX'
C('EXD-068', U6, A, 'Tile labels are readable', ADMIN, st(DB, 'Measure the font size of the tile labels and date lines'), f'{TD} → Settings (Min Font Px)',
  'Labels and the lines under the figures are at least 10 px.', 'Low', 'UI/UX')
C('EXD-069', U6, A, 'Dashboards fit desktop, tablet and phone widths', ADMIN, st(DB, 'Open each tab at 1366, 1024 and 390 px'), f'{TD} → Viewports',
  'No sideways scrolling of the page; tables scroll inside their box.', 'Low', 'UI/UX')
C('EXD-070', U6, A, 'Each tab is ready within the budget', ADMIN, st(DB, 'Time each tab until its figures show'), f'{TD} → Settings (Load Budget Ms)', 'Each tab shows its figures within 5 s.', 'Low', 'UI/UX')
C('EXD-071', U6, A, 'Tabs and Report Period can be used with the keyboard', ADMIN, st(DB, 'Move with Tab to the tabs and the Report Period', 'Press Enter / arrow keys'), RUN,
  'The tabs and the period list are reachable with the keyboard, show focus, and the active tab is marked for screen readers.', 'Low', 'UI/UX')

OVERVIEW = [
    ('Scope', 'My Smart Workspace (/) and Executive Dashboards (/dashboards): Commercial / Sales, Monthly Sales & Marketing and Lead & Customer Insights, every period.'),
    ('Test types', 'Functional (pages, tabs, periods, links, arithmetic), Integration (figures equal Leads, Opportunities, Inventory, Reservations, SPA / Sales Contracts, Tasks & Calendar, Currencies and the API), Number Format (display ↔ API values, rounding, units), UI/UX (layout, fonts, overlap, keyboard, speed).'),
    ('Use cases', 'EDU-01 My Smart Workspace · EDU-02 Dashboards page, tabs and periods · EDU-03 Commercial / Sales · EDU-04 Monthly Sales & Marketing · EDU-05 Lead & Customer Insights · EDU-06 Cross-check and UI'),
    ('Test data', f'{TD} (or TestData/csv/Executive_Dashboards/*.csv with TEST_DATA_FORMAT=csv). No figure is fixed: expected values come from the page, its API or another module at run time.'),
    ('Automation', 'tests/executive-dashboards/*.spec.ts — run with: npm run test:executive-dashboards'),
    ('Report', 'reports/Executive_Dashboards_Test_Report_<date>_<time>.xlsx'),
    ('Data changed', 'Only the signed-in user\'s workspace preferences (a pin and the AI panel), put back by the tests. Never clicked: AI Insights, Ask AI, Edit Targets, task ticks, reminder buttons. Reminder cards are hidden on screen (not dismissed) except in MSW-023.'),
]
AREA_IMPACT = {
    'Workspace': 'The home page shows wrong counts or broken links, so users start their day from wrong figures.',
    'Page': 'Executives cannot open or use the dashboards for the period they need.',
    'Commercial / Sales': 'Management reads wrong sales, pipeline or collection figures and takes decisions on them.',
    'Monthly Sales & Marketing': 'The monthly management report disagrees with the CRM records it summarises.',
    'Lead & Customer Insights': 'Lead and customer figures disagree with the Leads, Opportunities and Contracts modules.',
    'Cross-check': 'The same figure shows different values in different places, so nobody knows which one is right.',
    'UI/UX': 'The dashboards are hard to read or use.',
}
write_cases('Executive_Dashboards_Test_Cases.xlsx', 'Executive Dashboards & My Smart Workspace — Test Cases', OVERVIEW, cases, [], {}, AREA_IMPACT)
