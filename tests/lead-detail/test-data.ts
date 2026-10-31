/**
 * Test data for the Lead Detail suite, read at run time from TestData/Lead_Detail_Test_Data.xlsx
 * (or TestData/csv/Lead_Detail/<sheet>.csv when TEST_DATA_FORMAT=csv). Leads themselves come from
 * the Leads page data (TestData/Leads_Test_Data.xlsx). Nothing the tests type or expect is hard-coded.
 */
import { dataBook, relativeDate } from '../leads-page/test-data';

const BOOK = dataBook('Lead_Detail_Test_Data.xlsx', 'Lead_Detail');
export const DATA_SOURCE = BOOK.source;
export const sheet = BOOK.sheet;

export const setting = (name: string): string => {
  const r = sheet('Settings').find(x => x['Setting'] === name);
  if (!r) throw new Error(`Setting "${name}" missing on the Lead Detail Settings sheet`);
  return r['Value'];
};

export function message(key: string, vars: Record<string, string | number> = {}): string {
  const r = sheet('Messages').find(x => x['Message Key'] === key);
  if (!r) throw new Error(`Message "${key}" missing on the Lead Detail Messages sheet`);
  return r['Expected Text'].replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}

/** Workflow sheet column ("After Create" / "After Qualify"): item → expected state / text. */
export const workflow = (column: 'After Create' | 'After Qualify'): Record<string, string> =>
  Object.fromEntries(sheet('Workflow').map(r => [r['Item'], r[column]]));
export const workflowStages = () => sheet('Workflow').map(r => r['Item']).filter(i => !['Now', 'Next', 'Next Actions'].includes(i));

export const disqualifyReasons = () => sheet('Disqualify Reasons').map(r => ({ reason: r['Reason'], remarks: r['Remarks'] }));
export const statusChanges = () => sheet('Status Changes').map(r => ({ step: r['Step'], optionsBefore: split(r['Options Before']), status: r['Move Back To'], reason: r['Reason'] }));
export const checklist = () => sheet('Qualification Checklist').map(r => ({ item: r['Checklist Item'], label: r['Field Label'], value: r['Value'] }));
/** Field label → value pairs that complete the qualification checklist. */
export const checklistValues = (): [string, string][] => checklist().map(c => [c.label, c.value]);

export type Combination = { id: string; values: [string, string][]; budget: string; timeline: string };
export const combinations = (): Combination[] => sheet('Qualification Combinations').map(r => ({
  id: r['Combination'], budget: r['Budget'], timeline: r['Timeline'],
  values: Object.entries(r).filter(([k, v]) => k !== 'Combination' && v !== '') as [string, string][],
}));

export const dropdownOptions = (where?: string) => sheet('Dropdown Options').filter(r => !where || r['Where'] === where).map(r => ({ where: r['Where'], label: r['Field Label'], options: split(r['Options']) }));
export const optionsOf = (label: string) => {
  const r = dropdownOptions().find(x => x.label === label);
  if (!r) throw new Error(`Dropdown "${label}" missing on the Dropdown Options sheet`);
  return r.options;
};

export type CallRow = { id: string; subject: string; minutesAgo: number; direction: string; outcome: string; duration: string; priority: string; loggedFor: string; notes: string;
  followUp: boolean; followUpDays: number; followUpTime: string; editedSubject: string; editedNotes: string };
export const calls = (): CallRow[] => sheet('Call Log').map(r => ({
  id: r['Call ID'], subject: r['Subject'], minutesAgo: Number(r['Minutes Ago']), direction: r['Direction'], outcome: r['Outcome'], duration: r['Duration (minutes)'],
  priority: r['Priority'], loggedFor: r['Logged For'], notes: r['Call Notes'], followUp: /^y/i.test(r['Follow-up']), followUpDays: Number(r['Follow-up In Days'] || 0),
  followUpTime: r['Follow-up Time'], editedSubject: r['Edited Subject'], editedNotes: r['Edited Notes'],
}));
export const durationInputs = () => sheet('Duration Inputs').map(r => ({ typed: r['Typed'], expected: r['Expected Value'], why: r['Why'] }));

export type TaskRow = { id: string; kind: 'Task' | 'Meeting'; subject: string; dueDays: number; dueTime: string; reminder: string; priority: string; assignedTo: string; notes: string; editedSubject: string };
export const tasks = (kind: 'Task' | 'Meeting'): TaskRow[] => sheet('Tasks').filter(r => r['Kind'] === kind).map(r => ({
  id: r['Task ID'], kind, subject: r['Subject'], dueDays: Number(r['Due In Days']), dueTime: r['Due Time'], reminder: r['Reminder'], priority: r['Priority'],
  assignedTo: r['Assigned To'], notes: r['Notes'], editedSubject: r['Edited Subject'],
}));
export const formDefaults = (form: string): [string, string][] => sheet('Form Defaults').filter(r => r['Form'] === form).map(r => [r['Field Label'], r['Default']]);
export const exportColumns = (name: string) => sheet('Export Columns').filter(r => r['Export'] === name).map(r => r['Column']);

function split(s: string) {
  return s.split('|').map(x => x.trim()).filter(Boolean);
}

// ── Dates as the app shows them ─────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n: number) => String(n).padStart(2, '0');
/** "22 Oct 2026" */
export const shownDate = (d: Date) => `${p2(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
/** "10:00" */
export const shownTime = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
/** "22 Oct 2026, 10:00" */
export const shownDateTime = (d: Date) => `${shownDate(d)}, ${shownTime(d)}`;
/** Today + n days at "HH:MM". */
export function daysAhead(n: number, time: string): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}
/** Now − n minutes, to the minute. */
export function minutesAgo(n: number): Date {
  const d = new Date(Date.now() - n * 60_000);
  d.setSeconds(0, 0);
  return d;
}
export { relativeDate };
