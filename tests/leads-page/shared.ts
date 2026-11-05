/**
 * Shared pieces of the Leads page suite: page-object fixtures, a cross-worker lock around anything that
 * changes lead counts, and small helpers used by several specs.
 */
import fs from 'fs';
import path from 'path';
import { test as base, expect } from '../auth';
import { LeadsPage } from '../pages/LeadsPage';
import { LeadForm } from '../pages/LeadForm';
import { Form, LeadData, basicValues, describe, newLead } from './test-data';
import { runOnce } from '../sales-chain/data';

export const test = base.extend<{ leads: LeadsPage }>({
  leads: async ({ page }, use) => use(new LeadsPage(page)),
});
export { expect };

const LOCK = path.resolve(__dirname, '../../.auth/leads-write.lock');
/**
 * Runs `fn` while no other worker is creating or changing leads. The count-update tests read the counts
 * before and after an action, so a lead created by a parallel test in between would spoil the difference.
 */
export async function withLeadsLock<T>(fn: () => Promise<T>): Promise<T> {
  if (held) return fn(); // this worker already holds it (a worker runs one test at a time)
  await acquireLeadsLock();
  try {
    return await fn();
  } finally {
    releaseLeadsLock();
  }
}

let held = false;
/** Takes the lock for a whole test (counts.spec.ts: beforeEach / afterEach). */
export async function acquireLeadsLock() {
  fs.mkdirSync(path.dirname(LOCK), { recursive: true });
  const until = Date.now() + 8 * 60_000;
  for (;;) {
    try {
      fs.mkdirSync(LOCK);
      held = true;
      return;
    } catch {
      try {
        if (Date.now() - fs.statSync(LOCK).mtimeMs > 6 * 60_000) fs.rmSync(LOCK, { recursive: true, force: true }); // left by a killed run
      } catch { /* removed meanwhile */ }
      if (Date.now() > until) throw new Error(`Waited 8 minutes for ${LOCK}`);
      await new Promise(r => setTimeout(r, 500));
    }
  }
}
export function releaseLeadsLock() {
  if (!held) return;
  held = false;
  fs.rmSync(LOCK, { recursive: true, force: true });
}

/** Records the data a test used, shown in the Excel report's "Observed Values" column. */
export function note(type: string, description: string) {
  test.info().annotations.push({ type, description });
}

/**
 * Creates a lead through the form (mandatory fields only unless `all`), under the lock.
 * Returns the form (its success pop-up still open) and the submit result.
 */
export async function createLead(leads: LeadsPage, lead: LeadData, opts: { all?: boolean } = {}) {
  const form = new LeadForm(leads.page, lead.form);
  await form.open();
  const values = opts.all ? lead.values : basicValues(lead);
  note('test data', describe({ ...lead, values }));
  const raised = await form.fill(values);
  expect(raised.map(r => r.text), 'No format pop-up while entering valid data').toEqual([]);
  const result = await withLeadsLock(() => form.submit());
  return { form, result };
}

/** Creates a lead and returns its Lead No. (closes the success pop-up and the detail panel). */
export async function createAndGetLeadNo(leads: LeadsPage, lead: LeadData): Promise<string> {
  const { form, result } = await createLead(leads, lead);
  expect(result.saved, `Lead saved (${result.notice?.text ?? 'no pop-up'})`).toBeTruthy();
  await form.closeNotice();
  const detail = form.detail();
  await detail.waitOpen();
  const no = await detail.leadNo();
  note('lead created', `${no} · ${lead.name} · ${lead.email}`);
  return no;
}

export type SharedLead = { lead: LeadData; leadNo: string };
/**
 * The one lead of each form this run creates for the tests that only need "a lead of this run" (Lead No.,
 * owner, lists, duplicates, search …). Created once per run under the lock, whichever worker asks first;
 * `onCreated` (the create test's checks) runs only when this call is the one that saves it.
 */
export async function sharedLead(leads: LeadsPage, form: Form,
  onCreated?: (f: LeadForm, result: Awaited<ReturnType<LeadForm['submit']>>, lead: LeadData) => Promise<void>): Promise<SharedLead & { createdHere: boolean }> {
  let createdHere = false;
  const s = await withLeadsLock(() => runOnce<SharedLead>(`leads-shared-${form}`, async () => {
    const lead = newLead(form, { save: true });
    const { form: f, result } = await createLead(leads, lead);
    expect(result.saved, `Lead saved (${result.notice?.text ?? 'no pop-up'})`).toBeTruthy();
    createdHere = true;
    if (onCreated) await onCreated(f, result, lead);
    await f.closeNotice();
    const detail = f.detail();
    await detail.waitOpen();
    const leadNo = await detail.leadNo();
    note('lead created', `${leadNo} · ${lead.name} · ${lead.email}`);
    return { lead, leadNo };
  }));
  if (!createdHere) note('lead of this run (shared)', `${s.leadNo} · ${s.lead.name} · ${s.lead.email}`);
  return { ...s, createdHere };
}

/** Fills a form with a lead's mandatory values (no save). */
export async function fillBasic(form: LeadForm, lead: LeadData) {
  return form.fill(basicValues(lead));
}

export const formsUnder = (form: Form) => (form === 'Individual' ? 'individual' : 'corporate');

/** Today's date as the list shows it ("20 Oct 2026"), local and UTC (the Captured column may use either). */
export function todayShown(): string[] {
  const f = (d: Date, utc: boolean) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: utc ? 'UTC' : undefined }).format(d);
  const now = new Date();
  return [...new Set([f(now, false), f(now, true)])];
}
